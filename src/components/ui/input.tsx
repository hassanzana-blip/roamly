import * as React from "react";

import { cn } from "@/lib/utils";

/** Text input: 44 px tall, calm border, clear focus and invalid states. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3.5 text-base text-foreground shadow-xs outline-none",
        "transition-[border-color,box-shadow] duration-fast ease-out",
        "placeholder:text-muted-foreground/70 file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "hover:border-foreground/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
