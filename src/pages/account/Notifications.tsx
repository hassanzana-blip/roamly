import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Bell, CalendarClock, CreditCard, Gift, Info, Plane, Sparkles, Ticket, TrendingDown, Users, Wallet, type LucideIcon } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import Icon from "@/components/app/Icon";
import { EmptyState } from "@/components/app/primitives";
import { Toggle } from "@/components/account/AccountRow";
import { NoNotificationsSpot } from "@/components/graphics";
import { Segmented } from "@/components/ui/segmented";
import { useCustomer } from "@/lib/useCustomer";
import { useTravelProfile } from "@/lib/useAccount";
import { useT, type I18nKey } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { formatDateShort } from "@/lib/format";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";

const TYPES = ["price_watch", "flight_update", "booking", "payment", "reminder", "deal", "match", "referral", "rewards", "system"] as const;
type NType = (typeof TYPES)[number];
const ICON: Record<NType, LucideIcon> = { price_watch: TrendingDown, flight_update: Plane, booking: Ticket, payment: CreditCard, reminder: CalendarClock, deal: Sparkles, match: Users, referral: Gift, rewards: Wallet, system: Info };
/** Transaksjonelle typer kan ikke slås av på e-post – de følger bestillingen. */
const LOCKED_EMAIL: NType[] = ["booking", "payment", "flight_update"];

export default function Notifications() {
  usePageMeta(PAGE_META.notifications);
  const t = useT();
  const navigate = useNavigate();
  const { customer, isLoading } = useCustomer();
  const { profile } = useTravelProfile();
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"inbox" | "prefs">("inbox");
  const list = trpc.account.notifications.useQuery(undefined, { enabled: Boolean(customer), retry: false });
  const markRead = trpc.account.markRead.useMutation({ onSuccess: () => { utils.account.notifications.invalidate(); utils.account.unreadCount.invalidate(); utils.account.hub.invalidate(); } });
  const markAll = trpc.account.markAllRead.useMutation({ onSuccess: () => { utils.account.notifications.invalidate(); utils.account.unreadCount.invalidate(); utils.account.hub.invalidate(); } });
  const setPrefs = trpc.account.updateNotificationPrefs.useMutation({ onSuccess: () => utils.account.travelProfile.invalidate() });

  useEffect(() => {
    if (!isLoading && !customer) navigate("/logg-inn?next=/profil/varsler");
  }, [customer, isLoading, navigate]);
  if (!customer) return null;

  const items = list.data ?? [];
  const unread = items.filter((n) => !n.readAt).length;
  const prefs = profile?.notificationPrefs;

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell className="max-w-2xl">
        <AppHeader title={t("nt.title")} back as="h1" />
        <div className="mb-5 flex items-center justify-between gap-3">
          <Segmented aria-label={t("nt.title")} value={tab} onValueChange={(v) => setTab(v as "inbox" | "prefs")} options={[{ value: "inbox", label: t("nt.inbox") }, { value: "prefs", label: t("nt.prefs") }]} className="w-auto" />
          {tab === "inbox" && unread > 0 && (
            <button type="button" onClick={() => markAll.mutate()} disabled={markAll.isPending} className="min-h-11 text-[13px] font-semibold text-muted-foreground hover:text-foreground">{t("nt.markall")}</button>
          )}
        </div>

        {tab === "inbox" && (
          items.length === 0 ? (
            <EmptyState illustration={<NoNotificationsSpot />} title={t("nt.empty")} body={t("nt.emptysub")} />
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((n) => {
                const I = ICON[n.type as NType] ?? Bell;
                const open = () => {
                  if (!n.readAt) markRead.mutate({ id: n.id });
                  if (n.href) navigate(n.href);
                };
                return (
                  <li key={n.id}>
                    <button type="button" onClick={open} className={cn("flex w-full items-start gap-3 rounded-lg border px-4 py-3.5 text-left transition-colors hover:border-foreground/25", n.readAt ? "border-border bg-card" : "border-transparent bg-primary-soft")}>
                      <span className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full", n.readAt ? "bg-muted" : "bg-card")}><Icon icon={I} size={20} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className={cn("text-[15px] leading-tight", n.readAt ? "font-medium" : "font-semibold")}>{n.title}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{formatDateShort(n.createdAt)}</span>
                        </span>
                        {n.body && <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">{n.body}</span>}
                      </span>
                      {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        )}

        {tab === "prefs" && prefs && (
          <>
            <p className="mb-4 text-[13px] text-muted-foreground">{t("nt.prefsnote")}</p>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="grid grid-cols-[1fr_72px_72px] items-center border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <span />
                <span className="text-center">{t("nt.email")}</span>
                <span className="text-center">{t("nt.inapp")}</span>
              </div>
              {TYPES.map((type) => {
                const I = ICON[type];
                const lockedEmail = LOCKED_EMAIL.includes(type);
                return (
                  <div key={type} className="grid min-h-14 grid-cols-[1fr_72px_72px] items-center border-b border-border px-4 last:border-b-0">
                    <span className="flex items-center gap-2.5 text-[14px] font-medium"><Icon icon={I} size={16} className="text-muted-foreground" /> {t(`nt.type.${type}` as I18nKey)}</span>
                    <span className="flex justify-center">
                      <Toggle checked={lockedEmail ? true : prefs.email[type] !== false} disabled={lockedEmail || setPrefs.isPending} label={`${t(`nt.type.${type}` as I18nKey)} · ${t("nt.email")}`} onChange={(v) => setPrefs.mutate({ email: { [type]: v } })} />
                    </span>
                    <span className="flex justify-center">
                      <Toggle checked={prefs.inApp[type] !== false} disabled={setPrefs.isPending} label={`${t(`nt.type.${type}` as I18nKey)} · ${t("nt.inapp")}`} onChange={(v) => setPrefs.mutate({ inApp: { [type]: v } })} />
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </AppShell>
    </div>
  );
}
