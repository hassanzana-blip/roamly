import type { ReactElement } from "react";
import { Accessibility } from "lucide-react";
import { Glyph, type GlyphProps } from "./Glyph";
import { cn } from "@/lib/utils";

/**
 * Baggage family. Sizes are drawn to scale against each other so the
 * personal item, cabin bag and checked bag read as three distinct objects.
 * Counts and weights come from supplier data only.
 */

/** Small under-seat bag (personal item). */
export function PersonalItemGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <path d="M8 9V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <rect x="5" y="9" width="14" height="10" rx="2.5" />
      <path d="M5 13h14" />
    </Glyph>
  );
}

/** Overhead cabin bag: upright trolley with a short handle. */
export function CabinBagGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <path d="M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6" />
      <rect x="6" y="6" width="12" height="13" rx="2.5" />
      <path d="M9 19v2M15 19v2M10 10v5M14 10v5" />
    </Glyph>
  );
}

/** Checked suitcase: wider body, pull handle up, wheels. */
export function CheckedBagGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <path d="M9 5V3h6v2" />
      <rect x="4.5" y="5" width="15" height="14" rx="2.5" />
      <path d="M8 19v2M16 19v2M4.5 10h15M4.5 14h15" />
    </Glyph>
  );
}

/** Large heavy suitcase (30 kg+): tallest body, double straps. */
export function HeavyBagGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <path d="M9 4V2.5h6V4" />
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <path d="M7 20v2M17 20v2M3.5 9.5h17M3.5 14.5h17M9 4v16M15 4v16" />
    </Glyph>
  );
}

export function StrollerGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <path d="M4 4h2l1.5 8" />
      <path d="M7.5 12h10l2-6H8.5" />
      <path d="M7.5 12 6.5 16.5" />
      <circle cx="8" cy="19" r="2" />
      <circle cx="17" cy="19" r="2" />
      <path d="M10 17h5" />
    </Glyph>
  );
}

export function SportsEquipmentGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <path d="M4 20 20 4" />
      <path d="M13 4h7v7" />
      <path d="M4 14v6h6" />
      <path d="M7.5 16.5 16.5 7.5" />
    </Glyph>
  );
}

export function InstrumentGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <path d="M14.5 3.5 20.5 9.5" />
      <path d="M14.5 3.5c-1 1-2 2.5-1.5 4l-1 1c-2.5-.5-5 .5-6.5 2.5A5 5 0 0 0 12.5 18c2-1.5 3-4 2.5-6.5l1-1c1.5.5 3-.5 4-1.5" />
      <path d="M8 16l-4 4" />
    </Glyph>
  );
}

export const WheelchairGlyph = Accessibility;

export type BagKind = "personal" | "cabin" | "checked" | "heavy";

const BAG: Record<BagKind, (p: GlyphProps) => ReactElement> = {
  personal: PersonalItemGlyph,
  cabin: CabinBagGlyph,
  checked: CheckedBagGlyph,
  heavy: HeavyBagGlyph,
};

/**
 * Visual allowance: repeats the bag glyph `count` times (capped at 3, then "×n"),
 * or draws it struck through when nothing is included. The accessible name is
 * the full sentence passed in `label`; the glyphs are decorative.
 */
export function BaggageVisual({
  kind,
  count,
  label,
  size = 20,
  className,
}: {
  kind: BagKind;
  count: number;
  label: string;
  size?: number;
  className?: string;
}) {
  const Bag = BAG[kind];
  const shown = Math.min(count, 3);
  return (
    <span className={cn("inline-flex items-center gap-0.5", count === 0 ? "text-muted-foreground/70" : "text-foreground", className)} role="img" aria-label={label}>
      {count === 0 ? (
        <span className="relative inline-flex">
          <Bag size={size} />
          <span className="absolute left-1/2 top-1/2 h-px w-[130%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-current" aria-hidden="true" />
        </span>
      ) : (
        Array.from({ length: shown }, (_, i) => <Bag key={i} size={size} className={i > 0 ? "-ml-1.5" : undefined} />)
      )}
      {count > 3 && <span className="ml-1 text-xs font-semibold tabular">×{count}</span>}
    </span>
  );
}
