import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { CornerDownLeft, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { rankByQuery } from "@/lib/fuzzy";
import { visibleItems, type NavItem } from "@/pages/admin/nav";

/**
 * Kommandopaletten (⌘K).
 *
 * En admin med tjueto sider er en admin man klikker seg gjennom. Palettene i
 * verktøyene folk faktisk liker – Xcode, Linear, Raycast – har til felles at
 * de fjerner navigasjonen som eget arbeid: du tenker «refusjoner», skriver tre
 * bokstaver og er der. Dette er den samme kontrakten, med tastaturet som
 * hovedvei og musen som mulighet.
 */

export type Command = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  keywords?: string;
  icon?: NavItem["icon"];
  run: () => void;
};

/**
 * Selve panelet monteres først når paletten åpnes, og forsvinner når den
 * lukkes. Da starter søkefeltet tomt og markeringen på øverste treff uten at
 * noen effekt må nullstille tilstand – tilstanden finnes rett og slett ikke
 * mellom to åpninger.
 */
function Panel({ onClose, perms, extra }: { onClose: () => void; perms: Set<string>; extra: Command[] }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const commands = useMemo<Command[]>(() => {
    const nav = visibleItems(perms).map<Command>((item) => ({
      id: `nav:${item.to}`,
      label: item.label,
      group: "Gå til",
      keywords: item.keywords,
      icon: item.icon,
      run: () => navigate(item.to),
    }));
    return [...nav, ...extra];
  }, [perms, extra, navigate]);

  const results = useMemo(() => rankByQuery(commands, query), [commands, query]);

  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  // Hold den valgte raden synlig når man går med tastaturet. Leser DOM, setter
  // ingen tilstand – nettopp det en effekt er til for.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (cmd: Command | undefined) => {
    if (!cmd) return;
    onClose();
    cmd.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || (e.key === "n" && e.ctrlKey)) {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp" || (e.key === "p" && e.ctrlKey)) {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Kommandopalett">
      {/* Bakgrunnen dempes, slik at paletten er det eneste i fokus – uten at
          man mister hvor man var. */}
      <button type="button" aria-label="Lukk" className="palette-scrim absolute inset-0 bg-night/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-x-0 top-[12vh] mx-auto w-[min(40rem,92vw)]">
        <div className="palette-panel overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center gap-3 border-b border-border/70 px-4">
            <Search className="size-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Søk etter side eller handling …"
              aria-label="Søk etter side eller handling"
              aria-controls="palette-results"
              autoComplete="off"
              spellCheck={false}
              className="h-14 w-full bg-transparent text-[16px] outline-none placeholder:text-muted-foreground/70"
            />
            <kbd className="admin-kbd hidden shrink-0 sm:inline-grid">esc</kbd>
          </div>

          <div id="palette-results" ref={listRef} role="listbox" aria-label="Treff" className="max-h-[52vh] overflow-y-auto p-2">
            {results.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">Ingen treff på «{query}».</p>
            ) : (
              results.map((cmd, i) => {
                const header = cmd.group !== lastGroup ? cmd.group : null;
                lastGroup = cmd.group;
                const isActive = i === active;
                return (
                  <div key={cmd.id}>
                    {header && <p className="px-3 pb-1 pt-3 eyebrow first:pt-1">{header}</p>}
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      data-active={isActive}
                      onMouseMove={() => setActive(i)}
                      onClick={() => choose(cmd)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                        isActive ? "bg-night text-white" : "text-foreground hover:bg-muted",
                      )}
                    >
                      {cmd.icon && <cmd.icon className={cn("size-4 shrink-0", isActive ? "text-white/80" : "text-muted-foreground")} aria-hidden="true" />}
                      <span className="min-w-0 flex-1 truncate font-medium">{cmd.label}</span>
                      {cmd.hint && <span className={cn("shrink-0 text-xs", isActive ? "text-white/60" : "text-muted-foreground")}>{cmd.hint}</span>}
                      {isActive && <CornerDownLeft className="size-3.5 shrink-0 text-white/70" aria-hidden="true" />}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-4 border-t border-border/70 px-4 py-2.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <kbd className="admin-kbd">↑</kbd>
              <kbd className="admin-kbd">↓</kbd> velg
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="admin-kbd">⏎</kbd> åpne
            </span>
            <span className="ml-auto tabular-nums">{results.length} treff</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CommandPalette({
  open,
  onClose,
  perms,
  extra = [],
}: {
  open: boolean;
  onClose: () => void;
  perms: Set<string>;
  /** Handlinger som ikke er navigasjon – logg ut, hurtigtaster, åpne nettstedet. */
  extra?: Command[];
}) {
  if (!open) return null;
  return <Panel onClose={onClose} perms={perms} extra={extra} />;
}
