import { airportByIata, type Airport } from "@contracts/airports";
import type { CabinClass } from "@contracts/types";
import type { Preference } from "@/lib/offers";
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
  };
}

export function buildSearchQuery(s: SearchParamsState): string {
  const q = new URLSearchParams({
    adults: String(s.pax.adult),
    children: String(s.pax.child),
    infants: String(s.pax.infant_without_seat),
    cabin: s.cabin,
  });
  if (s.ages.children.length) q.set("childAges", s.ages.children.join(","));
  if (s.ages.infants.length) q.set("infantAges", s.ages.infants.join(","));
  if (s.tripType === "multicity") {
    q.set("legs", s.legs.map((l) => `${l.from!.iata}:${l.to!.iata}:${l.date}`).join(","));
  } else {
    q.set("from", s.from!.iata);
    q.set("to", s.to!.iata);
    q.set("depart", s.depart);
    if (s.tripType === "roundtrip" && s.ret) q.set("ret", s.ret);
  }
  if (s.pref !== "best") q.set("sort", s.pref);
  return q.toString();
}
