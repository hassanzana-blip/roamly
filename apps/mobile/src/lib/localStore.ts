import { File, Paths } from "expo-file-system";

/**
 * Innstillinger som ikke er hemmelige, bare på denne telefonen: språk,
 * søkeutkastet, siste søk, foretrukket avreiseflyplass og huskelisten.
 *
 * Én liten JSON-fil i appens dokumentmappe. Den forsvinner når appen slettes
 * (i motsetning til nøkkelringen), synkroniseres aldri og inneholder aldri
 * token, passord, navn eller e-post – sesjonstokenet bor i nøkkelringen
 * (tokenStore.ts).
 */

export type Stored = Record<string, unknown>;

const FILE_NAME = "hellosky-prefs.json";
const VERSION = 1;

let cache: Stored | null = null;

function file(): File {
  return new File(Paths.document, FILE_NAME);
}

function readAll(): Stored {
  if (cache) return cache;
  try {
    const f = file();
    if (f.exists) {
      const parsed: unknown = JSON.parse(f.textSync());
      if (parsed && typeof parsed === "object" && (parsed as { v?: unknown }).v === VERSION) {
        cache = parsed as Stored;
        return cache;
      }
    }
  } catch {
    // Skadet eller uleselig: start tomt i stedet for å krasje.
  }
  cache = { v: VERSION };
  return cache;
}

function writeAll(data: Stored): void {
  cache = data;
  try {
    file().write(JSON.stringify(data));
  } catch {
    // Lagringen er en bekvemmelighet; appen virker uten den.
  }
}

/** Synkron lesing (ved oppstart, så første bilde allerede har riktig språk). */
export function readPref<T>(key: string, validate: (v: unknown) => T | null): T | null {
  const v = readAll()[key];
  return v === undefined ? null : validate(v);
}

export function writePref(key: string, value: unknown): void {
  const next = { ...readAll() };
  if (value === undefined || value === null) delete next[key];
  else next[key] = value;
  writeAll(next);
}

/** Bare for tester. */
export function __resetLocalStoreForTests(): void {
  cache = null;
}
