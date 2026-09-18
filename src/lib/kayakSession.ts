/**
 * Anonym søke-økt for metasøk.
 *
 * KAYAK krever en `userTrackId` som er unik per sluttbruker per økt (UUID),
 * og advarer mot konstante eller delte verdier. Vi lager én UUID per
 * nettleserøkt og sender den med søket – aldri knyttet til kundekonto,
 * aldri lagret på serveren.
 */
const KEY = "hellosky:search-session";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let memory: string | null = null;

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Eldre WebViews: tilfeldig, ikke kryptografisk viktig – bare unik.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function searchSessionId(): string {
  if (memory) return memory;
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored && UUID_RE.test(stored)) {
      memory = stored;
      return stored;
    }
  } catch {
    /* sessionStorage utilgjengelig – husk i minnet */
  }
  memory = newId();
  try {
    sessionStorage.setItem(KEY, memory);
  } catch {
    /* ignorer */
  }
  return memory;
}
