import { motion, useReducedMotion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import Icon from "./Icon";
import { cn } from "@/lib/utils";

/**
 * PillTabs – compact segmented tabs (Fly / Hotell / Leiebil).
 * The active thumb is lime; layoutId animates it.
 */

export type PillTab = {
  id: string;
  label: string;
  icon?: LucideIcon;
};

export default function PillTabs({ tabs, active, onChange, className }: { tabs: PillTab[]; active: string; onChange: (id: string) => void; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div role="tablist" className={cn("inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-soft", className)}>
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-ring sm:px-5",
              isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isActive && (
              <motion.span
                layoutId={reduce ? undefined : "pill-tab-thumb"}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                className="absolute inset-0 rounded-full bg-primary"
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {t.icon ? <Icon icon={t.icon} size={16} /> : null}
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
