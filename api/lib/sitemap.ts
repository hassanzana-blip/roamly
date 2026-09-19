/**
 * sitemap.xml, generert av serveren.
 *
 * Erstatter public/sitemap.xml, som var skrevet for hånd og hadde tre problemer:
 *  - 17 av 29 oppføringer var ankerlenker (/reisemal#syria). Google kutter alt
 *    etter #, så det var 17 duplikater av /reisemal.
 *  - De 30 ekte reisemålssidene (/reisemal/erbil, /reisemal/beirut …) og
 *    journal-artiklene manglet helt.
 *  - lastmod var en fast dato som aldri ble oppdatert.
 *
 * Nå leses sidene fra de samme registrene som appen rendrer fra, så en ny
 * artikkel eller et nytt reisemål havner i sitemapet uten at noen husker det.
 */

import { ARTICLES } from "../../src/content/journal/index";
import { ALL_DESTINATIONS } from "../../src/content/discover";
import { STATIC_ROUTES, absoluteUrl } from "../../contracts/seoRoutes";

type Entry = { loc: string; lastmod?: string; changefreq: string; priority: string };

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Nyeste artikkeldato, brukt som lastmod for journalforsiden. */
function latestArticleDate(): string | undefined {
  return ARTICLES.map((a) => a.updated).sort().at(-1);
}

export function sitemapEntries(today = new Date().toISOString().slice(0, 10)): Entry[] {
  const journalLastmod = latestArticleDate();

  const staticEntries: Entry[] = STATIC_ROUTES.map((r) => ({
    loc: absoluteUrl(r.path),
    lastmod: r.path === "/journal" ? journalLastmod : today,
    changefreq: r.changefreq,
    priority: r.priority.toFixed(1),
  }));

  const destinationEntries: Entry[] = ALL_DESTINATIONS.map((d) => ({
    loc: absoluteUrl(`/reisemal/${d.id}`),
    lastmod: today,
    changefreq: "weekly",
    priority: "0.7",
  }));

  const articleEntries: Entry[] = ARTICLES.map((a) => ({
    loc: absoluteUrl(`/journal/${a.slug}`),
    lastmod: a.updated,
    changefreq: "monthly",
    priority: "0.6",
  }));

  return [...staticEntries, ...destinationEntries, ...articleEntries];
}

export function sitemapXml(today?: string): string {
  const urls = sitemapEntries(today)
    .map((e) => {
      const lastmod = e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : "";
      return [
        "  <url>",
        `    <loc>${esc(e.loc)}</loc>${lastmod}`,
        `    <changefreq>${e.changefreq}</changefreq>`,
        `    <priority>${e.priority}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
