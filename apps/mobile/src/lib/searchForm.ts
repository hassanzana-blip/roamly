import type { Airport } from "@contracts/airports";
import type { CabinClass, SearchPassengerInput } from "@contracts/types";
import type { SearchRequest } from "./api";
import { addDays, toIsoDate } from "./format";
import type { I18n } from "../i18n";
import type { FormErrorCode } from "../i18n/ns/search";

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

export const CABINS: readonly CabinClass[] = ["economy", "premium_economy", "business", "first"];

export function cabinLabel(c: CabinClass, { t }: Pick<I18n, "t">): string {
  return t.search.cabins[c] ?? c;
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

export function passengerSummary(f: Pick<SearchForm, "adults" | "childAges" | "infantAges">, { t }: Pick<I18n, "t">): string {
  const parts = [t.search.adults(f.adults)];
  if (f.childAges.length) parts.push(t.search.children(f.childAges.length));
  if (f.infantAges.length) parts.push(t.search.infants(f.infantAges.length));
  return parts.join(", ");
}

/** Hva som mangler eller er feil, som en kode (teksten står i ordboken). null = klar til søk. */
export function validateForm(f: SearchForm, today: string = toIsoDate(new Date())): FormErrorCode | null {
  if (!f.origin) return "noOrigin";
  if (!f.destination) return "noDestination";
  if (f.origin.iata === f.destination.iata) return "sameAirport";
  if (f.departDate < today) return "departPassed";
  if (f.tripType === "roundtrip" && f.returnDate < f.departDate) return "returnBeforeDepart";
  if (f.adults < 1) return "noAdult";
  if (passengerCount(f) > MAX_PASSENGERS) return "tooMany";
  if (f.infantAges.length > f.adults) return "infantsExceedAdults";
  return null;
}

/** Feilkoden som tekst på brukerens språk. */
export function formErrorText(code: FormErrorCode, { t }: Pick<I18n, "t">): string {
  const e = t.search.errors[code];
  return typeof e === "function" ? e(MAX_PASSENGERS) : e;
}

/** Skjemaet → søket serveren forventer. Barn og spedbarn sendes med alder. */
export function toSearchRequest(f: SearchForm, sessionId?: string): SearchRequest {
  if (!f.origin || !f.destination) throw new Error("Incomplete search form");
  const passengers: SearchPassengerInput[] = [
    ...Array.from({ length: f.adults }, () => ({ type: "adult" as const })),
    ...f.childAges.map((age) => ({ type: "child" as const, age })),
    ...f.infantAges.map((age) => ({ type: "infant_without_seat" as const, age })),
  ];
  const slices = [{ origin: f.origin.iata, destination: f.destination.iata, departureDate: f.departDate }];
  if (f.tripType === "roundtrip") slices.push({ origin: f.destination.iata, destination: f.origin.iata, departureDate: f.returnDate });
  return { slices, passengers, cabinClass: f.cabinClass, ...(f.directOnly ? { directOnly: true } : {}), ...(sessionId ? { sessionId } : {}) };
}

/** Flyplassøket slik det sendes: uten mellomrom i endene og med enkle mellomrom inni. */
export function normalizeQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}
