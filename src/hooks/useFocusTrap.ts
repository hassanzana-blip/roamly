import { useEffect, type RefObject } from "react";

/**
 * useFocusTrap – liten fokusfelle for dialoger/ark (OTA-187).
 *  - Flytter fokus inn i containeren når `active` blir true (første fokusérbare
 *    element, eller containeren selv).
 *  - Tab/Shift+Tab sirkulerer innenfor containeren.
 *  - Gjenoppretter fokus til elementet som hadde det, når fellen deaktiveres.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("aria-hidden") && el.offsetParent !== null,
  );
}

export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, opts: { initialFocus?: RefObject<HTMLElement | null> } = {}) {
  const initialRef = opts.initialFocus;
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Initialt fokus – vent til animasjon har montert innholdet.
    const raf = requestAnimationFrame(() => {
      const target = initialRef?.current ?? getFocusable(root)[0] ?? root;
      if (target === root && !root.hasAttribute("tabindex")) root.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = getFocusable(root);
      if (items.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (current === first || !root.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !root.contains(current))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey, true);
      if (previouslyFocused && typeof previouslyFocused.focus === "function" && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
    // Ref-objekter er stabile; kun `active` skal trigge fellen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
