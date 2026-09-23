import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  ArrowUpRight,
  CircleAlert,
  MousePointerClick,
  PlaneTakeoff,
  Search,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { ALL_DESTINATIONS } from "@/content/discover";
import { airportByIata } from "@contracts/airports";
import { cn } from "@/lib/utils";

/**
 * Eierens forside.
 *
 * Driftsoversikten svarer på «hva må gjøres i dag». Denne svarer på «hvordan
 * går selskapet», og den er bygget rundt tre påstander vi nekter å blande:
 *
 *   Etterspørsel   – hvor mange søkte, hvor mange klikket videre
 *   Bruttoverdi    – hva reisene de klikket på var verdt hos leverandøren
 *   Inntekt        – hva HelloSky faktisk har tjent
 *
 * De tre står i hver sin boks med hver sin etikett. Et dashbord som legger
 * dem sammen gir et tall som ser stort ut og ikke betyr noe.
 *
 * Tomt er ikke det samme som null. Måler vi ikke et steg ennå, står det at
 * vi ikke måler det – ikke «0».
 */

const PERIODS = [
  { key: "today", label: "I dag" },
  { key: "7d", label: "7 dager" },
  { key: "30d", label: "30 dager" },
  { key: "90d", label: "90 dager" },
  { key: "year", label: "År" },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

const nf = new Intl.NumberFormat("nb-NO");
const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")} %`;

function money(minor: number, currency: string | null): string {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: currency ?? "NOK", maximumFractionDigits: 0 }).format(minor / 100);
}

/** Endring mot forrige like lange periode. Null når det ikke er noe å sammenligne med. */
function delta(now: number, prev: number): number | null {
  if (prev <= 0) return null;
  return (now - prev) / prev;
}

function Trend({ value }: { value: number | null }) {
  if (value === null) return null;
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold", up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
      <Icon className="size-3.5" aria-hidden="true" />
      {up ? "+" : ""}
      {(value * 100).toFixed(1).replace(".", ",")} %
    </span>
  );
}

/**
 * Ett tall, én påstand.
 *
 * `kind` styrer fargen og dermed hva kortet sier: mørkt for etterspørsel,
 * blått for det som er HelloSkys egne penger, lyst for kontekst. Ingen kort
 * er mørkt bare for å se bra ut.
 */
function Kpi({
  label,
  value,
  sub,
  trend,
  icon: Icon,
  kind = "quiet",
  to,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: number | null;
  icon: typeof Search;
  kind?: "dark" | "brand" | "quiet";
  to?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl sm:size-10",
            kind === "dark" ? "bg-white/10 text-white" : kind === "brand" ? "bg-white/15 text-white" : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-[18px] sm:size-5" aria-hidden="true" />
        </span>
        {to && <ArrowUpRight className={cn("size-4", kind === "quiet" ? "text-muted-foreground" : "text-white/70")} aria-hidden="true" />}
      </div>
      <p className={cn("mt-3.5 text-[12.5px] font-semibold sm:mt-4 sm:text-[13px]", kind === "quiet" ? "text-muted-foreground" : "text-white/70")}>{label}</p>
      <p className={cn("mt-1 font-display text-[26px] font-semibold leading-none tracking-tight sm:text-[30px]", kind === "quiet" ? "text-foreground" : "text-white")}>{value}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {trend !== undefined && <Trend value={trend ?? null} />}
        {sub && <span className={cn("text-[12.5px]", kind === "quiet" ? "text-muted-foreground" : "text-white/60")}>{sub}</span>}
      </div>
    </>
  );
  const cls = cn(
    "block rounded-2xl p-4 transition-shadow sm:p-5",
    kind === "dark" && "bg-night",
    kind === "brand" && "bg-primary",
    kind === "quiet" && "border border-border bg-card",
    to && "hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  );
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Panel({ title, action, children }: { title: string; action?: { to: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-[19px] font-semibold tracking-tight text-foreground">{title}</h2>
        {action && (
          <Link to={action.to} className="inline-flex min-h-9 items-center gap-1 whitespace-nowrap text-[14px] font-semibold text-primary hover:underline">
            {action.label} <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Tomtilstand som sier hvorfor, ikke bare at. */
function Nothing({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[13.5px] leading-snug text-muted-foreground">{body}</p>
    </div>
  );
}

function SkeletonCard() {
  return <div className="shimmer h-[152px] rounded-2xl" aria-hidden="true" />;
}

const routeLabel = (o: string, d: string) => `${airportByIata(o)?.city ?? o} → ${airportByIata(d)?.city ?? d}`;

export default function OwnerOverview({ ownerName }: { ownerName: string }) {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const q = trpc.adminOwner.summary.useQuery({ period }, { staleTime: 60_000, retry: false });
  const data = q.data;

  /**
   * Heltebildet er et av de lisensierte reisemålsfotoene, valgt av dagen –
   * ikke tilfeldig per render, som ville byttet bilde hver gang tallene
   * oppdateres. Ingen henting fra nett, ingen AI-bilder.
   */
  const [today] = useState(() => Math.floor(Date.now() / 86_400_000));
  const hero = useMemo(() => {
    const withPhoto = ALL_DESTINATIONS.filter((d) => d.image);
    return withPhoto.length ? withPhoto[today % withPhoto.length]! : null;
  }, [today]);

  const clicks = data?.demand.clicks;
  const searches = data?.demand.searches;

  // Provisjon per status. «paid» er de eneste pengene som faktisk er mottatt.
  const paid = data?.money.commission.filter((c) => c.status === "paid") ?? [];
  const confirmed = data?.money.commission.filter((c) => c.status === "confirmed") ?? [];
  const grossValue = data?.money.clickedValue ?? [];

  return (
    <div className="space-y-6">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl bg-night">
        {hero?.image && (
          <img
            src={hero.image}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-45"
            loading="eager"
            decoding="async"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-night via-night/85 to-night/30" aria-hidden="true" />
        <div className="relative px-6 py-8 sm:px-8 sm:py-10">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/60">Eierpanel</p>
          <h1 className="mt-2 font-display text-[30px] font-semibold leading-tight tracking-tight text-white sm:text-[38px]">
            Velkommen tilbake, {ownerName}.
          </h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-white/75">
            {hero ? `Dagens bilde: ${hero.city}, ${hero.country}.` : "HelloSky, i tall."} Alt under er hentet fra databasen nå – ingenting er anslått.
          </p>
        </div>
      </section>

      {/* ── Periode ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[13px] font-semibold text-muted-foreground">Periode</span>
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={period === p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              "min-h-9 rounded-lg border px-3 text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              period === p.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-foreground/30",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {data?.tracking.partialPeriod && (
        <p className="flex items-start gap-2.5 rounded-xl bg-accent px-4 py-3 text-[13.5px] leading-snug text-accent-foreground">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Målingen startet {new Date(data.tracking.searchesSince!).toLocaleDateString("nb-NO", { day: "numeric", month: "long" })}. Tallene dekker derfor bare
          en del av perioden du har valgt.
        </p>
      )}

      {/* ── KPI ──────────────────────────────────────────────────────── */}
      {q.isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : q.isError ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[14px] text-destructive">
          Tallene kunne ikke hentes.
        </p>
      ) : data ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Kpi
            kind="dark"
            icon={Search}
            label="Søk"
            value={nf.format(searches!.value)}
            trend={delta(searches!.value, searches!.previous)}
            sub={data.demand.noResults > 0 ? `${nf.format(data.demand.noResults)} uten treff` : undefined}
            to="/admin/rapporter"
          />
          <Kpi
            kind="dark"
            icon={MousePointerClick}
            label="Klikk til leverandør"
            value={nf.format(clicks!.value)}
            trend={delta(clicks!.value, clicks!.previous)}
            sub={data.demand.clickThrough !== null ? `${pct(data.demand.clickThrough)} av søkene` : "Ingen søk å dele på"}
          />
          <Kpi
            kind="quiet"
            icon={PlaneTakeoff}
            label="Bruttoverdi klikket videre"
            value={grossValue.length ? money(grossValue[0]!.amountMinor, grossValue[0]!.currency) : "—"}
            sub={grossValue.length ? "Reisens verdi hos leverandøren – ikke vår inntekt" : "Ingen klikk med oppgitt pris ennå"}
          />
          <Kpi
            kind="brand"
            icon={Wallet}
            label="Provisjon utbetalt"
            value={paid.length ? money(paid[0]!.amountMinor, paid[0]!.currency) : "—"}
            sub={
              data.tracking.conversionsReported === 0
                ? "Ingen leverandør har rapportert salg ennå"
                : confirmed.length
                  ? `${money(confirmed[0]!.amountMinor, confirmed[0]!.currency)} bekreftet, ikke utbetalt`
                  : undefined
            }
          />
        </div>
      ) : null}

      {/* ── Trakt + ruter ────────────────────────────────────────────── */}
      <div className="grid items-start gap-6 xl:grid-cols-[1.15fr_1fr]">
        <Panel title="Fra søk til provisjon">
          {!data ? (
            <div className="shimmer h-40 rounded-xl" aria-hidden="true" />
          ) : (
            <ol className="space-y-2.5">
              {data.funnel.map((step, i) => {
                const first = data.funnel[0]!.count;
                const share = first > 0 && step.measured ? step.count / first : 0;
                const label = { searches: "Søk", results: "Søk med treff", clicks: "Klikk til leverandør", conversions: "Bekreftet salg", commission: "Utbetalt provisjon" }[step.stage] ?? step.stage;
                return (
                  <li key={step.stage}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[14px] font-semibold text-foreground">{label}</span>
                      <span className="t-num text-[15px] font-bold text-foreground">
                        {step.measured ? nf.format(step.count) : <span className="text-[13px] font-semibold text-muted-foreground">måles ikke ennå</span>}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", step.measured ? "bg-primary" : "bg-border")}
                        style={{ width: `${Math.max(step.measured && step.count > 0 ? 2 : 0, Math.round(share * 100))}%` }}
                      />
                    </div>
                    {i === 3 && data.tracking.conversionsReported === 0 && (
                      <p className="mt-1.5 text-[12.5px] leading-snug text-muted-foreground">
                        Her stopper målingen. Konverteringer kommer inn når en leverandør rapporterer dem – tabellen står klar og tom.
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>

        <Panel title="Mest søkte ruter" action={{ to: "/admin/rapporter", label: "Alle rapporter" }}>
          {!data ? (
            <div className="shimmer h-40 rounded-xl" aria-hidden="true" />
          ) : data.topRoutes.length === 0 ? (
            <Nothing title="Ingen søk i perioden" body="Så snart noen søker etter en reise, dukker rutene opp her – også søkene som ikke ga treff." />
          ) : (
            <ul className="divide-y divide-border">
              {data.topRoutes.map((r) => (
                <li key={`${r.origin}-${r.destination}`} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0 truncate text-[14.5px] font-semibold text-foreground">{routeLabel(r.origin, r.destination)}</span>
                  <span className="t-num shrink-0 text-[14px] font-bold text-foreground">{nf.format(r.searches)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ── Hull i dekningen + leverandører ──────────────────────────── */}
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_1.15fr]">
        <Panel title="Søk uten treff">
          {!data ? (
            <div className="shimmer h-32 rounded-xl" aria-hidden="true" />
          ) : data.noResultRoutes.length === 0 ? (
            <Nothing title="Ingen tomme søk" body="Alle søk i perioden ga minst ett tilbud. Dukker det opp ruter her, mangler leverandørene dekning." />
          ) : (
            <ul className="divide-y divide-border">
              {data.noResultRoutes.map((r) => (
                <li key={`${r.origin}-${r.destination}`} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0 truncate text-[14.5px] font-semibold text-foreground">{routeLabel(r.origin, r.destination)}</span>
                  <span className="t-num shrink-0 text-[14px] font-bold text-warning">{nf.format(r.searches)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Leverandører">
          {!data ? (
            <div className="shimmer h-32 rounded-xl" aria-hidden="true" />
          ) : (
            <ul className="space-y-2.5">
              {data.providers.map((p) => {
                const usage = data.providerUsage.find((u) => u.provider === p.id);
                return (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-border px-4 py-3">
                    <span className="flex items-center gap-2.5">
                      <span className={cn("size-2.5 shrink-0 rounded-full", p.active ? "bg-success" : "bg-border")} aria-hidden="true" />
                      <span className="text-[14.5px] font-semibold text-foreground">{p.id}</span>
                      {p.sandbox && <span className="rounded-md bg-warning/10 px-2 py-0.5 text-[11.5px] font-bold text-warning">sandkasse</span>}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {usage
                        ? `${nf.format(usage.searches)} søk · ${usage.avgMs} ms · ${nf.format(usage.errors)} feil`
                        : "ingen søk i perioden"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {/* ── Publikum ─────────────────────────────────────────────────── */}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Kpi icon={Search} label="Nye kunder" value={nf.format(data.audience.newCustomers)} />
          <Kpi icon={PlaneTakeoff} label="Aktive prisvarsler" value={nf.format(data.audience.activePriceAlerts)} />
          <Kpi
            icon={Wallet}
            label="Direktesalg (egen kasse)"
            value={data.money.directSales.length ? `${nf.format(data.money.directSales[0]!.amountMajor)} ${data.money.directSales[0]!.currency}` : "—"}
            sub={data.money.directSales.length ? `${data.money.directSales[0]!.count} bestillinger` : "Duffel-modellen er av i produksjon"}
          />
          <Kpi
            icon={MousePointerClick}
            label="Rapporterte konverteringer"
            value={nf.format(data.tracking.conversionsReported)}
            sub={data.tracking.conversionsReported === 0 ? "Venter på første rapport" : undefined}
          />
        </div>
      )}
    </div>
  );
}
