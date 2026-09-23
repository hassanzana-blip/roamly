import { parseDraft } from "./draft";
import type { AirportChoice, SearchForm } from "./searchForm";

/**
 * Nylige søk, bare på telefonen (localStore «recent»): skjemaet for søk som
 * faktisk ble kjørt – flyplasser, datoer, reisende og klasse. Aldri token,
 * navn, e-post, priser eller tilbud. Kunden kan fjerne ett eller alle.
 */
export const MAX_RECENT = 6;

export type RecentSearch = SearchForm & { origin: AirportChoice; destination: AirportChoice };

/** Samme reise: samme strekning, datoer, reisende, klasse og direktevalg. */
export function recentKey(f: SearchForm): string {
  const ret = f.tripType === "roundtrip" ? f.returnDate : "";
  return [f.origin?.iata, f.destination?.iata, f.tripType, f.departDate, ret, f.adults, f.childAges.join("."), f.infantAges.join("."), f.cabinClass, f.directOnly ? "d" : ""].join("|");
}

/** Lagret liste → gyldige søk. Hver post sjekkes som søkeutkastet; passerte datoer rulles fram. */
export function parseRecent(raw: unknown, today: Date = new Date()): RecentSearch[] {
  if (!Array.isArray(raw)) return [];
  const out: RecentSearch[] = [];
  const seen = new Set<string>();
  for (const item of raw.slice(0, MAX_RECENT * 2)) {
    const f = parseDraft(item, today);
    if (!f || !f.origin || !f.destination || f.origin.iata === f.destination.iata) continue;
    const key = recentKey(f);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f as RecentSearch);
    if (out.length === MAX_RECENT) break;
  }
  return out;
}

/** Legg et kjørt søk øverst; samme reise flyttes opp i stedet for å stå to ganger. */
export function addRecent(list: RecentSearch[], f: SearchForm): RecentSearch[] {
  if (!f.origin || !f.destination) return list;
  const key = recentKey(f);
  return [f as RecentSearch, ...list.filter((r) => recentKey(r) !== key)].slice(0, MAX_RECENT);
}

/** Flyplassene kunden har brukt i «Fra» eller «Til», nyeste først, uten duplikater. */
export function recentAirports(list: RecentSearch[], field: "origin" | "destination", limit = 4): AirportChoice[] {
  const out: AirportChoice[] = [];
  for (const r of list) {
    const a = r[field];
    if (!out.some((x) => x.iata === a.iata)) out.push(a);
    if (out.length === limit) break;
  }
  return out;
}

/** Den foretrukne avreiseflyplassen, sjekket som i søkeutkastet. */
export function parseHomeAirport(raw: unknown): AirportChoice | null {
  const f = parseDraft({ tripType: "oneway", origin: raw, destination: null, adults: 1, childAges: [], infantAges: [], cabinClass: "economy" });
  return f?.origin ?? null;
}
