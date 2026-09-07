import { forwardRef, type SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Base for every HelloSky vector glyph.
 * Style is the official HelloSky SVG pack (public/icons, docs/reference/hellosky-svg-pack):
 * 24-unit grid, 1.8 outline stroke, round caps and joins, `currentColor` ink,
 * lime `hsl(var(--primary))` on one selective accent only. Works at 16/20/24/32 px.
 */
export type GlyphProps = Omit<SVGProps<SVGSVGElement>, "ref" | "strokeWidth"> & {
  size?: number;
  /** Accessible name. Omit for purely decorative use (aria-hidden). */
  title?: string;
};

export const INK = "currentColor";
export const LIME = "hsl(var(--primary))";
export const MUTED = "hsl(var(--muted-foreground))";

export const Glyph = forwardRef<SVGSVGElement, GlyphProps & { viewBox?: string; strokeWidth?: number }>(function Glyph(
  { size = 20, title, className, children, viewBox = "0 0 24 24", strokeWidth = 1.8, ...rest },
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
