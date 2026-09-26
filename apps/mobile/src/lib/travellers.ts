import type { CabinClass } from "@contracts/types";
import { CABINS } from "./searchForm";

/**
 * Lagrede reisende: navn, om det er en voksen, et barn eller et spedbarn, og ev. reiseklassen personen helst
 * reiser på. Ingenting annet – aldri pass, nasjonalt ID-kort, personnummer, fødselsdato, skannede dokumenter,
 * kontaktinformasjon eller betalingsdata. Det trengs ikke for å søke og sammenligne, og bestillingen skjer hos
 * leverandøren, som spør selv.
 *
 * Bare på denne telefonen (localStore «travellers») til kontoens mobil-API har reisende (se docs/PROJECT_STATUS.md).
 */

export type TravellerKind = "adult" | "child" | "infant";
export const TRAVELLER_KINDS: readonly TravellerKind[] = ["adult", "child", "infant"];

export type Traveller = {
  /** Lokal id (tilfeldig), bare for å skille radene. */
  id: string;
  firstName: string;
  lastName: string;
  kind: TravellerKind;
  cabin: CabinClass | null;
};

export const MAX_TRAVELLERS = 9;
/** Samme grense som kontoens navn på nettet og i appen. */
export const NAME_MAX = 60;

/**
 * Samme regel som kontoens navn (bokstaver fra alle språk, mellomrom, bindestrek og apostrof), så et navn som er
 * godtatt her, også passer når de reisende en dag synkroniseres med kontoen.
 */
const NAME = /^[\p{L}\p{M}][\p{L}\p{M} '’-]*$/u;

export type NameProblem = "firstName" | "lastName";

/** Det første feltet som ikke er et gyldig navn, eller null. */
export function travellerNameProblem(firstName: string, lastName: string): NameProblem | null {
  const ok = (s: string) => s.trim().length > 0 && s.trim().length <= NAME_MAX && NAME.test(s.trim());
  if (!ok(firstName)) return "firstName";
  if (!ok(lastName)) return "lastName";
  return null;
}

/** Lagret liste → gyldige reisende. Alt annet enn de fem feltene forkastes, også om noe annet skulle ligge der. */
export function parseTravellers(raw: unknown): Traveller[] {
  if (!Array.isArray(raw)) return [];
  const out: Traveller[] = [];
  for (const item of raw.slice(0, MAX_TRAVELLERS * 2)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.id !== "string" || !r.id || r.id.length > 64 || out.some((t) => t.id === r.id)) continue;
    if (typeof r.firstName !== "string" || typeof r.lastName !== "string") continue;
    if (travellerNameProblem(r.firstName, r.lastName)) continue;
    if (!TRAVELLER_KINDS.includes(r.kind as TravellerKind)) continue;
    out.push({
      id: r.id,
      firstName: r.firstName.trim(),
      lastName: r.lastName.trim(),
      kind: r.kind as TravellerKind,
      cabin: CABINS.includes(r.cabin as CabinClass) ? (r.cabin as CabinClass) : null,
    });
    if (out.length === MAX_TRAVELLERS) break;
  }
  return out;
}

/** Legg til eller oppdater (samme id) – nye står nederst, i den rekkefølgen kunden la dem til. */
export function upsertTraveller(list: Traveller[], t: Traveller): Traveller[] {
  const clean = { ...t, firstName: t.firstName.trim(), lastName: t.lastName.trim() };
  if (list.some((x) => x.id === t.id)) return list.map((x) => (x.id === t.id ? clean : x));
  if (list.length >= MAX_TRAVELLERS) return list;
  return [...list, clean];
}

export function removeTraveller(list: Traveller[], id: string): Traveller[] {
  return list.filter((t) => t.id !== id);
}

/** Initialene til sirkelen (bare pynt). */
export function travellerInitials(t: Pick<Traveller, "firstName" | "lastName">): string {
  return `${t.firstName.trim().slice(0, 1)}${t.lastName.trim().slice(0, 1)}`.toUpperCase();
}

/** Antall per type, for oversikten («2 voksne, 1 barn»). */
export function travellerCounts(list: Traveller[]): Record<TravellerKind, number> {
  return { adult: list.filter((t) => t.kind === "adult").length, child: list.filter((t) => t.kind === "child").length, infant: list.filter((t) => t.kind === "infant").length };
}
