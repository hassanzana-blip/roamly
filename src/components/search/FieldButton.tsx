import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props extends Omit<React.ComponentProps<"button">, "value"> {
  icon: LucideIcon;
  label: string;
  value?: React.ReactNode;
  placeholder: string;
  invalid?: boolean;
  trailing?: React.ReactNode;
}

/**
 * The trigger shared by airport, date and passenger pickers: a 56 px field
 * with a small label and a large value, so the search form reads as one
 * calm surface instead of a row of unrelated controls.
 */
const FieldButton = React.forwardRef<HTMLButtonElement, Props>(function FieldButton(
  { icon: Icon, label, value, placeholder, invalid, trailing, className, ...props },
  ref,
) {
  const filled = value !== undefined && value !== null && value !== "";
  return (
    <button
      ref={ref}
      type="button"
      data-filled={filled}
      aria-invalid={invalid || undefined}
      className={cn(
        "group flex h-14 w-full items-center gap-3 rounded-lg border bg-card px-3.5 text-left outline-none",
        "transition-[border-color,box-shadow] duration-fast ease-out",
        "hover:border-foreground/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25",
        "data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-primary/25",
        invalid ? "border-destructive" : "border-input",
        className,
      )}
      {...props}
    >
      <Icon className={cn("size-5 shrink-0 transition-colors", filled ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
        <span className={cn("block truncate text-base leading-tight", filled ? "font-semibold text-foreground" : "text-muted-foreground/80")}>
          {filled ? value : placeholder}
        </span>
      </span>
      {trailing}
    </button>
  );
});

export default FieldButton;
