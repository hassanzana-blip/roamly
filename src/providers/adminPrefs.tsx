import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DENSITY_KEY,
  PrefsContext,
  THEME_KEY,
  type Density,
  type Theme,
} from "./adminPrefsContext";

/** Leser lagret valg. En blokkert localStorage skal ikke velte adminsiden. */
function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Privat vindu eller blokkerte informasjonskapsler: valget gjelder økten.
  }
}

const systemPrefersDark = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;

export function AdminPrefsProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => read(THEME_KEY, ["system", "light", "dark"] as const, "system"));
  const [density, setDensityState] = useState<Density>(() => read(DENSITY_KEY, ["comfortable", "compact"] as const, "comfortable"));
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Følger systemet i sanntid når det er valgt – bytter du tema i macOS ved
  // solnedgang, følger adminsiden etter uten en omlasting.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme: "light" | "dark" = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.dataset.density = density;
    // Nettleserens egne flater – rullefelt, skjemakontroller – skal ikke stå
    // igjen i lyst når resten er mørkt.
    root.style.colorScheme = resolvedTheme;
    return () => {
      root.classList.remove("dark");
      delete root.dataset.density;
      root.style.colorScheme = "";
    };
  }, [resolvedTheme, density]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    write(THEME_KEY, t);
  }, []);
  const setDensity = useCallback((d: Density) => {
    setDensityState(d);
    write(DENSITY_KEY, d);
  }, []);

  const value = useMemo(
    () => ({ theme, density, setTheme, setDensity, resolvedTheme }),
    [theme, density, setTheme, setDensity, resolvedTheme],
  );
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}
