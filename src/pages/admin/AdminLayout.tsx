import { useState } from "react";
import { NavLink, Navigate, Outlet, useNavigate } from "react-router";
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
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import RoamlyMark from "@/components/brand/RoamlyMark";
import { cn } from "@/lib/utils";

const NAV_SECTIONS = [
  {
    label: "Drift",
    items: [
      { to: "/admin", end: true, label: "Oversikt", icon: LayoutDashboard, perm: null },
      { to: "/admin/bestillinger", label: "Bestillinger", icon: Ticket, perm: "bookings:read" },
      { to: "/admin/tilbud", label: "Tilbud", icon: FileText, perm: "quotes:read" },
      { to: "/admin/kundeservice", label: "Kundeservice", icon: MessageSquare, perm: "support:read" },
    ],
  },
  {
    label: "Økonomi",
    items: [
      { to: "/admin/betalinger", label: "Betalinger", icon: CreditCard, perm: "payments:read" },
      { to: "/admin/refusjoner", label: "Endringer og refusjoner", icon: ArrowLeftRight, perm: "payments:read" },
      { to: "/admin/rapporter", label: "Rapporter", icon: BarChart3, perm: "reports:read" },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin/kunder", label: "Kunder", icon: Users, perm: "customers:read" },
      { to: "/admin/aktivitetslogg", label: "Aktivitetslogg", icon: ScrollText, perm: "audit:read" },
      { to: "/admin/innstillinger", label: "Innstillinger", icon: Settings, perm: "settings:manage" },
    ],
  },
] as const;

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Eier",
  ADMIN: "Administrator",
  SUPPORT: "Kundeservice",
  FINANCE: "Økonomi",
  READ_ONLY: "Kun lesing",
};

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { data: permData } = trpc.staffAuth.myPermissions.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });
  const perms = new Set(permData?.permissions ?? []);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
        <RoamlyMark className="h-8 w-8" />
        <div>
          <p className="font-display text-lg font-bold leading-none text-night">Roamly</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Administrator
          </p>
        </div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {NAV_SECTIONS.map((section) => {
          const visible = section.items.filter((item) => !item.perm || perms.has(item.perm));
          if (visible.length === 0) return null;
          return (
            <div key={section.label}>
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
                {section.label}
              </p>
              <ul className="space-y-1">
                {visible.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={"end" in item ? item.end : false}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                          isActive
                            ? "bg-night text-white shadow-sm"
                            : "text-night/70 hover:bg-night/5 hover:text-night",
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
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          Beskyttet område · MFA påkrevd
        </p>
      </div>
    </div>
  );
}

export function AdminLayout() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const me = trpc.staffAuth.me.useQuery(undefined, { retry: false, staleTime: 30_000 });
  const logout = trpc.staffAuth.logout.useMutation({
    onSettled: () => navigate("/admin/logg-inn", { replace: true }),
  });

  if (me.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Laster …</p>
      </div>
    );
  }
  if (!me.data?.authenticated) {
    return <Navigate to="/admin/logg-inn" replace />;
  }

  const user = me.data;
  const isProduction = me.data.environment === "production";

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-white lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Lukk meny"
            className="absolute inset-0 bg-night/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl">
            <button
              type="button"
              aria-label="Lukk meny"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 rounded-full p-2 text-night/60 hover:bg-night/5"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            aria-label="Åpne meny"
            onClick={() => setMobileOpen(true)}
            className="rounded-full p-2 text-night hover:bg-night/5 lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em]",
              isProduction ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800",
            )}
          >
            <span
              className={cn("h-1.5 w-1.5 rounded-full", isProduction ? "bg-rose-500" : "bg-amber-500")}
              aria-hidden="true"
            />
            {isProduction ? "Produksjon" : "Staging / test"}
          </span>

          <div className="ml-auto relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2.5 rounded-full border border-border bg-white py-1.5 pl-1.5 pr-3 text-left shadow-sm hover:border-night/30"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:block">
                <span className="block text-sm font-semibold leading-tight text-night">{user.name}</span>
                <span className="block text-[11px] leading-tight text-muted-foreground">
                  {ROLE_LABEL[user.role] ?? user.role}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </button>
            {userMenuOpen && (
              <>
                <button
                  type="button"
                  aria-label="Lukk brukermeny"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-border bg-white p-2 shadow-xl"
                >
                  <p className="truncate px-3 py-2 text-xs text-muted-foreground">{user.email}</p>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => logout.mutate()}
                    disabled={logout.isPending}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-night hover:bg-night/5 disabled:opacity-50"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    {logout.isPending ? "Logger ut …" : "Logg ut"}
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
