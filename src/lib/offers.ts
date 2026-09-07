import { Baby, Luggage, Rabbit, Route, ShieldCheck, ThumbsUp, Timer, Wallet, type LucideIcon } from "lucide-react";
import type { Offer, OfferPassenger, OfferSlice, SearchPassengerInput } from "@contracts/types";
import type { I18nKey } from "@/lib/i18n";

/**
 * Ranking and family/baggage helpers for flight offers.
 * Everything here is derived from the offer data Duffel (or demo mode)
 * returns. Nothing is invented.
 */

export type Preference = "best" | "cheapest" | "fastest" | "baggage" | "family" | "short_layovers" | "flexible" | "fewer_stops";

export const PREFERENCES: { key: Preference; label: I18nKey; hint: I18nKey; icon: LucideIcon }[] = [
  { key: "best", label: "pref.best", hint: "pref.best.hint", icon: ThumbsUp },
  { key: "cheapest", label: "pref.cheapest", hint: "pref.cheapest.hint", icon: Wallet },
  { key: "fastest", label: "pref.fastest", hint: "pref.fastest.hint", icon: Rabbit },
  { key: "baggage", label: "pref.baggage", hint: "pref.baggage.hint", icon: Luggage },
  { key: "family", label: "pref.family", hint: "pref.family.hint", icon: Baby },
  { key: "short_layovers", label: "pref.short_layovers", hint: "pref.short_layovers.hint", icon: Timer },
  { key: "flexible", label: "pref.flexible", hint: "pref.flexible.hint", icon: ShieldCheck },
  { key: "fewer_stops", label: "pref.fewer_stops", hint: "pref.fewer_stops.hint", icon: Route },
];

export function isPreference(v: string | null | undefined): v is Preference {
  return PREFERENCES.some((p) => p.key === v);
}

export function totalMinutes(o: Offer): number {
  return o.slices.reduce((s, x) => s + x.durationMinutes, 0);
}

export function maxStops(o: Offer): number {
  return Math.max(...o.slices.map((s) => s.stops));
}

export function amount(o: Offer): number {
  return Number(o.totalAmount);
}

/** Layovers in a slice: airport + minutes waiting. */
export function layovers(slice: OfferSlice): { city: string; iata: string; minutes: number; airportChange: boolean }[] {
  const out: { city: string; iata: string; minutes: number; airportChange: boolean }[] = [];
  for (let i = 0; i < slice.segments.length - 1; i++) {
    const a = slice.segments[i];
    const b = slice.segments[i + 1];
    out.push({
      city: a.destination.city,
      iata: a.destination.iata,
      minutes: Math.round((new Date(b.departingAt).getTime() - new Date(a.arrivingAt).getTime()) / 60_000),
      airportChange: a.destination.iata !== b.origin.iata,
    });
  }
  return out;
}

export function longestLayover(o: Offer): number {
  return Math.max(0, ...o.slices.flatMap((s) => layovers(s).map((l) => l.minutes)));
}

export function hasAirportChange(o: Offer): boolean {
  return o.slices.some((s) => layovers(s).some((l) => l.airportChange));
}

/** Passengers that pay a fare (infants on laps are near-free). */
export function payingPassengers(pax: Pick<OfferPassenger, "type">[] | SearchPassengerInput[]): number {
  return pax.filter((p) => p.type !== "infant_without_seat").length || 1;
}

/** Children + infants in a passenger list. */
export function minorCount(pax: Pick<OfferPassenger, "type">[] | SearchPassengerInput[]): number {
  return pax.filter((p) => p.type !== "adult").length;
}

export function isFamily(pax: Pick<OfferPassenger, "type">[] | SearchPassengerInput[]): boolean {
  return minorCount(pax) > 0 || pax.length >= 3;
}

/** Minimum checked bags that hold for the whole trip (all slices, all segments). */
export function checkedBagsForTrip(o: Offer): number {
  const perSlice = o.slices.map((s) => {
    const segs = s.segments.filter((x) => x.baggage);
    return segs.length ? Math.min(...segs.map((x) => x.baggage!.checkedBags)) : o.baggage.checkedBags;
  });
  return Math.min(o.baggage.checkedBags, ...perSlice);
}

/** Sort key for each preference, lower is better. `price(o)` should be the fee-inclusive total. */
export function score(
  o: Offer,
  pref: Preference,
  ctx: { minPrice: number; minMinutes: number; price: (o: Offer) => number },
): number {
  const total = ctx.price(o);
  const price = total / Math.max(1, ctx.minPrice); // 1 = cheapest
  const time = totalMinutes(o) / Math.max(1, ctx.minMinutes); // 1 = fastest
  const stops = maxStops(o);
  const bags = checkedBagsForTrip(o);
  const layover = longestLayover(o);
  const flexible = o.refundable ? 0 : o.changeable ? 0.5 : 1;
  switch (pref) {
    case "cheapest":
      return total;
    case "fastest":
      return totalMinutes(o);
    case "baggage":
      // Bags first, then price
      return (bags > 0 ? 0 : 1) * 1_000_000_000 + total;
    case "fewer_stops":
      return stops * 1_000_000_000 + layover * 1000 + total;
    case "short_layovers":
      return (stops === 0 ? 0 : layover) * 1_000_000 + total;
    case "flexible":
      return flexible * 1_000_000_000 + total;
    case "family":
      // Long layovers and airport changes hurt families most; bags matter.
      return (
        price * 0.5 +
        time * 0.3 +
        stops * 0.35 +
        (bags > 0 ? 0 : 0.4) +
        (layover > 240 ? 0.3 : 0) +
        (hasAirportChange(o) ? 0.5 : 0) +
        (o.slices.some((s) => s.segments.some((x) => x.departingAt.slice(11, 13) < "06")) ? 0.15 : 0)
      );
    default:
      return price * 0.6 + time * 0.3 + stops * 0.15 + (layover > 300 ? 0.1 : 0);
  }
}

export function rank(offers: Offer[], pref: Preference, price: (o: Offer) => number = amount): Offer[] {
  if (offers.length === 0) return offers;
  const ctx = {
    minPrice: Math.min(...offers.map(price)),
    minMinutes: Math.min(...offers.map(totalMinutes)),
    price,
  };
  return [...offers].sort((a, b) => score(a, pref, ctx) - score(b, pref, ctx));
}

/** Short reasons an offer ranks well for a preference: shown as quiet tags on the card. */
export function highlights(o: Offer, pax: Pick<OfferPassenger, "type">[]): I18nKey[] {
  const out: I18nKey[] = [];
  if (maxStops(o) === 0) out.push("oc.direct");
  if (checkedBagsForTrip(o) > 0) out.push("oc.tag.bags");
  if (o.refundable) out.push("oc.tag.refundable");
  else if (o.changeable) out.push("oc.tag.changeable");
  if (isFamily(pax) && maxStops(o) <= 1 && longestLayover(o) <= 180 && !hasAirportChange(o)) out.push("oc.tag.family");
  return out;
}
