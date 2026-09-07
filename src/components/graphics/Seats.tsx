import type { CabinClass } from "@contracts/types";
import { Glyph, LIME, type GlyphProps } from "./Glyph";
import { HsFamilySeats, HsSeatAisle, HsSeatAvailable, HsSeatExtraLegroom, HsSeatSelected, HsSeatUnavailable, HsSeatWindow } from "./pack";
import { cn } from "@/lib/utils";

/**
 * Seat family from the official pack. One seat silhouette with states,
 * window/aisle positions and family seating. Ready for a live seat map:
 * render seats from API data, never from a bitmap.
 */
export type SeatState = "available" | "selected" | "unavailable" | "extra-legroom" | "preferred";

export function SeatGlyph({ state = "available", className, ...p }: GlyphProps & { state?: SeatState }) {
  switch (state) {
    case "selected":
      return <HsSeatSelected className={className} {...p} />;
    case "unavailable":
      return <HsSeatUnavailable className={cn("text-muted-foreground", className)} {...p} />;
    case "extra-legroom":
      return <HsSeatExtraLegroom className={className} {...p} />;
    case "preferred":
      return (
        <Glyph className={className} {...p}>
          <path d="M8 4v8.5c0 1.4 1.1 2.5 2.5 2.5H17" />
          <path d="M8 9h5c1.1 0 2 .9 2 2v4" />
          <path d="M7 15v4M16 15v4" />
          <path d="M6 19h2M15 19h2" />
          <path d="m18.5 3.5.9 1.9 2.1.3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.4 2.1-.3.9-1.9Z" fill={LIME} stroke="none" />
        </Glyph>
      );
    default:
      return <HsSeatAvailable className={className} {...p} />;
  }
}

/** Window / middle / aisle position. */
export function SeatPositionGlyph({ position, ...p }: GlyphProps & { position: "window" | "aisle" | "middle" }) {
  if (position === "window") return <HsSeatWindow {...p} />;
  if (position === "aisle") return <HsSeatAisle {...p} />;
  return (
    <Glyph {...p}>
      <path d="M7 4v8.5c0 1.4 1.1 2.5 2.5 2.5H16" />
      <path d="M7 9h5c1.1 0 2 .9 2 2v4" />
      <path d="M6 15v4M15 15v4" />
      <path d="M3 6v12M21 6v12" opacity=".35" />
    </Glyph>
  );
}

export const SeatsTogetherGlyph = HsFamilySeats;

/** Bassinet for infants (no pack shape). */
export function BassinetGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <path d="M3.5 11.5h17v1.5a5.5 5.5 0 0 1-5.5 5.5H9a5.5 5.5 0 0 1-5.5-5.5v-1.5Z" />
      <path d="M6.5 11.5V8.5a5.5 5.5 0 0 1 11 0v3" />
      <path d="M9.5 21h5" />
      <path d="M10.5 7.5h3" stroke={LIME} />
    </Glyph>
  );
}

/** Cabin-class silhouette: seat pitch and recline grow with class. */
export function CabinClassGlyph({ cabin, ...p }: GlyphProps & { cabin: CabinClass }) {
  switch (cabin) {
    case "first":
      return (
        <Glyph {...p}>
          <path d="M4 5v9c0 1.7 1.3 3 3 3h9" />
          <path d="M4 10h7c1.7 0 3 1.3 3 3v4" />
          <path d="M5 17v3M14 17v3" />
          <path d="M17 12h4" stroke={LIME} />
          <path d="m19.5 9.5 2.5 2.5-2.5 2.5" stroke={LIME} />
        </Glyph>
      );
    case "business":
      return (
        <Glyph {...p}>
          <path d="M5 5v8.5c0 1.4 1.1 2.5 2.5 2.5H15" />
          <path d="M5 10h6c1.1 0 2 .9 2 2v4" />
          <path d="M6 16v3M14 16v3" />
          <path d="M17.5 12h3.5" stroke={LIME} />
        </Glyph>
      );
    case "premium_economy":
      return (
        <Glyph {...p}>
          <path d="M7 4v8.5c0 1.4 1.1 2.5 2.5 2.5H16" />
          <path d="M7 9h5c1.1 0 2 .9 2 2v4" />
          <path d="M6 15v4M15 15v4" />
          <path d="M17.5 12h2" stroke={LIME} />
        </Glyph>
      );
    default:
      return <HsSeatAvailable {...p} />;
  }
}
