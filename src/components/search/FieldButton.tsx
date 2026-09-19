import * as React from "react";
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
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
  /**
   * `stacked` (default): small label over a large value, as in the origin
   * and destination fields. `row`: one line with the value and a chevron on
   * the right (the date row). `dropdown`: value + caret, no label shown
   * (trip type, travellers).
   */
  variant?: "stacked" | "row" | "dropdown";
}

/**
 * The trigger shared by airport, date and passenger pickers. Petrol icon,
 * 12 px label, 17 px value; 12 px radius; ≥ 48 px tall.
 */
const FieldButton = React.forwardRef<HTMLButtonElement, Props>(function FieldButton(
  { icon: Icon, label, value, placeholder, invalid, trailing, joined, variant = "stacked", className, ...props },
  ref,
) {
  const filled = value !== undefined && value !== null && value !== "";
  const stacked = variant === "stacked";
  return (
    <button
      ref={ref}
      type="button"
      data-filled={filled}
      aria-invalid={invalid || undefined}
      className={cn(
        "group flex w-full items-center gap-3 text-left outline-none",
        stacked ? "h-[var(--field-h,4.5rem)] px-4" : "h-[var(--field-h,3.5rem)] px-4",
        "transition-[border-color,box-shadow,background-color] duration-fast ease-out",
        joined
          ? "border-0 bg-transparent hover:bg-mint/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[state=open]:bg-mint/40"
          : "rounded-xl border border-border bg-white hover:border-petrol/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-ring",
        invalid && (joined ? "bg-destructive/5" : "border-destructive"),
        className,
      )}
      {...props}
      // The visible label + value is the accessible name; a separate aria-label
      // ("Til: Istanbul (IST)") never matched the visible text for voice control.
      aria-label={variant === "dropdown" ? label : undefined}
    >
      {variant !== "dropdown" && <Icon className="size-6 shrink-0 text-petrol" aria-hidden="true" />}
      <span className="min-w-0 flex-1">
        {stacked && <span className="block text-[12px] font-medium leading-none text-muted-foreground">{label}</span>}
        <span className={cn("block truncate leading-tight", stacked ? "mt-1 text-[18px]" : "text-[17px]", filled ? "font-semibold text-petrol" : "font-medium text-petrol/70")}>
          {filled ? value : placeholder}
        </span>
      </span>
      {trailing}
      {variant === "row" && <ChevronRight className="size-5 shrink-0 text-petrol" aria-hidden="true" />}
      {variant === "dropdown" && <ChevronDown className="size-5 shrink-0 text-petrol transition-transform duration-fast group-data-[state=open]:rotate-180" aria-hidden="true" />}
    </button>
  );
});

export default FieldButton;
