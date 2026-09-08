import { useState } from "react";
import { Link, useLocation } from "react-router";
import { ArrowRight, ChevronDown, Clock3 } from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import Icon from "@/components/app/Icon";
import { Button } from "@/components/ui/button";
import PlaceCard, { RouteTile, type PlaceLike } from "@/components/travel/PlaceCard";
import { CONTINENTS, FEATURED, type ContinentPlace, type FeaturedDestination } from "@/content/destinations";
import { ALL_DESTINATIONS, destinationById, imageSrcSet } from "@/content/discover";
import { useT } from "@/lib/i18n";
import { PAGE_META, articleJsonLd, breadcrumbJsonLd, itemListJsonLd, usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";

function departDate(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function searchLink(iata: string) {
  return `/sok?from=OSL&to=${iata}&depart=${departDate(35)}&adults=1&children=0&infants=0&cabin=economy`;
}

/** Byen i katalogen med samme flyplass (eller samme bynavn): gir et verifisert foto og en egen reisemålsside. */
function catalogMatch(p: ContinentPlace) {
  return (
    ALL_DESTINATIONS.find((d) => d.iata === p.iata) ??
    ALL_DESTINATIONS.find((d) => d.city.toLocaleLowerCase("nb") === p.city.toLocaleLowerCase("nb"))
  );
}

/**
 * One home route. Collapsed it is an index row (photo, country, headline,
 * gateways, flight time); open it is the full guide. Twelve open guides in a
 * row made the page 30+ screens on a phone, so the reader chooses which one
 * to read. A deep link (#syria) opens that guide.
 */
function HomeRoute({ d, hash }: { d: FeaturedDestination; hash: string }) {
  const t = useT();
  // Åpen når leseren har trykket, eller når adressen peker hit (#syria).
  // Utledet under render – ingen setState i en effekt.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const linked = hash === d.id;
  const open = toggled ?? linked;
  const setOpen = (next: boolean) => setToggled(next);
  const bodyId = `${d.id}-guide`;
  const photo = d.photo ? destinationById(d.photo) : undefined;
  const gateway = d.gateways[0];
  const facts: [string, string][] = [
    ["Beste reisetid", d.bestTime],
    ["Reisetid fra Oslo", d.flightTime],
    ["Vanlig rute", d.typicalRoute],
  ];
  return (
    <article id={d.id} className="scroll-mt-24 border-t border-border">
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen(!open)}
          className="img-zoom group grid w-full grid-cols-[88px_minmax(0,1fr)_auto] items-start gap-4 py-5 text-left sm:grid-cols-[176px_minmax(0,1fr)_auto] sm:gap-6 sm:py-6"
        >
          <span className="block aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
            {photo?.image ? (
              <img
                src={photo.image}
                srcSet={imageSrcSet(photo.image)}
                sizes="(max-width: 640px) 88px, 176px"
                alt={photo.imageAlt}
                loading="lazy"
                decoding="async"
                width={1024}
                height={640}
                className="h-full w-full object-cover"
              />
            ) : (
              <RouteTile iata={gateway.iata} />
            )}
          </span>
          <span className="min-w-0">
            <span className="t-h2 block">{d.country}</span>
            <span className="t-body mt-1 block text-muted-foreground">{d.headline}</span>
            {/* Phones show the two main gateways and a count; the guide lists them all. */}
            <span className="t-caption mt-2.5 block">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {d.gateways.slice(0, 2).map((g, i) => (
                  <span key={g.iata} className="inline-flex items-center gap-1.5">
                    {i > 0 && <span aria-hidden="true">·</span>}
                    <span className="text-foreground">{g.label}</span>
                    <span className="t-code">{g.iata}</span>
                  </span>
                ))}
                {d.gateways.length > 2 && (
                  <>
                    <span className="hidden sm:inline" aria-hidden="true">·</span>
                    <span className="hidden sm:inline-flex sm:items-center sm:gap-1.5">
                      <span className="text-foreground">{d.gateways[2].label}</span>
                      <span className="t-code">{d.gateways[2].iata}</span>
                    </span>
                    <span className="sm:hidden">+{d.gateways.length - 2}</span>
                    {d.gateways.length > 3 && <span className="hidden sm:inline">+{d.gateways.length - 3}</span>}
                  </>
                )}
              </span>
              <span className="mt-1 flex items-center gap-1.5">
                <Icon icon={Clock3} size={14} className="shrink-0" /> {d.flightTime}
              </span>
            </span>
          </span>
          <span className="t-caption mt-1 inline-flex items-center gap-2 sm:mt-1.5">
            <span className="hidden sm:inline">{open ? t("dest.closeGuide") : t("dest.openGuide")}</span>
            <span className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card transition-colors duration-fast group-hover:border-foreground/40">
              <Icon icon={ChevronDown} size={16} className={cn("transition-transform duration-base ease-out", open && "rotate-180")} />
            </span>
          </span>
        </button>
      </h3>
      <div id={bodyId} hidden={!open} className="pb-10 sm:pl-[calc(176px+1.5rem)]">
        <p className="t-lead max-w-2xl">{d.community}</p>
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12">
          <div>
            <div className="space-y-4">
              {d.paragraphs.map((p, i) => (
                <p key={i} className="t-body text-muted-foreground">{p}</p>
              ))}
            </div>
            <ul className="mt-6 space-y-2.5 border-t border-border pt-5">
              {d.tips.map((tip) => (
                <li key={tip} className="flex gap-3 text-[15px] leading-relaxed text-muted-foreground">
                  <span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
          <aside className="h-fit">
            <dl className="divide-y divide-border border-y border-border">
              {facts.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 py-3">
                  <dt className="t-label pt-0.5">{label}</dt>
                  <dd className="text-[15px] leading-snug">{value}</dd>
                </div>
              ))}
            </dl>
            <Button asChild variant="dark" size="lg" className="mt-6 w-full sm:w-auto">
              <Link to={searchLink(gateway.iata)}>
                {t("dest.searchTo", { city: gateway.label })} <Icon icon={ArrowRight} size={18} />
              </Link>
            </Button>
          </aside>
        </div>
      </div>
    </article>
  );
}

export default function Destinations() {
  usePageMeta({
    ...PAGE_META.destinations,
    type: "article",
    jsonLd: [
      articleJsonLd({ headline: PAGE_META.destinations.title, description: PAGE_META.destinations.description, path: PAGE_META.destinations.canonicalPath }),
      itemListJsonLd(FEATURED.map((f) => ({ name: f.country, url: `/reisemal#${f.id}`, description: f.headline }))),
      breadcrumbJsonLd([
        { name: "Hjem", path: "/" },
        { name: PAGE_META.destinations.title, path: PAGE_META.destinations.canonicalPath },
      ]),
    ],
  });
  // A deep link (#syria) opens that guide; everything else starts collapsed.
  const hash = useLocation().hash.replace(/^#/, "");
  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-28 sm:px-6 sm:pb-16 sm:pt-32">
          <h1 className="t-display max-w-3xl">
            Dit hjertet hører hjemme – <span className="hl">og resten av verden.</span>
          </h1>
          <p className="t-lead mt-6 max-w-2xl text-muted-foreground">
            Vi flyr deg overalt. Men vi kjenner særlig godt rutene hjem – til
            familien i Istanbul og Erbil, Beirut og Casablanca, Asmara og Kabul,
            Islamabad og Delhi, Dhaka, Colombo og Warszawa. Her er alt vi vet om
            reisen dit, samlet på én side.
          </p>
          <nav className="no-scrollbar -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Hopp til verdensdel">
            {[
              { id: "hjem", label: "Hjem til familien" },
              ...CONTINENTS.map((c) => ({ id: c.id, label: c.name })),
            ].map((c) => (
              <a
                key={c.id}
                href={`#${c.id}`}
                className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors duration-fast hover:border-foreground/40"
              >
                {c.label}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* ── Home routes: an index you open, not twelve essays in a row ── */}
      <section id="hjem" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mb-8 max-w-2xl sm:mb-10">
          <h2 className="t-h1">Rutene vi kjenner best</h2>
          <p className="t-lead mt-4 text-muted-foreground">
            Millioner av reiser mellom Norge og verden hvert år handler om det
            samme: familie. Disse landene er hjem for Norges største
            innvandrergrupper – og rutene vi hjelper flest kunder med, året rundt.
            Åpne et land for hele guiden.
          </p>
        </div>
        <div className="border-b border-border">
          {FEATURED.map((d) => (
            <HomeRoute key={d.id} d={d} hash={hash} />
          ))}
        </div>
      </section>

      {/* ── Continents ───────────────────────────────────────────── */}
      {CONTINENTS.map((c) => (
        <section
          key={c.id}
          id={c.id}
          className="mx-auto w-full max-w-6xl scroll-mt-24 border-t border-border px-4 py-14 sm:px-6 sm:py-20"
        >
          <div className="mb-8 max-w-2xl sm:mb-10">
            <h2 className="t-h1">{c.name}</h2>
            <p className="t-lead mt-3 text-muted-foreground">{c.blurb}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
            {c.places.map((p) => {
              const match = catalogMatch(p);
              const place: PlaceLike = { city: p.city, country: p.country, iata: p.iata, caption: p.note, image: match?.image, imageAlt: match?.imageAlt };
              return (
                <PlaceCard
                  key={p.iata + p.city}
                  place={place}
                  to={match ? `/reisemal/${match.id}` : searchLink(p.iata)}
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 264px"
                />
              );
            })}
          </div>
        </section>
      ))}

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="bg-night text-white">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <h2 className="t-h1 max-w-2xl">
              Fant du ikke byen din? <span className="t-em">Vi flyr dit likevel.</span>
            </h2>
            <p className="t-body mt-4 max-w-xl text-white/75">
              Søk i hele markedet – eller skriv til oss på WhatsApp, så finner
              vi den beste veien sammen.
            </p>
          </div>
          <Button asChild size="lg">
            <Link to="/">Søk etter fly <Icon icon={ArrowRight} size={18} /></Link>
          </Button>
        </div>
      </section>
      </main>

      <SiteFooter />
    </div>
  );
}
