import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { Bell, Check, ChevronsUpDown, ExternalLink, Keyboard, LogOut, Menu, Search, Settings, ShieldCheck, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import SkyMark from "@/components/brand/SkyMark";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { Avatar } from "@/components/admin/Avatar";
import { CommandPalette, type Command } from "@/components/admin/CommandPalette";
import { ShortcutSheet } from "@/components/admin/ShortcutSheet";
import { MfaGate } from "@/components/admin/MfaGate";
import { LockGate } from "@/components/admin/LockGate";
import { ProfileGate } from "@/components/admin/ProfileGate";
import { useIdleLock } from "@/hooks/useIdleLock";
import { AdminPrefsProvider } from "@/providers/adminPrefs";
import { ROLE_LABEL, visibleItems, visibleSections } from "./nav";

/** Litt kortere enn serverens grense, så låsen kommer fra oss og ikke som en avvist forespørsel. */
const IDLE_LOCK_MS = 14 * 60_000;

// ─── Adminskallet ───────────────────────────────────────────────────────────
//
// Dette er verktøyet Zyar og Zana står i hele dagen, ikke en side kunder
// besøker én gang. Da gjelder andre regler: tastaturet er hovedveien, ⌘K er
// inngangen til alt, og ingenting beveger seg mer enn nødvendig.
//
// Skallet følger én regel: flatene skal være rolige nok til at tallene er det
// eneste som roper. Sidemenyen er hvit og solid, ikke gjennomsiktig. Den
// aktive lenken er en myk blå flate med blått ikon, ikke en fylt mørk boks.
// Eieren står nederst i sidemenyen slik kontobytte gjør i macOS, ikke som et
// kort oppe i hjørnet.

type Owner = {
  name: string;
  email: string;
  role: string;
  profiles: { id: string; name: string; title: string }[];
  activeProfile: string | null;
};

function useStaffPermissions(): Set<string> {
  const { data } = trpc.staffAuth.myPermissions.useQuery(undefined, { staleTime: 60_000, retry: false });
  return useMemo(() => new Set<string>(data?.permissions ?? []), [data]);
}

/**
 * «Hvem av oss?», nederst i sidemenyen.
 *
 * Menyen åpner oppover fordi knappen står nederst. Profilbyttet er ikke en
 * tilgang – rollen på kontoen avgjør fortsatt alt – det avgjør hvilket navn
 * revisjonsloggen skriver fra og med neste handling.
 */
function OwnerMenu({
  owner,
  activeName,
  variant,
  onSetProfile,
  onShortcuts,
  onLogout,
  loggingOut,
}: {
  owner: Owner;
  activeName: string;
  variant: "sidemeny" | "topplinje";
  onSetProfile: (id: string) => void;
  onShortcuts: () => void;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const [open, setOpen] = useState(false);
  const inSidebar = variant === "sidemeny";

  return (
    <div className={cn("relative", inSidebar && "px-3 pb-3 pt-2")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={inSidebar ? undefined : "Konto og profil"}
        className={cn(
          "flex items-center gap-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
          inSidebar ? "w-full rounded-[10px] px-2 py-2 hover:bg-muted" : "rounded-full p-0.5 hover:bg-muted",
        )}
      >
        {/* Navnet her er profilen, ikke kontoen. Deler to personer én konto,
            er det profilen som svarer på «hvem er logget inn». */}
        <Avatar name={activeName} size={inSidebar ? 32 : 28} />
        {inSidebar && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-tight text-foreground">{activeName}</span>
              <span className="block truncate text-[11px] leading-tight text-subtle">{ROLE_LABEL[owner.role] ?? owner.role}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-subtle" aria-hidden="true" />
          </>
        )}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Lukk brukermeny" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className={cn(
              "palette-panel admin-menu absolute z-20 w-[232px] overflow-hidden rounded-[14px] border border-border bg-card",
              inSidebar ? "bottom-full left-3 mb-1" : "right-0 top-full mt-2",
            )}
          >
            <div className="px-3.5 pb-2.5 pt-3">
              <p className="eyebrow">Innlogget</p>
              <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{owner.email}</p>
            </div>

            {/* Bytt profil uten å logge ut: samme konto, annet navn i
                revisjonsloggen fra og med neste handling. */}
            {owner.profiles.length > 0 && (
              <div className="border-t border-border p-1.5">
                {owner.profiles.map((p) => {
                  const on = owner.activeProfile === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={on}
                      onClick={() => {
                        setOpen(false);
                        if (!on) onSetProfile(p.id);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      <Avatar name={p.name} size={24} />
                      <span className="min-w-0 flex-1 truncate text-left">{p.name}</span>
                      {on && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="border-t border-border p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onShortcuts();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
              >
                <Keyboard className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1 text-left">Hurtigtaster</span>
                <kbd className="admin-kbd">?</kbd>
              </button>
              <NavLink
                to="/admin/innstillinger"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
              >
                <Settings className="size-4 text-muted-foreground" aria-hidden="true" />
                Innstillinger
              </NavLink>
              <button
                type="button"
                role="menuitem"
                onClick={onLogout}
                disabled={loggingOut}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                <LogOut className="size-4 text-muted-foreground" aria-hidden="true" />
                {loggingOut ? "Logger ut …" : "Logg ut"}
              </button>
            </div>

            <p className="flex items-center gap-1.5 border-t border-border px-3.5 py-2 text-[11px] text-subtle">
              <ShieldCheck className="size-3.5 text-success" aria-hidden="true" /> All aktivitet logges
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function SidebarContent({ onNavigate, footer }: { onNavigate?: () => void; footer?: React.ReactNode }) {
  const perms = useStaffPermissions();
  const sections = visibleSections(perms);
  // Nummereringen følger den flate rekkefølgen ⌘1–⌘9 bruker. Den regnes ut
  // før rendering, ikke underveis: en teller som teller opp mens JSX bygges
  // gir ulike tall avhengig av hvor mange ganger React kjører render.
  const numberOf = new Map(visibleItems(perms).slice(0, 9).map((item, i) => [item.to, i + 1]));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pb-4 pt-[18px]">
        <SkyMark className="h-7 w-7 text-primary" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">HelloSky</p>
          <p className="truncate text-[11px] leading-tight text-subtle">Eierpanel</p>
        </div>
      </div>

      <nav className="flex-1 space-y-3.5 overflow-y-auto px-3 pb-4" aria-label="Adminmeny">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-2.5 pb-1 eyebrow">{section.label}</p>
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
                          // 34 px er tett nok til at alle sidene får plass uten
                          // rulling, og romslig nok til å treffe med musa.
                          "group flex h-[34px] items-center gap-2.5 rounded-[10px] px-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                          isActive ? "bg-primary-soft text-foreground" : "text-secondary-foreground hover:bg-muted hover:text-foreground",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon className={cn("size-[18px] shrink-0", isActive ? "text-primary" : "text-subtle")} aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {/* Tallet står der dempet og dukker opp ved hover. Slik
                              lærer man snarveien av å bruke menyen. */}
                          {shortcut && (
                            <span
                              className={cn(
                                "shrink-0 text-[11px] tabular-nums text-subtle transition-opacity",
                                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
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

      {footer && <div className="border-t border-border">{footer}</div>}
    </div>
  );
}

function MobileDrawer({ open, onClose, footer }: { open: boolean; onClose: () => void; footer?: React.ReactNode }) {
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
      <button type="button" aria-label="Lukk meny" className="palette-scrim absolute inset-0 bg-foreground/40" onClick={onClose} />
      <aside ref={ref} role="dialog" aria-modal="true" aria-label="Adminmeny" className="admin-menu absolute inset-y-0 left-0 w-[min(17rem,86vw)] bg-card">
        <button type="button" aria-label="Lukk meny" onClick={onClose} className="absolute right-2 top-2.5 grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-muted">
          <X className="size-5" aria-hidden="true" />
        </button>
        <SidebarContent onNavigate={onClose} footer={footer} />
      </aside>
    </div>
  );
}

function AdminShell() {
  usePageMeta(PAGE_META.admin, { layout: true });
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
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

  /**
   * Skjermlåsen, sett fra klienten.
   *
   * Serveren låser uansett – dette er bare for at det skal skje med én gang
   * tiden er ute, og ikke først neste gang noen rører maskinen.
   */
  const lock = trpc.staffAuth.lockScreen.useMutation({ onSettled: () => void utils.staffAuth.me.invalidate() });
  const setProfile = trpc.staffAuth.setProfile.useMutation({ onSettled: () => void utils.staffAuth.me.invalidate() });
  const locked = me.data?.authenticated === true && me.data.locked;
  const signedIn = me.data?.authenticated === true;
  useIdleLock(IDLE_LOCK_MS, () => lock.mutate(), signedIn && !locked);

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
  // Låst skjerm tar ned skallet – ellers ville kundedataene du hadde framme
  // ligget synlige bak låsen. Adressen står igjen, så du kommer tilbake til
  // siden du sto på.
  if (me.data.locked) {
    return <LockGate name={me.data.name} onUnlocked={() => void utils.staffAuth.me.invalidate()} />;
  }
  // Eierkontoen deles av to. Siste port før skallet er derfor «hvem av dere
  // er dette?» – ikke for tilgangens skyld, men for revisjonsloggens.
  // Kontoer uten profiler (alle andre roller) ser aldri denne skjermen.
  if (me.data.profiles.length > 0 && !me.data.activeProfile) {
    return <ProfileGate profiles={me.data.profiles} onChosen={() => void utils.staffAuth.me.invalidate()} />;
  }

  const user = me.data;
  // Profilnavnet der det finnes, kontonavnet ellers.
  const activeName = user.profiles.find((p) => p.id === user.activeProfile)?.name ?? user.name;
  const isProduction = user.environment === "production";
  const owner: Owner = { name: user.name, email: user.email, role: user.role, profiles: user.profiles, activeProfile: user.activeProfile };
  const ownerMenu = (variant: "sidemeny" | "topplinje") => (
    <OwnerMenu
      owner={owner}
      activeName={activeName}
      variant={variant}
      onSetProfile={(id) => setProfile.mutate({ profile: id })}
      onShortcuts={() => setShortcutsOpen(true)}
      onLogout={() => logout.mutate()}
      loggingOut={logout.isPending}
    />
  );

  return (
    <div className="min-h-screen bg-background">
      <a href="#admin-main" className="sr-only z-[100] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Hopp til innhold
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-sidebar border-r border-border bg-card lg:block">
        <SidebarContent footer={ownerMenu("sidemeny")} />
      </aside>

      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} footer={ownerMenu("sidemeny")} />

      <div className="lg:pl-sidebar">
        <header className="sticky top-0 z-20 flex h-header items-center gap-2 border-b border-border bg-card px-3 sm:gap-3 sm:px-5">
          <button type="button" aria-label="Åpne meny" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="grid size-9 shrink-0 place-items-center rounded-[10px] text-foreground hover:bg-muted lg:hidden">
            <Menu className="size-5" aria-hidden="true" />
          </button>

          {/* Søket står i midten fordi det er inngangen til alt. Paletten har
              en synlig dør: en snarvei ingen vet om, finnes ikke. */}
          <div className="flex min-w-0 flex-1 justify-center">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="admin-control flex w-full min-w-0 max-w-[480px] items-center gap-2.5 border border-border bg-muted px-3 text-left text-sm text-subtle transition-colors hover:border-border-strong hover:text-muted-foreground"
            >
              <Search className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">Søk i bestillinger, kunder, ruter …</span>
              <kbd className="admin-kbd hidden shrink-0 sm:inline-grid">⌘K</kbd>
            </button>
          </div>

          <span
            className={cn(
              "hidden shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] md:inline-flex",
              isProduction ? "bg-destructive-soft text-destructive" : "bg-warning-soft text-warning",
            )}
          >
            <span className={cn("size-1.5 rounded-full", isProduction ? "bg-destructive" : "bg-warning")} aria-hidden="true" />
            {isProduction ? "Produksjon" : "Staging / test"}
          </span>

          {!user.sessionFresh && (
            <span className="hidden shrink-0 text-[11px] text-subtle xl:inline" title="Sensitive handlinger krever ny innlogging">
              Sesjon &gt; 15 min
            </span>
          )}

          <NavLink
            to="/admin/problemer"
            aria-label="Varsler"
            className="grid size-9 shrink-0 place-items-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Bell className="size-[18px]" aria-hidden="true" />
          </NavLink>

          {/* På telefon finnes ingen sidemeny, så eieren må nås herfra. */}
          <div className="shrink-0 lg:hidden">{ownerMenu("topplinje")}</div>
        </header>

        <main id="admin-main" tabIndex={-1} className="mx-auto min-w-0 max-w-content px-4 py-5 outline-none sm:px-6 sm:py-6 lg:px-7">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} perms={perms} extra={extraCommands} />
      <ShortcutSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}

/**
 * Temaprovideren ligger utenfor skallet med vilje.
 *
 * Låseskjermen og totrinnsporten rendres i stedet for skallet, og de skal
 * være mørke eller lyse på samme måte som resten. Ligger provideren inni,
 * mister de temaet i det øyeblikket de trengs.
 */
export function AdminLayout() {
  return (
    <AdminPrefsProvider>
      <AdminShell />
    </AdminPrefsProvider>
  );
}
