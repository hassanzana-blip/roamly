import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, BedDouble, Building2, Car, Clock3, MapPin, Plane, Users } from "lucide-react";
import AppShell, { SectionHeader } from "@/components/app/AppShell";
import { GreetingBar } from "@/components/app/TopBar";
import PillTabs from "@/components/app/PillTabs";
import SearchWidget from "@/components/search/SearchWidget";
import DestinationSheet from "@/components/app/DestinationSheet";
import DestinationCard from "@/components/travel/DestinationCard";
import DealCard from "@/components/app/DealCard";
import Icon from "@/components/app/Icon";
import SiteFooter from "@/components/layout/SiteFooter";
import { useFavourites } from "@/lib/favourites";
import { loadRecentSearches, recentSearchHref, type RecentSearch } from "@/lib/recentSearches";
import { useRoutePrice } from "@/lib/useRoutePrice";
import { useT, type I18nKey } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { DEAL_ROUTES, RECOMMENDED_DESTINATIONS, type DiscoverDestination } from "@/content/discover";

const TABS: { id: string; label: I18nKey; icon: typeof Plane }[] = [
  { id: "fly", label: "home.tab.flight", icon: Plane },
  { id: "hotell", label: "home.tab.hotel", icon: Building2 },
  { id: "leiebil", label: "home.tab.car", icon: Car },
];

const fieldCls =
  "w-full rounded-xl border border-border bg-white px-4 py-3 text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/40";
const labelCls =
  "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground";

function inDays(n: number) {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

/** Hotell/Leiebil-skjema på forsiden — viderefører til bestillingsskjemaet. */
function HotelCarSearch({ kind }: { kind: "hotell" | "leiebil" }) {
  const navigate = useNavigate();
  const [place, setPlace] = useState("");
  const [from, setFrom] = useState(inDays(21));
  const [to, setTo] = useState(inDays(25));
  const [count, setCount] = useState("2");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams({
      type: kind === "hotell" ? "hotell" : "bil",
      sted: place.trim(),
      fra: from,
      til: to,
      antall: count,
    });
    navigate(`/overnatting-bil?${q.toString()}`);
  };

  return (
    <form
      onSubmit={submit}
      className="mt-4 w-full rounded-2xl border border-border bg-white p-4 shadow-[0_12px_40px_-16px_hsl(var(--night)/0.35)] sm:p-5"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_0.8fr]">
        <label className="block">
          <span className={labelCls}>
            <Icon icon={MapPin} size={16} className="mr-1 inline-block -translate-y-px" />
            {kind === "hotell" ? "Hvor vil du bo?" : "Hvor hentes bilen?"}
          </span>
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder={kind === "hotell" ? "F.eks. Barcelona" : "F.eks. Oslo lufthavn"}
            required
            className={fieldCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>{kind === "hotell" ? "Innsjekk" : "Hentes"}</span>
          <input
            type="date"
            value={from}
            min={inDays(0)}
            onChange={(e) => {
              setFrom(e.target.value);
              if (to < e.target.value) setTo(e.target.value);
            }}
            required
            className={fieldCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>{kind === "hotell" ? "Utsjekk" : "Leveres"}</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            required
            className={fieldCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>
            <Icon icon={Users} size={16} className="mr-1 inline-block -translate-y-px" />
            {kind === "hotell" ? "Gjester" : "Sjåfører"}
          </span>
          <select value={count} onChange={(e) => setCount(e.target.value)} className={fieldCls}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="submit"
        className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-xl bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-md shadow-primary/25 transition-all hover:brightness-[0.94] active:scale-[0.99]"
      >
        <Icon icon={kind === "hotell" ? BedDouble : Car} size={20} />
        {kind === "hotell" ? "Finn hotell" : "Finn leiebil"}
      </button>
    </form>
  );
}

/** Recommended card with a live «fra»-price line (null-safe: hides when absent). */
function RecommendedCard({
  d,
  favs,
  toggle,
  onOpen,
}: {
  d: DiscoverDestination;
  favs: Set<string>;
  toggle: (id: string) => void;
  onOpen: (d: DiscoverDestination) => void;
}) {
  const price = useRoutePrice("OSL", d.iata);
  return (
    <DestinationCard
      destination={d}
      isFavourite={favs.has(d.id)}
      onToggleFavourite={toggle}
      onOpen={onOpen}
      price={price}
    />
  );
}

export default function Home() {
  usePageMeta(PAGE_META.home);
  const t = useT();
  const [tab, setTab] = useState("fly");
  const [quickView, setQuickView] = useState<DiscoverDestination | null>(null);
  const [favs, toggleFav] = useFavourites();
  const [recent] = useState<RecentSearch[]>(() => loadRecentSearches());
  const searchRef = useRef<HTMLDivElement>(null);


  /** Søkeknappen i toppfeltet: vis flysøket og flytt fokus dit. */
  const focusSearch = () => {
    setTab("fly");
    requestAnimationFrame(() => {
      const el = searchRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      const first = el.querySelector<HTMLElement>("button, input, [tabindex]:not([tabindex='-1'])");
      first?.focus({ preventScroll: true });
    });
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell>
        <div className="lg:hidden">
          <GreetingBar onSearch={focusSearch} />
        </div>

        {/* Editorial headline — accent-highlighted key word, no paragraph */}
        <h1 className="font-display text-balance text-[38px] leading-[1.04] tracking-tight sm:text-6xl">
          {t("home.title1")} <span className="hl">{t("home.title2")}</span> {t("home.title3")}
        </h1>

        <div className="mt-6">
          <PillTabs tabs={TABS.map((x) => ({ ...x, label: t(x.label) }))} active={tab} onChange={setTab} />
        </div>

        {/* Søkeskjema direkte på forsiden — fly / hotell / leiebil */}
        {tab === "fly" && (
          <div className="mt-4 scroll-mt-24" ref={searchRef}>
            <SearchWidget />
          </div>
        )}
        {tab === "hotell" && <HotelCarSearch kind="hotell" />}
        {tab === "leiebil" && <HotelCarSearch kind="leiebil" />}

        {recent.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
              <Icon icon={Clock3} size={16} /> {t("home.recent")}:
            </span>
            {recent.slice(0, 3).map((s) => (
              <Link
                key={`${s.from}-${s.to}-${s.depart}`}
                to={recentSearchHref(s)}
                className="inline-flex min-h-9 items-center rounded-full border border-border bg-white px-3.5 text-[13px] font-semibold transition-colors hover:border-foreground/25"
              >
                {s.fromLabel} → {s.toLabel}
              </Link>
            ))}
          </div>
        )}

        {/* Anbefalt for deg */}
        <section className="mt-10">
          <SectionHeader
            title={t("home.recommended")}
            action={
              <Link
                to="/utforsk"
                className="inline-flex min-h-9 items-center gap-1 text-[14px] font-semibold text-[hsl(var(--skyline))]"
              >
                {t("home.seeall")} <Icon icon={ArrowRight} size={16} />
              </Link>
            }
          />
          <div className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8">
            {RECOMMENDED_DESTINATIONS.map((d) => (
              <RecommendedCard key={d.id} d={d} favs={favs} toggle={toggleFav} onOpen={setQuickView} />
            ))}
          </div>
        </section>

        {/* Gode tilbud — veiledende priser fra prissøket, aldri fabrikkert */}
        <section className="mt-10">
          <SectionHeader title={t("home.deals")} />
          <div className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8">
            {DEAL_ROUTES.map((deal) => (
              <DealCard key={deal.id} deal={deal} onOpen={setQuickView} />
            ))}
          </div>
          <p className="mt-2 px-0.5 text-[12px] text-muted-foreground">
            «Fra»-priser hentes fra vårt eget prissøk og er veiledende — endelig
            pris ser du i søkeresultatet.
          </p>
        </section>
      </AppShell>

      <div className="mt-14">
        <SiteFooter />
      </div>

      <DestinationSheet destination={quickView} onClose={() => setQuickView(null)} />
    </div>
  );
}
