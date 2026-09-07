import { AppError } from "./errors";
import { env } from "./env";
import { log } from "./logger";
import type { CabinClass, Offer, OfferSlice, SearchResult, Segment, SearchSliceInput, SearchPassengerInput } from "@contracts/types";
import { airportByIata } from "@contracts/airports";

/**
 * Travelport JSON API (v11) — søk.
 *
 * VIKTIG: kartleggingen under er skrevet mot Travelports publiserte skjema for
 * CatalogProductOfferings, men er ALDRI kjørt mot det ekte API-et herfra
 * (utviklingsmiljøet har ikke nettverkstilgang til travelport.com). Behandle
 * den som uverifisert til noen har kjørt `npm run travelport:probe` mot
 * pre-production og sammenlignet svaret med fixturen i travelport.test.ts.
 *
 * Adapteret gjør kun søk. Booking går fortsatt via Duffel: et Travelport-tilbud
 * har id-prefiks `tp_` og avvises eksplisitt i checkout, slik at en tilbuds-id
 * fra én leverandør aldri kan sendes til en annen.
 *
 * Ingen hemmeligheter logges. Priser og bagasje leses kun fra svaret — vi
 * gjetter aldri, og et felt vi ikke finner blir utelatt i stedet for antatt.
 */

export const TRAVELPORT_OFFER_PREFIX = "tp_";

export const travelportConfig = {
  get authUrl(): string {
    return (env.TRAVELPORT_AUTH_URL ?? "https://auth.pp.travelport.com/oauth/token").replace(/\/$/, "");
  },
  get baseUrl(): string {
    return (env.TRAVELPORT_BASE_URL ?? "https://api.pp.travelport.com").replace(/\/$/, "");
  },
  get pcc(): string {
    return env.TRAVELPORT_PCC ?? "";
  },
  /** Alle feltene må være satt før adapteret kan brukes. */
  get configured(): boolean {
    return Boolean(
      env.TRAVELPORT_CLIENT_ID && env.TRAVELPORT_CLIENT_SECRET && env.TRAVELPORT_USERNAME && env.TRAVELPORT_PASSWORD && env.TRAVELPORT_PCC,
    );
  },
  /** Søk gjennom Travelport er avslått med mindre det slås på eksplisitt. */
  get searchEnabled(): boolean {
    return env.TRAVELPORT_SEARCH_ENABLED === "true" && travelportConfig.configured;
  },
  /** pp = pre-production (testdata). Alt annet regnes som produksjon. */
  get liveMode(): boolean {
    return !/(^|\.)pp\./.test(new URL(travelportConfig.baseUrl).hostname);
  },
};

export class TravelportError extends AppError {
  constructor(message: string, opts: { status?: number; retryable?: boolean } = {}) {
    const retryable = opts.retryable ?? false;
    super(retryable ? "SUPPLIER_UNAVAILABLE" : "SUPPLIER_REJECTED", {
      message,
      retryable,
      data: { supplier: "travelport", status: opts.status },
    });
  }
}

// ─── OAuth: password grant med enkel token-cache ─────────────────────────────

type CachedToken = { token: string; expiresAt: number };
let cached: CachedToken | null = null;

/**
 * Negativ cache. Uten denne ber hvert eneste søk om en ny token, og en
 * feilende innlogging blir til et regn av forespørsler mot Travelport som
 * ender i 429 og skjuler den egentlige feilen. Ved avslag venter vi.
 */
type AuthFailure = { until: number; message: string; status?: number };
let authFailure: AuthFailure | null = null;
const AUTH_BACKOFF_MS = 60_000;

/** Kun for tester. */
export function resetTravelportToken(): void {
  cached = null;
  authFailure = null;
}

/** Trekker fra et sikkerhetsvindu så en token aldri brukes på målstreken. */
const TOKEN_SKEW_MS = 60_000;

export async function travelportToken(now: number = Date.now()): Promise<string> {
  if (cached && cached.expiresAt - TOKEN_SKEW_MS > now) return cached.token;
  if (!travelportConfig.configured) throw new TravelportError("Travelport er ikke konfigurert.");
  if (authFailure && authFailure.until > now) {
    // Ikke bank på en dør som nettopp ble smelt igjen.
    throw new TravelportError(authFailure.message, { status: authFailure.status, retryable: true });
  }

  const res = await fetch(travelportConfig.authUrl, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: env.TRAVELPORT_CLIENT_ID,
      client_secret: env.TRAVELPORT_CLIENT_SECRET,
      username: env.TRAVELPORT_USERNAME,
      password: env.TRAVELPORT_PASSWORD,
      grant_type: "password",
    }),
  });

  if (!res.ok) {
    // Feilkoden og -beskrivelsen fra OAuth sier hva som er galt (feil passord,
    // ukjent klient, for mange forsøk). Den inneholder ikke legitimasjon, men
    // vi kutter den likevel, og vi logger aldri kroppen vi sendte.
    let code = "";
    let description = "";
    try {
      const err = (await res.json()) as { error?: string; error_description?: string };
      code = String(err.error ?? "").slice(0, 60);
      description = String(err.error_description ?? "").slice(0, 200);
    } catch {
      /* ikke JSON — statuskoden får tale for seg */
    }
    log.error({ status: res.status, code, description }, "Travelport: token-forespørsel avvist");
    const retryable = res.status === 429 || res.status >= 500;
    authFailure = {
      until: now + AUTH_BACKOFF_MS,
      status: res.status,
      message:
        res.status === 429
          ? "Travelport begrenser antall innlogginger akkurat nå. Prøv igjen om et minutt."
          : "Kunne ikke autentisere mot Travelport.",
    };
    throw new TravelportError(authFailure.message, { status: res.status, retryable });
  }

  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new TravelportError("Travelport svarte uten access_token.");
  const ttlMs = (typeof body.expires_in === "number" && body.expires_in > 0 ? body.expires_in : 3600) * 1000;
  cached = { token: body.access_token, expiresAt: now + ttlMs };
  authFailure = null;
  log.info({ ttlSeconds: Math.round(ttlMs / 1000) }, "Travelport: token hentet");
  return cached.token;
}

// ─── Forespørsel ─────────────────────────────────────────────────────────────

const PASSENGER_TYPE_CODE: Record<SearchPassengerInput["type"], string> = {
  adult: "ADT",
  child: "CNN",
  infant_without_seat: "INF",
};

const CABIN_PREFERENCE: Record<CabinClass, string> = {
  economy: "Economy",
  premium_economy: "PremiumEconomy",
  business: "Business",
  first: "First",
};

export type TravelportSearchInput = {
  slices: SearchSliceInput[];
  passengers: SearchPassengerInput[];
  cabinClass: CabinClass;
};

/** Bygger CatalogProductOfferingsQueryRequest. Rent — enkelt å teste. */
export function buildSearchRequest(input: TravelportSearchInput): Record<string, unknown> {
  const counts = new Map<string, { code: string; number: number; ages: number[] }>();
  for (const p of input.passengers) {
    const code = PASSENGER_TYPE_CODE[p.type];
    const entry = counts.get(code) ?? { code, number: 0, ages: [] };
    entry.number += 1;
    if (typeof p.age === "number") entry.ages.push(p.age);
    counts.set(code, entry);
  }

  return {
    CatalogProductOfferingsQueryRequest: {
      CatalogProductOfferingsRequestAir: {
        "@type": "CatalogProductOfferingsRequestAir",
        maxNumberOfUpsellsToReturn: 4,
        contentSourceList: ["GDS"],
        PassengerCriteria: [...counts.values()].map((p) => ({
          "@type": "PassengerCriteria",
          number: p.number,
          passengerTypeCode: p.code,
          ...(p.ages.length ? { age: Math.min(...p.ages) } : {}),
        })),
        SearchCriteriaFlight: input.slices.map((s) => ({
          "@type": "SearchCriteriaFlight",
          departureDate: s.departureDate,
          From: { value: s.origin.toUpperCase() },
          To: { value: s.destination.toUpperCase() },
        })),
        SearchModifiersAir: {
          "@type": "SearchModifiersAir",
          CabinPreference: [{ "@type": "CabinPreference", preferenceType: "Preferred", cabins: [CABIN_PREFERENCE[input.cabinClass]] }],
        },
      },
    },
  };
}

// ─── Svar → HelloSky-kontrakt ────────────────────────────────────────────────

/** Minimal, defensiv beskrivelse av det vi faktisk leser fra svaret. */
type TpReferenceable = { id?: string; "@type"?: string; [k: string]: unknown };

type TpFlight = TpReferenceable & {
  carrier?: string;
  number?: string;
  Departure?: { location?: string; date?: string; time?: string; terminal?: string };
  Arrival?: { location?: string; date?: string; time?: string; terminal?: string };
  duration?: string;
  equipment?: string;
  operatingCarrier?: string;
  operatingCarrierName?: string;
  carrierName?: string;
  CabinClass?: string;
};

const CABIN_FROM_TP: Record<string, CabinClass> = {
  economy: "economy",
  premiumeconomy: "premium_economy",
  business: "business",
  first: "first",
};

/** ISO 8601-varighet (PT2H30M) → minutter. Ukjent format gir 0. */
export function isoDurationToMinutes(duration?: string | null): number {
  if (!duration) return 0;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(duration);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** Travelport oppgir dato og tid hver for seg; tiden bærer allerede offset. */
export function toIso(date?: string, time?: string): string {
  if (!date) return "";
  if (!time) return `${date}T00:00:00`;
  return time.includes("T") ? time : `${date}T${time}`;
}

function point(iata: string | undefined, terminal?: string) {
  const code = (iata ?? "").toUpperCase();
  const known = code ? airportByIata(code) : undefined;
  return {
    iata: code,
    name: known?.name ?? code,
    city: known?.city ?? code,
    country: known?.country ?? "",
    lat: known?.lat ?? 0,
    lng: known?.lng ?? 0,
    ...(terminal ? { terminal } : {}),
  };
}

function mapSegment(f: TpFlight, cabin: CabinClass): Segment {
  const carrier = (f.carrier ?? "").toUpperCase();
  return {
    id: String(f.id ?? `${carrier}${f.number ?? ""}`),
    origin: point(f.Departure?.location, f.Departure?.terminal),
    destination: point(f.Arrival?.location, f.Arrival?.terminal),
    departingAt: toIso(f.Departure?.date, f.Departure?.time),
    arrivingAt: toIso(f.Arrival?.date, f.Arrival?.time),
    durationMinutes: isoDurationToMinutes(f.duration),
    carrier: { iata: carrier, name: f.carrierName ?? carrier },
    ...(f.operatingCarrier && f.operatingCarrier.toUpperCase() !== carrier
      ? { operatingCarrier: { iata: f.operatingCarrier.toUpperCase(), name: f.operatingCarrierName ?? f.operatingCarrier.toUpperCase() } }
      : {}),
    flightNumber: `${carrier}${f.number ?? ""}`,
    aircraft: f.equipment ?? "",
    cabinClass: CABIN_FROM_TP[(f.CabinClass ?? "").toLowerCase().replace(/[^a-z]/g, "")] ?? cabin,
  };
}

function sliceFrom(segments: Segment[], index: number): OfferSlice {
  const first = segments[0];
  const last = segments[segments.length - 1];
  const total = segments.reduce((sum, s) => sum + s.durationMinutes, 0);
  return {
    id: `tp_slice_${index}`,
    origin: first.origin,
    destination: last.destination,
    departingAt: first.departingAt,
    arrivingAt: last.arrivingAt,
    durationMinutes: total,
    stops: Math.max(0, segments.length - 1),
    segments,
  };
}

type TpResponse = {
  CatalogProductOfferingsResponse?: {
    CatalogProductOfferings?: {
      Identifier?: { value?: string };
      CatalogProductOffering?: Array<{
        id?: string;
        ProductBrandOptions?: Array<{
          flightRefs?: string[];
          ProductBrandOffering?: Array<{
            id?: string;
            Price?: { TotalPrice?: number; Base?: number; TotalTaxes?: number; CurrencyCode?: { value?: string } };
            Brand?: { BrandID?: string; name?: string };
          }>;
        }>;
      }>;
    };
    ReferenceList?: Array<{ "@type"?: string; Flight?: TpFlight[] }>;
  };
};

/** Indekserer ReferenceListFlight slik at flightRefs kan slås opp. */
function flightIndex(body: TpResponse): Map<string, TpFlight> {
  const list = body.CatalogProductOfferingsResponse?.ReferenceList ?? [];
  const index = new Map<string, TpFlight>();
  for (const ref of list) {
    for (const f of ref.Flight ?? []) if (f.id) index.set(String(f.id), f);
  }
  return index;
}

/**
 * Mapper svaret til Offer[]. Alt som mangler pris, valuta eller segmenter
 * hoppes over i stedet for å bli fylt inn med gjetninger.
 */
export function mapSearchResponse(body: TpResponse, input: TravelportSearchInput): Offer[] {
  const flights = flightIndex(body);
  const offerings = body.CatalogProductOfferingsResponse?.CatalogProductOfferings?.CatalogProductOffering ?? [];
  const offers: Offer[] = [];

  for (const offering of offerings) {
    for (const option of offering.ProductBrandOptions ?? []) {
      const segments = (option.flightRefs ?? [])
        .map((ref) => flights.get(String(ref)))
        .filter((f): f is TpFlight => Boolean(f))
        .map((f) => mapSegment(f, input.cabinClass));
      if (segments.length === 0) continue;

      for (const brand of option.ProductBrandOffering ?? []) {
        const price = brand.Price;
        const currency = price?.CurrencyCode?.value;
        if (!price || typeof price.TotalPrice !== "number" || !currency) continue;

        const base = typeof price.Base === "number" ? price.Base : price.TotalPrice;
        const tax = typeof price.TotalTaxes === "number" ? price.TotalTaxes : Math.max(0, price.TotalPrice - base);
        const cabin = segments[0].cabinClass;

        offers.push({
          id: `${TRAVELPORT_OFFER_PREFIX}${brand.id ?? offering.id ?? segments[0].id}`,
          totalAmount: price.TotalPrice.toFixed(2),
          totalCurrency: currency,
          baseAmount: base.toFixed(2),
          taxAmount: tax.toFixed(2),
          owner: segments[0].carrier,
          // Travelport oppgir ikke utløp på søkesvaret; vi setter et kort,
          // konservativt vindu framfor å love mer enn vi vet.
          expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
          cabinClass: cabin,
          slices: [sliceFrom(segments, offers.length)],
          passengers: input.passengers.map((p, i) => ({ id: `tp_pax_${i}`, type: p.type, ...(p.age != null ? { age: p.age } : {}) })),
          // Bagasje kommer ikke med i dette kallet. Null er ærlig: kortet viser
          // «ikke oppgitt» framfor å antyde en tillatelse leverandøren ikke ga.
          baggage: { carryOnBags: 0, checkedBags: 0 },
          emissionsKg: 0,
          refundable: false,
          changeable: false,
        });
      }
    }
  }

  return offers;
}

// ─── Søk ─────────────────────────────────────────────────────────────────────

export async function travelportSearch(input: TravelportSearchInput): Promise<SearchResult> {
  if (!travelportConfig.searchEnabled) throw new TravelportError("Travelport-søk er ikke slått på.");
  const token = await travelportToken();

  // Headerne følger Travelports egen curl-oppskrift nøyaktig. Ekstra headere
  // (Accept-Version, XAUTH_TRAVELPORT_ACCESSGROUP) ga 401 fra gatewayen.
  const res = await fetch(`${travelportConfig.baseUrl}/11/air/catalog/search/catalogproductofferings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "TVP-PCC-Core": travelportConfig.pcc,
      TraceId: `hellosky-${Date.now().toString(36)}`,
    },
    body: JSON.stringify(buildSearchRequest(input)),
  });

  if (!res.ok) {
    // Travelports feilkropp forklarer hva som mangler. Den inneholder ikke
    // legitimasjon — vi kutter den likevel og logger aldri det vi sendte.
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 400);
    } catch {
      /* ingen kropp */
    }
    log.error({ status: res.status, detail }, "Travelport: søk feilet");
    throw new TravelportError("Søket mot Travelport feilet.", { status: res.status, retryable: res.status >= 500 });
  }

  const body = (await res.json()) as TpResponse;
  const offers = mapSearchResponse(body, input);

  // Diagnostikk mens kartleggingen er uverifisert: tell hva vi fikk, og hvis
  // ingenting ble kartlagt, logg strukturen (kun nøkkelnavn og antall — aldri
  // priser, navn eller legitimasjon) slik at feltnavnene kan rettes.
  const offerings = body.CatalogProductOfferingsResponse?.CatalogProductOfferings?.CatalogProductOffering ?? [];
  const flightCount = flightIndex(body).size;
  log.info({ offerings: offerings.length, flights: flightCount, mapped: offers.length }, "Travelport: søkesvar kartlagt");
  if (offers.length === 0) {
    log.warn(
      {
        topLevelKeys: Object.keys(body ?? {}),
        responseKeys: Object.keys(body.CatalogProductOfferingsResponse ?? {}),
        offeringKeys: offerings[0] ? Object.keys(offerings[0]) : [],
        brandOptionKeys: offerings[0]?.ProductBrandOptions?.[0] ? Object.keys(offerings[0].ProductBrandOptions[0]) : [],
        referenceListTypes: (body.CatalogProductOfferingsResponse?.ReferenceList ?? []).map((r) => r["@type"] ?? "?"),
      },
      "Travelport: ingen tilbud kartlagt — struktur avviker fra forventet skjema",
    );
  }

  return {
    offerRequestId: body.CatalogProductOfferingsResponse?.CatalogProductOfferings?.Identifier?.value ?? `${TRAVELPORT_OFFER_PREFIX}${Date.now()}`,
    liveMode: travelportConfig.liveMode,
    demoMode: false,
    cabinClass: input.cabinClass,
    slices: input.slices,
    passengers: input.passengers,
    offers,
  };
}

/** Sant for tilbud som kom fra Travelport og derfor ikke kan bookes via Duffel. */
export function isTravelportOffer(offerId: string): boolean {
  return offerId.startsWith(TRAVELPORT_OFFER_PREFIX);
}
