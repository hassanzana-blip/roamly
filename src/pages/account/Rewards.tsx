import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Check, Gift } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import Icon from "@/components/app/Icon";
import MembershipCard from "@/components/account/MembershipCard";
import { useCustomer } from "@/lib/useCustomer";
import { useT, type I18nKey } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { formatDateShort } from "@/lib/format";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";

/** Bonus – kortet, saldoen, nivået og hver eneste krone forklart. */
export default function Rewards() {
  usePageMeta(PAGE_META.rewards);
  const t = useT();
  const navigate = useNavigate();
  const { customer, isLoading } = useCustomer();
  const q = trpc.account.rewards.useQuery(undefined, { enabled: Boolean(customer), retry: false });

  useEffect(() => {
    if (!isLoading && !customer) navigate("/logg-inn?next=/profil/bonus");
  }, [customer, isLoading, navigate]);
  if (!customer) return null;
  const r = q.data;

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell className="max-w-2xl">
        <AppHeader title={r?.programName ?? t("rw.title")} back as="h1" />

        {r ? (
          <>
            <MembershipCard name={`${customer.firstName} ${customer.lastName}`} programName={r.programName} tierName={r.tier.name} memberNumber={r.memberNumber} memberSince={r.memberSince} className="mx-auto" />

            <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="eyebrow">{t("rw.balance")}</p>
                <p className="mt-2 text-[34px] font-semibold leading-none tabular">{r.balanceKr} <span className="text-[16px] font-medium text-muted-foreground">kr</span></p>
                <p className="mt-2 text-[12px] text-muted-foreground">{t("rw.balancesub")}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="eyebrow">{t("rw.tier")}</p>
                <p className="mt-2 font-display text-[26px] leading-none">{r.tier.name}</p>
                <p className="mt-2 text-[12px] text-muted-foreground">
                  {t("rw.tripsdone", { count: r.completedTrips })}
                  {r.nextTier ? ` · ${t("rw.tonext", { count: r.tripsToNext, tier: r.nextTier.name })}` : ` · ${t("rw.top")}`}
                </p>
                {r.nextTier && (
                  <span className="mt-3 block h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (r.completedTrips / Math.max(1, r.nextTier.minCompletedTrips)) * 100)}%` }} />
                  </span>
                )}
              </div>
            </div>

            <section className="mt-6 rounded-xl border border-border bg-card p-5">
              <h2 className="font-display text-xl">{t("rw.benefits")}</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">{t("rw.earn", { pct: Math.round(r.earnFraction * 1000) / 10 })}</p>
              {r.tier.benefits.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {r.tier.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-[14px]"><Icon icon={Check} size={16} className="mt-0.5 shrink-0 text-success" /> {b}</li>
                  ))}
                </ul>
              )}
              <Link to="/profil/inviter" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-[14px] font-semibold hover:border-foreground/40"><Icon icon={Gift} size={16} /> {t("acct.invite")}</Link>
            </section>

            <section className="mt-6">
              <h2 className="font-display text-xl">{t("rw.history")}</h2>
              {r.history.length === 0 ? (
                <p className="mt-2 rounded-xl border border-dashed border-border bg-muted/40 p-5 text-[13px] text-muted-foreground">{t("rw.historyempty")}</p>
              ) : (
                <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
                  {r.history.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold">{t(`rw.kind.${e.kind}` as I18nKey)}</span>
                        <span className="block truncate text-[12px] text-muted-foreground">{e.note ?? ""}{e.note ? " · " : ""}{formatDateShort(e.createdAt)}</span>
                      </span>
                      <span className={cn("shrink-0 text-[15px] font-semibold tabular", e.amountKr < 0 ? "text-muted-foreground" : "text-success")}>{e.amountKr > 0 ? "+" : ""}{e.amountKr} kr</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : (
          <div className="shimmer h-64 rounded-2xl" aria-busy="true" />
        )}
      </AppShell>
    </div>
  );
}
