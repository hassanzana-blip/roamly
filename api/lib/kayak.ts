import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AppError } from "./errors";
import { env } from "./env";
import { log } from "./logger";
import { airportMetaByIata } from "./airportMeta";
import { currencyExponent } from "./money";
import type { Airport } from "@contracts/airports";
import type {
  AirportPoint,
  BaggageAllowance,
  CabinClass,
  Carrier,
  ExternalBooking,
  Offer,
  OfferConditions,
  OfferSlice,
  SearchPassengerInput,
  SearchResult,
  SearchSliceInput,
  Segment,
  SellerKind,
} from "@contracts/types";

/**
 * KAYAK Affiliate Network – Flights Search API og Autocomplete API.
 *
 * Kilden er KAYAKs egen dokumentasjon (developers.kayak.com, «Getting
 * Started», «Flights Search API», «Autocomplete API»). Alt her – endepunkter,
 * parametre, feltnavn, statusflyt og feilkoder – er tatt derfra; ingenting er
 * gjettet. Feltnavn vi ikke finner i svaret utelates i stedet for å antas.
 *
 *  - Autentisering: `apiKey` som spørreparameter (ikke header).
 *  - Sandbox: https://sandbox-en-us.kayakaffiliates.com. Kun det amerikanske
 *    markedet, mockede priser, syntetiske klikksider, 250 flysøk/time og
 *    100 autocomplete-kall/time. Nøklene varer 3 måneder.
 *  - Søk: POST /i/api/affiliate/search/flight/v1/poll starter et søk og
 *    returnerer `searchId` + `cluster`; deretter polles samme endepunkt med
 *    `cluster` i URL-en til `status` er «complete» («first-phase» → «second-phase»
 *    → «complete»).
 *  - Søke-API-ene krever `userTrackId` (UUID per sluttbruker per økt),
 *    `User-Agent` fra den faktiske klienten og `x-original-client-ip`.
 *  - Bestilling skjer HOS LEVERANDØREN: hvert bookingalternativ har en
 *    `bookingUrl` som brukes urørt. HelloSky utsteder ingen billett og legger
 *    ikke på servicegebyr.
 *
 * Hemmeligheter logges aldri: URL-er logges uten spørrestreng, og KAYAKs egne
 * feilmeldinger (som kan sitere nøkkelen) renses før de når loggen.
 */

export const KAYAK_OFFER_PREFIX = "kyk_";
export const KAYAK_SANDBOX_BASE_URL = "https://sandbox-en-us.kayakaffiliates.com";
const FLIGHTS_POLL_PATH = "/i/api/affiliate/search/flight/v1/poll";
const AUTOCOMPLETE_FLIGHTS_PATH = "/api/affiliate/autocomplete/v1/flights";

/** Så lenge vi anser et KAYAK-svar som gyldig å vise før kunden bør søke igjen. Ingen prisgaranti – den gis hos leverandøren. */
export const KAYAK_RESULT_TTL_MS = 20 * 60_000;
/** Per HTTP-kall. */
const REQUEST_TIMEOUT_MS = 12_000;
/** Samlet tid vi er villige til å polle før vi svarer med det vi har. */
const DEFAULT_POLL_BUDGET_MS = 22_000;
/** Etter dette svarer vi så snart søket er i «second-phase» (de viktigste leverandørene er inne). */
const SECOND_PHASE_GOOD_ENOUGH_MS = 9_000;
const POLL_INTERVAL_MS = 1_200;
const MAX_OFFERS = 80;
const PAGE_SIZE = 60;

export const kayakConfig = {
  get mode(): "sandbox" | "production" {
    return env.KAYAK_API_MODE;
  },
  get sandbox(): boolean {
    return env.KAYAK_API_MODE === "sandbox";
  },
  /** Sandbox har dokumentert standard-URL; produksjonsdomenet kommer med produksjonsnøkkelen. */
  get baseUrl(): string {
    const url = env.KAYAK_BASE_URL ?? (kayakConfig.sandbox ? KAYAK_SANDBOX_BASE_URL : "");
    return url.replace(/\/$/, "");
  },
  get configured(): boolean {
    return env.kayakConfigured;
  },
  /** Slått på med KAYAK_FLIGHTS_ENABLED=true, nøkkel for aktiv modus og en base-URL. */
  get enabled(): boolean {
    return env.kayakEnabled && kayakConfig.baseUrl.length > 0;
  },
  /** Sandkassepriser er aldri «live». */
  get liveMode(): boolean {
    return !kayakConfig.sandbox;
  },
  get defaultCurrency(): string {
    return env.KAYAK_DEFAULT_CURRENCY;
  },
  get airlineDirectMode(): "off" | "prefer" | "only" {
    return env.airlineDirectMode;
  },
};

export class KayakError extends AppError {
  constructor(message: string, opts: { status?: number; retryable?: boolean; timeout?: boolean; kayakCode?: string } = {}) {
    const retryable = opts.retryable ?? false;
    super(opts.timeout ? "SUPPLIER_TIMEOUT" : retryable ? "SUPPLIER_UNAVAILABLE" : "SUPPLIER_REJECTED", {
      message,
      retryable,
      data: { supplier: "kayak", status: opts.status, kayakCode: opts.kayakCode },
    });
  }
}

// ─── HTTP ────────────────────────────────────────────────────────────────────

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
let fetchOverride: FetchLike | null = null;

/** Kun for tester. */
export function setKayakFetch(fn: FetchLike | null): void {
  fetchOverride = fn;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** userTrackId må være en UUID per sluttbruker (dokumentert). Ugyldig verdi → ny UUID, aldri en konstant. */
export function normalizeUserTrackId(value?: string | null): string {
  return value && UUID_RE.test(value) ? value.toLowerCase() : randomUUID();
}

/** Fjerner nøkkelen (og alt som ser ut som en) før noe fra KAYAK når loggen. */
export function scrubSecret(text: string): string {
  let out = text;
  const key = env.kayakApiKey;
  if (key) out = out.split(key).join("[redacted]");
  return out.replace(/apiKey=[^&\s]+/gi, "apiKey=[redacted]").slice(0, 300);
}

type KayakRequest = {
  method: "GET" | "POST";
  path: string;
  query: Record<string, string | undefined>;
  body?: unknown;
  /** Videresendt fra kundens nettleser (dokumentert krav). */
  userAgent?: string;
  clientIp?: string;
  cookies?: string[];
  signal?: AbortSignal;
};

type KayakResponse = { status: number; json: unknown; setCookies: string[] };

/**
 * Ett kall mot KAYAK. Nøkkelen legges på her og bare her. Timeout per kall,
 * ingen logging av spørrestreng, og feilkropper leses kun for kode/status.
 */
async function kayakRequest(req: KayakRequest): Promise<KayakResponse> {
  if (!kayakConfig.enabled) throw new KayakError("KAYAK-søk er ikke slått på.");
  const url = new URL(kayakConfig.baseUrl + req.path);
  url.searchParams.set("apiKey", env.kayakApiKey);
  for (const [k, v] of Object.entries(req.query)) if (v !== undefined && v !== "") url.searchParams.set(k, v);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (req.body !== undefined) headers["Content-Type"] = "application/json";
  if (req.userAgent) headers["User-Agent"] = req.userAgent.slice(0, 400);
  if (req.clientIp && req.clientIp !== "local") headers["x-original-client-ip"] = req.clientIp;
  if (req.cookies?.length) headers.Cookie = req.cookies.join("; ");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();
  req.signal?.addEventListener("abort", onOuterAbort, { once: true });
  const started = Date.now();
  let res: Response;
  try {
    res = await (fetchOverride ?? fetch)(url.toString(), {
      method: req.method,
      headers,
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
      signal: controller.signal,
      redirect: "manual",
    });
  } catch (err) {
    const aborted = (err as { name?: string })?.name === "AbortError" || controller.signal.aborted;
    log.warn({ path: req.path, ms: Date.now() - started, aborted }, "KAYAK: nettverksfeil");
    if (aborted) throw new KayakError("Det tok for lang tid å få svar fra søkemotoren. Prøv igjen.", { timeout: true, retryable: true });
    throw new KayakError("Søkemotoren svarer ikke akkurat nå. Prøv igjen om et øyeblikk.", { retryable: true });
  } finally {
    clearTimeout(timer);
    req.signal?.removeEventListener("abort", onOuterAbort);
  }

  const setCookies = readSetCookies(res.headers);
  let json: unknown = null;
  const text = await res.text().catch(() => "");
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  log.info({ path: req.path, status: res.status, ms: Date.now() - started }, "KAYAK: kall");
  if (!res.ok) throw mapHttpError(res.status, json, req.path);
  if (json === null) throw new KayakError("Søkemotoren ga et uleselig svar.", { status: res.status, retryable: true });
  return { status: res.status, json, setCookies };
}

function readSetCookies(headers: Headers): string[] {
  const h = headers as Headers & { getSetCookie?: () => string[] };
  const raw = typeof h.getSetCookie === "function" ? h.getSetCookie() : [headers.get("set-cookie") ?? ""].filter(Boolean);
  // Bare navn=verdi – attributter (Path, Expires …) sendes ikke tilbake.
  return raw.map((c) => c.split(";")[0]?.trim() ?? "").filter(Boolean);
}

/**
 * Dokumenterte feilformer: `PreSearchErrorResponse` {status, errorCode,
 * errorMessage} (nøkkel/domene/headere) og `SearchErrorResponse` {url,
 * errors:[{code, description, localizedDescription}]}. `description` er
 * uttrykkelig ikke ment for sluttbrukere – vi viser våre egne tekster.
 */
export function mapHttpError(status: number, body: unknown, path: string): KayakError {
  let code = "";
  let detail = "";
  if (body && typeof body === "object") {
    const b = body as { errorCode?: unknown; errorMessage?: unknown; errors?: unknown };
    if (typeof b.errorCode === "string") code = b.errorCode;
    if (typeof b.errorMessage === "string") detail = b.errorMessage;
    if (Array.isArray(b.errors) && b.errors[0] && typeof b.errors[0] === "object") {
      const first = b.errors[0] as { code?: unknown; description?: unknown };
      if (typeof first.code === "string") code = first.code;
      if (typeof first.description === "string") detail = first.description;
    }
  }
  const safe = { status, code: code.slice(0, 60), detail: scrubSecret(detail), path };
  if (status === 401 || status === 403) {
    log.error(safe, "KAYAK: avvist (nøkkel/domene/headere) – sjekk KAYAK_*-konfigurasjon");
    return new KayakError("Flysøk via KAYAK er ikke tilgjengelig akkurat nå.", { status, kayakCode: code });
  }
  if (status === 429) {
    log.warn(safe, "KAYAK: rate limit");
    return new KayakError("Søkemotoren er opptatt akkurat nå. Prøv igjen om et øyeblikk.", { status, retryable: true, kayakCode: code });
  }
  if (status >= 500) {
    log.warn(safe, "KAYAK: serverfeil");
    return new KayakError("Søkemotoren svarer ikke akkurat nå. Prøv igjen om et øyeblikk.", { status, retryable: true, kayakCode: code });
  }
  log.warn(safe, "KAYAK: forespørsel avvist");
  return new KayakError("Søket kunne ikke utføres med disse valgene. Sjekk flyplasser og datoer.", { status, kayakCode: code });
}

// ─── Forespørsel (dokumentert skjema) ────────────────────────────────────────

export type KayakSearchInput = {
  slices: SearchSliceInput[];
  passengers: SearchPassengerInput[];
  cabinClass: CabinClass;
  /** ISO 4217. Standard: KAYAK_DEFAULT_CURRENCY (NOK). */
  currency?: string;
  /** maxStops=0 – bare direktefly. */
  directOnly?: boolean;
  /** KAYAK userTrackId – UUID per sluttbruker per økt. */
  userTrackId?: string;
  userAgent?: string;
  clientIp?: string;
};

const CABIN_TO_KAYAK: Record<CabinClass, string> = {
  economy: "economy",
  premium_economy: "premiumEconomy",
  business: "business",
  first: "first",
};

const KAYAK_TO_CABIN: Record<string, CabinClass> = {
  economy: "economy",
  premiumEconomy: "premium_economy",
  business: "business",
  first: "first",
};

/**
 * PassengerType: ADT 18–64, SNR 65+, YTH 12–17, CHD 2–11, INS/INL under 2.
 * HelloSkys «barn» kan være 2–17 – alderen avgjør CHD eller YTH. Spedbarn på
 * fanget er INL. Uten alder antas CHD (HelloSkys standardalder er 8).
 */
export function passengerCode(p: SearchPassengerInput): "ADT" | "YTH" | "CHD" | "INL" {
  if (p.type === "adult") return "ADT";
  if (p.type === "infant_without_seat") return "INL";
  if (typeof p.age === "number" && p.age >= 12) return "YTH";
  return "CHD";
}

/** Bygger PollRequest for et nytt søk (searchId utelatt). Ren funksjon – lett å teste. */
export function buildSearchStart(input: KayakSearchInput): Record<string, unknown> {
  const resultParameters: Record<string, unknown> = {
    currency: (input.currency ?? kayakConfig.defaultCurrency).toUpperCase(),
    priceMode: "total",
    pageNumber: 1,
    pageSize: PAGE_SIZE,
    sort: { key: "price", direction: "asc" },
  };
  if (input.directOnly) resultParameters.maxStops = 0;
  return {
    searchStartParameters: {
      cabin: CABIN_TO_KAYAK[input.cabinClass],
      passengers: input.passengers.map(passengerCode),
      legs: input.slices.map((s) => ({
        origin: { locationType: "airports", airports: [s.origin.toUpperCase()] },
        destination: { locationType: "airports", airports: [s.destination.toUpperCase()] },
        date: s.departureDate,
        flex: "exact",
      })),
    },
    resultParameters,
  };
}

// ─── Svar (dokumentert skjema, lest tolerant) ───────────────────────────────

const priceSchema = z.object({ price: z.number(), displayPrice: z.string().optional() });
const bagFeeSchema = z.object({
  bagNumber: z.string().optional(),
  restriction: z.string().optional(),
  displayPrice: priceSchema.optional(),
});
const bookingOptionSchema = z.object({
  type: z.string().optional(),
  bookingUrl: z.string().optional(),
  providerCode: z.string().optional(),
  displayPrice: priceSchema.optional(),
  segmentFares: z
    .array(z.object({ segmentId: z.string(), cabin: z.object({ code: z.string().optional() }).optional(), isSelfTransfer: z.boolean().optional() }))
    .optional(),
  fareFamilies: z
    .array(
      z.object({
        id: z.string().optional(),
        displayName: z.string().optional(),
        amenities: z.array(z.object({ code: z.string(), restriction: z.string(), displayName: z.string().optional() })).optional(),
      }),
    )
    .optional(),
  badges: z.array(z.object({ code: z.string(), displayName: z.string().optional() })).optional(),
  fees: z
    .object({
      basePrice: priceSchema.optional(),
      totalPrice: priceSchema.optional(),
      carryOnBag: z.array(bagFeeSchema).optional(),
      checkedBag: z.array(bagFeeSchema).optional(),
      nonRefundableDisclosure: z.string().optional(),
    })
    .optional(),
});
const resultItemSchema = z.object({
  id: z.string(),
  bookingOptions: z.array(bookingOptionSchema).default([]),
  legs: z.array(z.object({ id: z.string() })).default([]),
});
const legSchema = z.object({
  duration: z.number(),
  segments: z.array(z.object({ id: z.string(), layover: z.object({ duration: z.number() }).optional() })),
  arrivalTime: z.string(),
  departureTime: z.string(),
});
const segmentSchema = z.object({
  airline: z.string(),
  flightNumber: z.string().default(""),
  operationalDisplay: z.string().optional(),
  operationalIATA: z.string().optional(),
  origin: z.string(),
  destination: z.string(),
  arrivalTime: z.string(),
  departureTime: z.string(),
  equipmentTypeName: z.string().optional(),
  duration: z.number(),
  type: z.string().optional(),
});
const airlineSchema = z.object({ logoUrl: z.string().optional(), displayName: z.string().optional(), airlineFeeUrl: z.string().optional() });
const airportSchema = z.object({ displayName: z.string().optional(), cityName: z.string().optional() });
const providerSchema = z.object({
  displayName: z.string().optional(),
  logoUrls: z.object({ imageUrl: z.string().optional(), horizontalImageUrl: z.string().optional() }).optional(),
});

export const pollResponseSchema = z.object({
  searchId: z.string(),
  cluster: z.string().optional(),
  status: z.string(),
  totalCount: z.number().optional(),
  currency: z.string().optional(),
  priceMode: z.string().optional(),
  results: z.array(resultItemSchema).default([]),
  legs: z.record(z.string(), legSchema).default({}),
  segments: z.record(z.string(), segmentSchema).default({}),
  airlines: z.record(z.string(), airlineSchema).default({}),
  airports: z.record(z.string(), airportSchema).default({}),
  providers: z.record(z.string(), providerSchema).default({}),
});
export type KayakPollResponse = z.infer<typeof pollResponseSchema>;

export function parsePollResponse(json: unknown): KayakPollResponse {
  const parsed = pollResponseSchema.safeParse(json);
  if (!parsed.success) {
    log.warn({ issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) }, "KAYAK: svaret mangler dokumenterte felter");
    throw new KayakError("Søkemotoren ga et svar vi ikke kunne lese.", { retryable: true });
  }
  return parsed.data;
}

// ─── Kartlegging til HelloSkys Offer ─────────────────────────────────────────

function amountString(value: number, currency: string): string {
  const exp = Math.min(currencyExponent(currency), 3);
  return value.toFixed(exp);
}

function point(code: string, airports: KayakPollResponse["airports"]): AirportPoint {
  const iata = code.toUpperCase();
  const known = airports[code] ?? airports[iata];
  const meta = airportMetaByIata(iata);
  return {
    iata,
    name: known?.displayName ?? meta?.name ?? iata,
    city: known?.cityName ?? meta?.city ?? iata,
    country: meta?.country ?? "",
    lat: meta?.lat ?? 0,
    lng: meta?.lng ?? 0,
    ...(meta?.timeZone ? { timeZone: meta.timeZone } : {}),
  };
}

function carrierOf(code: string, airlines: KayakPollResponse["airlines"]): Carrier {
  const a = airlines[code];
  return { iata: code, name: a?.displayName ?? code, ...(a?.logoUrl ? { logoUrl: a.logoUrl } : {}) };
}

type BookingOption = z.infer<typeof bookingOptionSchema>;

/** «included»/«flexible» = 1 kolli inkludert; «fee»/«unavailable» = 0; mangler = ukjent (vi påstår ikke). */
function bagsFrom(fees: BookingOption["fees"], families: BookingOption["fareFamilies"], kind: "carryOn" | "checked"): { count: number; unknown: boolean; fee?: string } {
  const list = kind === "carryOn" ? fees?.carryOnBag : fees?.checkedBag;
  const first = list?.find((b) => b.bagNumber === "first") ?? list?.[0];
  if (first?.restriction) {
    const included = first.restriction === "included" || first.restriction === "flexible";
    const fee = first.restriction === "fee" ? first.displayPrice?.displayPrice : undefined;
    return { count: included ? 1 : 0, unknown: false, ...(fee ? { fee } : {}) };
  }
  const code = kind === "carryOn" ? "carryOnBag" : "checkedBag";
  const amenity = families?.flatMap((f) => f.amenities ?? []).find((a) => a.code === code);
  if (amenity) return { count: amenity.restriction === "included" || amenity.restriction === "flexible" ? 1 : 0, unknown: false };
  return { count: 0, unknown: true };
}

function amenity(families: BookingOption["fareFamilies"], code: string): string | undefined {
  return families?.flatMap((f) => f.amenities ?? []).find((a) => a.code === code)?.restriction;
}

/**
 * Hvem selger? KAYAK dokumenterer ikke et eget felt for «flyselskapet direkte»
 * vs. reisebyrå. Det dokumenterte eksempelet viser at flyselskapets eget
 * salg har `providerCode` lik flyselskapets IATA-kode (B6/JetBlue) mens
 * byråer har egne koder (SKYPICKER/Kiwi.com). Vi bruker derfor bare det
 * svaret selv sier: er leverandørkoden ett av itinerarets markedsførende
 * flyselskap, er selgeren flyselskapet. Alt annet med kjent leverandørnavn
 * regnes som byrå; ukjent leverandør er «unknown». Dette er en kartlegging
 * av dokumenterte felter, ikke en gjettet svarteliste.
 */
export function classifySeller(providerCode: string, itineraryAirlines: Set<string>, providers: KayakPollResponse["providers"]): SellerKind {
  const code = providerCode.toUpperCase();
  if (itineraryAirlines.has(code)) return "airline";
  if (providers[providerCode]?.displayName) return "agency";
  return "unknown";
}

export type MapContext = { searchId: string; expiresAt: string; sandbox: boolean };

export function mapPollResponse(body: KayakPollResponse, input: KayakSearchInput, ctx: MapContext): Offer[] {
  const currency = (body.currency ?? input.currency ?? kayakConfig.defaultCurrency).toUpperCase();
  const offers: Offer[] = [];
  const passengers = input.passengers.map((p, i) => ({ id: `pax_${i + 1}`, type: p.type, ...(p.age !== undefined ? { age: p.age } : {}) }));

  for (const result of body.results) {
    const legs = result.legs.map((l) => ({ id: l.id, leg: body.legs[l.id] }));
    if (!legs.length || legs.some((l) => !l.leg)) continue;

    result.bookingOptions.forEach((bo, index) => {
      // Kun «regular»: hacker fares (split) krever flere separate bestillinger og bes ikke om.
      if ((bo.type ?? "regular") !== "regular" || !bo.bookingUrl || !bo.providerCode) return;
      const total = bo.fees?.totalPrice?.price ?? bo.displayPrice?.price;
      if (typeof total !== "number" || !(total > 0)) return; // -1 = kun rutetid, ingen pris
      if (!isAcceptableBookingUrl(bo.bookingUrl)) return;

      const cabinBySegment = new Map((bo.segmentFares ?? []).map((sf) => [sf.segmentId, sf.cabin?.code]));
      const itineraryAirlines = new Set<string>();
      const offerId = `${KAYAK_OFFER_PREFIX}${ctx.searchId}.${result.id}.${index}`;

      let malformed = false;
      const slices: OfferSlice[] = legs.map(({ id: legId, leg }, li) => {
        const segments: Segment[] = [];
        for (const ls of leg!.segments) {
          const seg = body.segments[ls.id];
          if (!seg) {
            malformed = true;
            break;
          }
          itineraryAirlines.add(seg.airline.toUpperCase());
          const carrier = carrierOf(seg.airline, body.airlines);
          // operationalDisplay skal vises når operatøren er en annen enn det
          // markedsførende selskapet. Sandkassen sender den også når de er like –
          // da er «Operert av Norwegian» på en Norwegian-flygning bare støy.
          const operatingText = seg.operationalDisplay?.trim();
          const operating = seg.operationalIATA
            ? seg.operationalIATA.toUpperCase() === seg.airline.toUpperCase()
              ? undefined
              : carrierOf(seg.operationalIATA, body.airlines)
            : operatingText && operatingText.toLowerCase() !== carrier.name.toLowerCase()
              ? { iata: "", name: operatingText }
              : undefined;
          const cabinCode = cabinBySegment.get(ls.id);
          segments.push({
            id: `${offerId}.${ls.id}`,
            origin: point(seg.origin, body.airports),
            destination: point(seg.destination, body.airports),
            departingAt: seg.departureTime,
            arrivingAt: seg.arrivalTime,
            durationMinutes: seg.duration,
            carrier,
            ...(operating ? { operatingCarrier: operating } : {}),
            flightNumber: seg.flightNumber,
            aircraft: seg.equipmentTypeName ?? (seg.type === "train" ? "Tog" : seg.type === "bus" ? "Buss" : ""),
            cabinClass: (cabinCode && KAYAK_TO_CABIN[cabinCode]) || input.cabinClass,
          });
        }
        const first = segments[0];
        const last = segments[segments.length - 1];
        return {
          id: `${offerId}.L${li}.${legId}`,
          origin: first?.origin ?? point("", body.airports),
          destination: last?.destination ?? point("", body.airports),
          departingAt: leg!.departureTime,
          arrivingAt: leg!.arrivalTime,
          durationMinutes: leg!.duration,
          stops: Math.max(0, segments.length - 1),
          segments,
        };
      });
      if (malformed || slices.some((s) => s.segments.length === 0)) return;

      const carryOn = bagsFrom(bo.fees, bo.fareFamilies, "carryOn");
      const checked = bagsFrom(bo.fees, bo.fareFamilies, "checked");
      const baggage: BaggageAllowance = {
        carryOnBags: carryOn.count,
        checkedBags: checked.count,
        ...(carryOn.unknown ? { carryOnUnknown: true } : {}),
        ...(checked.unknown ? { checkedUnknown: true } : {}),
      };
      const refundAmenity = amenity(bo.fareFamilies, "refundable");
      const changeAmenity = amenity(bo.fareFamilies, "change");
      const badges = (bo.badges ?? []).map((b) => b.code);
      const refundable = refundAmenity === "included" || refundAmenity === "flexible" || badges.includes("freeCancellation");
      const changeable = changeAmenity === "included" || changeAmenity === "flexible";
      const conditions: OfferConditions | undefined =
        refundAmenity || changeAmenity
          ? {
              ...(refundAmenity ? { refundBeforeDeparture: { allowed: refundable } } : {}),
              ...(changeAmenity ? { changeBeforeDeparture: { allowed: changeable } } : {}),
            }
          : undefined;

      const base = bo.fees?.basePrice?.price;
      const totalAmount = amountString(total, currency);
      const baseAmount = typeof base === "number" && base > 0 && base <= total ? amountString(base, currency) : totalAmount;
      const taxAmount = typeof base === "number" && base > 0 && base <= total ? amountString(total - base, currency) : amountString(0, currency);

      const provider = body.providers[bo.providerCode];
      const booking: ExternalBooking = {
        kind: "external",
        url: bo.bookingUrl,
        provider: {
          code: bo.providerCode,
          name: provider?.displayName ?? bo.providerCode,
          ...(provider?.logoUrls?.imageUrl ? { logoUrl: provider.logoUrls.imageUrl } : {}),
        },
        sellerKind: classifySeller(bo.providerCode, itineraryAirlines, body.providers),
        ...(badges.length ? { badges } : {}),
        ...(bo.fees?.nonRefundableDisclosure ? { disclosure: bo.fees.nonRefundableDisclosure } : {}),
      };

      const owner = slices[0].segments[0].carrier;
      offers.push({
        id: offerId,
        totalAmount,
        totalCurrency: currency,
        baseAmount,
        taxAmount,
        owner,
        expiresAt: ctx.expiresAt,
        cabinClass: input.cabinClass,
        slices,
        passengers,
        baggage,
        refundable,
        changeable,
        ...(conditions ? { conditions } : {}),
        source: "kayak",
        booking,
        ...(carryOn.fee || checked.fee ? { baggageFees: { ...(carryOn.fee ? { carryOn: carryOn.fee } : {}), ...(checked.fee ? { checked: checked.fee } : {}) } } : {}),
      });
    });
  }

  return applyAirlineDirect(offers, kayakConfig.airlineDirectMode).slice(0, MAX_OFFERS);
}

/** Klikklenker skal være https. Utenfor produksjon godtas en lokal stub (http://127.0.0.1 / localhost) for ende-til-ende-test. */
export function isAcceptableBookingUrl(url: string): boolean {
  if (/^https:\/\//i.test(url)) return true;
  return !env.isProdEnv && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(url);
}

/** prefer: flyselskapet først, ellers uendret prisrekkefølge. only: bare flyselskapet. off: som levert. */
export function applyAirlineDirect(offers: Offer[], mode: "off" | "prefer" | "only"): Offer[] {
  const sorted = [...offers].sort((a, b) => Number(a.totalAmount) - Number(b.totalAmount));
  if (mode === "off") return sorted;
  const direct = sorted.filter((o) => o.booking?.sellerKind === "airline");
  if (mode === "only") return direct;
  const rest = sorted.filter((o) => o.booking?.sellerKind !== "airline");
  return [...direct, ...rest];
}

export function isKayakOffer(offerId: string): boolean {
  return offerId.startsWith(KAYAK_OFFER_PREFIX);
}

// ─── Søk med polling ─────────────────────────────────────────────────────────

export type KayakSearchOptions = {
  budgetMs?: number;
  pollIntervalMs?: number;
  signal?: AbortSignal;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Starter søket og poller til «complete» eller til tidsbudsjettet er brukt.
 * Hvert poll-svar er et komplett øyeblikksbilde (side 1 sortert på pris), så
 * det nyeste svaret vinner. Feiler et poll etter at vi har et brukbart
 * øyeblikksbilde, svarer vi med det vi har og merker svaret som delvis.
 */
export async function kayakSearch(input: KayakSearchInput, opts: KayakSearchOptions = {}): Promise<SearchResult> {
  if (!kayakConfig.enabled) throw new KayakError("KAYAK-søk er ikke slått på.");
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? defaultSleep;
  const budget = opts.budgetMs ?? DEFAULT_POLL_BUDGET_MS;
  const interval = opts.pollIntervalMs ?? POLL_INTERVAL_MS;
  const userTrackId = normalizeUserTrackId(input.userTrackId);
  const startedAt = now();

  const common = { userAgent: input.userAgent, clientIp: input.clientIp, signal: opts.signal };
  const start = await kayakRequest({ method: "POST", path: FLIGHTS_POLL_PATH, query: { userTrackId }, body: buildSearchStart(input), ...common });
  let snapshot = parsePollResponse(start.json);
  const cookies = start.setCookies;
  let partial = false;
  let polls = 0;

  while (snapshot.status !== "complete") {
    const elapsed = now() - startedAt;
    if (elapsed >= budget || (snapshot.status === "second-phase" && elapsed >= SECOND_PHASE_GOOD_ENOUGH_MS)) {
      partial = true;
      break;
    }
    if (opts.signal?.aborted) {
      partial = true;
      break;
    }
    await sleep(interval);
    try {
      const res = await kayakRequest({
        method: "POST",
        path: FLIGHTS_POLL_PATH,
        query: { userTrackId, cluster: snapshot.cluster },
        body: { searchId: snapshot.searchId, resultParameters: (buildSearchStart(input) as { resultParameters: unknown }).resultParameters },
        cookies,
        ...common,
      });
      snapshot = parsePollResponse(res.json);
      polls += 1;
    } catch (err) {
      // Har vi allerede resultater, er et feilet poll ikke verdt en feilside.
      if (snapshot.results.length > 0 && err instanceof KayakError && err.retryable) {
        partial = true;
        break;
      }
      throw err;
    }
  }

  const expiresAt = new Date(now() + KAYAK_RESULT_TTL_MS).toISOString();
  const offers = mapPollResponse(snapshot, input, { searchId: snapshot.searchId, expiresAt, sandbox: kayakConfig.sandbox });
  log.info(
    { searchId: snapshot.searchId, status: snapshot.status, polls, ms: now() - startedAt, results: snapshot.results.length, offers: offers.length, partial, sandbox: kayakConfig.sandbox },
    "KAYAK: søk ferdig",
  );
  return {
    offerRequestId: `${KAYAK_OFFER_PREFIX}${snapshot.searchId}`,
    liveMode: kayakConfig.liveMode,
    demoMode: false,
    cabinClass: input.cabinClass,
    slices: input.slices,
    passengers: input.passengers,
    offers,
    provider: "kayak",
    sandbox: kayakConfig.sandbox,
    bookingMode: "external",
    ...(partial ? { partial: true } : {}),
  };
}

// ─── Autocomplete (steder) ───────────────────────────────────────────────────

const autocompleteSchema = z.object({
  results: z
    .array(
      z.object({
        placeId: z.number().optional(),
        primaryPlaceType: z.string().optional(),
        name: z.string(),
        fullName: z.string().optional(),
        countryName: z.string().optional(),
        cityName: z.string().optional(),
        iataCode: z.string().optional(),
        isMetro: z.boolean().optional(),
      }),
    )
    .default([]),
});

const AUTOCOMPLETE_TTL_MS = 24 * 60 * 60_000;
const AUTOCOMPLETE_CACHE_MAX = 2_000;
const autocompleteCache = new Map<string, { at: number; airports: Airport[] }>();
/** Sandbox tillater 100 kall/time. Vi holder oss under selv om noen hamrer på feltet. */
const AUTOCOMPLETE_HOURLY_LIMIT = 80;
let autocompleteWindow = { start: 0, count: 0 };

/** Kun for tester. */
export function resetKayakAutocompleteState(): void {
  autocompleteCache.clear();
  autocompleteWindow = { start: 0, count: 0 };
}

function autocompleteAllowed(now: number): boolean {
  if (now - autocompleteWindow.start >= 60 * 60_000) autocompleteWindow = { start: now, count: 0 };
  if (autocompleteWindow.count >= AUTOCOMPLETE_HOURLY_LIMIT) return false;
  autocompleteWindow.count += 1;
  return true;
}

/**
 * GET /api/affiliate/autocomplete/v1/flights?apiKey&searchTerm (maks 6 treff).
 * Bare treff med IATA-kode blir til flyplasser HelloSky kan søke på.
 * Svarene caches et døgn per søkeord; ved feil eller nådd grense svarer vi
 * tomt, aldri med en feilside – det lokale registeret står uansett.
 */
export async function kayakAutocomplete(searchTerm: string, opts: { userAgent?: string; clientIp?: string; now?: () => number } = {}): Promise<Airport[]> {
  const term = searchTerm.trim().toLowerCase().slice(0, 60);
  if (!kayakConfig.enabled || term.length < 2) return [];
  const now = (opts.now ?? Date.now)();
  const hit = autocompleteCache.get(term);
  if (hit && now - hit.at < AUTOCOMPLETE_TTL_MS) return hit.airports;
  if (!autocompleteAllowed(now)) return [];
  try {
    const res = await kayakRequest({ method: "GET", path: AUTOCOMPLETE_FLIGHTS_PATH, query: { searchTerm: term }, userAgent: opts.userAgent, clientIp: opts.clientIp });
    const parsed = autocompleteSchema.safeParse(res.json);
    if (!parsed.success) return [];
    const airports: Airport[] = [];
    for (const r of parsed.data.results) {
      const iata = r.iataCode?.toUpperCase();
      if (!iata || !/^[A-Z]{3}$/.test(iata)) continue;
      const meta = airportMetaByIata(iata);
      airports.push({
        iata,
        name: r.name,
        city: r.cityName ?? meta?.city ?? r.name,
        country: r.countryName ?? meta?.country ?? "",
        countryCode: meta?.countryCode ?? "",
        lat: meta?.lat ?? 0,
        lng: meta?.lng ?? 0,
        ...(meta?.timeZone ? { timeZone: meta.timeZone } : {}),
        world: true,
      });
    }
    if (autocompleteCache.size >= AUTOCOMPLETE_CACHE_MAX) autocompleteCache.delete(autocompleteCache.keys().next().value as string);
    autocompleteCache.set(term, { at: now, airports });
    return airports;
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err) }, "KAYAK: autocomplete feilet – bruker lokalt register");
    return [];
  }
}
