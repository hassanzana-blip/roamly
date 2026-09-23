import type { MobileOffer } from "@contracts/mobileSearch";
import { checkedBagIncluded } from "./offer";

/**
 * Sortering og filtre på resultatlisten – bare på data tilbudene faktisk har:
 * kronepris (serverens rekkefølge), samlet reisetid, antall mellomlandinger,
 * innsjekket bagasje slik leverandøren oppga den, og avgangstid for utreisen
 * (lokal tid på flyplassen, slik leverandøren oppga den).
 *
 * Tilbud uten pris i kroner står alltid nederst, uansett sortering, så
 * merknaden «står nederst» over listen alltid stemmer.
 */

export type SortKey = "price" | "duration" | "stops";
export type StopsFilter = "any" | "direct" | "max1";
export type TimeBand = "night" | "morning" | "afternoon" | "evening";

export type ResultsView = { sort: SortKey; stops: StopsFilter; bags: boolean; departBands: TimeBand[] };

export const DEFAULT_VIEW: ResultsView = { sort: "price", stops: "any", bags: false, departBands: [] };

/** Rekkefølgen valgene vises i; tekstene står i ordboken (t.results). */
export const SORTS: readonly SortKey[] = ["price", "duration", "stops"];

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

/** Tidsrommet utreisen går i, fra klokkeslettet leverandøren oppga. null når det ikke kan leses. */
export function departBand(o: MobileOffer): TimeBand | null {
  const m = /T(\d{2}):\d{2}/.exec(o.offer.slices[0]?.departingAt ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  return TIME_BANDS.find((b) => h >= b.from && h < b.to)?.value ?? null;
}

function hasNok(o: MobileOffer): boolean {
  return o.price.nok.kind !== "unavailable";
}

function passes(o: MobileOffer, v: ResultsView): boolean {
  if (v.stops === "direct" && maxStops(o) > 0) return false;
  if (v.stops === "max1" && maxStops(o) > 1) return false;
  if (v.bags && !checkedBagIncluded(o.offer)) return false;
  if (v.departBands.length) {
    const band = departBand(o);
    if (!band || !v.departBands.includes(band)) return false;
  }
  return true;
}

/** Filtrer og sorter. Serverens rekkefølge er utgangspunktet og avgjør ved likhet. */
export function applyView(offers: MobileOffer[], v: ResultsView): MobileOffer[] {
  const kept = offers.map((o, i) => ({ o, i })).filter(({ o }) => passes(o, v));
  if (v.sort === "price") return kept.map(({ o }) => o);
  const key = (o: MobileOffer): number => {
    if (v.sort === "duration") return totalDuration(o) ?? Number.POSITIVE_INFINITY;
    return totalStops(o);
  };
  return kept
    .sort((a, b) => {
      const nok = Number(hasNok(b.o)) - Number(hasNok(a.o));
      if (nok) return nok;
      const k = key(a.o) - key(b.o);
      if (k) return k;
      return a.i - b.i;
    })
    .map(({ o }) => o);
}

/** Antall aktive filtre (sortering teller ikke). */
export function activeFilterCount(v: ResultsView): number {
  return (v.stops !== "any" ? 1 : 0) + (v.bags ? 1 : 0) + (v.departBands.length ? 1 : 0);
}

/** Hvor mange tilbud et valg ville gitt, med de andre filtrene uendret – vises ved hvert valg. */
export function countWith(offers: MobileOffer[], v: ResultsView, patch: Partial<ResultsView>): number {
  const next = { ...v, ...patch };
  return offers.filter((o) => passes(o, next)).length;
}
