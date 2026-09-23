/**
 * Appens språk. Norsk bokmål er standard ved første oppstart; engelsk er et
 * eget valg i Profil som lagres på telefonen og beholdes.
 */
export type Locale = "en" | "nb";

/** I den rekkefølgen de vises i språkvelgeren: bokmål først. */
export const LOCALES: readonly Locale[] = ["nb", "en"];

export const DEFAULT_LOCALE: Locale = "nb";

export function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "nb";
}

/** Språkets eget navn, slik det vises i språkvelgeren (samme på begge språk). */
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", nb: "Norsk (bokmål)" };
