import type { Offer } from "@contracts/types";
import { dayOffset, minutesBetween } from "./format";

/**
 * Det en reisende bør vite før de går videre til tilbyderen – regnet bare ut
 * fra tidene og flyplassene leverandøren oppga:
 *  - airportChange: bytte av flyplass mellom to fly (f.eks. CDG → ORY),
 *  - overnight: ankomst et senere døgn enn avgang, eller et bytte over natten,
 *  - longLayover: bytte på 6 timer eller mer.
 * Ukjente eller ugyldige tider gir ingen advarsel (heller ingen påstand).
 */
export type JourneyWarning =
  | { kind: "airportChange"; slice: number; from: string; to: string; city: string }
  | { kind: "overnight"; slice: number; days: number }
  | { kind: "overnightLayover"; slice: number; city: string }
  | { kind: "longLayover"; slice: number; city: string; minutes: number };

export const LONG_LAYOVER_MINUTES = 6 * 60;

export function journeyWarnings(offer: Offer): JourneyWarning[] {
  const out: JourneyWarning[] = [];
  offer.slices.forEach((slice, i) => {
    const days = dayOffset(slice.departingAt, slice.arrivingAt);
    if (days > 0) out.push({ kind: "overnight", slice: i, days });
    slice.segments.forEach((seg, j) => {
      const next = slice.segments[j + 1];
      if (!next) return;
      const city = seg.destination.city || seg.destination.iata;
      if (next.origin.iata !== seg.destination.iata) out.push({ kind: "airportChange", slice: i, from: seg.destination.iata, to: next.origin.iata, city });
      const minutes = minutesBetween(seg.arrivingAt, next.departingAt);
      if (minutes !== null && minutes >= LONG_LAYOVER_MINUTES) out.push({ kind: "longLayover", slice: i, city, minutes });
      if (dayOffset(seg.arrivingAt, next.departingAt) > 0) out.push({ kind: "overnightLayover", slice: i, city });
    });
  });
  return out;
}
