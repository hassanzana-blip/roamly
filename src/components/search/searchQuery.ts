import { airportByIata, type Airport } from "@contracts/airports";
import type { CabinClass } from "@contracts/types";
import type { Preference } from "@/lib/offers";
import type { SearchPassengerInput } from "@contracts/types";
import type { PaxAges, PaxCount } from "./paxUtils";

export interface TripLeg {
  from: Airport | null;
  to: Airport | null;
  date: string;
}

export type TripType = "roundtrip" | "oneway" | "multicity";

export interface SearchParamsState {
  from: Airport | null;
  to: Airport | null;
  depart: string;
  ret: string;
  tripType: TripType;
  legs: TripLeg[];
  pax: PaxCount;
  ages: PaxAges;
  cabin: CabinClass;
  pref: Preference;
  /** Open the price strip/calendar on the results page */
  flex: boolean;
}

export function todayPlus(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

export function defaultState(): SearchParamsState {
  return {
    from: airportByIata("OSL") ?? null,
    to: null,
    depart: todayPlus(21),
    ret: todayPlus(28),
    tripType: "roundtrip",
    legs: [
      { from: airportByIata("OSL") ?? null, to: null, date: todayPlus(21) },
      { from: null, to: null, date: todayPlus(28) },
    ],
    pax: { adult: 1, child: 0, infant_without_seat: 0 },
    ages: { children: [], infants: [] },
    cabin: "economy",
    pref: "best",
    flex: false,
  };
}

// ─── Reisefølget i en lenke ─────────────────────────────────────────────────
//
// Antallet er fasit, alderen er en presisering. Lenker til /sok og /bestill
// lages også andre steder enn av søkefeltet – lagrede søk, nylige søk,
// prisvarsler, delte lenker – og de bærer bare antall. Leses reisefølget fra
// aldersliste alene, forsvinner barna: et søk for to voksne og to barn ble
// priset for to voksne, hele veien til betaling, uten at noe sa fra.

/** Samme standardaldre som passasjervelgeren bruker når kunden ikke oppgir noe. */
export const DEFAULT_CHILD_AGE = 8;
export const DEFAULT_INFANT_AGE = 1;

export function parseAgeList(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 17);
}

function fitAges(ages: number[], count: number, fallback: number): number[] {
  const out = ages.slice(0, count);
  while (out.length < count) out.push(fallback);
  return out;
}

function countParam(p: URLSearchParams, key: string, fallback: number, max: number): number {
  if (!p.has(key)) return fallback;
  const n = Number(p.get(key));
  return Number.isInteger(n) && n >= 0 && n <= max ? n : fallback;
}

/** Reisefølget en lenke beskriver, med antall som fasit og alder som presisering. */
export function passengersFromParams(p: URLSearchParams): SearchPassengerInput[] {
  const childAges = parseAgeList(p.get("childAges"));
  const infantAges = parseAgeList(p.get("infantAges"));
  const adults = Math.max(1, countParam(p, "adults", 1, 9));
  const children = countParam(p, "children", childAges.length, 8);
  const infants = countParam(p, "infants", infantAges.length, 4);
  const out: SearchPassengerInput[] = [];
  for (let i = 0; i < adults; i++) out.push({ type: "adult" });
  for (const age of fitAges(childAges, children, DEFAULT_CHILD_AGE)) out.push({ type: "child", age });
  for (const age of fitAges(infantAges, infants, DEFAULT_INFANT_AGE)) out.push({ type: "infant_without_seat", age });
  return out;
}

export function buildSearchQuery(s: SearchParamsState): string {
  const q = new URLSearchParams({
    adults: String(s.pax.adult),
    children: String(s.pax.child),
    infants: String(s.pax.infant_without_seat),
    cabin: s.cabin,
  });
  // Alderen skrives når det finnes barn, slik at lenken beskriver følget selv.
  if (s.pax.child > 0) q.set("childAges", fitAges(s.ages.children, s.pax.child, DEFAULT_CHILD_AGE).join(","));
  if (s.pax.infant_without_seat > 0) q.set("infantAges", fitAges(s.ages.infants, s.pax.infant_without_seat, DEFAULT_INFANT_AGE).join(","));
  if (s.tripType === "multicity") {
    q.set("legs", s.legs.map((l) => `${l.from!.iata}:${l.to!.iata}:${l.date}`).join(","));
  } else {
    q.set("from", s.from!.iata);
    q.set("to", s.to!.iata);
    q.set("depart", s.depart);
    if (s.tripType === "roundtrip" && s.ret) q.set("ret", s.ret);
  }
  if (s.pref !== "best") q.set("sort", s.pref);
  if (s.flex && s.tripType !== "multicity") q.set("flex", "1");
  return q.toString();
}
