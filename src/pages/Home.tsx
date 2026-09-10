import { useRef, useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, ArrowUpRight, BedDouble, CarFront, Clock3, Heart, Plane, Receipt, ShieldCheck, Ship, Tag, TrendingDown } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
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
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { useCustomer } from "@/lib/useCustomer";
import { useAccountHub } from "@/lib/useAccount";
import { formatDateShort, formatMinor } from "@/lib/format";
import { useRoutePrice } from "@/lib/useRoutePrice";
import { airportByIata } from "@contracts/airports";
import { HOMECOMING_ROUTES, POPULAR_ROUTES, imageSrcSet, type DealRoute, type DiscoverDestination } from "@/content/discover";
import { WHATSAPP_DISPLAY, WHATSAPP_LINK, WhatsAppIcon } from "@/components/WhatsAppFab";
import { trpc } from "@/providers/trpc";
import ArticleCard from "@/components/journal/ArticleCard";
import ForYou from "@/components/home/ForYou";
import WorldDiscovery from "@/components/home/WorldDiscovery";
import { featured } from "@/content/journal";
import { cn } from "@/lib/utils";

/**
 * Forsiden.
 *
 * HelloSky selger hele verden fra Norge. Siden er derfor bygget rundt det
 * spørsmålet – ikke rundt én region – og veksler mellom formater i stedet
 * for å stable like kortrader:
 *   1 foto + tittel + søket        «hvor skal du?»
 *   2 mer enn fly                  cruise, hotell og leiebil som kinematisk inngang
 *   3 ditt (kun innlogget)         «jeg har allerede noe her»
 *   4 verden etter tema            én interaktiv seksjon, ikke elleve rader
 *   5 populære ruter, ekte priser  data, ikke bilder
 *   6 cruise                       seilinger fra katalogen, veiledende priser
 *   7 rutene vi kjenner best       hjemreisene som én historie, ikke merkevaren
 *   8 derfor HelloSky              tre fakta, ingen merker
 *   9 journalen                    det vi faktisk vet
 *  10 prisovervåking               «jeg vet hvor, men ikke når»
 */

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
  <Link to={to} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-foreground underline-offset-4 hover:underline sm:min-h-9">
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

/** Rull-inn-avdekking: seksjoner tones opp og løftes idet de blir synlige. */
function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.7, delay, ease: [0.23, 1, 0.32, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Bilde som tones inn idet det er dekodet – aldri et tomt hvitt felt. */
function RevealImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      {...props}
      data-loaded={loaded || undefined}
      onLoad={(e) => { setLoaded(true); props.onLoad?.(e); }}
      className={cn("img-reveal", props.className)}
    />
  );
}

type Product = "fly" | "hotell" | "cruise" | "bil";

/**
 * Søkekortet: flysøket er uendret – fanene over bytter produkt. Hotell,
 * cruise og leiebil har sine egne lette skjemaer som leder til katalogene
 * på /overnatting-bil. Én overflate, fire måter å starte reisen på.
 */
function SearchCard() {
  const t = useT();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [product, setProduct] = useState<Product>("fly");
  const [sted, setSted] = useState("");
  const [fra, setFra] = useState(inDays(35));
  const [til, setTil] = useState(inDays(42));
  const [antall, setAntall] = useState("2");

  const tabs: { id: Product; label: string; icon: typeof Plane }[] = [
    { id: "fly", label: t("home.search.fly"), icon: Plane },
    { id: "hotell", label: t("home.search.hotell"), icon: BedDouble },
    { id: "cruise", label: t("home.search.cruise"), icon: Ship },
    { id: "bil", label: t("home.search.bil"), icon: CarFront },
  ];

  const needsPlace = product === "hotell" || product === "bil";
  const canGo = !needsPlace || sted.trim().length >= 2;
  const go = () => {
    if (!canGo) return;
    const q = new URLSearchParams({ type: product, fra });
    if (needsPlace) q.set("sted", sted.trim());
    if (product !== "cruise") q.set("til", til);
    if (product !== "bil") q.set("antall", antall);
    navigate(`/overnatting-bil?${q.toString()}`);
  };

  const inputCls =
    "min-h-12 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary";
  const labelCls = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground";

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className="surface-lift scroll-mt-24 p-4 sm:p-6 lg:p-7"
    >
      <div className="no-scrollbar -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="tablist" aria-label={t("home.search.fly")}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={product === tab.id}
            onClick={() => setProduct(tab.id)}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors",
              product === tab.id ? "bg-night text-white" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon icon={tab.icon} size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {product === "fly" ? (
        <SearchWidget />
      ) : (
        <motion.div
          key={product}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {needsPlace && (
              <label className="block">
                <span className={labelCls}>{t("home.search.place")}</span>
                <input
                  value={sted}
                  onChange={(e) => setSted(e.target.value)}
                  placeholder={t("home.search.place.ph")}
                  className={inputCls}
                />
              </label>
            )}
            <label className="block">
              <span className={labelCls}>
                {product === "hotell" ? t("home.search.checkin") : product === "cruise" ? t("home.search.depart") : t("home.search.pickup")}
              </span>
              <input type="date" value={fra} onChange={(e) => setFra(e.target.value)} className={inputCls} />
            </label>
            {product !== "cruise" && (
              <label className="block">
                <span className={labelCls}>{product === "hotell" ? t("home.search.checkout") : t("home.search.dropoff")}</span>
                <input type="date" value={til} min={fra} onChange={(e) => setTil(e.target.value)} className={inputCls} />
              </label>
            )}
            {product !== "bil" && (
              <label className="block">
                <span className={labelCls}>{t("home.search.guests")}</span>
                <select value={antall} onChange={(e) => setAntall(e.target.value)} className={inputCls}>
                  {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            )}
            <div className="flex items-end">
              <Button
                type="button"
                size="lg"
                disabled={!canGo}
                onClick={go}
                className="min-h-12 w-full rounded-xl text-sm font-bold"
              >
                {product === "hotell" ? t("home.search.go.hotell") : product === "cruise" ? t("home.search.go.cruise") : t("home.search.go.bil")}
                <Icon icon={ArrowRight} size={16} />
              </Button>
            </div>
          </div>
          <p className="t-caption mt-3">{t("home.search.note")}</p>
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * 2 · Mer enn fly: cruise, hotell og leiebil som tre kinematisk innganger.
 * Én stor og to små – rutenettet veksler, kortene bæres av ekte fotografier.
 * Ingen priser her: dette er innganger til katalogene, ikke tilbud.
 */
function MoreThanFlights() {
  const t = useT();
  const depart = inDays(35);
  const back = inDays(42);
  const cards = [
    {
      key: "cruise",
      icon: Ship,
      img: "/photos/cruise-hero.jpg",
      to: `/overnatting-bil?type=cruise&fra=${depart}&antall=2`,
      title: t("home.more.cruise.title"),
      body: t("home.more.cruise.body"),
      cta: t("home.more.cruise.cta"),
    },
    {
      key: "hotel",
      icon: BedDouble,
      img: "/photos/hotel-villa.jpg",
      to: `/overnatting-bil?type=hotell&sted=Barcelona&fra=${depart}&til=${back}&antall=2`,
      title: t("home.more.hotel.title"),
      body: t("home.more.hotel.body"),
      cta: t("home.more.hotel.cta"),
    },
    {
      key: "car",
      icon: CarFront,
      img: "/photos/car-roadtrip.jpg",
      to: `/overnatting-bil?type=bil&sted=Oslo lufthavn&fra=${depart}&til=${back}`,
      title: t("home.more.car.title"),
      body: t("home.more.car.body"),
      cta: t("home.more.car.cta"),
    },
  ];
  return (
    <section aria-labelledby="more-than-flights" className="container-x mt-16 sm:mt-24">
      <Reveal>
        <p className="font-mono-label text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{t("home.more.kicker")}</p>
        <h2 id="more-than-flights" className="t-h1 mt-2 max-w-2xl">{t("home.more.title")}</h2>
        <p className="t-lead mt-3 max-w-xl text-muted-foreground">{t("home.more.sub")}</p>
      </Reveal>
      <div className="mt-8 grid gap-4 sm:gap-5 lg:grid-cols-2">
        {cards.map((c, i) => (
          <Reveal key={c.key} delay={i * 0.09} className={i === 0 ? "lg:row-span-2" : undefined}>
            <Link
              to={c.to}
              className={cn(
                "media-zoom card-shine group relative block overflow-hidden rounded-2xl bg-night text-white shadow-lift outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                i === 0 ? "h-[420px] sm:h-[480px] lg:h-full lg:min-h-[560px]" : "h-[280px] sm:h-[300px] lg:h-[268px]",
              )}
            >
              <RevealImage
                src={c.img.replace(".jpg", "-640.jpg")}
                srcSet={`${c.img.replace(".jpg", "-640.jpg")} 640w, ${c.img} 1024w`}
                sizes={i === 0 ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 50vw, 100vw"}
                alt=""
                loading="lazy"
                decoding="async"
                className="media-zoom-img absolute inset-0 h-full w-full object-cover"
              />
              <div className="photo-wash absolute inset-0" aria-hidden="true" />
              <div className="relative flex h-full flex-col justify-end p-6 sm:p-7">
                <span className="glass-dark mb-auto inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]">
                  <Icon icon={c.icon} size={14} /> {c.key === "cruise" ? "Cruise" : c.key === "hotel" ? "Hotell" : "Leiebil"}
                </span>
                <h3 className={cn("font-display text-white", i === 0 ? "text-3xl sm:text-4xl" : "text-2xl sm:text-[28px]")}>{c.title}</h3>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/85">{c.body}</p>
                <span className="mt-4 inline-flex w-fit items-center gap-2 text-sm font-semibold text-white">
                  <span className="border-b border-white/40 pb-0.5 transition-colors group-hover:border-white">{c.cta}</span>
                  <span className="grid size-8 place-items-center rounded-full bg-white text-night transition-transform duration-300 ease-out group-hover:translate-x-1">
                    <Icon icon={ArrowRight} size={16} />
                  </span>
                </span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/**
 * 6 · Cruise: seilinger fra demokatalogen, med veiledende priser og tydelig
 * merking. Mørk full-bleed-seksjon – kontrasten mot de lyse listene rundt.
 */
function CruiseShowcase() {
  const t = useT();
  const depart = inDays(35);
  const cruises = trpc.partners.searchCruises.useQuery(
    { depart, guests: 2 },
    { staleTime: 600_000, retry: false },
  );
  const top = cruises.data?.results.slice(0, 3) ?? [];
  return (
    <section aria-labelledby="cruise" className="relative isolate mt-20 overflow-hidden bg-night text-white sm:mt-28">
      <RevealImage
        src="/photos/cruise-sunset-640.jpg"
        srcSet="/photos/cruise-sunset-640.jpg 640w, /photos/cruise-sunset.jpg 1024w"
        sizes="100vw"
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover opacity-45"
      />
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{ backgroundImage: "linear-gradient(to right, hsl(var(--night)) 20%, hsl(var(--night) / 0.72) 55%, hsl(var(--night) / 0.25) 100%)" }}
      />
      <div className="container-x relative py-16 sm:py-20">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono-label text-[10px] uppercase tracking-[0.18em] text-white/70">{t("home.cruise.kicker")}</p>
              <h2 id="cruise" className="t-h1 mt-2 max-w-xl text-white">{t("home.cruise.title")}</h2>
              <p className="t-lead mt-3 max-w-lg text-white/80">{t("home.cruise.sub")}</p>
            </div>
            <Link
              to={`/overnatting-bil?type=cruise&fra=${depart}&antall=2`}
              className="press inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.02]"
            >
              {t("home.cruise.cta")} <Icon icon={ArrowRight} size={16} />
            </Link>
          </div>
        </Reveal>

        <div className="no-scrollbar snap-row -mx-5 mt-9 flex gap-4 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-5 lg:overflow-visible lg:px-0">
          {cruises.isLoading &&
            [0, 1, 2].map((i) => (
              <div key={i} className="shimmer h-[360px] w-[300px] shrink-0 rounded-2xl lg:w-auto" aria-hidden="true" />
            ))}
          {top.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.09} className="w-[300px] shrink-0 lg:w-auto">
              <Link
                to={`/overnatting-bil?type=cruise&fra=${depart}&antall=2`}
                className="media-zoom group block overflow-hidden rounded-2xl border border-white/12 bg-white/[0.06] backdrop-blur-sm transition-colors hover:border-white/25"
              >
                <div className="relative h-44 overflow-hidden">
                  <RevealImage
                    src={c.image.replace(".jpg", "-640.jpg")}
                    srcSet={`${c.image.replace(".jpg", "-640.jpg")} 640w, ${c.image} 1024w`}
                    sizes="(min-width: 1024px) 33vw, 300px"
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="media-zoom-img h-full w-full object-cover"
                  />
                  <span className="glass-dark absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold">
                    {c.nights} {t("home.cruise.nights")}
                  </span>
                </div>
                <div className="p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">{c.line}</p>
                  <h3 className="mt-1 text-lg font-semibold leading-snug text-white">{c.ship}</h3>
                  <p className="mt-1 text-[13px] text-white/70">
                    {c.region} · {t("home.cruise.fromport")} {c.departurePort} · {formatDateShort(c.departureDate)}
                  </p>
                  <div className="mt-4 flex items-baseline justify-between border-t border-white/12 pt-4">
                    <span>
                      <span className="t-num block text-xl font-bold text-white">{formatMinor(c.pricePerPerson * 100, "NOK")}</span>
                      <span className="text-[11px] text-white/60">{t("home.cruise.perperson")}</span>
                    </span>
                    <span className="grid size-9 place-items-center rounded-full border border-white/25 text-white transition-colors group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary">
                      <Icon icon={ArrowUpRight} size={16} />
                    </span>
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
        <p className="mt-4 text-[12px] text-white/55">{t("home.cruise.note")}</p>
      </div>
    </section>
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

  // Parallakse: fotografinen beveger seg roligere enn innholdet, så siden
  // får dybde. Ken Burns kjører på selve bildet, parallaksen på wrapperen.
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell bleed>
        {/* 1 · Åpningen: ett ekte foto, én setning – og søket med alle fire
            produkter inne i selve bildet, som hos de store. */}
        <section ref={heroRef} className="relative isolate overflow-hidden bg-night text-white">
          <motion.div style={reduce ? undefined : { y: heroY }} className="absolute inset-0 scale-[1.15]">
            <picture>
              {/* Portrettvariant på telefon: vertikalt foto, vertikal hero.
                  Desktop (lg og opp) bruker landskapsvarianten. */}
              <source media="(max-width: 1023px)" srcSet="/photos/hero-bay-mobile-480.jpg 480w, /photos/hero-bay-mobile-800.jpg 800w, /photos/hero-bay-mobile.jpg 941w" sizes="100vw" />
              <img
                src="/photos/hero-bay-1280.jpg"
                srcSet="/photos/hero-bay-800.jpg 800w, /photos/hero-bay-1280.jpg 1280w, /photos/hero-bay.jpg 1672w"
                sizes="100vw"
                alt={t("home.hero.photo")}
                width={1672}
                height={941}
                fetchPriority="high"
                decoding="async"
                className={cn("h-full w-full object-cover object-[center_62%]", !reduce && "ken-burns")}
              />
            </picture>
          </motion.div>
          {/* Tittelen sto i lime mot lys himmel og forsvant. Nedtoningen er
              kraftigere øverst til venstre, der teksten faktisk ligger. */}
          <div className="absolute inset-0 bg-gradient-to-b from-night/70 via-night/25 to-night/75" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-night/75 via-night/35 to-transparent" aria-hidden="true" />
          <div className="container-x relative flex flex-col pb-8 pt-4 sm:pb-12 lg:min-h-[min(940px,100svh)] lg:justify-center lg:py-14">
            <div className="lg:hidden"><GreetingBar tone="dark" /></div>
            <div className="mt-8 max-w-3xl sm:mt-14 lg:mt-4">
              <h1 className="t-display [text-shadow:0_2px_28px_rgb(0_0_0/0.4)]">
                <Words text={h1a} />
                <span className="t-em block text-primary"><Words text={h1b} from={h1a.split(" ").length} /></span>
              </h1>
              <p className="fade-up fade-up-4 t-lead mt-5 max-w-xl text-white/85">{t("home.sub2")}</p>
            </div>

            {/* Søkekortet: fire produkter i én flate – fly, hotell, cruise, bil. */}
            <div className="mt-8 max-w-5xl sm:mt-10">
              <SearchCard />
              {/* Tre løfter under kortet. Kun på større skjermer – på mobil
                  skal veien til resultatet være kort. */}
              <ul className="mt-6 hidden gap-6 sm:grid sm:grid-cols-3">
                {([
                  { icon: Tag, title: t("home.hero.trust.1.title"), body: t("home.hero.trust.1.body") },
                  { icon: ShieldCheck, title: t("home.hero.trust.2.title"), body: t("home.hero.trust.2.body") },
                  { icon: Heart, title: t("home.hero.trust.3.title"), body: t("home.hero.trust.3.body") },
                ]).map((item) => (
                  <li key={item.title} className="flex items-center gap-3">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 backdrop-blur-sm">
                      <Icon icon={item.icon} size={16} className="text-white" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-white">{item.title}</span>
                      <span className="block text-[13px] text-white/70">{item.body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Under heroen: stille. Bare det praktiske – betalingsmerknaden og
            kundens egne siste søk. */}
        <div className="container-x relative z-10 mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            {/* Betalingspåstanden vises bare når Stripe faktisk er satt opp. */}
            <p className="t-caption">{status.data?.paymentsConfigured ? t("home.trust") : t("home.trust.nopay")}</p>
            {recent.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon icon={Clock3} size={16} /> {t("home.recent")}:</span>
                {recent.slice(0, 3).map((s) => (
                  <Link key={`${s.from}-${s.to}-${s.depart}`} to={recentSearchHref(s)} className="press inline-flex min-h-9 items-center rounded-full border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:border-foreground/30">{s.fromLabel} → {s.toLabel}</Link>
                ))}
              </div>
            )}
        </div>

        {/* 2 · Mer enn fly: cruise, hotell og leiebil med egne kataloger. */}
        <MoreThanFlights />

        {/* 3 · Ditt: kun innlogget, kun med data. */}
        {customer && <PersonalStrip />}
        {customer && <ForYou />}

        {/* Alt under folden gjengis når hovedtråden er ledig. Første
            skjermbilde skal ikke vente på seks prisoppslag, fire fotokort og
            tre artikler – ingenting av det er synlig ennå. */}
        {/* 4 · Verden etter tema: sidens ene interaktive oppdagelse. */}
        <BelowFold minHeight={3900}>
          <WorldDiscovery />

          {/* 5 · Populære ruter: ren data. Flagg, rute, ekte fra-pris.
                 Ingen fotokort her – seksjonen over er allerede bilder. */}
          <section aria-labelledby="routes" className="container-x mt-20 sm:mt-28">
            <h2 id="routes" className="t-h1 max-w-2xl">{t("home.routes.title")}</h2>
            <p className="t-lead mt-3 max-w-xl text-muted-foreground">{t("home.routes.sub")}</p>
            <ul className="mt-8 divide-y divide-border border-y border-border">
              {POPULAR_ROUTES.map((deal) => <RouteRow key={deal.id} deal={deal} onOpen={setQuickView} />)}
            </ul>
            <p className="t-caption mt-3 max-w-xl">{t("home.routes.note")}</p>
          </section>

          {/* 6 · Cruise: seilinger fra katalogen, veiledende priser, mørk flate. */}
          <CruiseShowcase />

          {/* 7 · Rutene vi kjenner best: hjemreisene som én historie, i full
                 bredde. Ikke merkevaren, men det vi faktisk kan bedre enn andre. */}
          <section aria-labelledby="homecoming" className="relative isolate mt-20 overflow-hidden bg-night text-white sm:mt-28">
            <img
              src="/destinations/istanbul.jpg"
              srcSet={imageSrcSet("/destinations/istanbul.jpg")}
              sizes="100vw"
              alt="Galatatårnet over Istanbuls tak"
              loading="lazy"
              decoding="async"
              width={1024}
              height={640}
              className="absolute inset-0 h-full w-full object-cover object-[center_58%]"
            />
            <span
              className="absolute inset-0"
              aria-hidden="true"
              style={{ backgroundImage: "linear-gradient(to top, hsl(var(--night)) 4%, hsl(var(--night) / 0.93) 40%, hsl(var(--night) / 0.8) 66%, hsl(var(--night) / 0.55) 88%, hsl(var(--night) / 0.35) 100%)" }}
            />
            <div className="container-x relative flex min-h-[420px] flex-col justify-end py-12 sm:min-h-[480px] sm:py-16">
              <p className="font-mono-label text-[10px] uppercase tracking-[0.18em] text-white/80">{t("home.hero.kicker")}</p>
              <h2 id="homecoming" className="t-h1 mt-2 max-w-2xl text-white">{t("home.home.title")}</h2>
              <p className="t-lead mt-4 max-w-xl text-white/85">{t("home.hero.body")}</p>
              <ul className="mt-7 flex flex-wrap gap-2">
                {HOMECOMING_ROUTES.map((r) => (
                  <li key={r.id}>
                    <Link
                      to={`/sok?from=OSL&to=${r.destination.iata}&depart=${inDays(35)}&adults=1&children=0&infants=0&cabin=economy`}
                      className="press inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3.5 text-sm font-semibold backdrop-blur-sm transition-colors hover:border-white/60 hover:bg-white/20"
                    >
                      <CountryFlag code={airportByIata(r.destination.iata)?.countryCode} size={12} />
                      {r.destination.city}
                    </Link>
                  </li>
                ))}
              </ul>
              <Button asChild size="lg" className="mt-7 w-fit bg-white text-night hover:bg-white/90">
                <Link to="/reisemal#hjem">{t("home.home.cta")} <Icon icon={ArrowRight} size={20} /></Link>
              </Button>
            </div>
          </section>

          {/* 8 · Derfor HelloSky: tre fakta, ingen merker, ingen tall vi ikke har. */}
          <section aria-labelledby="why" className="container-x mt-20 sm:mt-28">
            <h2 id="why" className="t-h1 max-w-2xl">{t("home.why.title")}</h2>
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

          {/* 9 · Journalen: tre artikler, håndplukket. */}
          <section className="container-x mt-20 sm:mt-28">
            <SectionHeader title={t("home.journal")} action={<SeeAll to="/journal" label={t("home.journal.all")} />} />
            <div className="no-scrollbar snap-row -mx-5 flex gap-4 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0">
              {featured().slice(0, 3).map((a) => <ArticleCard key={a.slug} a={a} className="w-[280px] shrink-0 md:w-auto" />)}
            </div>
          </section>

          {/* 10 · Prisovervåking: lys flate, mørk handling. */}
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
