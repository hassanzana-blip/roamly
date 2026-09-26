import type { CabinClass } from "@contracts/types";

/** Søkeskjemaet: reisende, klasse og feilmeldinger (tekstene bak valideringskodene i searchForm.ts). */
export type FormErrorCode = "noOrigin" | "noDestination" | "sameAirport" | "departPassed" | "returnBeforeDepart" | "noAdult" | "tooMany" | "infantsExceedAdults";

const en = {
  cabins: { economy: "Economy", premium_economy: "Premium economy", business: "Business", first: "First" } satisfies Record<CabinClass, string>,
  adults: (n: number) => `${n} ${n === 1 ? "adult" : "adults"}`,
  children: (n: number) => `${n} ${n === 1 ? "child" : "children"}`,
  infants: (n: number) => `${n} ${n === 1 ? "infant" : "infants"}`,
  errors: {
    noOrigin: "Choose where you are flying from.",
    noDestination: "Choose where you are going.",
    sameAirport: "Departure and destination can't be the same airport.",
    departPassed: "The departure date has passed. Choose a new date.",
    returnBeforeDepart: "The return can't be before the departure.",
    noAdult: "At least one adult must travel.",
    tooMany: (max: number) => `Up to ${max} travellers per search.`,
    infantsExceedAdults: "Each infant needs an adult to sit on.",
  } satisfies Record<FormErrorCode, string | ((max: number) => string)>,
};

const nb: typeof en = {
  cabins: { economy: "Økonomi", premium_economy: "Premium økonomi", business: "Business", first: "Første klasse" },
  adults: (n) => `${n} ${n === 1 ? "voksen" : "voksne"}`,
  children: (n) => `${n} barn`,
  infants: (n) => `${n} spedbarn`,
  errors: {
    noOrigin: "Velg hvor du reiser fra.",
    noDestination: "Velg hvor du skal.",
    sameAirport: "Avreise og reisemål kan ikke være samme flyplass.",
    departPassed: "Utreisedatoen har passert. Velg en ny dato.",
    returnBeforeDepart: "Hjemreisen kan ikke være før utreisen.",
    noAdult: "Minst én voksen må reise.",
    tooMany: (max) => `Maks ${max} reisende per søk.`,
    infantsExceedAdults: "Hvert spedbarn må ha en voksen på fanget.",
  },
};

export const search = { en, nb };
