import { DESTINATIONS, type Destination } from "./destinations";

/**
 * Lagrede reisemål, bare på denne telefonen (localStore «saved»): reisemålets
 * id og nøyaktige IATA-kode, i den rekkefølgen kunden lagret dem. Ikke en
 * bestilling, ikke en holdt pris, ikke et prisvarsel og ikke knyttet til en
 * konto. Aldri token, navn, e-post eller priser.
 */
export type SavedDestination = { id: string; iata: string };

export const MAX_SAVED = DESTINATIONS.length;

/**
 * Lagret liste → gyldige poster. En post må være et av appens reisemål med
 * samme IATA-kode som nå; alt annet (endret, ukjent, dobbelt) droppes.
 */
export function parseSaved(raw: unknown): SavedDestination[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedDestination[] = [];
  for (const item of raw.slice(0, MAX_SAVED * 2)) {
    if (!item || typeof item !== "object") continue;
    const { id, iata } = item as Record<string, unknown>;
    const d = DESTINATIONS.find((x) => x.id === id);
    if (!d || d.iata !== iata || out.some((x) => x.id === d.id)) continue;
    out.push({ id: d.id, iata: d.iata });
    if (out.length === MAX_SAVED) break;
  }
  return out;
}

/** Lagre (nyeste først) eller fjerne et reisemål. */
export function toggleSaved(list: SavedDestination[], d: Destination): SavedDestination[] {
  return list.some((x) => x.id === d.id) ? list.filter((x) => x.id !== d.id) : [{ id: d.id, iata: d.iata }, ...list].slice(0, MAX_SAVED);
}

/** Reisemålene bak de lagrede postene, i samme rekkefølge. */
export function savedDestinations(list: SavedDestination[]): Destination[] {
  return list.flatMap((s) => DESTINATIONS.filter((d) => d.id === s.id && d.iata === s.iata));
}
