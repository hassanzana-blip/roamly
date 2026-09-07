import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { bookingAttempts, bookings, checkoutSessions, quotes } from "../db/schema";
import { sha256Hex } from "./lib/tokens";
import { assertRateLimit, clientIp } from "./lib/ratelimit";
import { AppError, toTRPCError } from "./lib/errors";
import { env } from "./lib/env";
import { toMinor } from "./lib/money";
import { createPaymentIntent, retrievePaymentIntent, stripeConfigured } from "./lib/stripe";
import { cachedAccessToken, passengerDetailsSchema } from "./checkout";
import { duffelConfig, getOfferRaw, type BagService } from "./lib/duffel";
import { demoGetOffer } from "./lib/demo";
import { logAudit } from "./lib/audit";
import { normalizePhone } from "./lib/validation";
import {
  assertQuotePassengersComplete,
  decryptQuotePassengers,
  insertSessionDocuments,
  parseStoredQuotePassengers,
  prepareQuotePassengers,
  publicQuotePassengers,
  stripDocuments,
} from "./lib/quotePassengers";
import type { Offer, PassengerDetails, PriceBreakdownMinor } from "../contracts/types";

/**
 * Offentlig tilbuds-visning og betaling via sikker engangslenke (checkout-lenke).
 * Token er 256-bit tilfeldig og lagres kun som hash — kan ikke gjettes.
 */

type QuoteRow = typeof quotes.$inferSelect;

async function quoteByToken(token: string): Promise<QuoteRow> {
  const rows = await getDb().select().from(quotes).where(eq(quotes.checkoutTokenHash, sha256Hex(token))).limit(1);
  const quote = rows[0];
  if (!quote) throw new AppError("NOT_FOUND", { message: "Lenken er ugyldig eller erstattet av en nyere." });
  return quote;
}

function effectiveStatus(quote: QuoteRow): string {
  const expired = quote.expiresAt < new Date();
  return expired && ["draft", "sent"].includes(quote.status) ? "expired" : quote.status;
}

const tokenInput = z.object({ token: z.string().min(32).max(128) });

export const quotesPublicRouter = createRouter({
  getByToken: publicQuery.input(tokenInput).query(async ({ input, ctx }) => {
    try {
      assertRateLimit("quote-view", clientIp(ctx.req), 30, 60_000);
      const quote = await quoteByToken(input.token);
      const offer = JSON.parse(quote.offerSnapshot) as Offer;
      const stored = parseStoredQuotePassengers(quote.passengersJson);
      const slots = offer.passengers ?? [];
      const passengersSubmitted = stored.length > 0 && stored.length === slots.length;
      const status = effectiveStatus(quote);
      return {
        reference: quote.reference,
        customerName: quote.customerName.split(" ")[0], // kun fornavn i offentlig visning
        status,
        expiresAt: quote.expiresAt,
        route: offer.slices?.map((s) => `${s.origin.city} → ${s.destination.city}`).join(" · ") ?? "",
        slices: offer.slices ?? [],
        cabinClass: offer.cabinClass,
        offerAmount: offer.totalAmount,
        serviceFeeAmount: quote.serviceFeeAmount,
        totalAmount: quote.totalAmount,
        currency: quote.currency,
        passengers: slots.length || 1,
        /** Slots fra tilbudet (id/type/alder) — frontend rendrer ett skjema per slot. */
        passengerSlots: slots.map((p) => ({ id: p.id, type: p.type, age: p.age })),
        passengersSubmitted,
        submittedPassengers: publicQuotePassengers(stored),
        identityDocumentsRequired: Boolean(offer.identityDocumentsRequired),
        /** Passasjerer kan sendes inn/endres til betaling er startet. */
        canSubmitPassengers: ["draft", "sent"].includes(status),
        onlinePaymentAvailable: stripeConfigured() && status === "sent" && passengersSubmitted,
      };
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  /** Kunden fyller inn passasjerer (B2). Valideres mot tilbudet; pass lagres kryptert. */
  submitPassengers: publicQuery
    .input(
      tokenInput.extend({
        passengers: z.array(passengerDetailsSchema).min(1).max(9),
        contactPhone: z.string().min(6).max(24).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        assertRateLimit("quote-passengers", clientIp(ctx.req), 10, 60_000);
        const db = getDb();
        const quote = await quoteByToken(input.token);
        const status = effectiveStatus(quote);
        if (!["draft", "sent"].includes(status)) {
          throw new AppError("CONFLICT", { message: status === "expired" ? "Tilbudet er utløpt. Be om et nytt." : `Tilbudet har status «${status}» — passasjerer kan ikke endres nå.` });
        }
        const [activeSession] = await db
          .select({ id: checkoutSessions.id })
          .from(checkoutSessions)
          .where(and(eq(checkoutSessions.searchCtx, `quote:${quote.id}`), inArray(checkoutSessions.status, ["authorized", "booking", "confirmed"])))
          .limit(1);
        if (activeSession) throw new AppError("CONFLICT", { message: "Betalingen er allerede gjennomført — passasjerer kan ikke endres." });

        const offer = JSON.parse(quote.offerSnapshot) as Offer;
        const phone = input.contactPhone ? normalizePhone(input.contactPhone) : null;
        if (input.contactPhone && !phone) throw new AppError("VALIDATION", { message: "Telefonnummeret er ugyldig.", data: { field: "contactPhone" } });
        const { stored } = prepareQuotePassengers(input.passengers as PassengerDetails[], offer, { email: quote.customerEmail, phone: phone ?? quote.customerPhone ?? undefined });

        await db
          .update(quotes)
          .set({ passengersJson: JSON.stringify(stored), ...(phone ? { customerPhone: phone } : {}) })
          .where(eq(quotes.id, quote.id));
        await logAudit({
          actorType: "customer",
          actorId: quote.customerEmail,
          action: "quote.passengers_submitted",
          targetType: "quote",
          targetId: quote.reference,
          metadata: { count: stored.length, withDocuments: stored.filter((p) => p.identityDocument).length },
          ip: clientIp(ctx.req),
        });
        return { ok: true, passengersSubmitted: true, passengers: publicQuotePassengers(stored) };
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /** Start kortbetaling av et sendt tilbud (Stripe, manuell fangst). Videre flyt: checkout.paymentAuthorized/status. */
  startPayment: publicQuery
    .input(tokenInput.extend({ paymentMethod: z.enum(["card", "klarna"]).default("card") }))
    .mutation(async ({ input, ctx }) => {
      try {
        assertRateLimit("quote-pay", clientIp(ctx.req), 10, 60_000);
        if (!stripeConfigured()) throw new AppError("PAYMENT_NOT_CONFIGURED");
        const db = getDb();
        const quote = await quoteByToken(input.token);
        const status = effectiveStatus(quote);
        if (status !== "sent") throw new AppError("CONFLICT", { message: status === "expired" ? "Tilbudet er utløpt. Be om et nytt." : `Tilbudet har status «${status}» og kan ikke betales nå.` });

        const idempotencyKey = `quote:${quote.id}:pay`;
        const [existing] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.idempotencyKey, idempotencyKey)).limit(1);
        if (existing) {
          if (existing.pspIntentId) {
            const pi = await retrievePaymentIntent(existing.pspIntentId);
            return { publicId: existing.publicId, status: existing.status, clientSecret: pi.client_secret ?? "", publishableKey: env.STRIPE_PUBLISHABLE_KEY ?? "", breakdown: JSON.parse(existing.breakdownJson) as PriceBreakdownMinor };
          }
          throw new AppError("CONFLICT", { message: "Betaling er allerede startet for dette tilbudet." });
        }

        // Passasjerer MÅ være sendt inn før betaling (B2) — sjekkes mot tilbudet i øyeblikksbildet
        const snapshot = JSON.parse(quote.offerSnapshot) as Offer;
        const stored = parseStoredQuotePassengers(quote.passengersJson);
        assertQuotePassengersComplete(stored, snapshot);

        // Ferskt tilbud (leverandør) — utløpt → be kunden kontakte oss
        let offer: Offer;
        let rawServices: BagService[] = [];
        if (duffelConfig.configured) {
          const fresh = await getOfferRaw(quote.offerId);
          offer = fresh.offer;
          rawServices = fresh.rawServices;
        } else {
          offer = demoGetOffer(quote.offerId) ?? snapshot;
          if (!offer.expiresAt || Date.parse(offer.expiresAt) < Date.now()) offer = { ...offer, expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() };
        }
        assertQuotePassengersComplete(stored, offer);
        const passengers = decryptQuotePassengers(stored);

        const currency = quote.currency.toUpperCase();
        const supplierMinor = toMinor(offer.totalAmount, offer.totalCurrency);
        const totalMinor = toMinor(quote.totalAmount, currency);
        if (supplierMinor > totalMinor) throw new AppError("PRICE_CHANGED", { message: "Prisen hos flyselskapet har økt siden tilbudet ble laget. Kontakt oss for et oppdatert tilbud." });
        const breakdown: PriceBreakdownMinor = {
          currency,
          supplierAmountMinor: supplierMinor,
          servicesAmountMinor: 0,
          serviceFeeAmountMinor: totalMinor - supplierMinor,
          bonusUsedMinor: 0,
          totalAmountMinor: totalMinor,
        };
        const publicId = randomUUID();
        const sessionId = await db.transaction(async (tx) => {
          const res = await tx.insert(checkoutSessions).values({
            publicId,
            offerId: offer.id,
            offerSnapshot: JSON.stringify({ offer, rawServices }),
            offerExpiresAt: offer.expiresAt ? new Date(offer.expiresAt) : null,
            searchCtx: `quote:${quote.id}`,
            passengersJson: JSON.stringify(stripDocuments(passengers)),
            contactEmail: quote.customerEmail.toLowerCase(),
            contactPhone: quote.customerPhone ?? "",
            locale: "nb",
            currency,
            supplierAmountMinor: supplierMinor,
            servicesAmountMinor: 0,
            serviceFeeAmountMinor: breakdown.serviceFeeAmountMinor,
            bonusUsedMinor: 0,
            totalAmountMinor: totalMinor,
            breakdownJson: JSON.stringify(breakdown),
            status: "created",
            pspProvider: "stripe",
            paymentMethod: input.paymentMethod,
            idempotencyKey,
            ip: clientIp(ctx.req),
            userAgent: (ctx.req.headers.get("user-agent") ?? "").slice(0, 255) || null,
            expiresAt: new Date(Math.min(quote.expiresAt.getTime(), Date.now() + 20 * 60_000)),
          });
          const id = Number(res[0].insertId);
          await insertSessionDocuments(tx, id, passengers);
          return id;
        });
        const pi = await createPaymentIntent({
          amountMinor: totalMinor,
          currency,
          idempotencyKey,
          checkoutPublicId: publicId,
          email: quote.customerEmail,
          method: input.paymentMethod,
          description: `HelloSky tilbud ${quote.reference}`,
        });
        await db.update(checkoutSessions).set({ status: "payment_pending", pspIntentId: pi.id }).where(eq(checkoutSessions.id, sessionId));
        return { publicId, status: "payment_pending", clientSecret: pi.clientSecret, publishableKey: env.STRIPE_PUBLISHABLE_KEY ?? "", breakdown };
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /** Status for tilbud + evt. betaling/booking. */
  status: publicQuery.input(tokenInput).query(async ({ input, ctx }) => {
    try {
      assertRateLimit("quote-status", clientIp(ctx.req), 60, 60_000);
      const db = getDb();
      const quote = await quoteByToken(input.token);
      const [session] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.searchCtx, `quote:${quote.id}`)).orderBy(desc(checkoutSessions.id)).limit(1);
      const [attempt] = session ? await db.select().from(bookingAttempts).where(eq(bookingAttempts.checkoutSessionId, session.id)).orderBy(desc(bookingAttempts.id)).limit(1) : [];
      const [booking] = quote.bookedOrderId ? await db.select().from(bookings).where(eq(bookings.orderId, quote.bookedOrderId)).limit(1) : [];
      return {
        reference: quote.reference,
        quoteStatus: effectiveStatus(quote),
        sessionStatus: session?.status ?? null,
        sessionPublicId: session?.publicId ?? null,
        attemptState: attempt?.state ?? null,
        bookingReference: booking?.bookingReference || null,
        orderId: booking?.orderId ?? null,
        accessToken: booking ? await cachedAccessToken(booking.id) : null,
        errorCode: attempt?.lastErrorCode ?? null,
      };
    } catch (err) {
      throw toTRPCError(err);
    }
  }),
});
