import * as React from "react";

import { cn } from "@/lib/utils";

interface ChipProps extends React.ComponentProps<"button"> {
  selected?: boolean;
  icon?: React.ReactNode;
  count?: number;
}

/**
 * Toggle chip for filters and preferences. Exposes aria-pressed so screen
 * readers announce the state; 40 px tall with generous horizontal padding.
 */
export function Chip({ selected = false, icon, count, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3.5 text-sm font-medium outline-none",
        "transition-[background-color,border-color,color,transform] duration-fast ease-out",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "active:scale-[0.98] motion-reduce:active:scale-100",
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground hover:border-foreground/40",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {typeof count === "number" && (
        <span className={cn("tabular text-xs", selected ? "text-background/70" : "text-muted-foreground")}>{count}</span>
      )}
    </button>
  );
}
