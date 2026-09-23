/** HelloSkys merkevare (fra nettets src/index.css, HelloSky 4.0-tokenene). */
export const colors = {
  azure: "#1164E8",
  azureInk: "#105CD5",
  azurePressed: "#0D49AB",
  petrol: "#123A45",
  petrolDeep: "#0C2931",
  mint: "#E5F0EB",
  mintDeep: "#CDDFD7",
  sand: "#F3F6F6",
  muted: "#EDF1F2",
  border: "#DDE6E9",
  input: "#C9D5D9",
  text: "#123A45",
  textSecondary: "#53666E",
  textMuted: "#63767E",
  coral: "#C45C45",
  lavender: "#EEEAF6",
  destructive: "#B3261E",
  success: "#1F7A45",
  warning: "#8A5000",
  warningSurface: "#FFF4E0",
  white: "#FFFFFF",
} as const;

export const fonts = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  display: "Newsreader_500Medium",
} as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Merket («H» i azur) – samme sti som nettets SkyMark. */
export const SKY_MARK_PATH = "M8 16 L36 8 L36 34 L64 34 L64 22 L92 28 L92 92 L64 92 L64 60 A14 14 0 0 0 36 60 L36 92 L8 92 Z";
