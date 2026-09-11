/**
 * Nylig sette reisemål – lagres kun lokalt i nettleseren (localStorage),
 * aldri på serveren. Maks 8, nyeste først, uten duplikater. Brukes til
 * «Nylig sett»-seksjonen på forsiden. Verdiene er bare reisemåls-ID-er fra
 * den offentlige katalogen – ingen persondata.
 */

const KEY = "hs:recent-destinations";
const MAX = 8;

export function getRecentDestinationIds(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function recordDestinationView(id: string): void {
  try {
    const cur = getRecentDestinationIds().filter((x) => x !== id);
    localStorage.setItem(KEY, JSON.stringify([id, ...cur].slice(0, MAX)));
  } catch {
    /* privat modus e.l. – da lar vi bare være å lagre */
  }
}
