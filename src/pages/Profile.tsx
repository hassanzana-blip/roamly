import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Bell, Car, ChevronRight, CircleHelp, Gift, Globe, Heart, LayoutGrid, LogOut, Luggage, Mail, MailWarning, MessagesSquare, Moon, Plane, Radar, ShieldCheck, Sparkles, TrendingDown, UserPen, UserRound, Users, Wallet } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import Icon from "@/components/app/Icon";
import MembershipCard from "@/components/account/MembershipCard";
import { AccountRow, CountBadge, GroupLabel, Toggle } from "@/components/account/AccountRow";
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
 * Profil — navet for reiseverdenen din. Ikke en innstillingsside.
 *
 * Bare moduler med ekte data vises: neste reise, prisovervåking, lagret,
 * rutene dine, uleste varsler. Uten data står bare det du kan gjøre.
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
        "flex min-h-[112px] flex-col justify-between rounded-xl border p-4 transition-colors",
        accent ? "border-transparent bg-primary-soft hover:bg-primary/30" : "border-border bg-card hover:border-foreground/25",
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

  const [soon] = useState(() => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10));
  const h = hub.data;
  const profileStarted = Boolean(h?.profile.onboardingCompletedAt || h?.profile.onboardingSkippedAt || (h?.profile.completeness ?? 0) > 0);
  const nextTripDays = h?.nextTrip ? daysUntil(h.nextTrip.departingAt, soon) : null;
  const firstWatch = h?.watches[0];
  const watchResult = firstWatch?.lastResult as { priceMinor?: number; currency?: string; live?: boolean } | null | undefined;

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell>
        <AppHeader title={customer ? undefined : t("profile.title")} as="h1" />

        {/* ── Innlogget: hilsen + kort ─────────────────────────────────── */}
        {!isLoading && customer && (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-[34px] leading-none sm:text-[40px]">{t("acct.hub.hello", { name: customer.firstName })}</h1>
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

            <Link to="/profil/bonus" className="mt-6 block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring" aria-label={t("acct.card.open")}>
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
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-300/60 bg-warning/10 px-4 py-3.5 dark:border-amber-400/30 dark:bg-amber-400/10">
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
              <Link to="/velkommen" className="mt-4 flex items-center gap-3 rounded-xl bg-night p-4 text-white transition-colors hover:bg-[hsl(240,6%,14%)]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Icon icon={Sparkles} size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{t("acct.hub.start")}</span>
                  <span className="block text-[12px] text-white/65">{t("acct.hub.startsub")}</span>
                </span>
                <Icon icon={ArrowRight} size={20} className="shrink-0 text-white/70" />
              </Link>
            )}
            {h && profileStarted && h.profile.completeness < 100 && (
              <Link to="/profil/reiseprofil" className="mt-4 block rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/25">
                <span className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="font-semibold">{t("acct.hub.complete")}</span>
                  <span className="text-muted-foreground">{t("acct.hub.completesub", { pct: h.profile.completeness })}</span>
                </span>
                <span className="mt-2 block h-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary transition-[width] duration-slow" style={{ width: `${h.profile.completeness}%` }} /></span>
              </Link>
            )}

            {/* ── Moduler: kun med data ───────────────────────────────── */}
            {h && (h.nextTrip || h.watches.length > 0 || h.savedCount > 0 || h.unreadNotifications > 0) && (
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                {h.nextTrip && (
                  <Tile
                    to={`/bekreftelse/${encodeURIComponent(h.nextTrip.orderId)}`}
                    icon={Plane}
                    eyebrow={t("acct.hub.nexttrip")}
                    title={`${h.nextTrip.originCity || h.nextTrip.originIata} → ${h.nextTrip.destinationCity || h.nextTrip.destinationIata}`}
                    sub={nextTripDays === 0 ? t("acct.hub.today") : `${t("acct.hub.daysto", { count: nextTripDays ?? 0 })} · ${formatDateShort(h.nextTrip.departingAt)}`}
                    accent
                  />
                )}
                {firstWatch && (
                  <Tile
                    to="/profil/prisovervaking"
                    icon={TrendingDown}
                    eyebrow={t("acct.hub.watch")}
                    title={h.watches.length === 1 ? `${firstWatch.originIata} → ${firstWatch.destinationCity}` : t("acct.hub.watchsub", { count: h.watches.length })}
                    sub={watchResult?.live && watchResult.priceMinor ? t("acct.hub.watchfound", { price: formatMinor(watchResult.priceMinor, watchResult.currency ?? "NOK") }) : t("acct.hub.watchchecking")}
                  />
                )}
                {h.savedCount > 0 && <Tile to="/lagret" icon={Heart} eyebrow={t("acct.saved")} title={t("acct.savedsub", { count: h.savedCount })} sub={t("acct.savedempty")} />}
                {h.unreadNotifications > 0 && <Tile to="/profil/varsler" icon={Bell} eyebrow={t("acct.notifications")} title={t("acct.unread", { count: h.unreadNotifications })} />}
              </div>
            )}

            {h && h.routes.length > 0 && (
              <section className="mt-6">
                <div className="mb-2 flex items-end justify-between">
                  <h2 className="font-display text-xl">{t("acct.hub.routes")}</h2>
                  <span className="text-[12px] text-muted-foreground">{t("acct.hub.routessub")}</span>
                </div>
                <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 sm:-mx-8 sm:px-8">
                  {h.routes.map((r) => (
                    <Link
                      key={`${r.originIata}-${r.destinationIata}`}
                      to={`/sok?from=${r.originIata}&to=${r.destinationIata}&depart=${soon}&adults=1&children=0&infants=0&cabin=economy`}
                      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-[14px] font-semibold transition-colors hover:border-foreground/30"
                    >
                      {r.originCity} <Icon icon={ArrowRight} size={14} className="text-muted-foreground" /> {r.destinationCity}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <GroupLabel>{t("acct.group.trips")}</GroupLabel>
            <ul className="flex flex-col gap-2">
              <AccountRow to="/reiser" icon={Luggage} title={t("acct.trips")} sub={t("acct.tripssub")} badge={<CountBadge n={h?.upcomingCount ?? 0} />} />
              <AccountRow to="/profil/reisende" icon={Users} title={t("acct.travelers")} sub={t("acct.travelerssub")} />
              <AccountRow to="/profil/prisovervaking" icon={TrendingDown} title={t("acct.hub.watch")} sub={t("acct.watchessub")} badge={<CountBadge n={h?.watches.length ?? 0} />} />
              <AccountRow to="/flystatus" icon={Radar} title={t("profile.flightstatus")} sub={t("profile.flightstatussub")} />
            </ul>

            <GroupLabel>{t("acct.group.personal")}</GroupLabel>
            <ul className="flex flex-col gap-2">
              <AccountRow to="/profil/reiseprofil" icon={Sparkles} title={t("acct.travelprofile")} sub={h ? t("tpf.completeness", { pct: h.profile.completeness }) : t("acct.travelprofilesub")} />
              <AccountRow to="/lagret" icon={Heart} title={t("acct.saved")} sub={h && h.savedCount > 0 ? t("acct.savedsub", { count: h.savedCount }) : t("acct.savedempty")} />
              <AccountRow to="/tavler" icon={LayoutGrid} title="Reisetavler" sub="Planlegg en tur sammen — stem og del" />
              <AccountRow to="/quiz" icon={Sparkles} title="ReiseMatch" sub="Alene, som par eller med gjengen" />
              <AccountRow to="/profil/varsler" icon={Bell} title={t("acct.notifications")} sub={t("acct.notificationssub")} badge={<CountBadge n={h?.unreadNotifications ?? 0} />} />
              <AccountRow to="/profil/bonus" icon={Wallet} title={t("acct.rewards")} sub={t("acct.rewardssub", { balance: customer.bonusKr ?? 0, tier: h?.rewards.tier.name ?? "Explorer" })} />
              <AccountRow to="/profil/inviter" icon={Gift} title={t("acct.invite")} sub={t("profile.invitesub")} />
              <AccountRow to="/samfunn" icon={MessagesSquare} title={t("acct.community")} sub={t("profile.communitysub")} />
            </ul>

            <GroupLabel>{t("acct.group.account")}</GroupLabel>
            <ul className="flex flex-col gap-2">
              <AccountRow to="/profil/rediger" icon={UserPen} title={t("acct.edit")} sub={t("acct.editsub")} />
              <AccountRow to="/profil/sikkerhet" icon={ShieldCheck} title={t("acct.security")} sub={t("acct.securitysub")} />
              <li className="flex min-h-[60px] items-center gap-3 rounded-lg border border-border bg-card px-4 py-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted"><Icon icon={Mail} size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span id="pref-marketing-label" className="block text-[15px] font-semibold">{t("pf.marketing")}</span>
                  <span className="block text-[12px] text-muted-foreground">{t("pf.marketingsub")}</span>
                </span>
                <Toggle checked={customer.marketingConsent} disabled={prefs.isPending} label={t("pf.marketing")} onChange={(v) => prefs.mutate({ marketingConsent: v })} />
              </li>
            </ul>
            {prefs.isError && <p role="alert" className="mt-2 text-[12px] text-destructive">{humanMessage(prefs.error)}</p>}
          </>
        )}

        {/* ── Gjest ────────────────────────────────────────────────────── */}
        {!isLoading && !customer && (
          <>
            <Link to="/logg-inn" className="flex items-center gap-3.5 rounded-xl bg-night p-5 text-white transition-colors hover:bg-[hsl(240,6%,14%)]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Icon icon={UserRound} size={20} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold">{t("profile.login")}</span>
                <span className="block text-[13px] text-white/60">{t("profile.loginsub")}</span>
              </span>
              <Icon icon={ChevronRight} size={20} className="shrink-0 text-white/60" />
            </Link>
            <ul className="mt-6 flex flex-col gap-2">
              <AccountRow to="/reise" icon={Luggage} title={t("profile.mytrip")} sub={t("profile.mytripsub")} />
              <AccountRow to="/flystatus" icon={Radar} title={t("profile.flightstatus")} sub={t("profile.flightstatussub")} />
              <AccountRow to="/hotell-bil" icon={Car} title={t("profile.hotelcar")} sub={t("profile.hotelcarsub")} />
              <AccountRow to="/quiz" icon={Sparkles} title={t("profile.quiz")} sub={t("profile.quizsub")} />
              <AccountRow to="/samfunn" icon={MessagesSquare} title={t("acct.community")} sub={t("profile.communitysub")} />
            </ul>
          </>
        )}

        {/* ── Felles: språk, valuta, tema, hjelp ──────────────────────── */}
        <GroupLabel>{t("profile.settings")}</GroupLabel>
        <ul className="flex flex-col gap-2">
          <li className="flex min-h-[60px] items-center gap-3 rounded-lg border border-border bg-card px-4 py-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted"><Icon icon={Globe} size={20} /></span>
            <label htmlFor="pref-locale" className="flex-1 text-[15px] font-semibold">{t("profile.language")}</label>
            <select id="pref-locale" value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="min-h-11 rounded-lg border border-border bg-card px-3 text-[13px] font-semibold">
              {LANGS.map((l) => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}
            </select>
          </li>
          <li className="flex min-h-[60px] items-center gap-3 rounded-lg border border-border bg-card px-4 py-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted"><Icon icon={Wallet} size={20} /></span>
            <span className="min-w-0 flex-1">
              <label htmlFor="pref-currency" className="block text-[15px] font-semibold">{t("profile.currency")}</label>
              <span className="block text-[12px] text-muted-foreground">{t("pf.currencyhint")}</span>
            </span>
            <select id="pref-currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="min-h-11 rounded-lg border border-border bg-card px-3 text-[13px] font-semibold">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </li>
          <li className="flex min-h-[60px] items-center gap-3 rounded-lg border border-border bg-card px-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted"><Icon icon={Moon} size={20} /></span>
            <span className="flex-1 text-[15px] font-semibold">{t("profile.theme")}</span>
            <Toggle checked={dark} onChange={setDark} label={t("profile.theme")} />
          </li>
        </ul>

        <GroupLabel>{t("acct.group.more")}</GroupLabel>
        <ul className="flex flex-col gap-2">
          <AccountRow to="/hjelp" icon={CircleHelp} title={t("acct.help")} sub={t("acct.helpsub")} />
          {customer && <AccountRow to="/profil/rediger#personvern" icon={ShieldCheck} title={t("pf.privacy")} sub={t("pf.export")} />}
          <AccountRow to="/hotell-bil" icon={Car} title={t("profile.hotelcar")} sub={t("profile.hotelcarsub")} />
        </ul>

        <div className="mt-8 flex items-center gap-3 rounded-lg bg-accent px-4 py-4">
          <Icon icon={Plane} size={20} className="shrink-0 text-accent-foreground" />
          <p className="text-[13px] font-medium text-accent-foreground">{t("pf.footer")}</p>
        </div>
      </AppShell>
    </div>
  );
}
