import type { Locale } from "../i18n/types";
import type { AirportChoice } from "./searchForm";

/**
 * Hovedflyplassene i Norge, som forslag i «Fra» før kunden har skrevet noe.
 * Bare navn og koder – ingen påstand om at de er «populære».
 */
const AIRPORTS: { iata: string; name: string; city: string }[] = [
  { iata: "OSL", name: "Oslo lufthavn Gardermoen", city: "Oslo" },
  { iata: "BGO", name: "Bergen lufthavn Flesland", city: "Bergen" },
  { iata: "TRD", name: "Trondheim lufthavn Værnes", city: "Trondheim" },
  { iata: "SVG", name: "Stavanger lufthavn Sola", city: "Stavanger" },
  { iata: "TOS", name: "Tromsø lufthavn Langnes", city: "Tromsø" },
  { iata: "BOO", name: "Bodø lufthavn", city: "Bodø" },
  { iata: "AES", name: "Ålesund lufthavn Vigra", city: "Ålesund" },
  { iata: "KRS", name: "Kristiansand lufthavn Kjevik", city: "Kristiansand" },
];

/** Landet på riktig språk for Norges flyplasser (standardskjemaets «Oslo» er lagret med «Norge»). */
export function countryFor(airport: Pick<AirportChoice, "iata" | "country">, locale: Locale): string {
  return AIRPORTS.some((a) => a.iata === airport.iata) ? (locale === "nb" ? "Norge" : "Norway") : airport.country;
}

export function norwayAirports(locale: Locale): AirportChoice[] {
  const country = locale === "nb" ? "Norge" : "Norway";
  return AIRPORTS.map((a) => ({ ...a, country }));
}
