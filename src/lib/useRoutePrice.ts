import { trpc } from "@/providers/trpc";
import { departDate } from "@/content/discover";

const fmtNok = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

export type RoutePrice = { amount: number; label: string };

function toPrice(amount: string | number | null | undefined): RoutePrice | null {
  const n = amount === undefined || amount === null ? NaN : Number(amount);
  return Number.isFinite(n) && n > 0 ? { amount: n, label: `fra ${fmtNok.format(n)} kr` } : null;
}

const hintInput = (origin: string, destination: string, daysAhead: number) => ({
  origin,
  destination,
  cabinClass: "economy" as const,
  dates: [departDate(daysAhead)],
  passengers: ["adult" as const],
});

/**
 * Veiledende «fra»-pris for én rute – hentet fra pris-API-et
 * (flights.priceHints). Returnerer null når ingen pris finnes
 * (live-modus gir per i dag ingen dagpriser) – kortet viser da
 * rett og slett ingen prislinje i stedet for å finne på noe.
 */
export function useRoutePrice(originIata: string, destIata: string, daysAhead = 35) {
  const q = trpc.flights.priceHints.useQuery(hintInput(originIata, destIata, daysAhead), { staleTime: 600_000, retry: 1 });
  return toPrice(q.data?.[0]?.amount)?.label ?? null;
}

/**
 * Samme pris for mange ruter på én gang (kartet og rutenettet på forsiden).
 * Spørringene har samme nøkkel som useRoutePrice, så kort og kart deler
 * cache og ingen rute hentes to ganger.
 */
export function useRoutePrices(destIatas: string[], originIata = "OSL", daysAhead = 35): { prices: Record<string, RoutePrice | null>; pending: boolean } {
  const results = trpc.useQueries((q) => destIatas.map((d) => q.flights.priceHints(hintInput(originIata, d, daysAhead), { staleTime: 600_000, retry: 1 })));
  const prices: Record<string, RoutePrice | null> = {};
  destIatas.forEach((d, i) => {
    prices[d] = toPrice(results[i]?.data?.[0]?.amount);
  });
  return { prices, pending: results.some((r) => r.isPending) };
}
