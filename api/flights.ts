import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { bookings, supportMessages } from "../db/schema";
import { eq, and } from "drizzle-orm";
import {
  duffelConfig,
  duffelCreateOrder,
  duffelGetOffer,
  duffelSearch,
  DuffelError,
} from "./lib/duffel";
import { demoFlightStatus, demoGetOffer, demoPaxFactor, demoPriceHint, demoSearch } from "./lib/demo";
import { assertRateLimit, clientIp } from "./lib/ratelimit";
import { sendBookingConfirmation, sendSupportAck } from "./lib/mailer";
import { searchAirports } from "../contracts/airports";
import { desc } from "drizzle-orm";
import type { Order, PriceHint, ServiceStatus, SupportCase } from "../contracts/types";

const passengerSearchSchema = z.object({
  type: z.enum(["adult", "child", "infant_without_seat"]),
  age: z.number().int().min(0).max(17).optional(),
});

const sliceSchema = z.object({
  origin: z.string().length(3),
  destination: z.string().length(3),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const searchSchema = z.object({
  slices: z.array(sliceSchema).min(1).max(3),
  passengers: z.array(passengerSearchSchema).min(1).max(9),
  cabinClass: z.enum(["economy", "premium_economy", "business", "first"]),
});

const passengerDetailsSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["adult", "child", "infant_without_seat"]),
  title: z.enum(["mr", "ms", "mrs"]),
  gender: z.enum(["m", "f"]),
  givenName: z.string().trim().min(1).max(60),
  familyName: z.string().trim().min(1).max(60),
  bornOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  email: z.string().email().optional(),
  phoneNumber: z.string().max(24).optional(),
  infantPassengerId: z.string().optional(),
  identityDocument: z
    .object({
      type: z.literal("passport"),
      uniqueIdentifier: z.string().min(4).max(20),
      issuingCountryCode: z.string().length(2),
      expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .optional(),
});

const createOrderSchema = z.object({
  offerId: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(6).max(24),
  passengers: z.array(passengerDetailsSchema).min(1).max(9),
  card: z
    .object({
      number: z.string().min(12).max(19),
      expiryMonth: z.string().length(2),
      expiryYear: z.string().length(2),
      cvc: z.string().min(3).max(4),
      holderName: z.string().min(1),
    })
    .optional(),
  services: z
    .object({
      extraBags: z.number().int().min(0).max(3),
      seats: z.record(z.string(), z.string().regex(/^\d{1,2}[A-F]$/)),
    })
    .optional(),
});

function serviceStatus(): ServiceStatus {
  return {
    duffelConfigured: duffelConfig.configured,
    demoMode: !duffelConfig.configured,
    paymentMode: duffelConfig.paymentType,
  };
}

async function resolveOffer(offerId: string) {
  if (duffelConfig.configured) return duffelGetOffer(offerId);
  const offer = demoGetOffer(offerId);
  if (!offer) {
    throw new Error(
      "Tilbudet er utløpt eller finnes ikke. Gjør et nytt søk for å se oppdaterte priser.",
    );
  }
  return offer;
}

export const flightsRouter = createRouter({
  status: publicQuery.query((): ServiceStatus => serviceStatus()),

  airports: publicQuery.input(z.object({ query: z.string().max(60) })).query(({ input }) => {
    return searchAirports(input.query);
  }),

  search: publicQuery.input(searchSchema).mutation(async ({ input, ctx }) => {
    assertRateLimit("search", clientIp(ctx.req), 20, 60_000);
    if (duffelConfig.configured) {
      try {
        return await duffelSearch(input);
      } catch (err) {
        if (err instanceof DuffelError) {
          throw new Error(`Søket feilet hos flyselskapene: ${err.message}`);
        }
        throw err;
      }
    }
    // Simulate realistic supplier latency in demo mode
    await new Promise((r) => setTimeout(r, 1400));
    return demoSearch(input);
  }),

  getOffer: publicQuery
    .input(z.object({ offerId: z.string().min(1) }))
    .query(({ input }) => resolveOffer(input.offerId)),

  createOrder: publicQuery.input(createOrderSchema).mutation(async ({ input, ctx }) => {
    assertRateLimit("createOrder", clientIp(ctx.req), 10, 60_000);
    const offer = await resolveOffer(input.offerId);

    // Validate and price the requested extras against the offer
    const extras = input.services ?? { extraBags: 0, seats: {} };
    const maxBags = offer.services?.maxExtraBags ?? 0;
    const extraBags = Math.min(extras.extraBags, maxBags);
    const seatPrice = offer.services?.seatPrice ? Number(offer.services.seatPrice) : 0;
    const bagPrice = offer.services?.extraBagPrice ? Number(offer.services.extraBagPrice) : 0;
    const seatCount = Object.keys(extras.seats).length;
    const extrasTotal = extraBags * bagPrice + (seatPrice > 0 ? seatCount * seatPrice : 0);
    const sanitizedServices =
      extraBags > 0 || seatCount > 0
        ? { extraBags, seats: extras.seats }
        : undefined;

    // Infants must be linked to a unique responsible adult (Duffel rule)
    const infants = input.passengers.filter((p) => p.type === "infant_without_seat");
    if (infants.length > 0) {
      const adultsWithInfant = new Set(
        input.passengers.filter((p) => p.infantPassengerId).map((p) => p.id),
      );
      if (adultsWithInfant.size !== infants.length) {
        throw new Error("Hver baby må knyttes til nøyaktig én voksen reisende.");
      }
    }

    let order: Order;
    if (duffelConfig.configured) {
      try {
        order = await duffelCreateOrder({
          offer,
          passengers: input.passengers,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          services: sanitizedServices,
        });
      } catch (err) {
        if (err instanceof DuffelError) {
          throw new Error(`Bestillingen kunne ikke fullføres: ${err.message}`);
        }
        throw err;
      }
    } else {
      // Demo order — mirrors Duffel's order object
      const ref = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
      order = {
        id: `ord_demo_${Date.now().toString(36)}`,
        bookingReference: ref,
        liveMode: false,
        demoMode: true,
        createdAt: new Date().toISOString(),
        totalAmount: offer.totalAmount,
        totalCurrency: offer.totalCurrency,
        cabinClass: offer.cabinClass,
        slices: offer.slices,
        passengers: input.passengers,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        paymentStatus: "succeeded",
        services: sanitizedServices,
        servicesAmount: extrasTotal > 0 ? String(extrasTotal) : undefined,
      };
      if (extrasTotal > 0) {
        order.totalAmount = String(Number(offer.totalAmount) + extrasTotal);
      }
    }

    // Booking confirmation email (non-blocking; logged when SMTP is absent)
    const mail = await sendBookingConfirmation(order).catch(() => null);
    if (mail && !mail.sent && mail.reason === "failed") {
      console.error(`E-post til ${order.contactEmail} kunne ikke sendes for ${order.bookingReference}`);
    }

    // Persist (never store card details)
    try {
      await getDb().insert(bookings).values({
        orderId: order.id,
        bookingReference: order.bookingReference,
        contactEmail: order.contactEmail,
        contactPhone: order.contactPhone,
        liveMode: order.liveMode,
        payload: JSON.stringify(order),
      });
    } catch (dbErr) {
      console.error("Kunne ikke lagre bestilling i databasen:", dbErr);
    }

    return order;
  }),

  getOrder: publicQuery
    .input(z.object({ orderId: z.string().min(1) }))
    .query(async ({ input }) => {
      const rows = await getDb()
        .select()
        .from(bookings)
        .where(eq(bookings.orderId, input.orderId))
        .limit(1);
      if (!rows[0]) throw new Error("Fant ikke bestillingen.");
      return JSON.parse(rows[0].payload) as Order;
    }),

  findBooking: publicQuery
    .input(z.object({ bookingReference: z.string().min(4).max(8), email: z.string().email() }))
    .query(async ({ input }) => {
      const rows = await getDb()
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.bookingReference, input.bookingReference.toUpperCase()),
            eq(bookings.contactEmail, input.email.toLowerCase().trim()),
          ),
        )
        .limit(1);
      if (!rows[0]) {
        throw new Error(
          "Vi fant ingen bestilling med denne kombinasjonen av referanse og e-post. Sjekk at begge er skrevet riktig.",
        );
      }
      return JSON.parse(rows[0].payload) as Order;
    }),

  flightStatus: publicQuery
    .input(
      z.object({
        carrier: z.string().length(2),
        flightNumber: z.string().min(1).max(5),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .query(({ input, ctx }) => {
      assertRateLimit("flightStatus", clientIp(ctx.req), 30, 60_000);
      const status = demoFlightStatus(input.carrier, input.flightNumber, input.date);
      if (!status) throw new Error("Vi kjenner ikke dette flyselskapet ennå.");
      return status;
    }),

  priceHints: publicQuery
    .input(
      z.object({
        origin: z.string().length(3),
        destination: z.string().length(3),
        cabinClass: z.enum(["economy", "premium_economy", "business", "first"]),
        dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(9),
        returnDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(9).optional(),
        passengers: z.array(z.enum(["adult", "child", "infant_without_seat"])).min(1).max(9),
      }),
    )
    .query(({ input }): PriceHint[] => {
      // Live mode: exact day-prices would require one offer request per date,
      // so hints are only served in demo mode; the strip still works as navigation.
      if (duffelConfig.configured) return input.dates.map((date) => ({ date, amount: null }));
      const paxFactor = demoPaxFactor(input.passengers);
      return input.dates.map((date, i) => ({
        date,
        amount: demoPriceHint(
          input.origin,
          input.destination,
          input.cabinClass,
          date,
          paxFactor,
          input.returnDates?.[i],
        ),
      }));
    }),

  myCases: publicQuery
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }): Promise<SupportCase[]> => {
      const rows = await getDb()
        .select()
        .from(supportMessages)
        .where(eq(supportMessages.email, input.email.toLowerCase().trim()))
        .orderBy(desc(supportMessages.createdAt))
        .limit(10);
      return rows.map((r) => ({
        caseReference: r.caseReference,
        topic: r.topic,
        message: r.message,
        bookingReference: r.bookingReference,
        createdAt: r.createdAt.toISOString(),
      }));
    }),

  sendSupportMessage: publicQuery
    .input(
      z.object({
        name: z.string().trim().min(1).max(100),
        email: z.string().email(),
        bookingReference: z.string().max(8).optional(),
        topic: z.enum(["booking", "change", "refund", "baggage", "other"]),
        message: z.string().trim().min(10).max(4000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertRateLimit("support", clientIp(ctx.req), 5, 60_000);
      const caseReference = `RM-${Date.now().toString(36).toUpperCase().slice(-6)}`;
      const result = await getDb().insert(supportMessages).values({
        caseReference,
        name: input.name,
        email: input.email.toLowerCase().trim(),
        bookingReference: input.bookingReference?.toUpperCase() || null,
        topic: input.topic,
        message: input.message,
      });
      await sendSupportAck({
        email: input.email,
        name: input.name,
        caseReference,
      }).catch(() => null);
      return {
        id: Number(result[0].insertId),
        caseReference,
        receivedAt: new Date().toISOString(),
      };
    }),
});
