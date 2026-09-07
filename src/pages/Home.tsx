import { useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, BedDouble, Building2, Car, Check, Clock3, Heart, MapPin, Plane, Sparkles, TrendingDown, Users, type LucideIcon } from "lucide-react";
import AppShell, { SectionHeader } from "@/components/app/AppShell";
import { GreetingBar } from "@/components/app/TopBar";
import PillTabs from "@/components/app/PillTabs";
import SearchWidget from "@/components/search/SearchWidget";
import DestinationSheet from "@/components/app/DestinationSheet";
import DestinationCard from "@/components/travel/DestinationCard";
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
import { useAccountHub, useSavedDestinations } from "@/lib/useAccount";
import { formatDateShort, formatMinor } from "@/lib/format";
import { DEAL_ROUTES, POPULAR_DESTINATIONS, RECOMMENDED_DESTINATIONS, searchHref, type DiscoverDestination } from "@/content/discover";
import { WHATSAPP_DISPLAY, WHATSAPP_LINK, WhatsAppIcon } from "@/components/WhatsAppFab";
import { trpc } from "@/providers/trpc";

/**
 * Forsiden. Rytme, ikke liste: søk → (ditt, hvis du har noe) → reisemål →
 * anledninger → ett fullbredde-øyeblikk → ruter med ekte fra-priser →
 * prisovervåking → familie/bagasje → helg → ReiseMatch → bonus → mennesker.
 * Ingen seksjon vises uten innhold; ingen tall som ikke er ekte.
 */

const TABS: { id: string; label: I18nKey; icon: typeof Plane }[] = [
  { id: "fly", label: "home.tab.flight", icon: Plane },
  { id: "hotell", label: "home.tab.hotel", icon: Building2 },
  { id: "leiebil", label: "home.tab.car", icon: Car },
];

const OCCASIONS: { id: string; to: string; label: I18nKey; sub: I18nKey; icon: LucideIcon }[] = [
  { id: "home", to: "/reisemal#hjem", label: "home.occ.home", sub: "home.occ.homesub", icon: Heart },
  { id: "weekend", to: "/utforsk?k=helg", label: "home.occ.weekend", sub: "home.occ.weekendsub", icon: Clock3 },
  { id: "sun", to: "/utforsk?k=sol", label: "home.occ.sun", sub: "home.occ.sunsub", icon: Sparkles },
  { id: "family", to: "/utforsk?k=familie", label: "home.occ.family", sub: "home.occ.familysub", icon: Users },
  { id: "football", to: "/utforsk?k=fotball", label: "home.occ.football", sub: "home.occ.footballsub", icon: MapPin },
  { id: "culture", to: "/utforsk?k=kultur", label: "home.occ.culture", sub: "home.occ.culturesub", icon: Building2 },
];

function inDays(n: number) {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

/** Neste fredag (minst 10 dager fram) — for helgeideene. */
function nextFridayOffset(): number {
  const d = new Date(Date.now() + 10 * 86_400_000);
  const add = (5 - d.getUTCDay() + 7) % 7;
  return 10 + add;
}

/**
 * Seksjonene rendres statisk. Inntoning ved scrolling ble prøvd og fjernet:
 * innholdet må finnes uten JS-observatører (skjermlesere, utskrift, fullside-
 * bilder), og bevegelsesbudsjettet brukes bedre på interaksjonene.
 */
function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={className}>{children}</section>;
}

/** Hotel / car form on the front page: hands over to the request form. */
function HotelCarSearch({ kind }: { kind: "hotell" | "leiebil" }) {
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
    <form onSubmit={submit} className="mt-4 w-full rounded-2xl border border-border bg-card p-3 shadow-md sm:p-4 md:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_0.8fr]">
        <div className="space-y-1.5">
          <Label htmlFor="hc-place"><Icon icon={MapPin} size={16} className="text-muted-foreground" />{kind === "hotell" ? "Hvor vil du bo?" : "Hvor hentes bilen?"}</Label>
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
          <Label htmlFor="hc-count"><Icon icon={Users} size={16} className="text-muted-foreground" />{kind === "hotell" ? "Gjester" : "Sjåfører"}</Label>
          <Select value={count} onValueChange={setCount}>
            <SelectTrigger id="hc-count"><SelectValue /></SelectTrigger>
            <SelectContent>{[1, 2, 3, 4, 5, 6].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" size="xl" className="mt-4 w-full">
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
    <Reveal className="mt-8">
      <p className="mb-3 eyebrow">{t("home.personal.foryou")}</p>
      <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5 sm:-mx-8 sm:px-8">
        {h.nextTrip && (
          <Link to={`/bekreftelse/${encodeURIComponent(h.nextTrip.orderId)}`} className="flex min-h-[96px] w-[240px] shrink-0 flex-col justify-between rounded-xl bg-primary-soft p-4 transition-colors hover:bg-primary/30">
            <span className="flex items-center justify-between"><span className="eyebrow">{t("home.personal.nexttrip")}</span><Icon icon={Plane} size={16} className="text-accent-foreground" /></span>
            <span><span className="block truncate text-[16px] font-semibold">{h.nextTrip.originCity || h.nextTrip.originIata} → {h.nextTrip.destinationCity || h.nextTrip.destinationIata}</span><span className="block text-[12px] text-muted-foreground">{formatDateShort(h.nextTrip.departingAt)}</span></span>
          </Link>
        )}
        {watch && (
          <Link to="/profil/prisovervaking" className="flex min-h-[96px] w-[240px] shrink-0 flex-col justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/25">
            <span className="flex items-center justify-between"><span className="eyebrow">{t("home.personal.watch")}</span><Icon icon={TrendingDown} size={16} className="text-muted-foreground" /></span>
            <span><span className="block truncate text-[16px] font-semibold">{watch.originIata} → {watch.destinationCity}</span><span className="block text-[12px] text-muted-foreground">{res?.live && res.priceMinor ? t("acct.hub.watchfound", { price: formatMinor(res.priceMinor, res.currency ?? "NOK") }) : t("acct.hub.watchchecking")}</span></span>
          </Link>
        )}
        {h.routes.slice(0, 3).map((r) => (
          <Link key={`${r.originIata}-${r.destinationIata}`} to={`/sok?from=${r.originIata}&to=${r.destinationIata}&depart=${inDays(30)}&adults=1&children=0&infants=0&cabin=economy`} className="flex min-h-[96px] w-[200px] shrink-0 flex-col justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/25">
            <span className="eyebrow">{t("home.personal.routes")}</span>
            <span className="flex items-center gap-1.5 text-[16px] font-semibold">{r.originCity} <Icon icon={ArrowRight} size={14} className="text-muted-foreground" /> {r.destinationCity}</span>
          </Link>
        ))}
      </div>
    </Reveal>
  );
}

export default function Home() {
  usePageMeta(PAGE_META.home);
  const t = useT();
  const { customer } = useCustomer();
  const { ids: favs, toggle: toggleFav } = useSavedDestinations();
  const rewards = trpc.account.rewardsPublic.useQuery(undefined, { staleTime: 600_000, retry: false });
  const status = trpc.flights.status.useQuery(undefined, { staleTime: 300_000, retry: false });
  const [tab, setTab] = useState("fly");
  const [quickView, setQuickView] = useState<DiscoverDestination | null>(null);
  const [recent] = useState<RecentSearch[]>(() => loadRecentSearches());
  const [fridayOffset] = useState(nextFridayOffset);
  const searchRef = useRef<HTMLDivElement>(null);

  const focusSearch = () => {
    setTab("fly");
    requestAnimationFrame(() => {
      const el = searchRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.querySelector<HTMLElement>("button, input, [tabindex]:not([tabindex='-1'])")?.focus({ preventScroll: true });
    });
  };

  const weekend = POPULAR_DESTINATIONS.filter((d) => ["london", "paris", "barcelona", "lisboa", "rome", "athens", "malaga"].includes(d.id));
  const rw = rewards.data;

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell>
        <div className="lg:hidden"><GreetingBar onSearch={focusSearch} /></div>

        {/* 1 · Søk — tittel, ett stille aksentord, så skjemaet. */}
        <div className="lg:pt-10">
          <h1 className="font-display text-balance text-[38px] leading-[1.04] sm:text-[52px] lg:text-[60px]">
            {t("home.title1")} <span className="hl">{t("home.title2")}</span> {t("home.title3")}
          </h1>
          <p className="mt-3 max-w-xl text-base text-muted-foreground sm:text-lg">{t("home.sub")}</p>
        </div>
        <div className="mt-6"><PillTabs tabs={TABS.map((x) => ({ ...x, label: t(x.label) }))} active={tab} onChange={setTab} /></div>
        {tab === "fly" && <div className="mt-4 scroll-mt-24" ref={searchRef}><SearchWidget /></div>}
        {tab === "hotell" && <HotelCarSearch kind="hotell" />}
        {tab === "leiebil" && <HotelCarSearch kind="leiebil" />}
        {recent.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon icon={Clock3} size={16} /> {t("home.recent")}:</span>
            {recent.slice(0, 3).map((s) => (
              <Link key={`${s.from}-${s.to}-${s.depart}`} to={recentSearchHref(s)} className="inline-flex min-h-9 items-center rounded-lg border border-border bg-card px-3 text-sm font-medium transition-colors hover:border-foreground/30">{s.fromLabel} → {s.toLabel}</Link>
            ))}
          </div>
        )}
        {/* Én tillitslinje, kun fakta: betalingspåstanden vises bare når Stripe faktisk er satt opp. */}
        <p className="mt-4 text-sm text-muted-foreground">{status.data?.paymentsConfigured ? t("home.trust") : t("home.trust.nopay")}</p>

        {/* 2 · Ditt — kun innlogget, kun med data. */}
        {customer && <PersonalStrip />}

        {/* 3 · Reisemål vi kan godt — bildeledet rekke. */}
        <Reveal className="mt-12">
          <SectionHeader
            title={t("home.recommended")}
            action={<Link to="/utforsk" className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-primary">{t("home.seeall")} <Icon icon={ArrowRight} size={16} /></Link>}
          />
          <p className="-mt-2 mb-4 text-sm text-muted-foreground">{t("home.recommended.sub")}</p>
          <div className="no-scrollbar snap-row -mx-5 flex gap-4 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8">
            {RECOMMENDED_DESTINATIONS.map((d) => (
              <DestinationCard key={d.id} destination={d} isFavourite={favs.has(d.id)} onToggleFavourite={toggleFav} onOpen={setQuickView} />
            ))}
          </div>
        </Reveal>

        {/* 4 · Anledninger — seks små dører, tett og rolig. */}
        <Reveal className="mt-12">
          <h2 className="mb-4 font-display text-[24px] leading-tight sm:text-[28px]">{t("home.occasions")}</h2>
          <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
            {OCCASIONS.map((o) => (
              <li key={o.id}>
                <Link to={o.to} className="flex min-h-[92px] flex-col justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/30">
                  <Icon icon={o.icon} size={20} className="text-muted-foreground" />
                  <span><span className="block text-[15px] font-semibold leading-tight">{t(o.label)}</span><span className="mt-0.5 block text-[12px] text-muted-foreground">{t(o.sub)}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      </AppShell>

      {/* 5 · Ett fullbredde-øyeblikk: identiteten. Ekte foto, ingen påstander. */}
      <Reveal className="mt-14">
        <Link to="/reisemal#hjem" className="group relative block min-h-[420px] overflow-hidden bg-night text-white sm:min-h-[520px]">
          <img src="/destinations/istanbul.jpg" srcSet="/destinations/istanbul-640.jpg 640w, /destinations/istanbul.jpg 1024w" sizes="100vw" alt="Galatatårnet over Istanbuls tak" loading="lazy" decoding="async" width={1024} height={640} className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-[1200ms] ease-out group-hover:scale-[1.03]" />
          <div className="absolute inset-0 bg-gradient-to-t from-night via-night/40 to-transparent" aria-hidden="true" />
          <div className="container-x relative flex h-full min-h-[420px] flex-col justify-end pb-10 pt-24 sm:min-h-[520px] sm:pb-14">
            <p className="font-mono-label text-[11px] uppercase tracking-[0.18em] text-primary">{t("home.hero.kicker")}</p>
            <h2 className="mt-3 max-w-2xl font-display text-[36px] leading-[1.02] sm:text-[56px]">{t("home.hero.title")}</h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/80 sm:text-base">{t("home.hero.body")}</p>
            <span className="mt-6 inline-flex min-h-11 w-fit items-center gap-2 rounded-lg bg-primary px-4 text-[14px] font-semibold text-primary-foreground">{t("home.hero.cta")} <Icon icon={ArrowRight} size={16} /></span>
          </div>
        </Link>
      </Reveal>

      <div className="container-x">
        {/* 6 · Ruter fra Norge — ekte «fra»-priser fra prissøket. */}
        <Reveal className="mt-14">
          <SectionHeader title={t("home.deals")} action={<Link to="/utforsk" className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-primary">{t("home.seeall")} <Icon icon={ArrowRight} size={16} /></Link>} />
          <div className="no-scrollbar snap-row -mx-5 flex gap-4 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8">
            {DEAL_ROUTES.map((deal) => <DealCard key={deal.id} deal={deal} onOpen={setQuickView} />)}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">«Fra»-priser hentes fra vårt eget prissøk og er veiledende. Endelig pris, bagasje og gebyrer ser du i søkeresultatet.</p>
        </Reveal>

        {/* 7 · Prisovervåking — ett mørkt bånd. */}
        <Reveal className="mt-12">
          <div className="grid gap-6 rounded-2xl bg-night p-6 text-white sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
            <div>
              <p className="font-mono-label text-[11px] uppercase tracking-[0.18em] text-primary">{t("home.personal.watch")}</p>
              <h2 className="mt-2 font-display text-[26px] leading-tight sm:text-[32px]">{t("home.watch.title")}</h2>
              <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-white/75">{t("home.watch.body")}</p>
            </div>
            <Link to={customer ? "/profil/prisovervaking" : "/logg-inn?next=/profil/prisovervaking"} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-[15px] font-semibold text-primary-foreground">
              <Icon icon={TrendingDown} size={20} /> {t("home.watch.cta")}
            </Link>
          </div>
        </Reveal>

        {/* 8 · Familie + bagasje — to like kort, det vi faktisk gjør annerledes. */}
        <Reveal className="mt-12">
          <div className="grid gap-4 md:grid-cols-2">
            <Link to="/reisemal#hjem" className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 transition-colors hover:border-foreground/25">
              <FamilyGlyph size={28} className="text-foreground" />
              <div className="mt-6">
                <h3 className="font-display text-[22px]">{t("home.family.title")}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{t("home.family.body")}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold">{t("home.family.cta")} <Icon icon={ArrowRight} size={16} /></span>
              </div>
            </Link>
            <Link to="/bagasje" className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 transition-colors hover:border-foreground/25">
              <BaggageVisual kind="checked" count={2} size={28} label={t("home.bags.title")} />
              <div className="mt-6">
                <h3 className="font-display text-[22px]">{t("home.bags.title")}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{t("home.bags.body")}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold">{t("home.bags.cta")} <Icon icon={ArrowRight} size={16} /></span>
              </div>
            </Link>
          </div>
        </Reveal>

        {/* 9 · Helgeideer — rekke, med søk satt til neste fredag. */}
        <Reveal className="mt-12">
          <SectionHeader title={t("home.weekend")} action={<Link to="/utforsk?k=helg" className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-primary">{t("home.seeall")} <Icon icon={ArrowRight} size={16} /></Link>} />
          <p className="-mt-2 mb-4 text-sm text-muted-foreground">{t("home.weekend.sub")}</p>
          <div className="no-scrollbar snap-row -mx-5 flex gap-4 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8">
            {weekend.map((d) => (
              <Link key={d.id} to={searchHref(d.iata, fridayOffset)} className="hover-lift group block w-[196px] shrink-0 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-[228px]" aria-label={`${t("home.occ.weekend")}: ${d.city}`}>
                <span className="relative block aspect-[4/5] overflow-hidden rounded-xl bg-muted">
                  {d.image && <img src={d.image} alt={d.imageAlt} loading="lazy" decoding="async" width={1024} height={1280} sizes="(max-width: 640px) 196px, 228px" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />}
                </span>
                <span className="block px-1.5 pt-3"><span className="block text-[16px] font-semibold leading-tight">{d.city}</span><span className="block text-[13px] text-muted-foreground">{d.tagline}</span></span>
              </Link>
            ))}
          </div>
        </Reveal>

        {/* 10 · ReiseMatch — invitasjon, ikke i veien. */}
        <Reveal className="mt-12">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-6">
            <div className="min-w-0">
              <h2 className="font-display text-[22px] text-foreground">{t("home.quiz.title")}</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">{t("home.quiz.body")}</p>
            </div>
            <Link to="/quiz" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-foreground bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90">{t("home.quiz.cta")} <Icon icon={ArrowRight} size={16} /></Link>
          </div>
        </Reveal>

        {/* 11 · Bonus — bare med regler fra admin; tallene er de som gjelder. */}
        {rw && (
          <Reveal className="mt-12">
            <div className="grid gap-5 rounded-2xl bg-primary-soft p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
              <div>
                <h2 className="font-display text-[24px] leading-tight text-foreground sm:text-[28px]">{t("home.rewards.title", { program: rw.programName })}</h2>
                <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-accent-foreground/90">{t("home.rewards.body", { pct: Math.round(rw.earnFraction * 1000) / 10, kr: rw.referrerKr })}</p>
              </div>
              <Link to={customer ? "/profil/bonus" : "/logg-inn?modus=registrer"} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-foreground px-5 text-[15px] font-semibold text-background">{customer ? t("home.rewards.ctain") : t("home.rewards.cta")}</Link>
            </div>
          </Reveal>
        )}

        {/* 12 · Tillit + mennesker — fakta, ikke merker. */}
        <Reveal className="mt-12">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-[22px]">{t("home.trust.title")}</h2>
              <ul className="mt-4 space-y-2.5">
                {(["home.trust.1", "home.trust.2", "home.trust.3", "home.trust.4"] as I18nKey[]).map((k) => (
                  <li key={k} className="flex items-start gap-2.5 text-[14px]"><Icon icon={Check} size={16} className="mt-0.5 shrink-0 text-success" /> {t(k)}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-muted/40 p-6">
              <h2 className="font-display text-[22px] text-foreground">{t("home.help.title")}</h2>
              <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">{t("home.help.body")}</p>
              <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold transition-colors hover:border-foreground/30">
                <WhatsAppIcon className="h-4 w-4" /> WhatsApp {WHATSAPP_DISPLAY}
              </a>
            </div>
          </div>
        </Reveal>
      </div>

      <div className="mt-16"><SiteFooter /></div>
      <DestinationSheet destination={quickView} onClose={() => setQuickView(null)} />
    </div>
  );
}
