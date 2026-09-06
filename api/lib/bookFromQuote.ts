import { eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { bookings, bookingEvents, bookingSegments, customers, quotes } from "../../db/schema";
import { duffelConfig, duffelGetOffer, duffelCreateOrder } from "./duffel";
import { demoGetOffer } from "./demo";
import { enqueueJob } from "./jobs";
import { logAudit } from "./audit";
import { humanReference } from "./tokens";
import type { Order, PassengerDetails } from "../../contracts/types";

/**
 * Oppretter en ordre fra et betalt tilbud.
 * Tilbudet revalideres ALLTID mot leverandøren før booking — et utløpt
 * eller prisendret tilbud bookes aldri blindt.
 */
export async function createOrderFromQuote(quoteId: number): Promise<void> {
  const db = getDb();
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
  if (!quote) throw new Error(`Tilbud ${quoteId} ikke funnet`);
  if (quote.bookedOrderId) return; // allerede booket — idempotent
  if (quote.status !== "paid") throw new Error(`Tilbud ${quote.reference} er ikke betalt (status: ${quote.status})`);

  // Revalider tilbudet mot leverandøren
  let offer;
  try {
    offer = duffelConfig.configured ? await duffelGetOffer(quote.offerId) : demoGetOffer(quote.offerId);
  } catch {
    offer = null;
  }
  if (!offer) {
    await db.update(quotes).set({ status: "failed" }).where(eq(quotes.id, quoteId));
    await logAudit({
      actorType: "worker", action: "quote.booking_failed_offer_expired",
      targetType: "quote", targetId: quote.reference,
    });
    await enqueueJob("send_email", {
      kind: "ops_alert",
      subject: `Booking feilet — tilbud utløpt: ${quote.reference}`,
      body: `Tilbud ${quote.reference} er betalt, men leverandørtilbudet er utløpt. Kunden må kontaktes for ny pris eller refusjon.`,
    });
    return;
  }

  const passengers: PassengerDetails[] = quote.passengersJson
    ? (JSON.parse(quote.passengersJson) as PassengerDetails[])
    : [];

  let order: Order;
  if (duffelConfig.configured) {
    order = await duffelCreateOrder({
      offer,
      passengers,
      contactEmail: quote.customerEmail,
      contactPhone: quote.customerPhone ?? "",
    });
  } else {
    // Demo-ordre
    order = {
      id: `ord_demo_${Date.now().toString(36)}`,
      bookingReference: humanReference("", 6).replace("-", ""),
      liveMode: false, demoMode: true,
      createdAt: new Date().toISOString(),
      totalAmount: offer.totalAmount, totalCurrency: offer.totalCurrency,
      cabinClass: offer.cabinClass, slices: offer.slices, passengers,
      contactEmail: quote.customerEmail, contactPhone: quote.customerPhone ?? "",
      paymentStatus: "succeeded",
    };
  }

  // Opprett/knytt kunde
  const existing = await db.select().from(customers).where(eq(customers.email, quote.customerEmail)).limit(1);
  let customerId = existing[0]?.id;
  if (!customerId) {
    const result = await db.insert(customers).values({
      email: quote.customerEmail, name: quote.customerName, phone: quote.customerPhone ?? null,
    });
    customerId = Number(result[0].insertId);
  }

  // Lagre booking i CONFIRMED-tilstand med komplett spor
  const bookingResult = await db.insert(bookings).values({
    orderId: order.id,
    bookingReference: order.bookingReference,
    contactEmail: order.contactEmail,
    contactPhone: order.contactPhone,
    liveMode: order.liveMode,
    payload: JSON.stringify(order),
    state: "CONFIRMED",
    customerId,
    quoteId,
    totalAmount: order.totalAmount,
    totalCurrency: order.totalCurrency,
    source: "admin_quote",
  });
  const bookingId = Number(bookingResult[0].insertId);

  await db.insert(bookingEvents).values([
    { bookingId, fromState: "QUOTE_SENT", toState: "AWAITING_PAYMENT", actorType: "system", reason: "Tilbud opprettet og sendt" },
    { bookingId, fromState: "AWAITING_PAYMENT", toState: "PAYMENT_AUTHORIZED", actorType: "staff", reason: "Betaling bekreftet manuelt" },
    { bookingId, fromState: "PAYMENT_AUTHORIZED", toState: "BOOKING_PROCESSING", actorType: "worker", reason: "Booking startet" },
    { bookingId, fromState: "BOOKING_PROCESSING", toState: "CONFIRMED", actorType: "worker", reason: "Ordre bekreftet hos leverandør" },
  ]);

  let segIdx = 0;
  for (const slice of order.slices) {
    for (const seg of slice.segments) {
      await db.insert(bookingSegments).values({
        bookingId,
        sliceIndex: order.slices.indexOf(slice),
        segmentIndex: segIdx++,
        originIata: seg.origin.iata, destinationIata: seg.destination.iata,
        carrierIata: seg.carrier.iata, flightNumber: seg.flightNumber,
        departingAt: seg.departingAt, arrivingAt: seg.arrivingAt,
        cabinClass: seg.cabinClass,
      });
    }
  }

  await db.update(quotes)
    .set({ status: "booked", bookedOrderId: order.id })
    .where(eq(quotes.id, quoteId));

  await enqueueJob("send_email", { kind: "booking_confirmation", bookingId });
  await logAudit({
    actorType: "worker", action: "booking.created_from_quote",
    targetType: "booking", targetId: bookingId,
    metadata: { quoteId, orderId: order.id, reference: order.bookingReference },
  });
}
