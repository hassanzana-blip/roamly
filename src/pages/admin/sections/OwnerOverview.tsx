import { useMemo, useState } from "react";
import { Link } from "react-router";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowRight,
  ArrowUpRight,
  CircleAlert,
  MousePointerClick,
  PlaneTakeoff,
  Search,
  Ticket,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { ALL_DESTINATIONS } from "@/content/discover";
import { cn } from "@/lib/utils";

/**
 * Eierens forside.
 *
 * Driftsoversikten svarer på «hva må gjøres i dag». Denne svarer på «hvordan
 * går selskapet», og den er bygget rundt påstander vi nekter å blande:
 *
 *   Etterspørsel   – hvor mange søkte, hvor mange klikket videre
 *   Bruttoverdi    – hva reisene de klikket på var verdt hos leverandøren
 *   Inntekt        – hva HelloSky faktisk har tjent
 *
 * De står i hver sin boks med hver sin etikett. Et dashbord som legger dem
 * sammen gir et tall som ser stort ut og ikke betyr noe.
 *
 * Tomt er ikke det samme som null. Måler vi ikke et steg ennå, står det at vi
 * ikke måler det – ikke «0».
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
    <span className={cn("inline-flex items-center gap-1 rounded-[7px] px-1.5 py-0.5 text-[12px] font-semibold", up ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive")}>
      <Icon className="size-3" aria-hidden="true" />
      {up ? "+" : ""}
      {(value * 100).toFixed(1).replace(".", ",")} %
    </span>
  );
}

/**
 * Ett tall, én påstand.
 *
 * Alle kortene er like lyse. Forrige versjon hadde to svarte og ett blått for
 * å skape hierarki, men fire kort som skal sammenlignes skal se like ut –
 * forskjellen ligger i tallet, ikke i flaten.
 */
function Kpi({
  label,
  value,
  sub,
  trend,
  icon: Icon,
  to,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: number | null;
  icon: typeof Search;
  to?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-primary-soft text-primary">
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        {to && <ArrowUpRight className="size-4 text-subtle transition-colors group-hover:text-primary" aria-hidden="true" />}
      </div>
      <p className="mt-3.5 text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className={cn("admin-num mt-1 font-display font-semibold leading-none", value === "—" ? "text-[22px] text-subtle" : "text-[26px] text-foreground sm:text-[28px]")}>{value}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {trend !== undefined && <Trend value={trend ?? null} />}
        {sub && <span className="text-[12.5px] leading-snug text-subtle">{sub}</span>}
      </div>
    </>
  );
  const cls = "admin-card group block p-4 sm:p-[18px]";
  return to ? (
    <Link to={to} className={cn(cls, "transition-shadow hover:admin-raise focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Panel({ title, action, children, className }: { title: string; action?: { to: string; label: string }; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("admin-card p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-[17px] font-semibold text-foreground">{title}</h2>
        {action && (
          <Link to={action.to} className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-semibold text-primary hover:underline">
            {action.label} <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Tomtilstand som sier hvorfor, ikke bare at. Liten – en tom liste er ingen hendelse. */
function Nothing({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-4 py-7 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-[44ch] text-[13px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function SkeletonCard() {
  return <div className="shimmer h-[138px] rounded-2xl" aria-hidden="true" />;
}

/**
 * Miniatyrbildet til en rute.
 *
 * Bildet er fotografiet vi allerede har av reisemålet, slått opp på IATA-kode.
 * Finnes det ikke et bilde, står det en rolig flate med koden – ikke et
 * tilfeldig bilde av et annet sted.
 */
const PHOTO_BY_IATA = new Map(ALL_DESTINATIONS.filter((d) => d.image).map((d) => [d.iata, d]));

function RouteThumb({ iata }: { iata: string }) {
  const dest = PHOTO_BY_IATA.get(iata);
  if (!dest?.image) {
    return (
      <span className="grid h-[30px] w-[38px] shrink-0 place-items-center rounded-lg bg-muted text-[10px] font-semibold tracking-wide text-subtle" aria-hidden="true">
        {iata}
      </span>
    );
  }
  return (
    <img
      src={dest.image.replace(".jpg", "-256.jpg")}
      alt=""
      aria-hidden="true"
      width={38}
      height={30}
      loading="lazy"
      decoding="async"
      className="h-[30px] w-[38px] shrink-0 rounded-lg object-cover"
    />
  );
}

/**
 * Heltebildet.
 *
 * Ett kuratert norsk fotografi, ikke et nytt utvalg per render. Det ligger
 * allerede i repoet og er kreditert i src/content/photos.ts. Ingen henting
 * fra nett, ingen AI-bilder, ingen tekst bakt inn i bildet.
 */
const HERO = ALL_DESTINATIONS.find((d) => d.iata === "TOS") ?? null;

const DAY_LABEL = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short" });

export default function OwnerOverview({ ownerName }: { ownerName: string }) {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const q = trpc.adminOwner.summary.useQuery({ period }, { staleTime: 60_000, retry: false });
  const series = trpc.adminOwner.series.useQuery({ period }, { staleTime: 60_000, retry: false });
  const data = q.data;

  const [today] = useState(() => new Date());
  const greeting = useMemo(() => new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long" }).format(today), [today]);

  const clicks = data?.demand.clicks;
  const searches = data?.demand.searches;
  const bookings = data?.demand.bookings;

  // Provisjon per status. «paid» er de eneste pengene som faktisk er mottatt.
  const paid = data?.money.commission.filter((c) => c.status === "paid") ?? [];
  const confirmed = data?.money.commission.filter((c) => c.status === "confirmed") ?? [];
  const grossValue = data?.money.clickedValue ?? [];
  const revenue = data?.money.revenue ?? [];

  const chart = useMemo(
    () =>
      (series.data?.points ?? []).map((p) => ({
        day: p.day,
        label: DAY_LABEL.format(new Date(`${p.day}T12:00:00`)),
        Søk: p.searches,
        Bestillinger: p.bookings,
      })),
    [series.data],
  );
  const chartHasData = chart.some((p) => p.Søk > 0 || p.Bestillinger > 0);

  return (
    <div className="space-y-5">
      {/* ── Hero ─────────────────────────────────────────────────────────
          Bildet toner ut mot venstre så teksten alltid har ren bakgrunn å stå
          på. Ingen tekst er bakt inn i fotografiet. */}
      <section className="admin-card relative isolate overflow-hidden rounded-[20px] p-0">
        {HERO && (
          <>
            <img
              src={HERO.image}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 -z-10 h-full w-full object-cover object-[65%_45%]"
              loading="eager"
              decoding="async"
            />
            {/* To lag: ett som gjør venstre side helt rent for teksten, ett som
                demper bildet overalt så det aldri konkurrerer med tallene. */}
            <div
              className="absolute inset-0 -z-10 bg-gradient-to-t from-card via-card/90 to-card/45 sm:bg-gradient-to-r sm:from-card sm:via-card/92 sm:via-45% sm:to-transparent"
              aria-hidden="true"
            />
            <div className="absolute inset-0 -z-10 bg-card/25" aria-hidden="true" />
          </>
        )}
        <div className="relative px-6 py-7 sm:px-7 sm:py-8">
          <p className="text-[13px] font-medium capitalize text-muted-foreground">{greeting}</p>
          <h1 className="mt-1 font-display text-[26px] font-semibold text-foreground sm:text-[30px]">God dag, {ownerName}</h1>
          <p className="mt-1.5 max-w-[46ch] text-[14px] leading-relaxed text-muted-foreground">
            Her er en oppsummering av HelloSky i dag. Alt er hentet fra databasen nå – ingenting er anslått.
          </p>
        </div>
      </section>

      {/* ── Periode ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Etiketten er overflødig på telefon: fem knapper der er tydelig nok,
            og de 60 pikslene avgjør om «År» får plass på samme linje. */}
        <span className="mr-1 hidden text-[13px] font-medium text-muted-foreground sm:inline">Periode</span>
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={period === p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              "h-8 rounded-[9px] border px-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              period === p.key ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-card text-foreground hover:bg-muted",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {data?.tracking.partialPeriod && (
        <p className="flex items-start gap-2.5 rounded-[12px] bg-primary-soft px-3.5 py-2.5 text-[13px] leading-snug text-accent-foreground">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Målingen startet {new Date(data.tracking.searchesSince!).toLocaleDateString("nb-NO", { day: "numeric", month: "long" })}. Tallene dekker derfor bare
          en del av perioden du har valgt.
        </p>
      )}

      {/* ── Nøkkeltall ───────────────────────────────────────────────── */}
      {q.isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : q.isError ? (
        <p role="alert" className="rounded-[12px] border border-destructive/25 bg-destructive-soft px-4 py-3 text-[13px] text-destructive">
          Tallene kunne ikke hentes.
        </p>
      ) : data ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Kpi
            icon={Search}
            label="Søk"
            value={nf.format(searches!.value)}
            trend={delta(searches!.value, searches!.previous)}
            sub={data.demand.noResults > 0 ? `${nf.format(data.demand.noResults)} uten treff` : "mot forrige periode"}
            to="/admin/rapporter"
          />
          <Kpi
            icon={MousePointerClick}
            label="Klikk til leverandør"
            value={nf.format(clicks!.value)}
            trend={delta(clicks!.value, clicks!.previous)}
            sub={data.demand.clickThrough !== null ? `${pct(data.demand.clickThrough)} av søkene` : "Ingen søk å dele på"}
          />
          <Kpi
            icon={Wallet}
            label="HelloSky-inntekt"
            value={revenue.length ? money(revenue[0]!.totalMinor, revenue[0]!.currency) : "—"}
            sub={
              revenue.length
                ? `${money(revenue[0]!.serviceFeeMinor, revenue[0]!.currency)} gebyr · ${money(revenue[0]!.paidCommissionMinor, revenue[0]!.currency)} provisjon`
                : "Gebyr og utbetalt provisjon – ingen ennå"
            }
          />
          <Kpi
            icon={Ticket}
            label="Bestillinger"
            value={nf.format(bookings!.value)}
            trend={delta(bookings!.value, bookings!.previous)}
            sub="mot forrige periode"
            to="/admin/bestillinger"
          />
        </div>
      ) : null}

      {/* ── Graf + topp ruter ────────────────────────────────────────── */}
      <div className="grid items-start gap-4 xl:grid-cols-[1.45fr_1fr]">
        <Panel title="Søk og bestillinger">
          <div className="-mt-1 mb-3 flex flex-wrap items-center gap-4">
            {[
              ["hsl(var(--chart-1))", "Søk"],
              ["hsl(var(--chart-2))", "Bestillinger"],
            ].map(([c, l]) => (
              <span key={l} className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <span className="size-[7px] rounded-full" style={{ background: c }} aria-hidden="true" />
                {l}
              </span>
            ))}
          </div>
          {series.isPending ? (
            <div className="shimmer h-[212px] rounded-xl" aria-hidden="true" />
          ) : !chartHasData ? (
            <div className="grid h-[212px] place-items-center">
              <Nothing title="Ingen aktivitet i perioden" body="Kurven tegnes så snart noen søker eller bestiller. Målingen skriver en rad for hvert søk." />
            </div>
          ) : (
            <div className="h-[212px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--chart-grid))" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--subtle))" }} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--subtle))" }} width={48} allowDecimals={false} />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--border-strong))", strokeWidth: 1 }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                      boxShadow: "0 8px 24px hsl(var(--foreground) / 0.12)",
                      fontSize: 13,
                      padding: "8px 12px",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, marginBottom: 2 }}
                  />
                  <Line type="monotone" dataKey="Søk" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} activeDot={{ r: 3.5 }} />
                  <Line type="monotone" dataKey="Bestillinger" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} activeDot={{ r: 3.5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Topp ruter" action={{ to: "/admin/rapporter", label: "Se alle" }}>
          {!data ? (
            <div className="shimmer h-40 rounded-xl" aria-hidden="true" />
          ) : data.topRoutes.length === 0 ? (
            <Nothing title="Ingen søk i perioden" body="Så snart noen søker etter en reise, dukker rutene opp her – også søkene som ikke ga treff." />
          ) : (
            <ul className="-my-1.5">
              {data.topRoutes.slice(0, 5).map((r) => (
                <li key={`${r.origin}-${r.destination}`} className="flex items-center gap-3 py-[9px]">
                  <RouteThumb iata={r.destination} />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">
                    {r.originCity} → {r.destinationCity}
                  </span>
                  <span className="admin-num shrink-0 text-[13px] text-muted-foreground">{nf.format(r.searches)} søk</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ── Trakt + hull i dekningen ─────────────────────────────────── */}
      <div className="grid items-start gap-4 xl:grid-cols-[1.45fr_1fr]">
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
                      <span className="text-[13.5px] font-medium text-foreground">{label}</span>
                      <span className="admin-num text-[14px] font-semibold text-foreground">
                        {step.measured ? nf.format(step.count) : <span className="text-[12.5px] font-medium text-subtle">måles ikke ennå</span>}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", step.measured ? "bg-primary" : "bg-border")}
                        style={{ width: `${Math.max(step.measured && step.count > 0 ? 2 : 0, Math.round(share * 100))}%` }}
                      />
                    </div>
                    {i === 3 && data.tracking.conversionsReported === 0 && (
                      <p className="mt-1.5 text-[12.5px] leading-snug text-subtle">
                        Her stopper målingen. Konverteringer kommer inn når en leverandør rapporterer dem – tabellen står klar og tom.
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>

        <Panel title="Søk uten treff">
          {!data ? (
            <div className="shimmer h-32 rounded-xl" aria-hidden="true" />
          ) : data.noResultRoutes.length === 0 ? (
            <Nothing title="Ingen tomme søk" body="Alle søk i perioden ga minst ett tilbud. Dukker det opp ruter her, mangler leverandørene dekning." />
          ) : (
            <ul className="-my-1.5">
              {data.noResultRoutes.map((r) => (
                <li key={`${r.origin}-${r.destination}`} className="flex items-center gap-3 py-[9px]">
                  <RouteThumb iata={r.destination} />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">
                    {r.originCity} → {r.destinationCity}
                  </span>
                  <span className="admin-num shrink-0 text-[13px] font-semibold text-warning">{nf.format(r.searches)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ── Leverandører ─────────────────────────────────────────────── */}
      <Panel title="Leverandører">
        {!data ? (
          <div className="shimmer h-24 rounded-xl" aria-hidden="true" />
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {data.providers.map((p) => {
              const usage = data.providerUsage.find((u) => u.provider === p.id);
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[12px] border border-border px-3.5 py-3">
                  <span className="flex items-center gap-2.5">
                    <span className={cn("size-2 shrink-0 rounded-full", p.active ? "bg-success" : "bg-border-strong")} aria-hidden="true" />
                    <span className="text-[14px] font-semibold text-foreground">{p.id}</span>
                    {p.sandbox && <span className="rounded-md bg-warning-soft px-1.5 py-0.5 text-[11px] font-semibold text-warning">sandkasse</span>}
                  </span>
                  <span className="text-[12.5px] text-subtle">
                    {usage ? `${nf.format(usage.searches)} søk · ${usage.avgMs} ms · ${nf.format(usage.errors)} feil` : "ingen søk i perioden"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* ── Penger som ikke er inntekt, og publikum ──────────────────── */}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Kpi
            icon={PlaneTakeoff}
            label="Bruttoverdi klikket videre"
            value={grossValue.length ? money(grossValue[0]!.amountMinor, grossValue[0]!.currency) : "—"}
            sub={grossValue.length ? "Reisens verdi hos leverandøren – ikke vår inntekt" : "Ingen klikk med oppgitt pris ennå"}
          />
          <Kpi
            icon={Wallet}
            label="Bekreftet, ikke utbetalt"
            value={confirmed.length ? money(confirmed[0]!.amountMinor, confirmed[0]!.currency) : "—"}
            sub={paid.length ? `${money(paid[0]!.amountMinor, paid[0]!.currency)} er utbetalt` : "Ingen leverandør har rapportert salg ennå"}
          />
          <Kpi
            icon={Users}
            label="Kunder med bestilling"
            value={nf.format(data.audience.bookingCustomers)}
            sub={`${nf.format(data.audience.newCustomers)} nye kontoer`}
            to="/admin/kunder"
          />
          <Kpi
            icon={MousePointerClick}
            label="Aktive prisvarsler"
            value={nf.format(data.audience.activePriceAlerts)}
            sub={`${nf.format(data.tracking.conversionsReported)} rapporterte konverteringer`}
          />
        </div>
      )}
    </div>
  );
}
