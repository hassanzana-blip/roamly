import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Card, ErrorState, LoadingRows } from "../ui";
import { formatMinor, formatMoney } from "../helpers";
import { cn } from "@/lib/utils";

/**
 * Fire spørsmål, fire paneler.
 *
 * Går det bedre enn sist, hvilke ruter tjener vi på, hvorfor refunderer vi, og
 * hvor faller folk fra i kassa. Ingen av dem er pyntet: mangler tallet, står
 * det at det mangler. Et diagram som fyller seg selv med anslag ser like
 * troverdig ut som et ekte, og det er nettopp problemet.
 *
 * Alle grafene er bygget av divs og bredder i prosent i stedet for et
 * tegnebibliotek. Det gir tallet ved siden av søyla, tastaturfokus der det
 * hører hjemme, og en side som ikke laster et helt diagrambibliotek for å vise
 * åtte rader.
 */

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** Andel av det største tallet i settet – søylas bredde, ikke en prosentandel. */
function share(value: number, max: number): string {
  return `${max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0}%`;
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card>
      <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
      {hint && <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function Nothing({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

/* ── Salg mot forrige periode ────────────────────────────────────────────── */

function Trend({ data, currency, days }: { data: NonNullable<ReturnType<typeof useInsights>["data"]>; currency: string; days: number }) {
  const pick = (rows: { currency: string; total: string; bookings: number }[]) => {
    const row = rows.find((r) => r.currency === currency);
    return { total: Number(row?.total ?? 0), bookings: row?.bookings ?? 0 };
  };
  const now = pick(data.sales.current);
  const prev = pick(data.sales.previous);
  const year = pick(data.sales.lastYear);

  const delta = prev.total > 0 ? Math.round(((now.total - prev.total) / prev.total) * 100) : null;
  const max = Math.max(now.total, prev.total, year.total, 1);

  const bars = [
    { label: `Samme periode i fjor`, value: year.total, n: year.bookings, missing: year.bookings === 0, tone: "bg-muted-foreground/25" },
    { label: `Forrige ${days} dager`, value: prev.total, n: prev.bookings, missing: false, tone: "bg-muted-foreground/40" },
    { label: `Siste ${days} dager`, value: now.total, n: now.bookings, missing: false, tone: "bg-[hsl(var(--skyline))]" },
  ];

  return (
    <Panel title="Salg mot forrige periode" hint={`Bekreftet salg i ${currency}.`}>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-display text-3xl font-semibold text-foreground">{formatMoney(now.total, currency)}</span>
        {delta === null ? (
          <span className="text-sm text-muted-foreground">ingen salg forrige periode å måle mot</span>
        ) : (
          <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold", delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground")}>
            {delta > 0 ? <ArrowUpRight className="size-4" aria-hidden="true" /> : delta < 0 ? <ArrowDownRight className="size-4" aria-hidden="true" /> : <Minus className="size-4" aria-hidden="true" />}
            {delta > 0 ? "+" : ""}
            {delta} % mot forrige {days} dager
          </span>
        )}
      </p>

      <ul className="mt-5 space-y-3">
        {bars.map((b) => (
          <li key={b.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{b.label}</span>
              <span className="tabular-nums font-semibold text-foreground">
                {b.missing ? <span className="font-normal text-muted-foreground">ingen data</span> : formatMoney(b.value, currency)}
              </span>
            </div>
            {/* Mangler tallet, tegner vi ingen søyle – heller ikke en tom
                skinne. En tom skinne leses som «vi solgte ingenting», og det
                er noe annet enn «vi vet ikke». */}
            {b.missing ? (
              <div className="mt-1.5 h-2 rounded-full border border-dashed border-border" />
            ) : (
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", b.tone)} style={{ width: share(b.value, max) }} />
              </div>
            )}
            {!b.missing && <p className="mt-1 text-[12px] text-muted-foreground">{b.n} bestillinger</p>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ── Ruter, rangert på margin ────────────────────────────────────────────── */

function Routes({ routes }: { routes: NonNullable<ReturnType<typeof useInsights>["data"]>["routes"] }) {
  const max = Math.max(...routes.map((r) => r.feeMinor), 1);
  return (
    <Panel title="Ruter etter margin" hint="Rangert på servicegebyr – det er det vi tjener. Billettprisen går videre til flyselskapet.">
      {routes.length === 0 ? (
        <Nothing>Ingen bekreftede bestillinger med registrerte strekninger i perioden.</Nothing>
      ) : (
        <ul className="space-y-3.5">
          {routes.map((r) => (
            <li key={`${r.label}-${r.currency}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-semibold text-foreground">{r.label}</span>
                  <span className="ml-2 truncate text-[12px] text-muted-foreground">{r.city}</span>
                </span>
                <span className="shrink-0 tabular-nums text-sm font-semibold text-foreground">{formatMinor(r.feeMinor, r.currency)}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-[hsl(var(--skyline))]" style={{ width: share(r.feeMinor, max) }} />
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {r.bookings} {r.bookings === 1 ? "bestilling" : "bestillinger"} · omsetning {formatMoney(r.revenue, r.currency)}
                {r.feeMinor === 0 && " · gebyret ligger på tilbudet, ikke på kassa-sesjonen"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ── Refusjonsårsaker ────────────────────────────────────────────────────── */

function Refunds({ refunds }: { refunds: NonNullable<ReturnType<typeof useInsights>["data"]>["refunds"] }) {
  const total = refunds.reduce((s, r) => s + r.count, 0);
  const max = Math.max(...refunds.map((r) => r.count), 1);
  return (
    <Panel title="Hvorfor vi refunderer" hint="Registrert årsak på refusjonssaken – ikke fritekstfeltet, som ikke lar seg telle.">
      {refunds.length === 0 ? (
        <Nothing>Ingen refusjonssaker i perioden.</Nothing>
      ) : (
        <ul className="space-y-3.5">
          {refunds.map((r) => (
            <li key={r.kind}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-foreground">{r.label}</span>
                <span className="shrink-0 tabular-nums font-semibold text-foreground">
                  {r.count} <span className="font-normal text-muted-foreground">({pct(r.count, total)} %)</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-warning" style={{ width: share(r.count, max) }} />
              </div>
              {r.amountMinor > 0 && <p className="mt-1 text-[12px] text-muted-foreground">Refundert {formatMinor(r.amountMinor)}</p>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ── Trakten i kassa ─────────────────────────────────────────────────────── */

function Funnel({ funnel }: { funnel: NonNullable<ReturnType<typeof useInsights>["data"]>["funnel"] }) {
  const { started, confirmed, steps, dropouts } = funnel;
  return (
    <Panel title="Fra kassa til bekreftelse" hint={started > 0 ? `${pct(confirmed, started)} % av dem som startet, fullførte.` : undefined}>
      {started === 0 ? (
        <Nothing>Ingen startet kassa i perioden.</Nothing>
      ) : (
        <>
          <ol className="space-y-3">
            {steps.map((s, i) => {
              const before = i === 0 ? null : steps[i - 1].count;
              const lost = before === null ? 0 : before - s.count;
              return (
                <li key={s.key}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-foreground">{s.label}</span>
                    <span className="shrink-0 tabular-nums font-semibold text-foreground">{s.count}</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-[hsl(var(--skyline))]" style={{ width: share(s.count, started) }} />
                  </div>
                  {lost > 0 && (
                    <p className="mt-1 text-[12px] text-destructive">
                      −{lost} falt fra her ({pct(lost, before!)} %)
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
          {dropouts.length > 0 && (
            <p className="mt-4 border-t border-border pt-3 text-[12px] text-muted-foreground">
              Registrert frafall: {dropouts.map((d) => `${DROPOUT_LABELS[d.status] ?? d.status} ${d.count}`).join(" · ")}
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

const DROPOUT_LABELS: Record<string, string> = {
  expired: "utløpt",
  failed: "feilet",
  cancelled: "avbrutt",
  price_changed: "prisen endret seg",
};

/* ── Når folk bestiller ──────────────────────────────────────────────────── */

const WEEKDAYS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

function Heatmap({ cells }: { cells: NonNullable<ReturnType<typeof useInsights>["data"]>["heatmap"] }) {
  const grid = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cells) m.set(`${c.weekday}:${c.hour}`, c.count);
    return m;
  }, [cells]);
  const max = Math.max(...cells.map((c) => c.count), 1);
  const total = cells.reduce((s, c) => s + c.count, 0);

  return (
    <Panel title="Når på uka folk bestiller" hint="Bekreftede bestillinger, etter når de ble opprettet. Nyttig når vaktlista skal settes.">
      {total === 0 ? (
        <Nothing>Ingen bekreftede bestillinger i perioden.</Nothing>
      ) : (
        <div className="overflow-x-auto">
          {/* `table-fixed` er poenget: uten den fordeler nettleseren bredden
              etter innhold, og siden cellene er tomme kollapser de rolige
              timene mens de travle sluker plassen. Da er det ikke lenger et
              rutenett, bare et mønster. */}
          <table className="w-full min-w-[620px] table-fixed border-separate border-spacing-[2px]">
            <caption className="sr-only">Antall bestillinger per ukedag og klokketime</caption>
            <thead>
              <tr>
                <th className="w-11" />
                {Array.from({ length: 24 }, (_, h) => (
                  <th key={h} scope="col" className="pb-1 text-[10px] font-normal tabular-nums text-muted-foreground">
                    {h % 3 === 0 ? h : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map((day, d) => (
                <tr key={day}>
                  <th scope="row" className="pr-2 text-right text-[11px] font-medium text-muted-foreground">
                    {day}
                  </th>
                  {Array.from({ length: 24 }, (_, h) => {
                    const n = grid.get(`${d}:${h}`) ?? 0;
                    return (
                      <td
                        key={h}
                        // Tallet står i tittelen, ikke bare i fargen: en graf som
                        // bare snakker i nyanser er ubrukelig for den som ikke
                        // ser forskjell på dem.
                        title={`${day} kl. ${String(h).padStart(2, "0")} – ${n} ${n === 1 ? "bestilling" : "bestillinger"}`}
                        className="h-6 rounded-[3px] bg-[hsl(var(--skyline))] text-center align-middle"
                        style={{ opacity: n === 0 ? 0.06 : 0.2 + (n / max) * 0.8 }}
                      >
                        <span className="sr-only">{`${day} kl. ${h}: ${n}`}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ── Siden ───────────────────────────────────────────────────────────────── */

function useInsights(days: number) {
  return trpc.admin.insights.useQuery({ days }, { retry: false, placeholderData: (p) => p });
}

export function ReportCharts({ days, currency }: { days: number; currency: string }) {
  const q = useInsights(days);

  if (q.isLoading) return <LoadingRows rows={4} />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  return (
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2 [&>*]:min-w-0">
      <Trend data={q.data} currency={currency} days={days} />
      <Funnel funnel={q.data.funnel} />
      <Routes routes={q.data.routes} />
      <Refunds refunds={q.data.refunds} />
      {/* `min-w-0`: rutenettceller er som standard like brede som innholdet
          sitt, så en tabell med minstebredde dytter hele siden sidelengs i
          stedet for å rulle inni sin egen ramme. */}
      <div className="min-w-0 lg:col-span-2">
        <Heatmap cells={q.data.heatmap} />
      </div>
    </div>
  );
}
