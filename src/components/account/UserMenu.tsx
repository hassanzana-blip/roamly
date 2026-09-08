import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  Bell,
  Gift,
  Heart,
  LifeBuoy,
  LogOut,
  Luggage,
  Moon,
  Sparkles,
  Sun,
  TrendingDown,
  User,
  UserPen,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Icon from "@/components/app/Icon";
import { useCustomer } from "@/lib/useCustomer";
import { useAccountHub } from "@/lib/useAccount";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Kontomenyen – snarveien til Min HelloSky fra hvilken som helst side.
 *
 * Den er en snarvei, ikke en kopi av /profil: de fem tingene folk kommer
 * tilbake til, bonusen, hjelpen og utloggingen. Tellere vises bare når de
 * finnes. Menyen skalerer ut fra avataren (Radix setter transform-origin),
 * så den kommer tydelig fra knappen du trykket på.
 */

type Row = {
  to: string;
  icon: LucideIcon;
  label: string;
  /** Tall til høyre – vises bare når det er større enn null. */
  count?: number;
  /** Fri tekst til høyre, f.eks. bonussaldo. */
  meta?: string;
  /** Lime merke til høyre – ett per meny, forbeholdt bonusen. */
  accent?: boolean;
};

function MenuRow({ row, onSelect }: { row: Row; onSelect?: () => void }) {
  const count = row.count ?? 0;
  return (
    <DropdownMenuItem asChild className="min-h-11 rounded-lg px-2.5 py-2">
      <Link to={row.to} onClick={onSelect} className="flex w-full items-center gap-2.5">
        <Icon icon={row.icon} size={20} className="shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-[15px] font-medium">{row.label}</span>
        {row.meta ? (
          <Badge variant={row.accent ? "default" : "secondary"} className="t-num shrink-0 rounded-md px-1.5 text-xs font-semibold">
            {row.meta}
          </Badge>
        ) : count > 0 ? (
          <span className="t-num grid size-5 shrink-0 place-items-center rounded-full bg-foreground text-[11px] font-bold text-background">{count}</span>
        ) : null}
      </Link>
    </DropdownMenuItem>
  );
}

function Section({ children }: { children: ReactNode }) {
  return <DropdownMenuGroup className="p-1">{children}</DropdownMenuGroup>;
}

/** Avataren: kundens bilde, ellers initialene, ellers et personikon. */
function CustomerAvatar({ className }: { className?: string }) {
  const { customer } = useCustomer();
  const initials = customer ? `${customer.firstName.charAt(0)}${customer.lastName.charAt(0)}`.toUpperCase() : "";
  return (
    <Avatar className={cn("size-10 border border-border bg-card", className)}>
      {customer?.avatarUrl ? <AvatarImage src={customer.avatarUrl} alt="" /> : null}
      <AvatarFallback className="bg-muted text-[13px] font-semibold text-foreground">
        {initials || <Icon icon={User} size={20} className="text-foreground" />}
      </AvatarFallback>
    </Avatar>
  );
}

export default function UserMenu({ tone = "light" }: { tone?: "light" | "dark" }) {
  const t = useT();
  const { customer, logout, isLoggingOut } = useCustomer();
  const hub = useAccountHub();
  const { dark, setDark } = useTheme();
  const h = hub.data;
  const onDark = tone === "dark";

  const trigger = (
    <button
      type="button"
      aria-label={customer ? t("topbar.openprofile") : t("profile.login")}
      className={cn(
        "flex min-h-11 min-w-11 items-center gap-2.5 rounded-full p-0.5 outline-none transition-colors duration-fast",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        onDark ? "hover:bg-white/10 focus-visible:ring-offset-transparent" : "hover:bg-muted/60",
      )}
    >
      {customer ? (
        <span className={cn("hidden max-w-[9rem] truncate pl-2.5 text-[14px] font-medium sm:block", onDark ? "text-white/85" : "text-foreground")}>
          {t("greet.name", { name: customer.firstName })}
        </span>
      ) : null}
      <CustomerAvatar className={onDark ? "border-white/25 bg-white/10" : undefined} />
    </button>
  );

  // ── Gjest: én vei inn, og det som virker uten konto ──
  if (!customer) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-[280px] rounded-2xl p-0">
          <div className="p-3">
            <p className="t-h3">{t("profile.login")}</p>
            <p className="t-caption mt-1">{t("profile.loginsub")}</p>
            <div className="mt-3 grid gap-2">
              <Button asChild size="md" className="w-full">
                <Link to="/logg-inn">{t("common.login")}</Link>
              </Button>
              <Button asChild variant="outline" size="md" className="w-full">
                <Link to="/logg-inn?modus=registrer">{t("au.tab.register")}</Link>
              </Button>
            </div>
          </div>
          <DropdownMenuSeparator className="my-0" />
          <Section>
            <MenuRow row={{ to: "/reise", icon: Luggage, label: t("profile.mytrip") }} />
            <MenuRow row={{ to: "/hjelp", icon: LifeBuoy, label: t("acct.help") }} />
          </Section>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const tier = h?.rewards.tier.name ?? "Explorer";
  const bonus = customer.bonusKr ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[300px] rounded-2xl p-0">
        {/* Hvem du er, og hvilket nivå bonusen står på. */}
        <Link to="/profil" className="flex items-center gap-3 p-3 transition-colors duration-fast hover:bg-muted/50">
          <CustomerAvatar />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">
              {customer.firstName} {customer.lastName}
            </span>
            <span className="block truncate text-[13px] text-muted-foreground">{customer.email}</span>
          </span>
          <Badge variant="secondary" className="shrink-0 rounded-md text-xs font-semibold uppercase tracking-wide">
            {tier}
          </Badge>
        </Link>

        <DropdownMenuSeparator className="my-0" />

        {/* Utseende: to valg, ett trykk. */}
        <Section>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="min-h-11 rounded-lg px-2.5 py-2">
              <span className="flex items-center gap-2.5">
                <Icon icon={dark ? Moon : Sun} size={20} className="text-muted-foreground" />
                <span className="text-[15px] font-medium">{t("theme.appearance")}</span>
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="rounded-xl p-1">
                <DropdownMenuRadioGroup value={dark ? "dark" : "light"} onValueChange={(v) => setDark(v === "dark")}>
                  <DropdownMenuRadioItem value="light" className="min-h-10 gap-2.5 rounded-lg text-[15px]">
                    <Icon icon={Sun} size={20} className="text-muted-foreground" /> {t("theme.light")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark" className="min-h-10 gap-2.5 rounded-lg text-[15px]">
                    <Icon icon={Moon} size={20} className="text-muted-foreground" /> {t("theme.dark")}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </Section>

        <DropdownMenuSeparator className="my-0" />

        {/* Reisene dine */}
        <Section>
          <MenuRow row={{ to: "/reiser", icon: Luggage, label: t("acct.trips"), count: h?.upcomingCount }} />
          <MenuRow row={{ to: "/profil/reisende", icon: Users, label: t("acct.travelers") }} />
          <MenuRow row={{ to: "/profil/prisovervaking", icon: TrendingDown, label: t("acct.hub.watch"), count: h?.watches.length }} />
        </Section>

        <DropdownMenuSeparator className="my-0" />

        {/* Personlig */}
        <Section>
          <MenuRow row={{ to: "/lagret", icon: Heart, label: t("acct.saved"), count: h?.savedCount }} />
          <MenuRow row={{ to: "/profil/varsler", icon: Bell, label: t("acct.notifications"), count: h?.unreadNotifications }} />
          <MenuRow row={{ to: "/profil/reiseprofil", icon: Sparkles, label: t("acct.travelprofile") }} />
        </Section>

        <DropdownMenuSeparator className="my-0" />

        {/* Bonus: det ene lime merket i menyen. */}
        <Section>
          <MenuRow row={{ to: "/profil/bonus", icon: Wallet, label: t("acct.rewards"), meta: `${bonus} kr`, accent: bonus > 0 }} />
          <MenuRow row={{ to: "/profil/inviter", icon: Gift, label: t("acct.invite") }} />
        </Section>

        <DropdownMenuSeparator className="my-0" />

        <Section>
          <MenuRow row={{ to: "/hjelp", icon: LifeBuoy, label: t("acct.help") }} />
          <MenuRow row={{ to: "/profil/rediger", icon: UserPen, label: t("acct.edit") }} />
        </Section>

        <DropdownMenuSeparator className="my-0" />

        <Section>
          <DropdownMenuItem
            onSelect={() => logout()}
            disabled={isLoggingOut}
            className="min-h-11 gap-2.5 rounded-lg px-2.5 py-2 text-[15px] font-medium"
          >
            <Icon icon={LogOut} size={20} className="text-muted-foreground" />
            {t("profile.logout")}
          </DropdownMenuItem>
        </Section>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { CustomerAvatar, UserRound };
