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
  /** Part of a joined field group: no own border/radius, ring drawn inset */
  joined?: boolean;
}

/**
 * The trigger shared by airport, date and passenger pickers: a tall field
 * with a small label («Fra») and a large value («Oslo»), so the search card
 * reads as one calm surface instead of a row of unrelated controls.
 * Joined fields are transparent and let the white block behind them show.
 */
const FieldButton = React.forwardRef<HTMLButtonElement, Props>(function FieldButton(
  { icon: Icon, label, value, placeholder, invalid, trailing, joined, className, ...props },
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
        "group flex h-[var(--field-h,3.75rem)] w-full items-center gap-3 px-4 text-left outline-none sm:px-5",
        "transition-[border-color,box-shadow,background-color] duration-fast ease-out",
        joined
          ? "border-0 bg-transparent hover:bg-blush/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[state=open]:bg-blush/40"
          : "rounded-2xl border bg-white hover:border-foreground/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-ring",
        invalid ? (joined ? "bg-destructive/5" : "border-destructive") : joined ? "" : "border-input",
        className,
      )}
      {...props}
      // The visible label + value is the accessible name; a separate aria-label
      // ("Til: Istanbul (IST)") never matched the visible text for voice control.
      aria-label={undefined}
    >
      <Icon className="size-5 shrink-0 text-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-medium text-muted-foreground">{label}</span>
        <span className={cn("block truncate text-[17px] leading-tight", filled ? "font-medium text-foreground" : "font-normal text-foreground/80")}>
          {filled ? value : placeholder}
        </span>
      </span>
      {trailing}
    </button>
  );
});

export default FieldButton;
