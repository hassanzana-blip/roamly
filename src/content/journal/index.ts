import type { Article, JournalTag } from "./types";
import { PRACTICAL } from "./articles-practical";
import { FAMILY } from "./articles-family";
import { PLACES } from "./articles-places";

export * from "./types";

/** Alle artikler, nyeste oppdatering først. */
export const ARTICLES: Article[] = [...PLACES, ...FAMILY, ...PRACTICAL].sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0));

/** Rekkefølgen på forsiden og i toppen av journalen: én per tema, håndplukket. */
export const FEATURED_SLUGS = ["mellomlanding-med-barn", "bagasje-slik-leser-du-billetten", "istanbul-to-flyplasser", "reise-hjem-til-hoytidene"];

export function articleBySlug(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function articlesForDestination(id: string, limit = 3): Article[] {
  return ARTICLES.filter((a) => a.relatedDestinations.includes(id)).slice(0, limit);
}

export function articlesByTag(tag: JournalTag | "alle"): Article[] {
  return tag === "alle" ? ARTICLES : ARTICLES.filter((a) => a.tags.includes(tag));
}

/** Tagger som faktisk er i bruk, i visningsrekkefølge. */
export function tagsInUse(): JournalTag[] {
  const order: JournalTag[] = ["familie", "bagasje", "mellomlanding", "billetter", "planlegging", "kurdistan", "midtosten", "storby", "helg", "forste-gang"];
  return order.filter((t) => ARTICLES.some((a) => a.tags.includes(t)));
}

export const featured = (): Article[] => FEATURED_SLUGS.map(articleBySlug).filter((a): a is Article => Boolean(a));
