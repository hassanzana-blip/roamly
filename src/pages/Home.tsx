import { useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, BedDouble, Building2, Car, Check, Clock3, Plane, TrendingDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import AppShell, { SectionHeader } from "@/components/app/AppShell";
import { GreetingBar } from "@/components/app/TopBar";
import PillTabs from "@/components/app/PillTabs";
import SearchWidget from "@/components/search/SearchWidget";
import DestinationSheet from "@/components/app/DestinationSheet";
import DealCard from "@/components/app/DealCard";
import Icon from "@/components/app/Icon";
import SiteFooter from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BaggageVisual, FamilyGlyph } from "@/components/graphics";
import { loadRecentSearches, recentSearchHref, type RecentSearch } from "@/lib/recentSearches";
import { useT, type I18nKey } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { useCustomer } from "@/lib/useCustomer";
import { useAccountHub } from "@/lib/useAccount";
import { formatDateShort, formatMinor } from "@/lib/format";
import { DEAL_ROUTES, POPULAR_DESTINATIONS, imageSrcSet, type DiscoverDestination } from "@/content/discover";
import { WHATSAPP_DISPLAY, WHATSAPP_LINK, WhatsAppIcon } from "@/components/WhatsAppFab";
import { trpc } from "@/providers/trpc";
import ArticleCard from "@/components/journal/ArticleCard";
import ForYou from "@/components/home/ForYou";
import { featured } from "@/content/journal";
import { cn } from "@/lib/utils";

/**
 * Forsiden. Tre hensikter, én rytme: «jeg vet hvor» (søket), «hjelp meg å velge»
 * (anledninger, ruter, ReiseMatch) og «jeg har allerede noe» (ditt, øverst).
 * Foto + søk → ditt → anledninger → ruter med ekte fra-priser → ett mørkt
 * øyeblikk → prisovervåking → det vi gjør annerledes → journalen → ReiseMatch →
 * bonus → tillit → bunntekst. Ingen seksjon uten innhold; ingen tall som ikke er ekte.
 */

const TABS: { id: string; label: I18nKey; icon: typeof Plane }[] = [
  { id: "fly", label: "home.tab.flight", icon: Plane },
  { id: "hotell", label: "home.tab.hotel", icon: Building2 },
  { id: "leiebil", label: "home.tab.car", icon: Car },
];

/** Anledninger som bilder: hver dør har et ekte foto fra reisemålslisten. */
const OCCASIONS: { id: string; to: string; label: I18nKey; sub: I18nKey; photo: string; span: string }[] = [
  { id: "home", to: "/reisemal#hjem", label: "home.occ.home", sub: "home.occ.homesub", photo: "istanbul", span: "col-span-2 md:row-span-2" },
  { id: "sun", to: "/utforsk?k=sol", label: "home.occ.sun", sub: "home.occ.sunsub", photo: "malaga", span: "" },
  { id: "weekend", to: "/utforsk?k=helg", label: "home.occ.weekend", sub: "home.occ.weekendsub", photo: "london", span: "" },
  { id: "family", to: "/utforsk?k=familie", label: "home.occ.family", sub: "home.occ.familysub", photo: "dubai", span: "" },
  { id: "football", to: "/utforsk?k=fotball", label: "home.occ.football", sub: "home.occ.footballsub", photo: "barcelona", span: "" },
  { id: "culture", to: "/utforsk?k=kultur", label: "home.occ.culture", sub: "home.occ.culturesub", photo: "rome", span: "col-span-2 md:col-span-1" },
];

const ALT: Record<string, string> = Object.fromEntries(POPULAR_DESTINATIONS.map((d) => [d.id, d.imageAlt]));

function inDays(n: number) {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

/** Seksjonene rendres statisk; bevegelsesbudsjettet brukes på ett sted: åpningen. */
function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={className}>{children}</section>;
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

/** Hotel / car form on the front page: hands over to the request form. */
function HotelCarSearch({ kind, leading }: { kind: "hotell" | "leiebil"; leading: ReactNode }) {
  const navigate = useNavigate();
  const [place, setPlace] = useState("");
  const [from, setFrom] = useState(inDays(21));
  const [to, setTo] = useState(inDays(25));
  const [count, setCount] = useState("2");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams({ type: kind === "hotell" ? "hotell" : "bil", sted: place.trim(), fra: from, til: to, antall: count });
    navigate(`/overnatting-bil?${q.toString()}`);
  };

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">{leading}</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_0.8fr]">
        <div className="space-y-1.5">
          <Label htmlFor="hc-place">{kind === "hotell" ? "Hvor vil du bo?" : "Hvor hentes bilen?"}</Label>
          <Input id="hc-place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder={kind === "hotell" ? "F.eks. Barcelona" : "F.eks. Oslo lufthavn"} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hc-from">{kind === "hotell" ? "Innsjekk" : "Hentes"}</Label>
          <Input id="hc-from" type="date" value={from} min={inDays(0)} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hc-to">{kind === "hotell" ? "Utsjekk" : "Leveres"}</Label>
          <Input id="hc-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hc-count">{kind === "hotell" ? "Gjester" : "Sjåfører"}</Label>
          <Select value={count} onValueChange={setCount}>
            <SelectTrigger id="hc-count"><SelectValue /></SelectTrigger>
            <SelectContent>{[1, 2, 3, 4, 5, 6].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" size="xl" className="mt-4 w-full md:w-auto md:min-w-64">
        <Icon icon={kind === "hotell" ? BedDouble : Car} size={20} />
        {kind === "hotell" ? "Finn hotell" : "Finn leiebil"}
      </Button>
    </form>
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
    <Reveal className="container-x mt-10">
      <h2 className="t-label mb-3">{t("home.personal.foryou")}</h2>
      <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5 sm:-mx-8 sm:px-8">
        {h.nextTrip && (
          <Link to={`/bekreftelse/${encodeURIComponent(h.nextTrip.orderId)}`} className="press flex min-h-[96px] w-[240px] shrink-0 flex-col justify-between rounded-xl bg-primary-soft p-4 transition-colors hover:bg-primary/30">
            <span className="flex items-center justify-between"><span className="t-label">{t("home.personal.nexttrip")}</span><Icon icon={Plane} size={16} className="text-accent-foreground" /></span>
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
    </Reveal>
  );
}

const SeeAll = ({ to, label }: { to: string; label: string }) => (
  <Link to={to} className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-primary">
    {label} <Icon icon={ArrowRight} size={16} />
  </Link>
);

export default function Home() {
  usePageMeta(PAGE_META.home);
  const t = useT();
  const reduce = useReducedMotion();
  const { customer } = useCustomer();
  const rewards = trpc.account.rewardsPublic.useQuery(undefined, { staleTime: 600_000, retry: false });
  const status = trpc.flights.status.useQuery(undefined, { staleTime: 300_000, retry: false });
  const [tab, setTab] = useState("fly");
  const [quickView, setQuickView] = useState<DiscoverDestination | null>(null);
  const [recent] = useState<RecentSearch[]>(() => loadRecentSearches());
  const searchRef = useRef<HTMLDivElement>(null);

  const rw = rewards.data;
  const tabs = <PillTabs tabs={TABS.map((x) => ({ ...x, label: t(x.label) }))} active={tab} onChange={setTab} />;
  const title1 = t("home.title1");
  const title3 = t("home.title3");

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell bleed>
        {/* 1 · Åpningen: ett ekte foto, tittelen, og søket som ligger oppå kanten. */}
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
          <div className="absolute inset-0 bg-gradient-to-b from-night/55 via-night/25 to-night/70" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-night/45 via-transparent to-transparent" aria-hidden="true" />
          <div className="container-x relative pb-24 sm:pb-32 lg:pb-40 lg:pt-24">
            <div className="lg:hidden"><GreetingBar tone="dark" /></div>
            <h1 className="t-display max-w-3xl">
              <Words text={title1} /> <span className="wr"><span className="wr-i hl" style={{ ["--wr-delay" as string]: `${title1.split(" ").length * 70}ms` }}>{t("home.title2")}</span></span> <Words text={title3} from={title1.split(" ").length + 1} />
            </h1>
            <p className="fade-up fade-up-3 t-lead mt-4 max-w-xl text-white/85">{t("home.sub")}</p>
          </div>
        </section>

        {/* Søkekortet: løftet, ikke rammet. Ligger over fotokanten. */}
        <div className="container-x relative z-10 -mt-16 sm:-mt-24 lg:-mt-28">
          <motion.div
            ref={searchRef}
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="surface-lift scroll-mt-24 p-4 sm:p-5 lg:p-6"
          >
            {tab === "fly" && <SearchWidget leading={tabs} />}
            {tab === "hotell" && <HotelCarSearch kind="hotell" leading={tabs} />}
            {tab === "leiebil" && <HotelCarSearch kind="leiebil" leading={tabs} />}
          </motion.div>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            {/* Én tillitslinje, kun fakta: betalingspåstanden vises bare når Stripe faktisk er satt opp. */}
            <p className="t-caption">{status.data?.paymentsConfigured ? t("home.trust") : t("home.trust.nopay")}</p>
            {recent.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon icon={Clock3} size={16} /> {t("home.recent")}:</span>
                {recent.slice(0, 3).map((s) => (
                  <Link key={`${s.from}-${s.to}-${s.depart}`} to={recentSearchHref(s)} className="press inline-flex min-h-9 items-center rounded-lg border border-border bg-card px-3 text-sm font-medium transition-colors hover:border-foreground/30">{s.fromLabel} → {s.toLabel}</Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 2 · Ditt: kun innlogget, kun med data. */}
        {customer && <PersonalStrip />}
        {customer && <ForYou />}

        {/* 3 · Anledninger: seks dører med ekte foto. Den du peker på trer fram, resten trer tilbake. */}
        <Reveal className="container-x mt-14 sm:mt-16">
          <h2 className="t-h2 mb-4">{t("home.occasions")}</h2>
          <ul className="group/occ grid auto-rows-[150px] grid-cols-2 gap-2.5 sm:auto-rows-[170px] md:auto-rows-[190px] md:grid-cols-3 md:gap-3">
            {OCCASIONS.map((o) => (
              <li key={o.id} className={cn("min-w-0", o.span)}>
                <Link
                  to={o.to}
                  className="press group/door relative block h-full w-full overflow-hidden rounded-xl bg-night text-white outline-none transition-opacity duration-slow ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:group-hover/occ:opacity-70 md:hover:!opacity-100 md:focus-visible:!opacity-100"
                >
                  <img src={`/destinations/${o.photo}.jpg`} srcSet={imageSrcSet(`/destinations/${o.photo}.jpg`)} sizes="(max-width: 768px) 50vw, 33vw" alt={ALT[o.photo] ?? ""} loading="lazy" decoding="async" width={1024} height={640} className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover/door:scale-[1.04]" />
                  <span className="photo-wash absolute inset-0" aria-hidden="true" />
                  <span className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                    <span className="block text-[17px] font-semibold leading-tight md:text-[19px]">{t(o.label)}</span>
                    <span className="mt-1 block text-[12px] text-white/80 md:text-[13px]">{t(o.sub)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>

        {/* 4 · Ruter fra Norge: den ene fotorekken, fordi den bærer ekte «fra»-priser. */}
        <Reveal className="container-x mt-14 sm:mt-16">
          <SectionHeader title={t("home.deals")} action={<SeeAll to="/utforsk" label={t("home.seeall")} />} />
          <div className="no-scrollbar snap-row -mx-5 flex gap-4 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8">
            {DEAL_ROUTES.map((deal) => <DealCard key={deal.id} deal={deal} onOpen={setQuickView} />)}
          </div>
          <p className="t-caption mt-3">«Fra»-priser hentes fra vårt eget prissøk og er veiledende. Endelig pris, bagasje og gebyrer ser du i søkeresultatet.</p>
        </Reveal>

        {/* 5 · Ett mørkt øyeblikk: identiteten. Ekte foto, ingen påstander. */}
        <Reveal className="mt-16 sm:mt-20">
          <Link to="/reisemal#hjem" className="group relative block min-h-[440px] overflow-hidden bg-night text-white sm:min-h-[540px]">
            <img src="/destinations/istanbul.jpg" srcSet="/destinations/istanbul-640.jpg 640w, /destinations/istanbul.jpg 1024w" sizes="100vw" alt="Galatatårnet over Istanbuls tak" loading="lazy" decoding="async" width={1024} height={640} className="absolute inset-0 h-full w-full object-cover opacity-75 transition-transform duration-[1200ms] ease-out group-hover:scale-[1.03]" />
            <div className="absolute inset-0 bg-gradient-to-t from-night via-night/45 to-night/10" aria-hidden="true" />
            <div className="container-x relative flex h-full min-h-[440px] flex-col justify-end pb-12 pt-24 sm:min-h-[540px] sm:pb-16">
              <h2 className="t-display max-w-2xl">{t("home.hero.title")}</h2>
              <p className="t-lead mt-4 max-w-xl text-white/85">{t("home.hero.body")}</p>
              <span className="mt-7 inline-flex min-h-12 w-fit items-center gap-2 rounded-lg bg-primary px-5 text-[15px] font-semibold text-primary-foreground transition-transform duration-base ease-out group-hover:translate-x-0.5">{t("home.hero.cta")} <Icon icon={ArrowRight} size={16} /></span>
            </div>
          </Link>
        </Reveal>

        <div className="container-x">
          {/* 6 · Prisovervåking: lys flate, mørk handling. Ett mørkt øyeblikk holder. */}
          <Reveal className="mt-16 sm:mt-20">
            <div className="surface grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-9">
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
          </Reveal>

          {/* 7 · Det vi gjør annerledes: familie og bagasje, én flate, to spor. */}
          <Reveal className="mt-14 sm:mt-16">
            <h2 className="t-h2 mb-5">{t("home.different")}</h2>
            <div className="grid gap-8 border-t border-border pt-6 md:grid-cols-2 md:gap-10">
              <Link to="/reisemal#hjem" className="group flex gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-muted text-foreground"><FamilyGlyph size={26} /></span>
                <span className="min-w-0">
                  <span className="t-h3 block">{t("home.family.title")}</span>
                  <span className="t-body mt-1.5 block text-muted-foreground">{t("home.family.body")}</span>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold transition-transform duration-base ease-out group-hover:translate-x-0.5">{t("home.family.cta")} <Icon icon={ArrowRight} size={16} /></span>
                </span>
              </Link>
              <Link to="/bagasje" className="group flex gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-muted text-foreground"><BaggageVisual kind="checked" count={2} size={26} label={t("home.bags.title")} /></span>
                <span className="min-w-0">
                  <span className="t-h3 block">{t("home.bags.title")}</span>
                  <span className="t-body mt-1.5 block text-muted-foreground">{t("home.bags.body")}</span>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold transition-transform duration-base ease-out group-hover:translate-x-0.5">{t("home.bags.cta")} <Icon icon={ArrowRight} size={16} /></span>
                </span>
              </Link>
            </div>
          </Reveal>

          {/* 8 · Journalen: tre artikler, håndplukket. */}
          <Reveal className="mt-14 sm:mt-16">
            <SectionHeader title={t("home.journal")} action={<SeeAll to="/journal" label={t("home.journal.all")} />} />
            <p className="t-caption -mt-2 mb-4">{t("home.journal.sub")}</p>
            <div className="no-scrollbar snap-row -mx-5 flex gap-4 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8 md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0">
              {featured().slice(0, 3).map((a) => <ArticleCard key={a.slug} a={a} className="w-[280px] shrink-0 md:w-auto" />)}
            </div>
          </Reveal>

          {/* 9 · ReiseMatch: invitasjon, ikke i veien. */}
          <Reveal className="mt-14 sm:mt-16">
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
              <div className="min-w-0">
                <h2 className="t-h2">{t("home.quiz.title")}</h2>
                <p className="t-body mt-1 max-w-md text-muted-foreground">{t("home.quiz.body")}</p>
              </div>
              <Button asChild variant="dark" size="md">
                <Link to="/quiz">{t("home.quiz.cta")} <Icon icon={ArrowRight} size={16} /></Link>
              </Button>
            </div>
          </Reveal>

          {/* 10 · Bonus: bare med regler fra admin; tallene er de som gjelder. */}
          {rw && (
            <Reveal className="mt-14 sm:mt-16">
              <div className="grid gap-5 rounded-2xl bg-primary-soft p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-9">
                <div>
                  <h2 className="t-h2 text-foreground">{t("home.rewards.title", { program: rw.programName })}</h2>
                  <p className="t-body mt-3 max-w-xl text-accent-foreground/90">{t("home.rewards.body", { pct: Math.round(rw.earnFraction * 1000) / 10, kr: rw.referrerKr })}</p>
                </div>
                <Button asChild variant="dark" size="lg">
                  <Link to={customer ? "/profil/bonus" : "/logg-inn?modus=registrer"}>{customer ? t("home.rewards.ctain") : t("home.rewards.cta")}</Link>
                </Button>
              </div>
            </Reveal>
          )}

          {/* 11 · Tillit + mennesker: fakta, ikke merker. Ingen kort, én linje. */}
          <Reveal className="mt-14 sm:mt-16">
            <div className="grid gap-8 border-t border-border pt-8 md:grid-cols-2 md:gap-12">
              <div>
                <h2 className="t-h2">{t("home.trust.title")}</h2>
                <ul className="mt-4 space-y-3">
                  {(["home.trust.1", "home.trust.2", "home.trust.3", "home.trust.4"] as I18nKey[]).map((k) => (
                    <li key={k} className="t-body flex items-start gap-2.5"><Icon icon={Check} size={16} className="mt-1 shrink-0 text-success" /> {t(k)}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="t-h2">{t("home.help.title")}</h2>
                <p className="t-body mt-2 max-w-lg text-muted-foreground">{t("home.help.body")}</p>
                <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="press mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold transition-colors hover:border-foreground/30">
                  <WhatsAppIcon className="h-4 w-4" /> WhatsApp {WHATSAPP_DISPLAY}
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </AppShell>

      <div className="mt-16 sm:mt-20"><SiteFooter /></div>
      <DestinationSheet destination={quickView} onClose={() => setQuickView(null)} />
    </div>
  );
}
