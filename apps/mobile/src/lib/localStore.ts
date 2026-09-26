import { File, Paths } from "expo-file-system";

/**
 * Innstillinger som ikke er hemmelige, bare på denne telefonen: språk,
 * søkeutkastet, siste søk, foretrukket avreiseflyplass og lagrede reisemål.
 *
 * Én liten JSON-fil i appens dokumentmappe. Den forsvinner når appen slettes
 * (i motsetning til nøkkelringen), synkroniseres aldri og inneholder aldri
 * token, passord, navn eller e-post – sesjonstokenet bor i nøkkelringen
 * (tokenStore.ts).
 */

export type Stored = Record<string, unknown>;

const FILE_NAME = "hellosky-prefs.json";
const VERSION = 1;

/**
 * Hvordan filen brukes:
 * - `own`: vår versjon (v1), eller ingen fil. Leses og skrives som vanlig.
 * - `foreign`: et gyldig JSON-objekt med en annen eller manglende `v` – typisk skrevet av en nyere app før en
 *   nedgradering. Filen beholdes byte for byte. Kjente nøkler leses gjennom den vanlige valideringen (et
 *   lagret engelsk valg virker fortsatt). Vanlige lagringer (utkast, siste søk, flyplass) gjelder bare denne
 *   økten. Et eget valg fra kunden (`userChoice`) skrives inn med alle ukjente felt og versjonen urørt – men
 *   bare når feltet mangler i filen eller allerede har samme type.
 * - `unreadable`: filen finnes, men kunne ikke leses (lesefeil). Den kan være i orden, så vi skriver aldri over den.
 * Ødelagt innhold (ikke et JSON-objekt) behandles som ingen fil: neste lagring erstatter det, som før.
 */
type Mode = "own" | "foreign" | "unreadable";
type State = { data: Stored; mode: Mode; foreign: Record<string, unknown> | null };

let state: State | null = null;

function file(): File {
  return new File(Paths.document, FILE_NAME);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function load(): State {
  if (state) return state;
  const fresh = (): State => ({ data: { v: VERSION }, mode: "own", foreign: null });
  let text: string;
  try {
    const f = file();
    if (!f.exists) return (state = fresh());
    text = f.textSync();
  } catch {
    // Finnes, men kunne ikke leses: kanskje helt i orden – ikke rør den i denne økten.
    return (state = { data: { v: VERSION }, mode: "unreadable", foreign: null });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Skadet (ikke JSON): start tomt i stedet for å krasje.
    return (state = fresh());
  }
  if (!isObject(parsed)) return (state = fresh());
  if (parsed.v === VERSION) return (state = { data: parsed, mode: "own", foreign: null });
  return (state = { data: { ...parsed }, mode: "foreign", foreign: parsed });
}

function persist(data: Stored): boolean {
  try {
    file().write(JSON.stringify(data));
    return true;
  } catch {
    // Lagringen er en bekvemmelighet; appen virker uten den (verdien gjelder fortsatt i denne økten).
    return false;
  }
}

/** Synkron lesing (ved oppstart, så første bilde allerede har riktig språk). */
export function readPref<T>(key: string, validate: (v: unknown) => T | null): T | null {
  const v = load().data[key];
  return v === undefined ? null : validate(v);
}

/**
 * Lagrer en verdi (`null` fjerner den). Gjelder alltid med én gang i denne økten. `userChoice`: et bevisst valg
 * fra kunden (språket) – det eneste som kan skrives inn i en fil fra en annen versjon, og da uten å røre resten.
 */
export function writePref(key: string, value: unknown, opts: { userChoice?: boolean } = {}): void {
  const s = load();
  const next = { ...s.data };
  if (value === undefined || value === null) delete next[key];
  else next[key] = value;
  s.data = next;
  if (s.mode === "own") {
    persist(next);
    return;
  }
  if (s.mode === "foreign" && opts.userChoice && s.foreign && value !== undefined && value !== null) {
    const existing = s.foreign[key];
    if (existing !== undefined && typeof existing !== typeof value) return;
    const merged = { ...s.foreign, [key]: value };
    if (persist(merged)) s.foreign = merged;
  }
}

/** Bare for tester. */
export function __resetLocalStoreForTests(): void {
  state = null;
}
