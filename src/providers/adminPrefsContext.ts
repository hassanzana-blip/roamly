import { createContext, useContext } from "react";

/**
 * Utseendet på verktøyet, valgt av den som sitter i det.
 *
 * To valg: tema (følg systemet / lyst / mørkt) og tetthet. Tetthet er ikke
 * pynt – Zana sitter i lister hele dagen og vil ha flest mulig rader på
 * skjermen, mens en som er innom to ganger i uka har mer nytte av luft. Begge
 * har rett, på hver sin maskin.
 *
 * Kontrakten bor her og ikke sammen med provideren, fordi en fil som
 * eksporterer både komponenter og hooks mister hot reload.
 */

export type Theme = "system" | "light" | "dark";
export type Density = "comfortable" | "compact";

export const THEME_KEY = "hellosky.admin.theme";
export const DENSITY_KEY = "hellosky.admin.density";

export type Prefs = {
  theme: Theme;
  density: Density;
  setTheme: (t: Theme) => void;
  setDensity: (d: Density) => void;
  /** Temaet slik det faktisk vises akkurat nå – «system» er løst opp. */
  resolvedTheme: "light" | "dark";
};

export const PrefsContext = createContext<Prefs | null>(null);

export function useAdminPrefs(): Prefs {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("useAdminPrefs må brukes inne i AdminPrefsProvider");
  return ctx;
}
