/**
 * Per-rute metadata i det utleverte index.html.
 *
 * Før: appskallet hadde forsidens <title>, description, canonical og og:*
 * hardkodet, likt for alle ruter. Klienten rettet det opp etterpå
 * (react-helmet-async), men helmet fjerner ikke tagger den ikke eier, så hver
 * side endte med to canonical-er – den første pekte på forsiden. For Google
 * betyr det «denne siden er en kopi av forsiden», og ingen underside kunne
 * indekseres.
 *
 * Nå: serveren bytter ut blokken mellom <!--seo:start--> og <!--seo:end--> med
 * riktige tagger for den faktiske stien, før HTML-en sendes. Taggene merkes med
 * data-hs-seo="true", som er react-helmet-asyncs eget eierskapsmerke – helmet tar
 * dem over ved hydrering i stedet for å legge til duplikater.
 *
 * Verdiene kommer fra contracts/seoRoutes.ts (samme register som sitemap og
 * 404-håndteringen) og fra innholdsregistrene for reisemål og journal.
 */

import { ARTICLES } from "../../src/content/journal/index";
import { routeBySlug, routeDescription, routeTitle } from "../../contracts/routes";
import { ALL_DESTINATIONS } from "../../src/content/discover";
import {
  SITE_NAME,
  absoluteUrl,
  isKnownRoute,
  isNoindexPath,
  normalizePath,
  staticRouteFor,
} from "../../contracts/seoRoutes";

export const SEO_START = "<!--seo:start-->";
export const SEO_END = "<!--seo:end-->";

type ResolvedHead = {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  image: string;
  type: "website" | "article";
};

const FALLBACK: Omit<ResolvedHead, "canonical"> = {
  title: `Søk og sammenlign fly, hotell og leiebil | ${SITE_NAME}`,
  description:
    "HelloSky er en søkemotor for reiser: priser fra flyselskaper, hoteller og reisebyråer i ett søk. Bestillingen fullføres alltid hos leverandøren.",
  robots: "index,follow",
  image: absoluteUrl("/og.png"),
  type: "website",
};

/** &, <, >, " og ' i attributtverdier — HTML-en settes sammen som tekst. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Metadata for en sti. Faller tilbake til forsidens verdier for ruter uten
 * eget oppsett — men alltid med sin egen canonical, aldri forsidens.
 */
export function headFor(rawPath: string): ResolvedHead {
  const path = normalizePath(rawPath);
  const canonical = absoluteUrl(path);
  const noindex = isNoindexPath(path);
  const robots = noindex ? "noindex,nofollow" : "index,follow";

  const staticRoute = staticRouteFor(path);
  if (staticRoute) {
    return {
      title: `${staticRoute.title} | ${SITE_NAME}`,
      description: staticRoute.description,
      canonical,
      robots,
      image: FALLBACK.image,
      type: "website",
    };
  }

  const destinationId = /^\/reisemal\/([^/]+)$/.exec(path)?.[1];
  if (destinationId) {
    const d = ALL_DESTINATIONS.find((x) => x.id === destinationId);
    if (d) {
      return {
        title: `Fly til ${d.city} | ${SITE_NAME}`,
        description: `${d.city}, ${d.country}: ${d.tagline}. Ekte priser fra Oslo, bagasje per billett og det praktiske før du reiser.`,
        canonical,
        robots,
        image: d.image ? absoluteUrl(d.image) : FALLBACK.image,
        type: "website",
      };
    }
  }

  const routeSlug = /^\/fly\/([^/]+)$/.exec(path)?.[1];
  if (routeSlug) {
    const r = routeBySlug(routeSlug);
    if (r) {
      return {
        title: `${routeTitle(r)} | ${SITE_NAME}`,
        description: routeDescription(r),
        canonical,
        robots,
        image: FALLBACK.image,
        type: "website",
      };
    }
  }

  const articleSlug = /^\/journal\/([^/]+)$/.exec(path)?.[1];
  if (articleSlug) {
    const a = ARTICLES.find((x) => x.slug === articleSlug);
    if (a) {
      return {
        title: `${a.title} | ${SITE_NAME}`,
        description: a.deck,
        canonical,
        robots,
        image: FALLBACK.image,
        type: "article",
      };
    }
  }

  // En sti appen ikke har svarer 404 (api/lib/vite.ts). Den skal også si
  // noindex i selve HTML-en: X-Robots-Tag alene leses ikke av alle crawlere,
  // og en 404-side som sier «index,follow» er nettopp den soft 404-en vi
  // prøver å bli kvitt.
  // These patterns are valid client routes, but an unknown slug is still a
  // missing page. Match the server's 404 decision in the HTML robots tag too.
  if (!isKnownRoute(path) || destinationId || articleSlug) {
    return {
      title: `Siden finnes ikke | ${SITE_NAME}`,
      description: "Siden du leter etter finnes ikke.",
      canonical,
      robots: "noindex,nofollow",
      image: FALLBACK.image,
      type: "website",
    };
  }

  return { ...FALLBACK, canonical, robots };
}

/** Taggene som erstatter blokken i index.html. */
export function seoBlock(path: string): string {
  const h = headFor(path);
  const tags = [
    `<title data-hs-seo="true">${esc(h.title)}</title>`,
    `<meta data-hs-seo="true" name="description" content="${esc(h.description)}" />`,
    `<meta data-hs-seo="true" name="robots" content="${h.robots}" />`,
    `<link data-hs-seo="true" rel="canonical" href="${esc(h.canonical)}" />`,
    `<link rel="alternate" hreflang="nb" href="${esc(h.canonical)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${esc(h.canonical)}" />`,
    `<meta data-hs-seo="true" property="og:type" content="${h.type}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="nb_NO" />`,
    `<meta data-hs-seo="true" property="og:title" content="${esc(h.title)}" />`,
    `<meta data-hs-seo="true" property="og:description" content="${esc(h.description)}" />`,
    `<meta data-hs-seo="true" property="og:url" content="${esc(h.canonical)}" />`,
    `<meta data-hs-seo="true" property="og:image" content="${esc(h.image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta data-hs-seo="true" name="twitter:title" content="${esc(h.title)}" />`,
    `<meta data-hs-seo="true" name="twitter:description" content="${esc(h.description)}" />`,
    `<meta data-hs-seo="true" name="twitter:image" content="${esc(h.image)}" />`,
  ];
  return tags.join("\n    ");
}

/**
 * Bytt ut markørblokken i appskallet. Finner ikke markørene (uventet bygg),
 * returneres HTML-en uendret – en side med feil tittel er bedre enn ingen side.
 */
export function withSeoHead(html: string, path: string): string {
  const start = html.indexOf(SEO_START);
  const end = html.indexOf(SEO_END);
  if (start === -1 || end === -1 || end < start) return html;
  return html.slice(0, start + SEO_START.length) + "\n    " + seoBlock(path) + "\n    " + html.slice(end);
}
