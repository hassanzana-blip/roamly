import type { OfferSlice } from "@contracts/types";
import { currentLang } from "@/lib/format";

/** Bagasje for én strekning: minste tillatte over segmentene (det som faktisk gjelder hele veien). */
export function sliceBaggage(slice: OfferSlice, fallback: { carryOnBags: number; checkedBags: number }) {
  const segs = slice.segments.filter((s) => s.baggage);
  if (!segs.length) return fallback;
  return {
    carryOnBags: Math.min(...segs.map((s) => s.baggage!.carryOnBags)),
    checkedBags: Math.min(...segs.map((s) => s.baggage!.checkedBags)),
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
