/**
 * SEO-hjelpere (OTA-198–201) — bygget på react-helmet-async.
 *
 * Bruk i en side:
 *
 *   import { usePageMeta, PAGE_META } from "@/lib/seo";
 *   export default function Support() {
 *     usePageMeta(PAGE_META.support);                 // ferdig oppsett
 *     // eller eksplisitt:
 *     usePageMeta({ title: "Kundeservice", description: "…", canonicalPath: "/hjelp" });
 *     …
 *   }
 *
 * Hva den gjør:
 *  - <title>  "<Page> | HelloSky"
 *  - meta description, canonical (`${VITE_PUBLIC_URL ?? location.origin}${canonicalPath}`)
 *  - og:title / og:description / og:url / og:image (absolutt) / twitter:*
 *  - robots "noindex,nofollow" for sider som ikke skal indekseres (bestilling,
 *    bekreftelse, kvittering, reise, profil, admin, tilbud, logg-inn) — settes
 *    automatisk ut fra canonicalPath, eller eksplisitt med `noindex: true`.
 *  - valgfri JSON-LD (Article, FAQPage, BreadcrumbList …) via `jsonLd`.
 *
 * Kun ÉN usePageMeta per side. HelmetProvider er montert i main.tsx.
 * Sider som ikke kaller usePageMeta beholder standardene fra index.html.
 */

import { useEffect } from "react";
import { useHelmet } from "@/providers/helmetContext";

export type JsonLd = Record<string, unknown>;

export type PageMeta = {
  /** Sidetittel uten «| HelloSky». */
  title: string;
  description: string;
  /** Sti fra rot, f.eks. "/hjelp". Brukes til canonical + og:url. */
  canonicalPath: string;
  noindex?: boolean;
  /** Ett eller flere JSON-LD-objekter (uten <script>-innpakning). */
  jsonLd?: JsonLd | JsonLd[];
  /** Absolutt eller rot-relativ bilde-URL. Standard: /og.png */
  image?: string;
  /** og:type — standard "website". */
  type?: "website" | "article";
};

const SITE_NAME = "HelloSky";

/** Sti-prefikser som aldri skal indekseres (speiler public/robots.txt). */
const NOINDEX_PREFIXES = [
  "/bestill",
  "/bekreftelse",
  "/kvittering",
  "/reise",
  "/profil",
  "/admin",
  "/tilbud",
  "/logg-inn",
  "/tilbakestill-passord",
  "/bekreft-epost",
] as const;

function publicUrl(): string {
  const env = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.trim();
  if (env) return env.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "https://hellosky.no";
}

function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${publicUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

function isNoindexPath(path: string): boolean {
  return NOINDEX_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Rå struktur som Helmet-provideren rendrer. */
export type ResolvedMeta = {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  image: string;
  type: string;
  jsonLd: JsonLd[];
};

function resolveMeta(meta: PageMeta): ResolvedMeta {
  const noindex = meta.noindex ?? isNoindexPath(meta.canonicalPath);
  const jsonLd = meta.jsonLd ? (Array.isArray(meta.jsonLd) ? meta.jsonLd : [meta.jsonLd]) : [];
  return {
    title: `${meta.title} | ${SITE_NAME}`,
    description: meta.description,
    canonical: absoluteUrl(meta.canonicalPath),
    robots: noindex ? "noindex,nofollow" : "index,follow",
    image: absoluteUrl(meta.image ?? "/og.png"),
    type: meta.type ?? "website",
    jsonLd,
  };
}

let nextId = 1;

/**
 * Sett sidens metadata. Kall øverst i sidekomponenten (før tidlige returns).
 * Metadataene fjernes automatisk når siden avmonteres.
 * `layout: true` gir lav prioritet (fallback fra en layout-komponent som
 * AdminLayout) — sider som selv kaller usePageMeta vinner.
 */
export function usePageMeta(meta: PageMeta, opts: { layout?: boolean } = {}): void {
  const registry = useHelmet();
  const priority = opts.layout ? 0 : 1;
  // Serialisert nøkkel: effekten kjører kun når innholdet faktisk endres,
  // ikke ved hver render med et nytt objekt.
  const key = JSON.stringify(meta);
  useEffect(() => {
    const id = nextId++;
    registry.register(id, resolveMeta(JSON.parse(key) as PageMeta), priority);
    return () => registry.unregister(id);
  }, [key, priority, registry]);
}

// ─── Ferdige oppsett for offentlige sider ─────────────────────────────────
// Den andre utvikleren kan bruke disse direkte: usePageMeta(PAGE_META.home)

const ORG_JSON_LD: JsonLd = {
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  name: SITE_NAME,
  url: "https://hellosky.no",
  areaServed: "NO",
};

export function faqJsonLd(items: { question: string; answer: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.question,
      acceptedAnswer: { "@type": "Answer", text: i.answer },
    })),
  };
}

export function articleJsonLd(opts: { headline: string; description: string; path: string; dateModified?: string }): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.headline,
    description: opts.description,
    mainEntityOfPage: absoluteUrl(opts.path),
    publisher: { "@type": "Organization", name: SITE_NAME },
    inLanguage: "nb",
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
  };
}

export function itemListJsonLd(items: { name: string; url?: string; description?: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      ...(it.url ? { url: absoluteUrl(it.url) } : {}),
      ...(it.description ? { description: it.description } : {}),
    })),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

export const PAGE_META = {
  home: {
    title: "Flybilletter fra Norge til hele verden",
    description: "Søk og bestill flyreiser fra Norge. Totalpris opp front, betaling via Stripe (kort og Klarna) og norsk kundeservice 06–24.",
    canonicalPath: "/",
    jsonLd: ORG_JSON_LD,
  },
  explore: { title: "Utforsk reisemål", description: "Inspirasjon og guidepriser til populære reisemål fra Norge.", canonicalPath: "/utforsk" },
  destinations: { title: "Reisemål", description: "Guider til de rutene vi kjenner best — fra Oslo til Istanbul, Erbil, Beirut, Casablanca og resten av verden.", canonicalPath: "/reisemal" },
  support: { title: "Kundeservice", description: "Hjelp med bestilling, endring, refusjon og bagasje. Norsk kundeservice alle dager 06–24.", canonicalPath: "/hjelp" },
  flightStatus: { title: "Flystatus", description: "Sjekk avganger, ankomster og forsinkelser for flyet ditt.", canonicalPath: "/flystatus" },
  hotelCar: { title: "Hotell og leiebil", description: "Vi hjelper deg med hotell og leiebil på reisemålet.", canonicalPath: "/hotell-bil" },
  quiz: { title: "Reisequiz", description: "Finn reisemålet som passer deg på under ett minutt.", canonicalPath: "/quiz" },
  community: { title: "Reisesamfunn", description: "Tips, svar og spørsmål fra andre reisende.", canonicalPath: "/samfunn", noindex: true },
  stayResults: { title: "Hotell og leiebil — forespørsel", description: "Send forespørsel om hotell eller leiebil, så kommer vi tilbake med et konkret tilbud.", canonicalPath: "/overnatting-bil", noindex: true },
  search: { title: "Søkeresultater", description: "Flyreiser som matcher søket ditt.", canonicalPath: "/sok", noindex: true },
  checkout: { title: "Bestilling", description: "Fullfør bestillingen din.", canonicalPath: "/bestill", noindex: true },
  confirmation: { title: "Bekreftelse", description: "Bestillingen din er bekreftet.", canonicalPath: "/bekreftelse", noindex: true },
  receipt: { title: "Kvittering", description: "Kvittering for bestillingen din.", canonicalPath: "/kvittering", noindex: true },
  myTrip: { title: "Min reise", description: "Finn bestillingen din.", canonicalPath: "/reise", noindex: true },
  profile: { title: "Profil", description: "Kontoen din hos HelloSky.", canonicalPath: "/profil", noindex: true },
  saved: { title: "Lagrede reisemål", description: "Reisemålene du har lagret.", canonicalPath: "/lagret", noindex: true },
  login: { title: "Logg inn", description: "Logg inn eller opprett konto.", canonicalPath: "/logg-inn", noindex: true },
  resetPassword: { title: "Tilbakestill passord", description: "Velg et nytt passord for HelloSky-kontoen din.", canonicalPath: "/tilbakestill-passord", noindex: true },
  verifyEmail: { title: "Bekreft e-post", description: "Bekreft e-postadressen din for å se bestillinger og saker.", canonicalPath: "/bekreft-epost", noindex: true },
  editProfile: { title: "Rediger profil", description: "Navn, e-post, telefon og passord for kontoen din.", canonicalPath: "/profil/rediger", noindex: true },
  travelers: { title: "Lagrede reisende", description: "Reisende du har lagret for raskere bestilling.", canonicalPath: "/profil/reisende", noindex: true },
  priceAlerts: { title: "Prisvarsler", description: "Prisvarslene dine hos HelloSky.", canonicalPath: "/profil/prisvarsler", noindex: true },
  quote: { title: "Tilbud", description: "Ditt personlige tilbud fra HelloSky.", canonicalPath: "/tilbud", noindex: true },
  terms: { title: "Reisevilkår", description: "Vilkår for bestilling av flyreiser gjennom HelloSky: priser, servicegebyr, betaling, endring og refusjon.", canonicalPath: "/vilkar" },
  privacy: { title: "Personvernerklæring", description: "Hvordan HelloSky behandler personopplysninger: behandlingsansvarlig, databehandlere, lagringstid og dine rettigheter.", canonicalPath: "/personvern" },
  baggage: { title: "Bagasjeguiden", description: "Håndbagasje, innsjekket bagasje, barn, spesialbagasje og hva du gjør om bagasjen blir borte.", canonicalPath: "/bagasje" },
  visa: { title: "Visumguiden", description: "Generell veiledning om pass og visum for norske pass til populære reisemål.", canonicalPath: "/visum" },
  about: { title: "Om HelloSky", description: "Norsk reisebyrå med spesialkompetanse på reiser hjem til familie — med ekte mennesker i kundeservice.", canonicalPath: "/om-oss" },
  notFound: { title: "Siden finnes ikke", description: "Siden du leter etter finnes ikke.", canonicalPath: "/404", noindex: true },
  admin: { title: "Administrasjon", description: "Internportal for ansatte.", canonicalPath: "/admin", noindex: true },
} as const satisfies Record<string, PageMeta>;
