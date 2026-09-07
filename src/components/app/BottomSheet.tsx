import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";
import { X } from "lucide-react";
import Icon from "./Icon";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useT } from "@/lib/i18n";

/**
 * BottomSheet – native-app sheet that slides up from the bottom.
 * Spring physics, drag-to-dismiss, backdrop tap to close, ESC support,
 * body scroll lock, safe-area aware. Respects prefers-reduced-motion.
 * A11y (OTA-187): focus trap, initial focus on the close button, focus
 * restored to the opener on close, labelled by its title.
 *
 * `snapPoints` (fractions of the viewport, e.g. [0.55, 0.92]) turns it into
 * a magnetic sheet: it opens at the first point, a drag settles on the
 * nearest point, a fast flick jumps a point in that direction, and a flick
 * down (or dragging below 10 %) dismisses. Without snap points the sheet
 * sizes to its content, as before.
 */

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Taller sheets (search) vs compact pickers */
  size?: "md" | "lg";
  /** Magnetiske stopp – brøkdel av visningshøyden, stigende. */
  snapPoints?: number[];
  children: ReactNode;
};

const SPRING = { type: "spring", stiffness: 380, damping: 38, mass: 0.9 } as const;

export default function BottomSheet({ open, onClose, title, size = "md", snapPoints, children }: Props) {
  const reduce = useReducedMotion();
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useFocusTrap(panelRef, open, { initialFocus: closeRef });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const magnetic = Boolean(snapPoints && snapPoints.length);
  const [viewportH, setViewportH] = useState(0);
  useEffect(() => {
    if (!magnetic) return;
    const update = () => setViewportH(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [magnetic]);

  // Magnetisk modus: arket er alltid full høyde og flyttes med `y`; stoppene
  // er hvor mye av det som er synlig. Backdrop følger med.
  const points = (snapPoints ?? []).filter((p) => p > 0 && p <= 1).sort((a, b) => a - b);
  const maxPoint = points[points.length - 1] ?? 1;
  const sheetH = viewportH * maxPoint;
  const y = useMotionValue(0);
  const backdropOpacity = useTransform(y, [sheetH || 1, 0], [0, 1]);

  useEffect(() => {
    if (!magnetic || !sheetH) return;
    const initial = sheetH - viewportH * points[0];
    if (open) {
      y.set(reduce ? initial : sheetH);
      animate(y, initial, reduce ? { duration: 0.15 } : SPRING);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, magnetic, sheetH]);

  const onMagneticDragEnd = (_: unknown, info: PanInfo) => {
    const visible = (sheetH - y.get()) / viewportH; // 0–maxPoint
    const v = info.velocity.y;
    if (v > 600 || visible < 0.1) {
      onClose();
      return;
    }
    let target = points.reduce((best, p) => (Math.abs(visible - p) < Math.abs(visible - best) ? p : best), points[0]);
    if (v < -500) target = points.find((p) => p > visible) ?? target;
    else if (v > 500) target = [...points].reverse().find((p) => p < visible) ?? target;
    animate(y, sheetH - viewportH * target, SPRING);
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={magnetic ? { opacity: backdropOpacity } : undefined}
            className="absolute inset-0 bg-night/40 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={title ? undefined : t("misc.close")}
            initial={magnetic ? false : reduce ? { opacity: 0 } : { y: "100%" }}
            animate={magnetic ? undefined : reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={reduce ? { duration: 0.15 } : SPRING}
            style={magnetic ? { y, height: sheetH || undefined, paddingBottom: "env(safe-area-inset-bottom)", touchAction: "none" } : { paddingBottom: "env(safe-area-inset-bottom)" }}
            drag={reduce ? false : "y"}
            dragConstraints={magnetic ? { top: 0, bottom: sheetH } : { top: 0, bottom: 0 }}
            dragElastic={magnetic ? 0.04 : { top: 0, bottom: 0.6 }}
            dragMomentum={false}
            onDragEnd={magnetic ? onMagneticDragEnd : (_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
            className={cn(
              "relative flex w-full flex-col overflow-hidden rounded-t-[28px] bg-card shadow-lift outline-none sm:max-w-md sm:rounded-[28px]",
              magnetic ? "sm:h-auto sm:max-h-[86dvh]" : "max-h-[92dvh]",
              !magnetic && size === "lg" && "h-[88dvh] sm:h-auto sm:max-h-[86dvh]",
            )}
          >
            <div className="flex items-center justify-between px-5 pb-1 pt-3">
              <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-border sm:hidden" aria-hidden="true" />
              {title ? <h2 id={titleId} className="font-display text-xl">{title}</h2> : <span />}
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label={t("misc.close")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-border focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Icon icon={X} size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-2" style={magnetic ? { touchAction: "pan-y" } : undefined}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
