import type { CabinClass } from "@contracts/types";
import { Glyph, type GlyphProps } from "./Glyph";
import { cn } from "@/lib/utils";

/**
 * Seat family. One seat glyph with visual states, plus cabin-class
 * silhouettes that make the differences understandable without renders.
 * Ready for a live seat map (render seats from API data, never from a bitmap).
 */

export type SeatState = "available" | "selected" | "unavailable" | "extra-legroom" | "preferred";

/** Top-down seat: backrest bar + cushion + armrests. */
export function SeatGlyph({ state = "available", className, ...p }: GlyphProps & { state?: SeatState }) {
  const fill = state === "selected" ? "hsl(var(--primary))" : state === "unavailable" ? "hsl(var(--muted))" : "none";
  return (
    <Glyph {...p} className={cn(state === "unavailable" && "text-muted-foreground/60", className)}>
      <rect x="6" y="4" width="12" height="13" rx="3" fill={fill} />
      <path d="M4 10v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      {state === "extra-legroom" && <path d="M9 21h6" strokeDasharray="1.5 2" />}
      {state === "preferred" && <path d="m12 7 .9 1.8 2 .3-1.45 1.4.35 2L12 11.6l-1.8.9.35-2-1.45-1.4 2-.3L12 7Z" fill="currentColor" stroke="none" />}
      {state === "unavailable" && <path d="m9.5 7.5 5 5M14.5 7.5l-5 5" />}
    </Glyph>
  );
}

/** Row miniature: window / aisle position. */
export function SeatPositionGlyph({ position, ...p }: GlyphProps & { position: "window" | "aisle" | "middle" }) {
  const cols = [5, 12, 19];
  const active = position === "window" ? 0 : position === "middle" ? 1 : 2;
  return (
    <Glyph {...p}>
      <path d="M2 4v16" />
      {cols.map((x, i) => (
        <rect key={x} x={x - 2.5} y="8" width="5" height="8" rx="1.5" fill={i === active ? "currentColor" : "none"} opacity={i === active ? 1 : 0.6} />
      ))}
      <path d="M22 4v16" strokeDasharray="2 2" />
    </Glyph>
  );
}

/** Cabin-class silhouette: seat pitch and recline grow with class. */
export function CabinClassGlyph({ cabin, ...p }: GlyphProps & { cabin: CabinClass }) {
  switch (cabin) {
    case "first":
      return (
        <Glyph {...p}>
          <path d="M3 18V8a3 3 0 0 1 3-3h1" />
          <path d="M6 12h9a3 3 0 0 1 3 3v3" />
          <path d="M3 18h16" />
          <path d="M14 12 12 5h6l-1 7" />
        </Glyph>
      );
    case "business":
      return (
        <Glyph {...p}>
          <path d="M4 18V9a2 2 0 0 1 2-2" />
          <path d="M6 13h8a2.5 2.5 0 0 1 2.5 2.5V18" />
          <path d="M4 18h14" />
          <path d="M13 13 11 6h5l-1 7" />
        </Glyph>
      );
    case "premium_economy":
      return (
        <Glyph {...p}>
          <path d="M6 18v-5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v5" />
          <path d="M8 11V6.5A1.5 1.5 0 0 1 9.5 5h4A1.5 1.5 0 0 1 15 6.5V11" />
          <path d="M5 18h14" />
          <path d="M9 11h6" strokeDasharray="1.5 2" />
        </Glyph>
      );
    default:
      return (
        <Glyph {...p}>
          <path d="M7 18v-4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4" />
          <path d="M9 12V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5" />
          <path d="M6 18h12" />
        </Glyph>
      );
  }
}
