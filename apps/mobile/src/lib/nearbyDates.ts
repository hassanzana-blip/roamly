import { addDays, toIsoDate } from "./format";
import type { SearchForm } from "./searchForm";

/** Hvor mange dager før og etter (som nettets «Prøv datoene rundt»). */
export const NEARBY_SHIFTS = [-3, -1, 1, 3] as const;

export type NearbyDates = { days: number; departDate: string; returnDate: string };

/**
 * Samme reise noen dager før eller etter, med samme reiselengde – bare datoer som ikke har passert. Ingen priser
 * og ingen løfter om at det finnes fly: hvert valg er et nytt søk.
 */
export function nearbyDates(q: Pick<SearchForm, "departDate" | "returnDate">, today: Date = new Date()): NearbyDates[] {
  const first = toIsoDate(today);
  return NEARBY_SHIFTS.map((days) => ({ days, departDate: addDays(q.departDate, days), returnDate: addDays(q.returnDate, days) })).filter((d) => d.departDate >= first);
}
