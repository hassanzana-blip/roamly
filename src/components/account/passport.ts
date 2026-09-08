import { useMemo } from "react";
import { airportByIata } from "@contracts/airports";
import type { TripSummary } from "@/components/account/tripUtils";

/**
 * Reisepasset: land, byer og antall reiser regnet fra ekte, gjennomførte
 * bestillinger. Ingen anslag, ingen avrunding oppover – en avlyst reise
 * teller ikke, og en reise som ikke har gått ennå teller ikke.
 */
export type Passport = { countries: [string, string][]; cities: number; flown: number };

export function usePassport(trips: TripSummary[], now: number): Passport {
  return useMemo(() => {
    const c = new Map<string, string>();
    const cityNames = new Set<string>();
    let n = 0;
    for (const trip of trips) {
      if (trip.cancelledAt || !trip.departingAt) continue;
      if (Date.parse(trip.departingAt) > now) continue;
      n += 1;
      const a = airportByIata(trip.destinationIata);
      if (a?.countryCode) c.set(a.countryCode, a.country);
      if (a?.city) cityNames.add(a.city);
    }
    return { countries: [...c.entries()], cities: cityNames.size, flown: n };
  }, [trips, now]);
}
