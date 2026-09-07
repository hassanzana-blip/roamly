import type { ReactElement } from "react";
import type { PassengerType } from "@contracts/types";
import { Glyph, LIME, type GlyphProps } from "./Glyph";
import { HsAdult, HsChild, HsFamily, HsInfant, HsWheelchair } from "./pack";
import { cn } from "@/lib/utils";

/** Passenger pictograms from the official pack. Heights differ, style does not. */
export const AdultGlyph = HsAdult;
export const ChildGlyph = HsChild;
export const InfantGlyph = HsInfant;
export const FamilyGlyph = HsFamily;
export const AssistanceGlyph = HsWheelchair;

/** Senior: adult with a cane (no pack shape). */
export function SeniorGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <circle cx="11" cy="5" r="2.4" />
      <path d="M7.5 20v-7.5c0-2 1.6-3.5 3.5-3.5s3.5 1.5 3.5 3.5V20" />
      <path d="M7.5 13 5.5 17" />
      <path d="M18 11v9" stroke={LIME} />
    </Glyph>
  );
}

/** Group: three travellers. */
export function GroupGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <circle cx="6" cy="7.5" r="1.8" />
      <circle cx="18" cy="7.5" r="1.8" />
      <circle cx="12" cy="5.5" r="2.2" />
      <path d="M3 20v-5.5c0-1.6 1.3-3 3-3s3 1.4 3 3V20" />
      <path d="M15 20v-5.5c0-1.6 1.3-3 3-3s3 1.4 3 3V20" />
      <path d="M9 20v-7c0-1.8 1.3-3.2 3-3.2s3 1.4 3 3.2v7" stroke={LIME} />
    </Glyph>
  );
}

/** Unaccompanied minor: child with a lime tag. */
export function UnaccompaniedMinorGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <circle cx="12" cy="6" r="2" />
      <path d="M9.5 19v-6c0-1.6 1.1-2.8 2.5-2.8s2.5 1.2 2.5 2.8v6" />
      <path d="M9.5 13 8 15.5M14.5 13l1.5 2.5" />
      <rect x="10.5" y="13.5" width="3" height="3.5" rx=".7" stroke={LIME} />
    </Glyph>
  );
}

/** Pet (dog). */
export function PetGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <path d="M4.5 14c0-3 2-5 5-5h5.5l3-3h2l-1 4v4.5l-1 5.5h-2l-.5-4H9.5l-1 4h-2l-1-4c-.7-.8-1-2-1-3Z" />
      <path d="M17 9h1.5" stroke={LIME} />
    </Glyph>
  );
}

/** Add traveller: circle with plus. */
export function AddTravellerGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8.5v7M8.5 12h7" stroke={LIME} strokeWidth="2.1" />
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
