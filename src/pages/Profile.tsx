import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Bell, ChevronRight, Lock, Luggage, MailWarning, MessagesSquare, Plane, Settings, Settings2, Sparkles, UserRound, Users, type LucideIcon } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { AccountShell } from "@/components/account/AccountShell";
import { ACCOUNT_NAV } from "@/components/account/accountNav";
import { AppHeader } from "@/components/app/TopBar";
import Icon from "@/components/app/Icon";
import { ErrorState } from "@/components/app/primitives";
import MembershipCard from "@/components/account/MembershipCard";
import { AccountGroup, AccountRow } from "@/components/account/AccountRow";
import { ActivityLine, FamilyScene, HistoryTimeline, ModuleHead, NextTripScene, RoutesScene, TravelPassport, WatchesScene } from "@/components/account/MyHelloSky";
import { usePassport } from "@/components/account/passport";
import { LinkTabs } from "@/components/minside/LinkTabs";
import { DatesRow, InfoCard, PlanPhotoCard } from "@/components/minside/PlanCard";
import { Button } from "@/components/ui/button";
import { useCustomer } from "@/lib/useCustomer";
import { useAccountHub, useUnreadCount } from "@/lib/useAccount";
import { humanMessage } from "@/lib/apiError";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { trpc } from "@/providers/trpc";
import { pickNextPlan } from "@/lib/tripPlans";

/**
 * Min side (godkjent design, ref 1).
 *
 * Øverst: hvem du er, og hvor du er. Så det ene som gjelder nå: neste
 * reiseidé, med datoer og én knapp videre. Tre snarveier, en invitasjon til å
 * planlegge sammen, og et løfte om at alt her er privat. Alt under folden er
 * de eksisterende modulene, som skjuler seg selv uten ekte data.
 */

function QuickAction({ to, icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <li className="flex-1 border-l border-border/70 first:border-0">
      <Link to={to} className="press flex min-h-[132px] flex-col items-center justify-center gap-3 px-2 py-5 text-center focus-visible:outline-2 focus-visible:outline-ring">
        <Icon icon={icon} size={28} strokeWidth={1.75} className="text-foreground" />
        <span className="text-[16px] font-medium leading-none text-foreground sm:text-[17px]">{label}</span>
      </Link>
    </li>
  );
}

export default function Profile() {
  usePageMeta(PAGE_META.profile);
  const t = useT();
  const { customer, isLoading, logout } = useCustomer();
  const hub = useAccountHub();
  const unread = useUnreadCount();
  const plans = trpc.tripPlans.list.useQuery(undefined, { enabled: Boolean(customer), retry: false, staleTime: 30_000 });
  const trips = trpc.customerAuth.myTrips.useQuery(undefined, { enabled: Boolean(customer?.emailVerified), retry: false });
  const travellers = trpc.extras.myTravelers.useQuery(undefined, { enabled: Boolean(customer), retry: false });
  const resend = trpc.customerAuth.resendVerification.useMutation();

  const [now] = useState(() => Date.now());
  const [soon] = useState(() => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10));
  const today = useMemo(() => new Date(now).toISOString().slice(0, 10), [now]);
  const h = hub.data;
  const passport = usePassport(trips.data ?? [], now);
  const next = useMemo(() => pickNextPlan(plans.data ?? [], today), [plans.data, today]);
  const others = (plans.data?.length ?? 0) - (next ? 1 : 0);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <AppShell>
          <AppHeader as="h1" />
          <div className="space-y-4" aria-busy="true">
            <div className="shimmer h-16 rounded-2xl" />
            <div className="shimmer aspect-[13/12] rounded-2xl" />
            <div className="shimmer h-32 rounded-2xl" />
          </div>
        </AppShell>
      </div>
    );
  }

  /* ── Gjest: én vei inn ─────────────────────────────────────────────── */
  if (!customer) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <AppShell>
          <AppHeader title={t("profile.title")} as="h1" />
          <div className="mx-auto max-w-2xl">
            <Link to="/logg-inn" className="press flex items-center gap-4 rounded-2xl bg-night p-6 text-white transition-colors hover:bg-[hsl(240,6%,14%)]">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Icon icon={UserRound} size={24} /></span>
              <span className="min-w-0 flex-1">
                <span className="t-h3 block">{t("profile.login")}</span>
                <span className="mt-0.5 block text-[14px] text-white/65">{t("profile.loginsub")}</span>
              </span>
              <Icon icon={ChevronRight} size={20} className="shrink-0 text-white/60" />
            </Link>
            <div className="mt-8">
              <AccountGroup>
                <AccountRow to="/reise" icon={Luggage} title={t("profile.mytrip")} sub={t("profile.mytripsub")} />
                <AccountRow to="/quiz" icon={Sparkles} title={t("profile.quiz")} sub={t("profile.quizsub")} />
                <AccountRow to="/samfunn" icon={MessagesSquare} title={t("acct.community")} sub={t("profile.communitysub")} />
                <AccountRow to="/profil/innstillinger" icon={Settings2} title={t("profile.settings")} sub={t("settings.sub")} />
              </AccountGroup>
            </div>
          </div>
        </AppShell>
      </div>
    );
  }

  const initial = (customer.firstName || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell bleed>
        <AccountShell onSignOut={() => logout()}>
          {/* Hvem og hvor: avatar, hilsen, varsler og innstillinger. */}
          <header className="flex items-center justify-between gap-3 pb-5" style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}>
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid size-[76px] shrink-0 place-items-center rounded-full bg-sky-soft font-display text-[34px] font-bold text-foreground sm:size-16 sm:text-[28px]" aria-hidden="true">
                {initial}
              </span>
              <div className="min-w-0">
                <h1 className="t-h2 truncate">{t("ms.hello", { name: customer.firstName })}</h1>
                <p className="mt-0.5 text-[18px] text-muted-foreground">{t("ms.title")}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Link to="/profil/varsler" aria-label={t("ms.notifications")} className="relative grid size-12 place-items-center rounded-full hover:bg-muted">
                <Icon icon={Bell} size={28} strokeWidth={1.75} />
                {unread > 0 && <span className="absolute right-2 top-2 grid min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[11px] font-bold leading-[18px] text-primary-foreground">{unread}</span>}
              </Link>
              <Link to="/profil/innstillinger" aria-label={t("ms.tab.settings")} className="grid size-12 place-items-center rounded-full hover:bg-muted">
                <Icon icon={Settings} size={28} strokeWidth={1.75} />
              </Link>
            </div>
          </header>

          <LinkTabs
            label={t("ms.title")}
            active="overview"
            tabs={[
              { id: "overview", label: t("ms.tab.overview"), to: "/profil" },
              { id: "friends", label: t("ms.tab.friends"), to: "/profil/venner" },
              { id: "settings", label: t("ms.tab.settings"), to: "/profil/innstillinger" },
            ]}
          />

          <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-10">
            <div className="min-w-0">
              {customer.email && !customer.emailVerified && (
                <div className="mb-6 flex items-start gap-3 rounded-2xl bg-warning/10 px-4 py-3.5 dark:bg-amber-400/10">
                  <Icon icon={MailWarning} size={20} className="mt-0.5 shrink-0 text-warning dark:text-amber-300" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-warning dark:text-amber-200">{t("profile.verify")}</p>
                    <p className="text-[13px] text-warning dark:text-amber-200/70">{t("profile.verifysub")}</p>
                    <button onClick={() => resend.mutate()} disabled={resend.isPending || resend.isSuccess} className="mt-1.5 text-[13px] font-semibold text-warning underline underline-offset-2 disabled:opacity-60 dark:text-amber-100">
                      {resend.isSuccess ? t("common.sent") : t("common.resendlink")}
                    </button>
                  </div>
                </div>
              )}

              {/* Din neste reiseidé */}
              <section aria-labelledby="next-idea">
                <h2 id="next-idea" className="t-h1">{t("ms.nextidea")}</h2>
                {plans.isLoading ? (
                  <div className="mt-4 space-y-3" aria-busy="true"><div className="shimmer aspect-[13/12] rounded-2xl sm:aspect-[16/9]" /><div className="shimmer h-12 rounded-xl" /><div className="shimmer h-14 rounded-full" /></div>
                ) : plans.isError ? (
                  <div className="mt-4"><ErrorState title={t("ms.error")} body={humanMessage(plans.error)} onRetry={() => plans.refetch()} /></div>
                ) : next ? (
                  <div className="mt-4">
                    <PlanPhotoCard image={next.destination?.image ?? null} imageAlt={next.destination?.imageAlt ?? next.title} badge={next.booked ? t("ms.booked") : t("ms.notbooked")} badgeTone={next.booked ? "mint" : "sunny"} title={next.title} to={`/reiser/plan/${next.id}`} />
                    <DatesRow className="mt-3" dateFrom={next.dateFrom} dateTo={next.dateTo} emptyLabel={t("ms.nodates")} action={`/reiser/plan/${next.id}#datoer`} actionLabel={t("ms.pickdates")} />
                    <Button asChild size="xl" className="mt-3 w-full rounded-full">
                      <Link to={`/reiser/plan/${next.id}`}>{t("ms.continue")}</Link>
                    </Button>
                    {others > 0 && (
                      <Link to="/reiser" className="mt-3 inline-flex min-h-10 items-center gap-1 text-[14px] font-semibold text-accent-foreground hover:underline">
                        {t("ms.moreplans", { count: others })} <Icon icon={ArrowRight} size={16} />
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl bg-muted/60 p-6 text-center">
                    <p className="t-h3">{t("ms.empty.title")}</p>
                    <p className="mt-1 text-[15px] text-muted-foreground">{t("ms.empty.body")}</p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <Button asChild variant="dark"><Link to="/utforsk">{t("ms.empty.cta")}</Link></Button>
                      <Button asChild variant="outline"><Link to="/reiser/plan/ny">{t("ms.empty.new")}</Link></Button>
                    </div>
                  </div>
                )}
              </section>

              {/* Tre snarveier */}
              <ul className="mt-6 flex overflow-hidden rounded-2xl bg-sky-soft">
                <QuickAction to="/reiser/dokumenter" icon={Plane} label={t("ms.tickets")} />
                <QuickAction to="/profil/prisvarsler" icon={Bell} label={t("ms.alerts")} />
                <QuickAction to="/profil/venner" icon={Users} label={t("ms.friends")} />
              </ul>

              {/* Reis sammen */}
              <section className="mt-10" aria-labelledby="together">
                <h2 id="together" className="t-h1">{t("ms.together")}</h2>
                <InfoCard className="mt-4" tone="rose" icon={<Icon icon={Users} size={28} strokeWidth={1.75} />} title={t("ms.together.title")} body={t("ms.together.body")} cta={t("ms.together.cta")} to="/profil/venner?fane=finn" />
              </section>

              <p className="mt-8 flex items-center justify-center gap-2 text-center text-[15px] text-muted-foreground">
                <Icon icon={Lock} size={16} className="shrink-0" /> {t("ms.private")}
              </p>
            </div>

            {/* Kortet og bonusen: hvem du er her, og hva det har gitt deg. */}
            <aside className="mt-12 space-y-3 lg:mt-0">
              <Link to="/profil/bonus" className="press block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring" aria-label={t("acct.card.open")}>
                <MembershipCard name={`${customer.firstName} ${customer.lastName}`} programName={h?.rewards.programName ?? "HelloSky Bonus"} tierName={h?.rewards.tier.name ?? "Explorer"} memberNumber={`HS-${String(customer.id).padStart(6, "0")}`} memberSince={null} className="max-w-none" />
              </Link>
              <Link to="/profil/bonus" className="press flex items-baseline justify-between gap-3 rounded-xl bg-muted/60 px-4 py-3 transition-colors hover:bg-muted">
                <span className="flex items-baseline gap-2">
                  <span className="t-num text-[22px] font-bold leading-none">{customer.bonusKr ?? 0} kr</span>
                  <span className="text-[13px] text-muted-foreground">{t("acct.bonusavail")}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold">
                  {t("acct.card.open")} <Icon icon={ArrowRight} size={16} />
                </span>
              </Link>
            </aside>
          </div>

          {/* Under folden: de eksisterende modulene, hver skjuler seg uten data. */}
          <div className="mt-12 min-w-0 space-y-12 lg:space-y-14">
            <ActivityLine unread={h?.unreadNotifications ?? 0} />
            <NextTripScene trip={h?.nextTrip ?? null} now={now} />
            <TravelPassport passport={passport} />
            <RoutesScene routes={h?.routes ?? []} departDate={soon} />
            <FamilyScene travellers={travellers.data ?? []} loading={travellers.isLoading} />
            <WatchesScene watches={h?.watches ?? []} />
            <HistoryTimeline trips={trips.data ?? []} now={now} />
          </div>

          {/* Snarveiene finnes bare på telefon; på store skjermer står de i sidemenyen. */}
          <section className="mt-12 lg:hidden">
            <ModuleHead title={t("acct.group.personal")} />
            <ul className="grid grid-cols-2 gap-2.5">
              {ACCOUNT_NAV.filter((i) => !i.end).map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="press flex h-full items-start gap-3 rounded-xl bg-muted/60 px-3.5 py-3.5 transition-colors hover:bg-muted">
                    <Icon icon={item.icon} size={20} className="mt-0.5 shrink-0 text-foreground" />
                    <span className="block text-[14px] font-semibold leading-tight">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </AccountShell>
      </AppShell>
    </div>
  );
}
