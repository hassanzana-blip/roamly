import { z } from "zod";
import type {
  BaggageAllowance,
  CabinClass,
  Offer,
  OfferConditions,
  OfferSlice,
  PassengerDetails,
  SearchPassengerInput,
  SearchResult,
  SearchSliceInput,
  Segment,
  Ticket,
} from "../../contracts/types";
import { airportByIata } from "../../contracts/airports";
import { env } from "./env";
import { AppError, type ErrorCode } from "./errors";
import { log } from "./logger";
import { inc } from "./metrics";
import { fromMinor, toMinor } from "./money";

// ─── Duffel API v2-klient (OTA-022–026, 030–035, 041) ───────────────────────
// API-nøkkelen finnes kun på serveren. Alle svar parses med zod (løse skjema,
// passthrough) — aldri `any`. Feil mappes til stabile AppError-koder.
//
// Implementasjonen kan byttes ut (setDuffelClient) slik at tester og
// integrasjonskjøringer bruker en in-process fake (duffelFake.ts).

const API_BASE = "https://api.duffel.com";
const TIMEOUT_SEARCH_MS = 30_000;
const TIMEOUT_ORDER_MS = 60_000;
const TIMEOUT_DEFAULT_MS = 20_000;
const MAX_RETRIES = 2;

let clientOverride: DuffelClient | null = null;

export const duffelConfig = {
  get apiKey() {
    return env.DUFFEL_API_KEY;
  },
  /** Sann når en ekte nøkkel er satt ELLER en fake-klient er injisert (tester). */
  get configured() {
    return clientOverride !== null || env.duffelConfigured;
  },
  get liveMode() {
    // En injisert klient (fake) kan late som den er live for å teste live-vern (daglig tak m.m.).
    return clientOverride === null ? env.duffelLive : Boolean(clientOverride.liveMode);
  },
  // I testmodus er Duffel-saldoen ubegrenset — standard integrasjonsvei.
  paymentType: "balance" as const,
};

export class DuffelError extends AppError {
  readonly status: number;
  readonly duffelCode?: string;
  constructor(code: ErrorCode, opts: { message?: string; status: number; duffelCode?: string; retryable?: boolean; cause?: unknown }) {
    super(code, {
      message: opts.message,
      retryable: opts.retryable,
      cause: opts.cause,
      data: { status: opts.status, ...(opts.duffelCode ? { code: opts.duffelCode } : {}) },
    });
    this.name = "DuffelError";
    this.status = opts.status;
    this.duffelCode = opts.duffelCode;
  }
}

// ─── Feilmapping (ren funksjon — testes isolert) ────────────────────────────

const OFFER_GONE_CODES = new Set(["offer_no_longer_available", "offer_request_expired", "offer_expired", "not_found"]);

export function mapDuffelError(input: { status: number; code?: string; message?: string; path: string }): DuffelError {
  const { status, code, path } = input;
  const isOfferPath = /^\/air\/offers(\/|\?|$)/.test(path) || /^\/air\/offer_requests/.test(path);
  if (code && (code === "offer_no_longer_available" || code === "offer_request_expired" || code === "offer_expired")) {
    return new DuffelError("OFFER_EXPIRED", { status, duffelCode: code });
  }
  if ((status === 404 || status === 410) && (isOfferPath || (code && OFFER_GONE_CODES.has(code)) || /selected_offers|offer/i.test(input.message ?? ""))) {
    return new DuffelError("OFFER_EXPIRED", { status, duffelCode: code });
  }
  if (status === 404) return new DuffelError("NOT_FOUND", { status, duffelCode: code });
  if (status === 429 || status === 502 || status === 503 || status === 504) {
    return new DuffelError("SUPPLIER_UNAVAILABLE", { status, duffelCode: code, retryable: true });
  }
  if (status >= 500) return new DuffelError("SUPPLIER_UNAVAILABLE", { status, duffelCode: code, retryable: true });
  if (status === 422 || status === 400) {
    return new DuffelError("SUPPLIER_REJECTED", { status, duffelCode: code });
  }
  if (status === 401 || status === 403) {
    return new DuffelError("INTERNAL", { status, duffelCode: code, message: "Leverandørintegrasjonen er feilkonfigurert." });
  }
  return new DuffelError("SUPPLIER_UNAVAILABLE", { status, duffelCode: code, retryable: status >= 500 });
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function retryAfterMs(res: Response, attempt: number): number {
  const header = res.headers.get("retry-after");
  if (header) {
    const secs = Number(header);
    if (Number.isFinite(secs) && secs >= 0) return Math.min(secs * 1000, 15_000);
    const at = Date.parse(header);
    if (Number.isFinite(at)) return Math.max(0, Math.min(at - Date.now(), 15_000));
  }
  return Math.min(500 * 2 ** attempt, 8_000) + Math.floor(Math.random() * 250);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const duffelErrorBody = z
  .object({
    errors: z.array(z.object({ code: z.string().optional(), message: z.string().optional(), title: z.string().optional() }).passthrough()).optional(),
    meta: z.object({ request_id: z.string().optional() }).passthrough().optional(),
  })
  .passthrough();

type FetchOptions<T> = {
  method?: "GET" | "POST";
  body?: unknown;
  idempotencyKey?: string;
  timeoutMs?: number;
  schema: z.ZodType<T>;
};

/**
 * HTTP-kall mot Duffel med tidsavbrudd, Idempotency-Key og retry (429/502/503/504,
 * nettverksfeil) med eksponentiell backoff + Retry-After. POST /air/orders
 * retryes ALDRI uten samme Idempotency-Key; tidsavbrudd på ordre gir
 * SUPPLIER_TIMEOUT umiddelbart slik at gjenopprettingsflyten tar over.
 */
export async function duffelFetch<T>(path: string, opts: FetchOptions<T>): Promise<T> {
  const method = opts.method ?? "GET";
  const isOrderCreate = method === "POST" && /^\/air\/orders(\?|$)/.test(path);
  const timeoutMs =
    opts.timeoutMs ??
    (path.startsWith("/air/offer_requests") ? TIMEOUT_SEARCH_MS : isOrderCreate ? TIMEOUT_ORDER_MS : TIMEOUT_DEFAULT_MS);
  const mayRetry = method === "GET" || Boolean(opts.idempotencyKey);
  if (isOrderCreate && !opts.idempotencyKey) {
    throw new AppError("INTERNAL", { message: "Ordreopprettelse krever Idempotency-Key." });
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        signal: ac.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Accept-Encoding": "gzip",
          "Duffel-Version": "v2",
          Authorization: `Bearer ${duffelConfig.apiKey}`,
          ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch (err) {
      clearTimeout(timer);
      const aborted = err instanceof Error && err.name === "AbortError";
      inc("duffel_requests_total", { outcome: aborted ? "timeout" : "network_error" });
      if (aborted) {
        if (isOrderCreate) throw new DuffelError("SUPPLIER_TIMEOUT", { status: 0, cause: err });
        lastErr = new DuffelError("SUPPLIER_TIMEOUT", { status: 0, retryable: true, cause: err });
      } else {
        lastErr = new DuffelError("SUPPLIER_UNAVAILABLE", { status: 0, retryable: true, cause: err });
      }
      if (!mayRetry || attempt === MAX_RETRIES) throw lastErr;
      await sleep(Math.min(500 * 2 ** attempt, 8_000));
      continue;
    }
    clearTimeout(timer);

    const text = await res.text();
    let json: unknown = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = {};
    }

    inc("duffel_requests_total", { outcome: res.ok ? "ok" : `http_${res.status}` });
    if (res.ok) {
      const parsed = opts.schema.safeParse(json);
      if (!parsed.success) {
        log.error({ path, issues: parsed.error.issues.slice(0, 5) }, "Duffel-svar hadde uventet form");
        throw new DuffelError("SUPPLIER_UNAVAILABLE", { status: res.status, message: "Uventet svar fra leverandøren." });
      }
      return parsed.data;
    }

    const errBody = duffelErrorBody.safeParse(json);
    const first = errBody.success ? errBody.data.errors?.[0] : undefined;
    const mapped = mapDuffelError({ status: res.status, code: first?.code, message: first?.message, path });
    log.warn(
      { path, status: res.status, duffelCode: first?.code, requestId: errBody.success ? errBody.data.meta?.request_id : undefined, attempt },
      "Duffel-feil",
    );
    if (mayRetry && isRetryableStatus(res.status) && attempt < MAX_RETRIES) {
      lastErr = mapped;
      await sleep(retryAfterMs(res, attempt));
      continue;
    }
    throw mapped;
  }
  throw lastErr instanceof Error ? lastErr : new DuffelError("SUPPLIER_UNAVAILABLE", { status: 0 });
}

// ─── Varighet ───────────────────────────────────────────────────────────────

export function isoDurationToMinutes(duration?: string | null): number {
  if (!duration) return 0;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(duration);
  if (!m) return 0;
  return (Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0);
}

export function minutesToIsoDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `PT${h}H${m}M`;
}

// ─── Zod-skjema for Duffel-objekter (løse; ukjente felt beholdes) ──────────

const zPlace = z
  .object({
    iata_code: z.string().nullable().optional(),
    iata_city_code: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    city_name: z.string().nullable().optional(),
    city: z.object({ name: z.string().nullable().optional() }).passthrough().nullable().optional(),
    iata_country_code: z.string().nullable().optional(),
    time_zone: z.string().nullable().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
  })
  .passthrough();

const zCarrier = z.object({ iata_code: z.string().nullable().optional(), name: z.string().nullable().optional() }).passthrough();

const zBaggage = z.object({ type: z.string().nullable().optional(), quantity: z.number().nullable().optional() }).passthrough();

const zSegmentPassenger = z
  .object({
    passenger_id: z.string().nullable().optional(),
    cabin_class: z.string().nullable().optional(),
    baggages: z.array(zBaggage).nullable().optional(),
  })
  .passthrough();

const zSegment = z
  .object({
    id: z.string().optional(),
    origin: zPlace.nullable().optional(),
    destination: zPlace.nullable().optional(),
    origin_terminal: z.string().nullable().optional(),
    destination_terminal: z.string().nullable().optional(),
    departing_at: z.string().nullable().optional(),
    arriving_at: z.string().nullable().optional(),
    duration: z.string().nullable().optional(),
    marketing_carrier: zCarrier.nullable().optional(),
    operating_carrier: zCarrier.nullable().optional(),
    marketing_carrier_flight_number: z.union([z.string(), z.number()]).nullable().optional(),
    aircraft: z.object({ name: z.string().nullable().optional() }).passthrough().nullable().optional(),
    passengers: z.array(zSegmentPassenger).nullable().optional(),
  })
  .passthrough();

const zSlice = z
  .object({
    id: z.string().optional(),
    origin: zPlace.nullable().optional(),
    destination: zPlace.nullable().optional(),
    duration: z.string().nullable().optional(),
    segments: z.array(zSegment).nullable().optional(),
  })
  .passthrough();

const zCondition = z
  .object({
    allowed: z.boolean().nullable().optional(),
    penalty_amount: z.string().nullable().optional(),
    penalty_currency: z.string().nullable().optional(),
  })
  .passthrough();

const zConditions = z
  .object({
    refund_before_departure: zCondition.nullable().optional(),
    change_before_departure: zCondition.nullable().optional(),
  })
  .passthrough();

const zService = z
  .object({
    id: z.string(),
    type: z.string().nullable().optional(),
    maximum_quantity: z.number().nullable().optional(),
    total_amount: z.string().nullable().optional(),
    total_currency: z.string().nullable().optional(),
    passenger_ids: z.array(z.string()).nullable().optional(),
    segment_ids: z.array(z.string()).nullable().optional(),
    metadata: z.object({ type: z.string().nullable().optional(), maximum_weight_kg: z.number().nullable().optional() }).passthrough().nullable().optional(),
  })
  .passthrough();

const zOfferPassenger = z
  .object({ id: z.string(), type: z.string().nullable().optional(), age: z.number().nullable().optional() })
  .passthrough();

const zOffer = z
  .object({
    id: z.string(),
    live_mode: z.boolean().optional(),
    total_amount: z.string(),
    total_currency: z.string(),
    base_amount: z.string().nullable().optional(),
    tax_amount: z.string().nullable().optional(),
    owner: zCarrier.nullable().optional(),
    expires_at: z.string().nullable().optional(),
    slices: z.array(zSlice).nullable().optional(),
    passengers: z.array(zOfferPassenger).nullable().optional(),
    total_emissions_kg: z.union([z.string(), z.number()]).nullable().optional(),
    conditions: zConditions.nullable().optional(),
    passenger_identity_documents_required: z.boolean().nullable().optional(),
    available_services: z.array(zService).nullable().optional(),
  })
  .passthrough();

const zOfferRequest = z
  .object({ id: z.string(), live_mode: z.boolean().optional(), offers: z.array(zOffer).nullable().optional() })
  .passthrough();

const zDocument = z
  .object({
    type: z.string().nullable().optional(),
    unique_identifier: z.string().nullable().optional(),
    passenger_ids: z.array(z.string()).nullable().optional(),
  })
  .passthrough();

const zOrderPassenger = z
  .object({
    id: z.string(),
    given_name: z.string().nullable().optional(),
    family_name: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    born_on: z.string().nullable().optional(),
  })
  .passthrough();

const zOrder = z
  .object({
    id: z.string(),
    live_mode: z.boolean().optional(),
    booking_reference: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    total_amount: z.string().nullable().optional(),
    total_currency: z.string().nullable().optional(),
    documents: z.array(zDocument).nullable().optional(),
    slices: z.array(zSlice).nullable().optional(),
    passengers: z.array(zOrderPassenger).nullable().optional(),
    payment_status: z
      .object({
        awaiting_payment: z.boolean().nullable().optional(),
        paid_at: z.string().nullable().optional(),
        payment_required_by: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    cancelled_at: z.string().nullable().optional(),
    available_actions: z.array(z.string()).nullable().optional(),
    metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).nullable().optional(),
    conditions: zConditions.nullable().optional(),
  })
  .passthrough();

const zOrderCancellation = z
  .object({
    id: z.string(),
    order_id: z.string().nullable().optional(),
    refund_amount: z.string().nullable().optional(),
    refund_currency: z.string().nullable().optional(),
    refund_to: z.string().nullable().optional(),
    expires_at: z.string().nullable().optional(),
    confirmed_at: z.string().nullable().optional(),
  })
  .passthrough();

type ZOffer = z.infer<typeof zOffer>;
type ZOrder = z.infer<typeof zOrder>;
type ZSlice = z.infer<typeof zSlice>;
type ZSegment = z.infer<typeof zSegment>;
type ZPlace = z.infer<typeof zPlace>;
type ZCarrier = z.infer<typeof zCarrier>;

// ─── Mappere Duffel → kontrakt ─────────────────────────────────────────────

function mapPlace(p: ZPlace | null | undefined) {
  const iata = p?.iata_code ?? p?.iata_city_code ?? "";
  const known = airportByIata(iata);
  return {
    iata,
    name: p?.name ?? known?.name ?? iata,
    city: p?.city_name ?? p?.city?.name ?? known?.city ?? iata,
    country: known?.country ?? p?.iata_country_code ?? "",
    lat: p?.latitude ?? known?.lat ?? 0,
    lng: p?.longitude ?? known?.lng ?? 0,
    timeZone: p?.time_zone ?? known?.timeZone,
  };
}

function mapCarrier(c: ZCarrier | null | undefined) {
  return { iata: c?.iata_code ?? "", name: c?.name ?? "" };
}

const CABINS: CabinClass[] = ["economy", "premium_economy", "business", "first"];
function asCabin(v: string | null | undefined): CabinClass {
  return CABINS.includes(v as CabinClass) ? (v as CabinClass) : "economy";
}

/**
 * Bagasje for ett segment. Duffel lister tillatelsene eksplisitt — også når
 * antallet er 0. Sier flyselskapet ingenting om en type, VET vi ikke, og det
 * er noe helt annet enn at den ikke er inkludert. Vi skiller på det her, slik
 * at siden kan si «ikke oppgitt» framfor å påstå «ikke inkludert».
 */
function segmentBaggage(seg: ZSegment): BaggageAllowance {
  let carryOn = 0;
  let checked = 0;
  let carryOnSeen = false;
  let checkedSeen = false;
  for (const b of seg.passengers?.[0]?.baggages ?? []) {
    if (b.type === "carry_on") {
      carryOn += b.quantity ?? 0;
      carryOnSeen = true;
    }
    if (b.type === "checked") {
      checked += b.quantity ?? 0;
      checkedSeen = true;
    }
  }
  return {
    carryOnBags: carryOn,
    checkedBags: checked,
    ...(carryOnSeen ? {} : { carryOnUnknown: true }),
    ...(checkedSeen ? {} : { checkedUnknown: true }),
  };
}

function mapSegment(seg: ZSegment): Segment {
  const pax0 = seg.passengers?.[0];
  const origin = mapPlace(seg.origin);
  const destination = mapPlace(seg.destination);
  return {
    id: seg.id ?? "",
    origin: { ...origin, ...(seg.origin_terminal ? { terminal: seg.origin_terminal } : {}) },
    destination: { ...destination, ...(seg.destination_terminal ? { terminal: seg.destination_terminal } : {}) },
    departingAt: seg.departing_at ?? "",
    arrivingAt: seg.arriving_at ?? "",
    durationMinutes: isoDurationToMinutes(seg.duration),
    carrier: mapCarrier(seg.marketing_carrier),
    operatingCarrier: mapCarrier(seg.operating_carrier),
    flightNumber: String(seg.marketing_carrier_flight_number ?? ""),
    aircraft: seg.aircraft?.name ?? "Ukjent flytype",
    cabinClass: asCabin(pax0?.cabin_class),
    baggage: segmentBaggage(seg),
  };
}

function mapSlice(slice: ZSlice): OfferSlice {
  const segments = (slice.segments ?? []).map(mapSegment);
  return {
    id: slice.id ?? "",
    origin: mapPlace(slice.origin),
    destination: mapPlace(slice.destination),
    departingAt: segments[0]?.departingAt ?? "",
    arrivingAt: segments[segments.length - 1]?.arrivingAt ?? "",
    durationMinutes: isoDurationToMinutes(slice.duration),
    stops: Math.max(0, segments.length - 1),
    segments,
  };
}

function mapConditions(c: ZOffer["conditions"]): OfferConditions | undefined {
  if (!c) return undefined;
  const one = (x: NonNullable<ZOffer["conditions"]>["refund_before_departure"]) =>
    x ? { allowed: Boolean(x.allowed), penaltyAmount: x.penalty_amount ?? null, penaltyCurrency: x.penalty_currency ?? null } : undefined;
  return { refundBeforeDeparture: one(c.refund_before_departure), changeBeforeDeparture: one(c.change_before_departure) };
}

/** Intern representasjon av bagasjetjenester (per passasjer og segment). */
export type BagService = {
  id: string;
  passengerIds: string[];
  segmentIds: string[];
  totalAmount: string;
  currency: string;
  maxQuantity: number;
};

export function extractBagServices(o: Pick<ZOffer, "available_services">): BagService[] {
  return (o.available_services ?? [])
    .filter((s) => s.type === "baggage" && s.total_amount && s.total_currency)
    .map((s) => ({
      id: s.id,
      passengerIds: s.passenger_ids ?? [],
      segmentIds: s.segment_ids ?? [],
      totalAmount: s.total_amount as string,
      currency: s.total_currency as string,
      maxQuantity: Math.max(0, s.maximum_quantity ?? 0),
    }));
}

/**
 * Oppsummering til kontrakten: pris for ÉN ekstra kolli for hele reisen (sum
 * over segmentene for første passasjer) og maks antall (minste maximum_quantity).
 */
function summarizeBagServices(services: BagService[], firstPassengerId: string | undefined, currency: string) {
  const forPax = services.filter((s) => (firstPassengerId ? s.passengerIds.includes(firstPassengerId) : true));
  if (forPax.length === 0) return undefined;
  let perBagMinor = 0;
  let max = Infinity;
  for (const s of forPax) {
    perBagMinor += toMinor(s.totalAmount, currency);
    max = Math.min(max, s.maxQuantity);
  }
  const maxExtraBags = Math.min(3, Number.isFinite(max) ? max : 0);
  if (maxExtraBags <= 0) return undefined;
  return { maxExtraBags, extraBagPrice: fromMinor(perBagMinor, currency), bagServiceId: forPax[0].id };
}

export function mapOffer(o: ZOffer): Offer {
  const slices = (o.slices ?? []).map(mapSlice);
  // Bagasje: minste tillatte antall på tvers av segmentene i hver slice (aldri lov å love mer enn det svakeste leddet).
  // Mangler tillatelsen på ett eneste segment, er den ukjent for hele reisen.
  let carryOn = Infinity;
  let checked = Infinity;
  let carryOnUnknown = false;
  let checkedUnknown = false;
  for (const s of slices) {
    for (const seg of s.segments) {
      carryOn = Math.min(carryOn, seg.baggage?.carryOnBags ?? 0);
      checked = Math.min(checked, seg.baggage?.checkedBags ?? 0);
      if (!seg.baggage || seg.baggage.carryOnUnknown) carryOnUnknown = true;
      if (!seg.baggage || seg.baggage.checkedUnknown) checkedUnknown = true;
    }
  }
  const services = extractBagServices(o);
  const passengers = (o.passengers ?? []).map((p) => ({
    id: p.id,
    type: (p.type ?? "adult") as Offer["passengers"][number]["type"],
    age: p.age ?? undefined,
  }));
  return {
    id: o.id,
    totalAmount: o.total_amount,
    totalCurrency: o.total_currency,
    baseAmount: o.base_amount ?? o.total_amount,
    taxAmount: o.tax_amount ?? "0",
    owner: mapCarrier(o.owner),
    expiresAt: o.expires_at ?? "",
    cabinClass: slices[0]?.segments[0]?.cabinClass ?? "economy",
    slices,
    passengers,
    baggage: {
      carryOnBags: Number.isFinite(carryOn) ? carryOn : 0,
      checkedBags: Number.isFinite(checked) ? checked : 0,
      ...(carryOnUnknown ? { carryOnUnknown: true } : {}),
      ...(checkedUnknown ? { checkedUnknown: true } : {}),
    },
    emissionsKg: Math.round(Number(o.total_emissions_kg ?? 0)) || 0,
    refundable: Boolean(o.conditions?.refund_before_departure?.allowed),
    changeable: Boolean(o.conditions?.change_before_departure?.allowed),
    conditions: mapConditions(o.conditions),
    identityDocumentsRequired: Boolean(o.passenger_identity_documents_required),
    services: summarizeBagServices(services, passengers[0]?.id, o.total_currency),
  };
}

// ─── Ordre (leverandørens sannhet) ─────────────────────────────────────────

export type SupplierOrder = {
  id: string;
  liveMode: boolean;
  bookingReference: string;
  createdAt: string;
  totalAmount: string;
  totalCurrency: string;
  slices: OfferSlice[];
  passengers: Array<{ id: string; givenName: string; familyName: string; type: string }>;
  tickets: Ticket[];
  paymentStatus: { awaitingPayment: boolean; paidAt: string | null; paymentRequiredBy: string | null };
  cancelledAt: string | null;
  availableActions: string[];
  metadata: Record<string, string>;
  conditions?: OfferConditions;
};

export function mapOrder(o: ZOrder): SupplierOrder {
  const passengers = (o.passengers ?? []).map((p) => ({
    id: p.id,
    givenName: p.given_name ?? "",
    familyName: p.family_name ?? "",
    type: p.type ?? "adult",
  }));
  const nameOf = (id: string | undefined) => {
    const p = passengers.find((x) => x.id === id);
    return p ? `${p.givenName} ${p.familyName}`.trim() : null;
  };
  const tickets: Ticket[] = (o.documents ?? [])
    .filter((d) => Boolean(d.unique_identifier))
    .map((d) => ({
      passengerId: d.passenger_ids?.[0] ?? null,
      passengerName: nameOf(d.passenger_ids?.[0]),
      type: d.type ?? "electronic_ticket",
      uniqueIdentifier: d.unique_identifier as string,
    }));
  const metadata: Record<string, string> = {};
  for (const [k, v] of Object.entries(o.metadata ?? {})) if (v != null) metadata[k] = String(v);
  return {
    id: o.id,
    liveMode: Boolean(o.live_mode),
    bookingReference: (o.booking_reference ?? "").toUpperCase(),
    createdAt: o.created_at ?? new Date().toISOString(),
    totalAmount: o.total_amount ?? "0",
    totalCurrency: o.total_currency ?? "NOK",
    slices: (o.slices ?? []).map(mapSlice),
    passengers,
    tickets,
    paymentStatus: {
      awaitingPayment: Boolean(o.payment_status?.awaiting_payment),
      paidAt: o.payment_status?.paid_at ?? null,
      paymentRequiredBy: o.payment_status?.payment_required_by ?? null,
    },
    cancelledAt: o.cancelled_at ?? null,
    availableActions: o.available_actions ?? [],
    metadata,
    conditions: mapConditions(o.conditions),
  };
}

export type CancellationQuote = {
  id: string;
  orderId: string;
  refundAmount: string;
  refundCurrency: string;
  refundTo: string;
  expiresAt: string | null;
  confirmedAt: string | null;
};

function mapCancellation(c: z.infer<typeof zOrderCancellation>): CancellationQuote {
  return {
    id: c.id,
    orderId: c.order_id ?? "",
    refundAmount: c.refund_amount ?? "0",
    refundCurrency: c.refund_currency ?? "NOK",
    refundTo: c.refund_to ?? "balance",
    expiresAt: c.expires_at ?? null,
    confirmedAt: c.confirmed_at ?? null,
  };
}

// ─── Tjenestevalg og betalingsbeløp (rene funksjoner) ──────────────────────

export type OrderServicesInput = { extraBags: number; bagsByPassenger?: Record<string, number> };

/** Velg bagasjetjenester (id + antall) for hver passasjer ut fra ønsket fordeling. */
export function selectBagServices(
  rawServices: BagService[],
  passengers: Array<{ id: string; type: string }>,
  services: OrderServicesInput | undefined,
): Array<{ id: string; quantity: number; amountMinor: number; currency: string }> {
  if (!services || services.extraBags <= 0 || rawServices.length === 0) return [];
  const eligible = passengers.filter((p) => p.type !== "infant_without_seat");
  const byPassenger: Record<string, number> = {};
  const provided = services.bagsByPassenger;
  let sum = 0;
  if (provided) {
    for (const p of eligible) {
      const n = Math.max(0, Math.floor(provided[p.id] ?? 0));
      if (n > 0) byPassenger[p.id] = n;
      sum += n;
    }
  }
  if (sum !== services.extraBags) {
    // Rund-robin-fordeling (samme regel som contracts/extras.distributeBags)
    for (const k of Object.keys(byPassenger)) delete byPassenger[k];
    let remaining = services.extraBags;
    let i = 0;
    while (remaining > 0 && eligible.length > 0 && i < services.extraBags * eligible.length + 1) {
      const p = eligible[i % eligible.length];
      if ((byPassenger[p.id] ?? 0) < 3) {
        byPassenger[p.id] = (byPassenger[p.id] ?? 0) + 1;
        remaining -= 1;
      }
      i += 1;
    }
  }
  const out: Array<{ id: string; quantity: number; amountMinor: number; currency: string }> = [];
  for (const [paxId, wanted] of Object.entries(byPassenger)) {
    const forPax = rawServices.filter((s) => s.passengerIds.includes(paxId));
    for (const s of forPax) {
      const quantity = Math.min(wanted, s.maxQuantity);
      if (quantity <= 0) continue;
      out.push({ id: s.id, quantity, amountMinor: toMinor(s.totalAmount, s.currency) * quantity, currency: s.currency });
    }
  }
  return out;
}

/** Beløpet Duffel skal belaste: tilbudets total + Σ valgte tjenester (minste enhet). */
export function orderPaymentAmount(
  offer: Pick<Offer, "totalAmount" | "totalCurrency">,
  selected: Array<{ amountMinor: number; currency: string }>,
): { amountMinor: number; currency: string; amount: string } {
  const currency = offer.totalCurrency.toUpperCase();
  let minor = toMinor(offer.totalAmount, currency);
  for (const s of selected) {
    if (s.currency.toUpperCase() !== currency) throw new AppError("INTERNAL", { message: "Tjeneste i annen valuta enn tilbudet." });
    minor += s.amountMinor;
  }
  return { amountMinor: minor, currency, amount: fromMinor(minor, currency) };
}

// ─── Klientgrensesnitt (byttbart) ──────────────────────────────────────────

export type SearchInput = { slices: SearchSliceInput[]; passengers: SearchPassengerInput[]; cabinClass: CabinClass };

export type CreateOrderInput = {
  offer: Offer;
  rawServices: BagService[];
  passengers: PassengerDetails[];
  contactEmail: string;
  contactPhone: string;
  services?: OrderServicesInput;
  idempotencyKey: string;
  /** Sporbarhet for gjenoppretting: metadata.attempt_id. */
  attemptId: number | string;
  paymentType?: "balance";
  /** Forventet beløp (minste enhet) — må stemme med tilbud + tjenester. */
  amountMinor: number;
  currency: string;
};

export interface DuffelClient {
  search(input: SearchInput): Promise<SearchResult>;
  getOffer(offerId: string): Promise<Offer>;
  getOfferRaw(offerId: string): Promise<{ offer: Offer; rawServices: BagService[] }>;
  createOrder(input: CreateOrderInput): Promise<SupplierOrder>;
  getOrder(orderId: string): Promise<SupplierOrder>;
  findOrderByAttempt(attemptId: number | string, createdAfter: Date): Promise<SupplierOrder | null>;
  createOrderCancellation(orderId: string): Promise<CancellationQuote>;
  confirmOrderCancellation(cancellationId: string): Promise<CancellationQuote>;
  listOrderCancellations?(orderId: string): Promise<CancellationQuote[]>;
  /** Kun for injiserte klienter: rapporter live-modus (default false). */
  liveMode?: boolean;
}

export function setDuffelClient(client: DuffelClient | null): void {
  clientOverride = client;
}

export function getDuffelClient(): DuffelClient {
  return clientOverride ?? httpClient;
}

// ─── HTTP-implementasjonen ─────────────────────────────────────────────────

function buildPassengerPayload(p: PassengerDetails, contactEmail: string, contactPhone: string) {
  return {
    id: p.id,
    given_name: p.givenName,
    family_name: p.familyName,
    born_on: p.bornOn,
    email: p.email ?? contactEmail,
    phone_number: p.phoneNumber ?? contactPhone,
    ...(p.title ? { title: p.title } : {}),
    ...(p.gender ? { gender: p.gender } : {}),
    ...(p.infantPassengerId ? { infant_passenger_id: p.infantPassengerId } : {}),
    ...(p.identityDocument
      ? {
          identity_documents: [
            {
              type: "passport",
              unique_identifier: p.identityDocument.uniqueIdentifier,
              issuing_country_code: p.identityDocument.issuingCountryCode,
              expires_on: p.identityDocument.expiresOn,
            },
          ],
        }
      : {}),
  };
}

const httpClient: DuffelClient = {
  async search(input) {
    const res = await duffelFetch("/air/offer_requests?return_offers=true&supplier_timeout=20000", {
      method: "POST",
      schema: z.object({ data: zOfferRequest }).passthrough(),
      body: {
        data: {
          slices: input.slices.map((s) => ({ origin: s.origin, destination: s.destination, departure_date: s.departureDate })),
          passengers: input.passengers.map((p) => (p.age !== undefined && p.type !== "adult" ? { age: p.age } : { type: p.type })),
          cabin_class: input.cabinClass,
          max_connections: 2,
        },
      },
    });
    const data = res.data;
    return {
      offerRequestId: data.id,
      liveMode: Boolean(data.live_mode),
      demoMode: false,
      cabinClass: input.cabinClass,
      slices: input.slices,
      passengers: input.passengers,
      offers: (data.offers ?? []).map(mapOffer),
    };
  },

  async getOffer(offerId) {
    return (await this.getOfferRaw(offerId)).offer;
  },

  async getOfferRaw(offerId) {
    const res = await duffelFetch(`/air/offers/${encodeURIComponent(offerId)}?return_available_services=true`, {
      schema: z.object({ data: zOffer }).passthrough(),
    });
    return { offer: mapOffer(res.data), rawServices: extractBagServices(res.data) };
  },

  async createOrder(input) {
    const selected = selectBagServices(input.rawServices, input.offer.passengers, input.services);
    const payment = orderPaymentAmount(input.offer, selected);
    if (payment.amountMinor !== input.amountMinor || payment.currency !== input.currency.toUpperCase()) {
      throw new AppError("PRICE_CHANGED", {
        message: "Beløpet til leverandøren stemmer ikke med det kunden godtok.",
        data: { expectedMinor: input.amountMinor, computedMinor: payment.amountMinor },
      });
    }
    const res = await duffelFetch("/air/orders", {
      method: "POST",
      idempotencyKey: input.idempotencyKey,
      schema: z.object({ data: zOrder }).passthrough(),
      body: {
        data: {
          type: "instant",
          selected_offers: [input.offer.id],
          ...(selected.length ? { services: selected.map((s) => ({ id: s.id, quantity: s.quantity })) } : {}),
          payments: [{ type: input.paymentType ?? duffelConfig.paymentType, currency: payment.currency, amount: payment.amount }],
          passengers: input.passengers.map((p) => buildPassengerPayload(p, input.contactEmail, input.contactPhone)),
          metadata: { source: "hellosky", attempt_id: String(input.attemptId) },
        },
      },
    });
    return mapOrder(res.data);
  },

  async getOrder(orderId) {
    const res = await duffelFetch(`/air/orders/${encodeURIComponent(orderId)}`, { schema: z.object({ data: zOrder }).passthrough() });
    return mapOrder(res.data);
  },

  /** Gjenoppretting etter tidsavbrudd: finn ordre via metadata.attempt_id blant nylige ordrer. */
  async findOrderByAttempt(attemptId, createdAfter) {
    const wanted = String(attemptId);
    let after: string | null = null;
    for (let page = 0; page < 5; page++) {
      const path = `/air/orders?limit=50&sort=-created_at${after ? `&after=${encodeURIComponent(after)}` : ""}`;
      const res: { data: ZOrder[]; meta?: { after?: string | null } } = await duffelFetch(path, {
        schema: z.object({ data: z.array(zOrder), meta: z.object({ after: z.string().nullable().optional() }).passthrough().optional() }).passthrough(),
      });
      for (const o of res.data) {
        if (String(o.metadata?.attempt_id ?? "") === wanted) return mapOrder(o);
      }
      const oldest = res.data[res.data.length - 1];
      if (!oldest || (oldest.created_at && new Date(oldest.created_at) < createdAfter)) return null;
      after = res.meta?.after ?? null;
      if (!after) return null;
    }
    return null;
  },

  async createOrderCancellation(orderId) {
    const res = await duffelFetch("/air/order_cancellations", {
      method: "POST",
      idempotencyKey: `cancel:${orderId}:${Date.now()}`,
      schema: z.object({ data: zOrderCancellation }).passthrough(),
      body: { data: { order_id: orderId } },
    });
    return mapCancellation(res.data);
  },

  async confirmOrderCancellation(cancellationId) {
    const res = await duffelFetch(`/air/order_cancellations/${encodeURIComponent(cancellationId)}/actions/confirm`, {
      method: "POST",
      idempotencyKey: `cancel-confirm:${cancellationId}`,
      schema: z.object({ data: zOrderCancellation }).passthrough(),
    });
    return mapCancellation(res.data);
  },

  async listOrderCancellations(orderId) {
    const res = await duffelFetch(`/air/order_cancellations?order_id=${encodeURIComponent(orderId)}&limit=50`, {
      schema: z.object({ data: z.array(zOrderCancellation) }).passthrough(),
    });
    return res.data.map(mapCancellation);
  },
};

// ─── Eksporterte hjelpere (brukes av andre moduler) ────────────────────────

export const duffelSearch = (input: SearchInput) => getDuffelClient().search(input);
export const duffelGetOffer = (offerId: string) => getDuffelClient().getOffer(offerId);
export const getOfferRaw = (offerId: string) => getDuffelClient().getOfferRaw(offerId);
export const duffelCreateOrder = (input: CreateOrderInput) => getDuffelClient().createOrder(input);
export const duffelGetOrder = (orderId: string) => getDuffelClient().getOrder(orderId);
export const duffelGetOrderByIdempotency = (attemptId: number | string, createdAfter: Date) =>
  getDuffelClient().findOrderByAttempt(attemptId, createdAfter);
export const duffelCreateOrderCancellation = (orderId: string) => getDuffelClient().createOrderCancellation(orderId);
export const duffelConfirmOrderCancellation = (id: string) => getDuffelClient().confirmOrderCancellation(id);
export const duffelListOrderCancellations = async (orderId: string) => {
  const c = getDuffelClient();
  return c.listOrderCancellations ? c.listOrderCancellations(orderId) : [];
};
