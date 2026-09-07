import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Bell,
  Car,
  Check,
  ChevronRight,
  CircleHelp,
  Copy,
  Download,
  Gift,
  Globe,
  LogOut,
  Luggage,
  Mail,
  MailWarning,
  MessagesSquare,
  Moon,
  Plane,
  Radar,
  Sparkles,
  UserPen,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import Icon from "@/components/app/Icon";
import { useCustomer } from "@/lib/useCustomer";
import { CURRENCIES, LANGS, LANG_LABELS, useLang, useLocale, useT, type Currency, type I18nKey, type Lang } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { trpc } from "@/providers/trpc";
import { humanMessage } from "@/lib/apiError";
import type { LucideIcon } from "lucide-react";

/**
 * Profil — app-menyen: konto, bonus, reisende, prisvarsler, tjenester,
 * innstillinger (språk, valuta, mørk modus) og hjelp.
 */

const MENU: { to: string; icon: LucideIcon; title: I18nKey; sub: I18nKey }[] = [
  { to: "/reise", icon: Luggage, title: "profile.mytrip", sub: "profile.mytripsub" },
  { to: "/flystatus", icon: Radar, title: "profile.flightstatus", sub: "profile.flightstatussub" },
  { to: "/hotell-bil", icon: Car, title: "profile.hotelcar", sub: "profile.hotelcarsub" },
  { to: "/quiz", icon: Sparkles, title: "profile.quiz", sub: "profile.quizsub" },
  { to: "/samfunn", icon: MessagesSquare, title: "profile.community", sub: "profile.communitysub" },
  { to: "/hjelp", icon: CircleHelp, title: "profile.help", sub: "profile.helpsub" },
];

function MenuRow({ to, icon, title, sub }: { to: string; icon: LucideIcon; title: string; sub: string }) {
  return (
    <li>
      <Link
        to={to}
        className="flex min-h-[68px] items-center gap-3 rounded-lg border border-border bg-card px-4 transition-colors hover:border-foreground/20"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon icon={icon} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{title}</span>
          <span className="block truncate text-[12px] text-muted-foreground">{sub}</span>
        </span>
        <Icon icon={ChevronRight} size={20} className="shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

export default function Profile() {
  usePageMeta(PAGE_META.profile);
  const { customer, isLoading, logout, isLoggingOut } = useCustomer();
  const navigate = useNavigate();
  const t = useT();
  const { lang, setLang } = useLang();
  const { currency, setCurrency } = useLocale();
  const { dark, setDark } = useTheme();
  const [copied, setCopied] = useState(false);
  const resend = trpc.customerAuth.resendVerification.useMutation();
  const myStats = trpc.community.myStats.useQuery(undefined, {
    enabled: !!customer,
    retry: false,
  });
  const utils = trpc.useUtils();
  const prefs = trpc.customerAuth.updatePreferences.useMutation({
    onSuccess: () => utils.customerAuth.me.invalidate(),
  });
  const exportData = trpc.customerAuth.exportMyData.useQuery(undefined, { enabled: false, retry: false });
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  // Språk + valuta lagres lokalt og synkes til kontoen av LangProvider (i18n.tsx).
  // Valuta er kun en visningspreferanse — priser vises alltid i tilbudets valuta.
  const downloadData = async () => {
    const res = await exportData.refetch();
    if (res.data) {
      const json = JSON.stringify(res.data, null, 2);
      setExportUrl(`data:application/json;charset=utf-8,${encodeURIComponent(json)}`);
    }
  };

  const copyReferral = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* utklippstavle utilgjengelig */
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell>
        <AppHeader title={t("profile.title")} as="h1" />

        {/* Konto — greeting + logout når innlogget, ellers innloggings-CTA */}
        {!isLoading &&
          (customer ? (
            <div className="mb-6 rounded-xl bg-night p-5 text-white">
              <div className="flex items-center gap-3.5">
                <Link
                  to="/profil/rediger"
                  aria-label={t("pf.avatar")}
                  className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-full ring-2 ring-white/15 transition-transform hover:scale-105"
                >
                  {customer.avatarUrl ? (
                    <img
                      src={customer.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-primary text-[16px] font-semibold text-primary-foreground">
                      {customer.firstName.charAt(0).toUpperCase()}
                      {customer.lastName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] font-semibold">
                    {customer.firstName} {customer.lastName}
                  </p>
                  <p className="truncate text-[13px] text-white/60">
                    {customer.email ?? customer.phone}
                  </p>
                </div>
                <button
                  onClick={() => logout()}
                  disabled={isLoggingOut}
                  aria-label={t("profile.logout")}
                  title={t("profile.logout")}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 transition-colors hover:bg-white/10 disabled:opacity-50"
                >
                  <Icon icon={LogOut} size={20} />
                </button>
              </div>
              <button
                onClick={() => navigate("/reise")}
                className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-[14px] font-semibold text-primary-foreground transition-colors hover:opacity-90"
              >
                <Icon icon={Luggage} size={16} />
                {t("profile.mybookings")}
              </button>
            </div>
          ) : (
            <Link
              to="/logg-inn"
              className="mb-6 flex items-center gap-3.5 rounded-xl bg-night p-5 text-white transition-colors hover:bg-[hsl(240,6%,14%)]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Icon icon={UserRound} size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold">{t("profile.login")}</span>
                <span className="block text-[13px] text-white/60">{t("profile.loginsub")}</span>
              </span>
              <Icon icon={ChevronRight} size={20} className="shrink-0 text-white/60" />
            </Link>
          ))}

        {/* E-post ikke bekreftet — vennlig banner med send-på-nytt */}
        {customer?.email && !customer.emailVerified && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-300/60 bg-warning/10 px-4 py-3.5 dark:border-amber-400/30 dark:bg-amber-400/10">
            <Icon icon={MailWarning} size={20} className="mt-0.5 shrink-0 text-warning dark:text-amber-300" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-warning dark:text-amber-200">{t("profile.verify")}</p>
              <p className="text-[12px] text-warning/80 dark:text-amber-200/70">{t("profile.verifysub")}</p>
              <button
                onClick={() => resend.mutate()}
                disabled={resend.isPending || resend.isSuccess}
                className="mt-1.5 text-[12px] font-semibold text-warning underline underline-offset-2 disabled:opacity-60 dark:text-amber-100"
              >
                {resend.isSuccess ? t("common.sent") : t("common.resendlink")}
              </button>
            </div>
          </div>
        )}

        {/* Bonus + inviter venner — bare for innloggede */}
        {customer && (
          <div className="mb-6 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border bg-card px-4 py-3.5">
              <p className="flex items-center gap-1.5 eyebrow">
                <Icon icon={Wallet} size={16} /> {t("profile.bonus")}
              </p>
              <p className="mt-1 text-[22px] font-semibold leading-none">{customer.bonusKr ?? 0} kr</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{t("pf.bonusrate")}</p>
            </div>
            <div className="rounded-lg border border-border bg-card px-4 py-3.5">
              <p className="flex items-center gap-1.5 eyebrow">
                <Icon icon={Gift} size={16} /> {t("profile.invite")}
              </p>
              {customer.referralCode ? (
                <button
                  onClick={() => copyReferral(customer.referralCode!)}
                  className="mt-1 flex min-h-11 items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-[14px] font-semibold tracking-wider transition-colors hover:bg-muted/70"
                  aria-label={t("pf.copyreferral", { code: customer.referralCode })}
                >
                  {customer.referralCode}
                  <Icon icon={copied ? Check : Copy} size={16} className="text-muted-foreground" />
                </button>
              ) : (
                <p className="mt-1 text-[13px] text-muted-foreground">—</p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">{t("profile.invitesub")}</p>
            </div>
          </div>
        )}

        {/* Konto-rader — bare for innloggede */}
        {customer && (
          <ul className="mb-6 flex flex-col gap-2">
            <MenuRow to="/profil/rediger" icon={UserPen} title={t("profile.edit")} sub={t("pf.editsub")} />
            <MenuRow to="/profil/reisende" icon={Users} title={t("profile.travelers")} sub={t("pf.travelerssub")} />
            <MenuRow to="/profil/prisvarsler" icon={Bell} title={t("profile.alerts")} sub={t("pf.alertssub")} />
          </ul>
        )}

        {/* Samfunn — dine innlegg og liker, direkte inn i fellesskapet */}
        {customer && (
          <Link
            to="/samfunn"
            className="mb-6 flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3.5 transition-colors hover:border-foreground/20"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20">
              <Icon icon={MessagesSquare} size={20} className="text-primary" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">{t("profile.community")}</span>
              <span className="block text-[12px] text-muted-foreground">
                {myStats.data
                  ? t("pf.stats", { posts: myStats.data.posts, likes: myStats.data.likesReceived })
                  : t("profile.communitysub")}
              </span>
            </span>
            <Icon icon={ChevronRight} size={20} className="shrink-0 text-muted-foreground" />
          </Link>
        )}

        <ul className="flex flex-col gap-2">
          {MENU.map((m) => (
            <MenuRow key={m.to} to={m.to} icon={m.icon} title={t(m.title)} sub={t(m.sub)} />
          ))}
        </ul>

        <p className="mb-2 mt-8 font-mono-label text-[10px] text-muted-foreground">{t("profile.settings")}</p>
        <ul className="flex flex-col gap-2">
          {/* Språk */}
          <li className="flex min-h-[60px] items-center gap-3 rounded-lg border border-border bg-card px-4 py-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon icon={Globe} size={20} />
            </span>
            <label htmlFor="pref-locale" className="flex-1 text-[15px] font-semibold">
              {t("profile.language")}
            </label>
            <select
              id="pref-locale"
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              className="min-h-11 rounded-lg border border-border bg-card px-3 text-[13px] font-semibold"
            >
              {LANGS.map((l) => (
                <option key={l} value={l}>
                  {LANG_LABELS[l]}
                </option>
              ))}
            </select>
          </li>
          {/* Valuta */}
          <li className="flex min-h-[60px] items-center gap-3 rounded-lg border border-border bg-card px-4 py-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon icon={Wallet} size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <label htmlFor="pref-currency" className="block text-[15px] font-semibold">
                {t("profile.currency")}
              </label>
              <span className="block text-[12px] text-muted-foreground">{t("pf.currencyhint")}</span>
            </span>
            <select
              id="pref-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="min-h-11 rounded-lg border border-border bg-card px-3 text-[13px] font-semibold"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </li>
          {customer && (
            <li className="flex min-h-[60px] items-center gap-3 rounded-lg border border-border bg-card px-4 py-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <Icon icon={Mail} size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span id="pref-marketing-label" className="block text-[15px] font-semibold">
                  {t("pf.marketing")}
                </span>
                <span className="block text-[12px] text-muted-foreground">{t("pf.marketingsub")}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={customer.marketingConsent}
                aria-labelledby="pref-marketing-label"
                disabled={prefs.isPending}
                onClick={() => prefs.mutate({ marketingConsent: !customer.marketingConsent })}
                className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60", customer.marketingConsent ? "bg-primary" : "bg-muted")}
              >
                <span className={cn("absolute left-1 top-1 h-5 w-5 rounded-full bg-card shadow transition-transform duration-fast ease-out", customer.marketingConsent ? "translate-x-5" : "translate-x-0")} />
              </button>
            </li>
          )}
          {/* Mørk modus — faktisk bryter */}
          <li className="flex min-h-[60px] items-center gap-3 rounded-lg border border-border bg-card px-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon icon={Moon} size={20} />
            </span>
            <span className="flex-1 text-[15px] font-semibold">{t("profile.theme")}</span>
            <button
              type="button"
              role="switch"
              aria-checked={dark}
              aria-label={t("profile.theme")}
              onClick={() => setDark(!dark)}
              className={cn(
                "relative h-7 w-12 shrink-0 rounded-full transition-colors",
                dark ? "bg-primary" : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "absolute left-1 top-1 h-5 w-5 rounded-full bg-card shadow transition-transform duration-fast ease-out",
                  dark ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>
          </li>
        </ul>
        {prefs.isError && (
          <p role="alert" className="mt-2 text-[12px] text-primary">
            {humanMessage(prefs.error)}
          </p>
        )}

        {customer && (
          <>
            <p className="mb-2 mt-8 font-mono-label text-[10px] text-muted-foreground">{t("pf.privacy")}</p>
            <div className="rounded-lg border border-border bg-card px-4 py-3.5">
              <p className="text-[15px] font-semibold">{t("pf.export")}</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{t("pf.exportsub")}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={downloadData}
                  disabled={exportData.isFetching}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-[13px] font-semibold disabled:opacity-60"
                >
                  <Icon icon={Download} size={16} /> {exportData.isFetching ? t("pf.fetching") : t("pf.prepare")}
                </button>
                {exportUrl && (
                  <a href={exportUrl} download={`hellosky-mine-data-${new Date().toISOString().slice(0, 10)}.json`} className="inline-flex min-h-11 items-center rounded-lg bg-night px-4 text-[13px] font-semibold text-white">
                    {t("pf.downloadjson")}
                  </a>
                )}
              </div>
              {exportData.isError && (
                <p role="alert" className="mt-2 text-[12px] text-primary">
                  {humanMessage(exportData.error)}
                </p>
              )}
            </div>
          </>
        )}

        <div className="mt-8 flex items-center gap-3 rounded-lg bg-accent px-4 py-4">
          <Icon icon={Plane} size={20} className="shrink-0 text-accent-foreground" />
          <p className="text-[13px] font-medium text-accent-foreground">
            {t("pf.footer")}
          </p>
        </div>
      </AppShell>
    </div>
  );
}
