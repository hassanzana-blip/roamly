import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle2, CircleAlert, RefreshCw, Send, UserPlus } from "lucide-react";
import { trpc } from "@/providers/trpc";
import {
  BOOKING_STATE_LABELS,
  Card,
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  Pill,
  formatDate,
  formatDateTime,
  formatMoney,
} from "./ui";
import { cn } from "@/lib/utils";

/* ── TILBUD ─────────────────────────────────────────────────────────────── */

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Utkast",
  sent: "Sendt",
  paid: "Betalt",
  booked: "Booket",
  expired: "Utløpt",
  failed: "Feilet",
};

export function AdminQuotes() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const list = trpc.admin.quotesList.useQuery(
    { status: status || undefined, page, pageSize: 25 },
    { retry: false, placeholderData: (p) => p },
  );

  return (
    <div>
      <PageHeader
        title="Tilbud"
        description="Assistent-bookinger: opprett et tilbud fra et flytilbud (Duffel) og send betalingslenke til kunden."
      />
      <Card className="mb-4">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          aria-label="Filtrer på status"
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold text-night outline-none focus:border-primary"
        >
          <option value="">Alle statuser</option>
          {Object.entries(QUOTE_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </Card>
      {list.isLoading ? (
        <LoadingRows rows={5} />
      ) : list.error || !list.data ? (
        <ErrorState message={list.error?.message} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title="Ingen tilbud ennå" hint="Opprett tilbud fra et flysøk for kunder som vil ha hjelp til bookingen." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-5 py-3.5">Referanse</th>
                <th className="px-5 py-3.5">Kunde</th>
                <th className="px-5 py-3.5">Beløp</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Utløper</th>
                <th className="px-5 py-3.5">Opprettet av</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.data.items.map((q) => (
                <tr key={q.id} className="hover:bg-primary/[0.03]">
                  <td className="px-5 py-3.5 font-semibold text-night">{q.reference}</td>
                  <td className="px-5 py-3.5">
                    <span className="block text-night">{q.customerName}</span>
                    <span className="block text-xs text-muted-foreground">{q.customerEmail}</span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap font-semibold text-night">
                    {formatMoney(q.totalAmount, q.currency)}
                  </td>
                  <td className="px-5 py-3.5">
                    <Pill tone={q.status === "booked" ? "success" : q.status === "failed" || q.status === "expired" ? "danger" : q.status === "sent" ? "info" : "neutral"}>
                      {QUOTE_STATUS_LABELS[q.status] ?? q.status}
                    </Pill>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-muted-foreground">{formatDateTime(q.expiresAt)}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{q.creatorName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {list.data && list.data.total > 25 && (
        <Pager page={page} total={list.data.total} pageSize={25} onPage={setPage} />
      )}
    </div>
  );
}

/* ── KUNDER ─────────────────────────────────────────────────────────────── */

export function AdminCustomers() {
  const [query, setQuery] = useState("");
  const [input, setInput] = useState("");
  const [page, setPage] = useState(1);
  const list = trpc.admin.customersList.useQuery(
    { query: query || undefined, page, pageSize: 25 },
    { retry: false, placeholderData: (p) => p },
  );

  return (
    <div>
      <PageHeader
        title="Kunder"
        description="Kontaktinformasjon er maskert som standard. Full visning krever egen tillatelse og logges."
      />
      <Card className="mb-4">
        <form
          onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(input.trim()); }}
        >
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Søk på navn, e-post eller telefon …"
            aria-label="Søk i kunder"
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-night outline-none focus:border-primary sm:max-w-md"
          />
        </form>
      </Card>
      {list.isLoading ? (
        <LoadingRows rows={5} />
      ) : list.error || !list.data ? (
        <ErrorState message={list.error?.message} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title="Ingen kunder funnet" hint="Kunder opprettes automatisk ved booking." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-5 py-3.5">Navn</th>
                <th className="px-5 py-3.5">E-post</th>
                <th className="px-5 py-3.5">Telefon</th>
                <th className="px-5 py-3.5">Bookinger</th>
                <th className="px-5 py-3.5">Kunde siden</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.data.items.map((c) => (
                <tr key={c.id} className="hover:bg-primary/[0.03]">
                  <td className="px-5 py-3.5 font-semibold text-night">{c.name}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{c.email}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{c.phone}</td>
                  <td className="px-5 py-3.5 text-night">{c.bookings}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {list.data && list.data.total > 25 && (
        <Pager page={page} total={list.data.total} pageSize={25} onPage={setPage} />
      )}
    </div>
  );
}

/* ── BETALINGER ─────────────────────────────────────────────────────────── */

export function AdminPayments() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const list = trpc.admin.paymentsList.useQuery(
    { status: status || undefined, page, pageSize: 25 },
    { retry: false, placeholderData: (p) => p },
  );

  return (
    <div>
      <PageHeader
        title="Betalinger"
        description="Alle registrerte betalinger. Roamly håndterer aldri kortdata direkte – betaling skjer via betalingslenke eller manuell registrering."
      />
      <Card className="mb-4">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          aria-label="Filtrer på status"
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold text-night outline-none focus:border-primary"
        >
          <option value="">Alle statuser</option>
          <option value="pending">Venter</option>
          <option value="succeeded">Fullført</option>
          <option value="failed">Feilet</option>
        </select>
      </Card>
      {list.isLoading ? (
        <LoadingRows rows={5} />
      ) : list.error || !list.data ? (
        <ErrorState message={list.error?.message} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title="Ingen betalinger registrert" hint="Betalinger registreres når et tilbud markeres som betalt." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-5 py-3.5">Dato</th>
                <th className="px-5 py-3.5">Beløp</th>
                <th className="px-5 py-3.5">Leverandør</th>
                <th className="px-5 py-3.5">Tilknytning</th>
                <th className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.data.items.map((p) => (
                <tr key={p.id} className="hover:bg-primary/[0.03]">
                  <td className="px-5 py-3.5 whitespace-nowrap text-muted-foreground">{formatDateTime(p.createdAt)}</td>
                  <td className="px-5 py-3.5 whitespace-nowrap font-semibold text-night">{formatMoney(p.amount, p.currency)}</td>
                  <td className="px-5 py-3.5 text-night">{p.provider}</td>
                  <td className="px-5 py-3.5">
                    {p.bookingId ? (
                      <Link to={`/admin/bestillinger/${p.bookingId}`} className="font-semibold text-primary hover:underline">
                        {p.bookingReference ?? `Bestilling #${p.bookingId}`}
                      </Link>
                    ) : p.quoteReference ? (
                      <span className="text-muted-foreground">Tilbud {p.quoteReference}</span>
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <Pill tone={p.status === "succeeded" ? "success" : p.status === "failed" ? "danger" : "warning"}>
                      {p.status === "succeeded" ? "Fullført" : p.status === "failed" ? "Feilet" : "Venter"}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {list.data && list.data.total > 25 && (
        <Pager page={page} total={list.data.total} pageSize={25} onPage={setPage} />
      )}
    </div>
  );
}

/* ── ENDRINGER OG REFUSJONER ────────────────────────────────────────────── */

export function AdminRefunds() {
  const utils = trpc.useUtils();
  const list = trpc.admin.refundsList.useQuery(undefined, { retry: false });
  const [error, setError] = useState<string | null>(null);
  const process = trpc.admin.processRefund.useMutation({
    onSuccess: () => { setError(null); utils.admin.refundsList.invalidate(); },
    onError: (e) => setError(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Endringer og refusjoner"
        description="Behandling av refusjoner krever at du nylig har bekreftet identiteten din (logget inn på nytt)."
      />
      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}
      {list.isLoading ? (
        <LoadingRows rows={4} />
      ) : list.error || !list.data ? (
        <ErrorState message={list.error?.message} />
      ) : list.data.length === 0 ? (
        <EmptyState title="Ingen refusjoner" hint="Refusjonsforespørsler dukker opp her når de registreres på en betaling." />
      ) : (
        <div className="space-y-3">
          {list.data.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-display text-lg font-bold text-night">{formatMoney(r.amount, r.payment.currency)}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Forespurt av {r.requesterName} · {formatDateTime(r.createdAt)}
                </p>
                {r.reason && <p className="mt-1 max-w-xl text-sm text-night">{r.reason}</p>}
              </div>
              <div className="flex items-center gap-3">
                <Pill tone={r.status === "processed" ? "success" : r.status === "requested" ? "warning" : "neutral"}>
                  {r.status === "processed" ? "Behandlet" : r.status === "requested" ? "Til behandling" : r.status}
                </Pill>
                {r.status === "requested" && (
                  <button
                    type="button"
                    onClick={() =>
                      process.mutate({ refundId: r.id, decision: "processed", confirmFreshSession: true })
                    }
                    disabled={process.isPending}
                    className="rounded-xl bg-night px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40"
                  >
                    {process.isPending ? "Behandler …" : "Merk som behandlet"}
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── KUNDESERVICE ───────────────────────────────────────────────────────── */

const CASE_STATUS: Record<string, string> = {
  open: "Åpen",
  pending_customer: "Venter på kunde",
  resolved: "Løst",
  closed: "Lukket",
};
const QUEUES = [
  { value: "all", label: "Alle" },
  { value: "unassigned", label: "Ufordelte" },
  { value: "urgent", label: "Haster" },
  { value: "waiting", label: "Venter på kunde" },
  { value: "mine", label: "Mine saker" },
] as const;

export function AdminCases() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queue = (searchParams.get("queue") ?? "all") as (typeof QUEUES)[number]["value"];
  const [page, setPage] = useState(1);
  const list = trpc.admin.casesList.useQuery({ queue, page, pageSize: 25 }, { retry: false, placeholderData: (p) => p });

  return (
    <div>
      <PageHeader title="Kundeservice" description="Saker fra kontaktskjema og oppfølging av bestillinger." />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Sakskøer">
        {QUEUES.map((q) => (
          <button
            key={q.value}
            type="button"
            role="tab"
            aria-selected={queue === q.value}
            onClick={() => { setPage(1); setSearchParams(q.value === "all" ? {} : { queue: q.value }); }}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              queue === q.value ? "bg-night text-white" : "border border-border bg-white text-night hover:border-night/30",
            )}
          >
            {q.label}
          </button>
        ))}
      </div>
      {list.isLoading ? (
        <LoadingRows rows={5} />
      ) : list.error || !list.data ? (
        <ErrorState message={list.error?.message} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title="Ingen saker i denne køen" hint="Nye henvendelser fra kunder dukker opp her." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-5 py-3.5">Sak</th>
                <th className="px-5 py-3.5">Emne</th>
                <th className="px-5 py-3.5">Prioritet</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Ansvarlig</th>
                <th className="px-5 py-3.5">Oppdatert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.data.items.map((c) => (
                <tr key={c.id} className="hover:bg-primary/[0.03]">
                  <td className="px-5 py-3.5 font-semibold text-night">{c.reference}</td>
                  <td className="max-w-[260px] truncate px-5 py-3.5 text-night" title={c.subject}>{c.subject}</td>
                  <td className="px-5 py-3.5">
                    <Pill tone={c.priority === "urgent" ? "danger" : c.priority === "high" ? "warning" : "neutral"}>
                      {c.priority === "urgent" ? "Haster" : c.priority === "high" ? "Høy" : "Normal"}
                    </Pill>
                  </td>
                  <td className="px-5 py-3.5">
                    <Pill tone={c.status === "open" ? "info" : c.status === "resolved" || c.status === "closed" ? "success" : "warning"}>
                      {CASE_STATUS[c.status] ?? c.status}
                    </Pill>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{c.assigneeName ?? "Ikke fordelt"}</td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-muted-foreground">{formatDateTime(c.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {list.data && list.data.total > 25 && (
        <Pager page={page} total={list.data.total} pageSize={25} onPage={setPage} />
      )}
    </div>
  );
}

/* ── RAPPORTER ──────────────────────────────────────────────────────────── */

export function AdminReports() {
  const [days, setDays] = useState(30);
  const report = trpc.admin.salesReport.useQuery({ days }, { retry: false });

  if (report.isLoading) {
    return (
      <div>
        <PageHeader title="Rapporter" />
        <LoadingRows rows={5} />
      </div>
    );
  }
  if (report.error || !report.data) {
    return (
      <div>
        <PageHeader title="Rapporter" />
        <ErrorState message={report.error?.message} />
      </div>
    );
  }

  const { byDay, byState } = report.data;
  const totalSales = byDay.reduce((sum, d) => sum + Number(d.sales), 0);
  const totalBookings = byDay.reduce((sum, d) => sum + d.bookings, 0);
  const maxSales = Math.max(1, ...byDay.map((d) => Number(d.sales)));

  return (
    <div>
      <PageHeader
        title="Rapporter"
        description="Kun reelle tall fra databasen – bekreftede bestillinger."
        actions={
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label="Velg periode"
            className="rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-semibold text-night outline-none focus:border-primary"
          >
            <option value={7}>Siste 7 dager</option>
            <option value={30}>Siste 30 dager</option>
            <option value={90}>Siste 90 dager</option>
          </select>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Bekreftet salg</p>
          <p className="mt-1 font-display text-3xl font-bold text-night">{formatMoney(totalSales)}</p>
        </Card>
        <Card>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Bekreftede bookinger</p>
          <p className="mt-1 font-display text-3xl font-bold text-night">{totalBookings}</p>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="mb-4 font-display text-lg font-bold text-night">Salg per dag</h2>
        {byDay.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen bekreftede salg i perioden.</p>
        ) : (
          <div className="space-y-2">
            {byDay.map((d) => (
              <div key={d.day} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 text-muted-foreground">{formatDate(d.day)}</span>
                <div className="h-6 flex-1 overflow-hidden rounded-md bg-night/5">
                  <div
                    className="h-full rounded-md bg-primary/80"
                    style={{ width: `${Math.max(2, (Number(d.sales) / maxSales) * 100)}%` }}
                  />
                </div>
                <span className="w-28 shrink-0 text-right font-semibold text-night">{formatMoney(d.sales)}</span>
                <span className="w-16 shrink-0 text-right text-muted-foreground">{d.bookings} stk</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <h2 className="mb-4 font-display text-lg font-bold text-night">Bestillinger per status</h2>
        {byState.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen bestillinger i perioden.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {byState.map((s) => (
              <li key={s.state} className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm">
                <span className="text-night">{BOOKING_STATE_LABELS[s.state] ?? s.stateLabel}</span>
                <span className="font-bold text-night">{s.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ── AKTIVITETSLOGG ─────────────────────────────────────────────────────── */

export function AdminAudit() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const list = trpc.admin.auditList.useQuery(
    { action: action || undefined, page, pageSize: 50 },
    { retry: false, placeholderData: (p) => p },
  );

  return (
    <div>
      <PageHeader
        title="Aktivitetslogg"
        description="Uforanderlig logg over alle handlinger i systemet. Loggen kan ikke redigeres eller slettes."
      />
      <Card className="mb-4">
        <input
          type="search"
          value={action}
          onChange={(e) => { setPage(1); setAction(e.target.value); }}
          placeholder="Filtrer på handling, f.eks. booking. eller auth. …"
          aria-label="Filtrer aktivitetslogg"
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-night outline-none focus:border-primary sm:max-w-md"
        />
      </Card>
      {list.isLoading ? (
        <LoadingRows rows={6} />
      ) : list.error || !list.data ? (
        <ErrorState message={list.error?.message} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title="Ingen logglinjer funnet" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-5 py-3.5">Tidspunkt</th>
                <th className="px-5 py-3.5">Aktør</th>
                <th className="px-5 py-3.5">Handling</th>
                <th className="px-5 py-3.5">Mål</th>
                <th className="px-5 py-3.5">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.data.items.map((a) => (
                <tr key={a.id} className="hover:bg-primary/[0.03]">
                  <td className="px-5 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(a.createdAt)}</td>
                  <td className="px-5 py-3 text-night">{a.actorLabel ?? a.actorType}</td>
                  <td className="px-5 py-3 font-mono text-xs text-night">{a.action}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {a.targetType ?? "–"}{a.targetId ? ` #${a.targetId}` : ""}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{a.ip ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {list.data && list.data.total > 50 && (
        <Pager page={page} total={list.data.total} pageSize={50} onPage={setPage} />
      )}
    </div>
  );
}

/* ── INNSTILLINGER / SYSTEM ─────────────────────────────────────────────── */

function StatusRow({ ok, label, okText, badText }: { ok: boolean; label: string; okText: string; badText: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <span className="text-night">{label}</span>
      <Pill tone={ok ? "success" : "danger"}>
        {ok ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <CircleAlert className="h-3 w-3" aria-hidden="true" />}
        {ok ? okText : badText}
      </Pill>
    </li>
  );
}

export function AdminSettings() {
  const utils = trpc.useUtils();
  const status = trpc.admin.systemStatus.useQuery(undefined, { retry: false });
  const jobs = trpc.admin.jobsList.useQuery({ status: "dead" }, { retry: false });
  const webhooks = trpc.admin.webhookEventsList.useQuery(undefined, { retry: false });
  const staff = trpc.staffAuth.listStaff.useQuery(undefined, { retry: false });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("SUPPORT");
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const retry = trpc.admin.retryJobAction.useMutation({
    onSuccess: () => utils.admin.jobsList.invalidate(),
  });
  const invite = trpc.staffAuth.createInvite.useMutation({
    onSuccess: (r) => {
      setInviteError(null);
      setInviteResult(r.setupUrl);
      setInviteEmail("");
      setInviteName("");
      utils.staffAuth.listStaff.invalidate();
    },
    onError: (e) => { setInviteResult(null); setInviteError(e.message); },
  });

  return (
    <div>
      <PageHeader title="Innstillinger" description="Systemstatus, integrasjoner, ansatte og jobbkø." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-display text-lg font-bold text-night">Systemstatus</h2>
          {status.isLoading ? (
            <p className="text-sm text-muted-foreground">Laster …</p>
          ) : status.error || !status.data ? (
            <ErrorState message={status.error?.message} />
          ) : (
            <ul className="divide-y divide-border">
              <StatusRow ok={status.data.duffelConfigured} label="Duffel API" okText={status.data.duffelLive ? "Live-modus" : "Testmodus"} badText="Ikke konfigurert" />
              <StatusRow ok={status.data.smtpConfigured} label="E-post (SMTP)" okText="Konfigurert" badText="Mangler" />
              <StatusRow ok={status.data.webhookConfigured} label="Duffel webhooks" okText="Signaturverifisering på" badText="Mangler hemmelighet" />
              <StatusRow ok={!status.data.publicInstantBooking} label="Direktebooking fra nettsiden" okText="Av (anbefalt)" badText="På" />
              <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-night">Miljø</span>
                <Pill tone={status.data.environment === "production" ? "danger" : "warning"}>
                  {status.data.environment === "production" ? "Produksjon" : status.data.environment}
                </Pill>
              </li>
              <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-night">App-URL</span>
                <span className="text-muted-foreground">{status.data.appBaseUrl}</span>
              </li>
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-display text-lg font-bold text-night">Ansatte</h2>
          {staff.isLoading ? (
            <p className="text-sm text-muted-foreground">Laster …</p>
          ) : staff.error || !staff.data ? (
            <p className="text-sm text-muted-foreground">{staff.error?.message ?? "Krever tilgang til personaladministrasjon."}</p>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {staff.data.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div>
                      <p className="font-semibold text-night">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill tone="info">{s.role}</Pill>
                      <Pill tone={s.status === "active" ? "success" : "warning"}>
                        {s.status === "active" ? "Aktiv" : s.status === "invited" ? "Invitert" : "Deaktivert"}
                      </Pill>
                    </div>
                  </li>
                ))}
              </ul>
              <form
                className="mt-4 space-y-3 border-t border-border pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (inviteEmail.trim() && inviteName.trim()) {
                    invite.mutate({ email: inviteEmail.trim(), name: inviteName.trim(), role: inviteRole as never });
                  }
                }}
              >
                <p className="flex items-center gap-2 text-sm font-semibold text-night">
                  <UserPlus className="h-4 w-4 text-primary" aria-hidden="true" /> Inviter ny ansatt
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Navn"
                    aria-label="Navn på ny ansatt"
                    className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-night outline-none focus:border-primary"
                  />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="E-post"
                    aria-label="E-post til ny ansatt"
                    className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-night outline-none focus:border-primary"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    aria-label="Rolle for ny ansatt"
                    className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold text-night outline-none focus:border-primary"
                  >
                    <option value="SUPPORT">Kundeservice</option>
                    <option value="FINANCE">Økonomi</option>
                    <option value="READ_ONLY">Kun lesing</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                  <button
                    type="submit"
                    disabled={invite.isPending || !inviteEmail.trim() || !inviteName.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-night px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    {invite.isPending ? "Oppretter …" : "Lag invitasjon"}
                  </button>
                </div>
                {inviteError && <p role="alert" className="text-sm font-semibold text-rose-600">{inviteError}</p>}
                {inviteResult && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-sm font-semibold text-emerald-800">
                      Engangslenke opprettet – send denne sikkert til den ansatte (vises kun nå):
                    </p>
                    <p className="mt-1.5 select-all break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-night">
                      {inviteResult}
                    </p>
                  </div>
                )}
              </form>
            </>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-display text-lg font-bold text-night">Feilede jobber</h2>
          {jobs.isLoading ? (
            <p className="text-sm text-muted-foreground">Laster …</p>
          ) : jobs.error || !jobs.data ? (
            <p className="text-sm text-muted-foreground">{jobs.error?.message ?? "Krever tilgang."}</p>
          ) : jobs.data.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Ingen døde jobber – køen er frisk.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {jobs.data.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm">
                  <div>
                    <p className="font-mono text-xs font-semibold text-night">{j.type}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {j.attempts} forsøk · {formatDateTime(j.updatedAt)}
                    </p>
                    {j.lastError && <p className="mt-1 max-w-xs truncate text-xs text-rose-600" title={j.lastError}>{j.lastError}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => retry.mutate({ jobId: j.id })}
                    disabled={retry.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-night hover:border-primary/40 disabled:opacity-40"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Prøv igjen
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-display text-lg font-bold text-night">Siste webhooks fra Duffel</h2>
          {webhooks.isLoading ? (
            <p className="text-sm text-muted-foreground">Laster …</p>
          ) : webhooks.error || !webhooks.data ? (
            <p className="text-sm text-muted-foreground">{webhooks.error?.message ?? "Krever tilgang."}</p>
          ) : webhooks.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen webhooks mottatt ennå.</p>
          ) : (
            <ul className="space-y-2">
              {webhooks.data.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-2.5 text-sm">
                  <div>
                    <p className="font-mono text-xs font-semibold text-night">{w.eventType}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(w.createdAt)}</p>
                  </div>
                  <Pill tone={w.status === "processed" ? "success" : w.status === "failed" ? "danger" : "warning"}>
                    {w.status}
                  </Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ── Felles paginering ──────────────────────────────────────────────────── */

function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <p>Side {page} av {totalPages} · {total} totalt</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded-xl border border-border bg-white px-3 py-2 font-semibold text-night disabled:opacity-40"
        >
          Forrige
        </button>
        <button
          type="button"
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="rounded-xl border border-border bg-white px-3 py-2 font-semibold text-night disabled:opacity-40"
        >
          Neste
        </button>
      </div>
    </div>
  );
}
