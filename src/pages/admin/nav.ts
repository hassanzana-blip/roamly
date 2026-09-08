import {
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  BarChart3,
  BedDouble,
  CalendarClock,
  CreditCard,
  FileText,
  Globe,
  LayoutDashboard,
  MessageSquare,
  MessagesSquare,
  PlusCircle,
  ScanSearch,
  ScrollText,
  Receipt,
  Settings,
  ShieldCheck,
  ShieldAlert,
  ShoppingCart,
  StickyNote,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Adminens kart – ett sted.
 *
 * Sidemenyen og kommandopaletten leste hver sin liste før. Da er det bare et
 * spørsmål om tid før en ny side finnes i menyen og ikke i søket, eller
 * omvendt. Begge leser herfra, og tillatelsene ligger på oppføringen slik at
 * ingen av dem kan vise noe brukeren ikke har lov til å åpne.
 */

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  perm: string | null;
  end?: boolean;
  /** Ekstra ord kommandopaletten skal treffe på. */
  keywords?: string;
};

export type NavSection = { label: string; items: NavItem[] };

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Drift",
    items: [
      { to: "/admin", end: true, label: "Oversikt", icon: LayoutDashboard, perm: null, keywords: "dashboard hjem start" },
      { to: "/admin/gjennomgang", label: "Gjennomgangskø", icon: ScanSearch, perm: "bookings:read", keywords: "review kø manuell" },
      { to: "/admin/bestillinger", label: "Bestillinger", icon: Ticket, perm: "bookings:read", keywords: "ordre booking pnr billett" },
      { to: "/admin/ny-bestilling", label: "Ny bestilling", icon: PlusCircle, perm: "bookings:write", keywords: "manuell opprett selg" },
      { to: "/admin/tilbud", label: "Tilbud", icon: FileText, perm: "quotes:read", keywords: "quote pristilbud" },
      { to: "/admin/ruteendringer", label: "Ruteendringer", icon: CalendarClock, perm: "bookings:read", keywords: "schedule change forsinkelse" },
      { to: "/admin/sesjoner", label: "Checkout-sesjoner", icon: ShoppingCart, perm: "bookings:read", keywords: "kasse avbrutt handlekurv" },
      { to: "/admin/hotell-bil", label: "Hotell og bil", icon: BedDouble, perm: "partners:read", keywords: "partner leiebil overnatting" },
    ],
  },
  {
    label: "Kunder",
    items: [
      { to: "/admin/kundeservice", label: "Kundeservice", icon: MessageSquare, perm: "support:read", keywords: "support saker henvendelser" },
      { to: "/admin/kunder", label: "Kunder", icon: Users, perm: "customers:read", keywords: "konto profil bruker" },
      { to: "/admin/samfunn", label: "Reisesamfunn", icon: Globe, perm: "support:write", keywords: "community innlegg moderering" },
      { to: "/admin/svindel", label: "Svindelflagg", icon: ShieldAlert, perm: "bookings:read", keywords: "fraud risiko" },
    ],
  },
  {
    label: "Økonomi",
    items: [
      { to: "/admin/betalinger", label: "Betalinger", icon: CreditCard, perm: "payments:read", keywords: "stripe kort fangst" },
      { to: "/admin/refusjoner", label: "Refusjoner", icon: ArrowLeftRight, perm: "payments:read", keywords: "refund tilbakebetaling" },
      { to: "/admin/rapporter", label: "Rapporter", icon: BarChart3, perm: "reports:read", keywords: "omsetning tall statistikk" },
      { to: "/admin/utgifter", label: "Utgifter", icon: Receipt, perm: "expenses:read", keywords: "bilag kvittering mva regnskap utlegg" },
      { to: "/admin/lonn", label: "Lønn", icon: Banknote, perm: "payroll:read", keywords: "payroll utbetaling ansatt" },
    ],
  },
  {
    label: "Team",
    items: [
      { to: "/admin/meldinger", label: "Teamchat", icon: MessagesSquare, perm: "team:use", keywords: "chat melding intern" },
      { to: "/admin/notater", label: "Notattavle", icon: StickyNote, perm: "team:use", keywords: "notat huskeliste" },
      { to: "/admin/problemer", label: "Problemer", icon: AlertTriangle, perm: "problems:read", keywords: "feil issue avvik" },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin/sikkerhet", label: "Sikkerhet", icon: ShieldCheck, perm: null, keywords: "totrinn mfa totp passord tofaktor" },
      { to: "/admin/aktivitetslogg", label: "Aktivitetslogg", icon: ScrollText, perm: "audit:read", keywords: "audit logg sporing" },
      { to: "/admin/innstillinger", label: "Innstillinger", icon: Settings, perm: "settings:manage", keywords: "oppsett gebyr konfigurasjon" },
    ],
  },
];

export const ROLE_LABEL: Record<string, string> = {
  OWNER: "Eier",
  ADMIN: "Administrator",
  SUPPORT: "Kundeservice",
  FINANCE: "Økonomi",
  READ_ONLY: "Kun lesing",
};

/** Seksjonene brukeren faktisk har tilgang til, tomme seksjoner fjernet. */
export function visibleSections(perms: Set<string>): NavSection[] {
  return NAV_SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => !i.perm || perms.has(i.perm)) })).filter((s) => s.items.length > 0);
}

/** Flat liste – kommandopaletten søker i denne. */
export function visibleItems(perms: Set<string>): NavItem[] {
  return visibleSections(perms).flatMap((s) => s.items);
}
