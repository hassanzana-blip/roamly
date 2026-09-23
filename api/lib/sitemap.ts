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
import { ROUTES } from "../../contracts/routes";

type Entry = { loc: string; lastmod?: string; changefreq: string; priority: string };

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Nyeste artikkeldato, brukt som lastmod for journalforsiden. */
function latestArticleDate(): string | undefined {
  return ARTICLES.map((a) => a.updated).sort().at(-1);
}

/**
 * lastmod settes bare der vi kjenner datoen (artikler, journalen). «Endret i
 * dag» på sider som ikke er endret er støy, og Google ignorerer lastmod fra
 * kilder som ikke er til å stole på.
 */
export function sitemapEntries(): Entry[] {
  const journalLastmod = latestArticleDate();

  const staticEntries: Entry[] = STATIC_ROUTES.map((r) => ({
    loc: absoluteUrl(r.path),
    lastmod: r.path === "/journal" ? journalLastmod : undefined,
    changefreq: r.changefreq,
    priority: r.priority.toFixed(1),
  }));

  const destinationEntries: Entry[] = ALL_DESTINATIONS.map((d) => ({
    loc: absoluteUrl(`/reisemal/${d.id}`),
    changefreq: "weekly",
    priority: "0.7",
  }));

  const articleEntries: Entry[] = ARTICLES.map((a) => ({
    loc: absoluteUrl(`/journal/${a.slug}`),
    lastmod: a.updated,
    changefreq: "monthly",
    priority: "0.6",
  }));

  // Rutesidene finnes bare for slugene i registeret. Vi lister aldri en rute
  // sitemapet ikke kan svare 200 på.
  const routeEntries: Entry[] = ROUTES.map((r) => ({
    loc: absoluteUrl(`/fly/${r.slug}`),
    changefreq: "weekly",
    priority: "0.7",
  }));

  return [...staticEntries, ...routeEntries, ...destinationEntries, ...articleEntries];
}

export function sitemapXml(): string {
  const urls = sitemapEntries()
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
