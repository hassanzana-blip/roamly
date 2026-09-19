import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, ChevronRight, FileText, Lightbulb, MailWarning, Plus, Search, UserRound } from "lucide-react";
import { imageSrcSet } from "@/content/discover";
import { formatDayMonth } from "@/lib/format";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import Icon from "@/components/app/Icon";
import { EmptyState } from "@/components/app/primitives";
import { Segmented } from "@/components/ui/segmented";
import { TripCard } from "@/components/account/TripCard";
import { NoTripsSpot } from "@/components/graphics";
import { useCustomer } from "@/lib/useCustomer";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { appCodeOf, humanMessage } from "@/lib/apiError";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";

/**
 * Reiser – kommandosenteret. Kommende, tidligere og kansellerte fra ekte
 * bestillinger på kontoen. Gjester sendes til oppslaget med referanse.
 */

type Tab = "upcoming" | "past" | "cancelled";

export default function Trips() {
  usePageMeta(PAGE_META.trips);
  const t = useT();
  const { customer, isLoading } = useCustomer();
  const [tab, setTab] = useState<Tab>("upcoming");
  const trips = trpc.customerAuth.myTrips.useQuery(undefined, { enabled: Boolean(customer), retry: 0 });
  const plans = trpc.tripPlans.list.useQuery(undefined, { enabled: Boolean(customer), retry: false, staleTime: 30_000 });
  const resend = trpc.customerAuth.resendVerification.useMutation();
  const errCode = trips.error ? appCodeOf(trips.error) : null;

  // Ett «nå» per sidevisning – rene render, stabil gruppering.
  const [now] = useState(() => Date.now());
  const all = trips.data ?? [];
  const groups: Record<Tab, typeof all> = {
    upcoming: all.filter((x) => !x.cancelledAt && x.state !== "CANCELLED" && Date.parse(x.departingAt) >= now - 6 * 3_600_000).sort((a, b) => a.departingAt.localeCompare(b.departingAt)),
    past: all.filter((x) => !x.cancelledAt && x.state !== "CANCELLED" && Date.parse(x.departingAt) < now - 6 * 3_600_000),
    cancelled: all.filter((x) => Boolean(x.cancelledAt) || x.state === "CANCELLED"),
  };
  const rows = groups[tab];

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell className="max-w-2xl">
        <AppHeader title={t("tr.title")} as="h1" />

        {!isLoading && !customer && (
          <Link to="/logg-inn?next=/reiser" className="mb-6 flex items-center gap-3.5 rounded-xl bg-night p-5 text-white transition-colors hover:bg-[hsl(240,6%,14%)]">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Icon icon={UserRound} size={20} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold">{t("tr.login")}</span>
              <span className="block text-[13px] text-white/60">{t("tr.loginsub")}</span>
            </span>
            <Icon icon={ChevronRight} size={20} className="shrink-0 text-white/60" />
          </Link>
        )}

        {customer && errCode === "EMAIL_NOT_VERIFIED" && (
          <section className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300/60 bg-warning/10 p-5">
            <Icon icon={MailWarning} size={20} className="mt-0.5 shrink-0 text-warning" />
            <div>
              <p className="font-semibold text-warning">{t("mt.verify.title")}</p>
              <p className="mt-1 text-sm text-warning">{t("mt.verify.body", { email: customer.email ?? "" })}</p>
              <button type="button" onClick={() => resend.mutate()} disabled={resend.isPending || resend.isSuccess} className="mt-2 min-h-11 rounded-lg bg-night px-5 text-sm font-semibold text-white disabled:opacity-60">
                {resend.isSuccess ? t("common.sent") : t("common.resendlink")}
              </button>
              {resend.isError && <p role="alert" className="mt-2 text-xs text-destructive">{humanMessage(resend.error)}</p>}
            </div>
          </section>
        )}

        {customer && (
          <>
            <Segmented aria-label={t("tr.title")} value={tab} onValueChange={(v) => setTab(v as Tab)} options={[{ value: "upcoming", label: t("tr.upcoming") }, { value: "past", label: t("tr.past") }, { value: "cancelled", label: t("tr.cancelled") }]} className="mb-5 w-auto" />
            {trips.isLoading ? (
              <div className="space-y-2" aria-busy="true"><div className="shimmer h-20 rounded-xl" /><div className="shimmer h-20 rounded-xl" /></div>
            ) : rows.length === 0 ? (
              <EmptyState
                illustration={<NoTripsSpot />}
                title={t(tab === "upcoming" ? "tr.empty.upcoming" : tab === "past" ? "tr.empty.past" : "tr.empty.cancelled")}
                body={tab === "upcoming" ? t("tr.empty.upcomingsub") : undefined}
                action={tab === "upcoming" ? <Link to="/" className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-night px-5 text-[14px] font-semibold text-white">{t("tr.search")} <Icon icon={ArrowRight} size={16} /></Link> : undefined}
              />
            ) : (
              <ul className="space-y-3">
                {rows.map((trip) => (
                  <li key={trip.orderId}>
                    <TripCard trip={trip} bucket={tab} className={cn(tab === "cancelled" && "opacity-80")} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {customer && (
          <section className="mt-10" aria-labelledby="plans-h">
            <div className="mb-3 flex items-end justify-between gap-3">
              <h2 id="plans-h" className="t-h2">{t("plan.list.title")}</h2>
              <Link to="/reiser/plan/ny" className="inline-flex min-h-10 items-center gap-1 text-[14px] font-semibold text-accent-foreground hover:underline"><Icon icon={Plus} size={16} /> {t("plan.list.new")}</Link>
            </div>
            {plans.isLoading ? (
              <div className="shimmer h-20 rounded-xl" aria-busy="true" />
            ) : plans.data?.length ? (
              <ul className="space-y-2">
                {plans.data.map((p) => (
                  <li key={p.id}>
                    <Link to={`/reiser/plan/${p.id}`} className="press flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-foreground/25">
                      <span className="size-14 shrink-0 overflow-hidden rounded-lg bg-mint">
                        {p.destination?.image ? <img src={p.destination.image} srcSet={imageSrcSet(p.destination.image)} sizes="56px" alt="" className="h-full w-full object-cover" loading="lazy" /> : <span className="grid h-full w-full place-items-center"><Icon icon={Lightbulb} size={20} /></span>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{p.title}</span>
                        <span className="block text-[12.5px] text-muted-foreground">
                          {p.booked ? t("ms.booked") : t("ms.notbooked")}
                          {p.dateFrom ? ` · ${formatDayMonth(p.dateFrom)}${p.dateTo && p.dateTo !== p.dateFrom ? ` – ${formatDayMonth(p.dateTo)}` : ""}` : ""}
                          {p.documentCount ? ` · ${t("plan.docs.count", { count: p.documentCount })}` : ""}
                        </span>
                      </span>
                      <Icon icon={ChevronRight} size={20} className="shrink-0 text-muted-foreground/70" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl bg-muted/60 p-4 text-[14px] text-muted-foreground">{t("plan.list.empty")}</p>
            )}
            <Link to="/reiser/dokumenter" className="mt-3 flex items-center gap-3 rounded-xl bg-sky-soft px-4 py-3 text-[15px] font-semibold hover:bg-mint">
              <Icon icon={FileText} size={20} /> <span className="flex-1">{t("doc.title")}</span> <Icon icon={ChevronRight} size={16} />
            </Link>
          </section>
        )}

        <Link to="/reise" className="mt-8 flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/25">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted"><Icon icon={Search} size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">{t("tr.find")}</span>
            <span className="block text-[12px] text-muted-foreground">{t("tr.findsub")}</span>
          </span>
          <span className="shrink-0 text-[13px] font-semibold">{t("tr.findcta")}</span>
        </Link>
      </AppShell>
    </div>
  );
}
