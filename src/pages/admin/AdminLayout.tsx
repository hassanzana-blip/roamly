import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { ChevronDown, ExternalLink, Keyboard, LogOut, Menu, Search, ShieldCheck, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import SkyMark from "@/components/brand/SkyMark";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { Avatar } from "@/components/admin/Avatar";
import { CommandPalette, type Command } from "@/components/admin/CommandPalette";
import { ShortcutSheet } from "@/components/admin/ShortcutSheet";
import { MfaGate } from "@/components/admin/MfaGate";
import { ROLE_LABEL, visibleItems, visibleSections } from "./nav";

// ─── Adminskallet ───────────────────────────────────────────────────────────
//
// Dette er verktøyet Zyar og Zana står i hele dagen, ikke en side kunder
// besøker én gang. Da gjelder andre regler: tastaturet er hovedveien, ⌘K er
// inngangen til alt, flatene er materialer som ligger over innholdet i stedet
// for bokser ved siden av det, og ingenting beveger seg mer enn nødvendig.

function useStaffPermissions(): Set<string> {
  const { data } = trpc.staffAuth.myPermissions.useQuery(undefined, { staleTime: 60_000, retry: false });
  return useMemo(() => new Set<string>(data?.permissions ?? []), [data]);
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const perms = useStaffPermissions();
  const sections = visibleSections(perms);
  // Nummereringen følger den flate rekkefølgen ⌘1–⌘9 bruker. Den regnes ut
  // før rendering, ikke underveis: en teller som teller opp mens JSX bygges
  // gir ulike tall avhengig av hvor mange ganger React kjører render.
  const numberOf = new Map(visibleItems(perms).slice(0, 9).map((item, i) => [item.to, i + 1]));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
        <SkyMark className="h-8 w-8 text-primary" />
        <div>
          <p className="font-display text-xl font-semibold leading-none text-foreground">HelloSky</p>
          <p className="mt-1 eyebrow">Internportal</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6" aria-label="Adminmeny">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-3 pb-1.5 eyebrow">{section.label}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const shortcut = numberOf.get(item.to) ?? null;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end ?? false}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                          isActive ? "bg-night text-white shadow-sm" : "text-foreground/80 hover:bg-muted hover:text-foreground",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {/* Tallet står der dempet og dukker opp ved hover. Slik
                              lærer man snarveien av å bruke menyen. */}
                          {shortcut && (
                            <span
                              className={cn(
                                "shrink-0 text-[11px] tabular-nums transition-opacity",
                                isActive ? "text-white/50 opacity-100" : "text-muted-foreground opacity-0 group-hover:opacity-100",
                              )}
                              aria-hidden="true"
                            >
                              ⌘{shortcut}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
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
      <button type="button" aria-label="Lukk meny" className="palette-scrim absolute inset-0 bg-night/50" onClick={onClose} />
      <aside ref={ref} role="dialog" aria-modal="true" aria-label="Adminmeny" className="absolute inset-y-0 left-0 w-[min(18rem,88vw)] bg-card shadow-2xl">
        <button type="button" aria-label="Lukk meny" onClick={onClose} className="absolute right-2 top-3 grid size-11 place-items-center rounded-full text-foreground/70 hover:bg-muted">
          <X className="size-5" aria-hidden="true" />
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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const me = trpc.staffAuth.me.useQuery(undefined, { retry: false, staleTime: 30_000 });
  const perms = useStaffPermissions();
  const utils = trpc.useUtils();
  const logout = trpc.staffAuth.logout.useMutation({
    onSettled: () => {
      utils.staffAuth.me.reset();
      navigate("/admin/logg-inn", { replace: true });
    },
  });

  const items = useMemo(() => visibleItems(perms), [perms]);

  const extraCommands = useMemo<Command[]>(
    () => [
      { id: "act:site", label: "Åpne kundesiden i ny fane", group: "Handlinger", keywords: "nettsted forside hellosky", icon: ExternalLink, run: () => window.open("/", "_blank", "noopener") },
      { id: "act:keys", label: "Vis hurtigtaster", group: "Handlinger", keywords: "tastatur snarveier hjelp", icon: Keyboard, run: () => setShortcutsOpen(true) },
      { id: "act:logout", label: "Logg ut", group: "Handlinger", keywords: "avslutt sesjon", icon: LogOut, run: () => logout.mutate() },
    ],
    [logout],
  );

  /**
   * Tastaturet, ett sted.
   *
   * Snarveiene skal aldri stjele et tastetrykk fra et felt man skriver i –
   * derfor sjekken mot inputfelt og contenteditable. ⌘K er unntaket: den skal
   * virke uansett hvor markøren står, slik den gjør i verktøyene folk kommer
   * fra.
   */
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName));
      if (typing) return;

      if (mod && /^[1-9]$/.test(e.key)) {
        const item = items[Number(e.key) - 1];
        if (item) {
          e.preventDefault();
          navigate(item.to);
        }
        return;
      }
      if (e.key === "?" && !mod) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
    },
    [items, navigate],
  );

  useEffect(() => {
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onKey]);

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
  // Innlogget, men totrinn ikke bekreftet: serveren avviser uansett alt annet,
  // så skallet vises ikke før koden er inne.
  if (me.data.mfaEnabled && !me.data.mfaVerified) {
    return <MfaGate name={me.data.name} onVerified={() => void utils.staffAuth.me.invalidate()} />;
  }

  const user = me.data;
  const isProduction = me.data.environment === "production";
  const current = items.find((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)));

  return (
    <div className="min-h-screen bg-background">
      <a href="#admin-main" className="sr-only z-[100] rounded-lg bg-night px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Hopp til innhold
      </a>

      <aside className="admin-material fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border lg:block">
        <SidebarContent />
      </aside>

      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="lg:pl-64">
        <header className="admin-material sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border px-3 sm:gap-3 sm:px-6">
          <button type="button" aria-label="Åpne meny" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="grid size-11 place-items-center rounded-full text-foreground hover:bg-muted lg:hidden">
            <Menu className="size-5" aria-hidden="true" />
          </button>

          {/* Paletten har en synlig dør. En snarvei ingen vet om, finnes ikke. */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-border bg-background/60 px-3 text-left text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground sm:max-w-xs"
          >
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{current ? `Søk · ${current.label}` : "Søk eller hopp til …"}</span>
            <kbd className="admin-kbd hidden shrink-0 sm:inline-grid">⌘K</kbd>
          </button>

          <span
            className={cn(
              "ml-auto hidden items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] sm:inline-flex",
              isProduction ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning",
            )}
          >
            <span className={cn("size-1.5 rounded-full", isProduction ? "bg-destructive" : "bg-warning")} aria-hidden="true" />
            {isProduction ? "Produksjon" : "Staging / test"}
          </span>

          {!user.sessionFresh && (
            <span className="hidden text-[11px] text-muted-foreground md:inline" title="Sensitive handlinger krever ny innlogging">
              Sesjon &gt; 15 min
            </span>
          )}

          <div className="relative ml-auto sm:ml-0">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              className="flex min-h-11 items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-3 text-left shadow-sm transition-colors hover:border-foreground/40"
            >
              <Avatar name={user.name} size={32} />
              <span className="hidden sm:block">
                <span className="block text-sm font-semibold leading-tight text-foreground">{user.name}</span>
                <span className="block text-[11px] leading-tight text-muted-foreground">{ROLE_LABEL[user.role] ?? user.role}</span>
              </span>
              <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
            </button>
            {userMenuOpen && (
              <>
                <button type="button" aria-label="Lukk brukermeny" className="fixed inset-0 z-10 cursor-default" onClick={() => setUserMenuOpen(false)} />
                <div role="menu" className="palette-panel absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
                  <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
                    <Avatar name={user.name} size={40} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
                      <p className="truncate text-[12px] text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="p-2">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setShortcutsOpen(true);
                      }}
                      className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-semibold text-foreground hover:bg-muted"
                    >
                      <Keyboard className="size-4" aria-hidden="true" /> Hurtigtaster
                      <kbd className="admin-kbd ml-auto">?</kbd>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => logout.mutate()}
                      disabled={logout.isPending}
                      className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      <LogOut className="size-4" aria-hidden="true" />
                      {logout.isPending ? "Logger ut …" : "Logg ut"}
                    </button>
                  </div>
                  <p className="flex items-center gap-1.5 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-success" aria-hidden="true" /> All aktivitet logges
                  </p>
                </div>
              </>
            )}
          </div>
        </header>

        <main id="admin-main" tabIndex={-1} className="min-w-0 px-3 py-5 outline-none sm:px-6 sm:py-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} perms={perms} extra={extraCommands} />
      <ShortcutSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
