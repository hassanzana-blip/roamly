import { useState } from "react";
import { Link, useLocation } from "react-router";
import { ArrowRight, ArrowUpRight, ChevronDown, Clock3, Luggage } from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import Icon from "@/components/app/Icon";
import { Button } from "@/components/ui/button";
import { CONTINENTS, FEATURED, type FeaturedDestination } from "@/content/destinations";
import { PAGE_META, articleJsonLd, breadcrumbJsonLd, itemListJsonLd, usePageMeta } from "@/lib/seo";

function departDate(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function searchLink(iata: string) {
  return `/sok?from=OSL&to=${iata}&depart=${departDate(35)}&adults=1&children=0&infants=0&cabin=economy`;
}

/**
 * One home route. Collapsed it is an index row (country, headline, gateways,
 * flight time); open it is the full guide. Twelve open guides in a row made
 * the page 30+ screens on a phone, so the reader chooses which one to read.
 */
function HomeRoute({ d, index, open: initiallyOpen }: { d: FeaturedDestination; index: number; open: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const bodyId = `${d.id}-guide`;
  return (
    <article id={d.id} className="scroll-mt-24 border-t border-border">
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
          className="group flex w-full items-start gap-4 py-6 text-left sm:gap-6 sm:py-7"
        >
          <span className="t-code w-7 shrink-0 pt-1.5 text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
          <span className="min-w-0 flex-1">
            <span className="t-h3 block">{d.country}</span>
            <span className="mt-1 block text-[15px] text-muted-foreground">{d.headline}</span>
            <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
              <span className="flex flex-wrap gap-1.5">
                {d.gateways.map((g) => (
                  <span key={g.iata} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5 text-foreground">
                    {g.label} <span className="t-code text-muted-foreground">{g.iata}</span>
                  </span>
                ))}
              </span>
              <span className="inline-flex items-center gap-1.5"><Icon icon={Clock3} size={14} /> {d.flightTime}</span>
            </span>
          </span>
          <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-card transition-colors group-hover:border-foreground/40">
            <Icon icon={ChevronDown} size={18} className={`transition-transform duration-base ease-out ${open ? "rotate-180" : ""}`} />
          </span>
        </button>
      </h3>
      <div id={bodyId} hidden={!open} className="pb-8 pl-11 sm:pl-[3.25rem]">
        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            {d.paragraphs.map((p, i) => (
              <p key={i} className="t-body text-muted-foreground">{p}</p>
            ))}
            <ul className="mt-5 space-y-2.5 border-t border-border pt-5">
              {d.tips.map((tip) => (
                <li key={tip} className="flex gap-3 text-sm leading-relaxed">
                  <Icon icon={Luggage} size={16} className="mt-0.5 shrink-0 text-foreground" />
                  <span className="text-muted-foreground">{tip}</span>
                </li>
              ))}
            </ul>
          </div>
          <aside className="h-fit rounded-lg bg-muted/50 p-6">
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="t-label text-muted-foreground">Beste reisetid</dt>
                <dd className="mt-1 text-foreground">{d.bestTime}</dd>
              </div>
              <div>
                <dt className="t-label text-muted-foreground">Reisetid fra Oslo</dt>
                <dd className="mt-1 text-foreground">{d.flightTime}</dd>
              </div>
              <div>
                <dt className="t-label text-muted-foreground">Vanlig rute</dt>
                <dd className="t-code mt-1 text-foreground">{d.typicalRoute}</dd>
              </div>
            </dl>
            <Button asChild variant="dark" className="mt-6 w-full">
              <Link to={searchLink(d.gateways[0].iata)}>Søk fly til {d.gateways[0].label} <Icon icon={ArrowRight} size={18} /></Link>
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
          <p className="t-label mb-4 text-muted-foreground">Reisemål fra Norge</p>
          <h1 className="t-display max-w-3xl text-balance">
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
                className="shrink-0 rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
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
          <p className="t-label mb-3 text-muted-foreground">Hjem til familien</p>
          <h2 className="t-h1">Rutene vi kjenner best</h2>
          <p className="t-body mt-4 text-muted-foreground">
            Millioner av reiser mellom Norge og verden hvert år handler om det
            samme: familie. Disse landene er hjem for Norges største
            innvandrergrupper – og rutene vi hjelper flest kunder med, året rundt.
            Åpne et land for hele guiden.
          </p>
        </div>
        <div className="border-b border-border">
          {FEATURED.map((d, idx) => (
            <HomeRoute key={d.id} d={d} index={idx} open={hash === d.id} />
          ))}
        </div>
      </section>

      {/* ── Continents ───────────────────────────────────────────── */}
      {CONTINENTS.map((c) => (
        <section
          key={c.id}
          id={c.id}
          className="mx-auto w-full max-w-6xl scroll-mt-24 border-t border-border px-4 py-14 sm:px-6"
        >
          <div className="mb-8 max-w-2xl">
            <h2 className="t-h1">{c.name}</h2>
            <p className="t-body mt-2 text-muted-foreground">{c.blurb}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {c.places.map((p) => (
              <Link
                key={p.iata + p.city}
                to={searchLink(p.iata)}
                className="group flex min-w-0 items-center justify-between gap-4 rounded-lg border border-border bg-card px-5 py-4 transition-colors hover:border-foreground/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="t-h3 block truncate">{p.city}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{p.country} · {p.note}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="t-code text-muted-foreground">{p.iata}</span>
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-border transition-colors group-hover:border-foreground group-hover:bg-foreground group-hover:text-background">
                    <Icon icon={ArrowUpRight} size={16} />
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="t-h1 max-w-2xl text-balance">
            Fant du ikke byen din? Vi flyr dit likevel.
          </h2>
          <p className="t-body max-w-xl text-muted-foreground">
            Søk i hele markedet – eller spør oss direkte på WhatsApp, så finner
            vi den beste veien sammen.
          </p>
          <Button asChild variant="dark" size="lg">
            <Link to="/">Søk etter fly nå <Icon icon={ArrowRight} size={18} /></Link>
          </Button>
        </div>
      </section>
      </main>

      <SiteFooter />
    </div>
  );
}
