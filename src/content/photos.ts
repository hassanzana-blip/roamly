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

export type PhotoSource = "unsplash" | "pexels" | "hellosky";

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
};

export function licenceLabel(source: PhotoSource): string {
  return LICENCE[source];
}

/**
 * Reisemålsfotoene. Alle er hentet fra Unsplash- og Pexels-samlingene under
 * deres respektive lisenser, og alle er kontrollert mot stedet de viser.
 */
export const PHOTO_CREDITS: PhotoCredit[] = DESTINATIONS.filter((d) => d.image).map((d) => ({
  key: d.image!.replace("/destinations/", "").replace(".jpg", ""),
  caption: d.imageAlt,
  destinationId: d.id,
  source: "unsplash" as const,
}));

/** Bilder som ikke hører til ett reisemål. */
export const OTHER_CREDITS: PhotoCredit[] = [
  { key: "hero-wing", caption: "Vinge over skylaget i solnedgang", source: "unsplash" },
  { key: "hero-bay", caption: "Kalksteinsøyer i en bukt ved soloppgang", source: "unsplash" },
  { key: "ocean-wave", caption: "Åpent hav", source: "unsplash" },
  { key: "norway-flag", caption: "Norsk flagg mot fjord", source: "unsplash" },
  { key: "cruise-hero", caption: "Cruiseskip ved kai på en karibisk strand", source: "pexels" },
  { key: "cruise-fjord", caption: "Cruiseskip i norsk fjord", source: "unsplash" },
  { key: "cruise-sunset", caption: "Cruiseskip i solnedgang", source: "unsplash" },
  { key: "cruise-caribbean", caption: "Cruiseskip i Karibien", source: "unsplash" },
  { key: "hotel-resort", caption: "Hotellbasseng med solsenger", source: "unsplash" },
  { key: "hotel-terrace", caption: "Hotellterrasse med utsikt", source: "unsplash" },
  { key: "hotel-villa", caption: "Villa med hage", source: "unsplash" },
  { key: "car-sedan", caption: "Leiebil på landevei", source: "unsplash" },
  { key: "car-suv", caption: "SUV på fjellvei", source: "unsplash" },
  { key: "car-roadtrip", caption: "Bil på kystvei", source: "unsplash" },
];

export const ALL_CREDITS: PhotoCredit[] = [...PHOTO_CREDITS, ...OTHER_CREDITS];

/** Hvor mange bilder som ennå mangler navngitt fotograf. */
export function pendingAttributionCount(): number {
  return ALL_CREDITS.filter((c) => !c.photographer).length;
}

export function photoSrc(key: string): string {
  // Heroene er beskåret bredt og finnes bare i 800 og oppover.
  if (key === "hero-wing" || key === "hero-bay") return `/photos/${key}-800.jpg`;
  // De nye produktbildene (cruise, hotell, bil, hero, hav) ligger i /photos.
  if (OTHER_CREDITS.some((c) => c.key === key)) return `/photos/${key}-640.jpg`;
  return `/destinations/${key}-640.jpg`;
}
