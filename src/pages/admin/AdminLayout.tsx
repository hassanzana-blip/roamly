import { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Ticket,
  FileText,
  Users,
  CreditCard,
  ArrowLeftRight,
  MessageSquare,
  BarChart3,
  ScrollText,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  ChevronDown,
  PlusCircle,
  MessagesSquare,
  StickyNote,
  AlertTriangle,
  Banknote,
  BedDouble,
  ScanSearch,
  CalendarClock,
  ShieldAlert,
  ShoppingCart,
  Globe,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import SkyMark from "@/components/brand/SkyMark";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { PAGE_META, usePageMeta } from "@/lib/seo";

type NavItem = { to: string; label: string; icon: typeof Ticket; perm: string | null; end?: boolean };

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Drift",
    items: [
      { to: "/admin", end: true, label: "Oversikt", icon: LayoutDashboard, perm: null },
      { to: "/admin/gjennomgang", label: "Gjennomgangskø", icon: ScanSearch, perm: "bookings:read" },
      { to: "/admin/bestillinger", label: "Bestillinger", icon: Ticket, perm: "bookings:read" },
      { to: "/admin/ny-bestilling", label: "Ny bestilling", icon: PlusCircle, perm: "bookings:write" },
      { to: "/admin/tilbud", label: "Tilbud", icon: FileText, perm: "quotes:read" },
      { to: "/admin/ruteendringer", label: "Ruteendringer", icon: CalendarClock, perm: "bookings:read" },
      { to: "/admin/sesjoner", label: "Checkout-sesjoner", icon: ShoppingCart, perm: "bookings:read" },
      { to: "/admin/hotell-bil", label: "Hotell og bil", icon: BedDouble, perm: "partners:read" },
    ],
  },
  {
    label: "Kunder",
    items: [
      { to: "/admin/kundeservice", label: "Kundeservice", icon: MessageSquare, perm: "support:read" },
      { to: "/admin/kunder", label: "Kunder", icon: Users, perm: "customers:read" },
      { to: "/admin/samfunn", label: "Reisesamfunn", icon: Globe, perm: "support:write" },
      { to: "/admin/svindel", label: "Svindelflagg", icon: ShieldAlert, perm: "bookings:read" },
    ],
  },
  {
    label: "Økonomi",
    items: [
      { to: "/admin/betalinger", label: "Betalinger", icon: CreditCard, perm: "payments:read" },
      { to: "/admin/refusjoner", label: "Refusjoner", icon: ArrowLeftRight, perm: "payments:read" },
      { to: "/admin/rapporter", label: "Rapporter", icon: BarChart3, perm: "reports:read" },
      { to: "/admin/lonn", label: "Lønn", icon: Banknote, perm: "payroll:read" },
    ],
  },
  {
    label: "Team",
    items: [
      { to: "/admin/meldinger", label: "Teamchat", icon: MessagesSquare, perm: "team:use" },
      { to: "/admin/notater", label: "Notattavle", icon: StickyNote, perm: "team:use" },
      { to: "/admin/problemer", label: "Problemer", icon: AlertTriangle, perm: "problems:read" },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin/aktivitetslogg", label: "Aktivitetslogg", icon: ScrollText, perm: "audit:read" },
      { to: "/admin/innstillinger", label: "Innstillinger", icon: Settings, perm: "settings:manage" },
    ],
  },
];

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Eier",
  ADMIN: "Administrator",
  SUPPORT: "Kundeservice",
  FINANCE: "Økonomi",
  READ_ONLY: "Kun lesing",
};

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { data: permData } = trpc.staffAuth.myPermissions.useQuery(undefined, { staleTime: 60_000, retry: false });
  const perms = new Set<string>(permData?.permissions ?? []);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
        <SkyMark className="h-8 w-8 text-primary" />
        <div>
          <p className="font-display text-xl font-semibold leading-none text-foreground">HelloSky</p>
          <p className="mt-1 eyebrow">Administrator</p>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6" aria-label="Adminmeny">
        {NAV_SECTIONS.map((section) => {
          const visible = section.items.filter((item) => !item.perm || perms.has(item.perm));
          if (visible.length === 0) return null;
          return (
            <div key={section.label}>
              <p className="px-3 pb-1.5 eyebrow">{section.label}</p>
              <ul className="space-y-0.5">
                {visible.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end ?? false}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                          isActive ? "bg-night text-white shadow-sm" : "text-foreground/80 hover:bg-muted hover:text-foreground",
                        )
                      }
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-border px-5 py-4">
        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" /> Beskyttet område · MFA påkrevd
        </p>
      </div>
    </div>
  );
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button type="button" aria-label="Lukk meny" className="absolute inset-0 bg-night/50" onClick={onClose} />
      <aside ref={ref} role="dialog" aria-modal="true" aria-label="Adminmeny" className="absolute inset-y-0 left-0 w-[min(18rem,88vw)] bg-card shadow-2xl">
        <button type="button" aria-label="Lukk meny" onClick={onClose} className="absolute right-2 top-3 grid h-11 w-11 place-items-center rounded-full text-foreground/70 hover:bg-muted">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <SidebarContent onNavigate={onClose} />
      </aside>
    </div>
  );
}

export function AdminLayout() {
  usePageMeta(PAGE_META.admin, { layout: true });
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const me = trpc.staffAuth.me.useQuery(undefined, { retry: false, staleTime: 30_000 });
  const utils = trpc.useUtils();
  const logout = trpc.staffAuth.logout.useMutation({
    onSettled: () => {
      utils.staffAuth.me.reset();
      navigate("/admin/logg-inn", { replace: true });
    },
  });

  if (me.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-live="polite">
        <p className="text-sm text-muted-foreground">Laster …</p>
      </div>
    );
  }
  if (!me.data?.authenticated) {
    return <Navigate to={`/admin/logg-inn?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  // Konto uten MFA må fullføre oppsettet før admin åpnes (OTA-074).
  if (me.data.mfaSetupRequired || (me.data.mfaEnabled && !me.data.mfaVerified)) {
    return <Navigate to="/admin/logg-inn?mfa=1" replace />;
  }

  const user = me.data;
  const isProduction = me.data.environment === "production";

  return (
    <div className="min-h-screen bg-background">
      <a href="#admin-main" className="sr-only z-[100] rounded-lg bg-night px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Hopp til innhold
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-card lg:block">
        <SidebarContent />
      </aside>

      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-card/90 px-3 backdrop-blur sm:gap-3 sm:px-6">
          <button type="button" aria-label="Åpne meny" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="grid h-11 w-11 place-items-center rounded-full text-foreground hover:bg-muted lg:hidden">
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]",
              isProduction ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", isProduction ? "bg-destructive" : "bg-warning")} aria-hidden="true" />
            {isProduction ? "Produksjon" : "Staging / test"}
          </span>
          {!user.sessionFresh && (
            <span className="hidden text-[11px] text-muted-foreground md:inline" title="Sensitive handlinger krever ny innlogging">Sesjon &gt; 15 min</span>
          )}

          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              className="flex min-h-11 items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-3 text-left shadow-sm hover:border-foreground/40"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{user.name.charAt(0).toUpperCase()}</span>
              <span className="hidden sm:block">
                <span className="block text-sm font-semibold leading-tight text-foreground">{user.name}</span>
                <span className="block text-[11px] leading-tight text-muted-foreground">{ROLE_LABEL[user.role] ?? user.role}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </button>
            {userMenuOpen && (
              <>
                <button type="button" aria-label="Lukk brukermeny" className="fixed inset-0 z-10 cursor-default" onClick={() => setUserMenuOpen(false)} />
                <div role="menu" className="absolute right-0 z-20 mt-2 w-60 rounded-lg border border-border bg-card p-2 shadow-xl">
                  <p className="truncate px-3 py-2 text-xs text-muted-foreground">{user.email}</p>
                  <p className="px-3 pb-2 text-xs text-muted-foreground">{ROLE_LABEL[user.role] ?? user.role} · MFA {user.mfaEnabled ? "på" : "av"}</p>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => logout.mutate()}
                    disabled={logout.isPending}
                    className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    {logout.isPending ? "Logger ut …" : "Logg ut"}
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main id="admin-main" tabIndex={-1} className="min-w-0 px-3 py-5 outline-none sm:px-6 sm:py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
