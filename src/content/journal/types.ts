/**
 * HelloSky Journal – artikkelmodellen.
 *
 * Alt innhold er skrevet for å være nyttig, ikke for søkemotorer. Ingen
 * artikkel oppgir priser, visumregler eller bagasjegrenser som tall – slike
 * ting endres, og vi peker på den offisielle kilden i stedet. Hver artikkel
 * har en «oppdatert»-dato som vises til leseren.
 */

export type JournalTag = "kurdistan" | "midtosten" | "storby" | "familie" | "bagasje" | "mellomlanding" | "billetter" | "planlegging" | "forste-gang" | "helg";

export type Block =
  | { t: "p"; text: string }
  | { t: "h2"; id: string; text: string }
  | { t: "ul"; items: string[] }
  | { t: "tip"; title?: string; text: string }
  | { t: "quote"; text: string; by?: string }
  | { t: "steps"; items: { title: string; text: string }[] };

export interface Article {
  slug: string;
  title: string;
  /** Én setning under tittelen – hvorfor lese dette. */
  deck: string;
  tags: JournalTag[];
  /** ISO-dato. Vises som «Oppdatert». */
  updated: string;
  /** Destinasjons-id fra innholdet (bilde og lenke). Uten bilde → tekstlig hero. */
  hero?: string;
  heroAlt?: string;
  relatedDestinations: string[];
  relatedArticles: string[];
  /** IATA for «Søk fly»-knappen nederst; utelates hvis artikkelen ikke handler om ett reisemål. */
  searchIata?: string;
  blocks: Block[];
}

export const TAG_LABELS: Record<JournalTag, string> = {
  kurdistan: "Kurdistan",
  midtosten: "Midtøsten",
  storby: "Storby",
  familie: "Familie",
  bagasje: "Bagasje",
  mellomlanding: "Mellomlanding",
  billetter: "Billetter",
  planlegging: "Planlegging",
  "forste-gang": "Første gang",
  helg: "Helg",
};

/** Lesetid: 200 ord i minuttet, minst 2 minutter. */
export function readingMinutes(a: Article): number {
  const words = a.blocks
    .flatMap((b) => (b.t === "p" || b.t === "tip" || b.t === "quote" ? [b.text] : b.t === "ul" ? b.items : b.t === "steps" ? b.items.map((s) => `${s.title} ${s.text}`) : [b.text]))
    .join(" ")
    .split(/\s+/).length;
  return Math.max(2, Math.round(words / 200));
}
