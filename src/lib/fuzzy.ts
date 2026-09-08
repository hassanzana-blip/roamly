/**
 * Løs treffing, som i en kommandopalett.
 *
 * Tegnene må komme i rekkefølge, men ikke ved siden av hverandre: «refu»
 * treffer «Refusjoner», «byst» treffer «Bestillinger». Poengsummen favoriserer
 * treff fra starten av ordet, deretter sammenhengende treff – det er slik en
 * palett føles forutsigbar i stedet for tilfeldig.
 *
 * Returnerer -1 når det ikke er treff i det hele tatt.
 */
export function fuzzyScore(haystack: string, needle: string): number {
  if (!needle) return 1;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (h.startsWith(n)) return 1000 - h.length;
  const direct = h.indexOf(n);
  if (direct >= 0) return 500 - direct;

  let score = 0;
  let at = -1;
  let streak = 0;
  for (const ch of n) {
    const next = h.indexOf(ch, at + 1);
    if (next === -1) return -1;
    streak = next === at + 1 ? streak + 1 : 0;
    score += 10 - Math.min(9, next - at - 1) + streak * 2;
    at = next;
  }
  return score;
}

export type Searchable = { label: string; keywords?: string };

/**
 * Sorter kandidater etter hvor godt de treffer. Navnet veier tyngre enn
 * stikkordene: skriver du «lønn» skal siden som heter Lønn komme foran en side
 * som bare nevner ordet.
 */
export function rankByQuery<T extends Searchable>(items: T[], query: string): T[] {
  if (!query.trim()) return items;
  return items
    .map((item) => {
      const label = fuzzyScore(item.label, query);
      const keywords = item.keywords ? fuzzyScore(item.keywords, query) : -1;
      return { item, score: Math.max(label, keywords > 0 ? keywords * 0.6 : -1) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
}
