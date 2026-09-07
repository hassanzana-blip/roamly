// Tilvalg i checkout — ÉN kilde til sannhet for priser og regler.
// Både klient (Checkout) og server (checkout.createSession) bruker denne
// funksjonen, slik at prisen kunden ser alltid er prisen som belastes.
//
// Kun tilvalg som faktisk leveres av leverandøren (ekstra bagasje) prises her.
// Premium-oppgradering, forsikring, avbestillingsbeskyttelse og setevalg er
// fjernet inntil det finnes en leverandør bak dem (OTA-045).
//
// ALLE beløp er i minste enhet (øre/cent) — aldri flyttall.

import type { PassengerType } from "./types";

/** Reisende som har eget sete (baby i fang kan ikke kjøpe bagasje hos de fleste selskap). */
export function seatHolders(types: PassengerType[]): number {
  return types.filter((t) => t !== "infant_without_seat").length;
}

export interface ExtrasBreakdownMinor {
  currency: string;
  /** Ekstra kolli × pris per kolli (minste enhet). */
  bagsMinor: number;
  /** Sum av alle tilvalg (minste enhet). */
  total: number;
}

export function calcExtras(opts: {
  passengerTypes: PassengerType[];
  extraBags: number;
  /** Pris per ekstra kolli for hele reisen, i minste enhet. */
  bagPriceMinor: number;
  currency: string;
}): ExtrasBreakdownMinor {
  if (!Number.isInteger(opts.extraBags) || opts.extraBags < 0) {
    throw new Error("extraBags må være et ikke-negativt heltall");
  }
  if (!Number.isInteger(opts.bagPriceMinor) || opts.bagPriceMinor < 0) {
    throw new Error("bagPriceMinor må være et ikke-negativt heltall (minste enhet)");
  }
  const bagsMinor = opts.extraBags * opts.bagPriceMinor;
  return { currency: opts.currency, bagsMinor, total: bagsMinor };
}

/**
 * Fordel `extraBags` på reisende med eget sete når klienten ikke har oppgitt
 * fordeling selv. Deterministisk (rund-robin) slik at server og klient blir enige.
 */
export function distributeBags(
  passengers: Array<{ id: string; type: PassengerType }>,
  extraBags: number,
  bagsByPassenger?: Record<string, number>,
  maxPerPassenger = 3,
): Record<string, number> {
  const eligible = passengers.filter((p) => p.type !== "infant_without_seat");
  const out: Record<string, number> = {};
  if (eligible.length === 0 || extraBags <= 0) return out;

  if (bagsByPassenger) {
    let sum = 0;
    for (const p of eligible) {
      const n = Math.max(0, Math.min(maxPerPassenger, Math.floor(bagsByPassenger[p.id] ?? 0)));
      if (n > 0) out[p.id] = n;
      sum += n;
    }
    if (sum === extraBags) return out;
    // Fordelingen stemmer ikke med totalen — fall tilbake til rund-robin.
  }

  const result: Record<string, number> = {};
  let remaining = extraBags;
  let i = 0;
  let guard = 0;
  while (remaining > 0 && guard < extraBags * eligible.length + 1) {
    const p = eligible[i % eligible.length];
    if ((result[p.id] ?? 0) < maxPerPassenger) {
      result[p.id] = (result[p.id] ?? 0) + 1;
      remaining -= 1;
    }
    i += 1;
    guard += 1;
  }
  return result;
}
