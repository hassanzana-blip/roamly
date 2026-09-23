import type { Airport } from "@contracts/airports";
import type { CabinClass, SearchPassengerInput } from "@contracts/types";
import type { SearchRequest } from "./api";
import { addDays, toIsoDate } from "./format";

/** Samme regler som nettets passasjervelger. */
export const MAX_PASSENGERS = 9;
export const CHILD_AGES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
export const INFANT_AGES = [0, 1] as const;
export const DEFAULT_CHILD_AGE = 8;
export const DEFAULT_INFANT_AGE = 1;

export type AirportChoice = Pick<Airport, "iata" | "name" | "city" | "country">;

export type SearchForm = {
  tripType: "oneway" | "roundtrip";
  origin: AirportChoice | null;
  destination: AirportChoice | null;
  departDate: string;
  returnDate: string;
  adults: number;
  childAges: number[];
  infantAges: number[];
  cabinClass: CabinClass;
  directOnly: boolean;
};

export const CABINS: { value: CabinClass; label: string }[] = [
  { value: "economy", label: "Økonomi" },
  { value: "premium_economy", label: "Premium økonomi" },
  { value: "business", label: "Business" },
  { value: "first", label: "Første klasse" },
];

export function cabinLabel(c: CabinClass): string {
  return CABINS.find((x) => x.value === c)?.label ?? c;
}

export const OSLO: AirportChoice = { iata: "OSL", name: "Oslo lufthavn Gardermoen", city: "Oslo", country: "Norge" };

export function initialForm(today: Date = new Date()): SearchForm {
  const depart = addDays(toIsoDate(today), 14);
  return {
    tripType: "roundtrip",
    origin: OSLO,
    destination: null,
    departDate: depart,
    returnDate: addDays(depart, 7),
    adults: 1,
    childAges: [],
    infantAges: [],
    cabinClass: "economy",
    directOnly: false,
  };
}

export function passengerCount(f: Pick<SearchForm, "adults" | "childAges" | "infantAges">): number {
  return f.adults + f.childAges.length + f.infantAges.length;
}

export function passengerSummary(f: Pick<SearchForm, "adults" | "childAges" | "infantAges">): string {
  const parts = [`${f.adults} ${f.adults === 1 ? "voksen" : "voksne"}`];
  if (f.childAges.length) parts.push(`${f.childAges.length} ${f.childAges.length === 1 ? "barn" : "barn"}`);
  if (f.infantAges.length) parts.push(`${f.infantAges.length} ${f.infantAges.length === 1 ? "spedbarn" : "spedbarn"}`);
  return parts.join(", ");
}

/** Hva som mangler eller er feil, på norsk. null = klar til søk. */
export function validateForm(f: SearchForm, today: string = toIsoDate(new Date())): string | null {
  if (!f.origin) return "Velg hvor du reiser fra.";
  if (!f.destination) return "Velg hvor du skal.";
  if (f.origin.iata === f.destination.iata) return "Avreise og reisemål kan ikke være samme flyplass.";
  if (f.departDate < today) return "Utreisedatoen har passert. Velg en ny dato.";
  if (f.tripType === "roundtrip" && f.returnDate < f.departDate) return "Hjemreisen kan ikke være før utreisen.";
  if (f.adults < 1) return "Minst én voksen må reise.";
  if (passengerCount(f) > MAX_PASSENGERS) return `Maks ${MAX_PASSENGERS} reisende per søk.`;
  if (f.infantAges.length > f.adults) return "Hvert spedbarn må ha en voksen på fanget.";
  return null;
}

/** Skjemaet → søket serveren forventer. Barn og spedbarn sendes med alder. */
export function toSearchRequest(f: SearchForm, sessionId?: string): SearchRequest {
  if (!f.origin || !f.destination) throw new Error("Skjemaet er ikke komplett");
  const passengers: SearchPassengerInput[] = [
    ...Array.from({ length: f.adults }, () => ({ type: "adult" as const })),
    ...f.childAges.map((age) => ({ type: "child" as const, age })),
    ...f.infantAges.map((age) => ({ type: "infant_without_seat" as const, age })),
  ];
  const slices = [{ origin: f.origin.iata, destination: f.destination.iata, departureDate: f.departDate }];
  if (f.tripType === "roundtrip") slices.push({ origin: f.destination.iata, destination: f.origin.iata, departureDate: f.returnDate });
  return { slices, passengers, cabinClass: f.cabinClass, ...(f.directOnly ? { directOnly: true } : {}), ...(sessionId ? { sessionId } : {}) };
}
