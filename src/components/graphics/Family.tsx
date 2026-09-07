import type { ReactElement } from "react";
import type { PassengerType } from "@contracts/types";
import { Glyph, type GlyphProps } from "./Glyph";
import { cn } from "@/lib/utils";

/** Restrained pictograms: adult, child, infant. Heights differ, style does not. */
export function AdultGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <circle cx="12" cy="5" r="2.5" />
      <path d="M8 21v-6.5a4 4 0 0 1 8 0V21" />
      <path d="M8 14.5 6.5 11M16 14.5l1.5-3.5" />
    </Glyph>
  );
}

export function ChildGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <circle cx="12" cy="8.5" r="2.25" />
      <path d="M9 21v-4.5a3 3 0 0 1 6 0V21" />
      <path d="M9 16.5 7.5 14M15 16.5l1.5-2.5" />
    </Glyph>
  );
}

export function InfantGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <circle cx="12" cy="11" r="2.5" />
      <path d="M8.5 21v-3a3.5 3.5 0 0 1 7 0v3" />
      <path d="M10.5 8.5c.5-1 2.5-1 3 0" />
    </Glyph>
  );
}

export function BassinetGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <path d="M3 11h18v2a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6v-2Z" />
      <path d="M6 11V8a6 6 0 0 1 12 0v3" />
      <path d="M9 21h6" />
    </Glyph>
  );
}

const PAX: Record<PassengerType, (p: GlyphProps) => ReactElement> = {
  adult: AdultGlyph,
  child: ChildGlyph,
  infant_without_seat: InfantGlyph,
};

/** The travelling party as a row of pictograms, with one accessible label. */
export function PartyPictogram({ passengers, label, size = 20, className }: { passengers: { type: PassengerType }[]; label: string; size?: number; className?: string }) {
  const order: PassengerType[] = ["adult", "child", "infant_without_seat"];
  const sorted = [...passengers].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type)).slice(0, 6);
  return (
    <span className={cn("inline-flex items-end text-foreground", className)} role="img" aria-label={label}>
      {sorted.map((p, i) => {
        const G = PAX[p.type];
        return <G key={i} size={size} className={i > 0 ? "-ml-1" : undefined} />;
      })}
      {passengers.length > 6 && <span className="ml-1 text-xs font-semibold tabular">+{passengers.length - 6}</span>}
    </span>
  );
}
