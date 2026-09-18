import { z } from "zod";
import type { CarAgency, CarOffer, CarPlace, CarSearchResult } from "../../contracts/cars";
import { env } from "./env";
import { log } from "./logger";
import { kayakAutocomplete, kayakConfig, kayakRequest, KayakError, normalizeUserTrackId } from "./kayak";

/**
 * KAYAK Cars Search API – POST /i/api/affiliate/search/car/v1/poll.
 * Første kall starter søket (searchStartParameters), deretter polles med
 * {searchId} og `cluster` til status er «complete» (eller budsjettet er brukt;
 * «second-phase» kan vises som komplett). Kunden bestiller hos leverandøren
 * via `bookingUrl`. Alt kortet viser er lest fra svaret.
 */

const CARS_POLL_PATH = "/i/api/affiliate/search/car/v1/poll";
const AUTOCOMPLETE_CARS_PATH = "/api/affiliate/autocomplete/v1/cars";
const POLL_BUDGET_MS = 22_000;
const SECOND_PHASE_GOOD_ENOUGH_MS = 9_000;
const POLL_INTERVAL_MS = 1_200;
const MAX_RESULTS = 80;

export const kayakCarsConfig = {
  get enabled(): boolean {
    return env.kayakCarsEnabled && kayakConfig.baseUrl.length > 0;
  },
  get sandbox(): boolean {
    return kayakConfig.sandbox;
  },
};

const priceSchema = z.object({ price: z.number(), displayPrice: z.string().optional() });
const logoSchema = z.object({ horizontalUrl: z.string().optional() }).optional();
const agencySchema = z.object({ code: z.string(), displayName: z.string(), logoUrls: logoSchema, type: z.string().optional() });
const providerSchema = z.object({ code: z.string(), displayName: z.string(), logoUrls: logoSchema });
const locationSchema = z.object({
  locationId: z.string(),
  displayDistance: z.string().optional(),
  address: z.string().optional(),
  locationType: z.string().optional(),
  cityName: z.string().optional(),
  countryCode: z.string().optional(),
  airport: z.object({ code: z.string(), displayName: z.string(), terminalName: z.string().optional() }).optional(),
});
const optionSchema = z.object({
  providerCode: z.string(),
  agencyCode: z.string(),
  bookingUrl: z.string(),
  pickupLocationId: z.string().optional(),
  dropoffLocationId: z.string().optional(),
  paymentType: z.string().optional(),
  policy: z
    .object({
      cancellation: z.object({ isUnlimited: z.boolean().optional(), limitHours: z.number().optional() }).optional(),
      mileage: z.object({ code: z.string(), limit: z.number().optional(), displayName: z.string().optional() }).optional(),
      fuel: z.object({ code: z.string(), displayName: z.string().optional(), description: z.string().optional() }).optional(),
    })
    .optional(),
  car: z
    .object({
      image: z.string().optional(),
      type: z.object({ code: z.string().optional(), displayName: z.string().optional() }).optional(),
      brand: z.string().default(""),
      bags: z.number().optional(),
      passengers: z.number().optional(),
      doors: z.string().optional(),
      transmission: z.enum(["automatic", "manual"]).optional(),
      fuel: z.string().optional(),
      features: z.array(z.object({ code: z.string(), displayName: z.string() })).optional(),
    })
    .optional(),
  price: priceSchema.optional(),
  badges: z.array(z.object({ code: z.string(), displayName: z.string() })).optional(),
});
const responseSchema = z.object({
  searchId: z.string(),
  cluster: z.string().optional(),
  status: z.enum(["first-phase", "second-phase", "complete"]).or(z.string()),
  results: z.array(z.object({ id: z.string(), bookingOptions: z.array(optionSchema) })).default([]),
  agencies: z.record(z.string(), agencySchema).optional(),
  providers: z.record(z.string(), providerSchema).optional(),
  carLocations: z.record(z.string(), locationSchema).optional(),
  currency: z.string().optional(),
  days: z.number().optional(),
  totalCount: z.number().optional(),
});
const autocompleteItemSchema = z
  .object({
    placeId: z.union([z.number(), z.string()]).optional(),
    id: z.union([z.number(), z.string()]).optional(),
    cityId: z.union([z.number(), z.string()]).optional(),
    ctid: z.union([z.number(), z.string()]).optional(),
    locationId: z.union([z.number(), z.string()]).optional(),
    airportCode: z.string().optional(),
    primaryPlaceType: z.string().optional(),
    type: z.string().optional(),
    name: z.string().optional(),
    displayName: z.string().optional(),
    fullName: z.string().optional(),
    cityName: z.string().optional(),
    countryName: z.string().optional(),
    countryCode: z.string().optional(),
    iataCode: z.string().optional(),
  })
  .passthrough();
/** Svaret kan være `{results:[…]}` eller en ren liste – begge godtas. */
const autocompleteSchema = z.union([z.object({ results: z.array(autocompleteItemSchema).default([]) }), z.array(autocompleteItemSchema).transform((results) => ({ results }))]);

function isHttps(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || (u.protocol === "http:" && !env.isProdEnv && (u.hostname === "localhost" || u.hostname === "127.0.0.1"));
  } catch {
    return false;
  }
}

export function daysBetween(pickup: string, dropoff: string): number {
  return Math.max(1, Math.ceil((Date.parse(dropoff) - Date.parse(pickup)) / 86_400_000));
}

function agencyInfo(a: z.infer<typeof agencySchema> | z.infer<typeof providerSchema> | undefined, fallbackCode: string): CarAgency {
  const logo = a?.logoUrls?.horizontalUrl;
  return { code: a?.code ?? fallbackCode, name: a?.displayName ?? fallbackCode, logoUrl: isHttps(logo) ? logo : undefined };
}

export interface CarSearchInput {
  pickup: { type: "airport" | "city"; value: string };
  dropoff?: { type: "airport" | "city"; value: string };
  pickupDate: string;
  dropoffDate: string;
  pickupHour?: number;
  dropoffHour?: number;
  currency?: string;
}

export interface CarRequestContext {
  userTrackId?: string | null;
  userAgent?: string;
  clientIp?: string;
  signal?: AbortSignal;
}

const LOCATION_RE = /^[\p{L}\p{N} .,'’-]{1,80}$/u;

export function buildCarSearchStart(input: CarSearchInput): Record<string, unknown> {
  const hour = (h: number | undefined) => Math.max(0, Math.min(23, Math.round(h ?? 10)));
  return {
    searchStartParameters: {
      pickup: { location: { type: input.pickup.type, value: input.pickup.value }, date: input.pickupDate, hour: hour(input.pickupHour), minute: 0 },
      dropoff: {
        ...(input.dropoff ? { location: { type: input.dropoff.type, value: input.dropoff.value } } : {}),
        date: input.dropoffDate,
        hour: hour(input.dropoffHour),
        minute: 0,
      },
    },
    resultParameters: {
      priceMode: "total",
      sort: { key: "price" },
      pageNumber: 0,
      pageSize: MAX_RESULTS,
      ...(input.currency ? { currency: input.currency.toUpperCase() } : {}),
    },
  };
}

export function mapCarResponse(body: z.infer<typeof responseSchema>, input: CarSearchInput): CarSearchResult {
  const days = body.days ?? daysBetween(input.pickupDate, input.dropoffDate);
  const currency = (body.currency ?? input.currency ?? kayakConfig.defaultCurrency).toUpperCase();
  const agencies = body.agencies ?? {};
  const providers = body.providers ?? {};
  const locations = body.carLocations ?? {};
  const offers: CarOffer[] = [];
  for (const r of body.results) {
    // Billigste bestillingsvalg med gyldig lenke og pris. KAYAK anbefaler første; vi tar billigste blant de gyldige.
    const options = r.bookingOptions.filter((o) => isHttps(o.bookingUrl) && o.price && o.car);
    if (!options.length) continue;
    options.sort((a, b) => (a.price!.price ?? 0) - (b.price!.price ?? 0));
    const o = options[0];
    const car = o.car!;
    const agency = agencies[o.agencyCode];
    const provider = providers[o.providerCode];
    const pick = o.pickupLocationId ? locations[o.pickupLocationId] : undefined;
    const drop = o.dropoffLocationId ? locations[o.dropoffLocationId] : pick;
    const policies: string[] = [];
    if (o.policy?.mileage?.displayName) policies.push(o.policy.mileage.code === "unlimited" ? o.policy.mileage.displayName : `${o.policy.mileage.displayName}`);
    if (o.policy?.fuel?.displayName) policies.push(o.policy.fuel.displayName);
    if (o.policy?.cancellation?.limitHours && !o.policy.cancellation.isUnlimited) policies.push(`Gratis avbestilling inntil ${o.policy.cancellation.limitHours} t før`);
    for (const b of o.badges ?? []) if (b.displayName) policies.push(b.displayName);
    for (const f of car.features ?? []) if (f.displayName && f.code !== "ac") policies.push(f.displayName);
    const doorsMatch = car.doors?.match(/^doors(\d)$/);
    const total = o.price!.price;
    const opaque = agency?.type === "opaque";
    offers.push({
      id: r.id,
      model: car.brand || car.type?.displayName || "Leiebil",
      orSimilar: true,
      className: car.type?.displayName ?? car.type?.code ?? "",
      seats: car.passengers ?? null,
      bags: car.bags ?? null,
      doors: doorsMatch ? Number(doorsMatch[1]) : null,
      transmission: car.transmission ?? null,
      airConditioning: car.features ? car.features.some((f) => f.code === "ac") : null,
      imageUrl: isHttps(car.image) ? car.image : undefined,
      agency: opaque ? { code: o.agencyCode, name: "Utleier vises ved bestilling" } : agencyInfo(agency, o.agencyCode),
      provider: agencyInfo(provider, o.providerCode),
      pickup: {
        name: pick?.airport ? `${pick.airport.displayName} (${pick.airport.code})${pick.airport.terminalName ? ` · ${pick.airport.terminalName}` : ""}` : [pick?.address, pick?.cityName].filter(Boolean).join(", ") || "",
        inTerminal: pick?.locationType === "inTerminal",
      },
      dropoff: { name: drop?.airport ? `${drop.airport.displayName} (${drop.airport.code})` : [drop?.address, drop?.cityName].filter(Boolean).join(", ") || "" },
      policies: Array.from(new Set(policies)),
      unlimitedMileage: o.policy?.mileage ? o.policy.mileage.code === "unlimited" : null,
      freeCancellation: o.policy?.cancellation ? Boolean(o.policy.cancellation.isUnlimited || o.policy.cancellation.limitHours) : (o.badges ?? []).some((b) => b.code === "freeCancellation") || null,
      days,
      perDayAmount: Math.round((total / days) * 100) / 100,
      totalAmount: total,
      currency,
      bookUrl: o.bookingUrl,
    });
  }
  offers.sort((a, b) => a.totalAmount - b.totalAmount);
  return {
    provider: "kayak",
    sandbox: kayakCarsConfig.sandbox,
    complete: body.status === "complete",
    pickup: null,
    dropoff: null,
    pickupDate: input.pickupDate,
    dropoffDate: input.dropoffDate,
    days,
    currency,
    totalResults: body.totalCount ?? offers.length,
    results: offers,
  };
}

export async function kayakCarSearch(input: CarSearchInput, ctx: CarRequestContext = {}): Promise<CarSearchResult> {
  if (!kayakCarsConfig.enabled) throw new KayakError("Leiebilsøk er ikke slått på.");
  if (!LOCATION_RE.test(input.pickup.value) || (input.dropoff && !LOCATION_RE.test(input.dropoff.value))) throw new KayakError("Ugyldig hentested.", { status: 400 });
  const userTrackId = normalizeUserTrackId(ctx.userTrackId);
  const started = Date.now();
  let cookies: string[] = [];
  let searchId: string | null = null;
  let cluster: string | undefined;
  let last: z.infer<typeof responseSchema> | null = null;
  while (true) {
    const res = await kayakRequest({
      method: "POST",
      path: CARS_POLL_PATH,
      query: { userTrackId, cluster },
      body: searchId ? { searchId } : buildCarSearchStart(input),
      userAgent: ctx.userAgent,
      clientIp: ctx.clientIp,
      cookies,
      signal: ctx.signal,
    });
    if (res.setCookies.length) cookies = res.setCookies;
    const parsed = responseSchema.safeParse(res.json);
    if (!parsed.success) {
      log.warn({ issues: parsed.error.issues.slice(0, 3) }, "KAYAK cars: uventet svarform");
      throw new KayakError("Leiebilsøket ga et uleselig svar.", { retryable: true });
    }
    last = parsed.data;
    searchId = last.searchId;
    cluster = last.cluster ?? cluster;
    const elapsed = Date.now() - started;
    if (last.status === "complete") break;
    if (last.status === "second-phase" && elapsed > SECOND_PHASE_GOOD_ENOUGH_MS && last.results.length > 0) break;
    if (elapsed > POLL_BUDGET_MS) break;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  const out = mapCarResponse(last!, input);
  log.info({ results: out.results.length, complete: out.complete, ms: Date.now() - started }, "KAYAK cars: søk");
  return out;
}

// ─── Stedssøk ───────────────────────────────────────────────────────────────

const placeCache = new Map<string, { at: number; places: CarPlace[] }>();
let placeWindow = { start: 0, count: 0 };

export function resetKayakCarPlaceState(): void {
  placeCache.clear();
  placeWindow = { start: 0, count: 0 };
}

export async function kayakCarPlaces(searchTerm: string, ctx: { userAgent?: string; clientIp?: string; now?: () => number } = {}): Promise<CarPlace[]> {
  const term = searchTerm.trim().toLowerCase().slice(0, 60);
  if (!kayakCarsConfig.enabled || term.length < 2) return [];
  const now = (ctx.now ?? Date.now)();
  const hit = placeCache.get(term);
  if (hit && now - hit.at < 24 * 60 * 60_000) return hit.places;
  if (now - placeWindow.start >= 60 * 60_000) placeWindow = { start: now, count: 0 };
  if (placeWindow.count >= 80) return [];
  placeWindow.count += 1;
  const places: CarPlace[] = [];
  const seen = new Set<string>();
  const push = (p: CarPlace) => {
    const k = `${p.type}:${p.value}`;
    if (!seen.has(k)) {
      seen.add(k);
      places.push(p);
    }
  };
  try {
    const res = await kayakRequest({ method: "GET", path: AUTOCOMPLETE_CARS_PATH, query: { searchTerm: term }, userAgent: ctx.userAgent, clientIp: ctx.clientIp });
    const parsed = autocompleteSchema.safeParse(res.json);
    if (!parsed.success) {
      const j = res.json as Record<string, unknown> | unknown[] | null;
      log.warn({ shape: Array.isArray(j) ? "array" : j && typeof j === "object" ? Object.keys(j).slice(0, 10) : typeof j }, "KAYAK cars: ukjent form på stedssøk");
    } else {
      for (const r of parsed.data.results) {
        const name = r.name ?? r.displayName ?? "";
        if (!name) continue;
        const iata = (r.iataCode ?? r.airportCode)?.toUpperCase();
        const id = r.cityId ?? r.ctid ?? r.placeId ?? r.locationId ?? r.id;
        const kind = (r.primaryPlaceType ?? r.type ?? "").toLowerCase();
        const full = r.fullName ?? [name, r.cityName, r.countryName].filter(Boolean).join(", ");
        if (iata && /^[A-Z]{3}$/.test(iata) && kind !== "city") push({ type: "airport", value: iata, name, fullName: full, countryCode: r.countryCode });
        else if (id !== undefined && String(id).length > 0) push({ type: "city", value: String(id), name, fullName: full, countryCode: r.countryCode });
      }
      if (!places.length && parsed.data.results.length) {
        log.warn({ fields: Object.keys(parsed.data.results[0] as object).slice(0, 20) }, "KAYAK cars: forslag uten by-id/IATA");
      }
    }
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err) }, "KAYAK cars: stedssøk feilet");
  }
  // Flyplasser fra flysøkets stedssøk (IATA) er alltid gyldige hentesteder for leiebil.
  try {
    for (const a of await kayakAutocomplete(term, ctx)) push({ type: "airport", value: a.iata, name: `${a.name}`, fullName: `${a.name} (${a.iata}), ${a.country}`, countryCode: a.countryCode });
  } catch {
    /* lokalt register er valgfritt her */
  }
  if (placeCache.size >= 500) placeCache.delete(placeCache.keys().next().value as string);
  placeCache.set(term, { at: now, places });
  return places;
}
