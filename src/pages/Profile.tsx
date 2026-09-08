import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, ChevronRight, Luggage, MailWarning, MessagesSquare, Settings2, Sparkles, UserRound, type LucideIcon } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { AccountShell } from "@/components/account/AccountShell";
import { ACCOUNT_NAV } from "@/components/account/accountNav";
import { AppHeader } from "@/components/app/TopBar";
import Icon from "@/components/app/Icon";
import MembershipCard from "@/components/account/MembershipCard";
import { AccountGroup, AccountRow } from "@/components/account/AccountRow";
import CountryFlag from "@/components/brand/CountryFlag";
import {
  ActivityLine,
  FamilyScene,
  HistoryTimeline,
  ModuleHead,
  NextTripScene,
  RoutesScene,
  TravelPassport,
  WatchesScene,
} from "@/components/account/MyHelloSky";
import { usePassport } from "@/components/account/passport";
import ForYou from "@/components/home/ForYou";
import { airportByIata } from "@contracts/airports";
import { useCustomer } from "@/lib/useCustomer";
import { useAccountHub } from "@/lib/useAccount";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { trpc } from "@/providers/trpc";

/**
 * Min HelloSky.
 *
 * Rekkefølgen svarer på fire spørsmål, i den rekkefølgen folk stiller dem:
 * hvem er jeg, hva er neste reise, hva bør jeg bry meg om nå, og hva har jeg
 * bygget opp her. Innstillinger er flyttet ut til /profil/innstillinger, slik
 * at siden handler om reiser og ikke om kontoen. Hver modul skjuler seg selv
 * når den ikke har ekte data å vise.
 */

/**
 * Snarveiene er et rutenett med flater, ikke en liste med rader: profilen skal
 * ikke lese som Innstillinger. Hver flate er ett sted å gå, med et tall når
 * kontoen faktisk har et tall å vise.
 */
function LaunchTile({ to, icon, title, note }: { to: string; icon: LucideIcon; title: string; note?: string }) {
  return (
    <li>
      <Link
        to={to}
        className="press flex h-full items-start gap-3 rounded-xl bg-muted/60 px-3.5 py-3.5 transition-colors hover:bg-muted"
      >
        <Icon icon={icon} size={20} className="mt-0.5 shrink-0 text-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold leading-tight">{title}</span>
          {note ? <span className="t-caption mt-0.5 block leading-snug">{note}</span> : null}
        </span>
      </Link>
    </li>
  );
}

export default function Profile() {
  usePageMeta(PAGE_META.profile);
  const t = useT();
  const { customer, isLoading, logout } = useCustomer();
  const hub = useAccountHub();
  const trips = trpc.customerAuth.myTrips.useQuery(undefined, { enabled: Boolean(customer?.emailVerified), retry: false });
  const travellers = trpc.extras.myTravelers.useQuery(undefined, { enabled: Boolean(customer), retry: false });
  const resend = trpc.customerAuth.resendVerification.useMutation();

  const [now] = useState(() => Date.now());
  const [soon] = useState(() => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10));
  const h = hub.data;
  const profileStarted = Boolean(h?.profile.onboardingCompletedAt || h?.profile.onboardingSkippedAt || (h?.profile.completeness ?? 0) > 0);
  const homeAirport = h?.profile.homeAirports[0] ? airportByIata(h.profile.homeAirports[0]) : null;
  const passport = usePassport(trips.data ?? [], now);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <AppShell>
          <AppHeader as="h1" />
          <div className="space-y-4" aria-busy="true">
            <div className="shimmer h-24 rounded-2xl" />
            <div className="shimmer h-48 rounded-2xl" />
            <div className="shimmer h-40 rounded-2xl" />
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

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell bleed>
        {/* SiteHeader er kun for store skjermer; på telefon har hver side sin
            egen topplinje. Min side hadde sin i profilhodet, og mistet den da
            hodet ble bygget om. */}
        <div className="lg:hidden">
          <AppHeader title={t("nav.profile")} />
        </div>
        <AccountShell onSignOut={() => logout()}>
        {/*
          Hvem er jeg, og hva er verdt å gjøre nå.

          Siden het før det samme som navnet ditt sto øverst i store bokstaver.
          Det er en profilside. Dette er et sted man kommer tilbake til, så den
          åpner med en hilsen og går rett på det som gjelder: kortet, bonusen,
          og hva som skjer videre.
        */}
        <header className="pb-8" style={{ paddingTop: "max(20px, env(safe-area-inset-top))" }}>
          <div className="gap-8 lg:flex lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="eyebrow">{t("acct.universe")}</p>
              <h1 className="t-h1 mt-2">{t("acct.greet", { name: customer.firstName })}</h1>
              <p className="t-lead mt-1.5 text-muted-foreground">{t("acct.greet.sub")}</p>
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {customer.firstName} {customer.lastName}
                </span>
                {homeAirport && (
                  <span className="inline-flex items-center gap-1.5">
                    <CountryFlag code={homeAirport.countryCode} size={12} />
                    {t("acct.homeairport", { city: homeAirport.city })}
                  </span>
                )}
                <span className="font-semibold text-foreground">{h?.rewards.tier.name ?? "Explorer"}</span>
              </p>
            </div>

            {/* Kortet og bonusen hører sammen: det ene er hvem du er her, det
                andre er hva det har gitt deg. På telefon ligger de under
                hilsenen, ikke ved siden av. */}
            <div className="mt-7 w-full shrink-0 space-y-3 lg:mt-0 lg:w-[340px]">
              <Link
                to="/profil/bonus"
                className="press block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                aria-label={t("acct.card.open")}
              >
                <MembershipCard
                  name={`${customer.firstName} ${customer.lastName}`}
                  programName={h?.rewards.programName ?? "HelloSky Bonus"}
                  tierName={h?.rewards.tier.name ?? "Explorer"}
                  memberNumber={`HS-${String(customer.id).padStart(6, "0")}`}
                  memberSince={null}
                  className="max-w-none"
                />
              </Link>
              {/*
                Bare tallet her, ikke hele bonusmodulen. Kortet og en linje med
                saldo er det man vil se i forbifarten; resten hører hjemme
                lenger nede, der man faktisk er ute etter den.
              */}
              <Link
                to="/profil/bonus"
                className="press flex items-baseline justify-between gap-3 rounded-xl bg-muted/60 px-4 py-3 transition-colors hover:bg-muted"
              >
                <span className="flex items-baseline gap-2">
                  <span className="t-num text-[22px] font-bold leading-none">{customer.bonusKr ?? 0} kr</span>
                  <span className="text-[13px] text-muted-foreground">{t("acct.bonusavail")}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold">
                  {t("acct.card.open")} <Icon icon={ArrowRight} size={16} />
                </span>
              </Link>
            </div>
          </div>

          {/* Reisebilanse: hvem du er her, i tre tall. */}
          {passport.flown > 0 && (
            <dl className="mt-7 flex flex-wrap gap-x-9 gap-y-3 border-t border-border pt-5">
              {[
                [t("acct.passport.trips"), passport.flown],
                [t("acct.passport.countries"), passport.countries.length],
                [t("acct.passport.cities"), passport.cities],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dd className="t-num text-[26px] font-bold leading-none tracking-tight">{value}</dd>
                  <dt className="t-caption mt-1">{label}</dt>
                </div>
              ))}
            </dl>
          )}
        </header>

        <div className="min-w-0">
          <div className="min-w-0 space-y-12 lg:space-y-14">
            {customer.email && !customer.emailVerified && (
              <div className="flex items-start gap-3 rounded-2xl bg-warning/10 px-4 py-3.5 dark:bg-amber-400/10">
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

            <ActivityLine unread={h?.unreadNotifications ?? 0} />

            {/* Hva er neste reise */}
            <NextTripScene trip={h?.nextTrip ?? null} now={now} />

            {/* Reiseprofilen, som én invitasjon – ikke en modul til */}
            {h && !profileStarted && (
              <Link
                to="/velkommen"
                className="press group flex items-center gap-3.5 rounded-2xl bg-primary-soft p-4 text-accent-foreground transition-colors hover:bg-accent"
              >
                <Icon icon={Sparkles} size={24} className="shrink-0 text-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-foreground">{t("acct.hub.start")}</span>
                  <span className="block text-[13px] text-accent-foreground">{t("acct.hub.startsub")}</span>
                </span>
                <Icon icon={ArrowRight} size={20} className="shrink-0 text-foreground transition-transform duration-fast group-hover:translate-x-0.5" />
              </Link>
            )}

            <TravelPassport passport={passport} />
            <RoutesScene routes={h?.routes ?? []} departDate={soon} />
            <FamilyScene travellers={travellers.data ?? []} loading={travellers.isLoading} />
            <WatchesScene watches={h?.watches ?? []} />
            <ForYou />
            <HistoryTimeline trips={trips.data ?? []} now={now} />
          </div>

          {/*
            Snarveiene finnes bare på telefon. På store skjermer står de samme
            stedene permanent i sidemenyen, og to kopier av det samme kartet er
            én kopi for mye.
          */}
          <section className="mt-12 lg:hidden">
            <ModuleHead title={t("acct.group.personal")} />
            <ul className="grid grid-cols-2 gap-2.5">
              {ACCOUNT_NAV.filter((i) => !i.end).map((item) => (
                <LaunchTile key={item.to} to={item.to} icon={item.icon} title={item.label} />
              ))}
            </ul>
          </section>
        </div>
        </AccountShell>
      </AppShell>
    </div>
  );
}
