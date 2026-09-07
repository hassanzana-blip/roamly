import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import {
  bookingAttemptEvents,
  bookingAttempts,
  bookingEvents,
  bookingSegments,
  bookings,
  checkoutSessions,
  customerAccounts,
  customers,
  ledgerEntries,
  passengerDocuments,
  payments,
  quotes,
  tickets as ticketsTable,
} from "../../db/schema";
import type { Offer, Order, PassengerDetails, PriceBreakdownMinor, Ticket } from "../../contracts/types";
import { airportByIata } from "../../contracts/airports";
import { env } from "./env";
import { AppError, appCodeOf, type ErrorCode } from "./errors";
import { log, withContext } from "./logger";
import { toMinor, fromMinor } from "./money";
import { decryptField } from "./crypto";
import { enqueueJob, isDuplicateKeyError } from "./jobs";
import { assertAttemptTransition, type AttemptState } from "./statemachine";
import { captureEntries, postLedger, type DbOrTx } from "./ledger";
import { issueReceipt } from "./invoices";
import {
  duffelConfig,
  duffelCreateOrder,
  duffelGetOrderByIdempotency,
  getOfferRaw,
  orderPaymentAmount,
  selectBagServices,
  type BagService,
  type SupplierOrder,
} from "./duffel";
import { demoCreateOrder, demoServicesMinor } from "./demo";
import { cancelPaymentIntent, capturePaymentIntent, stripeConfigured } from "./stripe";
import { inc } from "./metrics";

// ─── Booking-orkestrator (OTA-003/020/024/026/029) ─────────────────────────
// Idempotent tilstandsmaskin for booking_attempts:
//   PAYMENT_AUTHORIZED → SUPPLIER_ORDERING → SUPPLIER_CONFIRMED | SUPPLIER_UNKNOWN | FAILED_VOIDED
//   SUPPLIER_UNKNOWN   → SUPPLIER_CONFIRMED | FAILED_VOIDED   (gjenoppretting via metadata.attempt_id)
//   SUPPLIER_CONFIRMED → CAPTURED (fangst hos PSP)            (feil → booking i REVIEW, aldri auto-kansellering)
//   CAPTURED           → CONFIRMED (booking, billetter, betaling, hovedbok, kvittering, e-post)
//
// Hvert steg låser forsøket (FOR UPDATE) i en kort transaksjon, gjør evt.
// eksterne kall UTENFOR låsen, og skriver resultatet i en ny kort transaksjon.
// Alle beløp i minste enhet. Ingen Number() på desimaler utenom money.ts.

export type SessionRow = typeof checkoutSessions.$inferSelect;
export type AttemptRow = typeof bookingAttempts.$inferSelect;
export type PspProvider = "stripe" | "demo" | "manual";

export type OfferSnapshot = { offer: Offer; rawServices: BagService[] };

export function parseOfferSnapshot(raw: string): OfferSnapshot {
  const parsed = JSON.parse(raw) as Partial<OfferSnapshot> & Partial<Offer>;
  if (parsed && typeof parsed === "object" && "offer" in parsed && parsed.offer) {
    return { offer: parsed.offer, rawServices: parsed.rawServices ?? [] };
  }
  return { offer: parsed as Offer, rawServices: [] };
}

export function parseBreakdown(session: SessionRow): PriceBreakdownMinor {
  try {
    const b = JSON.parse(session.breakdownJson) as PriceBreakdownMinor;
    if (b && typeof b.totalAmountMinor === "number") return b;
  } catch {
    /* fall through */
  }
  return {
    currency: session.currency,
    supplierAmountMinor: session.supplierAmountMinor,
    servicesAmountMinor: session.servicesAmountMinor,
    serviceFeeAmountMinor: session.serviceFeeAmountMinor,
    bonusUsedMinor: session.bonusUsedMinor,
    totalAmountMinor: session.totalAmountMinor,
  };
}

export function parseServices(session: SessionRow): { extraBags: number; bagsByPassenger?: Record<string, number> } | undefined {
  if (!session.servicesJson) return undefined;
  try {
    const s = JSON.parse(session.servicesJson) as { extraBags?: number; bagsByPassenger?: Record<string, number> };
    return { extraBags: Math.max(0, Math.floor(s.extraBags ?? 0)), ...(s.bagsByPassenger ? { bagsByPassenger: s.bagsByPassenger } : {}) };
  } catch {
    return undefined;
  }
}

/** Tilbuds-ID når sesjonen stammer fra assisted booking (searchCtx = "quote:<id>"). */
export function quoteIdOf(session: Pick<SessionRow, "searchCtx">): number | null {
  const m = /^quote:(\d+)$/.exec(session.searchCtx ?? "");
  return m ? Number(m[1]) : null;
}

export function providerOf(session: SessionRow): PspProvider {
  if (session.pspProvider === "stripe") return "stripe";
  if (session.pspProvider === "manual") return "manual";
  return "demo";
}

// ─── Rene beslutningsfunksjoner (testes isolert) ───────────────────────────

export type RevalidationDecision =
  | { action: "proceed" }
  | { action: "expired"; expiresAt: string }
  | { action: "price_changed"; previousMinor: number; freshMinor: number; currency: string };

/**
 * Sammenlign det kunden godtok (session) med ferskt tilbud fra leverandøren.
 * Lavere pris → fortsett (kunden betaler det som ble godtatt; differansen er vår margin).
 */
export function decideAfterRevalidation(
  session: { supplierAmountMinor: number; servicesAmountMinor: number; currency: string },
  fresh: { expiresAt: string | null | undefined; supplierMinor: number; servicesMinor: number; currency: string },
  nowMs = Date.now(),
  safetyMarginMs = 15_000,
): RevalidationDecision {
  const exp = fresh.expiresAt ? Date.parse(fresh.expiresAt) : NaN;
  if (!Number.isFinite(exp) || exp <= nowMs + safetyMarginMs) {
    return { action: "expired", expiresAt: fresh.expiresAt ?? "" };
  }
  const previousMinor = session.supplierAmountMinor + session.servicesAmountMinor;
  const freshMinor = fresh.supplierMinor + fresh.servicesMinor;
  if (fresh.currency.toUpperCase() !== session.currency.toUpperCase() || freshMinor > previousMinor) {
    return { action: "price_changed", previousMinor, freshMinor, currency: fresh.currency };
  }
  return { action: "proceed" };
}

/** Skal forsøket behandles i denne tilstanden? (SUPPLIER_ORDERING kun når det ser forlatt ut.) */
export function shouldProcessAttempt(state: string, updatedAt: Date, nowMs = Date.now(), staleMs = 2 * 60_000): boolean {
  if (["PAYMENT_AUTHORIZED", "SUPPLIER_UNKNOWN", "SUPPLIER_CONFIRMED", "CAPTURED"].includes(state)) return true;
  if (state === "SUPPLIER_ORDERING") return nowMs - updatedAt.getTime() > staleMs;
  return false;
}

// ─── Tilstandsoverganger og hjelpere ───────────────────────────────────────

async function recordAttemptTransition(tx: DbOrTx, attempt: AttemptRow, to: AttemptState, detail?: Record<string, unknown>, patch: Partial<AttemptRow> = {}) {
  assertAttemptTransition(attempt.state, to);
  await tx
    .update(bookingAttempts)
    .set({ state: to, ...patch })
    .where(eq(bookingAttempts.id, attempt.id));
  await tx.insert(bookingAttemptEvents).values({
    attemptId: attempt.id,
    fromState: attempt.state,
    toState: to,
    detail: detail ? JSON.stringify(detail).slice(0, 4000) : null,
  });
  log.info({ attemptId: attempt.id, from: attempt.state, to }, "booking-forsøk: overgang");
}

/**
 * Sett en checkout-sesjon i sluttilstand (failed/expired/cancelled/price_changed)
 * og frigi reservert bonus — kun én gang (atomisk WHERE status IN aktive).
 */
export async function failSession(
  db: DbOrTx,
  sessionId: number,
  status: "failed" | "expired" | "cancelled" | "price_changed",
  errorCode: string | null,
  errorMessage: string | null,
): Promise<boolean> {
  const [session] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, sessionId)).limit(1);
  if (!session) return false;
  const res = await db
    .update(checkoutSessions)
    .set({ status, lastError: errorCode ? `${errorCode}: ${errorMessage ?? ""}`.slice(0, 4000) : (errorMessage ?? null) })
    .where(and(eq(checkoutSessions.id, sessionId), inArray(checkoutSessions.status, ["created", "payment_pending", "authorized", "booking"])));
  const changed = Number(res[0].affectedRows) > 0;
  if (changed && session.bonusUsedMinor > 0 && session.customerAccountId) {
    const kr = Math.floor(session.bonusUsedMinor / 100);
    if (kr > 0) {
      await db
        .update(customerAccounts)
        .set({ bonusKr: sql`${customerAccounts.bonusKr} + ${kr}` })
        .where(eq(customerAccounts.id, session.customerAccountId));
    }
  }
  return changed;
}

async function voidPaymentIntent(session: SessionRow, attempt: AttemptRow): Promise<void> {
  if (providerOf(session) !== "stripe" || !session.pspIntentId || !stripeConfigured()) return;
  try {
    await cancelPaymentIntent(session.pspIntentId, attempt.idempotencyKey, "abandoned");
  } catch (err) {
    // Allerede kansellert/fanget → ikke fatalt; logg og la ops se det i avstemming.
    log.warn({ err, attemptId: attempt.id, pspIntentId: session.pspIntentId }, "Kunne ikke annullere PaymentIntent");
  }
}

function customerLocale(session: SessionRow): string {
  return session.locale || "nb";
}

async function enqueueEmail(kind: string, to: string, locale: string, payload: Record<string, unknown>, opts: { bookingId?: number; dedupeKey?: string } = {}) {
  await enqueueJob("send_email", { kind, to, locale, payload, ...(opts.bookingId ? { bookingId: opts.bookingId } : {}) }, { dedupeKey: opts.dedupeKey }).catch((err) => {
    log.error({ err, kind }, "Kunne ikke legge e-post i kø");
  });
}

async function opsAlert(subject: string, body: string, dedupeKey?: string) {
  await enqueueJob("send_email", { kind: "ops_alert", subject, body }, { dedupeKey }).catch(() => {});
}

/** Terminal feil: annuller betaling, marker forsøk + sesjon, varsle kunde. */
async function failAttemptTerminal(
  attempt: AttemptRow,
  session: SessionRow,
  code: ErrorCode | "PRICE_CHANGED" | "DAILY_CAP",
  message: string,
  opts: { alertOps?: boolean } = {},
): Promise<void> {
  await voidPaymentIntent(session, attempt);
  const db = getDb();
  await db.transaction(async (tx) => {
    const [fresh] = await tx.select().from(bookingAttempts).where(eq(bookingAttempts.id, attempt.id)).for("update");
    if (!fresh || fresh.state === "FAILED_VOIDED") return;
    await recordAttemptTransition(tx, fresh, "FAILED_VOIDED", { code, message }, { lastErrorCode: code, lastError: message.slice(0, 4000) });
    inc("booking_attempts_failed_total", { code });
    await failSession(tx, session.id, code === "PRICE_CHANGED" ? "price_changed" : "failed", code, message);
    const quoteId = quoteIdOf(session);
    if (quoteId) await tx.update(quotes).set({ status: "failed" }).where(eq(quotes.id, quoteId));
  });
  const breakdown = parseBreakdown(session);
  const locale = customerLocale(session);
  const { offer } = parseOfferSnapshot(session.offerSnapshot);
  const firstName = (JSON.parse(session.passengersJson) as PassengerDetails[])[0]?.givenName;
  const route = offer.slices.map((s) => `${s.origin.iata} → ${s.destination.iata}`).join(" · ");
  if (code === "OFFER_EXPIRED" || code === "PRICE_CHANGED" || code === "SUPPLIER_REJECTED" || code === "DAILY_CAP" || code === "SUPPLIER_TIMEOUT") {
    await enqueueEmail(
      "booking_failed_refunded",
      session.contactEmail,
      locale,
      { firstName, route, amount: fromMinor(breakdown.totalAmountMinor, breakdown.currency), currency: breakdown.currency, reference: session.publicId },
      { dedupeKey: `booking-failed:${attempt.id}` },
    );
  } else {
    await enqueueEmail(
      "payment_failed",
      session.contactEmail,
      locale,
      { firstName, route, retryUrl: `${env.baseUrl}/checkout?resume=${encodeURIComponent(session.publicId)}` },
      { dedupeKey: `payment-failed:${attempt.id}` },
    );
  }
  if (opts.alertOps) {
    await opsAlert(
      `Booking feilet (${code}): ${session.publicId}`,
      `Forsøk ${attempt.id} endte i FAILED_VOIDED.\nÅrsak: ${code} — ${message}\nKunde: ${session.contactEmail}\nBeløp: ${fromMinor(breakdown.totalAmountMinor, breakdown.currency)} ${breakdown.currency}`,
      `ops-fail:${attempt.id}`,
    );
  }
}

/** Passasjerer med dekrypterte identitetsdokumenter (kun i minnet, kun til leverandørkallet). */
async function passengersWithDocuments(db: DbOrTx, session: SessionRow): Promise<PassengerDetails[]> {
  const passengers = JSON.parse(session.passengersJson) as PassengerDetails[];
  const docs = await db.select().from(passengerDocuments).where(eq(passengerDocuments.checkoutSessionId, session.id));
  if (docs.length === 0) return passengers;
  return passengers.map((p) => {
    const d = docs.find((x) => x.passengerId === p.id);
    if (!d) return p;
    return {
      ...p,
      identityDocument: {
        type: "passport",
        uniqueIdentifier: decryptField(d.identifierCiphertext),
        issuingCountryCode: d.issuingCountryCode,
        expiresOn: d.expiresOn,
      },
    };
  });
}

async function sumLiveTodayMinor(db: DbOrTx): Promise<number> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${checkoutSessions.totalAmountMinor}), 0)` })
    .from(checkoutSessions)
    .where(
      and(
        gte(checkoutSessions.createdAt, dayStart),
        inArray(checkoutSessions.status, ["authorized", "booking", "confirmed"]),
        eq(checkoutSessions.pspProvider, "stripe"),
      ),
    );
  return Number(row?.total ?? 0);
}

// ─── Steg 1: revalider tilbud og bestill hos leverandør ────────────────────

async function stepOrder(attempt: AttemptRow, session: SessionRow): Promise<void> {
  const db = getDb();
  const snapshot = parseOfferSnapshot(session.offerSnapshot);
  const services = parseServices(session);
  const live = duffelConfig.configured;

  // Daglig live-tak (kun ekte leverandør + ekte PSP)
  if (duffelConfig.liveMode && env.MAX_DAILY_LIVE_AMOUNT_MINOR > 0 && providerOf(session) === "stripe") {
    const today = await sumLiveTodayMinor(db);
    if (today > env.MAX_DAILY_LIVE_AMOUNT_MINOR) {
      await failAttemptTerminal(attempt, session, "DAILY_CAP", "Daglig grense for live-bookinger er nådd.", { alertOps: true });
      return;
    }
  }

  // Ferskt tilbud
  let offer: Offer;
  let rawServices: BagService[];
  let freshServicesMinor: number;
  let selected: ReturnType<typeof selectBagServices> = [];
  if (live) {
    try {
      const fresh = await getOfferRaw(session.offerId);
      offer = fresh.offer;
      rawServices = fresh.rawServices;
    } catch (err) {
      const code = appCodeOf(err);
      if (code === "OFFER_EXPIRED" || code === "OFFER_NOT_FOUND" || code === "NOT_FOUND") {
        await failAttemptTerminal(attempt, session, "OFFER_EXPIRED", "Tilbudet utløp før bestillingen kunne fullføres.");
        return;
      }
      throw err; // SUPPLIER_UNAVAILABLE/TIMEOUT → jobben retryes
    }
    selected = selectBagServices(rawServices, offer.passengers, services);
    freshServicesMinor = selected.reduce((s, x) => s + x.amountMinor, 0);
  } else {
    offer = snapshot.offer;
    rawServices = snapshot.rawServices;
    freshServicesMinor = demoServicesMinor(offer, services?.extraBags ?? 0);
  }

  const decision = decideAfterRevalidation(session, {
    expiresAt: offer.expiresAt,
    supplierMinor: toMinor(offer.totalAmount, offer.totalCurrency),
    servicesMinor: freshServicesMinor,
    currency: offer.totalCurrency,
  });
  if (decision.action === "expired") {
    await failAttemptTerminal(attempt, session, "OFFER_EXPIRED", "Tilbudet utløp før bestillingen kunne fullføres.");
    return;
  }
  if (decision.action === "price_changed") {
    await failAttemptTerminal(
      attempt,
      session,
      "PRICE_CHANGED",
      `Prisen økte fra ${fromMinor(decision.previousMinor, session.currency)} til ${fromMinor(decision.freshMinor, decision.currency)} ${decision.currency}.`,
    );
    return;
  }

  // Beløp til leverandør = ferskt tilbud + tjenester (≤ det kunden godtok)
  const payment = live
    ? orderPaymentAmount(offer, selected)
    : { amountMinor: toMinor(offer.totalAmount, offer.totalCurrency) + freshServicesMinor, currency: offer.totalCurrency.toUpperCase(), amount: "" };

  // Lås: marker SUPPLIER_ORDERING (claim) før det eksterne kallet
  const claimed = await db.transaction(async (tx) => {
    const [fresh] = await tx.select().from(bookingAttempts).where(eq(bookingAttempts.id, attempt.id)).for("update");
    if (!fresh || fresh.state !== "PAYMENT_AUTHORIZED") return null;
    await recordAttemptTransition(tx, fresh, "SUPPLIER_ORDERING", { amountMinor: payment.amountMinor, currency: payment.currency });
    await tx.update(checkoutSessions).set({ status: "booking" }).where(eq(checkoutSessions.id, session.id));
    return { ...fresh, state: "SUPPLIER_ORDERING" as const };
  });
  if (!claimed) return;

  const passengers = await passengersWithDocuments(db, session);
  let order: SupplierOrder;
  try {
    if (live) {
      order = await duffelCreateOrder({
        offer,
        rawServices,
        passengers,
        contactEmail: session.contactEmail,
        contactPhone: session.contactPhone,
        services,
        idempotencyKey: attempt.idempotencyKey,
        attemptId: attempt.id,
        paymentType: "balance",
        amountMinor: payment.amountMinor,
        currency: payment.currency,
      });
    } else {
      order = demoCreateOrder({
        offer,
        passengers: passengers.map((p) => ({ id: p.id, givenName: p.givenName, familyName: p.familyName, type: p.type })),
        amountMinor: payment.amountMinor,
        attemptId: attempt.id,
      });
    }
  } catch (err) {
    const code = appCodeOf(err);
    const message = err instanceof Error ? err.message : String(err);
    if (code === "SUPPLIER_TIMEOUT" || code === "SUPPLIER_UNAVAILABLE" || code === null) {
      // Ukjent utfall — ordren KAN finnes hos leverandøren. Aldri bestill på nytt blindt.
      await db.transaction(async (tx) => {
        const [fresh] = await tx.select().from(bookingAttempts).where(eq(bookingAttempts.id, attempt.id)).for("update");
        if (!fresh || fresh.state !== "SUPPLIER_ORDERING") return;
        await recordAttemptTransition(tx, fresh, "SUPPLIER_UNKNOWN", { code, message }, { lastErrorCode: code ?? "UNKNOWN", lastError: message.slice(0, 4000) });
      });
      await enqueueJob("recover_attempt", { attemptId: attempt.id }, { dedupeKey: `recover:${attempt.id}`, runAt: new Date(Date.now() + 2 * 60_000), priority: 1 });
      return;
    }
    // Terminal avvisning (422/utløpt/prisfeil)
    await failAttemptTerminal(claimed, session, code === "OFFER_EXPIRED" ? "OFFER_EXPIRED" : code === "PRICE_CHANGED" ? "PRICE_CHANGED" : "SUPPLIER_REJECTED", message, {
      alertOps: code !== "OFFER_EXPIRED",
    });
    return;
  }

  await markSupplierConfirmed(attempt.id, order, "SUPPLIER_ORDERING");
}

async function markSupplierConfirmed(attemptId: number, order: SupplierOrder, expectedFrom: AttemptState): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [fresh] = await tx.select().from(bookingAttempts).where(eq(bookingAttempts.id, attemptId)).for("update");
    if (!fresh || fresh.state !== expectedFrom) return;
    await recordAttemptTransition(
      tx,
      fresh,
      "SUPPLIER_CONFIRMED",
      { supplierOrderId: order.id, bookingReference: order.bookingReference || null },
      {
        supplierOrderId: order.id,
        supplierBookingReference: order.bookingReference || null,
        supplierTotalMinor: toMinor(order.totalAmount, order.totalCurrency),
        supplierCurrency: order.totalCurrency,
        lastError: null,
        lastErrorCode: null,
      },
    );
  });
  // Ordre-øyeblikksbildet trengs i finaliseringen — lagres på sesjonen som "orderSnapshot" i lastError? Nei:
  // vi lagrer det i booking_attempt_events (detail) og henter ordren på nytt ved behov.
  orderCache.set(attemptId, order);
}

/** Kortlivet cache av leverandørordren mellom steg i samme prosess (faller tilbake til getOrder). */
const orderCache = new Map<number, SupplierOrder>();

// ─── Steg 2: gjenoppretting etter ukjent utfall ────────────────────────────

const MAX_RECOVERY_ATTEMPTS = 3;

async function stepRecover(attempt: AttemptRow, session: SessionRow): Promise<void> {
  const db = getDb();
  const attempts = attempt.attempts + 1;
  await db.update(bookingAttempts).set({ attempts }).where(eq(bookingAttempts.id, attempt.id));

  let found: SupplierOrder | null = null;
  try {
    found = duffelConfig.configured ? await duffelGetOrderByIdempotency(attempt.id, new Date(attempt.createdAt.getTime() - 60_000)) : null;
  } catch (err) {
    log.warn({ err, attemptId: attempt.id }, "Gjenoppretting: leverandøroppslag feilet");
  }
  if (found) {
    await markSupplierConfirmed(attempt.id, found, "SUPPLIER_UNKNOWN");
    return;
  }
  if (attempts >= MAX_RECOVERY_ATTEMPTS) {
    await failAttemptTerminal({ ...attempt, attempts }, session, "SUPPLIER_TIMEOUT", "Fikk ikke bekreftelse fra flyselskapet. Betalingen er annullert.", { alertOps: true });
    await opsAlert(
      `Gjenoppretting ga opp: forsøk ${attempt.id}`,
      `Forsøk ${attempt.id} (sesjon ${session.publicId}) fant ingen ordre hos leverandøren etter ${attempts} forsøk. Betalingen er annullert. Sjekk Duffel-dashboardet for ordre med metadata.attempt_id=${attempt.id} — finnes den, må den kanselleres manuelt.`,
      `ops-recover-giveup:${attempt.id}`,
    );
    return;
  }
  // Egen dedupe-nøkkel per runde: den kjørende recover-jobben holder fortsatt sin
  // active_dedupe_key, så samme nøkkel ville blitt stille avvist (og gjenopprettingen stoppet).
  await enqueueJob("recover_attempt", { attemptId: attempt.id }, { dedupeKey: `recover:${attempt.id}:${attempts}`, runAt: new Date(Date.now() + 2 * 60_000 * attempts), priority: 1 });
}

// ─── Steg 3: fangst hos PSP ────────────────────────────────────────────────

/** Antall tidligere mislykkede fangstforsøk (hendelser med `captureFailed`). */
async function captureFailureCount(db: DbOrTx, attemptId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(bookingAttemptEvents)
    .where(and(eq(bookingAttemptEvents.attemptId, attemptId), sql`${bookingAttemptEvents.detail} LIKE '{"captureFailed%'`));
  return Number(row?.n ?? 0);
}

/**
 * Idempotensnøkkel for fangst: som for refusjoner får hvert NYTT forsøk etter en
 * feil egen nøkkel — ellers ville Stripe spilt av det feilede svaret på nytt.
 */
export function captureIdempotencyKey(base: string, failedBefore: number): string {
  return failedBefore > 0 ? `${base}:c${failedBefore}` : base;
}

async function stepCapture(attempt: AttemptRow, session: SessionRow): Promise<void> {
  const db = getDb();
  const provider = providerOf(session);
  let chargeId: string | null = null;
  if (provider === "stripe") {
    if (!session.pspIntentId) throw new AppError("INTERNAL", { message: "Sesjon mangler PaymentIntent." });
    try {
      const failedBefore = await captureFailureCount(db, attempt.id);
      const pi = await capturePaymentIntent(session.pspIntentId, captureIdempotencyKey(attempt.idempotencyKey, failedBefore), session.totalAmountMinor);
      if (pi.status !== "succeeded") throw new AppError("PAYMENT_FAILED", { message: `PaymentIntent-status ${pi.status}` });
      chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : (pi.latest_charge?.id ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Penger i risiko: leverandørordren finnes. ALDRI auto-kanseller — legg booking i REVIEW.
      log.error({ err, attemptId: attempt.id }, "Fangst feilet etter leverandørbekreftelse");
      await db.update(bookingAttempts).set({ lastErrorCode: "CAPTURE_FAILED", lastError: message.slice(0, 4000) }).where(eq(bookingAttempts.id, attempt.id));
      await db.insert(bookingAttemptEvents).values({ attemptId: attempt.id, fromState: attempt.state, toState: attempt.state, detail: JSON.stringify({ captureFailed: message }) });
      const order = await loadSupplierOrder(attempt);
      const { bookingId } = await finalizeBooking(attempt, session, order, { bookingState: "REVIEW", paymentStatus: "authorized", chargeId: null });
      await opsAlert(
        `PENGER I RISIKO: fangst feilet for ${order.bookingReference || order.id}`,
        `Leverandørordre ${order.id} er bekreftet, men fangst av betalingen feilet.\nBooking-ID: ${bookingId}\nForsøk: ${attempt.id}\nFeil: ${message}\n\nBookingen ligger i REVIEW. Fang beløpet manuelt i Stripe eller kanseller ordren hos leverandøren, og oppdater status i admin.`,
        `ops-capture-failed:${attempt.id}`,
      );
      return;
    }
  }
  await db.transaction(async (tx) => {
    const [fresh] = await tx.select().from(bookingAttempts).where(eq(bookingAttempts.id, attempt.id)).for("update");
    if (!fresh || fresh.state !== "SUPPLIER_CONFIRMED") return;
    await recordAttemptTransition(tx, fresh, "CAPTURED", { provider, chargeId }, { pspChargeId: chargeId, pspIntentId: session.pspIntentId ?? null });
  });
}

async function loadSupplierOrder(attempt: AttemptRow): Promise<SupplierOrder> {
  const cached = orderCache.get(attempt.id);
  if (cached) return cached;
  if (!attempt.supplierOrderId) throw new AppError("INTERNAL", { message: "Forsøket mangler leverandørordre." });
  if (duffelConfig.configured) {
    const { duffelGetOrder } = await import("./duffel");
    const order = await duffelGetOrder(attempt.supplierOrderId);
    orderCache.set(attempt.id, order);
    return order;
  }
  // Demo uten cache (prosessen er restartet): rekonstruer fra sesjonens øyeblikksbilde
  const db = getDb();
  const [session] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, attempt.checkoutSessionId)).limit(1);
  if (!session) throw new AppError("INTERNAL", { message: "Sesjon mangler." });
  const { offer } = parseOfferSnapshot(session.offerSnapshot);
  const passengers = JSON.parse(session.passengersJson) as PassengerDetails[];
  const order = demoCreateOrder({
    offer,
    passengers: passengers.map((p) => ({ id: p.id, givenName: p.givenName, familyName: p.familyName, type: p.type })),
    amountMinor: attempt.supplierTotalMinor ?? session.supplierAmountMinor + session.servicesAmountMinor,
    attemptId: attempt.id,
  });
  const rebuilt: SupplierOrder = { ...order, id: attempt.supplierOrderId, bookingReference: attempt.supplierBookingReference ?? order.bookingReference };
  orderCache.set(attempt.id, rebuilt);
  return rebuilt;
}

// ─── Steg 4: finaliser booking ─────────────────────────────────────────────

export function buildOrderPayload(input: {
  order: SupplierOrder;
  offer: Offer;
  passengers: PassengerDetails[];
  session: SessionRow;
  breakdown: PriceBreakdownMinor;
  tickets: Ticket[];
}): Order {
  const { order, offer, session, breakdown } = input;
  const services = parseServices(session);
  return {
    id: order.id,
    bookingReference: order.bookingReference,
    liveMode: order.liveMode,
    demoMode: !duffelConfig.configured,
    createdAt: order.createdAt,
    totalAmount: fromMinor(breakdown.totalAmountMinor, breakdown.currency),
    totalCurrency: breakdown.currency,
    cabinClass: offer.cabinClass,
    slices: order.slices.length ? order.slices : offer.slices,
    passengers: input.passengers.map((p) => ({ ...p, identityDocument: undefined })),
    contactEmail: session.contactEmail,
    contactPhone: session.contactPhone,
    paymentStatus: "succeeded",
    tickets: input.tickets,
    services: services ? { extraBags: services.extraBags, ...(services.bagsByPassenger ? { bagsByPassenger: services.bagsByPassenger } : {}) } : undefined,
    servicesAmount: breakdown.servicesAmountMinor > 0 ? fromMinor(breakdown.servicesAmountMinor, breakdown.currency) : undefined,
    serviceFeeAmount: fromMinor(breakdown.serviceFeeAmountMinor, breakdown.currency),
    supplierAmount: fromMinor(breakdown.supplierAmountMinor, breakdown.currency),
    paymentMethod: (session.paymentMethod as Order["paymentMethod"]) ?? "card",
    bonusUsedKr: breakdown.bonusUsedMinor > 0 ? Math.floor(breakdown.bonusUsedMinor / 100) : undefined,
    conditions: order.conditions ?? offer.conditions,
    cancelledAt: order.cancelledAt,
  };
}

async function upsertCustomer(tx: DbOrTx, email: string, name: string | null, phone: string | null): Promise<number> {
  await tx
    .insert(customers)
    .values({ email, name, phone })
    .onDuplicateKeyUpdate({ set: { name: sql`COALESCE(${customers.name}, VALUES(name))`, phone: sql`COALESCE(VALUES(phone), ${customers.phone})` } });
  const [row] = await tx.select({ id: customers.id }).from(customers).where(eq(customers.email, email)).limit(1);
  if (!row) throw new AppError("INTERNAL", { message: "Kunne ikke opprette kunde." });
  return row.id;
}

/**
 * Skriver booking + alle avledede rader i ÉN transaksjon. Idempotent: finnes
 * bookingen (attempt.bookingId eller unik idempotencyKey) oppdateres den.
 */
async function finalizeBooking(
  attempt: AttemptRow,
  session: SessionRow,
  order: SupplierOrder,
  opts: { bookingState: "CONFIRMED" | "BOOKING_PROCESSING" | "REVIEW"; paymentStatus: "captured" | "authorized"; chargeId: string | null },
): Promise<{ bookingId: number; invoiceNumber: number | null }> {
  const db = getDb();
  const breakdown = parseBreakdown(session);
  const { offer } = parseOfferSnapshot(session.offerSnapshot);
  const passengers = JSON.parse(session.passengersJson) as PassengerDetails[];
  const provider = providerOf(session);
  const payload = buildOrderPayload({ order, offer, passengers, session, breakdown, tickets: order.tickets });
  const email = session.contactEmail.toLowerCase();
  const firstPax = passengers[0];

  return db.transaction(async (tx) => {
    const [freshAttempt] = await tx.select().from(bookingAttempts).where(eq(bookingAttempts.id, attempt.id)).for("update");
    if (!freshAttempt) throw new AppError("INTERNAL", { message: "Forsøk forsvant." });

    // Booking (finnes den fra før: oppdater)
    let invoiceNumber: number | null = null;
    let bookingId = freshAttempt.bookingId ?? null;
    if (!bookingId) {
      const [byKey] = await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.idempotencyKey, session.idempotencyKey)).limit(1);
      bookingId = byKey?.id ?? null;
    }
    const customerId = await upsertCustomer(tx, email, firstPax ? `${firstPax.givenName} ${firstPax.familyName}` : null, session.contactPhone);

    if (!bookingId) {
      const result = await tx.insert(bookings).values({
        orderId: order.id,
        bookingReference: order.bookingReference,
        contactEmail: email,
        contactPhone: session.contactPhone,
        liveMode: order.liveMode,
        payload: JSON.stringify(payload),
        state: opts.bookingState,
        customerId,
        customerAccountId: session.customerAccountId ?? null,
        checkoutSessionId: session.id,
        totalAmount: fromMinor(breakdown.totalAmountMinor, breakdown.currency),
        totalCurrency: breakdown.currency,
        source: session.searchCtx?.startsWith("quote:") ? "admin_quote" : "web",
        idempotencyKey: session.idempotencyKey,
        supplier: duffelConfig.configured ? "duffel" : "demo",
        cancelledAt: order.cancelledAt ? new Date(order.cancelledAt) : null,
      });
      bookingId = Number(result[0].insertId);
      await tx.insert(bookingEvents).values([
        { bookingId, fromState: null, toState: "PAYMENT_AUTHORIZED", actorType: "system", reason: `Betaling autorisert (${provider})`, correlationId: attempt.idempotencyKey },
        { bookingId, fromState: "PAYMENT_AUTHORIZED", toState: "BOOKING_PROCESSING", actorType: "worker", reason: "Ordre sendt til leverandør", correlationId: attempt.idempotencyKey },
        {
          bookingId,
          fromState: "BOOKING_PROCESSING",
          toState: opts.bookingState,
          actorType: "worker",
          reason:
            opts.bookingState === "CONFIRMED"
              ? `Bekreftet hos leverandør (${order.bookingReference})`
              : opts.bookingState === "REVIEW"
                ? "Leverandør bekreftet, men fangst av betaling feilet — manuell gjennomgang"
                : "Leverandør bekreftet uten PNR — avventer avstemming",
          correlationId: attempt.idempotencyKey,
        },
      ]);
      let segIdx = 0;
      const segRows = payload.slices.flatMap((slice, si) =>
        slice.segments.map((seg) => ({
          bookingId: bookingId as number,
          sliceIndex: si,
          segmentIndex: segIdx++,
          originIata: seg.origin.iata,
          destinationIata: seg.destination.iata,
          carrierIata: seg.carrier.iata || null,
          flightNumber: seg.flightNumber || null,
          departingAt: seg.departingAt,
          arrivingAt: seg.arrivingAt,
          cabinClass: seg.cabinClass,
        })),
      );
      if (segRows.length) await tx.insert(bookingSegments).values(segRows);
    } else {
      const [existing] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
      if (existing && existing.state !== opts.bookingState && (existing.state === "REVIEW" || existing.state === "BOOKING_PROCESSING")) {
        await tx.update(bookings).set({ state: opts.bookingState, bookingReference: order.bookingReference || existing.bookingReference, payload: JSON.stringify(payload) }).where(eq(bookings.id, bookingId));
        await tx.insert(bookingEvents).values({
          bookingId,
          fromState: existing.state,
          toState: opts.bookingState,
          actorType: "worker",
          reason: "Betaling fanget — booking bekreftet",
          correlationId: attempt.idempotencyKey,
        });
      }
    }

    // Billetter (idempotent via unik (bookingId, uniqueIdentifier))
    for (const t of order.tickets) {
      try {
        await tx.insert(ticketsTable).values({ bookingId, passengerId: t.passengerId, passengerName: t.passengerName, type: t.type, uniqueIdentifier: t.uniqueIdentifier });
      } catch (err) {
        if (!isDuplicateKeyError(err)) throw err;
      }
    }

    // Identitetsdokumenter flyttes til bookingen
    await tx.update(passengerDocuments).set({ bookingId }).where(eq(passengerDocuments.checkoutSessionId, session.id));

    // Betaling (idempotent via unik idempotencyKey)
    const payIdem = `pay:${attempt.idempotencyKey}`;
    let [payment] = await tx.select().from(payments).where(eq(payments.idempotencyKey, payIdem)).limit(1);
    const quoteId = quoteIdOf(session);
    if (!payment && provider === "manual" && quoteId) {
      // Manuell betaling registrert av ansatt på tilbudet — knytt den til bookingen i stedet for å duplisere
      const [quotePayment] = await tx.select().from(payments).where(and(eq(payments.quoteId, quoteId), eq(payments.provider, "manual"))).limit(1);
      if (quotePayment) {
        await tx
          .update(payments)
          .set({ bookingId, amountMinor: breakdown.totalAmountMinor, status: "captured", idempotencyKey: payIdem, capturedAt: quotePayment.capturedAt ?? new Date() })
          .where(eq(payments.id, quotePayment.id));
        [payment] = await tx.select().from(payments).where(eq(payments.id, quotePayment.id)).limit(1);
      }
    }
    if (!payment) {
      const res = await tx.insert(payments).values({
        bookingId,
        provider,
        providerRef: session.pspIntentId ?? null,
        amount: fromMinor(breakdown.totalAmountMinor, breakdown.currency),
        amountMinor: breakdown.totalAmountMinor,
        currency: breakdown.currency,
        status: opts.paymentStatus,
        idempotencyKey: payIdem,
        authorizedAt: new Date(),
        capturedAt: opts.paymentStatus === "captured" ? new Date() : null,
        note: opts.chargeId ? `charge ${opts.chargeId}` : null,
      });
      [payment] = await tx.select().from(payments).where(eq(payments.id, Number(res[0].insertId))).limit(1);
    } else if (payment.status !== "captured" && opts.paymentStatus === "captured") {
      await tx.update(payments).set({ status: "captured", capturedAt: new Date(), note: opts.chargeId ? `charge ${opts.chargeId}` : payment.note }).where(eq(payments.id, payment.id));
      payment = { ...payment, status: "captured" };
    }

    if (opts.paymentStatus === "captured" && payment) {
      // Hovedbok + kvittering kun når pengene faktisk er fanget (én gang per booking)
      const [existingLedger] = await tx
        .select({ n: sql<number>`COUNT(*)` })
        .from(ledgerEntries)
        .where(eq(ledgerEntries.paymentId, payment.id));
      if (Number(existingLedger?.n ?? 0) === 0) {
        await postLedger(
          tx,
          captureEntries({
            bookingId,
            paymentId: payment.id,
            currency: breakdown.currency,
            supplierMinor: breakdown.supplierAmountMinor,
            servicesMinor: breakdown.servicesAmountMinor,
            serviceFeeMinor: breakdown.serviceFeeAmountMinor,
            bonusUsedMinor: breakdown.bonusUsedMinor,
            totalMinor: breakdown.totalAmountMinor,
            externalRef: session.pspIntentId ?? order.id,
          }),
        );
      }
      const segmentsForVat = payload.slices.flatMap((s) =>
        s.segments.map((seg) => ({
          originCountryCode: airportByIata(seg.origin.iata)?.countryCode ?? null,
          destinationCountryCode: airportByIata(seg.destination.iata)?.countryCode ?? null,
        })),
      );
      invoiceNumber = (await issueReceipt(tx, { bookingId, breakdown, segments: segmentsForVat })).invoiceNumber;

      // Bonusopptjening 1 % (hele kroner) for innloggede NOK-kunder — én gang
      if (session.customerAccountId && breakdown.currency === "NOK" && freshAttempt.state !== "CONFIRMED") {
        const earnKr = Math.floor(breakdown.totalAmountMinor / 100 / 100);
        if (earnKr > 0) {
          await tx.update(customerAccounts).set({ bonusKr: sql`${customerAccounts.bonusKr} + ${earnKr}` }).where(eq(customerAccounts.id, session.customerAccountId));
        }
      }
    }

    // Forsøk + sesjon
    if (opts.paymentStatus === "captured") {
      if (freshAttempt.state === "CAPTURED" || freshAttempt.state === "SUPPLIER_CONFIRMED") {
        await recordAttemptTransition(tx, freshAttempt, "CONFIRMED", { bookingId }, { bookingId });
      } else if (freshAttempt.bookingId !== bookingId) {
        await tx.update(bookingAttempts).set({ bookingId }).where(eq(bookingAttempts.id, attempt.id));
      }
      await tx.update(checkoutSessions).set({ status: "confirmed", bookingId }).where(eq(checkoutSessions.id, session.id));
      if (quoteId) await tx.update(quotes).set({ status: "booked", bookedOrderId: order.id }).where(eq(quotes.id, quoteId));
    } else {
      await tx.update(bookingAttempts).set({ bookingId }).where(eq(bookingAttempts.id, attempt.id));
      await tx.update(checkoutSessions).set({ bookingId }).where(eq(checkoutSessions.id, session.id));
    }
    return { bookingId, invoiceNumber };
  });
}

async function stepFinalize(attempt: AttemptRow, session: SessionRow): Promise<void> {
  const order = await loadSupplierOrder(attempt);
  const bookingState = order.bookingReference ? "CONFIRMED" : "BOOKING_PROCESSING";
  const { bookingId, invoiceNumber } = await finalizeBooking(attempt, session, order, {
    bookingState,
    paymentStatus: "captured",
    chargeId: attempt.pspChargeId ?? null,
  });
  orderCache.delete(attempt.id);
  if (bookingState === "CONFIRMED") inc("bookings_confirmed_total");

  const breakdown = parseBreakdown(session);
  const locale = customerLocale(session);
  const c = breakdown.currency;
  const firstName = (JSON.parse(session.passengersJson) as PassengerDetails[])[0]?.givenName;
  await enqueueJob("send_email", { kind: "booking_confirmation", bookingId, locale }, { dedupeKey: `booking-confirmation:${bookingId}`, priority: 2 }).catch(() => {});
  const lines = [
    { label: "Flyreise", amount: fromMinor(breakdown.supplierAmountMinor, c), currency: c },
    ...(breakdown.servicesAmountMinor > 0 ? [{ label: "Ekstra bagasje", amount: fromMinor(breakdown.servicesAmountMinor, c), currency: c }] : []),
    { label: "Servicegebyr", amount: fromMinor(breakdown.serviceFeeAmountMinor, c), currency: c },
    ...(breakdown.bonusUsedMinor > 0 ? [{ label: "Bonus brukt", amount: `-${fromMinor(breakdown.bonusUsedMinor, c)}`, currency: c }] : []),
  ];
  await enqueueEmail(
    "payment_receipt",
    session.contactEmail,
    locale,
    {
      firstName,
      bookingReference: order.bookingReference || order.id,
      amount: fromMinor(breakdown.totalAmountMinor, c),
      currency: c,
      paidAt: new Date().toISOString(),
      paymentMethod: session.paymentMethod ?? "card",
      lines,
      invoiceNumber: invoiceNumber ?? undefined,
    },
    { bookingId, dedupeKey: `payment-receipt:${bookingId}` },
  );
  await opsAlert(
    `Ny booking: ${order.bookingReference || order.id}`,
    `Ny bestilling er registrert.\n\nReferanse: ${order.bookingReference || "(PNR mangler — avstemming pågår)"}\nKunde: ${session.contactEmail}\nBeløp: ${fromMinor(breakdown.totalAmountMinor, breakdown.currency)} ${breakdown.currency}\nModus: ${order.liveMode ? "LIVE" : "test/demo"}\nBooking-ID: ${bookingId}`,
    `new-booking-alert:${bookingId}`,
  );
  if (!order.bookingReference) {
    await enqueueJob("reconcile_order", { bookingId }, { dedupeKey: `reconcile:${bookingId}`, runAt: new Date(Date.now() + 60_000) }).catch(() => {});
  }
}

// ─── Inngang ───────────────────────────────────────────────────────────────

/**
 * Kjør forsøket så langt som mulig i denne invokasjonen. Trygg å kalle flere
 * ganger (jobb-retry, webhook + polling samtidig): hvert steg sjekker
 * tilstanden under lås før det gjør noe.
 */
export async function processBookingAttempt(attemptId: number, opts: { recovery?: boolean } = {}): Promise<void> {
  const db = getDb();
  return withContext({ requestId: `attempt-${attemptId}`, attemptId }, async () => {
    for (let guard = 0; guard < 6; guard++) {
      const [attempt] = await db.select().from(bookingAttempts).where(eq(bookingAttempts.id, attemptId)).limit(1);
      if (!attempt) return;
      const [session] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, attempt.checkoutSessionId)).limit(1);
      if (!session) return;
      if (!shouldProcessAttempt(attempt.state, attempt.updatedAt)) return;

      switch (attempt.state) {
        case "PAYMENT_AUTHORIZED":
          await stepOrder(attempt, session);
          break;
        case "SUPPLIER_ORDERING": {
          // Forlatt midt i bestilling (prosesskrasj) → behandle som ukjent utfall og
          // sørg for at gjenopprettingen faktisk kjøres (B3).
          const moved = await db.transaction(async (tx) => {
            const [fresh] = await tx.select().from(bookingAttempts).where(eq(bookingAttempts.id, attemptId)).for("update");
            if (!fresh || fresh.state !== "SUPPLIER_ORDERING") return false;
            await recordAttemptTransition(tx, fresh, "SUPPLIER_UNKNOWN", { reason: "stale SUPPLIER_ORDERING" });
            return true;
          });
          if (moved) {
            await enqueueJob("recover_attempt", { attemptId }, { dedupeKey: `recover:${attemptId}:stale`, runAt: new Date(Date.now() + 60_000), priority: 1 }).catch((err) => {
              log.error({ err, attemptId }, "Kunne ikke legge gjenoppretting i kø");
            });
          }
          break;
        }
        case "SUPPLIER_UNKNOWN":
          if (!opts.recovery && attempt.attempts === 0 && Date.now() - attempt.updatedAt.getTime() < 60_000) return; // vent på recover_attempt-jobben
          await stepRecover(attempt, session);
          break;
        case "SUPPLIER_CONFIRMED":
          await stepCapture(attempt, session);
          break;
        case "CAPTURED":
          await stepFinalize(attempt, session);
          return;
        default:
          return;
      }
      // Etter et steg: sjekk om vi står i en tilstand som må vente på noe eksternt
      const [after] = await db.select({ state: bookingAttempts.state, lastErrorCode: bookingAttempts.lastErrorCode }).from(bookingAttempts).where(eq(bookingAttempts.id, attemptId)).limit(1);
      if (!after) return;
      if (after.state === "SUPPLIER_UNKNOWN" || after.state === "FAILED_VOIDED" || after.state === "CONFIRMED") return;
      if (after.state === "SUPPLIER_CONFIRMED" && after.lastErrorCode === "CAPTURE_FAILED") return;
      if (after.state === attempt.state) return; // ingen fremdrift → ikke spinn
    }
  });
}

/** Gjenopprettingsjobb (recover_attempt). */
export async function recoverBookingAttempt(attemptId: number): Promise<void> {
  return processBookingAttempt(attemptId, { recovery: true });
}

/**
 * Manuell fangst (B4): en ansatt har fanget beløpet i Stripe-dashboardet etter
 * at automatisk fangst feilet (booking i REVIEW). Markerer forsøket CAPTURED
 * og kjører den vanlige finaliseringen (betaling captured, hovedbok, kvittering,
 * bonus, booking REVIEW → CONFIRMED, e-poster). Idempotent: et allerede
 * CONFIRMED forsøk er en no-op.
 */
export async function finalizeCapturedAttempt(attemptId: number, opts: { pspChargeId?: string | null; actor?: string } = {}): Promise<{ bookingId: number | null; state: string }> {
  const db = getDb();
  return withContext({ requestId: `manual-capture-${attemptId}`, attemptId }, async () => {
    const [attempt] = await db.select().from(bookingAttempts).where(eq(bookingAttempts.id, attemptId)).limit(1);
    if (!attempt) throw new AppError("NOT_FOUND", { message: "Fant ikke booking-forsøket." });
    if (attempt.state === "CONFIRMED") return { bookingId: attempt.bookingId ?? null, state: attempt.state };
    if (attempt.state !== "SUPPLIER_CONFIRMED" && attempt.state !== "CAPTURED") {
      throw new AppError("CONFLICT", { message: `Forsøket er i tilstand ${attempt.state} og kan ikke merkes som fanget.` });
    }
    const [session] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, attempt.checkoutSessionId)).limit(1);
    if (!session) throw new AppError("INTERNAL", { message: "Sesjon mangler." });

    await db.transaction(async (tx) => {
      const [fresh] = await tx.select().from(bookingAttempts).where(eq(bookingAttempts.id, attemptId)).for("update");
      if (!fresh || fresh.state !== "SUPPLIER_CONFIRMED") return;
      await recordAttemptTransition(
        tx,
        fresh,
        "CAPTURED",
        { provider: providerOf(session), chargeId: opts.pspChargeId ?? null, manual: true, actor: opts.actor ?? null },
        { pspChargeId: opts.pspChargeId ?? fresh.pspChargeId ?? null, pspIntentId: session.pspIntentId ?? null, lastError: null, lastErrorCode: null },
      );
    });
    const [captured] = await db.select().from(bookingAttempts).where(eq(bookingAttempts.id, attemptId)).limit(1);
    if (!captured || captured.state !== "CAPTURED") {
      throw new AppError("CONFLICT", { message: `Forsøket endret tilstand underveis (${captured?.state ?? "borte"}).` });
    }
    await stepFinalize(captured, session);
    const [done] = await db.select({ bookingId: bookingAttempts.bookingId, state: bookingAttempts.state }).from(bookingAttempts).where(eq(bookingAttempts.id, attemptId)).limit(1);
    return { bookingId: done?.bookingId ?? null, state: done?.state ?? "UNKNOWN" };
  });
}
