import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors } from "../lib/theme";

/**
 * Strekikoner i Lucide-stil (24×24, strek 2, runde ender). Tegnet som SVG, så
 * de er skarpe i alle størrelser og krever ingen ikonfont. Ikonene er alltid
 * dekor: meningen står i teksten eller tilgjengelighetsetiketten ved siden av.
 */
export type IconName =
  | "plane"
  | "swap"
  | "calendar"
  | "users"
  | "chevronRight"
  | "chevronDown"
  | "chevronUp"
  | "search"
  | "clock"
  | "bag"
  | "info"
  | "alert"
  | "user"
  | "logout"
  | "close"
  | "external"
  | "mapPin"
  | "mail"
  | "lock"
  | "check"
  | "refresh"
  | "seat"
  | "arrowLeft"
  | "filter"
  | "takeoff"
  | "landing"
  | "sunrise"
  | "sun"
  | "sunset"
  | "moon"
  | "plus"
  | "minus"
  | "chevronLeft"
  | "arrowRight"
  | "swapHorizontal"
  | "repeat"
  | "oneWay"
  | "home"
  | "compass"
  | "share"
  | "luggage"
  | "help"
  | "route";

const PATHS: Record<IconName, (string | { circle: [number, number, number] } | { rect: [number, number, number, number, number] })[]> = {
  plane: ["M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L11 8 2.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"],
  swap: ["m21 16-4 4-4-4", "M17 20V4", "m3 8 4-4 4 4", "M7 4v16"],
  calendar: [{ rect: [3, 4, 18, 18, 2] }, "M16 2v4", "M8 2v4", "M3 10h18"],
  users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", { circle: [9, 7, 4] }, "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  chevronRight: ["m9 18 6-6-6-6"],
  chevronDown: ["m6 9 6 6 6-6"],
  chevronUp: ["m18 15-6-6-6 6"],
  search: [{ circle: [11, 11, 8] }, "m21 21-4.3-4.3"],
  clock: [{ circle: [12, 12, 10] }, "M12 6v6l4 2"],
  bag: ["M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16", { rect: [2, 6, 20, 14, 2] }],
  info: [{ circle: [12, 12, 10] }, "M12 16v-4", "M12 8h.01"],
  alert: ["m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3", "M12 9v4", "M12 17h.01"],
  user: ["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", { circle: [12, 7, 4] }],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"],
  close: ["M18 6 6 18", "m6 6 12 12"],
  external: ["M15 3h6v6", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"],
  mapPin: ["M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0", { circle: [12, 10, 3] }],
  mail: [{ rect: [2, 4, 20, 16, 2] }, "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"],
  lock: [{ rect: [3, 11, 18, 11, 2] }, "M7 11V7a5 5 0 0 1 10 0v4"],
  check: ["M20 6 9 17l-5-5"],
  refresh: ["M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", "M21 3v5h-5", "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", "M8 16H3v5"],
  arrowLeft: ["m12 19-7-7 7-7", "M19 12H5"],
  filter: ["M3 6h18", "M7 12h10", "M10 18h4"],
  takeoff: ["M2 22h20", "M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l.17.1a2 2 0 0 0 1.8 0L8 12 5 6l.9-.45a2 2 0 0 1 2.09.2l4.02 3a2 2 0 0 0 2.1.2l4.19-2.06a2.41 2.41 0 0 1 1.73-.17L21 7a1.4 1.4 0 0 1 .87 1.99l-.38.76c-.23.46-.6.84-1.07 1.08L7.58 17.2a2 2 0 0 1-1.22.18Z"],
  landing: ["M2 22h20", "M3.77 10.77 2 9l2-4.5 1.1.55c.55.28.9.84.9 1.45s.35 1.17.9 1.45L8 8.5l3-6 1.05.53a2 2 0 0 1 1.09 1.52l.72 5.4a2 2 0 0 0 1.09 1.52l4.4 2.2c.42.22.78.55 1.01.96l.6 1.03c.49.88-.06 1.98-1.06 2.1l-1.18.15c-.47.06-.95-.02-1.37-.24L4.29 11.15a2 2 0 0 1-.52-.38Z"],
  sunrise: ["M12 2v8", "m4.93 10.93 1.41 1.41", "M2 18h2", "M20 18h2", "m19.07 10.93-1.41 1.41", "M22 22H2", "m8 6 4-4 4 4", "M16 18a4 4 0 0 0-8 0"],
  sun: [{ circle: [12, 12, 4] }, "M12 2v2", "M12 20v2", "m4.93 4.93 1.41 1.41", "m17.66 17.66 1.41 1.41", "M2 12h2", "M20 12h2", "m6.34 17.66-1.41 1.41", "m19.07 4.93-1.41 1.41"],
  sunset: ["M12 10V2", "m4.93 10.93 1.41 1.41", "M2 18h2", "M20 18h2", "m19.07 10.93-1.41 1.41", "M22 22H2", "m16 6-4 4-4-4", "M16 18a4 4 0 0 0-8 0"],
  plus: ["M5 12h14", "M12 5v14"],
  chevronLeft: ["m15 18-6-6 6-6"],
  arrowRight: ["M5 12h14", "m12 5 7 7-7 7"],
  swapHorizontal: ["M8 3 4 7l4 4", "M4 7h16", "m16 21 4-4-4-4", "M20 17H4"],
  repeat: ["m17 2 4 4-4 4", "M3 11v-1a4 4 0 0 1 4-4h14", "m7 22-4-4 4-4", "M21 13v1a4 4 0 0 1-4 4H3"],
  oneWay: ["M18 8l4 4-4 4", "M2 12h20"],
  home: ["M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8", "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"],
  compass: [{ circle: [12, 12, 10] }, "m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"],
  share: ["M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8", "m16 6-4-4-4 4", "M12 2v13"],
  luggage: ["M6 20a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2", "M8 18V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14", "M10 20h4", { circle: [16, 20, 2] }, { circle: [8, 20, 2] }],
  help: [{ circle: [12, 12, 10] }, "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", "M12 17h.01"],
  route: [{ circle: [6, 19, 3] }, "M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15", { circle: [18, 5, 3] }],
  minus: ["M5 12h14"],
  moon: ["M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"],
  seat: ["M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3", "M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z", "M5 18v2", "M19 18v2"],
};

export function Icon({ name, size = 20, color = colors.text, strokeWidth = 2, rotate }: { name: IconName; size?: number; color?: string; strokeWidth?: number; rotate?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={rotate ? { transform: [{ rotate: `${rotate}deg` }] } : undefined}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {PATHS[name].map((p, i) =>
        typeof p === "string" ? (
          <Path key={i} d={p} />
        ) : "circle" in p ? (
          <Circle key={i} cx={p.circle[0]} cy={p.circle[1]} r={p.circle[2]} />
        ) : (
          <Rect key={i} x={p.rect[0]} y={p.rect[1]} width={p.rect[2]} height={p.rect[3]} rx={p.rect[4]} />
        ),
      )}
    </Svg>
  );
}
