import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { bookings, supportCases, supportMessages } from "../db/schema";
import { env } from "./lib/env";
import { AppError, toTRPCError } from "./lib/errors";
import { duffelConfig, duffelGetOffer, duffelSearch } from "./lib/duffel";
import { demoFlightStatus, demoGetOffer, demoPaxFactor, demoPriceHint, demoSearch } from "./lib/demo";
import { assertRateLimit, clientIp } from "./lib/ratelimit";
import { enqueueJob } from "./lib/jobs";
import { issueBookingAccessToken } from "./lib/bookingAccess";
import { FLAT_FEE_BY_CURRENCY, instantBookingEnabled, loadPricingOverrides, SERVICE_FEE_PERCENT } from "./lib/pricing";
import { searchAirportsWorldwide } from "./lib/airportMeta";
import { travelportConfig, travelportSearch, isTravelportOffer } from "./lib/travelport";
import { fetchFlightStatus, flightStatusConfig } from "./lib/flightStatus";
import type { FlightStatus, Offer, Order, PriceHint, SearchResult, ServiceStatus } from "../contracts/types";

// ─── Søk, tilbud og offentlige oppslag ─────────────────────────────────────
// Booking skjer KUN via checkout.* (OTA-020). Ordre hentes via orders.get.

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

type SearchInput = z.infer<typeof searchSchema>;

// ─── Søkecache (live): 5 min per normalisert input ─────────────────────────
const SEARCH_CACHE_TTL_MS = 5 * 60_000;
const searchCache = new Map<string, { at: number; result: SearchResult }>();

export function searchCacheKey(input: SearchInput): string {
  const slices = input.slices.map((s) => `${s.origin.toUpperCase()}-${s.destination.toUpperCase()}@${s.departureDate}`).join("|");
  const pax = [...input.passengers]
    .map((p) => `${p.type}${p.age !== undefined ? `:${p.age}` : ""}`)
    .sort()
    .join(",");
  return `${slices}#${pax}#${input.cabinClass}`;
}

setInterval(() => {
  const cutoff = Date.now() - SEARCH_CACHE_TTL_MS;
  for (const [k, v] of searchCache) if (v.at < cutoff) searchCache.delete(k);
}, 60_000).unref();

/** Gebyroppsett slik serveren faktisk priser (inkl. admin-overstyringer) — klientens forhåndsvisning må bruke dette (B8). */
export type FeeConfig = { percent: number; flatMinorByCurrency: Record<string, number> };

export async function currentFeeConfig(): Promise<FeeConfig> {
  const overrides = await loadPricingOverrides();
  return {
    percent: overrides.percent ?? SERVICE_FEE_PERCENT,
    flatMinorByCurrency: { ...FLAT_FEE_BY_CURRENCY, ...(overrides.flatByCurrency ?? {}) },
  };
}

export type ServiceStatusWithFees = ServiceStatus & { feeConfig: FeeConfig };

async function serviceStatus(): Promise<ServiceStatusWithFees> {
  const [instant, feeConfig] = await Promise.all([instantBookingEnabled(), currentFeeConfig()]);
  return {
    duffelConfigured: duffelConfig.configured,
    demoMode: !duffelConfig.configured,
    liveMode: duffelConfig.liveMode,
    paymentsConfigured: env.stripeConfigured,
    instantBookingEnabled: instant,
    stripePublishableKey: env.STRIPE_PUBLISHABLE_KEY ?? null,
    feeConfig,
  };
}

export async function resolveOffer(offerId: string): Promise<Offer> {
  // Et Travelport-tilbud kan ikke bookes gjennom Duffel — id-ene tilhører
  // ulike leverandører. Stopp her framfor å sende den videre.
  if (isTravelportOffer(offerId)) {
    throw new AppError("SUPPLIER_REJECTED", {
      message: "Denne avgangen kan ikke bestilles på nett ennå. Kontakt oss, så ordner vi bestillingen for deg.",
    });
  }
  if (duffelConfig.configured) return duffelGetOffer(offerId);
  const offer = demoGetOffer(offerId);
  if (!offer) throw new AppError("OFFER_EXPIRED");
  return offer;
}

export type FlightStatusResult = (FlightStatus & { fetchedAt: string; demo: boolean }) | { unavailable: true; reason: string };

export const flightsRouter = createRouter({
  status: publicQuery.query((): Promise<ServiceStatusWithFees> => serviceStatus()),

  /**
   * Flyplassøk over hele verden. Registeret ligger på serveren fordi det er
   * 454 kB; nettleseren har det kuraterte settet for øyeblikkelige forslag og
   * spør hit for alt annet.
   */
  airports: publicQuery
    .input(z.object({ query: z.string().max(60), limit: z.number().int().min(1).max(20).optional() }))
    .query(({ input }) => searchAirportsWorldwide(input.query, input.limit ?? 12)),

  search: publicQuery.input(searchSchema).mutation(async ({ input, ctx }): Promise<SearchResult> => {
    try {
      assertRateLimit("search", clientIp(ctx.req), 20, 60_000);
      for (const s of input.slices) {
        if (s.origin.toUpperCase() === s.destination.toUpperCase()) {
          throw new AppError("VALIDATION", { message: "Avreise og destinasjon kan ikke være samme flyplass." });
        }
      }
      if (travelportConfig.searchEnabled || duffelConfig.configured) {
        const key = searchCacheKey(input);
        const hit = searchCache.get(key);
        if (hit && Date.now() - hit.at < SEARCH_CACHE_TTL_MS) return hit.result;
        const result = travelportConfig.searchEnabled ? await travelportSearch(input) : await duffelSearch(input);
        searchCache.set(key, { at: Date.now(), result });
        return result;
      }
      await new Promise((r) => setTimeout(r, 600)); // realistisk leverandørlatens i demo
      return demoSearch(input);
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  getOffer: publicQuery.input(z.object({ offerId: z.string().min(1).max(128) })).query(async ({ input }) => {
    try {
      return await resolveOffer(input.offerId);
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  priceHints: publicQuery
    .input(
      z.object({
        origin: z.string().length(3),
        destination: z.string().length(3),
        cabinClass: z.enum(["economy", "premium_economy", "business", "first"]),
        dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(31),
        returnDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(31).optional(),
        passengers: z.array(z.enum(["adult", "child", "infant_without_seat"])).min(1).max(9),
      }),
    )
    .query(({ input }): PriceHint[] => {
      // Live: eksakte dagspriser krever ett tilbudskall per dato — hint kun i demo.
      if (duffelConfig.configured) return input.dates.map((date) => ({ date, amount: null }));
      const paxFactor = demoPaxFactor(input.passengers);
      return input.dates.map((date, i) => ({
        date,
        amount: demoPriceHint(input.origin, input.destination, input.cabinClass, date, paxFactor, input.returnDates?.[i]),
      }));
    }),

  /**
   * Flystatus. Med en leverandørnøkkel satt hentes ekte sanntidsdata; uten
   * nøkkel svarer vi ærlig at det ikke er tilgjengelig (demodata kun utenfor
   * produksjon). Vi viser aldri oppdiktet status som om den var ekte.
   */
  flightStatus: publicQuery
    .input(z.object({ carrier: z.string().length(2), flightNumber: z.string().min(1).max(5), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ input, ctx }): Promise<FlightStatusResult> => {
      assertRateLimit("flightStatus", clientIp(ctx.req), 30, 60_000);

      if (flightStatusConfig.configured) {
        const live = await fetchFlightStatus(input);
        if (live) return { ...live, fetchedAt: new Date().toISOString(), demo: false };
        return {
          unavailable: true,
          reason: "Vi fant ingen status for denne avgangen. Sjekk flynummer og dato, eller se flyselskapets egen side.",
        };
      }

      if (duffelConfig.configured || env.isProdEnv) {
        return { unavailable: true, reason: "Sanntids flystatus er ikke tilgjengelig ennå. Sjekk flyselskapets nettside eller flyplassens tavle." };
      }
      const status = demoFlightStatus(input.carrier, input.flightNumber, input.date);
      if (!status) return { unavailable: true, reason: "Vi kjenner ikke dette flyselskapet." };
      return { ...status, fetchedAt: new Date().toISOString(), demo: true };
    }),

  /** Finn bestilling med referanse + e-post → Order + tilgangstoken til orders.* */
  findBooking: publicQuery
    .input(z.object({ bookingReference: z.string().min(4).max(8), email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      try {
        assertRateLimit("findBooking", clientIp(ctx.req), 10, 10 * 60_000);
        const rows = await getDb()
          .select()
          .from(bookings)
          .where(and(eq(bookings.bookingReference, input.bookingReference.toUpperCase().trim()), eq(bookings.contactEmail, input.email.toLowerCase().trim())))
          .limit(1);
        const b = rows[0];
        if (!b) {
          throw new AppError("NOT_FOUND", { message: "Vi fant ingen bestilling med denne kombinasjonen av referanse og e-post. Sjekk at begge er skrevet riktig." });
        }
        const order = JSON.parse(b.payload) as Order;
        const accessToken = await issueBookingAccessToken(b.id);
        return { order: { ...order, bookingReference: b.bookingReference || order.bookingReference }, orderId: b.orderId, state: b.state, accessToken };
      } catch (err) {
        throw toTRPCError(err);
      }
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
      try {
        assertRateLimit("support", clientIp(ctx.req), 5, 60_000);
        const db = getDb();
        const email = input.email.toLowerCase().trim();
        const ref = input.bookingReference?.toUpperCase().trim() || null;
        // Knytt til booking kun når referanse OG e-post stemmer (ingen lekkasje på referanse alene)
        const [booking] = ref ? await db.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.bookingReference, ref), eq(bookings.contactEmail, email))).limit(1) : [];
        const caseReference = `HS-${Date.now().toString(36).toUpperCase().slice(-6)}`;
        const topicLabel = { booking: "Booking", change: "Endring", refund: "Refusjon", baggage: "Bagasje", other: "Annet" }[input.topic];
        const caseResult = await db.insert(supportCases).values({
          reference: caseReference,
          subject: `${topicLabel}: ${input.message.slice(0, 80)}`,
          customerEmail: email,
          customerName: input.name,
          bookingId: booking?.id ?? null,
          priority: input.topic === "refund" ? "high" : "normal",
          status: "open",
        });
        const caseId = Number(caseResult[0].insertId);
        const result = await db.insert(supportMessages).values({
          caseReference,
          caseId,
          name: input.name,
          email,
          bookingReference: ref,
          topic: input.topic,
          message: input.message,
          authorType: "customer",
        });
        await enqueueJob("send_email", { kind: "support_ack", to: email, locale: "nb", payload: { name: input.name, caseReference } }, { dedupeKey: `support-ack:${caseReference}` }).catch(() => {});
        return { id: Number(result[0].insertId), caseReference, receivedAt: new Date().toISOString() };
      } catch (err) {
        throw toTRPCError(err);
      }
    }),
});
