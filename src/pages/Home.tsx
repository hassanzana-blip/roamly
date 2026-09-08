import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight, ArrowUpRight, Clock3, Receipt, TrendingDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import AppShell, { SectionHeader } from "@/components/app/AppShell";
import BelowFold from "@/components/app/BelowFold";
import { GreetingBar } from "@/components/app/TopBar";
import SearchWidget from "@/components/search/SearchWidget";
import DestinationSheet from "@/components/app/DestinationSheet";
import Icon from "@/components/app/Icon";
import CountryFlag from "@/components/brand/CountryFlag";
import SiteFooter from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { BaggageVisual, FamilyGlyph } from "@/components/graphics";
import { loadRecentSearches, recentSearchHref, type RecentSearch } from "@/lib/recentSearches";
import { useT, type I18nKey } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { useCustomer } from "@/lib/useCustomer";
import { useAccountHub } from "@/lib/useAccount";
import { formatDateShort, formatMinor } from "@/lib/format";
import { useRoutePrice } from "@/lib/useRoutePrice";
import { airportByIata } from "@contracts/airports";
import { DEAL_ROUTES, POPULAR_DESTINATIONS, imageSrcSet, type DealRoute, type DiscoverDestination } from "@/content/discover";
import { WHATSAPP_DISPLAY, WHATSAPP_LINK, WhatsAppIcon } from "@/components/WhatsAppFab";
import { trpc } from "@/providers/trpc";
import ArticleCard from "@/components/journal/ArticleCard";
import ForYou from "@/components/home/ForYou";
import { featured } from "@/content/journal";
import { cn } from "@/lib/utils";

/**
 * Forsiden. Én reise nedover siden, sju stopp, ingen fyllseksjoner:
 *   1 foto + tittel + søket           «jeg vet hvor jeg skal»
 *   2 ditt (kun innlogget)            «jeg har allerede noe her»
 *   3 rutene hjem, med ekte priser    «dere kjenner reisen min»
 *   4 derfor reiser familier med oss  fakta, ikke merker
 *   5 fire dører etter anledning      «hjelp meg å velge»
 *   6 journalen                       det vi faktisk vet
 *   7 prisovervåking                  «jeg vet hvor, men ikke når»
 * Hotell og leiebil er forespørsler, ikke søk, og bor derfor i én linje under søket.
 */

const OCCASIONS: { id: string; to: string; label: I18nKey; sub: I18nKey; photo: string }[] = [
  { id: "sun", to: "/utforsk?k=sol", label: "home.occ.sun", sub: "home.occ.sunsub", photo: "malaga" },
  { id: "family", to: "/utforsk?k=familie", label: "home.occ.family", sub: "home.occ.familysub", photo: "dubai" },
  { id: "weekend", to: "/utforsk?k=helg", label: "home.occ.weekend", sub: "home.occ.weekendsub", photo: "london" },
  { id: "culture", to: "/utforsk?k=kultur", label: "home.occ.culture", sub: "home.occ.culturesub", photo: "rome" },
];

const ALT: Record<string, string> = Object.fromEntries(POPULAR_DESTINATIONS.map((d) => [d.id, d.imageAlt]));

function inDays(n: number) {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

/** Ordvis inntoning av tittelen: forsidens ene bevegelsesøyeblikk. */
function Words({ text, from = 0 }: { text: string; from?: number }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span key={`${w}-${i}`}>
          {i > 0 ? " " : null}
          <span className="wr">
            <span className="wr-i" style={{ ["--wr-delay" as string]: `${(from + i) * 70}ms` }}>{w}</span>
          </span>
        </span>
      ))}
    </>
  );
}

/** Én rute hjem: by, land og en ekte «fra»-pris når prissøket har en. */
function RouteRow({ deal, onOpen }: { deal: DealRoute; onOpen: (d: DiscoverDestination) => void }) {
  const t = useT();
  const d = deal.destination;
  const price = useRoutePrice(deal.originIata, d.iata);
  return (
    <li>
      <button type="button" onClick={() => onOpen(d)} className="group flex w-full min-w-0 items-center gap-3 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:gap-4 sm:py-4">
        <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-night sm:size-16">
          {d.image && <img src={d.image} srcSet={imageSrcSet(d.image)} sizes="64px" alt="" loading="lazy" decoding="async" width={64} height={64} className="h-full w-full object-cover object-[center_62%] transition-transform duration-500 ease-out group-hover:scale-[1.06]" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold leading-tight">{deal.originCity} → {d.city}</span>
          {/* Flagget er orientering: hvilket land denne ruten faktisk går til.
              Slagordet er pynt, og forsvinner der plassen er knapp. */}
          <span className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <CountryFlag code={airportByIata(d.iata)?.countryCode} size={11} />
            <span className="truncate">{d.country}<span className="hidden sm:inline">{d.tagline ? ` · ${d.tagline}` : ""}</span></span>
          </span>
        </span>
        <span className="min-w-0 shrink text-right">
          {price ? (
            <span className="t-num block whitespace-nowrap text-[15px] font-semibold">{price}</span>
          ) : (
            <span className="block whitespace-nowrap text-sm text-muted-foreground">{t("home.routes.check")}</span>
          )}
          <span className="t-caption hidden sm:block">{t("home.routes.perperson")}</span>
        </span>
        <span className="hidden size-9 shrink-0 place-items-center rounded-full border border-border text-foreground transition-colors duration-fast ease-out group-hover:border-foreground group-hover:bg-foreground group-hover:text-background sm:grid">
          <Icon icon={ArrowUpRight} size={16} />
        </span>
      </button>
    </li>
  );
}

/** Innlogget: det som er ditt, og bare hvis det finnes. */
function PersonalStrip() {
  const t = useT();
  const hub = useAccountHub();
  const h = hub.data;
  if (!h) return null;
  const watch = h.watches[0];
  const res = watch?.lastResult as { priceMinor?: number; currency?: string; live?: boolean } | null | undefined;
  if (!h.nextTrip && !watch && h.routes.length === 0) return null;
  return (
    <section className="container-x mt-12">
      <h2 className="t-label mb-3">{t("home.personal.foryou")}</h2>
      <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5 sm:-mx-8 sm:px-8">
        {h.nextTrip && (
          <Link to={`/bekreftelse/${encodeURIComponent(h.nextTrip.orderId)}`} className="press flex min-h-[96px] w-[240px] shrink-0 flex-col justify-between rounded-xl bg-primary-soft p-4 transition-colors hover:bg-primary/30">
            <span className="t-label">{t("home.personal.nexttrip")}</span>
            <span><span className="block truncate text-[16px] font-semibold">{h.nextTrip.originCity || h.nextTrip.originIata} → {h.nextTrip.destinationCity || h.nextTrip.destinationIata}</span><span className="block text-[12px] text-muted-foreground">{formatDateShort(h.nextTrip.departingAt)}</span></span>
          </Link>
        )}
        {watch && (
          <Link to="/profil/prisovervaking" className="press flex min-h-[96px] w-[240px] shrink-0 flex-col justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/25">
            <span className="flex items-center justify-between"><span className="t-label">{t("home.personal.watch")}</span><Icon icon={TrendingDown} size={16} className="text-muted-foreground" /></span>
            <span><span className="block truncate text-[16px] font-semibold">{watch.originIata} → {watch.destinationCity}</span><span className="block text-[12px] text-muted-foreground">{res?.live && res.priceMinor ? t("acct.hub.watchfound", { price: formatMinor(res.priceMinor, res.currency ?? "NOK") }) : t("acct.hub.watchchecking")}</span></span>
          </Link>
        )}
        {h.routes.slice(0, 3).map((r) => (
          <Link key={`${r.originIata}-${r.destinationIata}`} to={`/sok?from=${r.originIata}&to=${r.destinationIata}&depart=${inDays(30)}&adults=1&children=0&infants=0&cabin=economy`} className="press flex min-h-[96px] w-[200px] shrink-0 flex-col justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/25">
            <span className="t-label">{t("home.personal.routes")}</span>
            <span className="flex items-center gap-1.5 text-[16px] font-semibold">{r.originCity} <Icon icon={ArrowRight} size={14} className="text-muted-foreground" /> {r.destinationCity}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

const SeeAll = ({ to, label }: { to: string; label: string }) => (
  <Link to={to} className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-foreground underline-offset-4 hover:underline">
    {label} <Icon icon={ArrowRight} size={16} />
  </Link>
);

function Why({ glyph, title, body }: { glyph: ReactNode; title: string; body: string }) {
  return (
    // På telefon står glyfen ved siden av teksten; tre stablede sirkler med
    // avsnitt under er en tekstvegg. Fra md får hver sin egen spalte.
    <div className="flex items-start gap-4 md:block">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-foreground md:size-12">{glyph}</span>
      <div className="min-w-0 md:mt-5">
        <h3 className="t-h3">{title}</h3>
        <p className="t-body mt-1.5 max-w-sm text-muted-foreground md:mt-2">{body}</p>
      </div>
    </div>
  );
}

export default function Home() {
  usePageMeta(PAGE_META.home);
  const t = useT();
  const reduce = useReducedMotion();
  const { customer } = useCustomer();
  const rewards = trpc.account.rewardsPublic.useQuery(undefined, { staleTime: 600_000, retry: false });
  const status = trpc.flights.status.useQuery(undefined, { staleTime: 300_000, retry: false });
  const [quickView, setQuickView] = useState<DiscoverDestination | null>(null);
  const [recent] = useState<RecentSearch[]>(() => loadRecentSearches());

  const rw = rewards.data;
  const h1a = t("home.h1a");
  const h1b = t("home.h1b");

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell bleed>
        {/* 1 · Åpningen: ett ekte foto, én setning, søket over fotokanten. */}
        <section className="relative isolate overflow-hidden bg-night text-white">
          <img
            src="/photos/hero-wing-1280.jpg"
            srcSet="/photos/hero-wing-800.jpg 800w, /photos/hero-wing-1280.jpg 1280w, /photos/hero-wing.jpg 2400w"
            sizes="100vw"
            alt={t("home.hero.photo")}
            width={2400}
            height={1603}
            fetchPriority="high"
            decoding="async"
            className={cn("absolute inset-0 h-full w-full object-cover object-[62%_45%]", !reduce && "ken-burns")}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-night/60 via-night/20 to-night/75" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-night/50 via-night/10 to-transparent" aria-hidden="true" />
          <div className="container-x relative flex min-h-[560px] flex-col sm:min-h-[600px] lg:min-h-[680px] lg:pt-16">
            <div className="lg:hidden"><GreetingBar tone="dark" /></div>
            <div className="mt-auto pb-28 sm:pb-36 lg:pb-44">
              <h1 className="t-display max-w-4xl">
                <Words text={h1a} />
                <span className="t-em block text-white/95"><Words text={h1b} from={h1a.split(" ").length} /></span>
              </h1>
              <p className="fade-up fade-up-4 t-lead mt-5 max-w-xl text-white/85">{t("home.sub2")}</p>
            </div>
          </div>
        </section>

        {/* Søkekortet: løftet, ikke rammet. Ligger over fotokanten. Bare fly: hotell og bil er forespørsler. */}
        <div className="container-x relative z-10 -mt-20 sm:-mt-28 lg:-mt-32">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="surface-lift scroll-mt-24 p-4 sm:p-6 lg:p-7"
          >
            <SearchWidget />
          </motion.div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            {/* Én tillitslinje, kun fakta: betalingspåstanden vises bare når Stripe faktisk er satt opp. */}
            <p className="t-caption">{status.data?.paymentsConfigured ? t("home.trust") : t("home.trust.nopay")}</p>
            <p className="t-caption">
              {t("home.hotelcar")}{" "}
              <Link to="/hotell-bil" className="font-semibold text-foreground underline underline-offset-4">{t("home.hotelcar.cta")}</Link>
            </p>
          </div>
          {recent.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon icon={Clock3} size={16} /> {t("home.recent")}:</span>
              {recent.slice(0, 3).map((s) => (
                <Link key={`${s.from}-${s.to}-${s.depart}`} to={recentSearchHref(s)} className="press inline-flex min-h-9 items-center rounded-lg border border-border bg-card px-3 text-sm font-medium transition-colors hover:border-foreground/30">{s.fromLabel} → {s.toLabel}</Link>
              ))}
            </div>
          )}
        </div>

        {/* 2 · Ditt: kun innlogget, kun med data. */}
        {customer && <PersonalStrip />}
        {customer && <ForYou />}

        {/* Alt under folden gjengis når hovedtråden er ledig. Første
            skjermbilde skal ikke vente på seks prisoppslag, fire fotokort og
            tre artikler – ingenting av det er synlig ennå. */}
        <BelowFold minHeight={3200}>
          {/* 3 · Rutene hjem: fotoet, setningen og seks ruter med ekte fra-priser. Forsidens tyngdepunkt. */}
          <section className="container-x mt-20 sm:mt-28">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:gap-16">
            <Link to="/reisemal#hjem" className="group relative block aspect-[4/3] overflow-hidden rounded-2xl bg-night lg:aspect-[4/5]">
              <img src="/destinations/istanbul.jpg" srcSet="/destinations/istanbul-640.jpg 640w, /destinations/istanbul.jpg 1024w" sizes="(max-width: 1024px) 100vw, 45vw" alt="Galatatårnet over Istanbuls tak" loading="lazy" decoding="async" width={1024} height={640} className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.03]" />
              <span className="photo-wash absolute inset-0" aria-hidden="true" />
              <span className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 text-white sm:p-6">
                <span>
                  <span className="block text-[13px] text-white/75">{t("home.routes.caption")}</span>
                  <span className="block text-[20px] font-semibold leading-tight">Istanbul</span>
                </span>
                <span className="grid size-10 place-items-center rounded-full bg-white/15 backdrop-blur-sm transition-colors group-hover:bg-white/25"><Icon icon={ArrowUpRight} size={20} /></span>
              </span>
            </Link>
            <div className="min-w-0">
              <h2 className="t-h1">{t("home.hero.title")}</h2>
              <p className="t-lead mt-4 max-w-xl text-muted-foreground">{t("home.hero.body")}</p>
              <ul className="mt-8 divide-y divide-border border-y border-border">
                {DEAL_ROUTES.map((deal) => <RouteRow key={deal.id} deal={deal} onOpen={setQuickView} />)}
              </ul>
              <p className="t-caption mt-3 max-w-xl">{t("home.routes.note")}</p>
              <Button asChild variant="dark" size="lg" className="mt-6">
                <Link to="/reisemal#hjem">{t("home.routes.cta")} <Icon icon={ArrowRight} size={20} /></Link>
              </Button>
            </div>
          </div>
          </section>

          {/* 4 · Derfor: tre fakta, ingen kort, ingen merker. */}
          <section className="container-x mt-20 sm:mt-28">
            <h2 className="t-h1 max-w-2xl">{t("home.why.title")}</h2>
            <div className="mt-8 grid gap-6 border-t border-border pt-8 md:grid-cols-3 md:gap-10 md:pt-10">
              <Why glyph={<Icon icon={Receipt} size={24} />} title={t("home.why.1.title")} body={t("home.why.1.body")} />
              <Why glyph={<BaggageVisual kind="checked" count={2} size={26} label={t("home.why.2.title")} />} title={t("home.why.2.title")} body={t("home.why.2.body")} />
              <Why glyph={<FamilyGlyph size={26} />} title={t("home.why.3.title")} body={t("home.why.3.body")} />
            </div>
            <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              {rw ? (
                <p className="t-body max-w-2xl text-muted-foreground">{t("home.rewards.body", { pct: Math.round(rw.earnFraction * 1000) / 10, kr: rw.referrerKr })}</p>
              ) : (
                <p className="t-body max-w-2xl text-muted-foreground">{t("home.help.body")}</p>
              )}
              <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="press inline-flex min-h-11 w-fit items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold transition-colors hover:border-foreground/30">
                <WhatsAppIcon className="h-4 w-4" /> WhatsApp {WHATSAPP_DISPLAY}
              </a>
            </div>
          </section>

          {/* 5 · Fire dører etter anledning. Den du peker på trer fram, resten trer tilbake. */}
          <section className="container-x mt-20 sm:mt-28">
            <SectionHeader title={t("home.occasions")} action={<SeeAll to="/utforsk" label={t("home.seeall")} />} />
            <ul className="group/occ grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {OCCASIONS.map((o) => (
                <li key={o.id} className="min-w-0">
                  <Link
                    to={o.to}
                    className="press group/door relative block aspect-[4/5] w-full overflow-hidden rounded-2xl bg-night text-white outline-none transition-opacity duration-slow ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:aspect-[3/4] md:group-hover/occ:opacity-70 md:hover:!opacity-100 md:focus-visible:!opacity-100"
                  >
                    <img src={`/destinations/${o.photo}.jpg`} srcSet={imageSrcSet(`/destinations/${o.photo}.jpg`)} sizes="(max-width: 768px) 50vw, 25vw" alt={ALT[o.photo] ?? ""} loading="lazy" decoding="async" width={1024} height={640} className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover/door:scale-[1.04]" />
                    <span className="photo-wash absolute inset-0" aria-hidden="true" />
                    <span className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                      <span className="block text-[18px] font-semibold leading-tight md:text-[20px]">{t(o.label)}</span>
                      <span className="mt-1 block text-[13px] text-white/80">{t(o.sub)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* 6 · Journalen: tre artikler, håndplukket. */}
          <section className="container-x mt-20 sm:mt-28">
            <SectionHeader title={t("home.journal")} action={<SeeAll to="/journal" label={t("home.journal.all")} />} />
            <div className="no-scrollbar snap-row -mx-5 flex gap-4 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0">
              {featured().slice(0, 3).map((a) => <ArticleCard key={a.slug} a={a} className="w-[280px] shrink-0 md:w-auto" />)}
            </div>
          </section>

          {/* 7 · Prisovervåking: lys flate, mørk handling. */}
          <section className="container-x mt-20 sm:mt-28">
            <div className="surface grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-10">
              <div>
                <h2 className="t-h2">{t("home.watch.title")}</h2>
                <p className="t-body mt-3 max-w-lg text-muted-foreground">{t("home.watch.body")}</p>
              </div>
              <Button asChild variant="dark" size="lg">
                <Link to={customer ? "/profil/prisovervaking" : "/logg-inn?next=/profil/prisovervaking"}>
                  <Icon icon={TrendingDown} size={20} /> {t("home.watch.cta")}
                </Link>
              </Button>
            </div>
          </section>
        </BelowFold>

      </AppShell>

      <div className="mt-20 sm:mt-28"><SiteFooter /></div>
      <DestinationSheet destination={quickView} onClose={() => setQuickView(null)} />
    </div>
  );
}
