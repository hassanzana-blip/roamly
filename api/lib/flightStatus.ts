import type { FlightStatus, FlightStatusCode } from "@contracts/types";
import { airportByIata } from "@contracts/airports";
import { env } from "./env";
import { log } from "./logger";

/**
 * Sanntids flystatus.
 *
 * Leverandøren er AviationStack (én forespørsel per oppslag). Laget er
 * leverandøruavhengig: `fetchFlightStatus` er det eneste API-et resten av
 * appen ser, så en annen kilde kan settes inn uten å røre siden.
 *
 * ADVARSEL: kartleggingen er skrevet mot AviationStacks publiserte format og
 * er ikke kjørt mot det ekte API-et herfra (utviklingsmiljøet har ikke
 * nettverkstilgang). Første ekte oppslag logger strukturen hvis noe ikke
 * stemmer, på samme måte som Travelport-integrasjonen.
 *
 * Vi finner aldri på data. Mangler flyet, eller mangler tidene, svarer vi at
 * statusen ikke er tilgjengelig framfor å vise noe som kan være feil.
 */

export const flightStatusConfig = {
  get apiKey(): string {
    return env.AVIATIONSTACK_API_KEY ?? "";
  },
  get baseUrl(): string {
    // Gratisnivået hos AviationStack tillater kun http. Standarden her er
    // https; sett AVIATIONSTACK_BASE_URL hvis nivået ditt krever noe annet.
    return (env.AVIATIONSTACK_BASE_URL ?? "https://api.aviationstack.com/v1").replace(/\/$/, "");
  },
  get configured(): boolean {
    return flightStatusConfig.apiKey.length > 0;
  },
};

// ─── Leverandørens format (kun det vi faktisk leser) ─────────────────────────

type AsEndpoint = {
  airport?: string;
  iata?: string;
  terminal?: string | null;
  gate?: string | null;
  delay?: number | null;
  scheduled?: string | null;
  estimated?: string | null;
  actual?: string | null;
};

type AsFlight = {
  flight_date?: string;
  flight_status?: string;
  departure?: AsEndpoint;
  arrival?: AsEndpoint;
  airline?: { name?: string; iata?: string };
  flight?: { number?: string; iata?: string };
  aircraft?: { iata?: string; registration?: string } | null;
  live?: { is_ground?: boolean; updated?: string } | null;
};

type AsResponse = { data?: AsFlight[]; error?: { code?: string; message?: string } };

/** AviationStacks statuser → våre. Ukjent verdi gir «scheduled». */
const STATUS: Record<string, FlightStatusCode> = {
  scheduled: "scheduled",
  active: "in_air",
  landed: "landed",
  cancelled: "cancelled",
  incident: "delayed",
  diverted: "delayed",
};

function point(iata: string | undefined, fallbackName: string | undefined, terminal?: string | null) {
  const code = (iata ?? "").toUpperCase();
  const known = code ? airportByIata(code) : undefined;
  return {
    iata: code,
    name: known?.name ?? fallbackName ?? code,
    city: known?.city ?? fallbackName ?? code,
    country: known?.country ?? "",
    lat: known?.lat ?? 0,
    lng: known?.lng ?? 0,
    ...(terminal ? { terminal } : {}),
  };
}

/** Andel av reisen som er unnagjort, 0–1. Kun brukt til tidslinjen. */
export function progressBetween(departure: string, arrival: string, now = Date.now()): number {
  const from = Date.parse(departure);
  const to = Date.parse(arrival);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0;
  return Math.min(1, Math.max(0, (now - from) / (to - from)));
}

/**
 * Oversetter leverandørsvaret. Returnerer null når svaret ikke holder mål —
 * da sier siden ærlig at statusen ikke er tilgjengelig.
 */
export function mapFlightStatus(f: AsFlight, now = Date.now()): FlightStatus | null {
  const dep = f.departure;
  const arr = f.arrival;
  const scheduledDeparture = dep?.scheduled ?? "";
  const scheduledArrival = arr?.scheduled ?? "";
  // Uten planlagte tider er det ingenting å vise en reisende.
  if (!scheduledDeparture || !scheduledArrival) return null;

  const estimatedDeparture = dep?.actual ?? dep?.estimated ?? scheduledDeparture;
  const estimatedArrival = arr?.actual ?? arr?.estimated ?? scheduledArrival;
  const delayMinutes = Math.max(0, Math.round(arr?.delay ?? dep?.delay ?? 0));

  let status = STATUS[(f.flight_status ?? "").toLowerCase()] ?? "scheduled";
  // «active» men fortsatt på bakken betyr avgang pågår, ikke i lufta.
  if (status === "in_air" && f.live?.is_ground === true) status = "departed";
  // Forsinket er viktigere å vise enn «etter planen» når flyet ikke har gått.
  if (status === "scheduled" && delayMinutes > 0) status = "delayed";

  const carrierIata = (f.airline?.iata ?? "").toUpperCase();
  const number = f.flight?.number ?? "";

  return {
    carrier: { iata: carrierIata, name: f.airline?.name ?? carrierIata },
    flightNumber: f.flight?.iata ?? `${carrierIata}${number}`,
    date: f.flight_date ?? scheduledDeparture.slice(0, 10),
    origin: point(dep?.iata, dep?.airport, dep?.terminal),
    destination: point(arr?.iata, arr?.airport, arr?.terminal),
    scheduledDeparture,
    estimatedDeparture,
    scheduledArrival,
    estimatedArrival,
    status,
    delayMinutes,
    ...(dep?.gate ? { gate: dep.gate } : {}),
    aircraft: f.aircraft?.iata ?? "",
    progress: status === "landed" ? 1 : status === "in_air" ? progressBetween(estimatedDeparture, estimatedArrival, now) : 0,
  };
}

export type FlightStatusLookup = { carrier: string; flightNumber: string; date: string };

/**
 * Slår opp én avgang. Kaster aldri — kallstedet skal kunne svare rolig at
 * statusen ikke er tilgjengelig.
 */
export async function fetchFlightStatus(input: FlightStatusLookup): Promise<FlightStatus | null> {
  if (!flightStatusConfig.configured) return null;

  const flightIata = `${input.carrier.toUpperCase()}${input.flightNumber.replace(/^0+/, "")}`;
  const url = new URL(`${flightStatusConfig.baseUrl}/flights`);
  url.searchParams.set("access_key", flightStatusConfig.apiKey);
  url.searchParams.set("flight_iata", flightIata);
  url.searchParams.set("flight_date", input.date);

  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      // Aldri logg URL-en — den bærer nøkkelen som spørringsparameter.
      log.warn({ status: res.status, flight: flightIata }, "Flystatus: leverandøren svarte med feil");
      return null;
    }
    const body = (await res.json()) as AsResponse;
    if (body.error) {
      log.warn({ code: body.error.code, flight: flightIata }, "Flystatus: leverandørfeil");
      return null;
    }
    const first = body.data?.[0];
    if (!first) return null;

    const mapped = mapFlightStatus(first);
    if (!mapped) {
      log.info({ flight: flightIata, keys: Object.keys(first) }, "Flystatus: svaret manglet planlagte tider");
    }
    return mapped;
  } catch (err) {
    log.warn({ err: String(err).slice(0, 160), flight: flightIata }, "Flystatus: oppslag feilet");
    return null;
  }
}
