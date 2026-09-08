import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight, Bell, Car, ChevronRight, CircleHelp, Gift, Globe, Heart, LayoutGrid, LogOut, Luggage, Mail, MailWarning, MessagesSquare, Moon, Plane, Radar, ShieldCheck, Sparkles, TrendingDown, UserPen, UserRound, Users, Wallet } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import Icon from "@/components/app/Icon";
import MembershipCard from "@/components/account/MembershipCard";
import { AccountGroup, AccountRow, ControlRow, CountBadge, Toggle } from "@/components/account/AccountRow";
import { DocumentsModule, FamilyModule, NextTripModule, QuickActions, RoutesModule, type DocumentsStatus, type QuickAction } from "@/components/account/HubModules";
import ForYou from "@/components/home/ForYou";
import { useCustomer } from "@/lib/useCustomer";
import { useAccountHub } from "@/lib/useAccount";
import { CURRENCIES, LANGS, LANG_LABELS, useLang, useLocale, useT, type Currency, type Lang } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { useTheme } from "@/lib/theme";
import { formatDateShort, formatMinor } from "@/lib/format";
import { trpc } from "@/providers/trpc";
import { humanMessage } from "@/lib/apiError";
import { cn } from "@/lib/utils";

/**
 * Profil – navet for reiseverdenen din. Ikke en innstillingsside.
 *
 * Bare moduler med ekte data vises: neste reise, prisovervåking, lagret,
 * rutene dine, uleste varsler. Uten data står bare det du kan gjøre.
 * På store skjermer: identiteten (kort, moduler) til venstre, menyen til høyre.
 */

/** Dager til avreise, regnet fra «om 30 dager»-ankeret sidevisningen allerede har (rene render). */
function daysUntil(iso: string, soonIso: string): number {
  const today = Date.parse(soonIso) - 30 * 86_400_000;
  return Math.max(0, Math.ceil((Date.parse(iso) - today) / 86_400_000));
}

function Tile({ to, icon, eyebrow, title, sub, accent }: { to: string; icon: typeof Plane; eyebrow: string; title: string; sub?: string; accent?: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        "press flex min-h-[112px] flex-col justify-between rounded-xl p-4 transition-colors",
        accent ? "bg-primary-soft hover:bg-primary/30" : "bg-muted/70 hover:bg-muted",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="eyebrow">{eyebrow}</span>
        <Icon icon={icon} size={20} className="text-muted-foreground" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[17px] font-semibold leading-tight">{title}</span>
        {sub ? <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">{sub}</span> : null}
      </span>
    </Link>
  );
}

const selectCls = "min-h-10 rounded-lg border border-border bg-card px-3 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function Profile() {
  usePageMeta(PAGE_META.profile);
  const { customer, isLoading, logout, isLoggingOut } = useCustomer();
  const hub = useAccountHub();
  const t = useT();
  const { lang, setLang } = useLang();
  const { currency, setCurrency } = useLocale();
  const { dark, setDark } = useTheme();
  const utils = trpc.useUtils();
  const resend = trpc.customerAuth.resendVerification.useMutation();
  const prefs = trpc.customerAuth.updatePreferences.useMutation({ onSuccess: () => utils.customerAuth.me.invalidate() });

  const trips = trpc.customerAuth.myTrips.useQuery(undefined, { enabled: Boolean(customer?.emailVerified), retry: false });
  const travellers = trpc.extras.myTravelers.useQuery(undefined, { enabled: Boolean(customer), retry: false });

  const [soon] = useState(() => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10));
  const [now] = useState(() => Date.now());
  const h = hub.data;
  const docsStatus: DocumentsStatus = !customer?.emailVerified ? "unverified" : trips.isLoading ? "loading" : trips.isError ? "error" : "ready";
  const profileStarted = Boolean(h?.profile.onboardingCompletedAt || h?.profile.onboardingSkippedAt || (h?.profile.completeness ?? 0) > 0);
  const nextTripDays = h?.nextTrip ? daysUntil(h.nextTrip.departingAt, soon) : null;
  const firstWatch = h?.watches[0];
  const watchResult = firstWatch?.lastResult as { priceMinor?: number; currency?: string; live?: boolean } | null | undefined;

  /* ── Det du gjør oftest: fire snarveier, aldri flere ─────────────────── */
  const quickActions: QuickAction[] = [
    { to: "/reiser", icon: Luggage, label: t("acct.trips"), count: h?.upcomingCount ?? 0 },
    { to: "/profil/reisende", icon: Users, label: t("acct.travelers") },
    { to: "/profil/prisovervaking", icon: TrendingDown, label: t("acct.hub.watch"), count: h?.watches.length ?? 0 },
    { to: "/lagret", icon: Heart, label: t("acct.saved"), count: h?.savedCount ?? 0 },
  ];

  /* ── Felles: språk, valuta, tema, hjelp ──────────────────────────────── */
  const settings: ReactNode = (
    <>
      <AccountGroup label={t("profile.settings")}>
        <ControlRow icon={Globe} title={t("profile.language")} htmlFor="pref-locale">
          <select id="pref-locale" value={lang} onChange={(e) => setLang(e.target.value as Lang)} className={selectCls}>
            {LANGS.map((l) => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}
          </select>
        </ControlRow>
        <ControlRow icon={Wallet} title={t("profile.currency")} sub={t("pf.currencyhint")} htmlFor="pref-currency">
          <select id="pref-currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className={selectCls}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </ControlRow>
        <ControlRow icon={Moon} title={t("profile.theme")}>
          <Toggle checked={dark} onChange={setDark} label={t("profile.theme")} />
        </ControlRow>
      </AccountGroup>

      <AccountGroup label={t("acct.group.more")}>
        <AccountRow to="/hjelp" icon={CircleHelp} title={t("acct.help")} sub={t("acct.helpsub")} />
        {customer && <AccountRow to="/profil/rediger#personvern" icon={ShieldCheck} title={t("pf.privacy")} sub={t("pf.export")} />}
        <AccountRow to="/hotell-bil" icon={Car} title={t("profile.hotelcar")} sub={t("profile.hotelcarsub")} />
      </AccountGroup>

      <div className="mt-8 flex items-center gap-3 rounded-xl bg-accent px-4 py-4">
        <Icon icon={Plane} size={20} className="shrink-0 text-accent-foreground" />
        <p className="text-[13px] font-medium text-accent-foreground">{t("pf.footer")}</p>
      </div>
    </>
  );

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell>
        <AppHeader title={customer ? undefined : t("profile.title")} as="h1" />

        {/* ── Innlogget: identitet til venstre, meny til høyre (lg) ─────── */}
        {!isLoading && customer && (
          <div className="lg:grid lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start lg:gap-14">
            <div className="lg:sticky lg:top-24">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="t-h1">{t("acct.hub.hello", { name: customer.firstName })}</h1>
                  <p className="mt-2 text-[15px] text-muted-foreground">{t("acct.hub.sub")}</p>
                </div>
                <button
                  onClick={() => logout()}
                  disabled={isLoggingOut}
                  aria-label={t("profile.logout")}
                  title={t("profile.logout")}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <Icon icon={LogOut} size={20} />
                </button>
              </div>

              <Link to="/profil/bonus" className="press mt-6 block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring" aria-label={t("acct.card.open")}>
                <MembershipCard
                  name={`${customer.firstName} ${customer.lastName}`}
                  programName={h?.rewards.programName ?? "HelloSky Bonus"}
                  tierName={h?.rewards.tier.name ?? "Explorer"}
                  memberNumber={`HS-${String(customer.id).padStart(6, "0")}`}
                  memberSince={null}
                  compact
                  className="max-w-none"
                />
              </Link>

              {customer.email && !customer.emailVerified && (
                <div className="mt-4 flex items-start gap-3 rounded-xl bg-warning/10 px-4 py-3.5 dark:bg-amber-400/10">
                  <Icon icon={MailWarning} size={20} className="mt-0.5 shrink-0 text-warning dark:text-amber-300" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-warning dark:text-amber-200">{t("profile.verify")}</p>
                    <p className="text-[12px] text-warning/80 dark:text-amber-200/70">{t("profile.verifysub")}</p>
                    <button onClick={() => resend.mutate()} disabled={resend.isPending || resend.isSuccess} className="mt-1.5 text-[12px] font-semibold text-warning underline underline-offset-2 disabled:opacity-60 dark:text-amber-100">
                      {resend.isSuccess ? t("common.sent") : t("common.resendlink")}
                    </button>
                  </div>
                </div>
              )}

              {/* Reiseprofil: én rolig invitasjon til den er startet; én linje til den er komplett. */}
              {h && !profileStarted && (
                <Link to="/velkommen" className="press mt-4 flex items-center gap-3 rounded-xl bg-night p-4 text-white transition-colors hover:bg-[hsl(240,6%,14%)]">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Icon icon={Sparkles} size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{t("acct.hub.start")}</span>
                    <span className="block text-[12px] text-white/65">{t("acct.hub.startsub")}</span>
                  </span>
                  <Icon icon={ArrowRight} size={20} className="shrink-0 text-white/70" />
                </Link>
              )}
              {h && profileStarted && h.profile.completeness < 100 && (
                <Link to="/profil/reiseprofil" className="press mt-4 block rounded-xl bg-muted/70 px-4 py-3 transition-colors hover:bg-muted">
                  <span className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="font-semibold">{t("acct.hub.complete")}</span>
                    <span className="text-muted-foreground">{t("acct.hub.completesub", { pct: h.profile.completeness })}</span>
                  </span>
                  <span className="mt-2 block h-1 overflow-hidden rounded-full bg-border"><span className="block h-full rounded-full bg-primary transition-[width] duration-slow" style={{ width: `${h.profile.completeness}%` }} /></span>
                </Link>
              )}

            </div>

            <div className="lg:-mt-7">
              {/* Navet: reisen som kommer, det du gjør oftest, papirene, familien, rutene. */}
              <div className="space-y-10 lg:space-y-12">
                <NextTripModule trip={h?.nextTrip ?? null} days={nextTripDays} />
                <QuickActions label={t("acct.group.trips")} items={quickActions} />
                <DocumentsModule trips={trips.data ?? []} status={docsStatus} now={now} />
                <FamilyModule travellers={travellers.data ?? []} loading={travellers.isLoading} />
                <RoutesModule routes={h?.routes ?? []} departDate={soon} />
              </div>

              {/* Anbefalt for deg: fra reiseprofilen og søkene dine, med ekte priser. */}
              <div className="mt-10 lg:mt-12">
                <ForYou />
              </div>

              <div className="mt-10 lg:mt-12">
              <AccountGroup label={t("acct.group.trips")}>
                <AccountRow to="/reiser" icon={Luggage} title={t("acct.trips")} sub={t("acct.tripssub")} badge={<CountBadge n={h?.upcomingCount ?? 0} />} />
                <AccountRow to="/profil/reisende" icon={Users} title={t("acct.travelers")} sub={t("acct.travelerssub")} />
                <AccountRow to="/profil/prisovervaking" icon={TrendingDown} title={t("acct.hub.watch")} sub={t("acct.watchessub")} badge={<CountBadge n={h?.watches.length ?? 0} />} />
                <AccountRow to="/flystatus" icon={Radar} title={t("profile.flightstatus")} sub={t("profile.flightstatussub")} />
              </AccountGroup>

              <AccountGroup label={t("acct.group.personal")}>
                <AccountRow to="/profil/reiseprofil" icon={Sparkles} title={t("acct.travelprofile")} sub={h ? t("tpf.completeness", { pct: h.profile.completeness }) : t("acct.travelprofilesub")} />
                <AccountRow to="/lagret" icon={Heart} title={t("acct.saved")} sub={h && h.savedCount > 0 ? t("acct.savedsub", { count: h.savedCount }) : t("acct.savedempty")} />
                <AccountRow to="/tavler" icon={LayoutGrid} title="Reisetavler" sub="Planlegg en tur sammen – stem og del" />
                <AccountRow to="/quiz" icon={Sparkles} title="ReiseMatch" sub="Alene, som par eller med gjengen" />
                <AccountRow to="/profil/varsler" icon={Bell} title={t("acct.notifications")} sub={t("acct.notificationssub")} badge={<CountBadge n={h?.unreadNotifications ?? 0} />} />
                <AccountRow to="/profil/bonus" icon={Wallet} title={t("acct.rewards")} sub={t("acct.rewardssub", { balance: customer.bonusKr ?? 0, tier: h?.rewards.tier.name ?? "Explorer" })} />
                <AccountRow to="/profil/inviter" icon={Gift} title={t("acct.invite")} sub={t("profile.invitesub")} />
                <AccountRow to="/samfunn" icon={MessagesSquare} title={t("acct.community")} sub={t("profile.communitysub")} />
              </AccountGroup>

              <AccountGroup label={t("acct.group.account")}>
                <AccountRow to="/profil/rediger" icon={UserPen} title={t("acct.edit")} sub={t("acct.editsub")} />
                <AccountRow to="/profil/sikkerhet" icon={ShieldCheck} title={t("acct.security")} sub={t("acct.securitysub")} />
                <ControlRow icon={Mail} title={t("pf.marketing")} sub={t("pf.marketingsub")}>
                  <Toggle checked={customer.marketingConsent} disabled={prefs.isPending} label={t("pf.marketing")} onChange={(v) => prefs.mutate({ marketingConsent: v })} />
                </ControlRow>
              </AccountGroup>
              {prefs.isError && <p role="alert" className="mt-2 text-[12px] text-destructive">{humanMessage(prefs.error)}</p>}

              {settings}
              </div>
            </div>
          </div>
        )}

        {/* ── Gjest ────────────────────────────────────────────────────── */}
        {!isLoading && !customer && (
          <div className="mx-auto max-w-2xl lg:mx-0 lg:grid lg:max-w-none lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start lg:gap-14">
            <Link to="/logg-inn" className="press flex items-center gap-3.5 rounded-2xl bg-night p-5 text-white transition-colors hover:bg-[hsl(240,6%,14%)] lg:sticky lg:top-24 lg:min-h-[200px] lg:flex-col lg:items-start lg:justify-between lg:p-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Icon icon={UserRound} size={20} /></span>
              <span className="min-w-0 flex-1 lg:flex-none">
                <span className="block text-[16px] font-semibold lg:font-display lg:text-[26px] lg:font-medium">{t("profile.login")}</span>
                <span className="block text-[13px] text-white/60 lg:mt-1 lg:text-[14px]">{t("profile.loginsub")}</span>
              </span>
              <Icon icon={ChevronRight} size={20} className="shrink-0 text-white/60 lg:hidden" />
            </Link>
            <div className="lg:-mt-7">
              <AccountGroup>
                <AccountRow to="/reise" icon={Luggage} title={t("profile.mytrip")} sub={t("profile.mytripsub")} />
                <AccountRow to="/flystatus" icon={Radar} title={t("profile.flightstatus")} sub={t("profile.flightstatussub")} />
                <AccountRow to="/hotell-bil" icon={Car} title={t("profile.hotelcar")} sub={t("profile.hotelcarsub")} />
                <AccountRow to="/quiz" icon={Sparkles} title={t("profile.quiz")} sub={t("profile.quizsub")} />
                <AccountRow to="/samfunn" icon={MessagesSquare} title={t("acct.community")} sub={t("profile.communitysub")} />
              </AccountGroup>
              {settings}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="space-y-3" aria-busy="true">
            <div className="shimmer h-40 rounded-2xl" />
            <div className="shimmer h-16 rounded-xl" />
            <div className="shimmer h-16 rounded-xl" />
          </div>
        )}
      </AppShell>
    </div>
  );
}
