/**
 * HelloSkys app-uttrykk: midnattsblå toppfelt med diskret verdenskart, hvite
 * svevende kort og sterk indigo for handlinger. Alle tekstpar under er sjekket
 * mot WCAG AA (minst 4,5:1): hvit på indigo 9,0, indigo på feltflate 8,1,
 * textMuted på feltflate 4,7, onDarkMuted på navy 8,2 og på navyRaised 6,7.
 */
export const colors = {
  // Mørke flater
  navy: "#1A1E5C",
  navyDeep: "#12154A",
  navyRaised: "#262B78",
  navyLine: "rgba(255,255,255,0.14)",
  onDark: "#FFFFFF",
  onDarkMuted: "#B7BCE8",

  // Handling
  indigo: "#2F3BAA",
  indigoPressed: "#252F8C",
  indigoInk: "#2F3BAA",
  indigoSoft: "#ECEEFB",

  // Lyse flater og tekst
  page: "#F3F5FA",
  white: "#FFFFFF",
  surfaceMuted: "#F2F3F8",
  border: "#E3E7F0",
  input: "#CDD3E1",
  text: "#0F1233",
  textSecondary: "#566079",
  textMuted: "#646D86",

  // Tilstander
  success: "#127A4B",
  successSurface: "#E7F5EE",
  warning: "#8A5000",
  warningSurface: "#FFF5E1",
  layover: "#9A5B00",
  destructive: "#B3261E",
  destructiveSurface: "#FDECEA",
} as const;

export const fonts = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  heavy: "Manrope_800ExtraBold",
} as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;

/** Minste trykkflate (Apples retningslinje: 44 pt). */
export const TOUCH = 44;

/** Skygger (boxShadow virker på iOS med den nye arkitekturen og på web). */
export const shadow = {
  card: { boxShadow: "0px 10px 30px rgba(18, 21, 74, 0.22)" },
  soft: { boxShadow: "0px 2px 8px rgba(18, 21, 74, 0.08)" },
  button: { boxShadow: "0px 8px 18px rgba(47, 59, 170, 0.35)" },
} as const;

/** Merket («H») – samme sti som nettets SkyMark. */
export const SKY_MARK_PATH = "M8 16 L36 8 L36 34 L64 34 L64 22 L92 28 L92 92 L64 92 L64 60 A14 14 0 0 0 36 60 L36 92 L8 92 Z";
