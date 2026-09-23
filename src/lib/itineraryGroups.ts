import type { Offer } from "@contracts/types";
import { providerName } from "@/components/offers/offerUtils";

/**
 * Én reise, flere selgere.
 *
 * Et metasøk får samme fly tilbake fra flere salgskanaler. Leverandøren
 * regner dem som forskjellige tilbud, og det er de – prisen og vilkårene
 * kan skille – men reisen er den samme: samme fly, samme tider, samme
 * flyplasser. Viser vi dem som separate kort, ber vi brukeren sammenligne
 * det som allerede er likt.
 *
 * Derfor grupperer vi på reisen og lar selgerne ligge inne i kortet. Den
 * billigste selgeren representerer gruppen: to identiske reiser skilles
 * bare av pris og vilkår, og da er den billigste aldri et dårligere valg
 * som utgangspunkt.
 *
 * Grupperingen skjer etter filtrering og rangering, slik at den ikke kan
 * endre hvilke reiser som vises eller i hvilken rekkefølge.
 */

/**
 * Reisens identitet: hvert flynummer med sine flyplasser og tider, i
 * rekkefølge. To tilbud med samme signatur er den samme reisen.
 *
 * Vi bruker ikke tilbudets egen id – den er leverandørens, og den er
 * forskjellig nettopp fordi selgeren er forskjellig.
 */
export function itinerarySignature(offer: Offer): string {
  return offer.slices
    .map((slice) =>
      slice.segments
        .map((s) => `${s.carrier.iata}${s.flightNumber ?? ""}:${s.origin.iata}>${s.destination.iata}:${s.departingAt}>${s.arrivingAt}`)
        .join("|"),
    )
    .join("//");
}

export type Seller = {
  offer: Offer;
  /** Fullstendig totalpris i minste enhet, regnet av siden. */
  totalMinor: number;
};

export type OfferGroup = {
  /** Reisens signatur – stabil nøkkel for React. */
  key: string;
  /** Den billigste selgeren. Representerer gruppen. */
  best: Offer;
  bestTotal: number;
  /** Alle selgere av denne reisen, billigst først. Minst én. */
  sellers: Seller[];
};

/**
 * Grupperer en allerede filtrert og rangert liste.
 *
 * Rekkefølgen bevares: en gruppe havner der dens første tilbud lå i
 * inndataene, så rangeringen bestemmer fortsatt hva som står øverst.
 */
export function groupOffers(offers: Offer[], totalOf: (offer: Offer) => number): OfferGroup[] {
  const byKey = new Map<string, OfferGroup>();
  const order: string[] = [];

  for (const offer of offers) {
    const key = itinerarySignature(offer);
    const seller: Seller = { offer, totalMinor: totalOf(offer) };
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { key, best: offer, bestTotal: seller.totalMinor, sellers: [seller] });
      order.push(key);
      continue;
    }
    existing.sellers.push(seller);
    if (seller.totalMinor < existing.bestTotal) {
      existing.best = offer;
      existing.bestTotal = seller.totalMinor;
    }
  }

  for (const group of byKey.values()) {
    // Stabil sortering: pris først, så selgerens navn, slik at to like priser
    // ikke bytter plass mellom to renderinger.
    group.sellers.sort((a, b) => a.totalMinor - b.totalMinor || providerName(a.offer).localeCompare(providerName(b.offer), "nb"));
  }

  return order.map((key) => byKey.get(key)!);
}
