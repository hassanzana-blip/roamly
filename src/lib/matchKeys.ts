/**
 * Nøkler for ReiseMatch og reisetavler — lagres i nettleseren, aldri i URL-en.
 * En deltaker uten konto kjenner igjen seg selv med participantKey; eieren
 * med ownerKey. Tavler bruker én stabil voterKey per nettleser.
 */

const MATCH_KEY = "hellosky:match";
const VOTER_KEY = "hellosky:voter";

type MatchKeys = { participantKey?: string; ownerKey?: string; name?: string };

function readAll(): Record<string, MatchKeys> {
  try {
    const raw = localStorage.getItem(MATCH_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function matchKeysFor(token: string): MatchKeys {
  return readAll()[token] ?? {};
}

export function saveMatchKeys(token: string, keys: MatchKeys): void {
  try {
    const all = readAll();
    all[token] = { ...(all[token] ?? {}), ...keys };
    localStorage.setItem(MATCH_KEY, JSON.stringify(all));
  } catch {
    /* privat modus — nøkkelen lever bare i minnet denne økten */
  }
}

/** Stabil, tilfeldig nøkkel for stemmer på tavler uten konto. */
export function voterKey(): string {
  try {
    let k = localStorage.getItem(VOTER_KEY);
    if (!k) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      k = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(VOTER_KEY, k);
    }
    return k;
  } catch {
    return "anon-" + Math.random().toString(16).slice(2, 14);
  }
}

const NAME_KEY = "hellosky:guest-name";
export function rememberedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}
export function rememberName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name.trim().slice(0, 40));
  } catch {
    /* ignorer */
  }
}
