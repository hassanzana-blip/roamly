import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { bookingEvents, bookings, payments, refundCases, refundEvents, supportCases } from "../../db/schema";
import { AppError } from "./errors";
import { log } from "./logger";
import { inc } from "./metrics";
import { fromMinor, toMinor } from "./money";
import { enqueueJob } from "./jobs";
import { humanReference } from "./tokens";
import { getSetting } from "./pricing";
import { assertRefundTransition, assertTransition, canTransition, type BookingState, type RefundState } from "./statemachine";
import { postLedger, refundCreatedEntries, refundPaidEntries, type DbOrTx } from "./ledger";
import { issueCreditNote, vatRateFor } from "./invoices";
import { createRefund, stripeConfigured } from "./stripe";
import { airportMetaByIata } from "./airportMeta";
import type { Order } from "../../contracts/types";

// ─── Refusjonssaker (OTA-051–060) ──────────────────────────────────────────
// Egen tilstandsmaskin (REFUND_TRANSITIONS). Beløp i minste enhet.
// Refusjon til kunde = leverandørrefusjon + tilvalgsrefusjon + gebyrrefusjon
// (policy) — aldri mer enn det som er fanget på bookingen.

export type RefundCaseRow = typeof refundCases.$inferSelect;
export type RefundKind = "customer_cancellation" | "airline_cancellation" | "staff_goodwill" | "schedule_change";
export type RefundActor = { type: "customer" | "staff" | "system" | "worker" | "webhook"; id?: string | number | null };
export type ServiceFeePolicy = "keep" | "refund";

export const OPEN_REFUND_STATES: RefundState[] = [
  "requested",
  "eligibility_checked",
  "supplier_requested",
  "supplier_pending",
  "supplier_confirmed",
  "amount_confirmed",
  "psp_refund_created",
  "psp_refund_pending",
  "psp_refund_failed",
];

// ─── Rene funksjoner ───────────────────────────────────────────────────────

/**
 * Beregn beløp til kunde. Gebyrrefusjon følger policy ("keep" → 0, "refund" → hele gebyret).
 * Et eksplisitt overstyrt beløp (staff) brukes som det er, men aldri over `capturedMinor - alreadyRefundedMinor`.
 */
export function computeCustomerRefundMinor(input: {
  supplierRefundMinor: number;
  servicesRefundMinor: number;
  serviceFeeMinor: number;
  feePolicy: ServiceFeePolicy;
  capturedMinor: number;
  alreadyRefundedMinor: number;
  overrideMinor?: number | null;
}): { customerRefundMinor: number; serviceFeeRefundMinor: number; cappedBy: "none" | "captured" } {
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === "number" && (!Number.isInteger(v) || v < 0)) throw new Error(`Ugyldig beløp for ${k}: ${v}`);
  }
  const remaining = Math.max(0, input.capturedMinor - input.alreadyRefundedMinor);
  const serviceFeeRefundMinor = input.feePolicy === "refund" ? input.serviceFeeMinor : 0;
  const computed = input.supplierRefundMinor + input.servicesRefundMinor + serviceFeeRefundMinor;
  const wanted = input.overrideMinor != null ? input.overrideMinor : computed;
  const customerRefundMinor = Math.min(wanted, remaining);
  return {
    customerRefundMinor,
    serviceFeeRefundMinor: Math.min(serviceFeeRefundMinor, customerRefundMinor),
    cappedBy: customerRefundMinor < wanted ? "captured" : "none",
  };
}

/** Bookingens sluttilstand etter en vellykket refusjon. */
export function bookingStateAfterRefund(capturedMinor: number, totalRefundedMinor: number): "REFUNDED" | "PARTIALLY_REFUNDED" {
  return totalRefundedMinor >= capturedMinor ? "REFUNDED" : "PARTIALLY_REFUNDED";
}

// ─── Oppslag ───────────────────────────────────────────────────────────────

export async function capturedPayment(db: DbOrTx, bookingId: number) {
  const rows = await db.select().from(payments).where(and(eq(payments.bookingId, bookingId), eq(payments.status, "captured"))).orderBy(desc(payments.createdAt));
  return rows[0] ?? null;
}

export async function refundedSoFarMinor(db: DbOrTx, bookingId: number, excludeCaseId?: number): Promise<number> {
  const rows = await db
    .select({
      customer: refundCases.customerRefundAmountMinor,
      requested: refundCases.requestedAmountMinor,
      state: refundCases.state,
      id: refundCases.id,
    })
    .from(refundCases)
    .where(and(eq(refundCases.bookingId, bookingId), notInArray(refundCases.state, ["rejected"])));
  let sum = 0;
  for (const r of rows) {
    if (excludeCaseId && r.id === excludeCaseId) continue;
    sum += r.customer ?? r.requested ?? 0;
  }
  return sum;
}

export async function serviceFeePolicy(): Promise<ServiceFeePolicy> {
  const v = await getSetting<string>("refund.service_fee_policy", "keep");
  return v === "refund" ? "refund" : "keep";
}

export function feePolicyText(policy: ServiceFeePolicy): string {
  return policy === "refund"
    ? "Servicegebyret refunderes i sin helhet."
    : "Servicegebyret dekker arbeidet med bestillingen og refunderes ikke.";
}

// ─── Opprett og flytt saker ────────────────────────────────────────────────

export async function createRefundCase(input: {
  bookingId: number;
  kind: RefundKind;
  initiatedBy: "customer" | "staff" | "system";
  requestedById?: string | number | null;
  reason: string;
  requestedAmountMinor?: number | null;
  passengerIds?: string[] | null;
  supplierCancellationId?: string | null;
  supplierRefundAmountMinor?: number | null;
  supplierRefundCurrency?: string | null;
  evidence?: Record<string, unknown> | null;
}): Promise<RefundCaseRow> {
  const db = getDb();
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, input.bookingId)).limit(1);
  if (!booking) throw new AppError("NOT_FOUND");
  const payment = await capturedPayment(db, input.bookingId);
  const capturedMinor = payment?.amountMinor ?? 0;
  const already = await refundedSoFarMinor(db, input.bookingId);
  if (input.requestedAmountMinor != null) {
    if (!Number.isInteger(input.requestedAmountMinor) || input.requestedAmountMinor <= 0) throw new AppError("VALIDATION", { message: "Beløpet må være et positivt heltall i minste enhet." });
    if (already + input.requestedAmountMinor > capturedMinor) {
      throw new AppError("REFUND_EXCEEDS_CAPTURED", { data: { capturedMinor, alreadyRefundedMinor: already, requestedMinor: input.requestedAmountMinor } });
    }
  } else if (capturedMinor > 0 && already >= capturedMinor) {
    throw new AppError("REFUND_EXCEEDS_CAPTURED", { data: { capturedMinor, alreadyRefundedMinor: already } });
  }
  const reference = humanReference("RF", 6);
  const result = await db.insert(refundCases).values({
    reference,
    bookingId: input.bookingId,
    paymentId: payment?.id ?? null,
    state: "requested",
    kind: input.kind,
    initiatedBy: input.initiatedBy,
    requestedById: input.requestedById != null ? String(input.requestedById).slice(0, 64) : null,
    currency: payment?.currency ?? booking.totalCurrency ?? "NOK",
    requestedAmountMinor: input.requestedAmountMinor ?? null,
    supplierCancellationId: input.supplierCancellationId ?? null,
    supplierRefundAmountMinor: input.supplierRefundAmountMinor ?? null,
    supplierRefundCurrency: input.supplierRefundCurrency ?? null,
    reason: input.reason,
    passengerIds: input.passengerIds?.length ? input.passengerIds.join(",").slice(0, 255) : null,
    evidenceJson: input.evidence ? JSON.stringify(input.evidence) : null,
  });
  const id = Number(result[0].insertId);
  inc("refund_cases_total", { state: "requested" });
  await db.insert(refundEvents).values({ refundCaseId: id, fromState: null, toState: "requested", actorType: input.initiatedBy, actorId: input.requestedById != null ? String(input.requestedById) : null, note: input.reason.slice(0, 2000) });
  const [row] = await db.select().from(refundCases).where(eq(refundCases.id, id)).limit(1);
  return row;
}

export async function transitionRefund(
  caseId: number,
  to: RefundState,
  actor: RefundActor,
  note?: string | null,
  patch: Partial<RefundCaseRow> = {},
  db: DbOrTx = getDb(),
): Promise<RefundCaseRow> {
  const [row] = await db.select().from(refundCases).where(eq(refundCases.id, caseId)).limit(1);
  if (!row) throw new AppError("NOT_FOUND");
  try {
    assertRefundTransition(row.state, to);
  } catch {
    throw new AppError("REFUND_INVALID_STATE", { data: { from: row.state, to } });
  }
  await db
    .update(refundCases)
    .set({ ...patch, state: to, ...(to === "closed" || to === "rejected" ? { closedAt: new Date() } : {}) })
    .where(eq(refundCases.id, caseId));
  await db.insert(refundEvents).values({
    refundCaseId: caseId,
    fromState: row.state,
    toState: to,
    actorType: actor.type,
    actorId: actor.id != null ? String(actor.id).slice(0, 64) : null,
    note: note?.slice(0, 4000) ?? null,
  });
  log.info({ refundCaseId: caseId, from: row.state, to }, "refusjonssak: overgang");
  inc("refund_cases_total", { state: to });
  const [updated] = await db.select().from(refundCases).where(eq(refundCases.id, caseId)).limit(1);
  return updated;
}

async function setBookingState(db: DbOrTx, bookingId: number, to: BookingState, actor: RefundActor, reason: string): Promise<void> {
  const [b] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!b || b.state === to) return;
  if (!canTransition(b.state as BookingState, to)) {
    log.warn({ bookingId, from: b.state, to }, "Refusjon: hopper over ugyldig bookingovergang");
    return;
  }
  assertTransition(b.state, to);
  await db.update(bookings).set({ state: to, ...(to === "CANCELLED" ? { cancelledAt: b.cancelledAt ?? new Date() } : {}) }).where(eq(bookings.id, bookingId));
  await db.insert(bookingEvents).values({ bookingId, fromState: b.state, toState: to, actorType: actor.type, actorId: actor.id != null ? String(actor.id) : null, reason });
}

// ─── Behandling (worker-jobb process_refund) ───────────────────────────────

/**
 * Fra supplier_confirmed/amount_confirmed/psp_refund_failed: beregn beløp,
 * opprett refusjon hos PSP (idempotent), bokfør. Trygg å kjøre flere ganger.
 */
export async function processRefundCase(caseId: number): Promise<void> {
  const db = getDb();
  let rc = (await db.select().from(refundCases).where(eq(refundCases.id, caseId)).limit(1))[0];
  if (!rc) return;
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, rc.bookingId)).limit(1);
  if (!booking) return;
  const payment = rc.paymentId ? (await db.select().from(payments).where(eq(payments.id, rc.paymentId)).limit(1))[0] : await capturedPayment(db, rc.bookingId);
  const capturedMinor = payment?.amountMinor ?? 0;
  const order = safeOrder(booking.payload);

  if (rc.state === "requested") rc = await transitionRefund(caseId, "eligibility_checked", { type: "worker" }, "Automatisk vilkårssjekk");
  if (rc.state === "eligibility_checked" && rc.kind === "staff_goodwill") {
    // Kulanse trenger ingen leverandørrunde
    rc = await transitionRefund(caseId, "amount_confirmed", { type: "worker" }, "Kulanse — beløp satt av ansatt", {
      customerRefundAmountMinor: rc.customerRefundAmountMinor ?? rc.requestedAmountMinor ?? 0,
    });
  }

  if (rc.state === "supplier_confirmed") {
    const policy = await serviceFeePolicy();
    const serviceFeeMinor = order?.serviceFeeAmount ? toMinor(order.serviceFeeAmount, rc.currency) : 0;
    const already = await refundedSoFarMinor(db, rc.bookingId, rc.id);
    const amount = computeCustomerRefundMinor({
      supplierRefundMinor: rc.supplierRefundAmountMinor ?? 0,
      servicesRefundMinor: rc.servicesRefundMinor,
      serviceFeeMinor,
      feePolicy: policy,
      capturedMinor,
      alreadyRefundedMinor: already,
      overrideMinor: rc.requestedAmountMinor,
    });
    rc = await transitionRefund(caseId, "amount_confirmed", { type: "worker" }, `Beløp beregnet (${policy})`, {
      customerRefundAmountMinor: amount.customerRefundMinor,
      serviceFeeRefundMinor: amount.serviceFeeRefundMinor,
    });
  }

  if (rc.state !== "amount_confirmed" && rc.state !== "psp_refund_failed") {
    log.info({ refundCaseId: caseId, state: rc.state }, "process_refund: ingenting å gjøre i denne tilstanden");
    return;
  }
  const amountMinor = rc.customerRefundAmountMinor ?? 0;
  if (amountMinor <= 0) {
    await transitionRefund(caseId, "psp_refund_created", { type: "worker" }, "Ingen refusjon til kunde (0)");
    await transitionRefund(caseId, "psp_refund_succeeded", { type: "worker" }, "0-beløp");
    await finishSucceeded(caseId);
    return;
  }
  if (amountMinor + (await refundedSoFarMinor(db, rc.bookingId, rc.id)) > capturedMinor) {
    throw new AppError("REFUND_EXCEEDS_CAPTURED");
  }

  await setBookingState(db, rc.bookingId, "REFUND_PENDING", { type: "worker" }, `Refusjon ${rc.reference} behandles`);

  const provider = payment?.provider ?? "demo";
  if (provider === "stripe" && stripeConfigured()) {
    if (!payment?.providerRef) throw new AppError("INTERNAL", { message: "Betaling mangler PaymentIntent." });
    // Ny idempotensnøkkel per forsøk etter feil (ellers returnerer Stripe samme feilede refusjon)
    const [failedCount] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(refundEvents)
      .where(and(eq(refundEvents.refundCaseId, rc.id), eq(refundEvents.toState, "psp_refund_failed")));
    const idem = Number(failedCount?.n ?? 0) > 0 ? `rc:${rc.id}:${Number(failedCount?.n)}` : `rc:${rc.id}`;
    let refundId: string;
    let status: string | null;
    try {
      const r = await createRefund({ paymentIntentId: payment.providerRef, amountMinor, idempotencyKey: idem, metadata: { refund_case_id: String(rc.id), booking_id: String(rc.bookingId) } });
      refundId = r.id;
      status = r.status;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (rc.state === "amount_confirmed") rc = await transitionRefund(caseId, "psp_refund_created", { type: "worker" }, "Forsøkte å opprette refusjon");
      await transitionRefund(caseId, "psp_refund_failed", { type: "worker" }, message, { lastError: message.slice(0, 4000) });
      await enqueueJob("send_email", {
        kind: "ops_alert",
        subject: `Refusjon feilet hos Stripe: ${rc.reference}`,
        body: `Refusjonssak ${rc.reference} (booking ${booking.bookingReference}) feilet hos Stripe.\nBeløp: ${fromMinor(amountMinor, rc.currency)} ${rc.currency}\nFeil: ${message}\n\nRett årsaken og bruk «Prøv igjen» i admin.`,
      });
      return;
    }
    await db.transaction(async (tx) => {
      const [fresh] = await tx.select().from(refundCases).where(eq(refundCases.id, caseId)).for("update");
      if (!fresh || (fresh.state !== "amount_confirmed" && fresh.state !== "psp_refund_failed")) return;
      await transitionRefund(caseId, "psp_refund_created", { type: "worker" }, `Stripe-refusjon ${refundId}`, { pspRefundId: refundId, pspRefundStatus: status ?? null, lastError: null }, tx);
      if (fresh.pspRefundId !== refundId) await bookRefundCreated(tx, fresh, amountMinor, refundId);
    });
    if (status === "succeeded") {
      await transitionRefund(caseId, "psp_refund_succeeded", { type: "worker" }, "Stripe bekreftet umiddelbart");
      await finishSucceeded(caseId);
    } else if (status === "failed" || status === "canceled") {
      await markPspFailed(caseId, { type: "worker" }, `Stripe-status ${status}`);
    } else {
      await transitionRefund(caseId, "psp_refund_pending", { type: "worker" }, `Stripe-status ${status ?? "pending"}`);
    }
    return;
  }

  // Demo / manuell: marker som utført umiddelbart
  const fakeId = `re_${provider}_${rc.id}`;
  await db.transaction(async (tx) => {
    const [fresh] = await tx.select().from(refundCases).where(eq(refundCases.id, caseId)).for("update");
    if (!fresh || (fresh.state !== "amount_confirmed" && fresh.state !== "psp_refund_failed")) return;
    await transitionRefund(caseId, "psp_refund_created", { type: "worker" }, `${provider}-refusjon (ingen PSP)`, { pspRefundId: fakeId, pspRefundStatus: "succeeded" }, tx);
    if (fresh.pspRefundId !== fakeId) await bookRefundCreated(tx, fresh, amountMinor, fakeId);
  });
  await transitionRefund(caseId, "psp_refund_succeeded", { type: "worker" }, `${provider}: registrert som utbetalt`);
  await finishSucceeded(caseId);
}

async function bookRefundCreated(tx: DbOrTx, rc: RefundCaseRow, amountMinor: number, externalRef: string): Promise<void> {
  await postLedger(
    tx,
    refundCreatedEntries({
      bookingId: rc.bookingId,
      paymentId: rc.paymentId,
      refundCaseId: rc.id,
      currency: rc.currency,
      supplierRefundMinor: rc.supplierRefundAmountMinor ?? 0,
      servicesRefundMinor: rc.servicesRefundMinor,
      serviceFeeRefundMinor: rc.serviceFeeRefundMinor,
      customerRefundMinor: amountMinor,
      externalRef,
    }),
  );
  if (rc.paymentId) {
    await tx.update(payments).set({ refundedMinor: sql`${payments.refundedMinor} + ${amountMinor}` }).where(eq(payments.id, rc.paymentId));
  }
}

/** Tilbakefør bokført forpliktelse når PSP-refusjonen feiler, slik at et nytt forsøk kan bokføres på nytt. */
async function unbookRefund(tx: DbOrTx, rc: RefundCaseRow): Promise<void> {
  const amountMinor = rc.customerRefundAmountMinor ?? 0;
  if (!rc.pspRefundId || amountMinor <= 0) return;
  const reversed = refundCreatedEntries({
    bookingId: rc.bookingId,
    paymentId: rc.paymentId,
    refundCaseId: rc.id,
    currency: rc.currency,
    supplierRefundMinor: rc.supplierRefundAmountMinor ?? 0,
    servicesRefundMinor: rc.servicesRefundMinor,
    serviceFeeRefundMinor: rc.serviceFeeRefundMinor,
    customerRefundMinor: amountMinor,
    externalRef: rc.pspRefundId,
  }).map((e) => ({ ...e, direction: e.direction === "debit" ? ("credit" as const) : ("debit" as const), description: `Tilbakeført: ${e.description ?? ""}` }));
  await postLedger(tx, reversed);
  if (rc.paymentId) {
    await tx.update(payments).set({ refundedMinor: sql`GREATEST(${payments.refundedMinor} - ${amountMinor}, 0)` }).where(eq(payments.id, rc.paymentId));
  }
}

async function markPspFailed(caseId: number, actor: RefundActor, note: string): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [fresh] = await tx.select().from(refundCases).where(eq(refundCases.id, caseId)).for("update");
    if (!fresh || (fresh.state !== "psp_refund_created" && fresh.state !== "psp_refund_pending")) return;
    await unbookRefund(tx, fresh);
    await transitionRefund(caseId, "psp_refund_failed", actor, note, { lastError: note.slice(0, 4000), pspRefundId: null, pspRefundStatus: "failed" }, tx);
  });
}

/** psp_refund_succeeded → customer_notified → closed, med hovedbok, kreditnota, bookingstatus og e-post. */
async function finishSucceeded(caseId: number): Promise<void> {
  const db = getDb();
  const [rc] = await db.select().from(refundCases).where(eq(refundCases.id, caseId)).limit(1);
  if (!rc || rc.state !== "psp_refund_succeeded") return;
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, rc.bookingId)).limit(1);
  if (!booking) return;
  const amountMinor = rc.customerRefundAmountMinor ?? 0;
  const order = safeOrder(booking.payload);

  await db.transaction(async (tx) => {
    if (amountMinor > 0) {
      await postLedger(tx, refundPaidEntries({ bookingId: rc.bookingId, paymentId: rc.paymentId, refundCaseId: rc.id, currency: rc.currency, customerRefundMinor: amountMinor, externalRef: rc.pspRefundId }));
      const segs = (order?.slices ?? []).flatMap((s) =>
        s.segments.map((seg) => ({
          originCountryCode: airportMetaByIata(seg.origin.iata)?.countryCode ?? null,
          destinationCountryCode: airportMetaByIata(seg.destination.iata)?.countryCode ?? null,
        })),
      );
      await issueCreditNote(tx, {
        bookingId: rc.bookingId,
        refundCaseId: rc.id,
        currency: rc.currency,
        customerRefundMinor: amountMinor,
        serviceFeeRefundMinor: rc.serviceFeeRefundMinor,
        flightVatRate: vatRateFor(segs),
      });
    }
    const payment = rc.paymentId ? (await tx.select().from(payments).where(eq(payments.id, rc.paymentId)).limit(1))[0] : null;
    const capturedMinor = payment?.amountMinor ?? 0;
    const totalRefunded = payment?.refundedMinor ?? amountMinor;
    if (payment) {
      await tx.update(payments).set({ status: totalRefunded >= capturedMinor ? "refunded" : "partially_refunded" }).where(eq(payments.id, payment.id));
    }
    await setBookingState(tx, rc.bookingId, bookingStateAfterRefund(capturedMinor, totalRefunded), { type: "worker" }, `Refusjon ${rc.reference}: ${fromMinor(amountMinor, rc.currency)} ${rc.currency} utbetalt`);
  });

  await enqueueJob(
    "send_email",
    {
      kind: "refund_paid",
      to: booking.contactEmail,
      locale: "nb",
      bookingId: booking.id,
      payload: { firstName: order?.passengers?.[0]?.givenName, bookingReference: booking.bookingReference, refundReference: rc.reference, amount: fromMinor(amountMinor, rc.currency), currency: rc.currency },
    },
    { dedupeKey: `refund-paid:${rc.id}` },
  ).catch(() => {});
  await transitionRefund(caseId, "customer_notified", { type: "worker" }, "E-post om utbetalt refusjon lagt i kø");
  await transitionRefund(caseId, "closed", { type: "worker" }, "Sak avsluttet");
}

/** Stripe-webhook: refund.updated / charge.refund.updated / refund.failed. */
export async function applyStripeRefundEvent(refund: { id: string; status: string | null; amount: number; metadata?: Record<string, string> | null }): Promise<void> {
  const db = getDb();
  let [rc] = await db.select().from(refundCases).where(eq(refundCases.pspRefundId, refund.id)).limit(1);
  if (!rc && refund.metadata?.refund_case_id) {
    [rc] = await db.select().from(refundCases).where(eq(refundCases.id, Number(refund.metadata.refund_case_id))).limit(1);
  }
  if (!rc) {
    log.warn({ refundId: refund.id }, "Stripe-refusjon uten kjent sak");
    return;
  }
  await db.update(refundCases).set({ pspRefundStatus: refund.status ?? null }).where(eq(refundCases.id, rc.id));
  if (refund.status === "succeeded") {
    if (rc.state === "psp_refund_created" || rc.state === "psp_refund_pending") {
      await transitionRefund(rc.id, "psp_refund_succeeded", { type: "webhook", id: refund.id }, "Stripe: refund succeeded");
      await finishSucceeded(rc.id);
    }
  } else if (refund.status === "failed" || refund.status === "canceled") {
    if (rc.state === "psp_refund_created" || rc.state === "psp_refund_pending") {
      await markPspFailed(rc.id, { type: "webhook", id: refund.id }, `Stripe: refund ${refund.status}`);
      await enqueueJob("send_email", {
        kind: "ops_alert",
        subject: `Stripe-refusjon feilet: ${rc.reference}`,
        body: `Refusjon ${refund.id} for sak ${rc.reference} fikk status ${refund.status}. Sjekk Stripe og bruk «Prøv igjen» i admin.`,
      }).catch(() => {});
    }
  } else if (refund.status === "pending" && rc.state === "psp_refund_created") {
    await transitionRefund(rc.id, "psp_refund_pending", { type: "webhook", id: refund.id }, "Stripe: pending");
  }
}

// ─── Kundekansellering ─────────────────────────────────────────────────────

/** Opprett sak for kundekansellering som allerede er bekreftet hos leverandør. */
export async function openCustomerCancellationCase(input: {
  bookingId: number;
  requestedById: string;
  supplierCancellationId: string;
  supplierRefundAmountMinor: number;
  supplierRefundCurrency: string;
  reason: string;
}): Promise<RefundCaseRow> {
  const rc = await createRefundCase({
    bookingId: input.bookingId,
    kind: "customer_cancellation",
    initiatedBy: "customer",
    requestedById: input.requestedById,
    reason: input.reason,
    supplierCancellationId: input.supplierCancellationId,
    supplierRefundAmountMinor: input.supplierRefundAmountMinor,
    supplierRefundCurrency: input.supplierRefundCurrency,
  });
  await transitionRefund(rc.id, "eligibility_checked", { type: "system" }, "Kunde bekreftet kansellering med kjent leverandørbeløp");
  await transitionRefund(rc.id, "supplier_requested", { type: "system" }, `Kansellering ${input.supplierCancellationId} sendt til leverandør`);
  return transitionRefund(rc.id, "supplier_confirmed", { type: "system" }, `Leverandør bekreftet refusjon ${fromMinor(input.supplierRefundAmountMinor, input.supplierRefundCurrency)} ${input.supplierRefundCurrency}`);
}

// ─── Flyselskapskansellering (oppdaget av avstemming) ──────────────────────

export async function openAirlineCancellationCase(bookingId: number, source: string): Promise<RefundCaseRow | null> {
  const db = getDb();
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!booking) return null;
  const [existing] = await db
    .select()
    .from(refundCases)
    .where(and(eq(refundCases.bookingId, bookingId), eq(refundCases.kind, "airline_cancellation"), inArray(refundCases.state, OPEN_REFUND_STATES)))
    .limit(1);
  if (existing) return existing;

  const rc = await createRefundCase({
    bookingId,
    kind: "airline_cancellation",
    initiatedBy: "system",
    requestedById: source,
    reason: "Flyselskapet har kansellert reisen (oppdaget ved avstemming).",
  });
  const reference = humanReference("RS", 6);
  await db.insert(supportCases).values({
    reference,
    subject: `Flyselskapet kansellerte ${booking.bookingReference} — refusjon ${rc.reference}`,
    customerEmail: booking.contactEmail,
    bookingId,
    priority: "high",
    status: "open",
    tags: "airline_cancellation,refund",
  });
  await enqueueJob(
    "send_email",
    {
      kind: "cancellation_confirmed",
      to: booking.contactEmail,
      locale: "nb",
      bookingId,
      payload: {
        bookingReference: booking.bookingReference,
        refundNote: `Flyselskapet har kansellert reisen. Vi har opprettet refusjonssak ${rc.reference} og support-sak ${reference}, og tar kontakt når beløpet er bekreftet.`,
      },
    },
    { dedupeKey: `airline-cancel:${rc.id}` },
  ).catch(() => {});
  await enqueueJob("send_email", {
    kind: "ops_alert",
    subject: `Flyselskap kansellerte: ${booking.bookingReference}`,
    body: `Leverandøren rapporterer at ordre ${booking.orderId} er kansellert.\nRefusjonssak ${rc.reference} og support-sak ${reference} er opprettet. Bekreft leverandørbeløp og godkjenn refusjonen i admin.`,
  }).catch(() => {});
  return rc;
}

function safeOrder(payload: string): Order | null {
  try {
    return JSON.parse(payload) as Order;
  } catch {
    return null;
  }
}

export async function refundTimeline(caseId: number) {
  return getDb().select().from(refundEvents).where(eq(refundEvents.refundCaseId, caseId)).orderBy(refundEvents.createdAt);
}
