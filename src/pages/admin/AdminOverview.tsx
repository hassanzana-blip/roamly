import { Link } from "react-router";
import {
  Ticket,
  Wallet,
  PlaneTakeoff,
  AlertTriangle,
  MessageSquare,
  ArrowLeftRight,
  ServerCrash,
  Webhook,
  ChevronRight,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Card, EmptyState, ErrorState, LoadingRows, PageHeader, Pill, formatDateTime, formatMoney } from "./ui";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Ticket;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <p className="font-display text-2xl font-bold leading-tight text-night">{value}</p>
        </div>
      </div>
      {sub && <p className="mt-2 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

function AttentionItem({
  icon: Icon,
  label,
  count,
  to,
  danger,
}: {
  icon: typeof AlertTriangle;
  label: string;
  count: number;
  to: string;
  danger?: boolean;
}) {
  if (count === 0) return null;
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 shadow-sm transition-colors hover:border-primary/40"
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
          danger ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-700"
        }`}
      >
        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-night">{label}</span>
        <span className="block text-xs text-muted-foreground">{count} {count === 1 ? "element" : "elementer"}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

export function AdminOverview() {
  const dash = trpc.admin.dashboard.useQuery(undefined, { refetchInterval: 60_000, retry: false });

  if (dash.isLoading) {
    return (
      <div>
        <PageHeader title="Oversikt" description="Sanntidsstatus for Roamly" />
        <LoadingRows rows={5} />
      </div>
    );
  }
  if (dash.error || !dash.data) {
    return (
      <div>
        <PageHeader title="Oversikt" />
        <ErrorState message={dash.error?.message} />
      </div>
    );
  }

  const d = dash.data;
  const attentionCount =
    d.awaitingPayment + d.processing + d.reconciliation + d.failed +
    d.unassignedCases + d.pendingRefunds + d.deadJobs + d.failedWebhooks;

  return (
    <div>
      <PageHeader
        title="Oversikt"
        description="Tallene under er hentet direkte fra databasen – ingen estimater."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Ticket}
          label="Bookinger i dag"
          value={String(d.bookingsToday)}
          sub={`${d.bookingsThisWeek} siste 7 dager`}
        />
        <StatCard
          icon={Wallet}
          label="Bekreftet salg (7 dager)"
          value={formatMoney(d.confirmedSalesWeek)}
          sub="Kun bekreftede bestillinger"
        />
        <StatCard
          icon={PlaneTakeoff}
          label="Avganger neste 24 t"
          value={String(d.departures24h)}
          sub={`${d.departures72h} innen 72 timer`}
        />
        <StatCard
          icon={MessageSquare}
          label="Saker uten ansvarlig"
          value={String(d.unassignedCases)}
          sub="Åpne eller venter på kunde"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="attention-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="attention-heading" className="font-display text-lg font-bold text-night">
              Krever oppfølging
            </h2>
            {attentionCount === 0 ? (
              <Pill tone="success">Alt under kontroll</Pill>
            ) : (
              <Pill tone="warning">{attentionCount} åpne punkter</Pill>
            )}
          </div>
          {attentionCount === 0 ? (
            <EmptyState
              title="Ingenting krever oppfølging akkurat nå"
              hint="Feilede bestillinger, refusjoner og systemvarsler dukker opp her."
            />
          ) : (
            <div className="space-y-2.5">
              <AttentionItem icon={Wallet} label="Venter på betaling" count={d.awaitingPayment} to="/admin/bestillinger?state=AWAITING_PAYMENT" />
              <AttentionItem icon={Ticket} label="Bestilling under behandling" count={d.processing} to="/admin/bestillinger?state=BOOKING_PROCESSING" />
              <AttentionItem icon={AlertTriangle} label="Trenger avstemming mot Duffel" count={d.reconciliation} to="/admin/bestillinger?state=AWAITING_RECONCILIATION" />
              <AttentionItem icon={AlertTriangle} label="Bestilling feilet" count={d.failed} to="/admin/bestillinger?state=BOOKING_FAILED" danger />
              <AttentionItem icon={ArrowLeftRight} label="Refusjoner til behandling" count={d.pendingRefunds} to="/admin/refusjoner" danger />
              <AttentionItem icon={MessageSquare} label="Saker uten ansvarlig" count={d.unassignedCases} to="/admin/kundeservice?queue=unassigned" />
              <AttentionItem icon={ServerCrash} label="Døde jobber i køen" count={d.deadJobs} to="/admin/innstillinger" danger />
              <AttentionItem icon={Webhook} label="Feilede webhooks" count={d.failedWebhooks} to="/admin/innstillinger" danger />
            </div>
          )}
        </section>

        <section aria-labelledby="activity-heading">
          <h2 id="activity-heading" className="mb-3 font-display text-lg font-bold text-night">
            Siste hendelser
          </h2>
          {d.recentActivity.length === 0 ? (
            <EmptyState title="Ingen hendelser ennå" hint="Handlinger fra ansatte og systemet logges her." />
          ) : (
            <Card className="p-0">
              <ul className="divide-y divide-border">
                {d.recentActivity.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 px-5 py-3.5">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-night">
                        <span className="font-semibold">{a.actorLabel}</span>{" "}
                        <span className="text-muted-foreground">{a.action}</span>
                      </p>
                      {a.targetType && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {a.targetType}
                          {a.targetId ? ` · ${a.targetId.slice(0, 8)}…` : ""}
                        </p>
                      )}
                    </div>
                    <time className="shrink-0 text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</time>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
