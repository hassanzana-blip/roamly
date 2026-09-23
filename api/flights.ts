import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { bookings, supportCases, supportMessages } from "../db/schema";
import { env } from "./lib/env";
import { AppError, toTRPCError } from "./lib/errors";
import { duffelConfig, duffelGetOffer } from "./lib/duffel";
import { demoFlightStatus, demoGetOffer } from "./lib/demo";
import { assertRateLimit, clientIp } from "./lib/ratelimit";
import { enqueueJob } from "./lib/jobs";
import { issueBookingAccessToken } from "./lib/bookingAccess";
import { deviceFrom, marketFrom, recordProviderClick, recordSearchEvent } from "./lib/metaTracking";
import { FLAT_FEE_BY_CURRENCY, instantBookingEnabled, loadPricingOverrides, SERVICE_FEE_PERCENT } from "./lib/pricing";
import { searchAirportsWorldwide } from "./lib/airportMeta";
import { isTravelportOffer } from "./lib/travelport";
import { isKayakOffer, kayakAutocomplete, kayakConfig } from "./lib/kayak";
import { flightProvidersStatus, getFlightProvider, type FlightProviderId } from "./lib/flightProviders";
import { fetchFlightStatus, flightStatusConfig } from "./lib/flightStatus";
import type { FlightStatus, Offer, Order, PriceHint, SearchResult, ServiceStatus } from "../contracts/types";
import type { TrpcContext } from "./context";

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

const providerSchema = z.enum(["duffel", "travelport", "kayak", "demo"]);

export const searchSchema = z.object({
  slices: z.array(sliceSchema).min(1).max(3),
  passengers: z.array(passengerSearchSchema).min(1).max(9),
  cabinClass: z.enum(["economy", "premium_economy", "business", "first"]),
  /** Be om en bestemt leverandør (må være valgbar, se flights.status().flightProviders). */
  provider: providerSchema.optional(),
  /** Visningsvaluta for metasøk (KAYAK priser om). ISO 4217. */
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  /** Bare direktefly. */
  directOnly: z.boolean().optional(),
  /** Anonym økt-ID (UUID) fra nettleseren – KAYAKs userTrackId. Aldri knyttet til konto. */
  sessionId: z.string().uuid().optional(),
});

export type SearchInput = z.infer<typeof searchSchema>;

/**
 * Tidligste «i dag» i noen tidssone (UTC−12). Datoen fra klienten er en lokal
 * dato; en reisende i Los Angeles om kvelden velger «i dag» som allerede er
 * «i morgen» i UTC, og en for streng sperre ville avvist den.
 */
function todayIso(): string {
  return new Date(Date.now() - 12 * 60 * 60_000).toISOString().slice(0, 10);
}

// ─── Søkecache (live): 5 min per normalisert input ─────────────────────────
const SEARCH_CACHE_TTL_MS = 5 * 60_000;
const searchCache = new Map<string, { at: number; result: SearchResult }>();

export function searchCacheKey(input: SearchInput, provider: FlightProviderId = "duffel"): string {
  const slices = input.slices.map((s) => `${s.origin.toUpperCase()}-${s.destination.toUpperCase()}@${s.departureDate}`).join("|");
  const pax = [...input.passengers]
    .map((p) => `${p.type}${p.age !== undefined ? `:${p.age}` : ""}`)
    .sort()
    .join(",");
  const extra = provider === "kayak" ? `#${input.currency ?? kayakConfig.defaultCurrency}#${input.directOnly ? "direct" : "all"}` : "";
  return `${provider}#${slices}#${pax}#${input.cabinClass}${extra}`;
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
    flightProviders: flightProvidersStatus(),
  };
}

export async function resolveOffer(offerId: string): Promise<Offer> {
  // Et KAYAK-tilbud bestilles hos leverandøren, aldri i HelloSkys checkout.
  // Lenken til leverandøren ligger på tilbudet i søkeresultatet.
  if (isKayakOffer(offerId)) {
    throw new AppError("SUPPLIER_REJECTED", {
      message: "Dette tilbudet bestilles direkte hos leverandøren, ikke hos HelloSky. Gå tilbake til søket og trykk «Se tilbud».",
    });
  }
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

/**
 * Selve søket: rategrense, validering, leverandørvalg, cache og måling. Delt
 * mellom nettets flights.search og appens NOK-søk (api/mobileFlights.ts), så
 * begge går gjennom nøyaktig samme dør inn til leverandørene.
 */
export async function runFlightSearch(input: SearchInput, ctx: TrpcContext): Promise<SearchResult> {
  assertRateLimit("search", clientIp(ctx.req), 20, 60_000);
  const today = todayIso();
  for (const s of input.slices) {
    if (s.origin.toUpperCase() === s.destination.toUpperCase()) {
      throw new AppError("VALIDATION", { message: "Avreise og destinasjon kan ikke være samme flyplass.", data: { field: "slices" } });
    }
    if (s.departureDate < today) {
      throw new AppError("VALIDATION", { message: "Avreisedatoen er passert. Velg en dato fra og med i dag.", data: { field: "departureDate" } });
    }
  }
  const provider = getFlightProvider(input.provider);
  const request = {
    slices: input.slices,
    passengers: input.passengers,
    cabinClass: input.cabinClass,
    currency: input.currency,
    directOnly: input.directOnly,
    userTrackId: input.sessionId,
    userAgent: ctx.req.headers.get("user-agent") ?? undefined,
    clientIp: clientIp(ctx.req),
  };
  /**
   * Målingen ligger utenfor svaret, med vilje.
   *
   * Den logger søket etter at resultatet er klart, uten `await` i veien
   * for kunden, og en feil i loggingen kan ikke velte søket. Uten denne
   * raden fins ingen tall på hva folk faktisk leter etter – bare på hva
   * de innloggede leter etter, som er en liten og skjev andel.
   *
   * Et cachetreff logges også: kunden gjorde et søk, og det er søket vi
   * teller, ikke leverandørkallet.
   */
  const startedAt = Date.now();
  const first = input.slices[0]!;
  const last = input.slices.length > 1 ? input.slices[input.slices.length - 1] : undefined;
  const paxOf = (type: string) => input.passengers.filter((p) => p.type === type).length;
  const track = (result: SearchResult | null, errorCode: string | null) => {
    // «totalAmount» er en desimalstreng fra leverandøren. Vi regner den om
    // til minste enhet her og aldri til flyttall i databasen.
    const amounts = (result?.offers ?? [])
      .map((o) => Math.round(Number(o.totalAmount) * 100))
      .filter((n) => Number.isFinite(n) && n > 0);
    const lowest = amounts.length ? Math.min(...amounts) : null;
    void recordSearchEvent({
      sessionRef: input.sessionId ?? null,
      originIata: first.origin,
      destinationIata: first.destination,
      departDate: first.departureDate,
      returnDate: last && last.destination === first.origin ? last.departureDate : null,
      adults: Math.max(1, paxOf("adult")),
      children: paxOf("child"),
      infants: paxOf("infant_without_seat"),
      cabin: input.cabinClass,
      provider: provider.id,
      resultCount: result?.offers?.length ?? 0,
      lowestPriceMinor: lowest,
      currency: result?.offers?.[0]?.totalCurrency ?? input.currency ?? null,
      durationMs: Date.now() - startedAt,
      errorCode,
      device: deviceFrom(ctx.req.headers.get("user-agent") ?? undefined),
      market: marketFrom(ctx.req.headers),
      sandbox: result?.sandbox === true || provider.sandbox,
    });
  };

  try {
    if (!provider.cacheable) {
      const fresh = await provider.search(request);
      track(fresh, null);
      return fresh;
    }
    const key = searchCacheKey(input, provider.id);
    const hit = searchCache.get(key);
    if (hit && Date.now() - hit.at < SEARCH_CACHE_TTL_MS) {
      track(hit.result, null);
      return hit.result;
    }
    const result = await provider.search(request);
    // Delvise svar (leverandøren rakk ikke å bli ferdig) caches ikke – neste søk får en ny sjanse.
    if (!result.partial) searchCache.set(key, { at: Date.now(), result });
    track(result, null);
    return result;
  } catch (searchErr) {
    // Et feilet søk er det mest interessante søket: det er der dekningen
    // mangler. Det skal måles, ikke forsvinne.
    track(null, searchErr instanceof AppError ? searchErr.code : "UNKNOWN");
    throw searchErr;
  }
}

export type FlightStatusResult = (FlightStatus & { fetchedAt: string; demo: boolean }) | { unavailable: true; reason: string };

/**
 * Flyplassøk over hele verden. Registeret ligger på serveren fordi det er
 * 454 kB; nettleseren har det kuraterte settet for øyeblikkelige forslag og
 * spør hit for alt annet. Brukes også av appen (api/mobileFlights.ts).
 */
export const airportsProcedure = publicQuery
  .input(z.object({ query: z.string().max(60), limit: z.number().int().min(1).max(20).optional() }))
  .query(async ({ input, ctx }) => {
    const limit = input.limit ?? 12;
    const local = searchAirportsWorldwide(input.query, limit);
    // KAYAKs Autocomplete API fyller på først når registeret vårt kommer til
    // kort – sandkassen tillater bare 100 kall i timen, så den spørres ikke
    // for hvert tastetrykk.
    if (!kayakConfig.enabled || local.length >= 3 || input.query.trim().length < 3) return local;
    const extra = await kayakAutocomplete(input.query, { userAgent: ctx.req.headers.get("user-agent") ?? undefined, clientIp: clientIp(ctx.req) });
    const seen = new Set(local.map((a) => a.iata));
    return [...local, ...extra.filter((a) => !seen.has(a.iata))].slice(0, limit);
  });

export const flightsRouter = createRouter({
  status: publicQuery.query((): Promise<ServiceStatusWithFees> => serviceStatus()),

  /**
   * Flyplassøk over hele verden. Registeret ligger på serveren fordi det er
   * 454 kB; nettleseren har det kuraterte settet for øyeblikkelige forslag og
   * spør hit for alt annet.
   */
  airports: airportsProcedure,

  search: publicQuery.input(searchSchema).mutation(async ({ input, ctx }): Promise<SearchResult> => {
    try {
      return await runFlightSearch(input, ctx);
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  /**
   * Klikket ut av HelloSky.
   *
   * Kalles i det kunden går videre til leverandøren. Den er bevisst mager:
   * klienten sender bare tilbuds-id-en og søkeøkten, og serveren slår opp
   * resten selv. Alternativet – å la nettleseren sende rute, pris og
   * leverandør – ville gjort forretningstallene til noe hvem som helst kan
   * skrive inn.
   *
   * Svaret er en referanse leverandøren senere kan matche en konvertering
   * mot. Feiler alt, svarer vi likevel: lenken skal åpne uansett.
   */
  trackProviderClick: publicQuery
    .input(z.object({ offerId: z.string().min(1).max(128), sessionId: z.string().max(64).optional() }))
    .mutation(async ({ input, ctx }): Promise<{ clickRef: string | null }> => {
      try {
        const offer = await resolveOffer(input.offerId);
        const first = offer.slices[0]!;
        const last = offer.slices.length > 1 ? offer.slices[offer.slices.length - 1] : undefined;
        const paxOf = (type: string) => offer.passengers.filter((p) => p.type === type).length;
        const amount = Math.round(Number(offer.totalAmount) * 100);
        // Sandkassestatus hører til leverandøren, ikke til tilbudet. Et klikk
        // på et testtilbud skal aldri telle som forretning.
        const source = offer.source ?? "unknown";
        let sandbox = false;
        try {
          sandbox = getFlightProvider(offer.source).sandbox;
        } catch {
          sandbox = true; // ukjent opphav teller ikke som ekte
        }
        const clickRef = await recordProviderClick({
          customerId: ctx.customer?.customerId ?? null,
          sessionRef: input.sessionId ?? null,
          provider: source,
          sellerName: offer.booking?.provider?.name ?? offer.owner.name,
          originIata: first.origin.iata,
          destinationIata: first.destination.iata,
          departDate: first.departingAt.slice(0, 10),
          returnDate: last && last.destination.iata === first.origin.iata ? last.departingAt.slice(0, 10) : null,
          adults: Math.max(1, paxOf("adult")),
          children: paxOf("child"),
          infants: paxOf("infant_without_seat"),
          cabin: first.segments[0]?.cabinClass ?? "economy",
          carrierIata: offer.owner.iata,
          stops: first.stops,
          shownPriceMinor: Number.isFinite(amount) && amount > 0 ? amount : null,
          currency: offer.totalCurrency,
          device: deviceFrom(ctx.req.headers.get("user-agent") ?? undefined),
          market: marketFrom(ctx.req.headers),
          sandbox,
        });
        return { clickRef };
      } catch {
        // Måling er aldri viktigere enn at kunden kommer videre.
        return { clickRef: null };
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
      // Ingen leverandør gir oss dagspriser uten ett tilbudskall per dato, og vi
      // dikter ikke opp «fra»-priser: uten en ekte kilde er svaret null for alle
      // datoer, og klientene viser «Søk» i stedet for et tall.
      return input.dates.map((date) => ({ date, amount: null }));
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
