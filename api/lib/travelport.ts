import { AppError } from "./errors";
import { env } from "./env";
import { log } from "./logger";
import type { CabinClass, Offer, OfferSlice, SearchResult, Segment, SearchSliceInput, SearchPassengerInput } from "@contracts/types";
import { airportByIata } from "@contracts/airports";

/**
 * Travelport JSON API (v11) — søk.
 *
 * Forespørsel, headere og kartlegging er rettet etter Travelports egen DevKit
 * (v11 GDS Full Payload, v26.11.1), og testene kjører mot et ekte lagret
 * 200-svar derfra. Selve nettverkskallet er fortsatt ikke kjørt herfra —
 * utviklingsmiljøet når ikke travelport.com — så første ekte søk kan avdekke
 * felter DevKit-eksempelet ikke inneholdt.
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
    // Slik kontoens egen hurtigstart gjør det: .com med JSON-kropp.
    return (env.TRAVELPORT_AUTH_URL ?? "https://auth.pp.travelport.com/oauth/token").replace(/\/$/, "");
  },
  get baseUrl(): string {
    return (env.TRAVELPORT_BASE_URL ?? "https://api.pp.travelport.net").replace(/\/$/, "");
  },
  get pcc(): string {
    return env.TRAVELPORT_PCC ?? "";
  },
  /** Kontoen avgjør hvilket innhold den har rett på — denne trialen er NDC. */
  get contentSource(): string {
    return env.TRAVELPORT_CONTENT_SOURCE ?? "NDC";
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
    headers: { "Content-Type": "application/json", Accept: "application/json" },
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

  const body = (await res.json()) as { access_token?: string; expires_in?: number; token_type?: string };
  if (!body.access_token) throw new TravelportError("Travelport svarte uten access_token.");
  const ttlMs = (typeof body.expires_in === "number" && body.expires_in > 0 ? body.expires_in : 3600) * 1000;
  cached = { token: body.access_token, expiresAt: now + ttlMs };
  authFailure = null;
  // Diagnostikk: hvilke felter kom, og hvem er tokenet utstedt til? Kun
  // metadata (aud/iss/scope) — aldri selve tokenet eller signaturen.
  log.info(
    {
      ttlSeconds: Math.round(ttlMs / 1000),
      fields: Object.keys(body),
      tokenType: body.token_type ?? null,
      claims: tokenClaims(body.access_token),
    },
    "Travelport: token hentet",
  );
  return cached.token;
}

/** Leser ut aud/iss/scope fra en JWT uten å verifisere eller logge den. */
function tokenClaims(jwt: string): Record<string, unknown> | null {
  try {
    const part = jwt.split(".")[1];
    if (!part) return null;
    const json = JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as Record<string, unknown>;
    return {
      aud: json.aud ?? null,
      iss: json.iss ?? null,
      scope: json.scope ?? null,
      typ: json.typ ?? null,
    };
  } catch {
    return null;
  }
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

  // Nøstingen følger DevKit-en: «@type» på toppnivå og nøkkelen
  // CatalogProductOfferingsRequest (ikke …RequestAir) rundt selve forespørselen.
  return {
    "@type": "CatalogProductOfferingsQueryRequest",
    CatalogProductOfferingsRequest: {
      "@type": "CatalogProductOfferingsRequestAir",
      maxNumberOfUpsellsToReturn: 4,
      contentSourceList: [travelportConfig.contentSource],
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
  distance?: number;
  equipment?: string;
  operatingCarrier?: string;
  operatingCarrierName?: string;
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
  // Svaret har ikke noe eget navnefelt for markedsførende selskap — bare
  // operatingCarrierName. Uten et navn viser vi koden framfor å finne på et.
  return {
    id: String(f.id ?? `${carrier}${f.number ?? ""}`),
    origin: point(f.Departure?.location, f.Departure?.terminal),
    destination: point(f.Arrival?.location, f.Arrival?.terminal),
    departingAt: toIso(f.Departure?.date, f.Departure?.time),
    arrivingAt: toIso(f.Arrival?.date, f.Arrival?.time),
    durationMinutes: isoDurationToMinutes(f.duration),
    carrier: { iata: carrier, name: carrier },
    ...(f.operatingCarrier && f.operatingCarrier.toUpperCase() !== carrier
      ? { operatingCarrier: { iata: f.operatingCarrier.toUpperCase(), name: f.operatingCarrierName ?? f.operatingCarrier.toUpperCase() } }
      : {}),
    flightNumber: `${carrier}${f.number ?? ""}`,
    aircraft: f.equipment ?? "",
    cabinClass: cabin,
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

/** Prisblokken heter BestCombinablePrice i GDS-svaret; Price finnes i andre varianter. */
type TpPrice = {
  TotalPrice?: number;
  Base?: number;
  TotalTaxes?: number;
  TotalFees?: number;
  CurrencyCode?: { value?: string; decimalPlace?: number };
};

/** ProductAir i ReferenceListProduct — bærer kabin og total reisetid. */
type TpProduct = {
  id?: string;
  totalDuration?: string;
  FlightSegment?: Array<{ sequence?: number; Flight?: { FlightRef?: string } }>;
  PassengerFlight?: Array<{ FlightProduct?: Array<{ cabin?: string; classOfService?: string }> }>;
};

type TpResponse = {
  CatalogProductOfferingsResponse?: {
    transactionId?: string;
    CatalogProductOfferings?: {
      Identifier?: { value?: string };
      CatalogProductOffering?: Array<{
        id?: string;
        sequence?: number;
        ProductBrandOptions?: Array<{
          flightRefs?: string[];
          ProductBrandOffering?: Array<{
            id?: string;
            Identifier?: { value?: string; authority?: string };
            BestCombinablePrice?: TpPrice;
            Price?: TpPrice;
            Product?: Array<{ productRef?: string }>;
            Brand?: { BrandRef?: string };
          }>;
        }>;
      }>;
    };
    ReferenceList?: Array<{ "@type"?: string; Flight?: TpFlight[]; Product?: TpProduct[] }>;
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

/** Indekserer ReferenceListProduct — der kabinen faktisk står. */
function productIndex(body: TpResponse): Map<string, TpProduct> {
  const list = body.CatalogProductOfferingsResponse?.ReferenceList ?? [];
  const index = new Map<string, TpProduct>();
  for (const ref of list) {
    for (const p of ref.Product ?? []) if (p.id) index.set(String(p.id), p);
  }
  return index;
}

/**
 * GDS lister flightRefs rett på ProductBrandOptions. NDC gjør det ikke — der
 * er flygningene bare tilgjengelige via produktets FlightSegment. Rekkefølgen
 * er `sequence`, ikke rekkefølgen i lista.
 */
function flightRefsOfProduct(product: TpProduct | undefined): string[] {
  return [...(product?.FlightSegment ?? [])]
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    .map((seg) => seg.Flight?.FlightRef)
    .filter((ref): ref is string => Boolean(ref));
}

/** Kabinen ligger på produktet, ikke på flygningen. */
function cabinOfProduct(product: TpProduct | undefined, fallback: CabinClass): CabinClass {
  const raw = product?.PassengerFlight?.[0]?.FlightProduct?.[0]?.cabin ?? "";
  return CABIN_FROM_TP[raw.toLowerCase().replace(/[^a-z]/g, "")] ?? fallback;
}

/**
 * Mapper svaret til Offer[]. Alt som mangler pris, valuta eller segmenter
 * hoppes over i stedet for å bli fylt inn med gjetninger.
 */
export function mapSearchResponse(body: TpResponse, input: TravelportSearchInput): Offer[] {
  const flights = flightIndex(body);
  const products = productIndex(body);
  const offerings = body.CatalogProductOfferingsResponse?.CatalogProductOfferings?.CatalogProductOffering ?? [];
  const offers: Offer[] = [];

  for (const offering of offerings) {
    for (const option of offering.ProductBrandOptions ?? []) {
      for (const brand of option.ProductBrandOffering ?? []) {
        // Prisen ligger i BestCombinablePrice i både GDS- og NDC-svar.
        const price = brand.BestCombinablePrice ?? brand.Price;
        const currency = price?.CurrencyCode?.value;
        if (!price || typeof price.TotalPrice !== "number" || !currency) continue;

        const base = typeof price.Base === "number" ? price.Base : price.TotalPrice;
        const fees = typeof price.TotalFees === "number" ? price.TotalFees : 0;
        const tax = typeof price.TotalTaxes === "number" ? price.TotalTaxes + fees : Math.max(0, price.TotalPrice - base);
        const product = products.get(String(brand.Product?.[0]?.productRef ?? ""));

        // GDS: flightRefs på opsjonen. NDC: bare via produktet.
        const refs = option.flightRefs?.length ? option.flightRefs : flightRefsOfProduct(product);
        const rawFlights = refs.map((ref) => flights.get(String(ref))).filter((f): f is TpFlight => Boolean(f));
        if (rawFlights.length === 0) continue;

        const cabin = cabinOfProduct(product, input.cabinClass);
        const segments = rawFlights.map((f) => mapSegment(f, cabin));

        offers.push({
          id: `${TRAVELPORT_OFFER_PREFIX}${offering.id ?? ""}_${brand.id ?? brand.Identifier?.value ?? brand.Product?.[0]?.productRef ?? segments[0].id}`,
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

  return collapseBrandVariants(offers);
}

/**
 * NDC gir ett tilbud per merkenivå per produkt — én reise JFK–LAX ble til 122
 * nesten like kort. Vi beholder det billigste tilbudet per reise og kabin, så
 * lista viser faktiske valg framfor det samme flyet om og om igjen.
 */
function collapseBrandVariants(offers: Offer[]): Offer[] {
  const cheapest = new Map<string, Offer>();
  for (const offer of offers) {
    const journey = offer.slices
      .map((sl) => sl.segments.map((seg) => `${seg.flightNumber}@${seg.departingAt}`).join(">"))
      .join("|");
    const key = `${journey}#${offer.cabinClass}`;
    const seen = cheapest.get(key);
    if (!seen || Number(offer.totalAmount) < Number(seen.totalAmount)) cheapest.set(key, offer);
  }
  return [...cheapest.values()];
}

// ─── Søk ─────────────────────────────────────────────────────────────────────

export async function travelportSearch(input: TravelportSearchInput): Promise<SearchResult> {
  if (!travelportConfig.searchEnabled) throw new TravelportError("Travelport-søk er ikke slått på.");
  const token = await travelportToken();

  // Headerne følger hurtigstarten for denne kontoen: PCC-en sendes som
  // TVP-PCC-Core, og det er ingen tilgangsgruppe-header i det hele tatt.
  const res = await fetch(`${travelportConfig.baseUrl}/11/air/catalog/search/catalogproductofferings`, {
    method: "POST",
    headers: {
      "Accept-Encoding": "gzip, deflate",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
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

/**
 * MIDLERTIDIG feilsøking: prøver flere header- og URL-varianter og logger hva
 * hver enkelt svarer, slik at vi finner den kombinasjonen gatewayen godtar
 * uten å gjette én om gangen. Fjernes når integrasjonen virker.
 */
export async function travelportProbeVariants(): Promise<void> {
  const departureDate = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const token = await travelportToken();
  const url = `${travelportConfig.baseUrl}/11/air/catalog/search/catalogproductofferings`;
  const headers: Record<string, string> = {
    "Accept-Encoding": "gzip, deflate",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "TVP-PCC-Core": travelportConfig.pcc,
    TraceId: "hellosky-probe",
  };

  // NDC-testinnholdet dekker bare enkelte selskaper og ruter. Hurtigstarten
  // bruker JFK–LAX med American Airlines; prøv den før våre egne ruter.
  const cases: Array<{ name: string; from: string; to: string; carrier?: string }> = [
    { name: "JFK-LAX/AA (hurtigstartens eksempel)", from: "JFK", to: "LAX", carrier: "AA" },
    { name: "JFK-LAX uten selskapsvalg", from: "JFK", to: "LAX" },
    { name: "LHR-JFK", from: "LHR", to: "JFK" },
    { name: "OSL-LHR (vår rute)", from: "OSL", to: "LHR" },
  ];

  for (const c of cases) {
    const search = { slices: [{ origin: c.from, destination: c.to, departureDate }], passengers: [{ type: "adult" as const }], cabinClass: "economy" as const };
    const request = buildSearchRequest(search) as Record<string, Record<string, unknown>>;
    if (c.carrier) {
      request.CatalogProductOfferingsRequest.SearchModifiersAir = {
        "@type": "SearchModifiersAir",
        CarrierPreference: [{ "@type": "CarrierPreference", preferenceType: "Preferred", carriers: [c.carrier] }],
      };
    }
    try {
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(request) });
      const text = await res.text();
      if (!res.ok) {
        log.info({ case: c.name, status: res.status, detail: text.slice(0, 200) }, "Travelport-rute feilet");
        continue;
      }
      const parsed = JSON.parse(text) as TpResponse;
      const offerings = parsed.CatalogProductOfferingsResponse?.CatalogProductOfferings?.CatalogProductOffering?.length ?? 0;
      const offers = mapSearchResponse(parsed, search);
      log.info({ case: c.name, offerings, mapped: offers.length, sample: offers[0] ? `${offers[0].totalAmount} ${offers[0].totalCurrency}` : null }, "Travelport-rute");
      if (offerings > 0 && offers.length === 0) {
        // NDC-svaret har innhold, men kartleggingen fant ingenting. Logg
        // strukturen (testdata, ingen persondata) så feltnavnene kan rettes.
        const first = parsed.CatalogProductOfferingsResponse?.CatalogProductOfferings?.CatalogProductOffering?.[0];
        const refTypes = (parsed.CatalogProductOfferingsResponse?.ReferenceList ?? []).map((r) => r["@type"] ?? "?");
        log.info({ case: c.name, refTypes, offering: JSON.stringify(first).slice(0, 1800) }, "Travelport-struktur");
      }
      if (offers.length > 0) {
        log.info({ case: c.name, offers: offers.length, first: offers[0] }, "Travelport: EKTE TILBUD KARTLAGT");
        return;
      }
    } catch (err) {
      log.info({ case: c.name, err: String(err).slice(0, 160) }, "Travelport-rute kastet");
    }
  }
}






