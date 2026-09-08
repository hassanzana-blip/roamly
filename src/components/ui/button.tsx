import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * HelloSky button. 44 px touch height on the default size, visible pressed
 * state, and a loading state that keeps the width stable.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-fast ease-out",
    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "active:scale-[0.985] motion-reduce:active:scale-100",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  ].join(" "),
  {
    variants: {
      variant: {
        /* Hover darkens the lime a step instead of fading it: a washed-out primary reads as disabled. */
        primary: "bg-primary text-primary-foreground hover:bg-[hsl(74_93%_49%)]",
        /** Alias kept for generated shadcn files that still pass variant="default" */
        default: "bg-primary text-primary-foreground hover:bg-[hsl(74_93%_49%)]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-[hsl(var(--secondary)/0.7)]",
        outline: "border border-input bg-card text-foreground hover:border-foreground/40 hover:bg-muted/60",
        ghost: "text-foreground hover:bg-muted",
        subtle: "bg-primary-soft text-accent-foreground hover:bg-accent",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "h-auto rounded-none px-0 text-primary underline-offset-4 hover:underline",
        dark: "bg-night text-white hover:bg-night/90",
      },
      size: {
        sm: "h-9 px-3.5 text-sm [&_svg:not([class*='size-'])]:size-4",
        md: "h-11 px-4 text-sm",
        /** Alias kept for generated shadcn files that still pass size="default" */
        default: "h-11 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        xl: "h-14 px-8 text-[17px] [&_svg:not([class*='size-'])]:size-5",
        icon: "size-11",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Shows a spinner and disables the button while keeping its width */
    loading?: boolean;
  };

function Button({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      data-variant={variant ?? "primary"}
      data-size={size ?? "md"}
      className={cn(buttonVariants({ variant, size, className }), loading && "relative")}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="absolute inset-0 grid place-items-center">
            <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          </span>
          <span className="invisible contents">{children}</span>
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
