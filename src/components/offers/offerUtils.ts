import type { BaggageAllowance, Offer, OfferPassenger, OfferSlice } from "@contracts/types";
import { currentLang } from "@/lib/format";

/**
 * Bagasje for én strekning: minste tillatte over segmentene (det som faktisk
 * gjelder hele veien). Mangler tillatelsen på ett segment, er den ukjent for
 * hele strekningen – vi lover aldri noe det svakeste leddet ikke dekker, og
 * vi påstår aldri «ikke inkludert» når flyselskapet bare har tiet.
 */
export function sliceBaggage(slice: OfferSlice, fallback: BaggageAllowance): BaggageAllowance {
  const segs = slice.segments.filter((s) => s.baggage);
  if (segs.length !== slice.segments.length) return fallback;
  return {
    carryOnBags: Math.min(...segs.map((s) => s.baggage!.carryOnBags)),
    checkedBags: Math.min(...segs.map((s) => s.baggage!.checkedBags)),
    ...(segs.some((s) => s.baggage!.carryOnUnknown) ? { carryOnUnknown: true } : {}),
    ...(segs.some((s) => s.baggage!.checkedUnknown) ? { checkedUnknown: true } : {}),
  };
}

/** «Reise» / «Utreise» / «Hjemreise» / «Strekning n» – følger aktivt språk. */
export function sliceLabel(count: number, i: number): string {
  const en = currentLang() !== "nb";
  if (count === 1) return en ? "Trip" : "Reise";
  if (i === 0) return en ? "Outbound" : "Utreise";
  if (count === 2) return en ? "Return" : "Hjemreise";
  return en ? `Leg ${i + 1}` : `Strekning ${i + 1}`;
}

/** "2 voksne · 1 barn" from the offer's passenger list; infants only when present. */
export function partyLabel(passengers: Pick<OfferPassenger, "type">[], t: (key: "pax.adults" | "pax.children" | "pax.infants", vars: { count: number }) => string): string {
  const n = (type: OfferPassenger["type"]) => passengers.filter((p) => p.type === type).length;
  const parts: string[] = [];
  if (n("adult")) parts.push(t("pax.adults", { count: n("adult") }));
  if (n("child")) parts.push(t("pax.children", { count: n("child") }));
  if (n("infant_without_seat")) parts.push(t("pax.infants", { count: n("infant_without_seat") }));
  return parts.join(" · ");
}

/** Who the person books with: the provider named by KAYAK, or the airline for our own checkout. */
export function providerName(offer: Offer): string {
  return offer.booking?.provider.name.trim() || offer.owner.name;
}
