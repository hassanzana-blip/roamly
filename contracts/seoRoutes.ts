/**
 * Delt SEO-register for offentlige ruter.
 *
 * Én sannhet for tre ting som før spriket:
 *  - server-injisert <title>/description/canonical i index.html (api/lib/seoHead.ts)
 *  - sitemap.xml (api/lib/sitemap.ts)
 *  - 404 for ruter som ikke finnes (api/lib/vite.ts)
 *
 * Klientsiden har sitt eget speil i src/lib/seo.ts (PAGE_META). En test
 * (api/test/seoRoutes.test.ts) holder de to i takt, slik at en tittel aldri
 * kan endres ett sted uten det andre.
 *
 * Ingen React, ingen import.meta.env: filen bundles inn i serveren.
 */

import { routeBySlug } from "./routes";

export const SITE_NAME = "HelloSky";
export const SITE_ORIGIN = "https://hellosky.no";

export type StaticRoute = {
  /** Sti fra rot, uten etterfølgende skråstrek (unntatt "/"). */
  path: string;
  title: string;
  description: string;
  changefreq: "daily" | "weekly" | "monthly" | "yearly";
  /** 0.0–1.0. Brukes kun i sitemap. */
  priority: number;
};

/**
 * Indekserbare sider med fast innhold. Rekkefølgen er sitemap-rekkefølgen.
 * Sider som ikke skal indekseres står i NOINDEX_PREFIXES og hører ikke hjemme her.
 */
export const STATIC_ROUTES: StaticRoute[] = [
  {
    path: "/",
    title: "Søk og sammenlign fly, hotell og leiebil",
    description:
      "HelloSky er en søkemotor for reiser: priser fra flyselskaper, hoteller og reisebyråer i ett søk. Bestillingen fullføres alltid hos leverandøren.",
    changefreq: "daily",
    priority: 1.0,
  },
  {
    path: "/utforsk",
    title: "Utforsk reisemål",
    description: "Reisemål fra Norge etter stemning, region og reisetid. Ekte priser fra vårt eget prissøk.",
    changefreq: "weekly",
    priority: 0.8,
  },
  {
    path: "/reisemal",
    title: "Reisemål",
    description:
      "Reiseguider fra Norge til hele verden: når du bør reise, hvordan du kommer deg fra flyplassen, hvor du bør bo og hva som er verdt å vite før du bestiller.",
    changefreq: "weekly",
    priority: 0.8,
  },
  {
    path: "/fly",
    title: "Flyruter fra Norge",
    description:
      "Rutesider med flyplasser, vanlig reisetid og hvem som flyr direkte. Prisene henter vi når du søker – de står ikke på rutesiden.",
    changefreq: "weekly",
    priority: 0.8,
  },
  {
    path: "/journal",
    title: "HelloSky Journal",
    description:
      "Det vi faktisk vet om reisen: bagasje, mellomlandinger, barn og stedene vi flyr til. Oppdaterte, nyttige artikler uten priser som tall.",
    changefreq: "weekly",
    priority: 0.8,
  },
  {
    path: "/hotell",
    title: "Søk og sammenlign hotell",
    description:
      "Sammenlign hotellpriser fra flere leverandører med ekte hotellbilder og gjestevurderinger. Bestill hos leverandøren.",
    changefreq: "weekly",
    priority: 0.7,
  },
  {
    path: "/leiebil",
    title: "Søk og sammenlign leiebil",
    description: "Sammenlign leiebilpriser fra utleieselskaper og formidlere. Bestill hos leverandøren.",
    changefreq: "weekly",
    priority: 0.7,
  },
  {
    path: "/flystatus",
    title: "Flystatus",
    description: "Sjekk avganger, ankomster og forsinkelser for flyet ditt.",
    changefreq: "daily",
    priority: 0.6,
  },
  {
    path: "/hjelp",
    title: "Kundeservice",
    description: "Hjelp med bestilling, endring, refusjon og bagasje. Norsk kundeservice alle dager 06–24.",
    changefreq: "monthly",
    priority: 0.6,
  },
  {
    path: "/bagasje",
    title: "Bagasjeguiden",
    description: "Håndbagasje, innsjekket bagasje, barn, spesialbagasje og hva du gjør om bagasjen blir borte.",
    changefreq: "monthly",
    priority: 0.6,
  },
  {
    path: "/visum",
    title: "Visumguiden",
    description: "Generell veiledning om pass og visum for norske pass til populære reisemål.",
    changefreq: "monthly",
    priority: 0.6,
  },
  {
    path: "/hotell-bil",
    title: "Hotell og leiebil",
    description: "Vi hjelper deg med hotell og leiebil på reisemålet.",
    changefreq: "monthly",
    priority: 0.5,
  },
  {
    path: "/quiz",
    title: "ReiseMatch",
    description: "Finn reisemålet – alene, som par eller med gjengen. Seks måter å bestemme seg på.",
    changefreq: "monthly",
    priority: 0.5,
  },
  {
    path: "/cruise",
    title: "Cruise",
    description:
      "Cruise-søk er ikke tilgjengelig i HelloSky ennå. Kundeservice hjelper deg gjerne med å finne et cruise.",
    changefreq: "yearly",
    priority: 0.3,
  },
  {
    path: "/om-oss",
    title: "Om HelloSky",
    description:
      "Norsk reisebyrå for hele verden – strandferie, storbyhelg, langtur og besøk hos familie og venner, med ekte mennesker i kundeservice.",
    changefreq: "monthly",
    priority: 0.5,
  },
  {
    path: "/vilkar",
    title: "Reisevilkår",
    description:
      "Vilkår for bestilling av flyreiser gjennom HelloSky: priser, servicegebyr, betaling, endring og refusjon.",
    changefreq: "yearly",
    priority: 0.3,
  },
  {
    path: "/personvern",
    title: "Personvernerklæring",
    description:
      "Hvordan HelloSky behandler personopplysninger: behandlingsansvarlig, databehandlere, lagringstid og dine rettigheter.",
    changefreq: "yearly",
    priority: 0.3,
  },
  {
    path: "/fotokreditering",
    title: "Fotokreditering",
    description: "Fotografer og lisenser for bildene på hellosky.no.",
    changefreq: "yearly",
    priority: 0.2,
  },
];

/** Sti-prefikser som aldri skal indekseres. Speiler public/robots.txt og src/lib/seo.ts. */
export const NOINDEX_PREFIXES = [
  "/admin",
  "/bekreft-epost",
  "/bekreftelse",
  "/bestill",
  "/kvittering",
  "/lagret",
  "/logg-inn",
  "/m",
  "/overnatting-bil",
  "/profil",
  "/reise",
  "/reiser",
  "/samfunn",
  "/sok",
  "/tavler",
  "/tilbakestill-passord",
  "/tilbud",
  "/utvikler",
  "/velkommen",
] as const;

export function isNoindexPath(path: string): boolean {
  return NOINDEX_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Alle ruter appen faktisk rendrer (speiler <Route path> i src/App.tsx).
 * Alt som ikke treffer her er en ekte 404 og skal svare 404 – ikke 200 med
 * appskallet, som gjorde at Google fant uendelig mange «sider».
 */
const DYNAMIC_ROUTE_PATTERNS: RegExp[] = [
  /^\/logg-inn\/sso-(callback|fullfor)$/,
  /^\/reisemal\/[^/]+$/,
  /^\/journal\/[^/]+$/,
  /^\/quiz\/[^/]+$/,
  /^\/hotell\/[^/]+$/,
  /^\/m\/[^/]+$/,
  /^\/tavler\/[^/]+$/,
  /^\/tilbud\/[^/]+$/,
  /^\/bekreftelse\/[^/]+$/,
  /^\/kvittering\/[^/]+$/,
  /^\/admin(\/.*)?$/,
  /^\/profil(\/.*)?$/,
];

/** Ruter uten eget innhold i STATIC_ROUTES, men som appen rendrer. */
const EXTRA_KNOWN_PATHS = [
  "/lagret",
  "/profil",
  "/sok",
  "/bestill",
  "/reise",
  "/reiser",
  "/tavler",
  "/overnatting-bil",
  "/logg-inn",
  "/tilbakestill-passord",
  "/bekreft-epost",
  "/samfunn",
  "/velkommen",
  "/utvikler/ikoner",
] as const;

const STATIC_PATHS = new Set<string>([...STATIC_ROUTES.map((r) => r.path), ...EXTRA_KNOWN_PATHS]);

/** Normaliser: fjern etterfølgende skråstrek og spørrestreng. "/hjelp/" → "/hjelp". */
export function normalizePath(path: string): string {
  const withoutQuery = path.split("?")[0]!.split("#")[0]!;
  if (withoutQuery === "/") return "/";
  return withoutQuery.replace(/\/+$/, "") || "/";
}

export function isKnownRoute(path: string): boolean {
  const p = normalizePath(path);
  if (STATIC_PATHS.has(p)) return true;
  // Rutesider finnes bare for slugene i registeret. /fly/tull er en ekte 404,
  // ikke en tom side med 200 – ellers kan hvem som helst finne på uendelig
  // mange «ruter» og la Google bruke crawl-budsjett på dem.
  const route = /^\/fly\/([^/]+)$/.exec(p);
  if (route) return routeBySlug(route[1]!) !== undefined;
  return DYNAMIC_ROUTE_PATTERNS.some((re) => re.test(p));
}

export function staticRouteFor(path: string): StaticRoute | undefined {
  const p = normalizePath(path);
  return STATIC_ROUTES.find((r) => r.path === p);
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}
