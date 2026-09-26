// ─── Min side i appen: kontoens data gjennom mobil-API-et (/api/mobile/trpc, mobileAccount.*) ─────────────────
// Bare typer. Serveren (api/mobileAccount.ts) svarer med disse, og zod-skjemaene der sjekkes mot inndata-typene
// her i api/test/mobileAccountHub.it.ts. Alt er kundens egne data – ingen anslag, ingen bonusnivå, ingen priser.

import type { CabinClass } from "./types";

/** En bestilling gjort hos HelloSky (nettet), slik «Mine reiser» viser den. Ikke et søk og ikke et lagret fly. */
export interface MobileTrip {
  bookingReference: string;
  originIata: string;
  originCity: string;
  destinationIata: string;
  destinationCity: string;
  /** Utreisens avgang, ISO 8601 slik bestillingen har den. */
  departingAt: string;
  /** Hjemreisens avgang, eller null for én vei. */
  returningAt: string | null;
  passengerCount: number;
}

/** Oversikten på Min side. Tallene er rader i kontoen, aldri anslag. */
export interface MobileAccountHub {
  /** Den nærmeste kommende bestillingen som ikke er kansellert, eller null. */
  nextTrip: MobileTrip | null;
  upcomingTrips: number;
  saved: { destinations: number; flights: number; routes: number };
  travellers: number;
  /** Aktive prisvarsler (price_watches) på kontoen – laget på hellosky.no. */
  priceWatches: number;
  unreadNotifications: number;
}

export type MobileTravellerKind = "adult" | "child" | "infant";

/**
 * En lagret reisende. Bare navn, type og ev. reiseklasse. `kind` er null for reisende lagt til på nettet uten
 * fødselsdato; fødselsdatoen selv sendes aldri til appen.
 */
export interface MobileTraveller {
  id: number;
  firstName: string;
  lastName: string;
  kind: MobileTravellerKind | null;
  cabin: CabinClass | null;
}

/** Ny (uten id) eller endret reisende. Aldri pass, ID-nummer, personnummer eller fødselsdato. */
export interface MobileSaveTravellerInput {
  id?: number;
  firstName: string;
  lastName: string;
  kind: MobileTravellerKind;
  cabin: CabinClass | null;
}

/** Det appen kan lagre på kontoen. «destination» er samme slug som nettets favoritter. */
export type MobileSavedKind = "destination" | "flight" | "route";

export interface MobileSavedItem {
  kind: MobileSavedKind;
  refId: string;
  /** Appens eget bilde av det lagrede (flyet eller ruten), urørt; null for reisemål. */
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface MobileSaveItemInput {
  kind: MobileSavedKind;
  refId: string;
  payload?: Record<string, unknown>;
}

export interface MobileUnsaveItemInput {
  kind: MobileSavedKind;
  refId: string;
}
