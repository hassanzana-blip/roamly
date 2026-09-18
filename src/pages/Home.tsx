import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight, ArrowUpRight, BedDouble, CarFront, Clock3, Globe, Plane, ShieldCheck, Tag, TrendingDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import AppShell, { SectionHeader } from "@/components/app/AppShell";
import BelowFold from "@/components/app/BelowFold";
import SearchWidget from "@/components/search/SearchWidget";
import { HotelSearchForm, CarSearchForm } from "@/components/stays/StaySearchForms";
import DestinationSheet from "@/components/app/DestinationSheet";
import Icon from "@/components/app/Icon";
import CountryFlag from "@/components/brand/CountryFlag";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { loadRecentSearches, recentSearchHref, type RecentSearch } from "@/lib/recentSearches";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { useCustomer } from "@/lib/useCustomer";
import { useAccountHub } from "@/lib/useAccount";
import { formatDateShort, formatMinor } from "@/lib/format";
import { useRoutePrice } from "@/lib/useRoutePrice";
import { airportByIata } from "@contracts/airports";
import { POPULAR_ROUTES, imageSrcSet, type DealRoute, type DiscoverDestination } from "@/content/discover";
import { trpc } from "@/providers/trpc";
import ArticleCard from "@/components/journal/ArticleCard";
import ForYou from "@/components/home/ForYou";
import WorldDiscovery from "@/components/home/WorldDiscovery";
import { featured } from "@/content/journal";
import { cn } from "@/lib/utils";

/**
 * Forsiden (HelloSky 2.0).
 *
 * Søket først: en rød hero med produktfanene Fly / Hotell / Leiebil og
 * søkekortet inne i heroen. Under: slik fungerer det (metasøk, ærlig),
 * utforsk reisemål, populære ruter med ekte fra-priser, tillit, journal og
 * prisovervåking. Ingen demokatalog, ingen oppdiktet innhold.
 */

function inDays(n: number) {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

/** Én rute: by, land og en ekte «fra»-pris når prissøket har en. */
function RouteRow({ deal, onOpen }: { deal: DealRoute; onOpen: (d: DiscoverDestination) => void }) {
  const t = useT();
  const d = deal.destination;
  const price = useRoutePrice(deal.originIata, d.iata);
  return (
    <li>
      <button type="button" onClick={() => onOpen(d)} className="group flex w-full min-w-0 items-center gap-3 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:gap-4 sm:py-4">
        <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-secondary sm:size-16">
          {d.image && <img src={d.image} srcSet={imageSrcSet(d.image)} sizes="64px" alt="" loading="lazy" decoding="async" width={64} height={64} className="h-full w-full object-cover object-[center_62%] transition-transform duration-500 ease-out group-hover:scale-[1.06]" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold leading-tight">{deal.originCity} → {d.city}</span>
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
        <span className="hidden size-9 shrink-0 place-items-center rounded-full border border-border text-foreground transition-colors duration-fast ease-out group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground sm:grid">
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
          <Link to={`/bekreftelse/${encodeURIComponent(h.nextTrip.orderId)}`} className="press flex min-h-[96px] w-[240px] shrink-0 flex-col justify-between rounded-2xl bg-primary-soft p-4 transition-colors hover:bg-accent">
            <span className="t-label">{t("home.personal.nexttrip")}</span>
            <span><span className="block truncate text-[16px] font-semibold">{h.nextTrip.originCity || h.nextTrip.originIata} → {h.nextTrip.destinationCity || h.nextTrip.destinationIata}</span><span className="block text-[12px] text-muted-foreground">{formatDateShort(h.nextTrip.departingAt)}</span></span>
          </Link>
        )}
        {watch && (
          <Link to="/profil/prisovervaking" className="press flex min-h-[96px] w-[240px] shrink-0 flex-col justify-between rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/50">
            <span className="flex items-center justify-between"><span className="t-label">{t("home.personal.watch")}</span><Icon icon={TrendingDown} size={16} className="text-muted-foreground" /></span>
            <span><span className="block truncate text-[16px] font-semibold">{watch.originIata} → {watch.destinationCity}</span><span className="block text-[12px] text-muted-foreground">{res?.live && res.priceMinor ? t("acct.hub.watchfound", { price: formatMinor(res.priceMinor, res.currency ?? "NOK") }) : t("acct.hub.watchchecking")}</span></span>
          </Link>
        )}
        {h.routes.slice(0, 3).map((r) => (
          <Link key={`${r.originIata}-${r.destinationIata}`} to={`/sok?from=${r.originIata}&to=${r.destinationIata}&depart=${inDays(30)}&adults=1&children=0&infants=0&cabin=economy`} className="press flex min-h-[96px] w-[200px] shrink-0 flex-col justify-between rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/50">
            <span className="t-label">{t("home.personal.routes")}</span>
            <span className="flex items-center gap-1.5 text-[16px] font-semibold">{r.originCity} <Icon icon={ArrowRight} size={14} className="text-muted-foreground" /> {r.destinationCity}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

const SeeAll = ({ to, label }: { to: string; label: string }) => (
  <Link to={to} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent-foreground underline-offset-4 hover:underline sm:min-h-9">
    {label} <Icon icon={ArrowRight} size={16} />
  </Link>
);

/** Rull-inn-avdekking: seksjoner tones opp og løftes idet de blir synlige. */
function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.23, 1, 0.32, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

type Product = "fly" | "hotell" | "bil";

/** Produktfanene over søkekortet: rødt på lys flate, hvitt over heroen. */
function ProductTabs({ product, onChange }: { product: Product; onChange: (p: Product) => void }) {
  const t = useT();
  const tabs: { id: Product; label: string; icon: typeof Plane }[] = [
    { id: "fly", label: t("nav.flights"), icon: Plane },
    { id: "hotell", label: t("nav.hotels"), icon: BedDouble },
    { id: "bil", label: t("nav.cars"), icon: CarFront },
  ];
  return (
    <div className="inline-flex gap-1 rounded-full bg-white/12 p-1 backdrop-blur-sm" role="tablist" aria-label={t("home.search.fly")}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={product === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-colors sm:px-5",
            product === tab.id ? "bg-white text-accent-foreground shadow-soft" : "text-white/85 hover:bg-white/10 hover:text-white",
          )}
        >
          <Icon icon={tab.icon} size={16} /> {tab.label}
        </button>
      ))}
    </div>
  );
}

/** Søkekortet: fly (uendret logikk), hotell og leiebil i én hvit flate. */
function SearchCard({ product }: { product: Product }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      key={product}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      className="surface-lift scroll-mt-24 rounded-3xl p-4 sm:p-6 lg:p-7"
    >
      {product === "fly" ? <SearchWidget /> : product === "hotell" ? <HotelSearchForm /> : <CarSearchForm />}
    </motion.div>
  );
}

function HowItWorks() {
  const t = useT();
  const steps = [1, 2, 3] as const;
  return (
    <section aria-labelledby="how" className="container-x mt-14 sm:mt-20">
      <Reveal>
        <h2 id="how" className="t-h2">{t("home.how.title")}</h2>
      </Reveal>
      <div className="mt-6 grid gap-3 md:grid-cols-3 md:gap-4">
        {steps.map((n, i) => (
          <Reveal key={n} delay={i * 0.08}>
            <div className="surface h-full p-5">
              <span className="grid size-9 place-items-center rounded-full bg-primary-soft text-sm font-bold text-accent-foreground">{n}</span>
              <h3 className="mt-4 text-[17px] font-semibold">{t(`home.how.${n}.title` as const)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t(`home.how.${n}.body` as const)}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function TrustRow() {
  const t = useT();
  const items = [
    { icon: Tag, n: 1 as const },
    { icon: ShieldCheck, n: 2 as const },
    { icon: Globe, n: 3 as const },
  ];
  return (
    <section aria-label={t("home.trust.title")} className="container-x mt-16 sm:mt-24">
      <div className="grid gap-5 border-t border-border pt-8 md:grid-cols-3 md:gap-8">
        {items.map((it) => (
          <div key={it.n} className="flex items-start gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-accent-foreground"><Icon icon={it.icon} size={20} /></span>
            <div>
              <h3 className="text-[15px] font-semibold">{t(`home.metatrust.${it.n}.title` as const)}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(`home.metatrust.${it.n}.body` as const)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  usePageMeta(PAGE_META.home);
  const t = useT();
  const { customer } = useCustomer();
  const status = trpc.flights.status.useQuery(undefined, { staleTime: 300_000, retry: false });
  const [product, setProduct] = useState<Product>("fly");
  const [quickView, setQuickView] = useState<DiscoverDestination | null>(null);
  const [recent] = useState<RecentSearch[]>(() => loadRecentSearches());
  const sandbox = status.data?.flightProviders?.kayak.enabled && status.data.flightProviders.kayak.mode === "sandbox" && status.data.flightProviders.active === "kayak";

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell bleed>
        {/* 1 · Heroen: rød flate, produktfanene og søket. Ingen foto å kjempe mot. */}
        <section className="hero-red relative isolate overflow-hidden text-white">
          {/* Telefon og tablet: samme header som resten av siden, flytende over heroen. */}
          <div className="lg:hidden"><SiteHeader /></div>
          <div className="container-x relative flex flex-col pb-10 pt-[5.25rem] sm:pb-14 lg:pb-16 lg:pt-28">
            <div className="flex flex-col items-start gap-5 lg:items-center lg:text-center">
              <ProductTabs product={product} onChange={setProduct} />
              <h1 className="t-h1 max-w-3xl text-white lg:t-display">{t("home.meta.h1")}</h1>
              <p className="t-lead max-w-2xl text-white/85">{t("home.meta.sub")}</p>
            </div>
            <div className="mt-7 w-full max-w-5xl self-center sm:mt-9 lg:mt-10">
              <SearchCard product={product} />
            </div>
          </div>
        </section>

        {/* Under heroen: bare det praktiske – siste søk og et ærlig status-ord. */}
        <div className="container-x relative z-10 mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <p className="t-caption">{sandbox ? t("sr.sandbox") : t("footer.meta.trust")}</p>
          {recent.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon icon={Clock3} size={16} /> {t("home.recent")}:</span>
              {recent.slice(0, 3).map((s) => (
                <Link key={`${s.from}-${s.to}-${s.depart}`} to={recentSearchHref(s)} className="press inline-flex min-h-9 items-center rounded-full border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:border-primary/50">{s.fromLabel} → {s.toLabel}</Link>
              ))}
            </div>
          )}
        </div>

        <HowItWorks />

        {customer && <PersonalStrip />}
        {customer && <ForYou />}

        <BelowFold minHeight={3200}>
          {/* Utforsk reisemål: sidens ene interaktive oppdagelse (ekte foto, ekte priser). */}
          <WorldDiscovery />

          <section aria-labelledby="routes" className="container-x mt-16 sm:mt-24">
            <SectionHeader title={t("home.routes.title")} action={<SeeAll to="/reisemal" label={t("home.routes.cta")} />} />
            <p className="t-body -mt-2 max-w-xl text-muted-foreground">{t("home.routes.sub")}</p>
            <ul className="mt-6 divide-y divide-border border-y border-border">
              {POPULAR_ROUTES.map((deal) => <RouteRow key={deal.id} deal={deal} onOpen={setQuickView} />)}
            </ul>
            <p className="t-caption mt-3 max-w-xl">{t("home.routes.note")}</p>
          </section>

          <TrustRow />

          <section className="container-x mt-16 sm:mt-24">
            <SectionHeader title={t("home.journal")} action={<SeeAll to="/journal" label={t("home.journal.all")} />} />
            <div className="no-scrollbar snap-row -mx-5 flex gap-4 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0">
              {featured().slice(0, 3).map((a) => <ArticleCard key={a.slug} a={a} className="w-[280px] shrink-0 md:w-auto" />)}
            </div>
          </section>

          <section className="container-x mt-16 sm:mt-24">
            <div className="surface grid gap-6 rounded-3xl p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-10">
              <div>
                <h2 className="t-h2">{t("home.watch.title")}</h2>
                <p className="t-body mt-3 max-w-lg text-muted-foreground">{t("home.watch.body")}</p>
              </div>
              <Button asChild size="lg" className="rounded-full">
                <Link to={customer ? "/profil/prisovervaking" : "/logg-inn?next=/profil/prisovervaking"}>
                  <Icon icon={TrendingDown} size={20} /> {t("home.watch.cta")}
                </Link>
              </Button>
            </div>
          </section>
        </BelowFold>
      </AppShell>

      <div className="mt-16 sm:mt-24"><SiteFooter /></div>
      <DestinationSheet destination={quickView} onClose={() => setQuickView(null)} />
    </div>
  );
}
