import { ARTICLES } from "../../src/content/journal/index";
import { ALL_DESTINATIONS, type DiscoverDestination } from "../../src/content/discover";
import { airportByIata } from "../../contracts/airports";
import { routeBySlug, routeTitle, type RouteDefinition } from "../../contracts/routes";

/**
 * HTML for innholdssidene før JavaScript.
 *
 * Søket er en app og skal være en app – den server-rendres ikke. Men
 * reisemålssidene, rutesidene, journalen og de juridiske sidene er tekst vi
 * allerede har lokalt, og i dag sender vi dem som en tom `<div id="root">`.
 * En crawler uten JavaScript – og det er flere av dem enn før – ser ingenting.
 *
 * Derfor rendres nettopp de sidene til ekte HTML her, fra de samme registrene
 * klienten bruker. Innholdet kan ikke sprike fra det appen viser, for det er
 * samme kilde.
 *
 * Klienten monterer over dette. Markupen bruker derfor appens egne klasser og
 * samme struktur, slik at overgangen blir et bytte av like blokker og ikke et
 * hopp. Ingenting her er skjult for brukeren og synlig for søkemotoren – det
 * ville vært kloaking, og det gjør vi ikke.
 */

export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const REGION_LABEL: Record<string, string> = {
  europa: "Europa",
  norden: "Norden",
  midtosten: "Midtøsten",
  afrika: "Afrika",
  asia: "Asia",
  amerika: "Amerika",
  oseania: "Oseania",
};

/** Felles ramme, så alle de prerendrede sidene har samme sidebredde og luft. */
function page(inner: string): string {
  return `<div class="min-h-[100dvh] bg-page"><main class="container-x pb-16 pt-6 lg:pt-14">${inner}</main></div>`;
}

function linkList(title: string, links: { href: string; label: string }[]): string {
  if (!links.length) return "";
  return `<nav class="mt-10" aria-label="${esc(title)}"><h2 class="t-h3">${esc(title)}</h2><ul class="mt-3 flex flex-wrap gap-2">${links
    .map(
      (l) =>
        `<li><a class="inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-4 text-[15px] font-semibold text-azure-ink" href="${esc(l.href)}">${esc(l.label)}</a></li>`,
    )
    .join("")}</ul></nav>`;
}

/** Reisemålssiden: bilde, tittel, ingress, fakta og lenker videre. */
function destinationHtml(d: DiscoverDestination): string {
  const airport = airportByIata(d.iata);
  const region = REGION_LABEL[d.region] ?? d.region;
  const facts: [string, string][] = [
    ["Flyplass", airport ? `${d.iata} – ${airport.name}` : d.iata],
    ["Land", d.country],
    ["Region", region],
  ];
  const others = ALL_DESTINATIONS.filter((x) => x.region === d.region && x.id !== d.id).slice(0, 6);
  return page(
    `<article>
      <h1 class="t-display">${esc(d.city)}</h1>
      <p class="mt-3 max-w-xl text-[17px] leading-normal">${esc(d.tagline)}</p>
      <p class="mt-4 text-[14px]">${esc(d.country)} · ${esc(region)} · ${esc(d.iata)}</p>
      <h2 class="t-h2 mt-10">Kort fortalt</h2>
      <dl class="mt-3 max-w-xl">${facts
        .map(
          ([k, v]) =>
            `<div class="flex justify-between gap-4 border-b border-border py-3"><dt class="text-[15px]">${esc(k)}</dt><dd class="text-[15px] font-semibold">${esc(v)}</dd></div>`,
        )
        .join("")}</dl>
      <p class="mt-6"><a class="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 text-[16px] font-bold text-primary-foreground" href="/fly/oslo-${esc(slugPart(d.city))}">Fly Oslo – ${esc(d.city)}</a></p>
    </article>` +
      linkList(
        `Flere reisemål i ${region}`,
        others.map((o) => ({ href: `/reisemal/${o.id}`, label: o.city })),
      ) +
      linkList("Mer fra HelloSky", [
        { href: "/reisemal", label: "Alle reisemål" },
        { href: "/journal", label: "Journal" },
        { href: "/", label: "Søk fly" },
      ]),
  );
}

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Rutesiden: hva vi faktisk vet om ruten, uten oppdiktet fyll. */
function routeHtml(r: RouteDefinition): string {
  const from = airportByIata(r.from);
  const to = airportByIata(r.to);
  const dest = ALL_DESTINATIONS.find((d) => d.iata === r.to);
  const facts: [string, string][] = [
    ["Fra", from ? `${from.city} (${r.from}) – ${from.name}` : r.from],
    ["Til", to ? `${to.city} (${r.to}) – ${to.name}` : r.to],
  ];
  if (r.typicalDurationMinutes) {
    const h = Math.floor(r.typicalDurationMinutes / 60);
    const m = r.typicalDurationMinutes % 60;
    facts.push(["Vanlig reisetid uten stopp", m ? `${h} t ${m} min` : `${h} t`]);
  }
  if (r.directCarriers.length) facts.push(["Selskaper med direktefly", r.directCarriers.join(", ")]);
  facts.push(["Direktefly", r.directCarriers.length ? "Ja" : "Ikke kjent for denne ruten"]);

  const nearby = r.nearbyOrigins
    .map((code) => ({ code, airport: airportByIata(code) }))
    .filter((x) => x.airport)
    .map((x) => ({ href: `/fly/${slugPart(x.airport!.city)}-${slugPart(to?.city ?? r.to)}`, label: `${x.airport!.city} – ${to?.city ?? r.to}` }));

  return page(
    `<article>
      <h1 class="t-display">${esc(routeTitle(r))}</h1>
      <p class="mt-3 max-w-2xl text-[17px] leading-normal">${esc(r.intro)}</p>
      <p class="mt-6"><a class="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 text-[16px] font-bold text-primary-foreground" href="/sok?from=${esc(r.from)}&amp;to=${esc(r.to)}&amp;adults=1&amp;children=0&amp;infants=0&amp;cabin=economy">Søk ${esc(from?.city ?? r.from)} – ${esc(to?.city ?? r.to)}</a></p>
      <h2 class="t-h2 mt-10">Om ruten</h2>
      <dl class="mt-3 max-w-2xl">${facts
        .map(
          ([k, v]) =>
            `<div class="flex justify-between gap-4 border-b border-border py-3"><dt class="text-[15px]">${esc(k)}</dt><dd class="text-[15px] font-semibold">${esc(v)}</dd></div>`,
        )
        .join("")}</dl>
      <p class="mt-6 max-w-2xl text-[14px]">Opplysningene over beskriver ruten og endrer seg sjelden. Priser og ledige avganger henter vi først når du søker, og de kommer fra leverandøren – ikke fra denne siden.</p>
    </article>` +
      linkList("Fra en flyplass i nærheten", nearby) +
      linkList(
        "Les mer",
        [
          dest ? { href: `/reisemal/${dest.id}`, label: `Reisemål: ${dest.city}` } : null,
          { href: "/fly", label: "Alle ruter" },
          { href: "/reisemal", label: "Alle reisemål" },
        ].filter((x): x is { href: string; label: string } => x !== null),
      ),
  );
}

function articleHtml(a: (typeof ARTICLES)[number]): string {
  const body = a.blocks
    .map((b) => {
      switch (b.t) {
        case "p":
          return `<p class="mt-4 max-w-2xl text-[17px] leading-relaxed">${esc(b.text)}</p>`;
        case "h2":
          return `<h2 class="t-h2 mt-10" id="${esc(b.id)}">${esc(b.text)}</h2>`;
        case "ul":
          return `<ul class="mt-4 max-w-2xl list-disc pl-5 text-[17px] leading-relaxed">${b.items.map((i) => `<li class="mt-1">${esc(i)}</li>`).join("")}</ul>`;
        case "tip":
          return `<aside class="mt-6 max-w-2xl rounded-2xl bg-muted px-4 py-3">${b.title ? `<p class="text-[15px] font-bold">${esc(b.title)}</p>` : ""}<p class="mt-1 text-[16px]">${esc(b.text)}</p></aside>`;
        case "quote":
          return `<blockquote class="mt-6 max-w-2xl border-l-4 border-border pl-4 text-[17px] italic">${esc(b.text)}${b.by ? `<footer class="mt-1 text-[14px] not-italic">${esc(b.by)}</footer>` : ""}</blockquote>`;
        case "steps":
          return `<ol class="mt-4 max-w-2xl list-decimal pl-5 text-[17px] leading-relaxed">${b.items.map((s) => `<li class="mt-2"><strong>${esc(s.title)}</strong> ${esc(s.text)}</li>`).join("")}</ol>`;
        default:
          return "";
      }
    })
    .join("");
  const related = a.relatedDestinations
    .map((id) => ALL_DESTINATIONS.find((d) => d.id === id))
    .filter((d): d is DiscoverDestination => Boolean(d))
    .map((d) => ({ href: `/reisemal/${d.id}`, label: d.city }));
  return page(
    `<article>
      <h1 class="t-display">${esc(a.title)}</h1>
      <p class="mt-3 max-w-2xl text-[17px] leading-normal">${esc(a.deck)}</p>
      <p class="mt-3 text-[14px]">Oppdatert <time datetime="${esc(a.updated)}">${esc(a.updated)}</time></p>
      ${body}
    </article>` + linkList("Reisemål i artikkelen", related),
  );
}

function indexHtml(title: string, intro: string, links: { href: string; label: string }[]): string {
  return page(
    `<h1 class="t-display">${esc(title)}</h1><p class="mt-3 max-w-2xl text-[17px] leading-normal">${esc(intro)}</p>` +
      `<ul class="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">${links
        .map(
          (l) =>
            `<li><a class="flex min-h-12 items-center rounded-xl border border-border bg-card px-4 text-[16px] font-semibold text-azure-ink" href="${esc(l.href)}">${esc(l.label)}</a></li>`,
        )
        .join("")}</ul>`,
  );
}

/**
 * HTML for stien, eller null når siden ikke er en innholdsside. Null betyr
 * «send skallet som før» – søket og kontosidene skal ikke røres.
 */
export function prerenderBody(reqPath: string): string | null {
  const path = reqPath.length > 1 && reqPath.endsWith("/") ? reqPath.slice(0, -1) : reqPath;

  const destination = /^\/reisemal\/([^/]+)$/.exec(path);
  if (destination) {
    const d = ALL_DESTINATIONS.find((x) => x.id === destination[1]);
    return d ? destinationHtml(d) : null;
  }

  const article = /^\/journal\/([^/]+)$/.exec(path);
  if (article) {
    const a = ARTICLES.find((x) => x.slug === article[1]);
    return a ? articleHtml(a) : null;
  }

  const route = /^\/fly\/([^/]+)$/.exec(path);
  if (route) {
    const r = routeBySlug(route[1]);
    return r ? routeHtml(r) : null;
  }

  if (path === "/reisemal") {
    return indexHtml(
      "Reisemål",
      "Reiseguider fra Norge til hele verden: når du bør reise, hvordan du kommer deg fra flyplassen og hva som er verdt å vite før du bestiller.",
      ALL_DESTINATIONS.map((d) => ({ href: `/reisemal/${d.id}`, label: `${d.city}, ${d.country}` })),
    );
  }

  if (path === "/journal") {
    return indexHtml(
      "HelloSky Journal",
      "Det vi faktisk vet om reisen: bagasje, mellomlandinger, barn og stedene vi flyr til.",
      ARTICLES.map((a) => ({ href: `/journal/${a.slug}`, label: a.title })),
    );
  }

  return null;
}

/**
 * Finnes innholdet bak en dynamisk sti?
 *
 * `isKnownRoute` sier om appen har en rute for mønsteret. Den kan ikke vite om
 * *innholdet* finnes, så /reisemal/finnes-ikke svarte 200 med en tom side.
 * Google kaller det en soft 404 og bruker crawl-budsjett på uendelig mange
 * slike. Her sjekker vi registrene: ukjent id → ekte 404.
 *
 * Returnerer null for stier dette ikke gjelder, slik at kalleren beholder sin
 * egen vurdering.
 */
export function dynamicContentExists(reqPath: string): boolean | null {
  const path = reqPath.length > 1 && reqPath.endsWith("/") ? reqPath.slice(0, -1) : reqPath;

  const destination = /^\/reisemal\/([^/]+)$/.exec(path);
  if (destination) return ALL_DESTINATIONS.some((d) => d.id === destination[1]);

  const article = /^\/journal\/([^/]+)$/.exec(path);
  if (article) return ARTICLES.some((a) => a.slug === article[1]);

  return null;
}
