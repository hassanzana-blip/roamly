import { Glyph, type GlyphProps } from "./Glyph";

/** Side-view aircraft, nose right. Used in routes and status. */
export function AircraftSideGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <path d="M2.5 13.5h11l5-4.5h3l-1.5 4.5 1.5 1H5l-2.5-1Z" />
      <path d="M9 13.5 7.5 9.5h2l3.5 4" />
      <path d="M7 14.5 6 17h2.5l2-2.5" />
    </Glyph>
  );
}

/** Two aircraft stacked with a swap arrow: change of aircraft / self-transfer. */
export function AircraftChangeGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <path d="M3 8h7l3-3h2l-1 3 1 1H4L3 8Z" />
      <path d="M21 16h-7l-3 3H9l1-3-1-1h11l1 1Z" />
      <path d="M18 3v4l-2-2M6 21v-4l2 2" />
    </Glyph>
  );
}

/** Overnight: crescent moon over a short route line. */
export function OvernightGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <path d="M15.5 3.5a6 6 0 1 0 5 8.5 5 5 0 0 1-5-8.5Z" />
      <path d="M3 19h18" />
      <circle cx="5" cy="19" r="1" fill="currentColor" />
      <circle cx="19" cy="19" r="1" fill="currentColor" />
    </Glyph>
  );
}

/** Direct route: two points, one line. */
export function DirectRouteGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <circle cx="4" cy="12" r="1.75" />
      <circle cx="20" cy="12" r="1.75" fill="currentColor" />
      <path d="M5.75 12h12.5" />
    </Glyph>
  );
}

/** Connecting route: a stop in the middle. */
export function ConnectingRouteGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <circle cx="4" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="20" cy="12" r="1.75" fill="currentColor" />
      <path d="M5.75 12h4.5M13.75 12h4.5" />
    </Glyph>
  );
}
