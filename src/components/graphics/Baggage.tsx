import type { ReactElement } from "react";
import { Glyph, LIME, type GlyphProps } from "./Glyph";
import { HsBagCabin, HsBagChecked, HsBagHeavy, HsBagMultiple, HsBagPersonal, HsSports, HsStroller, HsWheelchair } from "./pack";
import { cn } from "@/lib/utils";

/**
 * Baggage family. Shapes come from the official HelloSky SVG pack
 * (personal < cabin < checked < heavy, drawn to scale against each other).
 * Counts and weights are rendered from supplier data only.
 */
export const PersonalItemGlyph = HsBagPersonal;
export const CabinBagGlyph = HsBagCabin;
export const CheckedBagGlyph = HsBagChecked;
export const HeavyBagGlyph = HsBagHeavy;
export const MultipleBagsGlyph = HsBagMultiple;
export const StrollerGlyph = HsStroller;
export const SportsEquipmentGlyph = HsSports;
export const WheelchairGlyph = HsWheelchair;

/** Guitar case (no pack shape yet): same 1.8 outline language. */
export function InstrumentGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <path d="M12 3.5c1.7 0 2.6 1 2.6 2.6v3.2c2.4 1 3.9 3.1 3.9 5.7a6.5 6.5 0 0 1-13 0c0-2.6 1.5-4.7 3.9-5.7V6.1c0-1.6.9-2.6 2.6-2.6Z" />
      <path d="M10.5 6.5h3" />
      <path d="M12 12.5v5" stroke={LIME} />
    </Glyph>
  );
}

/** Pet carrier (no pack shape yet). */
export function PetCarrierGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5" />
      <rect x="3.5" y="7.5" width="17" height="12" rx="2.6" />
      <path d="M7.5 11v5M12 11v5M16.5 11v5" opacity=".35" />
      <path d="M9.5 19.5h5" stroke={LIME} />
    </Glyph>
  );
}

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
 *
 * Three states, never two: included, not included, and not stated. A supplier
 * that says nothing about an allowance is not a supplier saying zero, so
 * `unknown` gets its own faded, question-marked treatment rather than the
 * struck-through "not included" one.
 */
export function BaggageVisual({
  kind,
  count,
  label,
  size = 20,
  className,
  unknown = false,
}: {
  kind: BagKind;
  count: number;
  label: string;
  size?: number;
  className?: string;
  unknown?: boolean;
}) {
  const Bag = BAG[kind];
  const shown = Math.min(count, 3);
  if (unknown) {
    return (
      <span className={cn("inline-flex items-center text-muted-foreground/70", className)} role="img" aria-label={label}>
        <Bag size={size} className="opacity-70" />
        <span className="-ml-0.5 text-xs font-bold" aria-hidden="true">?</span>
      </span>
    );
  }
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
