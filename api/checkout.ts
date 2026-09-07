import { z } from "zod";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { bookingAttemptEvents, bookingAttempts, bookings, checkoutSessions, consents, customerAccounts, passengerDocuments } from "../db/schema";
import { env } from "./lib/env";
import { AppError, toTRPCError } from "./lib/errors";
import { log } from "./lib/logger";
import { assertRateLimit, clientIp } from "./lib/ratelimit";
import { toMinor } from "./lib/money";
import { encryptField, last4 } from "./lib/crypto";
import { buildBreakdown, instantBookingEnabled, loadPricingOverrides } from "./lib/pricing";
import { validatePassengers } from "./lib/validation";
import { enqueueJob, isDuplicateKeyError } from "./lib/jobs";
import { issueBookingAccessToken } from "./lib/bookingAccess";
import { duffelConfig, getOfferRaw, selectBagServices, type BagService } from "./lib/duffel";
import { demoGetOffer, demoServicesMinor } from "./lib/demo";
import { cancelPaymentIntent, createPaymentIntent, retrievePaymentIntent, stripeConfigured } from "./lib/stripe";
import { failSession, parseBreakdown, type SessionRow } from "./lib/orchestrator";
import type { Offer, PassengerDetails, PriceBreakdownMinor } from "../contracts/types";

// ─── Checkout (OTA-020–029): eneste vei til booking fra nettsiden ──────────
// 1) createSession: server priser tilbudet, låser breakdown, oppretter PaymentIntent (manuell fangst).
// 2) Kunden betaler i Stripe Elements (kortdata når aldri serveren).
// 3) paymentAuthorized (eller webhook) → booking_attempt → worker (orchestrator).
// 4) status: klienten poller til bekreftet/feilet.

const SESSION_TTL_MS = 20 * 60_000;
const MIN_CHARGE_MINOR = 1_000; // 10 kr — under dette avviser PSP-er ofte belastningen
const OFFER_MIN_REMAINING_MS = 30_000;

export const passengerDetailsSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(["adult", "child", "infant_without_seat"]),
  title: z.enum(["mr", "ms", "mrs"]).optional(),
  gender: z.enum(["m", "f"]).optional(),
  givenName: z.string().trim().min(1).max(60),
  familyName: z.string().trim().min(1).max(60),
  bornOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  email: z.string().email().optional(),
  phoneNumber: z.string().max(24).optional(),
  infantPassengerId: z.string().max(64).optional(),
  identityDocument: z
    .object({
      type: z.literal("passport"),
      uniqueIdentifier: z.string().min(4).max(20),
      issuingCountryCode: z.string().length(2),
      expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .optional(),
});

const servicesSchema = z.object({
  extraBags: z.number().int().min(0).max(9),
  bagsByPassenger: z.record(z.string(), z.number().int().min(0).max(3)).optional(),
});

const createSessionSchema = z.object({
  offerId: z.string().min(1).max(128),
  passengers: z.array(passengerDetailsSchema).min(1).max(9),
  contactEmail: z.string().email().max(255),
  contactPhone: z.string().min(6).max(24),
  services: servicesSchema.optional(),
  bonusUse: z.boolean().optional(),
  paymentMethod: z.enum(["card", "klarna"]).default("card"),
  idempotencyKey: z.string().uuid(),
  searchCtx: z.string().max(512).optional(),
  locale: z.enum(["nb", "en"]).optional(),
  termsAccepted: z.literal(true),
  marketingConsent: z.boolean().optional(),
});

type CustomerCtx = { customerId: number; email?: string | null; emailVerified?: boolean; locale?: string; currency?: string } | null;

export type CheckoutPayment = { provider: "stripe"; clientSecret: string; publishableKey: string } | { provider: "demo" };

export type CreateSessionResult = {
  publicId: string;
  status: string;
  breakdown: PriceBreakdownMinor;
  offerExpiresAt: string | null;
  payment: CheckoutPayment;
  demoMode: boolean;
};

async function resolveOfferRaw(offerId: string): Promise<{ offer: Offer; rawServices: BagService[] }> {
  if (duffelConfig.configured) return getOfferRaw(offerId);
  const offer = demoGetOffer(offerId);
  if (!offer) throw new AppError("OFFER_EXPIRED");
  return { offer, rawServices: [] };
}

function offerExpiresAtOk(offer: Offer): boolean {
  const t = Date.parse(offer.expiresAt);
  return Number.isFinite(t) && t > Date.now() + OFFER_MIN_REMAINING_MS;
}

/** Pris for tilvalg i minste enhet — samme regnestykke som orkestratoren gjør ved revalidering. */
export function servicesMinorFor(offer: Offer, rawServices: BagService[], services: z.infer<typeof servicesSchema> | undefined): number {
  if (!services || services.extraBags <= 0) return 0;
  const eligible = offer.passengers.filter((p) => p.type !== "infant_without_seat").length;
  const maxTotal = (offer.services?.maxExtraBags ?? 0) * eligible;
  if (services.extraBags > maxTotal) {
    throw new AppError("VALIDATION", { message: `Maks ${maxTotal} ekstra kolli for denne reisen.`, data: { field: "services.extraBags" } });
  }
  if (duffelConfig.configured) {
    return selectBagServices(rawServices, offer.passengers, services).reduce((s, x) => s + x.amountMinor, 0);
  }
  return demoServicesMinor(offer, services.extraBags);
}

async function paymentFor(session: SessionRow): Promise<CheckoutPayment> {
  if (session.pspProvider === "stripe" && session.pspIntentId) {
    const pi = await retrievePaymentIntent(session.pspIntentId);
    return { provider: "stripe", clientSecret: pi.client_secret ?? "", publishableKey: env.STRIPE_PUBLISHABLE_KEY ?? "" };
  }
  return { provider: "demo" };
}

function toResult(session: SessionRow, payment: CheckoutPayment): CreateSessionResult {
  return {
    publicId: session.publicId,
    status: session.status,
    breakdown: parseBreakdown(session),
    offerExpiresAt: session.offerExpiresAt?.toISOString() ?? null,
    payment,
    demoMode: !duffelConfig.configured,
  };
}

// Tilgangstoken per booking gjenbrukes i 10 min slik at polling ikke lager ett token per kall.
const tokenCache = new Map<number, { token: string; at: number }>();
/** Kun for tester (DB tømmes mellom tester, men booking-ID-er gjenbrukes). */
export function resetAccessTokenCache(): void {
  tokenCache.clear();
}
export async function cachedAccessToken(bookingId: number): Promise<string> {
  const hit = tokenCache.get(bookingId);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.token;
  const token = await issueBookingAccessToken(bookingId);
  tokenCache.set(bookingId, { token, at: Date.now() });
  if (tokenCache.size > 5000) {
    const cutoff = Date.now() - 10 * 60_000;
    for (const [k, v] of tokenCache) if (v.at < cutoff) tokenCache.delete(k);
  }
  return token;
}

async function loadSession(publicId: string): Promise<SessionRow> {
  const [s] = await getDb().select().from(checkoutSessions).where(eq(checkoutSessions.publicId, publicId)).limit(1);
  if (!s) throw new AppError("NOT_FOUND", { message: "Fant ikke bestillingsøkten." });
  return s;
}

/**
 * Tapt race på idempotensnøkkel: vent (maks ~5 s) til vinneren har fått
 * PaymentIntent (eller er i sluttilstand) slik at svaret er komplett.
 */
async function waitForSession(idempotencyKey: string, maxWaitMs = 5_000): Promise<SessionRow | null> {
  const db = getDb();
  const deadline = Date.now() + maxWaitMs;
  let last: SessionRow | null = null;
  for (;;) {
    const [s] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.idempotencyKey, idempotencyKey)).limit(1);
    last = s ?? null;
    if (s && (s.pspProvider !== "stripe" || s.pspIntentId || s.status !== "created")) return s;
    if (Date.now() >= deadline) return last;
    await new Promise((r) => setTimeout(r, 100));
  }
}

/**
 * Betaling er autorisert (fra klient ELLER Stripe-webhook): marker sesjonen,
 * opprett booking_attempt (idempotent) og legg orkestreringsjobben i kø.
 */
export async function onPaymentAuthorized(sessionId: number, source: "client" | "webhook" | "demo" | "quote"): Promise<{ attemptId: number; created: boolean }> {
  const db = getDb();
  const out = await db.transaction(async (tx) => {
    const [session] = await tx.select().from(checkoutSessions).where(eq(checkoutSessions.id, sessionId)).for("update");
    if (!session) throw new AppError("NOT_FOUND");
    if (["failed", "expired", "cancelled", "price_changed"].includes(session.status)) {
      throw new AppError("CONFLICT", { message: "Bestillingsøkten er avsluttet. Start på nytt." });
    }
    if (session.status === "created" || session.status === "payment_pending") {
      await tx.update(checkoutSessions).set({ status: "authorized" }).where(eq(checkoutSessions.id, sessionId));
    }
    const key = `att:${session.idempotencyKey}`;
    const [existing] = await tx.select().from(bookingAttempts).where(eq(bookingAttempts.idempotencyKey, key)).limit(1);
    if (existing) return { attemptId: existing.id, created: false };
    const res = await tx.insert(bookingAttempts).values({
      checkoutSessionId: sessionId,
      idempotencyKey: key,
      state: "PAYMENT_AUTHORIZED",
      pspIntentId: session.pspIntentId ?? null,
    });
    const attemptId = Number(res[0].insertId);
    await tx.insert(bookingAttemptEvents).values({ attemptId, fromState: null, toState: "PAYMENT_AUTHORIZED", detail: JSON.stringify({ source }) });
    return { attemptId, created: true };
  });
  await enqueueJob("process_booking_attempt", { attemptId: out.attemptId }, { dedupeKey: `attempt:${out.attemptId}`, priority: 1, maxAttempts: 8 });
  log.info({ sessionId, attemptId: out.attemptId, source }, "betaling autorisert → booking-forsøk i kø");
  return out;
}

/** Utløp sesjoner som ikke ble betalt innen fristen (worker/sweep). */
export async function expireStaleSessions(): Promise<number> {
  const db = getDb();
  const cutoff = new Date(Date.now() - SESSION_TTL_MS);
  const stale = await db
    .select()
    .from(checkoutSessions)
    .where(and(inArray(checkoutSessions.status, ["created", "payment_pending"]), lt(checkoutSessions.createdAt, cutoff)))
    .limit(200);
  let n = 0;
  for (const s of stale) {
    if (s.pspProvider === "stripe" && s.pspIntentId && stripeConfigured()) {
      try {
        const pi = await retrievePaymentIntent(s.pspIntentId);
        if (pi.status === "requires_capture") {
          // Betalt i siste liten uten at klienten rakk å melde fra — ikke utløp, men autoriser.
          await onPaymentAuthorized(s.id, "webhook");
          continue;
        }
        if (pi.status !== "canceled" && pi.status !== "succeeded") await cancelPaymentIntent(s.pspIntentId, `expire:${s.idempotencyKey}`, "abandoned");
      } catch (err) {
        log.warn({ err, sessionId: s.id }, "utløp: kunne ikke annullere PaymentIntent");
      }
    }
    if (await failSession(db, s.id, "expired", "SESSION_EXPIRED", "Bestillingsøkten utløp uten betaling.")) n += 1;
  }
  return n;
}

export const checkoutRouter = createRouter({
  createSession: publicQuery.input(createSessionSchema).mutation(async ({ input, ctx }): Promise<CreateSessionResult> => {
    try {
      assertRateLimit("checkout-create", clientIp(ctx.req), 10, 60_000);
      const db = getDb();
      const customer = (ctx.customer as CustomerCtx) ?? null;

      // Idempotens: samme nøkkel → samme sesjon
      const [existing] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.idempotencyKey, input.idempotencyKey)).limit(1);
      if (existing) return toResult(existing, await paymentFor(existing));

      if (!(await instantBookingEnabled())) throw new AppError("BOOKING_CLOSED");

      const { offer, rawServices } = await resolveOfferRaw(input.offerId);
      if (!offerExpiresAtOk(offer)) throw new AppError("OFFER_EXPIRED");

      const validated = validatePassengers(input.passengers as PassengerDetails[], offer, { email: input.contactEmail, phone: input.contactPhone });
      const passengers = validated.passengers;
      const contactEmail = validated.contact.email ?? input.contactEmail.toLowerCase().trim();
      const contactPhone = validated.contact.phone ?? input.contactPhone;

      const currency = offer.totalCurrency.toUpperCase();
      const supplierMinor = toMinor(offer.totalAmount, currency);
      const servicesMinor = servicesMinorFor(offer, rawServices, input.services);
      const overrides = await loadPricingOverrides();
      const provisional = buildBreakdown({ supplierMinor, servicesMinor, bonusUsedMinor: 0, currency, overrides });

      const publicId = randomUUID();
      const locale = input.locale ?? (customer?.locale === "en" ? "en" : "nb");
      const pspProvider: "stripe" | "demo" = stripeConfigured() ? "stripe" : "demo";
      if (pspProvider === "demo" && env.isProdEnv) throw new AppError("PAYMENT_NOT_CONFIGURED");

      const passengersNoDocs = passengers.map((p) => ({ ...p, identityDocument: undefined }));

      // Bonus: kun innloggede kunder i NOK. Reserveres INNE i transaksjonen etter at
      // sesjonsraden er satt inn — den unike idempotensnøkkelen sikrer at kun én av
      // flere parallelle kall kommer hit (B5: aldri dobbelt trekk).
      const wantBonusKr = (() => {
        if (!(input.bonusUse && customer && currency === "NOK")) return 0;
        const maxByTotal = Math.max(0, provisional.totalAmountMinor - MIN_CHARGE_MINOR);
        return Math.floor(maxByTotal / 100);
      })();

      let created: { sessionId: number; breakdown: PriceBreakdownMinor } | null = null;
      try {
        created = await db.transaction(async (tx) => {
          // Reserver først sesjonsraden (unik idempotency_key) med foreløpig breakdown …
          const res = await tx.insert(checkoutSessions).values({
            publicId,
            offerId: offer.id,
            offerSnapshot: JSON.stringify({ offer, rawServices }),
            offerExpiresAt: new Date(offer.expiresAt),
            searchCtx: input.searchCtx ?? null,
            passengersJson: JSON.stringify(passengersNoDocs),
            servicesJson: input.services ? JSON.stringify(input.services) : null,
            contactEmail,
            contactPhone,
            customerAccountId: customer?.customerId ?? null,
            locale,
            currency,
            supplierAmountMinor: provisional.supplierAmountMinor,
            servicesAmountMinor: provisional.servicesAmountMinor,
            serviceFeeAmountMinor: provisional.serviceFeeAmountMinor,
            bonusUsedMinor: 0,
            totalAmountMinor: provisional.totalAmountMinor,
            breakdownJson: JSON.stringify(provisional),
            status: "created",
            pspProvider,
            paymentMethod: input.paymentMethod,
            idempotencyKey: input.idempotencyKey,
            ip: clientIp(ctx.req),
            userAgent: (ctx.req.headers.get("user-agent") ?? "").slice(0, 255) || null,
            expiresAt: new Date(Date.now() + SESSION_TTL_MS),
          });
          const id = Number(res[0].insertId);

          // … deretter bonus (atomisk, aldri negativ saldo) og endelig breakdown.
          let bonusUsedMinor = 0;
          if (wantBonusKr > 0 && customer) {
            const [acc] = await tx.select({ bonusKr: customerAccounts.bonusKr }).from(customerAccounts).where(eq(customerAccounts.id, customer.customerId)).for("update");
            const useKr = Math.min(acc?.bonusKr ?? 0, wantBonusKr);
            if (useKr > 0) {
              const upd = await tx
                .update(customerAccounts)
                .set({ bonusKr: sql`${customerAccounts.bonusKr} - ${useKr}` })
                .where(and(eq(customerAccounts.id, customer.customerId), sql`${customerAccounts.bonusKr} >= ${useKr}`));
              if (Number(upd[0].affectedRows) > 0) bonusUsedMinor = useKr * 100;
            }
          }
          const finalBreakdown = bonusUsedMinor > 0 ? buildBreakdown({ supplierMinor, servicesMinor, bonusUsedMinor, currency, overrides }) : provisional;
          if (bonusUsedMinor > 0) {
            await tx
              .update(checkoutSessions)
              .set({ bonusUsedMinor: finalBreakdown.bonusUsedMinor, totalAmountMinor: finalBreakdown.totalAmountMinor, breakdownJson: JSON.stringify(finalBreakdown) })
              .where(eq(checkoutSessions.id, id));
          }
          const docs = passengers
            .filter((p) => p.identityDocument)
            .map((p) => ({
              checkoutSessionId: id,
              passengerId: p.id,
              type: "passport",
              identifierCiphertext: encryptField(p.identityDocument!.uniqueIdentifier),
              identifierLast4: last4(p.identityDocument!.uniqueIdentifier),
              issuingCountryCode: p.identityDocument!.issuingCountryCode,
              expiresOn: p.identityDocument!.expiresOn,
            }));
          if (docs.length) await tx.insert(passengerDocuments).values(docs);
          const consentRows = [
            { customerAccountId: customer?.customerId ?? null, email: contactEmail, type: "terms", version: "2026-09", granted: true, source: "checkout", ip: clientIp(ctx.req) },
            ...(input.marketingConsent !== undefined
              ? [{ customerAccountId: customer?.customerId ?? null, email: contactEmail, type: "marketing", version: "2026-09", granted: input.marketingConsent, source: "checkout", ip: clientIp(ctx.req) }]
              : []),
          ];
          await tx.insert(consents).values(consentRows);
          return { sessionId: id, breakdown: finalBreakdown };
        });
      } catch (err) {
        if (!isDuplicateKeyError(err)) throw err;
        // Parallelt kall med samme idempotensnøkkel vant racet → returner den sesjonen.
        const winner = await waitForSession(input.idempotencyKey);
        if (!winner) throw new AppError("CONFLICT", { message: "Bestillingsøkten opprettes allerede. Prøv igjen." });
        return toResult(winner, await paymentFor(winner));
      }
      const { sessionId, breakdown } = created;

      let payment: CheckoutPayment = { provider: "demo" };
      if (pspProvider === "stripe") {
        try {
          const pi = await createPaymentIntent({
            amountMinor: breakdown.totalAmountMinor,
            currency,
            idempotencyKey: input.idempotencyKey,
            checkoutPublicId: publicId,
            email: contactEmail,
            method: input.paymentMethod,
            description: `HelloSky flyreise ${offer.slices[0]?.origin.iata ?? ""}→${offer.slices[0]?.destination.iata ?? ""}`,
          });
          await db.update(checkoutSessions).set({ status: "payment_pending", pspIntentId: pi.id }).where(eq(checkoutSessions.id, sessionId));
          payment = { provider: "stripe", clientSecret: pi.clientSecret, publishableKey: env.STRIPE_PUBLISHABLE_KEY ?? "" };
        } catch (err) {
          await failSession(db, sessionId, "failed", "PAYMENT_NOT_CONFIGURED", err instanceof Error ? err.message : String(err));
          throw new AppError("PAYMENT_NOT_CONFIGURED", { cause: err });
        }
      }

      const session = await loadSession(publicId);
      log.info({ sessionId, publicId, totalMinor: breakdown.totalAmountMinor, currency, pspProvider }, "checkout-sesjon opprettet");
      return toResult(session, payment);
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  paymentAuthorized: publicQuery.input(z.object({ publicId: z.string().uuid() })).mutation(async ({ input, ctx }) => {
    try {
      assertRateLimit("checkout-auth", clientIp(ctx.req), 30, 60_000);
      const session = await loadSession(input.publicId);
      if (session.pspProvider !== "stripe" || !session.pspIntentId) throw new AppError("PAYMENT_REQUIRED");
      const pi = await retrievePaymentIntent(session.pspIntentId);
      const ok = (pi.status === "requires_capture" || pi.status === "succeeded") && pi.amount === session.totalAmountMinor && pi.currency.toUpperCase() === session.currency;
      if (!ok) {
        if (pi.status === "canceled") throw new AppError("PAYMENT_FAILED");
        throw new AppError("PAYMENT_REQUIRED", { data: { pspStatus: pi.status } });
      }
      const { attemptId } = await onPaymentAuthorized(session.id, "client");
      return { status: "authorized", attemptId };
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  confirmDemo: publicQuery.input(z.object({ publicId: z.string().uuid() })).mutation(async ({ input, ctx }) => {
    try {
      assertRateLimit("checkout-demo", clientIp(ctx.req), 30, 60_000);
      if (env.isProdEnv) throw new AppError("PAYMENT_NOT_CONFIGURED");
      const session = await loadSession(input.publicId);
      if (session.pspProvider !== "demo") throw new AppError("PAYMENT_REQUIRED", { message: "Denne økten krever ekte betaling." });
      const { attemptId } = await onPaymentAuthorized(session.id, "demo");
      return { status: "authorized", attemptId };
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  status: publicQuery.input(z.object({ publicId: z.string().uuid() })).query(async ({ input, ctx }) => {
    try {
      assertRateLimit("checkout-status", clientIp(ctx.req), 120, 60_000);
      const db = getDb();
      const session = await loadSession(input.publicId);
      const [attempt] = await db.select().from(bookingAttempts).where(eq(bookingAttempts.checkoutSessionId, session.id)).orderBy(desc(bookingAttempts.id)).limit(1);
      const bookingId = session.bookingId ?? attempt?.bookingId ?? null;
      const [booking] = bookingId ? await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1) : [];
      const confirmed = session.status === "confirmed" && booking;
      const accessToken = confirmed ? await cachedAccessToken(booking.id) : null;
      const [code, ...rest] = (session.lastError ?? "").split(": ");
      const errorCode = session.lastError ? (attempt?.lastErrorCode ?? code ?? null) : null;
      return {
        status: session.status,
        attemptState: attempt?.state ?? null,
        bookingId,
        orderId: booking?.orderId ?? null,
        bookingReference: booking?.bookingReference || null,
        bookingState: booking?.state ?? null,
        accessToken,
        errorCode,
        errorMessage: session.lastError ? rest.join(": ") || session.lastError : null,
        breakdown: parseBreakdown(session),
        offerExpiresAt: session.offerExpiresAt?.toISOString() ?? null,
      };
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  cancelSession: publicQuery.input(z.object({ publicId: z.string().uuid() })).mutation(async ({ input, ctx }) => {
    try {
      assertRateLimit("checkout-cancel", clientIp(ctx.req), 20, 60_000);
      const db = getDb();
      const session = await loadSession(input.publicId);
      if (!["created", "payment_pending"].includes(session.status)) {
        return { status: session.status, cancelled: false };
      }
      if (session.pspProvider === "stripe" && session.pspIntentId && stripeConfigured()) {
        try {
          const pi = await retrievePaymentIntent(session.pspIntentId);
          if (pi.status === "requires_capture") {
            // Kunden har allerede autorisert — bestillingen må fullføres eller feile via orkestratoren
            await onPaymentAuthorized(session.id, "client");
            return { status: "authorized", cancelled: false };
          }
          if (pi.status !== "canceled" && pi.status !== "succeeded") await cancelPaymentIntent(session.pspIntentId, `cancel:${session.idempotencyKey}`, "requested_by_customer");
        } catch (err) {
          log.warn({ err, sessionId: session.id }, "cancelSession: PaymentIntent");
        }
      }
      const cancelled = await failSession(db, session.id, "cancelled", "CANCELLED_BY_CUSTOMER", "Kunden avbrøt bestillingen.");
      return { status: cancelled ? "cancelled" : session.status, cancelled };
    } catch (err) {
      throw toTRPCError(err);
    }
  }),
});
