import type {
  CabinClass,
  FlightStatus,
  FlightStatusCode,
  Offer,
  OfferSlice,
  SearchPassengerInput,
  SearchResult,
  SearchSliceInput,
  Segment,
} from "../../contracts/types";
import { airportByIata, type Airport } from "../../contracts/airports";
import { env } from "./env";
import type { SupplierOrder } from "./duffel";
import { fromMinor, toMinor } from "./money";

// ─── Demo engine ────────────────────────────────────────────────────────────
// Deterministic, Duffel-shaped data so the full product works end-to-end
// before a Duffel API key is configured. Same contract types, same flow.
// Demomotoren kjører ALDRI i produksjon (assertNotProd) — der er en ekte
// Duffel-nøkkel påkrevd (se env.assertProductionSafety).

function assertNotProd(): void {
  if (env.isProdEnv) throw new Error("Demomodus er forbudt i produksjon (APP_ENV=production).");
}

interface DemoCarrier {
  iata: string;
  name: string;
  hubs: string[];
  priceFactor: number; // multiplier on per-km base
  flightNoBase: number;
}

const CARRIERS: DemoCarrier[] = [
  { iata: "DY", name: "Norwegian", hubs: ["OSL", "BGO", "TRD", "SVG"], priceFactor: 0.82, flightNoBase: 400 },
  { iata: "SK", name: "SAS", hubs: ["OSL", "CPH", "ARN"], priceFactor: 1.0, flightNoBase: 250 },
  { iata: "WF", name: "Widerøe", hubs: ["OSL", "BGO", "TRD", "BOO", "SVG"], priceFactor: 1.12, flightNoBase: 700 },
  { iata: "KL", name: "KLM", hubs: ["AMS"], priceFactor: 1.05, flightNoBase: 1100 },
  { iata: "LH", name: "Lufthansa", hubs: ["FRA", "MUC"], priceFactor: 1.08, flightNoBase: 2400 },
  { iata: "BA", name: "British Airways", hubs: ["LHR"], priceFactor: 1.06, flightNoBase: 700 },
  { iata: "AF", name: "Air France", hubs: ["CDG"], priceFactor: 1.04, flightNoBase: 1200 },
  { iata: "AY", name: "Finnair", hubs: ["HEL"], priceFactor: 1.02, flightNoBase: 900 },
  { iata: "FI", name: "Icelandair", hubs: ["KEF"], priceFactor: 0.96, flightNoBase: 300 },
  { iata: "TK", name: "Turkish Airlines", hubs: ["IST"], priceFactor: 0.94, flightNoBase: 1700 },
  { iata: "EK", name: "Emirates", hubs: ["DXB"], priceFactor: 1.25, flightNoBase: 150 },
  { iata: "QR", name: "Qatar Airways", hubs: ["DOH"], priceFactor: 1.18, flightNoBase: 170 },
  { iata: "SQ", name: "Singapore Airlines", hubs: ["SIN"], priceFactor: 1.22, flightNoBase: 350 },
  { iata: "FR", name: "Ryanair", hubs: ["STN", "DUB"], priceFactor: 0.62, flightNoBase: 2400 },
  { iata: "U2", name: "easyJet", hubs: ["LGW", "AMS"], priceFactor: 0.68, flightNoBase: 8000 },
  { iata: "DL", name: "Delta Air Lines", hubs: ["JFK"], priceFactor: 1.1, flightNoBase: 100 },
  { iata: "UA", name: "United Airlines", hubs: ["EWR", "ORD"], priceFactor: 1.08, flightNoBase: 900 },
];

const AIRCRAFT: Record<string, string> = {
  DY: "Boeing 737 MAX 8",
  SK: "Airbus A320neo",
  WF: "De Havilland Dash 8-400",
  KL: "Boeing 737-900",
  LH: "Airbus A321",
  BA: "Airbus A320",
  AF: "Airbus A220-300",
  AY: "Airbus A350-900",
  FI: "Boeing 757-200",
  TK: "Airbus A321neo",
  EK: "Airbus A380-800",
  QR: "Boeing 787-9",
  SQ: "Airbus A350-900",
  FR: "Boeing 737-800",
  U2: "Airbus A320",
  DL: "Boeing 767-300",
  UA: "Boeing 787-10",
};

// ─── Deterministic hashing ──────────────────────────────────────────────────

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.floor(seed * arr.length) % arr.length];
}

// ─── Geography ──────────────────────────────────────────────────────────────

function haversineKm(a: Airport, b: Airport): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function flightMinutes(km: number): number {
  return Math.round(35 + (km / 780) * 60); // overhead + cruise
}

function isDirectPlausible(origin: Airport, dest: Airport): boolean {
  if (origin.countryCode === "NO" && dest.countryCode === "NO") return true;
  const km = haversineKm(origin, dest);
  if (km < 2500) return true; // intra-European
  const trunk = ["JFK", "EWR", "DXB", "BKK", "SIN", "NRT", "LAX", "ORD", "CUN", "DOH"];
  return trunk.includes(dest.iata) && ["OSL", "CPH", "ARN", "HEL"].includes(origin.iata);
}

function carriersForRoute(origin: Airport): DemoCarrier[] {
  const out: DemoCarrier[] = [];
  for (const c of CARRIERS) {
    const servesOrigin = c.hubs.includes(origin.iata) || haversineKm(origin, airportByIata(c.hubs[0])!) < 2600;
    if (!servesOrigin) continue;
    out.push(c);
  }
  // Always ensure a few options
  for (const fallback of ["DY", "SK", "KL"]) {
    const c = CARRIERS.find((x) => x.iata === fallback)!;
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

// ─── Segment / offer builders ───────────────────────────────────────────────

let seq = 0;
function demoId(prefix: string): string {
  seq += 1;
  return `${prefix}_demo${Date.now().toString(36)}${seq.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function toPoint(a: Airport) {
  return { iata: a.iata, name: a.name, city: a.city, country: a.country, lat: a.lat, lng: a.lng, timeZone: a.timeZone };
}

// Demo times model airport-local wall time. Emitting naive ISO (no "Z")
// keeps the picked travel date and clock times identical in every browser TZ.
function wallIso(d: Date): string {
  return d.toISOString().slice(0, 19);
}

function buildSegment(
  from: Airport,
  to: Airport,
  departAt: Date,
  carrier: DemoCarrier,
  seed: number,
  cabinClass: CabinClass,
): Segment {
  const km = haversineKm(from, to);
  const mins = flightMinutes(km);
  const arriveAt = new Date(departAt.getTime() + mins * 60_000);
  const flightNo = String(carrier.flightNoBase + Math.floor(seed * 180));
  return {
    id: demoId("seg"),
    origin: toPoint(from),
    destination: toPoint(to),
    departingAt: wallIso(departAt),
    arrivingAt: wallIso(arriveAt),
    durationMinutes: mins,
    carrier: { iata: carrier.iata, name: carrier.name },
    flightNumber: flightNo,
    aircraft: AIRCRAFT[carrier.iata] ?? "Airbus A320",
    cabinClass,
    baggage: {
      carryOnBags: 1,
      checkedBags: carrier.priceFactor < 0.8 ? (cabinClass === "economy" ? 0 : 1) : cabinClass === "economy" ? 1 : 2,
    },
  };
}

function buildSlice(
  input: SearchSliceInput,
  carrier: DemoCarrier,
  seed: number,
  cabinClass: CabinClass,
): OfferSlice | null {
  const origin = airportByIata(input.origin);
  const dest = airportByIata(input.destination);
  if (!origin || !dest) return null;

  const day = new Date(`${input.departureDate}T00:00:00Z`);
  const departMinutes = 360 + Math.floor(seed * 840); // 06:00–20:00
  const departAt = new Date(day.getTime() + departMinutes * 60_000);

  const direct = isDirectPlausible(origin, dest);
  const segments: Segment[] = [];
  if (direct) {
    segments.push(buildSegment(origin, dest, departAt, carrier, seed, cabinClass));
  } else {
    // connect via the carrier's hub closest to the origin
    const hub = carrier.hubs
      .map((h) => airportByIata(h))
      .filter((h): h is Airport => Boolean(h))
      .sort((a, b) => haversineKm(origin, a) - haversineKm(origin, b))[0];
    if (!hub || hub.iata === dest.iata || hub.iata === origin.iata) {
      segments.push(buildSegment(origin, dest, departAt, carrier, seed, cabinClass));
    } else {
      const first = buildSegment(origin, hub, departAt, carrier, seed, cabinClass);
      const layover = 55 + Math.floor(hash(carrier.iata + input.departureDate) * 120);
      const secondDepart = new Date(new Date(first.arrivingAt).getTime() + layover * 60_000);
      const second = buildSegment(hub, dest, secondDepart, carrier, hash(secondDepart.toISOString()), cabinClass);
      segments.push(first, second);
    }
  }

  const first = segments[0];
  const last = segments[segments.length - 1];
  return {
    id: demoId("sli"),
    origin: toPoint(origin),
    destination: toPoint(dest),
    departingAt: first.departingAt,
    arrivingAt: last.arrivingAt,
    durationMinutes: Math.round(
      (new Date(last.arrivingAt).getTime() - new Date(first.departingAt).getTime()) / 60_000,
    ),
    stops: segments.length - 1,
    segments,
  };
}

const CABIN_PRICE: Record<CabinClass, number> = {
  economy: 1,
  premium_economy: 1.55,
  business: 2.6,
  first: 3.8,
};

const PAX_PRICE: Record<string, number> = { adult: 1, child: 0.75, infant_without_seat: 0.1 };

export function demoPaxFactor(types: Array<"adult" | "child" | "infant_without_seat">): number {
  return types.reduce((sum, t) => sum + (PAX_PRICE[t] ?? 1), 0);
}

function priceFor(km: number, carrier: DemoCarrier, cabin: CabinClass, seed: number): number {
  const perKm = 0.85 + seed * 0.5; // NOK per km base
  const base = 240 + km * perKm * carrier.priceFactor;
  return Math.round(base * CABIN_PRICE[cabin]);
}

// In-memory offer store (mirrors Duffel's expiring offers)
const offerStore = new Map<string, { offer: Offer; expires: number }>();

export function demoGetOffer(offerId: string): Offer | null {
  assertNotProd();
  const hit = offerStore.get(offerId);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    offerStore.delete(offerId);
    return null;
  }
  return hit.offer;
}

export function demoSearch(input: {
  slices: SearchSliceInput[];
  passengers: SearchPassengerInput[];
  cabinClass: CabinClass;
}): SearchResult {
  assertNotProd();
  const offers: Offer[] = [];
  const first = input.slices[0];
  const origin = airportByIata(first.origin);
  const dest = airportByIata(first.destination);
  if (origin && dest) {
    const carriers = carriersForRoute(origin).slice(0, 7);
    for (const carrier of carriers) {
      const variants = 1 + Math.floor(hash(carrier.iata + first.departureDate) * 3);
      for (let v = 0; v < variants; v++) {
        const seed = hash(`${carrier.iata}:${first.origin}${first.destination}:${first.departureDate}:${v}`);
        const slices: OfferSlice[] = [];
        let totalKm = 0;
        let ok = true;
        for (const s of input.slices) {
          const slice = buildSlice(s, carrier, hash(carrier.iata + s.departureDate + s.origin + v), input.cabinClass);
          if (!slice) {
            ok = false;
            break;
          }
          const o = airportByIata(s.origin)!;
          const d = airportByIata(s.destination)!;
          totalKm += haversineKm(o, d);
          slices.push(slice);
        }
        if (!ok) continue;

        const paxFactor = input.passengers.reduce((sum, p) => sum + (PAX_PRICE[p.type] ?? 1), 0);
        const total = Math.round(priceFor(totalKm, carrier, input.cabinClass, seed) * paxFactor);
        const tax = Math.round(total * 0.12);
        const id = demoId("off");
        const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
        const lowCost = carrier.priceFactor < 0.8;
        const refundable = !lowCost && input.cabinClass !== "economy" ? true : seed > 0.6;
        const changeable = lowCost ? seed > 0.5 : true;
        const penalty = String(Math.round(total * 0.15));
        const international = origin.countryCode !== dest.countryCode;
        const offer: Offer = {
          id,
          totalAmount: String(total),
          totalCurrency: "NOK",
          baseAmount: String(total - tax),
          taxAmount: String(tax),
          owner: { iata: carrier.iata, name: carrier.name },
          expiresAt,
          cabinClass: input.cabinClass,
          slices,
          passengers: input.passengers.map((p, i) => ({
            id: `pas_demo${i}${Math.floor(seed * 1e6)}`,
            type: p.type,
            age: p.age,
          })),
          baggage: lowCost
            ? { carryOnBags: 1, checkedBags: input.cabinClass === "economy" ? 0 : 1 }
            : { carryOnBags: 1, checkedBags: input.cabinClass === "economy" ? 1 : 2 },
          emissionsKg: Math.round((totalKm * 0.115 * paxFactor) / (input.cabinClass === "economy" ? 1 : 1.8)),
          refundable,
          changeable,
          conditions: {
            refundBeforeDeparture: { allowed: refundable, penaltyAmount: refundable ? penalty : null, penaltyCurrency: refundable ? "NOK" : null },
            changeBeforeDeparture: { allowed: changeable, penaltyAmount: changeable ? penalty : null, penaltyCurrency: changeable ? "NOK" : null },
          },
          identityDocumentsRequired: international && !["DK", "SE", "FI", "IS", "GB", "DE", "NL", "FR", "ES", "IT", "PT", "AT", "CH", "IE", "PL", "CZ", "HU", "GR", "LV", "LT", "EE"].includes(dest.countryCode),
          services: {
            maxExtraBags: 3,
            extraBagPrice: String(lowCost ? 349 : 549),
            bagServiceId: `ase_demo_${id}`,
          },
        };
        offerStore.set(id, { offer, expires: Date.now() + 30 * 60_000 });
        offers.push(offer);
      }
    }
  }
  offers.sort((a, b) => Number(a.totalAmount) - Number(b.totalAmount));
  return {
    offerRequestId: demoId("orq"),
    liveMode: false,
    demoMode: true,
    cabinClass: input.cabinClass,
    slices: input.slices,
    passengers: input.passengers,
    offers: offers.slice(0, 24),
  };
}

// ─── Price hints for the ±3-day strip (demo only) ───────────────────────────

export function demoPriceHint(
  origin: string,
  destination: string,
  cabin: CabinClass,
  date: string,
  paxCount: number,
  returnDate?: string,
): string | null {
  const o = airportByIata(origin);
  const d = airportByIata(destination);
  if (!o || !d) return null;
  const carriers = carriersForRoute(o).slice(0, 7); // same carrier window as demoSearch
  let best = Infinity;
  // Mirror the offer engine: one base fee over the combined distance,
  // seeded by the outbound leg — keeps hints close to real offer totals.
  const km = haversineKm(o, d) * (returnDate ? 2 : 1);
  for (const c of carriers) {
    const seed = hash(`${c.iata}:${origin}${destination}:${date}:0`);
    const price = priceFor(km, c, cabin, seed) * paxCount;
    if (price < best) best = price;
  }
  return Number.isFinite(best) ? String(Math.round(best)) : null;
}

// ─── Demo-ordre (speiler Duffel-ordreobjektet) ──────────────────────────────

let orderSeq = 0;
const PNR_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function demoBookingReference(): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += PNR_ALPHABET[Math.floor(Math.random() * PNR_ALPHABET.length)];
  return out;
}

/**
 * Opprett en demo-ordre fra et tilbudsøyeblikksbilde. Beløpet er tilbudets
 * total + tilvalg (minste enhet) — samme regel som Duffel.
 */
export function demoCreateOrder(input: {
  offer: Offer;
  passengers: Array<{ id: string; givenName: string; familyName: string; type: string }>;
  amountMinor: number;
  attemptId: number | string;
  withPnr?: boolean;
}): SupplierOrder {
  assertNotProd();
  orderSeq += 1;
  const currency = input.offer.totalCurrency;
  const ref = input.withPnr === false ? "" : demoBookingReference();
  const id = `ord_demo_${Date.now().toString(36)}${orderSeq.toString(36)}`;
  return {
    id,
    liveMode: false,
    bookingReference: ref,
    createdAt: new Date().toISOString(),
    totalAmount: fromMinor(input.amountMinor, currency),
    totalCurrency: currency,
    slices: input.offer.slices,
    passengers: input.passengers,
    tickets: ref
      ? input.passengers.map((p, i) => ({
          passengerId: p.id,
          passengerName: `${p.givenName} ${p.familyName}`,
          type: "electronic_ticket",
          uniqueIdentifier: `000-${String(2000000000 + orderSeq * 17 + i)}`,
        }))
      : [],
    paymentStatus: { awaitingPayment: false, paidAt: new Date().toISOString(), paymentRequiredBy: null },
    cancelledAt: null,
    availableActions: ["cancel"],
    metadata: { source: "hellosky", attempt_id: String(input.attemptId) },
    conditions: input.offer.conditions,
  };
}

/** Demo-kanselleringstilbud: 80 % av leverandørbeløpet refunderes. */
export function demoCancellationQuote(orderId: string, supplierAmountMinor: number, currency: string) {
  assertNotProd();
  const minor = Math.round(supplierAmountMinor * 0.8);
  return {
    id: `ore_demo_${orderId}_${Date.now().toString(36)}`,
    orderId,
    refundAmount: fromMinor(minor, currency),
    refundCurrency: currency,
    refundMinor: minor,
    refundTo: "balance",
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    confirmedAt: null as string | null,
  };
}

/** Tilvalgspris i minste enhet for et demo-tilbud (ekstra kolli × pris). */
export function demoServicesMinor(offer: Offer, extraBags: number): number {
  const per = offer.services?.extraBagPrice ? toMinor(offer.services.extraBagPrice, offer.totalCurrency) : 0;
  return per * Math.max(0, extraBags);
}

// ─── Flight status (demo) ───────────────────────────────────────────────────

export function demoFlightStatus(carrierIata: string, flightNumber: string, date: string): FlightStatus | null {
  assertNotProd();
  const carrier = CARRIERS.find((c) => c.iata === carrierIata.toUpperCase());
  if (!carrier) return null;
  const seed = hash(`${carrier.iata}${flightNumber}${date}`);
  // Deterministic plausible route: hub → a destination
  const hub = airportByIata(carrier.hubs[0]);
  const candidates = ["CPH", "ARN", "LHR", "AMS", "CDG", "FRA", "BGO", "TRD", "AGP", "BCN"]
    .map((i) => airportByIata(i))
    .filter((a): a is Airport => a !== undefined && a.iata !== hub?.iata);
  if (!hub) return null;
  const dest = pick(candidates, seed);
  const km = haversineKm(hub, dest);
  const mins = flightMinutes(km);

  const depMin = 360 + Math.floor(seed * 780);
  const sched = new Date(`${date}T00:00:00Z`).getTime() + depMin * 60_000;
  const delay = seed > 0.78 ? Math.floor(seed * 90) : seed > 0.6 ? Math.floor(seed * 25) : 0;
  const estDep = sched + delay * 60_000;
  const estArr = estDep + mins * 60_000;

  const now = Date.now();
  let status: FlightStatusCode = "scheduled";
  let progress = 0;
  if (delay > 20 && now < estDep) status = "delayed";
  else if (now < sched - 45 * 60_000) status = "scheduled";
  else if (now < estDep) status = "boarding";
  else if (now < estDep + 15 * 60_000) status = "departed";
  else if (now < estArr) {
    status = "in_air";
    progress = Math.min(1, Math.max(0, (now - estDep) / (estArr - estDep)));
  } else status = "landed";

  return {
    carrier: { iata: carrier.iata, name: carrier.name },
    flightNumber,
    date,
    origin: toPoint(hub),
    destination: toPoint(dest),
    scheduledDeparture: new Date(sched).toISOString(),
    estimatedDeparture: new Date(estDep).toISOString(),
    scheduledArrival: new Date(sched + mins * 60_000).toISOString(),
    estimatedArrival: new Date(estArr).toISOString(),
    status,
    delayMinutes: delay,
    gate: `${pick(["A", "B", "C", "D", "E", "F"], seed)}${1 + Math.floor(seed * 40)}`,
    aircraft: AIRCRAFT[carrier.iata] ?? "Airbus A320",
    progress,
  };
}
