/** Appens språk. Engelsk er standard; norsk bokmål er et eget, lagret valg. */
export type Locale = "en" | "nb";

export const LOCALES: readonly Locale[] = ["en", "nb"];

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "nb";
}

/** Språkets eget navn, slik det vises i språkvelgeren (samme på begge språk). */
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", nb: "Norsk (bokmål)" };
