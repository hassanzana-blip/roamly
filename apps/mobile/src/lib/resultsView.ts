import type { MobileOffer } from "@contracts/mobileSearch";
import { checkedBagIncluded } from "./offer";
import { minutesBetween } from "./format";
import { groupJourneys, itinerarySignature, type Journey } from "./journeys";

/**
 * Sortering og filtre på resultatlisten – bare på data tilbudene faktisk har:
 * kronepris (serverens rekkefølge), reisetid, antall mellomlandinger,
 * innsjekket bagasje slik leverandøren oppga den, flyselskap, flyplassene det
 * byttes i, og avgangs- og ankomsttid for utreise og hjemreise (lokal tid på
 * flyplassen, slik leverandøren oppga den). Et filter på pris eller reisetid
 * skjuler tilbud der verdien er ukjent (ingen kronepris, ugyldig varighet): de
 * kan ikke vises å være innenfor.
 *
 * Tilbud uten pris i kroner står alltid nederst, uansett sortering, så
 * merknaden «står nederst» over listen alltid stemmer.
 *
 * «Best» er nettets egen avveining (src/lib/offers.ts, «Best totalt»): pris og
 * samlet reisetid sett mot det billigste og raskeste i svaret, flest bytter på
 * én strekning, et straffepoeng for bytter over 5 timer og et lite dytt mot
 * flyselskapets egen salgskanal. Samme tall, samme vekter – og forklart for
 * kunden. Ingen betalt plassering og ingen skjult faktor.
 */

export type SortKey = "best" | "price" | "duration" | "departure" | "stops";
export type StopsFilter = "any" | "direct" | "max1";
export type TimeBand = "night" | "morning" | "afternoon" | "evening";

export type ResultsView = {
  sort: SortKey;
  stops: StopsFilter;
  bags: boolean;
  departBands: TimeBand[];
  /** Hjemreisens avgang (bare tur-retur). */
  returnBands: TimeBand[];
  /** Utreisens ankomst (lokal tid der du lander). */
  arriveBands: TimeBand[];
  /** Hjemreisens ankomst (bare tur-retur). */
  returnArriveBands: TimeBand[];
  /** Flyplasser kunden ikke vil bytte fly i (IATA). Direktefly passer alltid. */
  avoidConnections: string[];
  /** Markedsførende flyselskap (IATA); tomt = alle. Et tilbud passer når minst ett av flyene er med et valgt selskap. */
  airlines: string[];
  /** Høyeste totalpris i øre (kronepris), eller null. */
  maxPriceMinor: number | null;
  /** Lengste strekning (én vei) i minutter, eller null. */
  maxLegMinutes: number | null;
};

/** Standard: «Best» – som de store metasøkene. «Billigst» er ett trykk unna i fanene over listen. */
export const DEFAULT_VIEW: ResultsView = {
  sort: "best",
  stops: "any",
  bags: false,
  departBands: [],
  returnBands: [],
  arriveBands: [],
  returnArriveBands: [],
  avoidConnections: [],
  airlines: [],
  maxPriceMinor: null,
  maxLegMinutes: null,
};

/** Tidsfiltrene: avgang og ankomst for utreise og hjemreise. */
export type BandKey = "departBands" | "arriveBands" | "returnBands" | "returnArriveBands";

/** Filtrene av, sorteringen beholdt. */
export function clearedFilters(v: ResultsView): ResultsView {
  return { ...DEFAULT_VIEW, sort: v.sort };
}

/** Rekkefølgen valgene vises i; tekstene står i ordboken (t.results). */
export const SORTS: readonly SortKey[] = ["best", "price", "duration", "departure", "stops"];

/** Fanene over listen: de tre avveiningene kunden oftest veksler mellom. De to andre står i «Sorter». */
export const SORT_TABS: readonly SortKey[] = ["best", "price", "duration"];

export const STOPS: readonly StopsFilter[] = ["any", "direct", "max1"];

export const TIME_BANDS: { value: TimeBand; range: string; from: number; to: number }[] = [
  { value: "night", range: "00–06", from: 0, to: 6 },
  { value: "morning", range: "06–12", from: 6, to: 12 },
  { value: "afternoon", range: "12–18", from: 12, to: 18 },
  { value: "evening", range: "18–24", from: 18, to: 24 },
];

/** Samlet reisetid i minutter, eller null når en strekning mangler gyldig varighet. */
export function totalDuration(o: MobileOffer): number | null {
  let sum = 0;
  for (const s of o.offer.slices) {
    if (!Number.isFinite(s.durationMinutes) || s.durationMinutes <= 0) return null;
    sum += s.durationMinutes;
  }
  return o.offer.slices.length ? sum : null;
}

/** Flest bytter på én strekning (et direktefly har 0 på alle). */
export function maxStops(o: MobileOffer): number {
  return o.offer.slices.reduce((m, s) => Math.max(m, s.stops), 0);
}

function totalStops(o: MobileOffer): number {
  return o.offer.slices.reduce((m, s) => m + s.stops, 0);
}

/** Gjennomsnittlig reisetid per strekning (minutter), eller null når en varighet mangler. */
export function averageLegMinutes(o: MobileOffer): number | null {
  const total = totalDuration(o);
  return total === null ? null : Math.round(total / o.offer.slices.length);
}

/** Lengste ventetid ved et bytte (minutter), regnet trygt fra leverandørens tider; 0 uten bytter eller uleselige tider. */
export function longestLayover(o: MobileOffer): number {
  let max = 0;
  for (const s of o.offer.slices) {
    for (let i = 0; i < s.segments.length - 1; i++) {
      const m = minutesBetween(s.segments[i]!.arrivingAt, s.segments[i + 1]!.departingAt);
      if (m !== null) max = Math.max(max, m);
    }
  }
  return max;
}

/** Laveste kronepris og korteste samlede reisetid i hele svaret – målestokken «Best» regnes mot. */
export type BestContext = { minPrice: number; minMinutes: number };

export function bestContext(offers: MobileOffer[]): BestContext {
  const prices = offers.map(nokMinor).filter((p): p is number => p !== null && p > 0);
  const minutes = offers.map(totalDuration).filter((m): m is number => m !== null);
  return { minPrice: prices.length ? Math.min(...prices) : 1, minMinutes: minutes.length ? Math.min(...minutes) : 1 };
}

/** Bytter som gir straffepoeng i «Best» (samme grense som nettet). */
export const BEST_LONG_LAYOVER_MINUTES = 300;

/**
 * «Best»: lavere er bedre. 1,0 i pris = billigst i svaret, 1,0 i tid = raskest i svaret. Et tilbud uten kronepris
 * eller med ukjent reisetid kan ikke veies og står bakerst (Infinity).
 *
 * Dyttet (+0,05) gjelder alle som ikke er flyselskapet selv – også billetter HelloSky selger (uten `booking`), som
 * ikke kan bestilles i appen. Nettet gir HelloSkys egne billetter samme fordel som flyselskapet; appen gjør det ikke,
 * så forklaringen kunden får («flyselskapets egen salgskanal foran andre selgere») stemmer uten unntak.
 */
export function bestScore(o: MobileOffer, ctx: BestContext): number {
  const price = nokMinor(o);
  const minutes = totalDuration(o);
  if (price === null || minutes === null) return Number.POSITIVE_INFINITY;
  const airlineDirect = o.offer.booking?.kind === "external" && o.offer.booking.sellerKind === "airline";
  return (price / ctx.minPrice) * 0.6 + (minutes / ctx.minMinutes) * 0.3 + maxStops(o) * 0.15 + (longestLayover(o) > BEST_LONG_LAYOVER_MINUTES ? 0.1 : 0) + (airlineDirect ? 0 : 0.05);
}

/** Utreisens avgang som tall (lokal tid på flyplassen, slik leverandøren oppga den); null når tiden ikke kan leses. */
export function departureKey(o: MobileOffer): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(o.offer.slices[0]?.departingAt ?? "");
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) / 60_000;
}

function bandOf(at: string | undefined): TimeBand | null {
  const m = /T(\d{2}):\d{2}/.exec(at ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  return TIME_BANDS.find((b) => h >= b.from && h < b.to)?.value ?? null;
}

/** Tidsrommet utreisen går i, fra klokkeslettet leverandøren oppga. null når det ikke kan leses. */
export function departBand(o: MobileOffer): TimeBand | null {
  return bandOf(o.offer.slices[0]?.departingAt);
}

/** Tidsrommet hjemreisen går i (siste strekning), bare når reisen har mer enn én strekning. */
export function returnBand(o: MobileOffer): TimeBand | null {
  const slices = o.offer.slices;
  return slices.length > 1 ? bandOf(slices[slices.length - 1]?.departingAt) : null;
}

/** Tidsrommet utreisen lander i (lokal tid der du lander, slik leverandøren oppga den). */
export function arriveBand(o: MobileOffer): TimeBand | null {
  return bandOf(o.offer.slices[0]?.arrivingAt);
}

/** Tidsrommet hjemreisen lander i, bare når reisen har mer enn én strekning. */
export function returnArriveBand(o: MobileOffer): TimeBand | null {
  const slices = o.offer.slices;
  return slices.length > 1 ? bandOf(slices[slices.length - 1]?.arrivingAt) : null;
}

const BAND_OF: Record<BandKey, (o: MobileOffer) => TimeBand | null> = { departBands: departBand, arriveBands: arriveBand, returnBands: returnBand, returnArriveBands: returnArriveBand };

/**
 * Flyplassene reisen bytter fly i: der et fly lander og det neste går fra (to flyplasser ved flyplassbytte). Et
 * direktefly har ingen.
 */
export function connectionsOf(o: MobileOffer): Set<string> {
  const out = new Set<string>();
  for (const s of o.offer.slices) {
    for (let i = 0; i < s.segments.length - 1; i++) {
      const a = s.segments[i]!.destination.iata;
      const b = s.segments[i + 1]!.origin.iata;
      if (a) out.add(a);
      if (b) out.add(b);
    }
  }
  return out;
}

export type ConnectionOption = { iata: string; city: string };

/** Flyplassene det byttes i i svaret, flest reiser først. Bynavnet er leverandørens. */
export function connectionOptions(offers: MobileOffer[]): ConnectionOption[] {
  const map = new Map<string, { iata: string; city: string; keys: Set<string> }>();
  for (const o of offers) {
    const key = itinerarySignature(o.offer);
    const cities = new Map<string, string>();
    for (const s of o.offer.slices) for (const g of s.segments) cities.set(g.destination.iata, g.destination.city).set(g.origin.iata, g.origin.city);
    for (const iata of connectionsOf(o)) {
      const cur = map.get(iata) ?? { iata, city: cities.get(iata) || iata, keys: new Set<string>() };
      cur.keys.add(key);
      map.set(iata, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.keys.size - a.keys.size || a.city.localeCompare(b.city) || a.iata.localeCompare(b.iata)).map(({ iata, city }) => ({ iata, city }));
}

/** Kroneprisen i øre, eller null når tilbudet ikke har pris i kroner. */
export function nokMinor(o: MobileOffer): number | null {
  return o.price.nok.kind === "unavailable" ? null : o.price.nok.amountMinor;
}

/** Lengste strekning (én vei) i minutter, eller null når en varighet mangler. */
export function longestLeg(o: MobileOffer): number | null {
  let max = 0;
  for (const s of o.offer.slices) {
    if (!Number.isFinite(s.durationMinutes) || s.durationMinutes <= 0) return null;
    max = Math.max(max, s.durationMinutes);
  }
  return o.offer.slices.length ? max : null;
}

/** Markedsførende flyselskap på reisens fly (IATA). */
export function airlinesOf(o: MobileOffer): Set<string> {
  return new Set(o.offer.slices.flatMap((s) => s.segments.map((g) => g.carrier.iata)).filter(Boolean));
}

function hasNok(o: MobileOffer): boolean {
  return o.price.nok.kind !== "unavailable";
}

const BAND_KEYS: readonly BandKey[] = ["departBands", "arriveBands", "returnBands", "returnArriveBands"];

function passes(o: MobileOffer, v: ResultsView): boolean {
  if (v.stops === "direct" && maxStops(o) > 0) return false;
  if (v.stops === "max1" && maxStops(o) > 1) return false;
  if (v.bags && !checkedBagIncluded(o.offer)) return false;
  for (const key of BAND_KEYS) {
    if (!v[key].length) continue;
    const band = BAND_OF[key](o);
    if (!band || !v[key].includes(band)) return false;
  }
  if (v.avoidConnections.length) {
    const via = connectionsOf(o);
    if (v.avoidConnections.some((a) => via.has(a))) return false;
  }
  if (v.airlines.length) {
    const mine = airlinesOf(o);
    if (!v.airlines.some((a) => mine.has(a))) return false;
  }
  if (v.maxPriceMinor !== null) {
    const p = nokMinor(o);
    if (p === null || p > v.maxPriceMinor) return false;
  }
  if (v.maxLegMinutes !== null) {
    const d = longestLeg(o);
    if (d === null || d > v.maxLegMinutes) return false;
  }
  return true;
}

/**
 * Filtrer og sorter. Serverens rekkefølge (stigende kronepris) er utgangspunktet og avgjør ved likhet.
 * `offers` er hele svaret: målestokken for «Best» regnes av alle tilbudene, så rekkefølgen ikke hopper når et
 * filter slås på.
 */
export function applyView(offers: MobileOffer[], v: ResultsView): MobileOffer[] {
  const kept = offers.map((o, i) => ({ o, i })).filter(({ o }) => passes(o, v));
  if (v.sort === "price") return kept.map(({ o }) => o);
  const ctx = v.sort === "best" ? bestContext(offers) : null;
  const key = (o: MobileOffer): number => {
    if (v.sort === "best") return bestScore(o, ctx!);
    if (v.sort === "duration") return totalDuration(o) ?? Number.POSITIVE_INFINITY;
    if (v.sort === "departure") return departureKey(o) ?? Number.POSITIVE_INFINITY;
    return totalStops(o);
  };
  const keys = new Map(kept.map(({ o }) => [o, key(o)]));
  return kept
    .sort((a, b) => {
      const nok = Number(hasNok(b.o)) - Number(hasNok(a.o));
      if (nok) return nok;
      const ka = keys.get(a.o)!;
      const kb = keys.get(b.o)!;
      // To ukjente (Infinity) er like – da avgjør serverens rekkefølge.
      if (ka !== kb) return ka < kb ? -1 : 1;
      return a.i - b.i;
    })
    .map(({ o }) => o);
}

/**
 * Den første reisen i listen for en sortering, med filtrene som gjelder – det fanene over listen viser. Prisen er
 * reisens billigste selger, akkurat som på kortet som står øverst når fanen velges.
 */
export function topFor(offers: MobileOffer[], v: ResultsView, sort: SortKey): Journey | null {
  return groupJourneys(applyView(offers, { ...v, sort }))[0] ?? null;
}

/** Antall aktive filtre (sortering teller ikke). */
export function activeFilterCount(v: ResultsView): number {
  return (
    (v.stops !== "any" ? 1 : 0) +
    (v.bags ? 1 : 0) +
    BAND_KEYS.filter((k) => v[k].length).length +
    (v.avoidConnections.length ? 1 : 0) +
    (v.airlines.length ? 1 : 0) +
    (v.maxPriceMinor !== null ? 1 : 0) +
    (v.maxLegMinutes !== null ? 1 : 0)
  );
}

export type AirlineOption = { iata: string; name: string; count: number };

/** Flyselskapene i svaret, med antall tilbud hver (flest først). Navnet er leverandørens. */
export function airlineOptions(offers: MobileOffer[]): AirlineOption[] {
  const map = new Map<string, AirlineOption>();
  for (const o of offers) {
    const names = new Map(o.offer.slices.flatMap((s) => s.segments.map((g) => [g.carrier.iata, g.carrier.name || g.carrier.iata] as const)));
    for (const [iata, name] of names) {
      if (!iata) continue;
      const cur = map.get(iata) ?? { iata, name, count: 0 };
      cur.count += 1;
      map.set(iata, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Terskler til et «høyst»-filter, laget av verdiene i svaret: kvartilene
 * rundet opp til `step`, uten duplikater, og bare de som faktisk skiller
 * (under den høyeste verdien og minst den laveste).
 */
export function thresholds(values: number[], step: number): number[] {
  const v = values.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (v.length < 2) return [];
  const min = v[0]!;
  const max = v[v.length - 1]!;
  const out = new Set<number>();
  for (const q of [0.25, 0.5, 0.75]) {
    const raw = v[Math.min(v.length - 1, Math.floor(q * (v.length - 1)))]!;
    const t = Math.ceil(raw / step) * step;
    if (t >= min && t < max) out.add(t);
  }
  return [...out].sort((a, b) => a - b);
}

/** Pristerskler i øre, rundet opp til hele 100 kr. */
export function priceThresholds(offers: MobileOffer[]): number[] {
  return thresholds(offers.map(nokMinor).filter((x): x is number => x !== null), 100_00);
}

/** Varighetsterskler for lengste strekning, rundet opp til hele timer. */
export function legThresholds(offers: MobileOffer[]): number[] {
  return thresholds(offers.map(longestLeg).filter((x): x is number => x !== null), 60);
}

/**
 * Hvor mange reiser (ikke tilbud) filtrene gir, uten å sortere – til tellingene i filterarket, som regnes for hvert
 * valg ved hver tegning. Samme gruppering som listen (reisens flynumre og tider).
 */
export function journeyCount(offers: MobileOffer[], v: ResultsView): number {
  const keys = new Set<string>();
  for (const o of offers) if (passes(o, v)) keys.add(itinerarySignature(o.offer));
  return keys.size;
}

/**
 * Reiser som bytter i `iata` og ellers passer filtrene – det som kommer tilbake eller forsvinner når kunden slår
 * flyplassen på eller av.
 */
export function journeysVia(offers: MobileOffer[], v: ResultsView, iata: string): number {
  const view = { ...v, avoidConnections: v.avoidConnections.filter((x) => x !== iata) };
  const keys = new Set<string>();
  for (const o of offers) if (passes(o, view) && connectionsOf(o).has(iata)) keys.add(itinerarySignature(o.offer));
  return keys.size;
}

/** Hvor mange tilbud et valg ville gitt, med de andre filtrene uendret – vises ved hvert valg. */
export function countWith(offers: MobileOffer[], v: ResultsView, patch: Partial<ResultsView>): number {
  const next = { ...v, ...patch };
  return offers.filter((o) => passes(o, next)).length;
}
