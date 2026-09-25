import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { readPref, writePref } from "../lib/localStore";
import {
  formatDay,
  formatInt,
  formatLongDay,
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
import { hotels } from "./ns/hotels";
import { saved } from "./ns/saved";
import { calendar } from "./ns/calendar";

/**
 * Oversettelser. Hvert område har én fil med engelsk og norsk side om side;
 * den norske er typet som den engelske, så en manglende, overflødig eller feil
 * typet nøkkel er en kompileringsfeil. Tekst med tall er funksjoner, så
 * flertall bøyes riktig på begge språk.
 */
const dictionaries = {
  en: { common: common.en, search: search.en, results: results.en, offer: offer.en, price: price.en, errors: errors.en, home: home.en, explore: explore.en, account: account.en, details: details.en, airport: airport.en, hotels: hotels.en, saved: saved.en, calendar: calendar.en },
  nb: { common: common.nb, search: search.nb, results: results.nb, offer: offer.nb, price: price.nb, errors: errors.nb, home: home.nb, explore: explore.nb, account: account.nb, details: details.nb, airport: airport.nb, hotels: hotels.nb, saved: saved.nb, calendar: calendar.nb },
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
    longDay: (iso: string) => formatLongDay(iso, locale),
    shortDay: (iso: string) => formatShortDay(iso, locale),
    numericDate: (iso: string) => formatNumericDate(iso, locale),
    monthYear: (year: number, month0: number) => formatMonthYear(year, month0, locale),
    duration: (minutes: number) => formatDuration(minutes, locale),
    spokenDuration: (minutes: number) => spokenDuration(minutes, locale),
    stops: (n: number) => formatStops(n, locale),
    stopsSummary: (slices: readonly { stops: number }[]) => stopsSummary(slices, locale),
    greeting: (now?: Date) => greeting(locale, now),
    int: (n: number) => formatInt(n, locale),
    /** Et desimaltall med én desimal (vurdering 8,6 / 8.6, avstand). */
    decimal1: (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(".", locale === "nb" ? "," : "."),
  };
}

export type Formatters = ReturnType<typeof formattersFor>;

/** Alt en tekstprodusent trenger: språket, ordboken og formatererne. */
export type I18n = { locale: Locale; t: Dictionary; f: Formatters };

export function i18nFor(locale: Locale): I18n {
  return { locale, t: dictionaryFor(locale), f: formattersFor(locale) };
}

/**
 * `chosen`: kunden (eller en test/forhåndsvisning) har valgt språket. Standarden
 * ved ny installasjon er ikke et valg, og sendes derfor ikke til kontoen.
 */
type I18nContextValue = I18n & { setLocale: (l: Locale) => void; chosen: boolean };

const I18nContext = createContext<I18nContextValue | null>(null);

const PREF_KEY = "locale";

/** Språket som er lagret på telefonen, ellers norsk bokmål (ny installasjon). */
export function storedLocale(): Locale {
  return savedLocale() ?? DEFAULT_LOCALE;
}

function savedLocale(): Locale | null {
  return readPref(PREF_KEY, (v) => (isLocale(v) ? v : null));
}

/**
 * Språket for hele appen. Et valg lagres straks og gjelder med én gang – uten
 * omstart. Språket endrer aldri valuta, leverandør eller søkeparametere.
 */
export function I18nProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale ?? storedLocale());
  const [chosen, setChosen] = useState(() => initialLocale !== undefined || savedLocale() !== null);
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    setChosen(true);
    // Et bevisst valg: det eneste som får skrive inn i en innstillingsfil fra en annen appversjon.
    writePref(PREF_KEY, l, { userChoice: true });
  }, []);
  const value = useMemo(() => ({ ...i18nFor(locale), setLocale, chosen }), [locale, setLocale, chosen]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** VoiceOver-språket (iOS `accessibilityLanguage`, BCP 47) for appens språk. */
export function a11yLanguage(locale: Locale): string {
  return locale === "nb" ? "nb-NO" : "en-GB";
}

/** Som over, for elementer som kan stå utenfor I18nProvider (da: ingen verdi). */
export function useA11yLanguage(): string | undefined {
  const v = useContext(I18nContext);
  return v ? a11yLanguage(v.locale) : undefined;
}

export function useI18n(): I18nContextValue {
  const v = useContext(I18nContext);
  if (!v) throw new Error("useI18n må brukes innenfor I18nProvider");
  return v;
}
