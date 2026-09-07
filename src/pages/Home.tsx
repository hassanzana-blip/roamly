import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, BedDouble, Building2, Car, Clock3, MapPin, Plane, Users } from "lucide-react";
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
import { loadRecentSearches, recentSearchHref, type RecentSearch } from "@/lib/recentSearches";
import { useT, type I18nKey } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { DEAL_ROUTES, type DiscoverDestination } from "@/content/discover";
import { WHATSAPP_DISPLAY, WHATSAPP_LINK, WhatsAppIcon } from "@/components/WhatsAppFab";

const TABS: { id: string; label: I18nKey; icon: typeof Plane }[] = [
  { id: "fly", label: "home.tab.flight", icon: Plane },
  { id: "hotell", label: "home.tab.hotel", icon: Building2 },
  { id: "leiebil", label: "home.tab.car", icon: Car },
];

function inDays(n: number) {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
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
    <form onSubmit={submit} className="mt-4 w-full rounded-2xl border border-border bg-card p-3 shadow-md sm:p-4 md:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_0.8fr]">
        <div className="space-y-1.5">
          <Label htmlFor="hc-place">
            <Icon icon={MapPin} size={16} className="text-muted-foreground" />
            {kind === "hotell" ? "Hvor vil du bo?" : "Hvor hentes bilen?"}
          </Label>
          <Input id="hc-place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder={kind === "hotell" ? "F.eks. Barcelona" : "F.eks. Oslo lufthavn"} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hc-from">{kind === "hotell" ? "Innsjekk" : "Hentes"}</Label>
          <Input
            id="hc-from"
            type="date"
            value={from}
            min={inDays(0)}
            onChange={(e) => {
              setFrom(e.target.value);
              if (to < e.target.value) setTo(e.target.value);
            }}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hc-to">{kind === "hotell" ? "Utsjekk" : "Leveres"}</Label>
          <Input id="hc-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hc-count">
            <Icon icon={Users} size={16} className="text-muted-foreground" />
            {kind === "hotell" ? "Gjester" : "Sjåfører"}
          </Label>
          <Select value={count} onValueChange={setCount}>
            <SelectTrigger id="hc-count">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
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

export default function Home() {
  usePageMeta(PAGE_META.home);
  const t = useT();
  const [tab, setTab] = useState("fly");
  const [quickView, setQuickView] = useState<DiscoverDestination | null>(null);
  const [recent] = useState<RecentSearch[]>(() => loadRecentSearches());
  const searchRef = useRef<HTMLDivElement>(null);

  /** Search button in the top bar: show the flight search and move focus there. */
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

        {/* Editorial headline: one quiet accent word, then the search. */}
        <div className="lg:pt-10">
          <h1 className="font-display text-balance text-[38px] leading-[1.04] sm:text-[52px] lg:text-[60px]">
            {t("home.title1")} <span className="hl">{t("home.title2")}</span> {t("home.title3")}
          </h1>
          <p className="mt-3 max-w-xl text-base text-muted-foreground sm:text-lg">{t("home.sub")}</p>
        </div>

        <div className="mt-6">
          <PillTabs tabs={TABS.map((x) => ({ ...x, label: t(x.label) }))} active={tab} onChange={setTab} />
        </div>

        {/* Search form directly on the front page: flights / hotel / car */}
        {tab === "fly" && (
          <div className="mt-4 scroll-mt-24" ref={searchRef}>
            <SearchWidget />
          </div>
        )}
        {tab === "hotell" && <HotelCarSearch kind="hotell" />}
        {tab === "leiebil" && <HotelCarSearch kind="leiebil" />}

        {recent.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Icon icon={Clock3} size={16} /> {t("home.recent")}:
            </span>
            {recent.slice(0, 3).map((s) => (
              <Link
                key={`${s.from}-${s.to}-${s.depart}`}
                to={recentSearchHref(s)}
                className="inline-flex min-h-9 items-center rounded-lg border border-border bg-card px-3 text-sm font-medium transition-colors hover:border-foreground/30"
              >
                {s.fromLabel} → {s.toLabel}
              </Link>
            ))}
          </div>
        )}

        {/* One plain trust line: real facts only */}
        <p className="mt-4 text-sm text-muted-foreground">{t("home.trust")}</p>

        {/* Én invitasjon til Travel Match — ved siden av søket, aldri i veien for det. */}
        <section className="mt-8 rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-display text-xl text-foreground">{t("home.quiz.title")}</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">{t("home.quiz.body")}</p>
            </div>
            <Link
              to="/quiz"
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-foreground bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90"
            >
              {t("home.quiz.cta")} <Icon icon={ArrowRight} size={16} />
            </Link>
          </div>
        </section>

        {/*
          Én oppdagelsesseksjon, ikke to. Rutene under viser ekte «fra»-priser
          fra vårt eget prissøk; reisemålene uten pris lå tidligere i en egen
          karusell med de samme bildene, noe som bare gjentok seg selv.
        */}
        <section className="mt-12">
          <SectionHeader
            title={t("home.deals")}
            action={
              <Link to="/utforsk" className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-primary">
                {t("home.seeall")} <Icon icon={ArrowRight} size={16} />
              </Link>
            }
          />
          <div className="no-scrollbar snap-row -mx-5 flex gap-4 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8">
            {DEAL_ROUTES.map((deal) => (
              <DealCard key={deal.id} deal={deal} onOpen={setQuickView} />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">«Fra»-priser hentes fra vårt eget prissøk og er veiledende. Endelig pris, bagasje og gebyrer ser du i søkeresultatet.</p>
        </section>

        {/* Menneskene bak. Ingen bilder her før de ansatte har godkjent egne. */}
        <section className="mt-12 rounded-xl border border-border bg-muted/40 p-5 sm:p-6">
          <h2 className="font-display text-xl text-foreground">{t("home.help.title")}</h2>
          <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">{t("home.help.body")}</p>
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold transition-colors hover:border-foreground/30"
          >
            <WhatsAppIcon className="h-4 w-4" /> WhatsApp {WHATSAPP_DISPLAY}
          </a>
        </section>

      </AppShell>

      <div className="mt-16">
        <SiteFooter />
      </div>

      <DestinationSheet destination={quickView} onClose={() => setQuickView(null)} />
    </div>
  );
}
