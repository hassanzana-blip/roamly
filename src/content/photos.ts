import { DESTINATIONS } from "@/content/discover";

/**
 * Bildeopphav.
 *
 * HelloSky bruker ekte fotografi. Ingen AI-genererte reisebilder, ingen
 * oppdiktede landemerker, ingen genererte mennesker. Hvert bilde er
 * kontrollert av et menneske for å vise stedet det sier det viser.
 *
 * Dette registeret er kilden til /fotokreditering. Der vi ennå ikke har
 * fotografens navn nedtegnet, står det tomt – vi finner ikke på et navn for
 * å fylle en kolonne. Feltene fylles ut etter hvert som opphavet bekreftes
 * mot kildesamlingen.
 */

export type PhotoSource = "unsplash" | "pexels" | "hellosky" | "web";

export type PhotoCredit = {
  /** Filnavn uten variantsuffiks, f.eks. "istanbul". */
  key: string;
  /** Hva bildet viser. */
  caption: string;
  /** Stedet, når bildet hører til et reisemål. */
  destinationId?: string;
  source: PhotoSource;
  /** Fotografens navn, når det er bekreftet. */
  photographer?: string;
  /** Lenke til fotografens profil hos kilden. */
  photographerUrl?: string;
  /** Lenke til originalbildet. */
  sourceUrl?: string;
};

const LICENCE: Record<PhotoSource, string> = {
  unsplash: "Unsplash-lisens",
  pexels: "Pexels-lisens",
  hellosky: "HelloSky",
  web: "Midlertidig – erstattes med lisensiert foto før lansering",
};

export function licenceLabel(source: PhotoSource): string {
  return LICENCE[source];
}

/**
 * Reisemålsfotoene. De eldste er hentet fra Unsplash- og Pexels-samlingene
 * under deres respektive lisenser. De nyeste (WEB_SOURCED) er redaksjonelle
 * plassholdere hentet fra åpne websider – de vises med ærlig merking på
 * /fotokreditering og skal erstattes med fullt lisensierte bilder
 * (Unsplash/Pexels eller kjøpt stock) før kommersiell lansering. Alle er
 * kontrollert mot stedet de viser.
 */
const WEB_SOURCED = new Set([
  "mallorca", "grancanaria", "tenerife", "alicante", "antalya", "santorini",
  "kreta", "rhodos", "algarve", "nice", "dubrovnik", "split", "venezia",
  "praha", "amsterdam", "kobenhavn", "madeira", "island", "rovaniemi",
  "bali", "maldivene", "lofoten", "bergen",
]);

export const PHOTO_CREDITS: PhotoCredit[] = DESTINATIONS.filter((d) => d.image).map((d) => {
  const key = d.image!.replace("/destinations/", "").replace(".jpg", "");
  return {
    key,
    caption: d.imageAlt,
    destinationId: d.id,
    source: (WEB_SOURCED.has(key) ? "web" : "unsplash") as PhotoSource,
  };
});

/** Bilder som ikke hører til ett reisemål. */
export const OTHER_CREDITS: PhotoCredit[] = [
  { key: "hero-wing", caption: "Vinge over skylaget i solnedgang", source: "unsplash" },
];

export const ALL_CREDITS: PhotoCredit[] = [...PHOTO_CREDITS, ...OTHER_CREDITS];

/** Hvor mange bilder som ennå mangler navngitt fotograf. */
export function pendingAttributionCount(): number {
  return ALL_CREDITS.filter((c) => !c.photographer).length;
}

export function photoSrc(key: string): string {
  return key === "hero-wing" ? "/photos/hero-wing-800.jpg" : `/destinations/${key}-640.jpg`;
}
