import type { MobileOffer } from "@contracts/mobileSearch";
import type { Offer } from "@contracts/types";

/**
 * Én reise, flere selgere – samme gruppering som nettet (src/lib/itineraryGroups.ts).
 *
 * Et metasøk får samme fly tilbake fra flere salgskanaler. Hver selger er et
 * eget tilbud med egen pris, bagasje og egne vilkår, men reisen er den samme.
 * Vi grupperer derfor på reisen og lar selgerne ligge inne i den; den billigste
 * selgeren (i kroner) representerer gruppen.
 *
 * Grupperingen skjer ETTER filtrering og sortering, så «fra»-prisen alltid er
 * et tilbud som faktisk passer filtrene, og rekkefølgen ikke endres.
 */

/** Reisens identitet: hvert flynummer med flyplasser og tider, i rekkefølge. Lik nettets. */
export function itinerarySignature(offer: Offer): string {
  return offer.slices
    .map((slice) =>
      slice.segments.map((s) => `${s.carrier.iata}${s.flightNumber ?? ""}:${s.origin.iata}>${s.destination.iata}:${s.departingAt}>${s.arrivingAt}`).join("|"),
    )
    .join("//");
}

export type Seller = { item: MobileOffer; nokMinor: number | null };

export type Journey = {
  key: string;
  /** Billigste selger med kronepris; uten kronepris: den første. */
  best: MobileOffer;
  /** Alle selgere av reisen, billigst i kroner først, uten kronepris sist. */
  sellers: Seller[];
};

export function nokMinorOf(item: MobileOffer): number | null {
  return item.price.nok.kind === "unavailable" ? null : item.price.nok.amountMinor;
}

/** Selgerens navn slik kunden kjenner det. */
export function sellerLabel(offer: Offer): string {
  return offer.booking?.kind === "external" ? offer.booking.provider.name.trim() || offer.owner.name : "HelloSky";
}

const rank = (n: number | null) => (n === null ? Number.POSITIVE_INFINITY : n);

/** Grupperer en allerede filtrert og sortert liste. En gruppe står der dens første tilbud sto. */
export function groupJourneys(items: MobileOffer[]): Journey[] {
  const byKey = new Map<string, Seller[]>();
  const order: string[] = [];
  for (const item of items) {
    const key = itinerarySignature(item.offer);
    const seller: Seller = { item, nokMinor: nokMinorOf(item) };
    const list = byKey.get(key);
    if (list) list.push(seller);
    else {
      byKey.set(key, [seller]);
      order.push(key);
    }
  }
  return order.map((key) => {
    const sellers = byKey.get(key)!.slice().sort((a, b) => rank(a.nokMinor) - rank(b.nokMinor) || sellerLabel(a.item.offer).localeCompare(sellerLabel(b.item.offer), "nb"));
    return { key, best: sellers[0]!.item, sellers };
  });
}

/** Reisen et tilbud hører til, blant de gitte tilbudene. */
export function journeyOf(items: MobileOffer[], offerId: string): Journey | null {
  const hit = items.find((i) => i.offer.id === offerId);
  if (!hit) return null;
  const key = itinerarySignature(hit.offer);
  return groupJourneys(items.filter((i) => itinerarySignature(i.offer) === key))[0] ?? null;
}

/**
 * Reisen med denne identiteten (samme fly og tider), blant de gitte tilbudene. Samme søk på nytt gir nye tilbud-ID-er
 * (metasøket lager dem per søk), så en åpen reise følges videre på identiteten.
 */
export function journeyByKey(items: MobileOffer[], key: string): Journey | null {
  return groupJourneys(items.filter((i) => itinerarySignature(i.offer) === key))[0] ?? null;
}
