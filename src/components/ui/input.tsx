import * as React from "react";

import { cn } from "@/lib/utils";

/** Text input: 48 px tall, calm border, one focus treatment (ink border + soft lime ring). */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-12 w-full min-w-0 rounded-lg border border-input bg-card px-4 text-base text-foreground outline-none",
        "transition-[border-color,box-shadow] duration-fast ease-out",
        "placeholder:text-muted-foreground/70 file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "hover:border-foreground/40 focus-visible:border-foreground focus-visible:ring-[3px] focus-visible:ring-primary/35",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
