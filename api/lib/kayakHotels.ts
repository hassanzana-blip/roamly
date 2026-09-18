import { z } from "zod";
import type { HotelDetailResult, HotelPlace, HotelRateOffer, HotelSearchResult, HotelSummary } from "../../contracts/hotels";
import { env } from "./env";
import { log } from "./logger";
import { kayakConfig, kayakRequest, KayakError, normalizeUserTrackId } from "./kayak";


/**
 * KAYAK Hotels Search API (v3.0) – metasøk. Kunden bestiller hos leverandøren
 * via `bookUri`. Nøkkelen legges på i kayakRequest; ingenting her logger
 * spørrestreng eller nøkkel.
 *
 * Sandbox: kun US-marked og mockede priser – svaret merkes `sandbox: true`
 * og skal alltid vises med sandbox-merke i UI.
 */

const HOTELS_PATH = "/api/3.0/hotels";
const HOTEL_PATH = "/api/3.0/hotel";
const AUTOCOMPLETE_HOTELS_PATH = "/api/affiliate/autocomplete/v1/hotels";
const SEARCH_TIMEOUT_MS = 12_000;
const POLL_BUDGET_MS = 20_000;
const POLL_INTERVAL_MS = 1_500;
const PAGE_SIZE = 40;

export const kayakHotelsConfig = {
  get enabled(): boolean {
    return env.kayakHotelsEnabled && kayakConfig.baseUrl.length > 0;
  },
  get sandbox(): boolean {
    return kayakConfig.sandbox;
  },
};

// ─── Skjemaer (tolerante: KAYAK legger til felter over tid) ─────────────────

const imageSchema = z.object({ large: z.string(), small: z.string().optional() });
const providerSchema = z.object({
  code: z.string(),
  name: z.string(),
  logo: z.string().optional(),
  isDirect: z.boolean().optional(),
});
const rateSchema = z.object({
  roomName: z.string().default(""),
  totalRate: z.number(),
  isCheapestRate: z.boolean().optional(),
  hasFreeCancellation: z.boolean().optional(),
  canPayLater: z.boolean().optional(),
  inclusions: z.array(z.number()).optional(),
  availableRooms: z.number().optional(),
  providerIndex: z.number().optional(),
  bookUri: z.string(),
});
const resultSchema = z.object({
  id: z.number(),
  key: z.string(),
  name: z.string(),
  address: z.string().default(""),
  hotelCountryCode: z.string().default(""),
  latitude: z.number().default(0),
  longitude: z.number().default(0),
  starRating: z.number().default(0),
  isSelfRated: z.boolean().default(false),
  lowestRate: z.number().nullable().optional(),
  distance: z.number().nullable().optional(),
  isGreatValue: z.boolean().optional(),
  numberOfProviders: z.number().optional(),
  guestRating: z.number().nullable().optional(),
  numberOfReviews: z.number().optional(),
  guestRatingSentiment: z.string().optional(),
  rates: z.array(rateSchema).optional(),
  images: z.array(imageSchema).optional(),
  description: z.string().optional(),
  policies: z.array(z.object({ code: z.string(), name: z.string(), description: z.string() })).optional(),
  featureSummary: z.array(z.object({ name: z.string(), description: z.string() })).optional(),
  reviewQuotes: z.array(z.string()).optional(),
});
const destinationSchema = z
  .object({ key: z.string(), name: z.string(), fullName: z.string().optional(), placeCountryCode: z.string().optional() })
  .passthrough();
const multiSchema = z.object({
  isComplete: z.boolean().default(true),
  totalResults: z.number().optional(),
  currencyCode: z.string().optional(),
  lowestTotalRate: z.number().optional(),
  highestTotalRate: z.number().optional(),
  results: z.array(resultSchema).default([]),
  providers: z.array(providerSchema).default([]),
  destination: destinationSchema.nullable().optional(),
});
/** SingleHotelSearchResponse: hotellet ligger på toppnivå, prisene under `results`, omtaler under `reviews`. */
const singleSchema = resultSchema.omit({ rates: true, guestRating: true, numberOfReviews: true, guestRatingSentiment: true }).extend({
  isComplete: z.boolean().default(true),
  currencyCode: z.string().optional(),
  providers: z.array(providerSchema).default([]),
  results: z.array(rateSchema).optional(),
  reviews: z
    .object({
      numberOfReviews: z.number().optional(),
      sentiment: z.string().optional(),
      quotes: z.array(z.object({ text: z.string() })).optional(),
      guestRatings: z.record(z.string(), z.number()).optional(),
    })
    .optional(),
});
const autocompleteSchema = z.object({
  results: z
    .array(
      z.object({
        placeId: z.number().optional(),
        id: z.number().optional(),
        key: z.string().optional(),
        primaryPlaceType: z.string().optional(),
        name: z.string(),
        fullName: z.string().optional(),
        cityName: z.string().optional(),
        countryName: z.string().optional(),
        countryCode: z.string().optional(),
      }),
    )
    .default([]),
});

// ─── Hjelpere ───────────────────────────────────────────────────────────────

export function nightsBetween(checkin: string, checkout: string): number {
  return Math.max(1, Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86_400_000));
}

/** HotelRoomGuests: `{adults}:{childAges...}|…` – ett rom per element. */
export function roomsParam(rooms: { adults: number; childAges?: number[] }[]): string {
  return rooms
    .map((r) => {
      const a = Math.max(1, Math.min(8, Math.round(r.adults)));
      const kids = (r.childAges ?? []).filter((n) => Number.isFinite(n) && n >= 0 && n <= 17).map((n) => Math.round(n));
      return kids.length ? `${a}:${kids.join(",")}` : String(a);
    })
    .join("|");
}

function isHttps(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || (u.protocol === "http:" && !env.isProdEnv && (u.hostname === "localhost" || u.hostname === "127.0.0.1"));
  } catch {
    return false;
  }
}

function mapHotel(r: z.infer<typeof resultSchema>, providers: z.infer<typeof providerSchema>[], currency: string, nights: number): HotelSummary {
  const rates: HotelRateOffer[] = (r.rates ?? [])
    .filter((rate) => isHttps(rate.bookUri))
    .map((rate) => {
      const p = rate.providerIndex !== undefined ? providers[rate.providerIndex] : undefined;
      return {
        roomName: rate.roomName,
        totalAmount: rate.totalRate,
        currency,
        perNightAmount: Math.round((rate.totalRate / nights) * 100) / 100,
        freeCancellation: rate.hasFreeCancellation ?? false,
        payLater: rate.canPayLater ?? false,
        inclusions: rate.inclusions ?? [],
        availableRooms: rate.availableRooms ?? 0,
        isCheapest: rate.isCheapestRate ?? false,
        provider: {
          code: p?.code ?? "",
          name: p?.name ?? "Leverandør",
          logoUrl: p?.logo && isHttps(p.logo) ? p.logo : undefined,
          isDirect: p?.isDirect ?? false,
        },
        bookUrl: rate.bookUri,
      };
    })
    .sort((a, b) => a.totalAmount - b.totalAmount);
  const guestRating = typeof r.guestRating === "number" && r.guestRating >= 0 ? r.guestRating : null;
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    address: r.address,
    countryCode: r.hotelCountryCode,
    lat: r.latitude,
    lng: r.longitude,
    starRating: r.starRating,
    selfRated: r.isSelfRated,
    guestRating,
    numberOfReviews: r.numberOfReviews ?? 0,
    ratingSentiment: r.guestRatingSentiment,
    distanceKm: typeof r.distance === "number" ? Math.round(r.distance * 10) / 10 : null,
    images: (r.images ?? []).filter((i) => isHttps(i.large)).map((i) => ({ large: i.large, small: i.small && isHttps(i.small) ? i.small : undefined })),
    lowestTotal: rates[0]?.totalAmount ?? r.lowestRate ?? null,
    currency,
    nights,
    numberOfProviders: r.numberOfProviders ?? rates.length,
    rates,
    greatValue: r.isGreatValue ?? false,
  };
}

function mapPlace(d: z.infer<typeof destinationSchema> | null | undefined): HotelPlace | null {
  if (!d) return null;
  return { key: d.key, name: d.name, fullName: d.fullName, countryCode: d.placeCountryCode };
}

// ─── Søk ────────────────────────────────────────────────────────────────────

export interface HotelSearchInput {
  /** `kplace:…`, `khotel:…`, `klatlon:…` – fra autocomplete. */
  destination: string;
  checkin: string;
  checkout: string;
  rooms: { adults: number; childAges?: number[] }[];
  currency?: string;
  language?: string;
  sort?: "popularity" | "minRate" | "rating" | "distance" | "consumerRating";
  page?: number;
}

export interface HotelRequestContext {
  userTrackId?: string | null;
  userAgent?: string;
  clientIp?: string;
  signal?: AbortSignal;
}

const DESTINATION_RE = /^(kplace|khotel|khotels|klatlon):[A-Za-z0-9.,;:_-]{1,200}$/;

export async function kayakHotelSearch(input: HotelSearchInput, ctx: HotelRequestContext = {}): Promise<HotelSearchResult> {
  if (!kayakHotelsConfig.enabled) throw new KayakError("Hotellsøk er ikke slått på.");
  if (!DESTINATION_RE.test(input.destination)) throw new KayakError("Ugyldig reisemål for hotellsøk.", { status: 400 });
  const nights = nightsBetween(input.checkin, input.checkout);
  const currency = (input.currency ?? kayakConfig.defaultCurrency).toUpperCase();
  const rooms = roomsParam(input.rooms);
  const userTrackId = normalizeUserTrackId(ctx.userTrackId);
  const query = {
    userTrackId,
    destination: input.destination,
    checkin: input.checkin,
    checkout: input.checkout,
    rooms,
    currencyCode: currency,
    languageCode: (input.language ?? "EN").toUpperCase(),
    includeTaxesInTotal: "true",
    includeLocalTaxesInTotal: "true",
    searchTimeout: String(SEARCH_TIMEOUT_MS),
    pageSize: String(PAGE_SIZE),
    pageIndex: String(input.page ?? 0),
    sortField: input.sort ?? "popularity",
    responseOptions: "images,toprates,destination,reviews",
  };
  const started = Date.now();
  let cookies: string[] = [];
  let body: z.infer<typeof multiSchema> | null = null;
  while (true) {
    const res = await kayakRequest({ method: "GET", path: HOTELS_PATH, query, userAgent: ctx.userAgent, clientIp: ctx.clientIp, cookies, signal: ctx.signal });
    if (res.setCookies.length) cookies = res.setCookies;
    const parsed = multiSchema.safeParse(res.json);
    if (!parsed.success) {
      log.warn({ issues: parsed.error.issues.slice(0, 3) }, "KAYAK hotels: uventet svarform");
      throw new KayakError("Hotellsøket ga et uleselig svar.", { retryable: true });
    }
    body = parsed.data;
    if (body.isComplete || Date.now() - started > POLL_BUDGET_MS || body.results.length >= 12) break;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  const cur = body.currencyCode ?? currency;
  const results = body.results.map((r) => mapHotel(r, body!.providers, cur, nights));
  const totals = results.map((h) => h.lowestTotal).filter((n): n is number => typeof n === "number");
  log.info({ destination: input.destination, results: results.length, complete: body.isComplete, ms: Date.now() - started }, "KAYAK hotels: søk");
  return {
    provider: "kayak",
    sandbox: kayakHotelsConfig.sandbox,
    complete: body.isComplete,
    destination: mapPlace(body.destination),
    checkin: input.checkin,
    checkout: input.checkout,
    nights,
    rooms,
    currency: cur,
    totalResults: body.totalResults ?? results.length,
    results,
    priceRange: totals.length ? { min: Math.min(...totals), max: Math.max(...totals) } : null,
  };
}

export async function kayakHotelDetail(
  input: { hotelKey: string; checkin: string; checkout: string; rooms: { adults: number; childAges?: number[] }[]; currency?: string; language?: string },
  ctx: HotelRequestContext = {},
): Promise<HotelDetailResult> {
  if (!kayakHotelsConfig.enabled) throw new KayakError("Hotellsøk er ikke slått på.");
  if (!/^khotel:\d{1,12}$/.test(input.hotelKey)) throw new KayakError("Ugyldig hotellnøkkel.", { status: 400 });
  const nights = nightsBetween(input.checkin, input.checkout);
  const currency = (input.currency ?? kayakConfig.defaultCurrency).toUpperCase();
  const query = {
    userTrackId: normalizeUserTrackId(ctx.userTrackId),
    hotel: input.hotelKey,
    checkin: input.checkin,
    checkout: input.checkout,
    rooms: roomsParam(input.rooms),
    currencyCode: currency,
    languageCode: (input.language ?? "EN").toUpperCase(),
    includeTaxesInTotal: "true",
    includeLocalTaxesInTotal: "true",
    searchTimeout: String(SEARCH_TIMEOUT_MS),
    responseOptions: "images,description,featureSummary,reviews,place",
  };
  const started = Date.now();
  let cookies: string[] = [];
  let body: z.infer<typeof singleSchema> | null = null;
  while (true) {
    const res = await kayakRequest({ method: "GET", path: HOTEL_PATH, query, userAgent: ctx.userAgent, clientIp: ctx.clientIp, cookies, signal: ctx.signal });
    if (res.setCookies.length) cookies = res.setCookies;
    const parsed = singleSchema.safeParse(res.json);
    if (!parsed.success) throw new KayakError("Hotellet ga et uleselig svar.", { retryable: true });
    body = parsed.data;
    if (body.isComplete || Date.now() - started > POLL_BUDGET_MS) break;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  const cur = body.currencyCode ?? currency;
  const overall = body.reviews?.guestRatings?.OVERALL;
  const hotel = mapHotel(
    {
      ...body,
      rates: body.results ?? [],
      guestRating: typeof overall === "number" ? overall : null,
      numberOfReviews: body.reviews?.numberOfReviews ?? 0,
      guestRatingSentiment: body.reviews?.sentiment,
    },
    body.providers,
    cur,
    nights,
  );
  return {
    provider: "kayak",
    sandbox: kayakHotelsConfig.sandbox,
    complete: body.isComplete,
    hotel: {
      ...hotel,
      description: body.description,
      policies: body.policies ?? [],
      featureSummary: body.featureSummary ?? [],
      reviewQuotes: (body.reviews?.quotes ?? []).map((q) => q.text).filter(Boolean),
    },
  };
}

// ─── Stedssøk (autocomplete) ────────────────────────────────────────────────

const placeCache = new Map<string, { at: number; places: HotelPlace[] }>();
const PLACE_TTL_MS = 24 * 60 * 60_000;
let placeWindow = { start: 0, count: 0 };
const PLACE_HOURLY_LIMIT = 80;

export function resetKayakHotelPlaceState(): void {
  placeCache.clear();
  placeWindow = { start: 0, count: 0 };
}

export async function kayakHotelPlaces(searchTerm: string, ctx: { userAgent?: string; clientIp?: string; now?: () => number } = {}): Promise<HotelPlace[]> {
  const term = searchTerm.trim().toLowerCase().slice(0, 60);
  if (!kayakHotelsConfig.enabled || term.length < 2) return [];
  const now = (ctx.now ?? Date.now)();
  const hit = placeCache.get(term);
  if (hit && now - hit.at < PLACE_TTL_MS) return hit.places;
  if (now - placeWindow.start >= 60 * 60_000) placeWindow = { start: now, count: 0 };
  if (placeWindow.count >= PLACE_HOURLY_LIMIT) return [];
  placeWindow.count += 1;
  try {
    const res = await kayakRequest({ method: "GET", path: AUTOCOMPLETE_HOTELS_PATH, query: { searchTerm: term }, userAgent: ctx.userAgent, clientIp: ctx.clientIp });
    const parsed = autocompleteSchema.safeParse(res.json);
    if (!parsed.success) return [];
    const places: HotelPlace[] = [];
    for (const r of parsed.data.results) {
      const id = r.placeId ?? r.id;
      const key = r.key && DESTINATION_RE.test(r.key) ? r.key : id ? `kplace:${id}` : null;
      if (!key) continue;
      places.push({ key, name: r.name, fullName: r.fullName ?? [r.name, r.cityName, r.countryName].filter(Boolean).join(", "), countryCode: r.countryCode, type: r.primaryPlaceType });
    }
    if (placeCache.size >= 500) placeCache.delete(placeCache.keys().next().value as string);
    placeCache.set(term, { at: now, places });
    return places;
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err) }, "KAYAK hotels: stedssøk feilet");
    return [];
  }
}
