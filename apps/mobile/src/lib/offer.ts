import type { Offer } from "@contracts/types";

/**
 * Fakta om et tilbud som appen kan vise. Appen er bare for flysøk og
 * sammenligning: den har ingen bestilling og åpner aldri leverandørens lenke.
 * Selgerens navn vises som opplysning når leverandøren oppgir det.
 */

/** Hvem som selger billetten, når leverandøren oppgir det; ellers null. */
export function sellerName(offer: Offer): string | null {
  const b = offer.booking;
  if (!b || b.kind !== "external") return null;
  const name = b.provider?.name?.trim();
  return name ? name : null;
}

/** Tilbudet er eldre enn leverandørens gyldighetstid, så prisen kan ha endret seg. */
export function offerExpired(offer: Offer, now: Date = new Date()): boolean {
  const t = Date.parse(offer.expiresAt);
  return Number.isFinite(t) && t < now.getTime();
}
