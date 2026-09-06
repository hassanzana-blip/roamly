import { useEffect, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { ArrowRight, CalendarDays, Clock3, HeartHandshake, Radar } from "lucide-react";
import GlobeSafe from "@/components/globe/GlobeSafe";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import SearchWidget from "@/components/search/SearchWidget";
import DestinationCarousel from "@/components/travel/DestinationCarousel";
import VideoHero from "@/components/travel/VideoHero";
import { FAMILY_DESTINATIONS, POPULAR_DESTINATIONS } from "@/content/discover";
import { loadRecentSearches, recentSearchHref, type RecentSearch } from "@/lib/recentSearches";
import { airportByIata } from "@contracts/airports";

const AIRLINES = [
  "SAS", "Norwegian", "Widerøe", "KLM", "Lufthansa", "British Airways",
  "Air France", "Finnair", "Icelandair", "Turkish Airlines", "Emirates", "Qatar Airways",
];

function formatDepart(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
}

function RecentSearches() {
  const [items, setItems] = useState<RecentSearch[]>([]);
  useEffect(() => setItems(loadRecentSearches()), []);
  if (items.length === 0) return null;
  return (
    <section aria-label="Fortsett planleggingen" className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-sm font-semibold text-muted-foreground">Fortsett planleggingen:</span>
        {items.map((s) => (
          <Link
            key={`${s.from}-${s.to}-${s.depart}-${s.ret ?? ""}`}
            to={recentSearchHref(s)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <CalendarDays className="h-4 w-4 text-primary" />
            {s.fromLabel} → {s.toLabel}
            <span className="text-muted-foreground">· {formatDepart(s.depart)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />

      {/* ── 1–3. Hero: levende hav + løfte + umiddelbart søk ───────── */}
      <VideoHero>
        <motion.div
          initial={{ opacity: 0, y: 34 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.26, ease: "easeOut" }}
          className="relative"
        >
          <SearchWidget initial={{ from: airportByIata("OSL") ?? null }} />
        </motion.div>
      </VideoHero>

      {/* stat strip — plasseres under det svevende søkeskjemaet */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-36 sm:px-6 sm:pt-40">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-3 gap-3 border-t hairline pt-6 text-center sm:text-left"
        >
          {[
            { n: "300+", l: "flyselskaper" },
            { n: "< 2 min", l: "fra søk til billett" },
            { n: "06–24", l: "norsk kundeservice" },
          ].map((s) => (
            <div key={s.l}>
              <p className="font-display text-2xl text-primary sm:text-3xl">{s.n}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground sm:text-xs">
                {s.l}
              </p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* ── 4. Recent searches ─────────────────────────────────────── */}
      <RecentSearches />

      {/* ── 5. Destination discovery ───────────────────────────────── */}
      <div className="mt-14 space-y-16 sm:mt-20">
        <DestinationCarousel
          eyebrow="Hjem til dine"
          title="Hjem til familien"
          description="Rutene vi kan best — dit hjertet hører hjemme. Vi kjenner sesongene, mellomlandingene og hva som betyr noe når du reiser hjem."
          destinations={FAMILY_DESTINATIONS}
          viewAllHref="/reisemal"
        />
        <DestinationCarousel
          eyebrow="Utvalgt denne uken"
          title="Populære reisemål"
          description="Fra helgeturer i Europa til storbyer lengre unna — søk direkte fra kortet."
          destinations={POPULAR_DESTINATIONS}
          viewAllHref="/reisemal"
        />
      </div>

      {/* ── Airline marquee ────────────────────────────────────────── */}
      <section className="mt-16 overflow-hidden border-y hairline py-6" aria-label="Flyselskaper vi sammenligner">
        <div className="marquee-track">
          {[...AIRLINES, ...AIRLINES].map((a, i) => (
            <span
              key={i}
              className="mx-6 whitespace-nowrap text-lg font-bold tracking-tight text-muted-foreground/70"
            >
              {a} <span className="ml-6 text-primary/50">✦</span>
            </span>
          ))}
        </div>
      </section>

      {/* ── Signature 3D: route explorer (lazy, pauses off-screen) ─── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="overflow-hidden rounded-3xl bg-night">
          <div className="grid items-center gap-6 p-8 sm:p-12 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-white/60">
                Én verden. Én søkeknapp.
              </p>
              <h2 className="font-display text-3xl leading-tight text-white sm:text-4xl">
                Se hvor langt du kan komme fra Oslo
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70">
                Utforsk rutene våre på globen — fra korte helgeturer i Europa
                til familiereiser over tre kontinenter. Illustrerte ruter,
                ikke sanntidsradar.
              </p>
              <Link
                to="/reisemal"
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition-all hover:brightness-110"
              >
                Utforsk reisemål <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="relative h-[320px] sm:h-[420px]">
              <GlobeSafe className="absolute inset-0 h-full w-full" />
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Why Roamly ──────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-4 sm:px-6">
        <div className="mb-10 max-w-xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Derfor velger folk Roamly
          </p>
          <h2 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">
            Bygget for deg som vil fly uten friksjon
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Clock3,
              title: "Bestill på under to minutter",
              body: "Søk, sammenlign og betal i én sammenhengende flyt — like raskt på mobilen i sofaen som på jobb-PC-en. Billetten lander i innboksen med én gang.",
            },
            {
              icon: HeartHandshake,
              title: "Ekte mennesker, ekte hjelp",
              body: "Vår norske kundeservice svarer alle dager 06–24. Forsinkelse, ombestigning eller bare et spørsmål om bagasje? Du når oss alltid — med navnet ditt og reisen din for hånden.",
            },
            {
              icon: Radar,
              title: "Følg flyet ditt i sanntid",
              body: "Se gate, forsinkelser og hvor flyet befinner seg — for egen reise eller for å hente noen på flyplassen. Roamly holder deg oppdatert fra avgang til landing.",
            },
          ].map((f) => (
            <article
              key={f.title}
              className="card-lift rounded-3xl border border-border bg-card p-7"
            >
              <f.icon className="h-7 w-7 text-primary" strokeWidth={1.8} />
              <h3 className="mt-5 text-xl font-extrabold leading-snug tracking-tight">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── 7. CTA band ────────────────────────────────────────────── */}
      <section className="aurora-band relative mt-16 border-t hairline">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-6">
          <h2 className="max-w-2xl font-display text-4xl leading-tight tracking-tight sm:text-5xl">
            Neste reise begynner med <span className="text-primary">én dato</span>
          </h2>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110"
          >
            Søk etter fly nå <ArrowRight className="h-5 w-5" />
          </a>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
