import { DESTINATIONS, type Destination } from "./destinations";
import { covers, normalizeSearch, searchWords as words } from "./textMatch";

/**
 * Søk blant HelloSkys 24 kuraterte reisemål – ingen andre steder, ingen priser
 * eller ledige plasser. Treffer by, land og nøyaktig flyplassnavn på både
 * bokmål og engelsk, og reisemålets IATA-kode (den flyplassen søket faktisk
 * bruker; byens andre flyplasser gir ikke treff).
 *
 * Hvert ord kunden skriver må være starten på et ord i reisemålet. Aksenter og
 * æ/ø/å betyr ikke noe («tromso» finner Tromsø, «malaga» Málaga).
 */
export type MatchField = "iata" | "city" | "airport" | "country";
export type DestinationMatch = { destination: Destination; field: MatchField };

export { normalizeSearch };

/** Reisemålene som passer, beste treff først (hel IATA-kode, så by, flyplass, land); tomt søk gir alle. */
export function searchDestinations(query: string, list: readonly Destination[] = DESTINATIONS): DestinationMatch[] {
  const q = normalizeSearch(query);
  if (!q) return list.map((destination) => ({ destination, field: "city" as const }));
  const tokens = q.split(" ");
  const out: (DestinationMatch & { rank: number; i: number })[] = [];
  list.forEach((d, i) => {
    const { en, nb } = d.names;
    const iata = d.iata.toLowerCase();
    const city = words(en.city, nb.city);
    const airport = words(en.airport, nb.airport);
    const country = words(en.country, nb.country);
    if (!covers(tokens, [iata, ...city, ...airport, ...country])) return;
    const field: MatchField = q === iata ? "iata" : covers(tokens, city) ? "city" : covers(tokens, [iata, ...airport]) ? (tokens.length === 1 && iata.startsWith(q) ? "iata" : "airport") : "country";
    const rank = { iata: 0, city: 1, airport: 2, country: 3 }[field];
    out.push({ destination: d, field, rank, i });
  });
  return out.sort((a, b) => a.rank - b.rank || a.i - b.i).map(({ destination, field }) => ({ destination, field }));
}
