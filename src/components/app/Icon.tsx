import { forwardRef, type ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Unified icon wrapper — the ONLY way icons render in the app shell.
 * Lucide icons, currentColor, consistent stroke, rounded caps/joins
 * (lucide default), sizes locked to the 14/16/20/24/28 scale.
 */

type IconSize = 14 | 16 | 20 | 24 | 28;

type Props = {
  icon: LucideIcon;
  size?: IconSize;
  strokeWidth?: number;
  className?: string;
} & Omit<ComponentProps<"svg">, "ref">;

const Icon = forwardRef<SVGSVGElement, Props>(function Icon(
  { icon: Cmp, size = 20, strokeWidth = 2, className, ...rest },
  ref,
) {
  return (
    <Cmp
      ref={ref}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    />
  );
});

export default Icon;
