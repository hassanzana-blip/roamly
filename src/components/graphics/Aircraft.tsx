import { Glyph, LIME, type GlyphProps } from "./Glyph";
import { HsAirportChange, HsFlightConnection, HsFlightDirect, HsNightFlight, HsPlaneArrival, HsPlaneDeparture, HsRoute, HsStatusChanged } from "./pack";

/** Flight and route glyphs. Pack shapes first; custom outlines only where the pack has none. */
export const TakeoffGlyph = HsPlaneDeparture;
export const LandingGlyph = HsPlaneArrival;
export const DirectRouteGlyph = HsFlightDirect;
export const ConnectingRouteGlyph = HsFlightConnection;
export const OvernightGlyph = HsNightFlight;
export const RoutePinsGlyph = HsRoute;
export const AirportChangeGlyph = HsAirportChange;
/** Change of aircraft / self-transfer: the pack's swap arrows. */
export const AircraftChangeGlyph = HsStatusChanged;

/** Side-view aircraft, nose right (no pack shape). */
export function AircraftSideGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <path d="m3.5 14 6.3 1.6 7.4-5.1c.9-.6 2.1-.3 2.6.6.4.8.2 1.7-.5 2.2l-7.3 5.1-7.3-1.4L3.5 14Z" transform="rotate(-18 12 12)" />
      <path d="m9.8 15.6-2.1-4.2" transform="rotate(-18 12 12)" />
    </Glyph>
  );
}

/** Transfer road between airports. */
export function TransferRoadGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <path d="M9 4 4.5 20h15L15 4H9Z" />
      <path d="M12 7v2.5M12 12.5v2.5M12 18v1.5" stroke={LIME} />
    </Glyph>
  );
}

/** Airport: control tower. */
export function AirportGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <path d="M10 20.5V11h4v9.5" />
      <path d="M7 8.5h10l-1.5 2.5h-7L7 8.5Z" />
      <path d="M12 8.5V4.5M11 4.5h2" />
      <path d="M3.5 20.5h17" />
      <path d="M5.5 16.5h1.5M17 16.5h1.5" stroke={LIME} />
    </Glyph>
  );
}

/** Terminal building. */
export function TerminalGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <path d="M3 20V9.5l9-4.5 9 4.5V20" />
      <path d="M3 20h18" />
      <path d="M6.5 12.5h11M6.5 15.5h11" opacity=".35" />
      <path d="M10.5 20v-3.5h3V20" stroke={LIME} />
    </Glyph>
  );
}

/** Whole world: globe with lime equator. */
export function GlobeGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5c2.8 2.8 2.8 14.2 0 17M12 3.5c-2.8 2.8-2.8 14.2 0 17" />
      <path d="M4 12h16" stroke={LIME} />
    </Glyph>
  );
}
