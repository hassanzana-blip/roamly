import { trpc } from "@/providers/trpc";
import { departDate } from "@/content/discover";

const fmtNok = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

/**
 * Veiledende «fra»-pris for én rute – hentet fra pris-API-et
 * (flights.priceHints). Returnerer null når ingen pris finnes
 * (live-modus gir per i dag ingen dagpriser) – kortet viser da
 * rett og slett ingen prislinje i stedet for å finne på noe.
 */
export function useRoutePrice(originIata: string, destIata: string, daysAhead = 35) {
  const q = trpc.flights.priceHints.useQuery(
    {
      origin: originIata,
      destination: destIata,
      cabinClass: "economy",
      dates: [departDate(daysAhead)],
      passengers: ["adult"],
    },
    { staleTime: 600_000, retry: 1 },
  );
  const amount = q.data?.[0]?.amount;
  const n = amount ? Number(amount) : NaN;
  return Number.isFinite(n) && n > 0 ? `fra ${fmtNok.format(n)} kr` : null;
}
