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
  PlusCircle,
  MessagesSquare,
  BedDouble,
  StickyNote,
  ScanSearch,
  CalendarClock,
  ShieldAlert,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Card, EmptyState, ErrorState, LoadingRows, PageHeader, Pill } from "./ui";
import { formatDateTime, formatMoney } from "./helpers";
import { PAGE_META, usePageMeta } from "@/lib/seo";

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
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
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
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
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
  usePageMeta({ ...PAGE_META.admin, title: "Oversikt" });
  const dash = trpc.admin.dashboard.useQuery(undefined, { refetchInterval: 60_000, retry: false });

  if (dash.isLoading) {
    return (
      <div>
        <PageHeader title="Oversikt" description="Status for HelloSky akkurat nå" />
        <LoadingRows rows={5} />
      </div>
    );
  }
  if (dash.error || !dash.data) {
    return (
      <div>
        <PageHeader title="Oversikt" />
        <ErrorState error={dash.error} onRetry={() => dash.refetch()} />
      </div>
    );
  }

  const d = dash.data;
  const attentionCount =
    d.awaitingPayment + d.processing + d.reconciliation + d.failed +
    d.reviewQueue + d.openScheduleChanges + d.openFraudFlags +
    d.unassignedCases + d.pendingRefunds + d.deadJobs + d.failedWebhooks +
    d.openProblems + d.newPartnerRequests;
  const sales = d.confirmedSalesWeekByCurrency.length > 0 ? d.confirmedSalesWeekByCurrency : [{ currency: "NOK", total: "0" }];
  const [primarySales, ...otherSales] = [...sales].sort((a, b) => (a.currency === "NOK" ? -1 : b.currency === "NOK" ? 1 : 0));

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
          label={`Bekreftet salg (7 dager, ${primarySales.currency})`}
          value={formatMoney(primarySales.total, primarySales.currency)}
          sub={otherSales.length > 0 ? otherSales.map((s) => formatMoney(s.total, s.currency)).join(" · ") : "Kun bekreftede bestillinger"}
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

      <div className="mt-5 flex flex-wrap gap-2.5">
        {[
          { to: "/admin/ny-bestilling", label: "Ny manuell bestilling", icon: PlusCircle },
          { to: "/admin/gjennomgang", label: "Gjennomgangskø", icon: ScanSearch },
          { to: "/admin/meldinger", label: "Teamchat", icon: MessagesSquare },
          { to: "/admin/notater", label: "Notattavle", icon: StickyNote },
          { to: "/admin/hotell-bil", label: "Hotell og bil", icon: BedDouble },
        ].map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-white px-4 text-sm font-bold text-night shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow"
          >
            <q.icon className="h-4 w-4 text-primary" aria-hidden="true" />
            {q.label}
          </Link>
        ))}
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
              <AttentionItem icon={ScanSearch} label="Gjennomgangskø (bookinger og forsøk)" count={d.reviewQueue} to="/admin/gjennomgang" danger />
              <AttentionItem icon={CalendarClock} label="Uløste ruteendringer" count={d.openScheduleChanges} to="/admin/ruteendringer" />
              <AttentionItem icon={ShieldAlert} label="Åpne svindelflagg" count={d.openFraudFlags} to="/admin/svindel" danger />
              <AttentionItem icon={ArrowLeftRight} label="Refusjoner til behandling" count={d.pendingRefunds} to="/admin/refusjoner" danger />
              <AttentionItem icon={MessageSquare} label="Saker uten ansvarlig" count={d.unassignedCases} to="/admin/kundeservice?queue=unassigned" />
              <AttentionItem icon={BedDouble} label="Nye hotell/bil-forespørsler" count={d.newPartnerRequests} to="/admin/hotell-bil" />
              <AttentionItem icon={AlertTriangle} label="Åpne problemmeldinger" count={d.openProblems} to="/admin/problemer" danger />
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
