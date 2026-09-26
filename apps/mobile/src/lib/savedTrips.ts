import type { MobileOffer } from "@contracts/mobileSearch";
import type { CabinClass } from "@contracts/types";
import { parseAirportChoice, parseDraft } from "./draft";
import { itinerarySignature } from "./journeys";
import { toIsoDate } from "./format";
import { CABINS, initialForm, type AirportChoice, type SearchForm } from "./searchForm";

/**
 * Lagrede fly og lagrede ruter, bare på denne telefonen (localStore «savedFlights» og «savedRoutes»).
 *
 * Et lagret fly er et bilde av reisen slik den så ut da kunden lagret den: flyplasser, tider, flyselskaper,
 * flynumre og antall bytter – og søket det kom fra, så det kan søkes igjen. Prisen kunden så står med tidspunktet
 * og om den var nøyaktig eller omregnet («ca.»); den vises alltid som «da du lagret», aldri som en pris som gjelder
 * nå. Ingen leverandørlenke, tilbuds-id eller token lagres (et tilbud utløper; et nytt søk gir ferske priser).
 *
 * En lagret rute er bare to flyplasser. Ingen datoer, ingen pris.
 */

export type SavedLeg = {
  origin: AirportChoice;
  destination: AirportChoice;
  /** Lokal tid slik leverandøren oppga den (ISO uten omregning). */
  departingAt: string;
  arrivingAt: string;
  durationMinutes: number;
  stops: number;
  /** Markedsførende flyselskaper i rekkefølge, uten duplikater. */
  carriers: { iata: string; name: string }[];
  flightNumbers: string[];
};

export type SeenPrice = { amountMinor: number; estimate: boolean };

export type SavedFlight = {
  /** Reisens signatur (samme reise = samme flyvninger og tider), så den ikke lagres to ganger. */
  key: string;
  savedAt: string;
  legs: SavedLeg[];
  cabinClass: CabinClass;
  /** Søket reisen kom fra (reisende, klasse, datoer) – brukes til «Søk igjen». */
  query: SearchForm;
  /** Kroneprisen kunden så, eller null når tilbudet ikke hadde en. */
  seenPrice: SeenPrice | null;
  /** Demo- eller sandkassedata: merkes alltid. */
  demo: boolean;
};

export type SavedRoute = { origin: AirportChoice; destination: AirportChoice; savedAt: string };

export const MAX_SAVED_FLIGHTS = 30;
export const MAX_SAVED_ROUTES = 20;

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const IATA2 = /^[A-Z0-9]{2}$/;

function leg(v: unknown): SavedLeg | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const origin = parseAirportChoice(r.origin);
  const destination = parseAirportChoice(r.destination);
  if (!origin || !destination) return null;
  if (typeof r.departingAt !== "string" || !ISO_TIME.test(r.departingAt) || typeof r.arrivingAt !== "string" || !ISO_TIME.test(r.arrivingAt)) return null;
  const n = (x: unknown, max: number) => (typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= max ? x : null);
  const durationMinutes = n(r.durationMinutes, 7 * 24 * 60);
  const stops = n(r.stops, 6);
  if (durationMinutes === null || stops === null) return null;
  const carriers = Array.isArray(r.carriers)
    ? r.carriers.flatMap((c) => {
        const x = c as Record<string, unknown> | null;
        return x && typeof x.iata === "string" && IATA2.test(x.iata) && typeof x.name === "string" ? [{ iata: x.iata, name: x.name.slice(0, 80) }] : [];
      })
    : [];
  const flightNumbers = Array.isArray(r.flightNumbers) ? r.flightNumbers.filter((f): f is string => typeof f === "string" && f.length <= 12).slice(0, 8) : [];
  if (!carriers.length) return null;
  return { origin, destination, departingAt: r.departingAt.slice(0, 25), arrivingAt: r.arrivingAt.slice(0, 25), durationMinutes, stops, carriers: carriers.slice(0, 6), flightNumbers };
}

function seen(v: unknown): SeenPrice | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  if (typeof r.amountMinor !== "number" || !Number.isInteger(r.amountMinor) || r.amountMinor <= 0 || r.amountMinor > 10_000_000_00) return null;
  return { amountMinor: r.amountMinor, estimate: r.estimate === true };
}

/** Lagret liste → gyldige fly, nyeste først. En post som ikke kan leses helt, droppes. */
export function parseSavedFlights(raw: unknown, today: Date = new Date()): SavedFlight[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedFlight[] = [];
  for (const item of raw.slice(0, MAX_SAVED_FLIGHTS * 2)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.key !== "string" || !r.key || r.key.length > 2000 || out.some((f) => f.key === r.key)) continue;
    if (typeof r.savedAt !== "string" || !ISO_TIME.test(r.savedAt)) continue;
    const legs = Array.isArray(r.legs) ? r.legs.map(leg) : [];
    if (!legs.length || legs.length > 2 || legs.some((l) => !l)) continue;
    const query = parseDraft(r.query, today, { keepPastDates: true });
    if (!query || !query.origin || !query.destination) continue;
    if (!CABINS.includes(r.cabinClass as CabinClass)) continue;
    out.push({ key: r.key, savedAt: r.savedAt, legs: legs as SavedLeg[], cabinClass: r.cabinClass as CabinClass, query, seenPrice: seen(r.seenPrice), demo: r.demo === true });
    if (out.length === MAX_SAVED_FLIGHTS) break;
  }
  return out;
}

/** Tilbudet (og søket det kom fra) som et lagret fly. `now` er da kunden lagret. */
export function flightFromOffer(item: MobileOffer, query: SearchForm, now: Date = new Date()): SavedFlight {
  const offer = item.offer;
  const legs: SavedLeg[] = offer.slices.map((s) => {
    const carriers: { iata: string; name: string }[] = [];
    for (const seg of s.segments) if (!carriers.some((c) => c.iata === seg.carrier.iata)) carriers.push({ iata: seg.carrier.iata, name: seg.carrier.name });
    const point = (p: typeof s.origin) => ({ iata: p.iata, name: p.name ?? "", city: p.city || p.iata, country: p.country ?? "" });
    return {
      origin: point(s.origin),
      destination: point(s.destination),
      departingAt: s.departingAt,
      arrivingAt: s.arrivingAt,
      durationMinutes: s.durationMinutes,
      stops: s.stops,
      carriers,
      flightNumbers: s.segments.map((seg) => `${seg.carrier.iata}${seg.flightNumber}`),
    };
  });
  const nok = item.price.nok;
  return {
    key: itinerarySignature(offer),
    savedAt: now.toISOString(),
    legs,
    cabinClass: offer.cabinClass,
    query,
    seenPrice: nok.kind === "unavailable" ? null : { amountMinor: nok.amountMinor, estimate: nok.estimate },
    demo: offer.source === "demo",
  };
}

/** Lagre (nyeste først) eller fjerne et fly. */
export function toggleFlight(list: SavedFlight[], f: SavedFlight): SavedFlight[] {
  return list.some((x) => x.key === f.key) ? list.filter((x) => x.key !== f.key) : [f, ...list].slice(0, MAX_SAVED_FLIGHTS);
}

/** Har reisen gått? (utreisens avgangsdag er passert) – da kan den bare fjernes eller søkes med nye datoer. */
export function flightIsPast(f: SavedFlight, today: Date = new Date()): boolean {
  return (f.legs[0]?.departingAt.slice(0, 10) ?? "") < toIsoDate(today);
}

/** «Søk igjen» for et lagret fly: det samme søket, eller med dagens standarddatoer når datoene har passert. */
export function flightSearch(f: SavedFlight, today: Date = new Date()): { form: SearchForm; freshDates: boolean } {
  if (!flightIsPast(f, today)) return { form: f.query, freshDates: false };
  const base = initialForm(today);
  return { form: { ...f.query, departDate: base.departDate, returnDate: base.returnDate }, freshDates: true };
}

export function routeKey(r: { origin: AirportChoice; destination: AirportChoice }): string {
  return `${r.origin.iata}-${r.destination.iata}`;
}

export function parseSavedRoutes(raw: unknown): SavedRoute[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedRoute[] = [];
  for (const item of raw.slice(0, MAX_SAVED_ROUTES * 2)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const origin = parseAirportChoice(r.origin);
    const destination = parseAirportChoice(r.destination);
    if (!origin || !destination || origin.iata === destination.iata) continue;
    if (typeof r.savedAt !== "string" || !ISO_TIME.test(r.savedAt)) continue;
    const route = { origin, destination, savedAt: r.savedAt };
    if (out.some((x) => routeKey(x) === routeKey(route))) continue;
    out.push(route);
    if (out.length === MAX_SAVED_ROUTES) break;
  }
  return out;
}

/** Lagre (nyeste først) eller fjerne en rute. */
export function toggleRoute(list: SavedRoute[], origin: AirportChoice, destination: AirportChoice, now: Date = new Date()): SavedRoute[] {
  const key = routeKey({ origin, destination });
  if (list.some((x) => routeKey(x) === key)) return list.filter((x) => routeKey(x) !== key);
  return [{ origin, destination, savedAt: now.toISOString() }, ...list].slice(0, MAX_SAVED_ROUTES);
}

/** En lagret rute som skjema: ruten inn, resten (datoer, reisende, klasse) fra skjemaet kunden har. Søker ikke. */
export function routeForm(r: SavedRoute, form: SearchForm): SearchForm {
  return { ...form, origin: r.origin, destination: r.destination };
}
