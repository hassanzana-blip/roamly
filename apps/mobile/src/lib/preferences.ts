import type { CabinClass } from "@contracts/types";
import { PREF_AIRLINES } from "./airlines";
import { parseAirportChoice } from "./draft";
import { CABINS, type AirportChoice, type SearchForm } from "./searchForm";
import type { ResultsView, StopsFilter, TimeBand } from "./resultsView";
import type { MobileOffer } from "@contracts/mobileSearch";

/**
 * Reisepreferanser, bare på denne telefonen (localStore «travelPrefs»). Den vanlige avreiseflyplassen har sin egen
 * nøkkel («homeAirport», se appState) fordi den kom først; her står resten.
 *
 * Preferansene gjør standardvalgene bedre, de skjuler aldri gyldige treff i det stille:
 * - Reiseklassen blir standard i et nytt søk (skjemaet viser den, og kunden kan endre den før søket).
 * - Direkte, bytter, bagasje, tider og flyselskaper blir aldri et filter av seg selv. I resultatene står et valg
 *   «Mine preferanser»; et trykk setter dem som vanlige, synlige filtre som kan fjernes ett og ett.
 * - Flyselskaper kunden vil unngå, ber om det samme: de settes aldri som filter (listen har ikke et «unngå»-filter),
 *   men et tilbud med et slikt selskap merkes. Ingen tilbud forsvinner.
 *
 * Aldri pass, ID, personnummer, token, navn eller e-post her.
 */

export type TravelPrefs = {
  /** Andre flyplasser kunden gjerne reiser fra (i tillegg til den vanlige), nyeste først. */
  altAirports: AirportChoice[];
  /** Høyeste antall bytter kunden vil ha: alle, bare direkte eller høyst ett. */
  stops: StopsFilter;
  /** Reiseklassen nye søk starter med, eller null (økonomi, som før). */
  cabin: CabinClass | null;
  /** Trenger innsjekket bagasje. */
  checkedBag: boolean;
  /** Foretrukne avgangstider (utreise), lokal tid. Tomt = ingen preferanse. */
  departBands: TimeBand[];
  /** Foretrukne ankomsttider (utreise), lokal tid. */
  arriveBands: TimeBand[];
  /** Foretrukne flyselskaper (IATA, fra listen appen kjenner). */
  airlines: string[];
  /** Flyselskaper kunden helst vil unngå (IATA). Merkes i resultatene, skjules aldri. */
  avoidAirlines: string[];
};

export const EMPTY_PREFS: TravelPrefs = { altAirports: [], stops: "any", cabin: null, checkedBag: false, departBands: [], arriveBands: [], airlines: [], avoidAirlines: [] };

export const MAX_ALT_AIRPORTS = 3;
export const BANDS: readonly TimeBand[] = ["night", "morning", "afternoon", "evening"];
export const STOP_CHOICES: readonly StopsFilter[] = ["any", "direct", "max1"];

export { PREF_AIRLINES };
const AIRLINE_CODES = new Set(PREF_AIRLINES.map((a) => a.iata));

export function airlineName(iata: string): string {
  return PREF_AIRLINES.find((a) => a.iata === iata)?.name ?? iata;
}

function codes(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const c of v) if (typeof c === "string" && AIRLINE_CODES.has(c) && !out.includes(c)) out.push(c);
  return out;
}

function bands(v: unknown): TimeBand[] {
  if (!Array.isArray(v)) return [];
  // Alltid i døgnets rekkefølge, uten duplikater.
  return BANDS.filter((b) => v.includes(b));
}

/** Lagret verdi → gyldige preferanser. Ukjente eller ødelagte felt blir standard; resten beholdes. */
export function parsePrefs(raw: unknown): TravelPrefs {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_PREFS;
  const r = raw as Record<string, unknown>;
  const alt: AirportChoice[] = [];
  if (Array.isArray(r.altAirports)) {
    for (const a of r.altAirports) {
      const c = parseAirportChoice(a);
      if (c && !alt.some((x) => x.iata === c.iata)) alt.push(c);
      if (alt.length === MAX_ALT_AIRPORTS) break;
    }
  }
  const airlines = codes(r.airlines);
  return {
    altAirports: alt,
    stops: STOP_CHOICES.includes(r.stops as StopsFilter) ? (r.stops as StopsFilter) : "any",
    cabin: CABINS.includes(r.cabin as CabinClass) ? (r.cabin as CabinClass) : null,
    checkedBag: r.checkedBag === true,
    departBands: bands(r.departBands),
    arriveBands: bands(r.arriveBands),
    airlines,
    // Et selskap kan ikke være både foretrukket og unngått; foretrukket vinner.
    avoidAirlines: codes(r.avoidAirlines).filter((c) => !airlines.includes(c)),
  };
}

/** Lagres bare når noe er valgt; ellers fjernes nøkkelen. */
export function isEmptyPrefs(p: TravelPrefs): boolean {
  return JSON.stringify(parsePrefs(p)) === JSON.stringify(EMPTY_PREFS);
}

/** Legg til (eller flytt øverst) en alternativ flyplass; aldri den vanlige, aldri mer enn tre. */
export function addAltAirport(p: TravelPrefs, a: AirportChoice, home: AirportChoice | null): TravelPrefs {
  if (home?.iata === a.iata) return p;
  return { ...p, altAirports: [a, ...p.altAirports.filter((x) => x.iata !== a.iata)].slice(0, MAX_ALT_AIRPORTS) };
}

export function toggleIn<T>(list: readonly T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/** Et flyselskap veksler mellom ingen mening → foretrukket → unngå → ingen mening. */
export function cycleAirline(p: TravelPrefs, iata: string): TravelPrefs {
  if (p.airlines.includes(iata)) return { ...p, airlines: p.airlines.filter((c) => c !== iata), avoidAirlines: [...p.avoidAirlines, iata] };
  if (p.avoidAirlines.includes(iata)) return { ...p, avoidAirlines: p.avoidAirlines.filter((c) => c !== iata) };
  return { ...p, airlines: [...p.airlines, iata] };
}

/** Et nytt skjema med preferansenes reiseklasse (bare når kunden har valgt en). */
export function withPrefDefaults(f: SearchForm, p: TravelPrefs): SearchForm {
  return p.cabin ? { ...f, cabinClass: p.cabin } : f;
}

/**
 * Filtrene preferansene gir for et svar: bare det tilbudene kan oppfylle. Foretrukne flyselskaper settes bare når
 * minst ett av dem finnes i svaret (ellers ville listen blitt tom); de som ikke finnes, er ikke med. Hjemreisens tider
 * røres ikke (preferansen gjelder utreisen). Sorteringen står.
 */
export function prefsView(v: ResultsView, p: TravelPrefs, offers: readonly MobileOffer[]): ResultsView {
  const present = new Set(offers.flatMap((o) => o.offer.slices.flatMap((s) => s.segments.map((seg) => seg.carrier.iata))));
  const airlines = p.airlines.filter((c) => present.has(c));
  return {
    ...v,
    stops: p.stops,
    bags: p.checkedBag,
    departBands: [...p.departBands],
    arriveBands: [...p.arriveBands],
    airlines,
  };
}

/** Har preferansene noe som kan bli et filter i resultatene? */
export function hasFilterPrefs(p: TravelPrefs): boolean {
  return p.stops !== "any" || p.checkedBag || p.departBands.length > 0 || p.arriveBands.length > 0 || p.airlines.length > 0;
}

/** Er filtrene i visningen nøyaktig det preferansene ga? (Da står valget som «brukt».) */
export function prefsApplied(v: ResultsView, p: TravelPrefs, offers: readonly MobileOffer[]): boolean {
  const w = prefsView(v, p, offers);
  return JSON.stringify([v.stops, v.bags, v.departBands, v.arriveBands, v.airlines]) === JSON.stringify([w.stops, w.bags, w.departBands, w.arriveBands, w.airlines]);
}

/** Flyselskaper i tilbudet som kunden helst vil unngå (for merket på kortet). */
export function avoidedIn(offer: MobileOffer["offer"], p: TravelPrefs): string[] {
  if (!p.avoidAirlines.length) return [];
  const out: string[] = [];
  for (const s of offer.slices) for (const seg of s.segments) if (p.avoidAirlines.includes(seg.carrier.iata) && !out.includes(seg.carrier.iata)) out.push(seg.carrier.iata);
  return out;
}

/** Hvor mange preferanser som er valgt (for oversikten på Min side). */
export function prefsCount(p: TravelPrefs, home: AirportChoice | null): number {
  return (
    (home ? 1 : 0) +
    (p.altAirports.length ? 1 : 0) +
    (p.stops !== "any" ? 1 : 0) +
    (p.cabin ? 1 : 0) +
    (p.checkedBag ? 1 : 0) +
    (p.departBands.length ? 1 : 0) +
    (p.arriveBands.length ? 1 : 0) +
    (p.airlines.length ? 1 : 0) +
    (p.avoidAirlines.length ? 1 : 0)
  );
}
