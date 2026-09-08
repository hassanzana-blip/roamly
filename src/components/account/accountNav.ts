import {
  Bell,
  Gift,
  Heart,
  LayoutGrid,
  Luggage,
  MessagesSquare,
  Settings2,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Kartet over Min side – ett sted.
 *
 * Sidemenyen på store skjermer, snarveiene på små og bunnavigasjonen leste
 * hver sin liste. Da er det bare et spørsmål om tid før en ny side finnes ett
 * sted og mangler et annet. Alle leser herfra.
 */
export type AccountItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

export const ACCOUNT_NAV: AccountItem[] = [
  { to: "/profil", label: "Oversikt", icon: LayoutGrid, end: true },
  { to: "/reiser", label: "Mine reiser", icon: Luggage },
  { to: "/lagret", label: "Lagret", icon: Heart },
  { to: "/tavler", label: "Reisetavler", icon: MessagesSquare },
  { to: "/profil/reisende", label: "Reisende", icon: Users },
  { to: "/profil/reiseprofil", label: "Reiseprofil", icon: Sparkles },
  { to: "/profil/prisvarsler", label: "Prisvarsler", icon: Bell },
  { to: "/profil/bonus", label: "HelloSky Bonus", icon: Gift },
  { to: "/profil/innstillinger", label: "Innstillinger", icon: Settings2 },
];
