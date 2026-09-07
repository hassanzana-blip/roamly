import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import Icon from "./Icon";
import { cn } from "@/lib/utils";

/**
 * PillTabs — compact segmented pills (Fly / Hotell / Leiebil).
 * Active pill carries the lime accent; layoutId animates the thumb.
 */

export type PillTab = {
  id: string;
  label: string;
  icon?: LucideIcon;
};

export default function PillTabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: PillTab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-white p-1 shadow-soft",
        className,
      )}
    >
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-ring sm:px-5",
              isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isActive && (
              <motion.span
                layoutId="pill-tab-thumb"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
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
