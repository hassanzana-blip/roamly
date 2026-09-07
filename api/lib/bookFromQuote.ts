import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "../queries/connection";
import { checkoutSessions, quotes } from "../../db/schema";
import { duffelConfig, getOfferRaw, type BagService } from "./duffel";
import { demoGetOffer } from "./demo";
import { enqueueJob } from "./jobs";
import { logAudit } from "./audit";
import { toMinor } from "./money";
import { log } from "./logger";
import { AppError } from "./errors";
import { assertQuotePassengersComplete, decryptQuotePassengers, insertSessionDocuments, parseStoredQuotePassengers, stripDocuments } from "./quotePassengers";
import type { Offer, PriceBreakdownMinor } from "../../contracts/types";

/**
 * Booking fra et betalt tilbud (assisted booking, manuell betaling).
 * Idempotent: tilbudet låses (paid → booking) før noe annet skjer, og det
 * opprettes én checkout-sesjon (psp_provider=manual) + ett booking-forsøk
 * som orkestratoren kjører — samme revalidering og sporbarhet som web-booking.
 */
export async function createOrderFromQuote(quoteId: number): Promise<void> {
  const db = getDb();
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
  if (!quote) throw new Error(`Tilbud ${quoteId} ikke funnet`);
  if (quote.bookedOrderId) return; // allerede booket — idempotent

  const idempotencyKey = `quote:${quote.id}`;
  const [existingSession] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.idempotencyKey, idempotencyKey)).limit(1);
  if (existingSession) {
    // Sesjon finnes: sørg for at forsøket er i kø (retry-sikkert)
    const { onPaymentAuthorized } = await import("../checkout");
    if (!["failed", "expired", "cancelled", "price_changed", "confirmed"].includes(existingSession.status)) {
      await onPaymentAuthorized(existingSession.id, "quote");
    }
    return;
  }

  // Lås tilbudet: kun ett forsøk får gå videre
  const locked = await db
    .update(quotes)
    .set({ status: "booking" })
    .where(and(eq(quotes.id, quoteId), eq(quotes.status, "paid")));
  if (Number(locked[0].affectedRows) === 0) {
    if (quote.status !== "booking") throw new Error(`Tilbud ${quote.reference} er ikke betalt (status: ${quote.status})`);
  }

  // Revalider tilbudet mot leverandøren (utløpt → feilet + ops-varsel)
  let offer: Offer | null = null;
  let rawServices: BagService[] = [];
  try {
    if (duffelConfig.configured) {
      const fresh = await getOfferRaw(quote.offerId);
      offer = fresh.offer;
      rawServices = fresh.rawServices;
    } else {
      offer = demoGetOffer(quote.offerId) ?? (JSON.parse(quote.offerSnapshot) as Offer);
      if (!offer.expiresAt || Date.parse(offer.expiresAt) < Date.now()) {
        // Demo-øyeblikksbilde uten gyldig utløp: forleng slik at orkestratoren godtar det
        offer = {
          ...offer,
          expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        };
      }
    }
  } catch (err) {
    log.warn({ err, quoteId }, "Tilbud utløpt før booking");
    offer = null;
  }
  if (!offer) {
    await db.update(quotes).set({ status: "failed" }).where(eq(quotes.id, quoteId));
    await logAudit({
      actorType: "worker",
      action: "quote.booking_failed_offer_expired",
      targetType: "quote",
      targetId: quote.reference,
    });
    await enqueueJob("send_email", {
      kind: "ops_alert",
      subject: `Booking feilet — tilbud utløpt: ${quote.reference}`,
      body: `Tilbud ${quote.reference} er betalt, men leverandørtilbudet er utløpt. Kunden må kontaktes for ny pris eller refusjon.`,
    });
    return;
  }

  // Passasjerer MÅ finnes og matche tilbudet (B2) — ellers ville leverandøren fått en tom ordre.
  const stored = parseStoredQuotePassengers(quote.passengersJson);
  try {
    assertQuotePassengersComplete(stored, offer);
  } catch (err) {
    if (!(err instanceof AppError && err.code === "INVALID_PASSENGER")) throw err;
    await db.update(quotes).set({ status: "failed" }).where(eq(quotes.id, quoteId));
    await logAudit({
      actorType: "worker",
      action: "quote.booking_failed_missing_passengers",
      targetType: "quote",
      targetId: quote.reference,
      metadata: { expected: offer.passengers.length, got: stored.length },
    });
    await enqueueJob("send_email", {
      kind: "ops_alert",
      subject: `Booking feilet — passasjerer mangler: ${quote.reference}`,
      body: `Tilbud ${quote.reference} er betalt, men har ${stored.length} av ${offer.passengers.length} passasjerer registrert. Registrer passasjerene (kunde via tilbudslenken, eller admin) og merk tilbudet som betalt på nytt.`,
    });
    return; // ingen retry — krever manuell oppfølging
  }
  const passengers = decryptQuotePassengers(stored);
  const currency = quote.currency.toUpperCase();
  const supplierMinor = toMinor(offer.totalAmount, offer.totalCurrency);
  const feeMinor = toMinor(quote.serviceFeeAmount, currency);
  const totalMinor = toMinor(quote.totalAmount, currency);
  // Selgeren satte prisen i tilbudet: total = leverandør + gebyr. Avvik → gebyret justeres slik at kundens total står fast.
  const breakdown: PriceBreakdownMinor = {
    currency,
    supplierAmountMinor: supplierMinor,
    servicesAmountMinor: 0,
    serviceFeeAmountMinor: Math.max(0, totalMinor - supplierMinor) || feeMinor,
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
      servicesJson: null,
      contactEmail: quote.customerEmail.toLowerCase(),
      contactPhone: quote.customerPhone ?? "",
      locale: "nb",
      currency,
      supplierAmountMinor: breakdown.supplierAmountMinor,
      servicesAmountMinor: 0,
      serviceFeeAmountMinor: breakdown.serviceFeeAmountMinor,
      bonusUsedMinor: 0,
      totalAmountMinor: breakdown.totalAmountMinor,
      breakdownJson: JSON.stringify(breakdown),
      status: "authorized",
      pspProvider: "manual",
      pspIntentId: null,
      paymentMethod: "manual",
      idempotencyKey,
      expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
    });
    const id = Number(res[0].insertId);
    await insertSessionDocuments(tx, id, passengers);
    return id;
  });
  const { onPaymentAuthorized } = await import("../checkout");
  const { attemptId } = await onPaymentAuthorized(sessionId, "quote");
  await logAudit({
    actorType: "worker",
    action: "quote.booking_started",
    targetType: "quote",
    targetId: quote.reference,
    metadata: { sessionId, attemptId, totalMinor, currency },
  });
}
