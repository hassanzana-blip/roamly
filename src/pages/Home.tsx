import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, ArrowUpRight, ChevronRight, Clock3, Globe, LayoutList, Map as MapIcon, ShieldCheck, Tag, TrendingDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import AppShell from "@/components/app/AppShell";
import BelowFold from "@/components/app/BelowFold";
import { GreetingBar } from "@/components/app/TopBar";
import ServiceTabs, { type ServiceId } from "@/components/app/ServiceTabs";
import SearchWidget from "@/components/search/SearchWidget";
import { HotelSearchForm, CarSearchForm } from "@/components/stays/StaySearchForms";
import DiscoverCard from "@/components/home/DiscoverCard";
import DestinationSheet from "@/components/app/DestinationSheet";
import Icon from "@/components/app/Icon";
import CountryFlag from "@/components/brand/CountryFlag";
import SiteFooter from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import ForYou from "@/components/home/ForYou";
import PriceFinder from "@/components/home/PriceFinder";
import ArticleCard from "@/components/journal/ArticleCard";
import { featured } from "@/content/journal";
import { loadRecentSearches, onRecentSearchesChange, recentSearchHref, type RecentSearch } from "@/lib/recentSearches";
import { useT, type I18nKey } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { useCustomer } from "@/lib/useCustomer";
import { useAccountHub, useSavedDestinations } from "@/lib/useAccount";
import { formatDateShort, formatMinor } from "@/lib/format";
import { useRoutePrice, useRoutePrices } from "@/lib/useRoutePrice";
import { airportByIata } from "@contracts/airports";
import { DESTINATIONS, POPULAR_ROUTES, imageSrcSet, spreadAcrossRegions, type DealRoute, type DiscoverDestination, type ThemeId } from "@/content/discover";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";

/**
 * Forsiden (HelloSky 4.0).
 *
 * Et fotografi med spørsmålet øverst, så det hvite kortet med de fire
 * tjenestene og det mintgrønne søkefeltet, «Fortsett søket» når det finnes
 * et, og «Finn feriefølelsen» med ett stort redaksjonelt fotografi. Desktop
 * får det samme kortet bredere, og oppdagelsen som rutenett og kart side om
 * side. Alle priser er ekte «fra»-priser fra prissøket; uten pris sier
 * kortet «Se flypriser». Ingen oppdiktet innhold.
 *
 * Headerfotoet er Lisboa (den gule trikken) – det eneste Lisboa-motivet vi
 * har rettigheter til lokalt; referansens utsikt over Tejo er ikke gjengitt.
 */
const HERO_PHOTO = DESTINATIONS.find((d) => d.id === "lisboa");

import { useMinWidth } from "@/hooks/use-min-width";
const DiscoveryMap = lazy(() => import("@/components/home/DiscoveryMap"));

function inDays(n: number) {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

type ChipId = "sun" | "city" | "family" | "nature" | "far" | "under";
const UNDER_LIMIT = 2000;
const CHIPS: { id: ChipId; label: I18nKey; theme?: ThemeId }[] = [
  { id: "sun", label: "home.chip.sun", theme: "sol" },
  { id: "city", label: "home.chip.city", theme: "storby" },
  { id: "family", label: "home.chip.family", theme: "familie" },
  { id: "nature", label: "home.chip.nature", theme: "natur" },
  { id: "far", label: "home.chip.far", theme: "langtur" },
  { id: "under", label: "home.chip.under" },
];

/** Én rute: by, land og en ekte «fra»-pris når prissøket har en. */
function RouteRow({ deal, onOpen }: { deal: DealRoute; onOpen: (d: DiscoverDestination) => void }) {
  const t = useT();
  const d = deal.destination;
  const price = useRoutePrice(deal.originIata, d.iata);
  return (
    <li>
      <button type="button" onClick={() => onOpen(d)} className="group flex w-full min-w-0 items-center gap-3 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:gap-4 sm:py-4">
        <span className="relative size-14 shrink-0 overflow-hidden rounded-2xl bg-secondary sm:size-16">
          {d.image && <img src={d.image} srcSet={imageSrcSet(d.image)} sizes="64px" alt="" loading="lazy" decoding="async" width={64} height={64} className="h-full w-full object-cover object-[center_62%] transition-transform duration-500 ease-out group-hover:scale-[1.06]" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[18px] font-medium leading-tight">{deal.originCity} → {d.city}</span>
          <span className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <CountryFlag code={airportByIata(d.iata)?.countryCode} size={11} />
            <span className="truncate">{d.country}<span className="hidden sm:inline">{d.tagline ? ` · ${d.tagline}` : ""}</span></span>
          </span>
        </span>
        <span className="min-w-0 shrink text-right">
          {price ? <span className="t-num block whitespace-nowrap text-[16px] font-medium">{price}</span> : <span className="block whitespace-nowrap text-sm text-muted-foreground">{t("home.routes.check")}</span>}
          <span className="t-caption hidden sm:block">{t("home.routes.perperson")}</span>
        </span>
        <span className="hidden size-10 shrink-0 place-items-center rounded-full bg-mint text-petrol transition-colors duration-fast ease-out group-hover:bg-primary group-hover:text-primary-foreground sm:grid">
          <Icon icon={ArrowUpRight} size={20} />
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
    <section className="mt-12">
      <h2 className="t-label mb-3">{t("home.personal.foryou")}</h2>
      <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5 sm:-mx-8 sm:px-8">
        {h.nextTrip && (
          <Link to={`/bekreftelse/${encodeURIComponent(h.nextTrip.orderId)}`} className="press flex min-h-[96px] w-[240px] shrink-0 flex-col justify-between rounded-2xl bg-lavender p-4 transition-colors hover:bg-lavender-deep/60">
            <span className="t-label">{t("home.personal.nexttrip")}</span>
            <span><span className="block truncate text-[16px] font-medium">{h.nextTrip.originCity || h.nextTrip.originIata} → {h.nextTrip.destinationCity || h.nextTrip.destinationIata}</span><span className="block text-[12px] text-muted-foreground">{formatDateShort(h.nextTrip.departingAt)}</span></span>
          </Link>
        )}
        {watch && (
          <Link to="/profil/prisovervaking" className="press card-soft flex min-h-[96px] w-[240px] shrink-0 flex-col justify-between p-4">
            <span className="flex items-center justify-between"><span className="t-label">{t("home.personal.watch")}</span><Icon icon={TrendingDown} size={16} className="text-muted-foreground" /></span>
            <span><span className="block truncate text-[16px] font-medium">{watch.originIata} → {watch.destinationCity}</span><span className="block text-[12px] text-muted-foreground">{res?.live && res.priceMinor ? t("acct.hub.watchfound", { price: formatMinor(res.priceMinor, res.currency ?? "NOK") }) : t("acct.hub.watchchecking")}</span></span>
          </Link>
        )}
        {h.routes.slice(0, 3).map((r) => (
          <Link key={`${r.originIata}-${r.destinationIata}`} to={`/sok?from=${r.originIata}&to=${r.destinationIata}&depart=${inDays(30)}&adults=1&children=0&infants=0&cabin=economy`} className="press card-soft flex min-h-[96px] w-[200px] shrink-0 flex-col justify-between p-4">
            <span className="t-label">{t("home.personal.routes")}</span>
            <span className="flex items-center gap-1.5 text-[16px] font-medium">{r.originCity} <Icon icon={ArrowRight} size={14} className="text-muted-foreground" /> {r.destinationCity}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

const SeeAll = ({ to, label }: { to: string; label: string }) => (
  <Link to={to} className="inline-flex min-h-11 items-center gap-0.5 text-[16px] font-semibold text-azure-ink underline-offset-4 hover:underline sm:min-h-9">
    {label} <Icon icon={ChevronRight} size={20} />
  </Link>
);

/** Søkekortet: fly (uendret logikk), hotell og leiebil – og et ærlig ord om cruise. */
function SearchCard({ product }: { product: ServiceId }) {
  const t = useT();
  const reduce = useReducedMotion();
  return (
    <motion.div
      key={product}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
    >
      {product === "fly" ? (
        <SearchWidget />
      ) : product === "hotell" ? (
        <div className="rounded-2xl bg-mint p-3 sm:p-4"><HotelSearchForm /></div>
      ) : product === "bil" ? (
        <div className="rounded-2xl bg-mint p-3 sm:p-4"><CarSearchForm /></div>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-mint px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[18px] font-bold">{t("cruise.na.title")}</p>
            <p className="mt-1 max-w-lg text-[15px] text-muted-foreground">{t("cruise.na.body")}</p>
          </div>
          <Button asChild className="h-12 rounded-xl">
            <Link to="/cruise">{t("cruise.na.cta")} <ArrowRight className="size-5" aria-hidden="true" /></Link>
          </Button>
        </div>
      )}
    </motion.div>
  );
}

/** «Fortsett søket · Oslo → Lisboa»: the newest real search from this browser. */
function ContinueSearch({ search }: { search: RecentSearch }) {
  const t = useT();
  return (
    <Link to={recentSearchHref(search)} className="flex min-h-[76px] items-center gap-4 rounded-2xl bg-lavender px-5 py-4 text-petrol outline-none transition-colors hover:bg-lavender-deep/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      <Icon icon={Clock3} size={28} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-muted-foreground">{t("home.continue")}</span>
        <span className="mt-0.5 flex items-center gap-2 text-[20px] font-bold leading-tight">
          <span className="truncate">{search.fromLabel}</span>
          <Icon icon={ArrowRight} size={20} className="shrink-0" />
          <span className="truncate">{search.toLabel}</span>
        </span>
      </span>
      <Icon icon={ChevronRight} size={24} className="shrink-0" />
    </Link>
  );
}

function ViewToggle({ view, onChange }: { view: "list" | "map"; onChange: (v: "list" | "map") => void }) {
  const t = useT();
  const opts = [
    { id: "list" as const, label: t("home.view.list"), icon: LayoutList },
    { id: "map" as const, label: t("home.view.map"), icon: MapIcon },
  ];
  return (
    <div role="radiogroup" aria-label={t("home.view.aria")} className="inline-flex shrink-0 rounded-xl border border-border bg-white p-1">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={view === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            view === o.id ? "bg-petrol text-white" : "text-petrol hover:bg-secondary",
          )}
        >
          <Icon icon={o.icon} size={16} /> {o.label}
        </button>
      ))}
    </div>
  );
}

function HowItWorks() {
  const t = useT();
  const steps = [1, 2, 3] as const;
  return (
    <section aria-labelledby="how" className="mt-16 sm:mt-20">
      <h2 id="how" className="t-h2">{t("home.how.title")}</h2>
      <div className="mt-6 grid gap-3 md:grid-cols-3 md:gap-4">
        {steps.map((n) => (
          <div key={n} className="card-soft h-full p-6">
            <span className="grid size-10 place-items-center rounded-full bg-mint text-[15px] font-bold text-petrol">{n}</span>
            <h3 className="mt-4 text-[19px] font-bold">{t(`home.how.${n}.title` as const)}</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{t(`home.how.${n}.body` as const)}</p>
          </div>
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
    <section aria-label={t("home.trust.title")} className="mt-16 sm:mt-24">
      <div className="grid gap-5 border-t border-border pt-8 md:grid-cols-3 md:gap-8">
        {items.map((it) => (
          <div key={it.n} className="flex items-start gap-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-mint text-petrol"><Icon icon={it.icon} size={20} /></span>
            <div>
              <h3 className="text-[16px] font-bold">{t(`home.metatrust.${it.n}.title` as const)}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{t(`home.metatrust.${it.n}.body` as const)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Oppdagelsen: chips, fotokort og kartet med ekte fra-priser. */
function Discovery({ preferIata }: { preferIata?: string }) {
  const t = useT();
  // Skrivebordsdelen (filtre, rutenett, kart) monteres først fra lg: kartet er en 1 MB-chunk som telefonen aldri ser.
  const isDesktop = useMinWidth(1024);
  const { ids: saved, toggle } = useSavedDestinations();
  const [chip, setChip] = useState<ChipId | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [selected, setSelected] = useState<string | null>(null);

  const pool = useMemo(() => DESTINATIONS.filter((d) => d.image && airportByIata(d.iata)), []);
  const { prices, pending } = useRoutePrices(pool.map((d) => d.iata));

  const list = useMemo(() => {
    // Uten filter: det nære utvalget (Europa, Norden, Midtøsten, Nord-Afrika). «Langtur» åpner resten av verden.
    if (!chip) return spreadAcrossRegions(pool.filter((d) => d.region !== "asia" && d.region !== "amerika"), 8);
    const def = CHIPS.find((c) => c.id === chip)!;
    const hit = def.theme ? pool.filter((d) => d.themes.includes(def.theme!)) : pool.filter((d) => (prices[d.iata]?.amount ?? Infinity) < UNDER_LIMIT);
    return spreadAcrossRegions(hit, 10);
  }, [chip, pool, prices]);

  const pins = useMemo(
    () =>
      list.map((d) => {
        const a = airportByIata(d.iata)!;
        return { id: d.id, label: d.city, price: prices[d.iata]?.label ?? null, lat: a.lat, lng: a.lng };
      }),
    [list, prices],
  );

  const pick = (id: string | null) => {
    setSelected(id);
    if (id) document.getElementById(`dest-${id}`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  };

  const waitingForPrices = chip === "under" && list.length === 0 && pending;
  const map = (
    <Suspense fallback={<div className="shimmer h-full w-full rounded-[22px]" aria-hidden="true" />}>
      <DiscoveryMap pins={pins} selected={selected} onSelect={pick} className="h-full w-full" />
    </Suspense>
  );

  // The big photograph: the place from the person's latest search when we have it, otherwise the first pick.
  const featuredDest = (preferIata && pool.find((d) => d.iata === preferIata)) || list[0];

  return (
    <section aria-labelledby="discover" className="mt-8 sm:mt-10">
      {/* Telefon (HelloSky 4.0): overskrift, «Se alle», ett stort redaksjonelt fotografi. */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <h2 id="discover" className="t-h2">{t("home.feel.title")}</h2>
          <SeeAll to="/utforsk" label={t("home.seeall")} />
        </div>
        <div className="mt-3">
          {featuredDest ? (
            <DiscoverCard destination={featuredDest} variant="editorial" saved={saved.has(featuredDest.id)} onToggleSaved={toggle} />
          ) : (
            <div className="shimmer aspect-[2/1] rounded-2xl" aria-hidden="true" />
          )}
        </div>
      </div>

      {/* Desktop: filtre, rutenett og kart side om side. */}
      {isDesktop && (
      <div className="hidden lg:block">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h2 className="t-h2" aria-hidden="true">{t("home.feel.title")}</h2>
            <p className="t-lead mt-1.5">{t("home.next.sub")}</p>
          </div>
          <ViewToggle view={view} onChange={setView} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t("home.chip.aria")}>
          {CHIPS.map((c) => (
            <Chip key={c.id} selected={chip === c.id} onClick={() => setChip(chip === c.id ? null : c.id)} className="h-11 px-4 text-[14px] aria-pressed:border-petrol aria-pressed:bg-petrol aria-pressed:text-white">
              {c.id === "under" ? t("home.chip.under", { amount: `${UNDER_LIMIT.toLocaleString("nb-NO")} kr` }) : t(c.label)}
            </Chip>
          ))}
        </div>

        <div className={cn("mt-5 grid gap-6", view === "list" ? "grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]" : "grid-cols-1")}>
          {view === "list" && (
            <div>
              {waitingForPrices ? (
                <div className="grid grid-cols-2 gap-4" aria-busy="true">
                  {[0, 1, 2, 3].map((i) => <div key={i} className="shimmer aspect-[4/3] rounded-2xl" />)}
                </div>
              ) : list.length === 0 ? (
                <p className="card-soft px-6 py-10 text-center text-sm text-muted-foreground">{t("home.map.empty")}</p>
              ) : (
                <ul className="grid grid-cols-2 gap-x-5 gap-y-6">
                  {list.map((d) => (
                    <li key={d.id} id={`dest-${d.id}`}>
                      <DiscoverCard destination={d} variant="tile" saved={saved.has(d.id)} onToggleSaved={toggle} selected={selected === d.id} onHover={setSelected} />
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-7">
                <SeeAll to="/utforsk" label={t("home.allDest")} />
              </div>
            </div>
          )}

          <div className={cn("relative", view === "list" ? "min-h-[600px]" : "aspect-[16/9]")}>
            <div className={cn("sticky top-20", view === "list" ? "h-[600px]" : "h-full")}>{map}</div>
          </div>
        </div>
      </div>
      )}
    </section>
  );
}

export default function Home() {
  usePageMeta(PAGE_META.home);
  const t = useT();
  const { customer } = useCustomer();
  const status = trpc.flights.status.useQuery(undefined, { staleTime: 300_000, retry: false });
  const [product, setProduct] = useState<ServiceId>("fly");
  const [quickView, setQuickView] = useState<DiscoverDestination | null>(null);
  const [recent, setRecent] = useState<RecentSearch[]>(() => loadRecentSearches());
  useEffect(() => onRecentSearchesChange(() => setRecent(loadRecentSearches())), []);
  const sandbox = status.data?.flightProviders?.kayak.enabled && status.data.flightProviders.kayak.mode === "sandbox" && status.data.flightProviders.active === "kayak";

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Fotografiet med spørsmålet. Telefon: merke + profil i fotoet. Desktop: toppraden ligger i AppShell. */}
      <header className="relative isolate overflow-hidden bg-petrol text-white lg:mt-16">
        {HERO_PHOTO?.image && (
          <img src={HERO_PHOTO.image} srcSet={imageSrcSet(HERO_PHOTO.image)} sizes="100vw" alt="" width={1024} height={640} fetchPriority="high" className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_40%]" />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-petrol/55 via-petrol/20 to-petrol/70" aria-hidden="true" />
        <div className="container-x pb-14 lg:pb-16 lg:pt-14">
          <GreetingBar tone="dark" className="lg:hidden" />
          <h1 className="t-display mt-3 text-white lg:mt-0">{t("home.ask.title")}</h1>
          <p className="mt-1.5 text-[18px] font-medium text-white/90 lg:text-[20px]">{t("home.ask.sub")}</p>
        </div>
      </header>

      <AppShell className="relative -mt-6 rounded-t-[20px] bg-white pt-1 lg:-mt-10 lg:rounded-t-2xl">
        <ServiceTabs active={product} onSelect={setProduct} />
        <div className="mt-4">
          <SearchCard product={product} />
        </div>

        {/* Under søket: det siste ekte søket fra denne nettleseren, og et ærlig ord om testdata. */}
        {recent[0] && (
          <div className="mt-3">
            <ContinueSearch search={recent[0]} />
          </div>
        )}
        {sandbox && <p className="t-caption mt-3">{t("sr.sandbox")}</p>}

        <Discovery preferIata={recent[0]?.to} />

        {customer && <PersonalStrip />}
        {customer && <ForYou />}

        {/*
          Rett under søket: prisjakten som faktisk virker. Kontrollene her
          setter ekte parametere på søket – budsjett, reiselengde, direktefly
          og bagasje – i stedet for å vise tilbud vi ikke har dekning for.
        */}
        <section className="mt-10 sm:mt-12">
          <PriceFinder />
        </section>

        <BelowFold minHeight={2400}>
          <HowItWorks />

          <section aria-labelledby="routes" className="mt-16 sm:mt-24">
            <div className="mb-4 flex items-end justify-between gap-4">
              <h2 id="routes" className="t-h2">{t("home.routes.title")}</h2>
              <SeeAll to="/reisemal" label={t("home.routes.cta")} />
            </div>
            <p className="t-body -mt-2 max-w-xl text-muted-foreground">{t("home.routes.sub")}</p>
            <ul className="mt-6 divide-y divide-border border-y border-border">
              {POPULAR_ROUTES.map((deal) => <RouteRow key={deal.id} deal={deal} onOpen={setQuickView} />)}
            </ul>
            <p className="t-caption mt-3 max-w-xl">{t("home.routes.note")}</p>
          </section>

          <TrustRow />

          <section className="mt-16 sm:mt-24">
            <div className="mb-4 flex items-end justify-between gap-4">
              <h2 className="t-h2">{t("home.journal")}</h2>
              <SeeAll to="/journal" label={t("home.journal.all")} />
            </div>
            <div className="no-scrollbar snap-row -mx-5 flex gap-4 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0">
              {featured().slice(0, 3).map((a) => <ArticleCard key={a.slug} a={a} className="w-[280px] shrink-0 md:w-auto" />)}
            </div>
          </section>

          <section className="mt-16 sm:mt-24">
            <div className="card-soft grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-10">
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
