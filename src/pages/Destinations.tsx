import { Link } from "react-router";
import { ArrowRight, ArrowUpRight, Clock3, Luggage, Plane } from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { CONTINENTS, FEATURED } from "@/content/destinations";
import { PAGE_META, articleJsonLd, breadcrumbJsonLd, itemListJsonLd, usePageMeta } from "@/lib/seo";

function departDate(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function searchLink(iata: string) {
  return `/sok?from=OSL&to=${iata}&depart=${departDate(35)}&adults=1&children=0&infants=0&cabin=economy`;
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
  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-muted/40 border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 pb-14 pt-32 sm:px-6">
          <p className="mb-3 font-mono-label text-[11px] text-primary">
            Reisemål fra Norge
          </p>
          <h1 className="max-w-3xl font-display text-5xl leading-[1.02] text-balance sm:text-6xl md:text-7xl">
            Dit hjertet hører hjemme — <span className="text-primary">og resten av verden.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Vi flyr deg overalt. Men vi kjenner særlig godt rutene hjem — til
            familien i Istanbul og Erbil, Beirut og Casablanca, Asmara og Kabul,
            Islamabad og Delhi, Dhaka, Colombo og Warszawa. Her er alt vi vet om
            reisen dit, samlet på én side.
          </p>
          <nav className="mt-8 flex flex-wrap gap-2" aria-label="Hopp til verdensdel">
            {[
              { id: "hjem", label: "Hjem til familien" },
              ...CONTINENTS.map((c) => ({ id: c.id, label: c.name })),
            ].map((c) => (
              <a
                key={c.id}
                href={`#${c.id}`}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                {c.label}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* ── Featured: diaspora destinations ──────────────────────── */}
      <section id="hjem" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6">
        <div className="mb-10 max-w-2xl">
          <p className="mb-2 font-mono-label text-[11px] text-primary">
            Hjem til familien
          </p>
          <h2 className="font-display text-4xl leading-tight sm:text-5xl">
            Rutene vi kjenner best
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Millioner av reiser mellom Norge og verden hvert år handler om det
            samme: familie. Disse landene er hjem for Norges største
            innvandrergrupper — og rutene vi hjelper flest kunder med, året rundt.
          </p>
        </div>

        <div className="space-y-8">
          {FEATURED.map((d, idx) => (
            <article
              key={d.id}
              id={d.id}
              className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card"
            >
              {/* header band */}
              <div className={`bg-gradient-to-br ${d.hue} p-7 text-white sm:p-9`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                      {String(idx + 1).padStart(2, "0")} · {d.community}
                    </p>
                    <h3 className="mt-2 font-display text-3xl text-white sm:text-4xl">{d.country}</h3>
                    <p className="mt-1.5 text-base text-white/75">{d.headline}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {d.gateways.map((g) => (
                      <Link
                        key={g.iata}
                        to={searchLink(g.iata)}
                        className="group inline-flex items-center gap-2 rounded-xl bg-white/15 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-gold"
                      >
                        <Plane className="h-3.5 w-3.5" />
                        {g.label}
                        <span className="text-xs tracking-widest opacity-70">{g.iata}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {/* body */}
              <div className="grid gap-8 p-7 sm:p-9 lg:grid-cols-[1.5fr_1fr]">
                <div className="space-y-4">
                  {d.paragraphs.map((p, i) => (
                    <p key={i} className="text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                      {p}
                    </p>
                  ))}
                  <ul className="mt-5 space-y-2.5 border-t border-border pt-5">
                    {d.tips.map((t) => (
                      <li key={t} className="flex gap-3 text-sm leading-relaxed">
                        <Luggage className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                        <span className="text-muted-foreground">{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <aside className="h-fit rounded-lg border border-border bg-card p-6">
                  <dl className="space-y-4 text-sm">
                    <div>
                      <dt className="font-mono-label text-[11px] text-primary">
                        Beste reisetid
                      </dt>
                      <dd className="mt-1 text-muted-foreground">{d.bestTime}</dd>
                    </div>
                    <div>
                      <dt className="font-mono-label text-[11px] text-primary">
                        Reisetid fra Oslo
                      </dt>
                      <dd className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5 text-foreground" /> {d.flightTime}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono-label text-[11px] text-primary">
                        Vanlig rute
                      </dt>
                      <dd className="mt-1 text-muted-foreground">{d.typicalRoute}</dd>
                    </div>
                  </dl>
                  <Link
                    to={searchLink(d.gateways[0].iata)}
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-5 py-3 text-sm font-semibold text-white transition-colors hover:opacity-90"
                  >
                    Søk fly til {d.gateways[0].label} <ArrowRight className="h-4 w-4" />
                  </Link>
                </aside>
              </div>
            </article>
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
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-4xl sm:text-5xl">{c.name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{c.blurb}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.places.map((p) => (
              <Link
                key={p.iata + p.city}
                to={searchLink(p.iata)}
                className="card-lift group rounded-xl border border-border bg-card p-6"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-2xl">{p.city}</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {p.country} · {p.note}
                    </p>
                  </div>
                  <span className="rounded-lg bg-secondary px-2 py-1 text-xs font-semibold tracking-widest text-secondary-foreground">
                    {p.iata}
                  </span>
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Fra Oslo Gardermoen</span>
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-border transition-colors group-hover:border-gold group-hover:bg-gold group-hover:text-white">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="relative border-t border-border bg-muted/40">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-6">
          <h2 className="max-w-2xl font-display text-4xl leading-tight sm:text-5xl">
            Fant du ikke byen din? <span className="text-primary">Vi flyr dit alikevel.</span>
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Søk i hele markedet — eller spør oss direkte på WhatsApp, så finner
            vi den beste veien sammen.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-gold px-8 py-4 text-base font-semibold text-white transition-colors hover:opacity-90"
          >
            Søk etter fly nå <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
      </main>

      <SiteFooter />
    </div>
  );
}
