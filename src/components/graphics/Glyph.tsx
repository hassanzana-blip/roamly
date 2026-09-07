import { forwardRef, type SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Base for every custom HelloSky vector glyph.
 * 24-unit grid, 1.75 stroke, round caps and joins, currentColor.
 * Matches Lucide's geometry so custom and library icons sit side by side.
 */
export type GlyphProps = Omit<SVGProps<SVGSVGElement>, "ref" | "strokeWidth"> & {
  size?: number;
  /** Accessible name. Omit for purely decorative use (aria-hidden). */
  title?: string;
};

export const Glyph = forwardRef<SVGSVGElement, GlyphProps & { viewBox?: string; strokeWidth?: number }>(function Glyph(
  { size = 20, title, className, children, viewBox = "0 0 24 24", strokeWidth = 1.75, ...rest },
  ref,
) {
  return (
    <svg
      ref={ref}
      viewBox={viewBox}
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : "true"}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
});
