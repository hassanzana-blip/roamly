import type { Locale } from "../i18n/types";

/**
 * Formatering uten flyttall og uten å stole på enhetens Intl-data, på engelsk
 * eller norsk. Språket styrer bare ord og skrivemåte – aldri valutaen: appen
 * formaterer bare kronebeløp, og det finnes med vilje ingen formaterer for
 * andre valutaer.
 */

const NBSP = "\u00A0";

function group(digits: string, sep: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/** nb: 123450 → «1 234,50 kr», 123400 → «1 234 kr». en: «NOK 1,234.50», «NOK 1,234». */
export function formatNok(amountMinor: number, locale: Locale): string {
  const negative = amountMinor < 0;
  const abs = Math.abs(Math.trunc(amountMinor));
  const kroner = Math.floor(abs / 100);
  const ore = abs % 100;
  const sign = negative ? "−" : "";
  if (locale === "en") return `${sign}NOK${NBSP}${group(String(kroner), ",")}${ore ? `.${String(ore).padStart(2, "0")}` : ""}`;
  return `${sign}${group(String(kroner), NBSP)}${ore ? `,${String(ore).padStart(2, "0")}` : ""}${NBSP}kr`;
}

/** Et heltall med tusenskille: nb «3 118», en «3,118». */
export function formatInt(n: number, locale: Locale): string {
  const abs = String(Math.abs(Math.trunc(n)));
  return `${n < 0 ? "−" : ""}${group(abs, locale === "nb" ? NBSP : ",")}`;
}

/** Til skjermleser: nb «1 234 kroner», en «1,234 Norwegian kroner». */
export function spokenNok(amountMinor: number, locale: Locale): string {
  const abs = Math.abs(Math.trunc(amountMinor));
  const kroner = Math.floor(abs / 100);
  const ore = abs % 100;
  if (locale === "en") return `${group(String(kroner), ",")}${ore ? `.${String(ore).padStart(2, "0")}` : ""} Norwegian kroner`;
  return `${group(String(kroner), NBSP)}${ore ? `,${String(ore).padStart(2, "0")}` : ""} kroner`;
}

const WEEKDAYS: Record<Locale, string[]> = {
  nb: ["søn.", "man.", "tir.", "ons.", "tor.", "fre.", "lør."],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};
const MONTHS: Record<Locale, string[]> = {
  nb: ["jan.", "feb.", "mars", "apr.", "mai", "juni", "juli", "aug.", "sep.", "okt.", "nov.", "des."],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
const MONTHS_LONG: Record<Locale, string[]> = {
  nb: ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

function parseIsoDate(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** nb «fre. 23. okt.», en «Fri 23 Oct». */
export function formatDay(iso: string, locale: Locale): string {
  const p = parseIsoDate(iso);
  if (!p) return "";
  const weekday = WEEKDAYS[locale][new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()];
  return locale === "en" ? `${weekday} ${p.d} ${MONTHS.en[p.m - 1]}` : `${weekday} ${p.d}. ${MONTHS.nb[p.m - 1]}`;
}

/** nb «22.09.2026», en «22 Sep 2026» (entydig for engelske lesere). */
export function formatNumericDate(iso: string, locale: Locale): string {
  const p = parseIsoDate(iso);
  if (!p) return "";
  if (locale === "en") return `${p.d} ${MONTHS.en[p.m - 1]} ${p.y}`;
  return `${String(p.d).padStart(2, "0")}.${String(p.m).padStart(2, "0")}.${p.y}`;
}

const WEEKDAYS_LONG: Record<Locale, string[]> = {
  nb: ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

/** Hele datoen for VoiceOver i kalenderen: nb «fredag 9. oktober 2026», en «Friday 9 October 2026». */
export function formatLongDay(iso: string, locale: Locale): string {
  const p = parseIsoDate(iso);
  if (!p) return "";
  const weekday = WEEKDAYS_LONG[locale][new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()];
  return locale === "en" ? `${weekday} ${p.d} ${MONTHS_LONG.en[p.m - 1]} ${p.y}` : `${weekday} ${p.d}. ${MONTHS_LONG.nb[p.m - 1]} ${p.y}`;
}

/** Måned og år for kalenderen: nb «oktober 2026», en «October 2026». */
export function formatMonthYear(year: number, month0: number, locale: Locale): string {
  return `${MONTHS_LONG[locale][month0]} ${year}`;
}

/** Klokkeslett slik leverandøren oppga det (lokal tid på flyplassen): «2026-10-23T07:05:00» → «07:05». */
export function formatTime(isoDateTime: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(isoDateTime);
  return m ? `${m[1]}:${m[2]}` : "";
}

/** 155 → nb «2 t 35 min», en «2h 35m». */
export function formatDuration(minutes: number, locale: Locale): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (locale === "en") return h === 0 ? `${m}m` : m ? `${h}h ${m}m` : `${h}h`;
  if (h === 0) return `${m} min`;
  return m ? `${h} t ${m} min` : `${h} t`;
}

/** Varighet til skjermleser: en «2 hours 35 minutes», nb «2 timer 35 minutter». */
export function spokenDuration(minutes: number, locale: Locale): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  const parts: string[] = [];
  if (locale === "en") {
    if (h) parts.push(`${h} ${h === 1 ? "hour" : "hours"}`);
    if (m) parts.push(`${m} ${m === 1 ? "minute" : "minutes"}`);
  } else {
    if (h) parts.push(`${h} ${h === 1 ? "time" : "timer"}`);
    if (m) parts.push(`${m} ${m === 1 ? "minutt" : "minutter"}`);
  }
  return parts.join(" ");
}

/** nb «Direkte», «1 mellomlanding», «2 mellomlandinger»; en «Direct», «1 stop», «2 stops». */
export function formatStops(stops: number, locale: Locale): string {
  if (locale === "en") return stops <= 0 ? "Direct" : stops === 1 ? "1 stop" : `${stops} stops`;
  if (stops <= 0) return "Direkte";
  return stops === 1 ? "1 mellomlanding" : `${stops} mellomlandinger`;
}

/** Hele reisen: «1 mellomlanding hver vei» / «1 stop each way» – «Opptil»/«Up to» bare når strekningene er ulike. */
export function stopsSummary(slices: readonly { stops: number }[], locale: Locale): string {
  const max = slices.reduce((m, s) => Math.max(m, s.stops), 0);
  if (max === 0) return formatStops(0, locale);
  if (slices.length === 1) return formatStops(max, locale);
  const same = slices.every((s) => s.stops === max);
  if (locale === "en") return same ? `${formatStops(max, locale)} each way` : `Up to ${formatStops(max, locale)}`;
  return same ? `${formatStops(max, locale)} hver vei` : `Opptil ${formatStops(max, locale).toLowerCase()}`;
}

/**
 * Hvor mange kalenderdøgn ankomsten ligger etter avgangen, regnet på datoene
 * slik leverandøren oppga dem (lokal tid på hver flyplass). 1 = «+1».
 */
export function dayOffset(departingAt: string, arrivingAt: string): number {
  const a = parseIsoDate(departingAt);
  const b = parseIsoDate(arrivingAt);
  if (!a || !b) return 0;
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

/** Klokkeslett på telefonen (24 t, begge språk): «14:05». */
export function formatClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Kort dato uten ukedag: nb «23. okt.», en «23 Oct». */
export function formatShortDay(iso: string, locale: Locale): string {
  const p = parseIsoDate(iso);
  if (!p) return "";
  return locale === "en" ? `${p.d} ${MONTHS.en[p.m - 1]}` : `${p.d}. ${MONTHS.nb[p.m - 1]}`;
}

/**
 * Et datospenn så kort som det kan være uten å bli uklart: «9.–16. okt.» (samme måned), «30. okt. – 6. nov.»,
 * en «9–16 Oct». Uten retur: bare avreisen.
 */
export function formatDateSpan(depart: string, ret: string | null, locale: Locale): string {
  const a = parseIsoDate(depart);
  const b = ret ? parseIsoDate(ret) : null;
  if (!a) return "";
  if (!b || (a.y === b.y && a.m === b.m && a.d === b.d)) return formatShortDay(depart, locale);
  if (a.y === b.y && a.m === b.m) return locale === "en" ? `${a.d}–${b.d} ${MONTHS.en[a.m - 1]}` : `${a.d}.–${b.d}. ${MONTHS.nb[a.m - 1]}`;
  return `${formatShortDay(depart, locale)} – ${formatShortDay(ret!, locale)}`;
}

/** Hilsen etter klokken på telefonen. */
export function greeting(locale: Locale, now: Date = new Date()): string {
  const h = now.getHours();
  if (locale === "en") {
    if (h >= 5 && h < 12) return "Good morning";
    if (h >= 12 && h < 18) return "Good afternoon";
    if (h >= 18) return "Good evening";
    return "Hi";
  }
  if (h >= 5 && h < 10) return "God morgen";
  if (h >= 10 && h < 12) return "God formiddag";
  if (h >= 12 && h < 18) return "God ettermiddag";
  if (h >= 18) return "God kveld";
  return "Hei";
}

/** Lokal kalenderdato (enhetens tid) som YYYY-MM-DD. */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function fromIsoDate(iso: string): Date {
  const p = parseIsoDate(iso);
  return p ? new Date(p.y, p.m - 1, p.d) : new Date();
}

export function addDays(iso: string, days: number): string {
  const d = fromIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

const OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Minutter mellom to tidspunkter fra leverandøren. Med tidssone (Z/±hh:mm) på
 * begge regnes det eksakt – også over sommertidsskifte. Uten tidssone på
 * begge er det lokal tid på samme flyplass, og klokkeforskjellen brukes.
 * Blandet eller ugyldig: null (vi viser heller ingen varighet enn en feil).
 */
export function minutesBetween(from: string, to: string): number | null {
  const a = from.trim();
  const b = to.trim();
  const withOffset = OFFSET.test(a);
  if (withOffset !== OFFSET.test(b)) return null;
  const pa = Date.parse(withOffset ? a : `${a.slice(0, 19)}Z`);
  const pb = Date.parse(withOffset ? b : `${b.slice(0, 19)}Z`);
  if (!Number.isFinite(pa) || !Number.isFinite(pb) || pb < pa) return null;
  return Math.round((pb - pa) / 60_000);
}
