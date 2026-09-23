import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { readPref, writePref } from "../lib/localStore";
import {
  formatDay,
  formatDuration,
  formatMonthYear,
  formatNok,
  formatNumericDate,
  formatShortDay,
  formatStops,
  greeting,
  spokenDuration,
  spokenNok,
  stopsSummary,
} from "../lib/format";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./types";
import { common } from "./ns/common";
import { search } from "./ns/search";
import { results } from "./ns/results";
import { offer } from "./ns/offer";
import { price } from "./ns/price";
import { errors } from "./ns/errors";
import { home } from "./ns/home";
import { explore } from "./ns/explore";
import { account } from "./ns/account";
import { details } from "./ns/details";
import { airport } from "./ns/airport";

/**
 * Oversettelser. Hvert område har én fil med engelsk og norsk side om side;
 * den norske er typet som den engelske, så en manglende, overflødig eller feil
 * typet nøkkel er en kompileringsfeil. Tekst med tall er funksjoner, så
 * flertall bøyes riktig på begge språk.
 */
const dictionaries = {
  en: { common: common.en, search: search.en, results: results.en, offer: offer.en, price: price.en, errors: errors.en, home: home.en, explore: explore.en, account: account.en, details: details.en, airport: airport.en },
  nb: { common: common.nb, search: search.nb, results: results.nb, offer: offer.nb, price: price.nb, errors: errors.nb, home: home.nb, explore: explore.nb, account: account.nb, details: details.nb, airport: airport.nb },
} satisfies Record<Locale, unknown>;

export type Dictionary = typeof dictionaries.en;

export function dictionaryFor(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Formaterere bundet til ett språk. Valutaen er alltid NOK. */
export function formattersFor(locale: Locale) {
  return {
    nok: (amountMinor: number) => formatNok(amountMinor, locale),
    spokenNok: (amountMinor: number) => spokenNok(amountMinor, locale),
    day: (iso: string) => formatDay(iso, locale),
    shortDay: (iso: string) => formatShortDay(iso, locale),
    numericDate: (iso: string) => formatNumericDate(iso, locale),
    monthYear: (year: number, month0: number) => formatMonthYear(year, month0, locale),
    duration: (minutes: number) => formatDuration(minutes, locale),
    spokenDuration: (minutes: number) => spokenDuration(minutes, locale),
    stops: (n: number) => formatStops(n, locale),
    stopsSummary: (slices: readonly { stops: number }[]) => stopsSummary(slices, locale),
    greeting: (now?: Date) => greeting(locale, now),
  };
}

export type Formatters = ReturnType<typeof formattersFor>;

/** Alt en tekstprodusent trenger: språket, ordboken og formatererne. */
export type I18n = { locale: Locale; t: Dictionary; f: Formatters };

export function i18nFor(locale: Locale): I18n {
  return { locale, t: dictionaryFor(locale), f: formattersFor(locale) };
}

type I18nContextValue = I18n & { setLocale: (l: Locale) => void };

const I18nContext = createContext<I18nContextValue | null>(null);

const PREF_KEY = "locale";

/** Språket som er lagret på telefonen, ellers engelsk. */
export function storedLocale(): Locale {
  return readPref(PREF_KEY, (v) => (isLocale(v) ? v : null)) ?? DEFAULT_LOCALE;
}

/**
 * Språket for hele appen. Et valg lagres straks og gjelder med én gang – uten
 * omstart. Språket endrer aldri valuta, leverandør eller søkeparametere.
 */
export function I18nProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale ?? storedLocale());
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    writePref(PREF_KEY, l);
  }, []);
  const value = useMemo(() => ({ ...i18nFor(locale), setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const v = useContext(I18nContext);
  if (!v) throw new Error("useI18n må brukes innenfor I18nProvider");
  return v;
}
