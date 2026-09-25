/**
 * Søketekst som tåler aksenter, æ/ø/å, store bokstaver og tegn: «tromso» finner Tromsø, «malaga» Málaga,
 * «walesa» Wałęsa. Brukes av søket i Utforsk og i flyplassvelgeren – og til å utheve det kunden har skrevet,
 * så hvert brettet tegn husker hvor i originalen det kom fra.
 */

/** Bokstaver som ikke brytes ned av Unicode-normalisering, men som skrives uten dem på et vanlig tastatur. */
const SPECIAL: Readonly<Record<string, string>> = { ø: "o", æ: "ae", œ: "oe", ß: "ss", ł: "l", đ: "d", ð: "d", þ: "th", ı: "i" };

function foldChar(ch: string): string {
  const lower = ch.toLowerCase();
  const special = SPECIAL[lower];
  if (special) return special;
  const bare = lower.normalize("NFD").replace(/[̀-ͯ]/g, "");
  // Et frittstående aksenttegn (skrevet som eget tegn) forsvinner; det deler ikke ordet.
  if (bare === "") return "";
  return /^[a-z0-9]+$/.test(bare) ? bare : " ";
}

export type Folded = {
  /** Brettet tekst: små bokstaver a–z og tall; alt annet er mellomrom. */
  text: string;
  /** For hvert tegn i `text`: første posisjon i originalen det kom fra … */
  start: number[];
  /** … og posisjonen rett etter. */
  end: number[];
};

export function foldWithMap(s: string): Folded {
  let text = "";
  const start: number[] = [];
  const end: number[] = [];
  let i = 0;
  for (const ch of s) {
    const f = foldChar(ch);
    for (let k = 0; k < f.length; k++) {
      start.push(i);
      end.push(i + ch.length);
    }
    text += f;
    i += ch.length;
  }
  return { text, start, end };
}

/** Teksten slik søket sammenligner den: brettet, ord skilt med ett mellomrom. */
export function normalizeSearch(s: string): string {
  return foldWithMap(s).text.replace(/ +/g, " ").trim();
}

/** Ordene i søket («new york» → «new», «york»). */
export function searchTokens(query: string): string[] {
  const q = normalizeSearch(query);
  return q ? q.split(" ") : [];
}

/** Ordene i en eller flere tekster, brettet. */
export function searchWords(...texts: string[]): string[] {
  return texts.flatMap((t) => normalizeSearch(t).split(" ")).filter(Boolean);
}

/** Hvert ord kunden skriver må være starten på et ord i teksten. */
export function covers(tokens: readonly string[], words: readonly string[]): boolean {
  return tokens.every((tok) => words.some((w) => w.startsWith(tok)));
}

export type Range = { start: number; end: number };

/**
 * Delene av `text` som ordene i søket er starten på – det samme søket bruker for å finne treff. Hvert ord i
 * søket uthever det første ordet det passer; overlapp slås sammen. Posisjonene gjelder originalteksten, så
 * «tromso» uthever hele «Tromsø» og «ale» uthever «Åle» i «Ålesund».
 */
export function matchRanges(text: string, tokens: readonly string[]): Range[] {
  if (!tokens.length || !text) return [];
  const f = foldWithMap(text);
  const words: { w: string; at: number }[] = [];
  const re = /[a-z0-9]+/g;
  for (let m = re.exec(f.text); m; m = re.exec(f.text)) words.push({ w: m[0], at: m.index });
  const hits: Range[] = [];
  for (const tok of tokens) {
    const word = words.find((w) => w.w.startsWith(tok));
    if (!word) continue;
    let end = f.end[word.at + tok.length - 1]!;
    // Et aksenttegn skrevet som eget tegn (NFD) hører til bokstaven foran – det uthevas sammen med den.
    while (end < text.length && /\p{M}/u.test(text[end]!)) end++;
    hits.push({ start: f.start[word.at]!, end });
  }
  hits.sort((a, b) => a.start - b.start);
  const merged: Range[] = [];
  for (const h of hits) {
    const last = merged[merged.length - 1];
    if (last && h.start <= last.end) last.end = Math.max(last.end, h.end);
    else merged.push({ ...h });
  }
  return merged;
}

export type Segment = { text: string; hit: boolean };

/** Teksten delt i biter som er uthevet eller ikke, i rekkefølge. Uten treff: én bit. */
export function markSegments(text: string, tokens: readonly string[]): Segment[] {
  const ranges = matchRanges(text, tokens);
  if (!ranges.length) return [{ text, hit: false }];
  const out: Segment[] = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start > at) out.push({ text: text.slice(at, r.start), hit: false });
    out.push({ text: text.slice(r.start, r.end), hit: true });
    at = r.end;
  }
  if (at < text.length) out.push({ text: text.slice(at), hit: false });
  return out;
}
