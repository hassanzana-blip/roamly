import type { I18nKey } from "@/lib/i18n";
import { ARTICLES, type Article } from "@/content/journal";

/**
 * Kundeservice: intensjoner («hva ligner mest?»), hva du bør ha klart, og
 * søk på tvers av FAQ, journal og sider. Ingen chatbot – dette er en
 * veiviser til riktig svar eller riktig menneske.
 */

export const TOPICS = ["booking", "change", "refund", "baggage", "other"] as const;
export type Topic = (typeof TOPICS)[number];

export type Intent = {
  id: string;
  topic: Topic;
  label: I18nKey;
  sub: I18nKey;
  /** Det som er lurt å ha klart før du skriver. */
  needs: I18nKey[];
  /** Selvbetjening: sider som ofte løser saken uten å vente på svar. */
  links: { to: string; label: I18nKey }[];
  /** FAQ-numre som passer. */
  faq: number[];
  /** Journal-artikler som passer. */
  articles: string[];
};

export const INTENTS: Intent[] = [
  { id: "change", topic: "change", label: "sp.i.change", sub: "sp.i.change.sub", needs: ["sp.need.ref", "sp.need.name", "sp.need.dates"], links: [{ to: "/reise", label: "sp.link.mytrip" }], faq: [3, 4], articles: ["forsinket-eller-innstilt", "navnet-pa-billetten"] },
  { id: "baggage", topic: "baggage", label: "sp.i.baggage", sub: "sp.i.baggage.sub", needs: ["sp.need.ref", "sp.need.airline"], links: [{ to: "/bagasje", label: "sp.link.baggage" }], faq: [5], articles: ["bagasje-slik-leser-du-billetten", "handbagasje-det-som-overrasker"] },
  { id: "find", topic: "booking", label: "sp.i.find", sub: "sp.i.find.sub", needs: ["sp.need.email", "sp.need.name"], links: [{ to: "/reise", label: "sp.link.mytrip" }, { to: "/reiser", label: "sp.link.trips" }], faq: [6], articles: [] },
  { id: "refund", topic: "refund", label: "sp.i.refund", sub: "sp.i.refund.sub", needs: ["sp.need.ref", "sp.need.reason"], links: [{ to: "/reise", label: "sp.link.mytrip" }], faq: [4, 7], articles: ["forsinket-eller-innstilt"] },
  { id: "payment", topic: "booking", label: "sp.i.payment", sub: "sp.i.payment.sub", needs: ["sp.need.ref", "sp.need.email"], links: [{ to: "/reise", label: "sp.link.mytrip" }], faq: [1, 2], articles: ["hva-totalpris-betyr-hos-oss"] },
  { id: "kids", topic: "other", label: "sp.i.kids", sub: "sp.i.kids.sub", needs: ["sp.need.ages", "sp.need.dates"], links: [{ to: "/journal?t=familie", label: "sp.link.family" }], faq: [9], articles: ["mellomlanding-med-barn", "reiser-du-alene-med-barn", "reise-med-spedbarn"] },
  { id: "other", topic: "other", label: "sp.i.other", sub: "sp.i.other.sub", needs: ["sp.need.what"], links: [{ to: "/journal", label: "sp.link.journal" }], faq: [], articles: [] },
];

export type SearchHit =
  | { kind: "faq"; n: number; title: string; sub: string }
  | { kind: "article"; slug: string; title: string; sub: string }
  | { kind: "page"; to: string; title: string; sub: string };

const PAGES: { to: string; title: string; sub: string; words: string }[] = [
  { to: "/reise", title: "Finn bestillingen din", sub: "Referanse og e-post", words: "bestilling referanse billett kvittering finne min reise ordre" },
  { to: "/flystatus", title: "Flystatus", sub: "Avganger og ankomster", words: "forsinket fly status avgang ankomst gate" },
  { to: "/bagasje", title: "Bagasjeguiden", sub: "Inkludert, ikke inkludert, ikke oppgitt", words: "bagasje koffert håndbagasje vekt kolli" },
  { to: "/visum", title: "Visumguiden", sub: "Generell veiledning for norske pass", words: "visum pass innreise esta eta" },
  { to: "/profil/prisovervaking", title: "Prisovervåking", sub: "Vi sier fra når prisen passer", words: "pris varsel overvåking billig" },
  { to: "/profil/reisende", title: "Lagrede reisende", sub: "Navn som i passet, én gang", words: "reisende passasjer navn pass barn" },
  { to: "/vilkar", title: "Reisevilkår", sub: "Det som gjelder når du bestiller", words: "vilkår avbestilling gebyr regler" },
];

function norm(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

function score(hay: string, terms: string[]): number {
  const h = norm(hay);
  let n = 0;
  for (const t of terms) if (h.includes(t)) n += t.length > 3 ? 2 : 1;
  return n;
}

function articleText(a: Article): string {
  return a.blocks.map((b) => ("text" in b ? b.text : "items" in b ? b.items.map((i) => (typeof i === "string" ? i : `${i.title} ${i.text}`)).join(" ") : "")).join(" ");
}

/** Enkelt søk uten tjener: FAQ, journal og sider, rangert etter treff. */
export function searchSupport(query: string, faq: { n: number; q: string; a: string }[], limit = 6): SearchHit[] {
  const terms = norm(query).split(/\s+/).filter((t) => t.length >= 2);
  if (terms.length === 0) return [];
  const hits: { s: number; hit: SearchHit }[] = [];
  for (const f of faq) {
    const s = score(f.q, terms) * 3 + score(f.a, terms);
    if (s > 0) hits.push({ s, hit: { kind: "faq", n: f.n, title: f.q, sub: "Ofte stilt spørsmål" } });
  }
  for (const a of ARTICLES) {
    const s = score(a.title, terms) * 3 + score(a.deck, terms) * 2 + Math.min(score(articleText(a), terms), 4);
    if (s > 0) hits.push({ s, hit: { kind: "article", slug: a.slug, title: a.title, sub: "Journal" } });
  }
  for (const p of PAGES) {
    const s = score(`${p.title} ${p.sub} ${p.words}`, terms) * 2;
    if (s > 0) hits.push({ s, hit: { kind: "page", to: p.to, title: p.title, sub: p.sub } });
  }
  return hits.sort((a, b) => b.s - a.s).slice(0, limit).map((h) => h.hit);
}
