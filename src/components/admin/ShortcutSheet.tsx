import { useEffect, useRef } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

/**
 * Hurtigtastene, samlet ett sted.
 *
 * Et tastaturdrevet verktøy må kunne fortelle hva tastaturet gjør, ellers er
 * det bare raskt for den som bygde det. Åpnes med ? og lukkes med Escape.
 */

const GROUPS: { label: string; rows: { keys: string[]; what: string }[] }[] = [
  {
    label: "Overalt",
    rows: [
      { keys: ["⌘", "K"], what: "Åpne kommandopaletten" },
      { keys: ["?"], what: "Vis denne oversikten" },
      { keys: ["Esc"], what: "Lukk det som er åpent" },
    ],
  },
  {
    label: "Navigasjon",
    rows: [
      { keys: ["⌘", "1"], what: "Første side i menyen" },
      { keys: ["⌘", "2 – 9"], what: "Videre nedover menyen" },
      { keys: ["G", "så", "O"], what: "Gå til oversikten" },
    ],
  },
  {
    label: "I paletten",
    rows: [
      { keys: ["↑", "↓"], what: "Bla i treffene" },
      { keys: ["⏎"], what: "Åpne det valgte" },
      { keys: ["⌃", "N / P"], what: "Bla, for de som lever i terminalen" },
    ],
  },
];

export function ShortcutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Hurtigtaster">
      <button type="button" aria-label="Lukk" className="palette-scrim absolute inset-0 bg-night/40 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={ref} className="palette-panel relative w-[min(34rem,94vw)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="border-b border-border px-6 py-4">
          <h2 className="t-h3">Hurtigtaster</h2>
          <p className="mt-1 text-sm text-muted-foreground">Alt her går raskere uten mus.</p>
        </div>
        <div className="grid gap-6 p-6 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <p className="pb-2 eyebrow">{g.label}</p>
              <ul className="space-y-2">
                {g.rows.map((r) => (
                  <li key={r.what} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 text-muted-foreground">{r.what}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {r.keys.map((k, i) =>
                        k === "så" ? (
                          <span key={i} className="px-0.5 text-[11px] text-muted-foreground">
                            så
                          </span>
                        ) : (
                          <kbd key={i} className="admin-kbd">
                            {k}
                          </kbd>
                        ),
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border px-6 py-3 text-[12px] text-muted-foreground">
          På Windows og Linux er <kbd className="admin-kbd">Ctrl</kbd> det samme som <kbd className="admin-kbd">⌘</kbd>.
        </div>
      </div>
    </div>
  );
}
