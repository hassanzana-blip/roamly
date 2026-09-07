import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";

import { cn } from "@/lib/utils";

interface Option<T extends string> {
  value: T;
  label: React.ReactNode;
}

interface Props<T extends string> {
  value: T;
  onValueChange: (v: T) => void;
  options: Option<T>[];
  "aria-label": string;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Segmented control: one of N, always has a value. Built on Radix
 * ToggleGroup for roving focus and keyboard support.
 */
export function Segmented<T extends string>({ value, onValueChange, options, className, size = "md", ...a11y }: Props<T>) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as T)}
      aria-label={a11y["aria-label"]}
      className={cn("inline-flex w-full items-stretch gap-1 rounded-lg bg-muted p-1 sm:w-auto", className)}
    >
      {options.map((o) => (
        <ToggleGroupPrimitive.Item
          key={o.value}
          value={o.value}
          className={cn(
            "flex-1 whitespace-nowrap rounded-md px-3 font-medium text-muted-foreground outline-none",
            "transition-[background-color,color,box-shadow] duration-fast ease-out",
            "hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            "data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm",
            size === "md" ? "h-9 text-sm" : "h-8 text-xs",
          )}
        >
          {o.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}
