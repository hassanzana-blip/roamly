/**
 * Leiebilsøk (metasøk via KAYAK Cars API). Alt kommer fra leverandøren:
 * bilbilde, utleieselskap, vilkår og pris. Lenken går til leverandørens
 * bestillingsside – HelloSky selger ikke leiebil.
 */

export interface CarPlace {
  /** `airport` (IATA) eller `city` (KAYAK place id). */
  type: "airport" | "city";
  value: string;
  name: string;
  fullName?: string;
  countryCode?: string;
}

export interface CarAgency {
  code: string;
  name: string;
  logoUrl?: string;
}

/** Kjørelengde slik leverandøren oppgir den. `unit` leses fra visningsteksten («100 mi»). */
export interface CarMileage {
  code: "unlimited" | "limited" | "unknown";
  limit?: number;
  unit?: "mi" | "km";
  displayName?: string;
}

/** Kode + leverandørens engelske tekst. Klienten oversetter kjente koder og utelater ukjente. */
export interface CarTermCode {
  code: string;
  displayName: string;
}

/** Hvor bilen hentes i forhold til terminalen. `unknown` når leverandøren ikke sier det. */
export type CarLocationType = "inTerminal" | "shuttle" | "meetAndGreet" | "offAirport" | "unknown";

export interface CarOffer {
  id: string;
  /** Bilmodell slik leverandøren oppgir den, f.eks. «Toyota Corolla». */
  model: string;
  /** «eller lignende» – leverandøren garanterer klassen, ikke modellen. */
  orSimilar: boolean;
  className: string;
  seats: number | null;
  bags: number | null;
  doors: number | null;
  transmission: "automatic" | "manual" | null;
  airConditioning: boolean | null;
  /** Leverandørens bilbilde (KAYAK-levert). Tom = nøytral plassholder. */
  imageUrl?: string;
  agency: CarAgency;
  /** Formidleren som selger (kan være lik agency). */
  provider: CarAgency;
  pickup: { name: string; inTerminal?: boolean; locationType: CarLocationType; distance?: string };
  /** `sameAsPickup` når leverandøren ikke oppgir eget leveringssted. */
  dropoff: { name: string; sameAsPickup: boolean };
  /** Leverandørens råtekster (engelsk) – beholdt som referanse og reserve. */
  policies: string[];
  mileage: CarMileage | null;
  fuelPolicy: CarTermCode | null;
  /** Timer før henting avbestilling er gratis; null = ukjent eller ubegrenset (se freeCancellation). */
  cancellationLimitHours: number | null;
  badges: CarTermCode[];
  features: CarTermCode[];
  unlimitedMileage: boolean | null;
  freeCancellation: boolean | null;
  days: number;
  perDayAmount: number;
  totalAmount: number;
  currency: string;
  /** Leverandørens bestillingslenke (KAYAK deeplink). */
  bookUrl: string;
}

export interface CarSearchResult {
  provider: "kayak";
  sandbox: boolean;
  complete: boolean;
  pickup: CarPlace | null;
  dropoff: CarPlace | null;
  pickupDate: string;
  dropoffDate: string;
  days: number;
  currency: string;
  totalResults: number;
  results: CarOffer[];
}

export interface CarsStatus {
  enabled: boolean;
  mode: "sandbox" | "production";
  externalBooking: true;
}
