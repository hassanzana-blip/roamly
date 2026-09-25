import type { TextStyle } from "react-native";

/**
 * HelloSkys app-uttrykk: kull/svart grunn, hvite flater og HelloSky-blått
 * bare som handlingsfarge. Svart og hvitt bærer identiteten; blått er aksent.
 *
 * Tekstpar sjekket mot WCAG AA (minst 4,5:1): hvit på blå 5,8 · blå på hvit 5,8 ·
 * sekundær på hvit 5,8 og på innfelt flate 5,4 · onDarkMuted på grunnen 9,5 og
 * på hevet flate 8,4 · blueOnDark på grunnen 6,1 og på hevet flate 5,4.
 * #0754F8 er for mørk som liten tekst på kull (3,4) – der brukes blueOnDark.
 */
export const colors = {
  // Mørke flater
  bg: "#0C0D0F",
  raised: "#191B1F",
  darkBorder: "#2B2D32",
  onDark: "#F8F9FA",
  onDarkMuted: "#B2B5BC",
  onDarkDim: "#8E9199",

  // Lyse flater
  white: "#FFFFFF",
  inset: "#F5F5F7",
  lightBorder: "#E6E7EB",
  text: "#111214",
  textSecondary: "#62656D",
  /** Det som ikke kan velges (passerte dager i kalenderen). Unntatt kontrastkravet, men fortsatt synlig. */
  textDisabled: "#B4B7BE",

  // Handling
  blue: "#0754F8",
  bluePressed: "#0544CC",
  blueOnDark: "#4C8DFF",
  /** Valgt fane: svak blå pille bak ikonet på kull. */
  blueOnDarkTint: "rgba(76, 141, 255, 0.18)",
  blueSoft: "#EAF0FF",

  // Tilstander (alltid sammen med tekst eller ikon – aldri farge alene)
  success: "#0A7A3F",
  successSoft: "#E8F5EE",
  warning: "#8A5000",
  warningSoft: "#FFF6E5",
  warningOnDark: "#FFD27A",
  danger: "#B42318",
  dangerSoft: "#FDECEA",

  // Fotooverlegg (nøytralt svart, aldri blåtonet)
  scrim: "rgba(12, 13, 15, 0.55)",
  scrimStrong: "rgba(12, 13, 15, 0.78)",
} as const;

export const radius = { sm: 10, input: 14, card: 20, sheet: 28, pill: 999 } as const;
/** 4-punktsrytme. */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

/** Minste trykkflate (Apples retningslinje: 44 pt). */
export const TOUCH = 44;

/**
 * Typografi: iOS' systemskrift (SF Pro) – ingen fontfiler lastes ned eller
 * følger med. Tall som skal sammenlignes (klokkeslett, priser) har tabellsifre.
 * Tekststørrelsen følger telefonens innstilling; ingenting er låst.
 */
const tabular: TextStyle = { fontVariant: ["tabular-nums"] };
export const type = {
  hero: { fontSize: 28, lineHeight: 34, fontWeight: "600", letterSpacing: -0.4 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "600", letterSpacing: -0.3 },
  section: { fontSize: 18, lineHeight: 24, fontWeight: "600", letterSpacing: -0.2 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400" },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  callout: { fontSize: 15, lineHeight: 20, fontWeight: "400" },
  calloutStrong: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
  footnoteStrong: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
  code: { fontSize: 26, lineHeight: 30, fontWeight: "700", letterSpacing: -0.3 },
  codeSmall: { fontSize: 22, lineHeight: 26, fontWeight: "700", letterSpacing: -0.2 },
  time: { fontSize: 17, lineHeight: 22, fontWeight: "600", ...tabular },
  timeLarge: { fontSize: 22, lineHeight: 28, fontWeight: "600", ...tabular },
  price: { fontSize: 24, lineHeight: 30, fontWeight: "700", letterSpacing: -0.3, ...tabular },
  tabular,
} satisfies Record<string, TextStyle>;

/** Diskrete skygger – ingen glød. */
export const shadow = {
  card: { boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.06)" },
  sheet: { boxShadow: "0px -1px 0px rgba(0, 0, 0, 0.04)" },
} as const;

/** Merket («H») – samme sti som nettets SkyMark. */
export const SKY_MARK_PATH = "M8 16 L36 8 L36 34 L64 34 L64 22 L92 28 L92 92 L64 92 L64 60 A14 14 0 0 0 36 60 L36 92 L8 92 Z";
