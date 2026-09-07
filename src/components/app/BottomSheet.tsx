import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import Icon from "./Icon";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useT } from "@/lib/i18n";

/**
 * BottomSheet — native-app sheet that slides up from the bottom.
 * Spring physics, drag-to-dismiss, backdrop tap to close, ESC support,
 * body scroll lock, safe-area aware. Respects prefers-reduced-motion.
 * A11y (OTA-187): focus trap, initial focus on the close button, focus
 * restored to the opener on close, labelled by its title.
 */

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Taller sheets (search) vs compact pickers */
  size?: "md" | "lg";
  children: ReactNode;
};

export default function BottomSheet({ open, onClose, title, size = "md", children }: Props) {
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

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
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
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={
              reduce
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 380, damping: 38, mass: 0.9 }
            }
            drag={reduce ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
            className={cn(
              "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-card shadow-lift outline-none sm:max-w-md sm:rounded-[28px]",
              size === "lg" && "h-[88dvh] sm:h-auto sm:max-h-[86dvh]",
            )}
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
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
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-2">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
