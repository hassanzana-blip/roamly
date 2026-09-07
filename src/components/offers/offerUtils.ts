import type { BaggageAllowance, OfferSlice } from "@contracts/types";
import { currentLang } from "@/lib/format";

/**
 * Bagasje for én strekning: minste tillatte over segmentene (det som faktisk
 * gjelder hele veien). Mangler tillatelsen på ett segment, er den ukjent for
 * hele strekningen — vi lover aldri noe det svakeste leddet ikke dekker, og
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

/** «Reise» / «Utreise» / «Hjemreise» / «Strekning n» — følger aktivt språk. */
export function sliceLabel(count: number, i: number): string {
  const en = currentLang() !== "nb";
  if (count === 1) return en ? "Trip" : "Reise";
  if (i === 0) return en ? "Outbound" : "Utreise";
  if (count === 2) return en ? "Return" : "Hjemreise";
  return en ? `Leg ${i + 1}` : `Strekning ${i + 1}`;
}
