import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { trpc } from "@/providers/trpc";
import { Card, ErrorState, LoadingRows, PageHeader } from "../ui";
import { BOOKING_STATE_LABELS, formatDate, formatMinor, formatMoney, selectCls, tdCls, thCls } from "../helpers";

export function AdminReports() {
  const [days, setDays] = useState(30);
  const report = trpc.admin.salesReport.useQuery({ days }, { retry: false });
  const data = report.data;

  const currencies = useMemo(() => {
    if (!data) return [] as string[];
    const set = new Set<string>();
    data.totals.forEach((t) => set.add(t.currency));
    data.byDay.forEach((d) => set.add(d.currency));
    data.serviceFees.forEach((f) => set.add(f.currency));
    return [...set].sort((a, b) => (a === "NOK" ? -1 : b === "NOK" ? 1 : a.localeCompare(b)));
  }, [data]);

  const [currency, setCurrency] = useState<string | null>(null);
  const activeCurrency = currency ?? currencies[0] ?? "NOK";

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.byDay
      .filter((d) => d.currency === activeCurrency)
      .map((d) => ({ day: d.day, label: formatDate(d.day), sales: Number(d.sales), bookings: d.bookings }));
  }, [data, activeCurrency]);

  if (report.isLoading) {
    return (
      <div>
        <PageHeader title="Rapporter" />
        <LoadingRows rows={5} />
      </div>
    );
  }
  if (report.error || !data) {
    return (
      <div>
        <PageHeader title="Rapporter" />
        <ErrorState error={report.error} onRetry={() => report.refetch()} />
      </div>
    );
  }

  const feeFor = (cur: string) => data.serviceFees.find((f) => f.currency === cur)?.totalMinor ?? 0;
  const totalBookings = data.totals.reduce((s, t) => s + t.bookings, 0);

  return (
    <div>
      <PageHeader
        title="Rapporter"
        description="Kun reelle tall fra databasen – bekreftede bestillinger, gruppert per valuta."
        actions={
          <>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Velg periode" className={selectCls}>
              <option value={7}>Siste 7 dager</option>
              <option value={30}>Siste 30 dager</option>
              <option value={90}>Siste 90 dager</option>
            </select>
            {currencies.length > 1 && (
              <select value={activeCurrency} onChange={(e) => setCurrency(e.target.value)} aria-label="Velg valuta for graf" className={selectCls}>
                {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="eyebrow">Bekreftede bookinger</p>
          <p className="mt-1 font-display text-3xl font-semibold text-foreground">{totalBookings}</p>
        </Card>
        {data.totals.map((t) => (
          <Card key={t.currency}>
            <p className="eyebrow">Bekreftet salg ({t.currency})</p>
            <p className="mt-1 font-display text-3xl font-semibold text-foreground">{formatMoney(t.total, t.currency)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.bookings} bookinger · servicegebyr {formatMinor(feeFor(t.currency), t.currency)}</p>
          </Card>
        ))}
        <Card className="border-primary/30 bg-primary/[0.04]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-primary">Gebyr fra tilbud og manuelle salg</p>
          <p className="mt-1 font-display text-3xl font-semibold text-primary">{formatMoney(Number(data.quoteFees) + Number(data.manualFees))}</p>
          <p className="mt-1 text-xs text-muted-foreground">Tilbud {formatMoney(data.quoteFees)} · manuelt {formatMoney(data.manualFees)}</p>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="mb-4 font-display text-xl font-semibold text-foreground">Salg per dag ({activeCurrency})</h2>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen bekreftede salg i perioden.</p>
        ) : (
          <div className="h-64 w-full" role="img" aria-label={`Søylediagram over salg per dag i ${activeCurrency}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => new Intl.NumberFormat("nb-NO", { notation: "compact" }).format(v)} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--primary) / 0.08)" }}
                  formatter={(v, name) => [name === "sales" ? formatMoney(Number(v), activeCurrency) : String(v ?? ""), name === "sales" ? "Salg" : "Bookinger"]}
                  labelFormatter={(l) => String(l)}
                />
                <Bar dataKey="sales" fill="hsl(var(--skyline))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-x-auto p-0">
          <h2 className="px-5 pt-5 font-display text-xl font-semibold text-foreground">Per valuta</h2>
          <table className="mt-3 w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={thCls}>Valuta</th>
                <th className={thCls}>Bookinger</th>
                <th className={thCls}>Salg</th>
                <th className={thCls}>Servicegebyr</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.totals.length === 0 ? (
                <tr><td colSpan={4} className={`${tdCls} text-muted-foreground`}>Ingen salg i perioden.</td></tr>
              ) : (
                data.totals.map((t) => (
                  <tr key={t.currency}>
                    <td className={`${tdCls} font-semibold text-foreground`}>{t.currency}</td>
                    <td className={`${tdCls} text-foreground`}>{t.bookings}</td>
                    <td className={`${tdCls} whitespace-nowrap text-foreground`}>{formatMoney(t.total, t.currency)}</td>
                    <td className={`${tdCls} whitespace-nowrap text-foreground`}>{formatMinor(feeFor(t.currency), t.currency)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>

        <Card>
          <h2 className="mb-4 font-display text-xl font-semibold text-foreground">Bestillinger per status</h2>
          {data.byState.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen bestillinger i perioden.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.byState.map((s) => (
                <li key={s.state} className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm">
                  <span className="text-foreground">{BOOKING_STATE_LABELS[s.state] ?? s.stateLabel}</span>
                  <span className="font-semibold text-foreground">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

export function AdminAudit() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<number | null>(null);
  const list = trpc.admin.auditList.useQuery({ action: action || undefined, page, pageSize: 50 }, { retry: false, placeholderData: (p) => p });

  return (
    <div>
      <PageHeader title="Aktivitetslogg" description="Uforanderlig logg over alle handlinger i systemet. Loggen kan ikke redigeres eller slettes." />
      <Card className="mb-4">
        <input
          type="search"
          value={action}
          onChange={(e) => { setPage(1); setAction(e.target.value); }}
          placeholder="Filtrer på handling, f.eks. booking. eller auth. …"
          aria-label="Filtrer aktivitetslogg"
          className="min-h-11 w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary sm:max-w-md"
        />
      </Card>
      {list.isLoading ? (
        <LoadingRows rows={6} />
      ) : list.error || !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyAudit />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">Aktivitetslogg</caption>
            <thead>
              <tr className="border-b border-border">
                <th className={thCls}>Tidspunkt</th>
                <th className={thCls}>Aktør</th>
                <th className={thCls}>Handling</th>
                <th className={thCls}>Mål</th>
                <th className={thCls}>IP</th>
                <th className={thCls}><span className="sr-only">Detaljer</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.data.items.map((a) => (
                <AuditRow key={a.id} row={a} expanded={expanded === a.id} onToggle={() => setExpanded(expanded === a.id ? null : a.id)} />
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {list.data && list.data.total > 50 && (
        <PagerBar page={page} total={list.data.total} onPage={setPage} />
      )}
    </div>
  );
}

function EmptyAudit() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-white/60 px-6 py-12 text-center">
      <p className="font-semibold text-foreground">Ingen logglinjer funnet</p>
    </div>
  );
}

function PagerBar({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / 50));
  return (
    <nav className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground" aria-label="Paginering">
      <p>Side {page} av {totalPages} · {total} totalt</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1} className="min-h-11 rounded-xl border border-border bg-card px-3 font-semibold text-foreground disabled:opacity-40">Forrige</button>
        <button type="button" onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="min-h-11 rounded-xl border border-border bg-card px-3 font-semibold text-foreground disabled:opacity-40">Neste</button>
      </div>
    </nav>
  );
}

type AuditItem = { id: number; createdAt: Date | string; actorLabel: string | null; actorType: string; action: string; targetType: string | null; targetId: string | null; ip: string | null; metadataJson: string | null };

function AuditRow({ row: a, expanded, onToggle }: { row: AuditItem; expanded: boolean; onToggle: () => void }) {
  let meta: unknown = null;
  if (expanded && a.metadataJson) {
    try { meta = JSON.parse(a.metadataJson); } catch { meta = a.metadataJson; }
  }
  return (
    <>
      <tr className="hover:bg-primary/[0.03]">
        <td className={`${tdCls} whitespace-nowrap text-muted-foreground`}>{formatDateTimeLocal(a.createdAt)}</td>
        <td className={`${tdCls} text-foreground`}>{a.actorLabel ?? a.actorType}</td>
        <td className={`${tdCls} font-mono text-xs text-foreground`}>{a.action}</td>
        <td className={`${tdCls} text-muted-foreground`}>{a.targetType ?? "–"}{a.targetId ? ` #${a.targetId}` : ""}</td>
        <td className={`${tdCls} text-muted-foreground`}>{a.ip ?? "–"}</td>
        <td className={tdCls}>
          {a.metadataJson && (
            <button type="button" onClick={onToggle} aria-expanded={expanded} className="min-h-9 rounded-lg px-2 text-xs font-semibold text-primary hover:underline">
              {expanded ? "Skjul" : "Detaljer"}
            </button>
          )}
        </td>
      </tr>
      {expanded && meta != null && (
        <tr className="bg-muted/40">
          <td colSpan={6} className="px-5 py-3">
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-foreground">{typeof meta === "string" ? meta : JSON.stringify(meta, null, 2)}</pre>
          </td>
        </tr>
      )}
    </>
  );
}

function formatDateTimeLocal(v: Date | string) {
  const d = v instanceof Date ? v : new Date(v);
  return new Intl.DateTimeFormat("nb-NO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(d);
}
