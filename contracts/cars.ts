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
  pickup: { name: string; inTerminal?: boolean };
  dropoff: { name: string };
  /** Vilkårstekster fra leverandøren (fri km, avbestilling, drivstoff …). */
  policies: string[];
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
