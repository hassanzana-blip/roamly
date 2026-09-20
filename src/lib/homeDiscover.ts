import { ALL_DESTINATIONS, type DiscoverDestination } from "@/content/discover";
import { airportByIata } from "@contracts/airports";

/**
 * Reglene forsidens oppdagelsesdel deler.
 *
 * Her ligger det som må stemme uansett hvem som tegner seksjonen: hvilke
 * rammer man kan velge, hvilke flyplasser vi faktisk kan søke fra, hvordan
 * budsjettet blir en ekte parameter i søket, og hvilken årstid det er.
 */

export type Budget = 1500 | 3000 | null;
export const BUDGETS: Budget[] = [1500, 3000, null];

/** Avreisestedene den reisende kan bytte mellom. Alle finnes i flyplassregisteret. */
export const ORIGINS = ["OSL", "TRF", "BGO", "SVG"] as const;
export type OriginIata = (typeof ORIGINS)[number];

/** Kortnavnet folk bruker. Torp er ikke Oslo, og skal aldri slås sammen med det. */
export const ORIGIN_LABEL: Record<OriginIata, string> = { OSL: "Oslo", TRF: "Torp", BGO: "Bergen", SVG: "Stavanger" };

export type Trip = { depart: string; ret: string };

/**
 * Lenken til det ekte søket. Budsjettet blir `maxpris`, som resultatsiden
 * bruker som pristak – kortet lover altså ikke noe siden ikke gjør.
 */
export function flightSearchHref(origin: string, dest: Pick<DiscoverDestination, "iata">, trip: Trip, budget: Budget): string {
  const q = new URLSearchParams({
    from: origin,
    to: dest.iata,
    depart: trip.depart,
    ret: trip.ret,
    adults: "1",
    children: "0",
    infants: "0",
    cabin: "economy",
  });
  if (budget) q.set("maxpris", String(budget));
  return `/sok?${q.toString()}`;
}

/**
 * Reisemål vi har et kontrollert fotografi av, og som har en flyplass vi kan
 * søke mot. Uten begge deler hører reisemålet ikke hjemme på forsiden.
 */
export function photographed(ids: string[]): DiscoverDestination[] {
  return ids
    .map((id) => ALL_DESTINATIONS.find((d) => d.id === id))
    .filter((d): d is DiscoverDestination => Boolean(d?.image && airportByIata(d.iata)));
}

/** Årstiden nå, så banneret aldri står og lokker med høst i mai. */
export function seasonKey(month = new Date().getMonth()): "winter" | "spring" | "summer" | "autumn" {
  if (month <= 1 || month === 11) return "winter";
  if (month <= 4) return "spring";
  if (month <= 7) return "summer";
  return "autumn";
}
