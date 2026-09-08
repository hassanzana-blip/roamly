// Formateringshjelpere for kundesiden. Norsk (bokmål) er standard; språk
// leses fra <html lang> slik at i18n-laget kan bytte uten at denne fila
// importerer noe fra det.

import type { FeeConfig } from "@contracts/types";

// ─── Språk ──────────────────────────────────────────────────────────────────

const LOCALE_TAGS: Record<string, string> = {
  nb: "nb-NO",
  no: "nb-NO",
  nn: "nn-NO",
  en: "en-GB",
  sv: "sv-SE",
  da: "da-DK",
  de: "de-DE",
};

/** Aktivt språk (to bokstaver) fra `<html lang>`, fallback "nb". */
export function currentLang(): string {
  const doc = (globalThis as { document?: { documentElement?: { lang?: string } } }).document;
  const lang = (doc?.documentElement?.lang || "nb").slice(0, 2).toLowerCase();
  return lang in LOCALE_TAGS ? lang : "nb";
}

/** BCP-47-tag for aktivt språk (fra `<html lang>`), fallback nb-NO. */
export function currentLocale(): string {
  return LOCALE_TAGS[currentLang()] ?? "nb-NO";
}

/** Velg tekst for aktivt språk: nb/en påkrevd, resten faller tilbake til en. */
function pick(entry: { nb: string; en: string; sv?: string; da?: string; de?: string }): string {
  const lang = currentLang();
  if (lang === "nb" || lang === "no" || lang === "nn") return entry.nb;
  return (entry as Record<string, string | undefined>)[lang] ?? entry.en;
}

// ─── Penger ─────────────────────────────────────────────────────────────────
// Kopi av api/lib/money.ts (klienten importerer aldri serverkode).

const EXPONENTS: Record<string, number> = {
  JPY: 0, KRW: 0, ISK: 0, HUF: 2, CLP: 0, VND: 0, XOF: 0, XAF: 0,
  BHD: 3, KWD: 3, OMR: 3, JOD: 3, TND: 3,
};

/** Antall desimaler per valuta (ISO 4217). Ukjent → 2. */
export function currencyExponent(currency: string): number {
  return EXPONENTS[currency.toUpperCase()] ?? 2;
}

/** "1234.50" + "NOK" → 123450. Returnerer 0 for ugyldig input (visning, ikke regning). */
export function toMinor(amount: string | number, currency = "NOK"): number {
  const trimmed = String(amount).trim();
  const m = /^(-)?(\d+)(?:\.(\d{1,3}))?$/.exec(trimmed);
  if (!m) return 0;
  const exp = currencyExponent(currency);
  const frac = (m[3] ?? "").padEnd(exp, "0").slice(0, exp);
  const minor = Number(m[2]) * 10 ** exp + (exp > 0 ? Number(frac) : 0);
  return m[1] ? -minor : minor;
}

/** 123450 + "NOK" → "1234.50" */
function fromMinor(minor: number, currency = "NOK"): string {
  const exp = currencyExponent(currency);
  const negative = minor < 0;
  const abs = Math.abs(Math.round(minor));
  if (exp === 0) return `${negative ? "-" : ""}${abs}`;
  const major = Math.floor(abs / 10 ** exp);
  const frac = String(abs % 10 ** exp).padStart(exp, "0");
  return `${negative ? "-" : ""}${major}.${frac}`;
}

/** Beløp i minste enhet → «1 234 kr» / «12,50 €». Hele kroner uten desimaler for NOK/SEK/DKK. */
export function formatMinor(minor: number, currency: string, locale = currentLocale()): string {
  const cur = currency.toUpperCase();
  const exp = currencyExponent(cur);
  const value = minor / 10 ** exp;
  const wholeOnly = ["NOK", "SEK", "DKK"].includes(cur) && Number.isInteger(value);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: cur,
      minimumFractionDigits: wholeOnly ? 0 : Math.min(exp, 2),
      maximumFractionDigits: wholeOnly ? 0 : Math.min(exp, 2),
    }).format(value);
  } catch {
    return `${fromMinor(minor, cur)} ${cur}`;
  }
}

/** Desimalbeløp ("1234.50") eller tall → formatert pris i aktiv locale. NOK uten desimaler. */
export function formatPrice(amount: string | number, currency = "NOK", locale = currentLocale()): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "NOK" ? 0 : 2,
    }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

// ─── Servicegebyr – KUN FORHÅNDSVISNING ─────────────────────────────────────
// Serveren (api/lib/pricing.ts) er eneste kilde til sannhet; admin kan
// overstyre satsene. Klienten henter gjeldende satser via
// `flights.status().feeConfig` (se useFeeConfig.ts) og faller tilbake til
// DEFAULT_FEE_CONFIG. Brukes bare til å vise et ESTIMAT i søkeresultat og
// før checkout-økten er opprettet. Merk alltid som «ca.».

export const DEFAULT_FEE_CONFIG: FeeConfig = {
  percent: 0.08,
  flatMinorByCurrency: {
    NOK: 25000,
    SEK: 25000,
    DKK: 17500,
    EUR: 2300,
    GBP: 2000,
    USD: 2500,
  },
};

export function previewServiceFeeMinor(supplierMinor: number, currency: string, cfg: FeeConfig = DEFAULT_FEE_CONFIG): number {
  const cur = currency.toUpperCase();
  const unit = 10 ** currencyExponent(cur);
  const percentMinor = Math.round((supplierMinor * cfg.percent) / unit) * unit;
  const flat = cfg.flatMinorByCurrency[cur] ?? cfg.flatMinorByCurrency.EUR ?? DEFAULT_FEE_CONFIG.flatMinorByCurrency.EUR;
  return percentMinor + flat;
}

/** Estimert totalpris (leverandørpris + servicegebyr) i minste enhet. */
export function previewTotalMinor(supplierAmount: string | number, currency: string, cfg: FeeConfig = DEFAULT_FEE_CONFIG): number {
  const supplier = toMinor(supplierAmount, currency);
  return supplier + previewServiceFeeMinor(supplier, currency, cfg);
}

// ─── Dato og tid ────────────────────────────────────────────────────────────

/**
 * En tom eller ugyldig dato skal aldri velte en side.
 *
 * `Intl.DateTimeFormat.format` kaster «Invalid time value» på NaN, og en
 * lenke som mangler `depart=` er nok til å sende hele søkesiden i
 * feilgrensen. Formatererne returnerer nå tom streng i stedet, og siden
 * håndterer den manglende verdien der den faktisk hører hjemme.
 */
function safeDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatClock(iso: string, locale = currentLocale()): string {
  const d = safeDate(iso);
  if (!d) return "";
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatDateShort(iso: string, locale = currentLocale()): string {
  const d = safeDate(iso);
  if (!d) return "";
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

/** «10. nov» – uten ukedag (titler, kompakte etiketter). */
export function formatDayMonth(iso: string, locale = currentLocale()): string {
  const d = safeDate(iso);
  if (!d) return "";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(d);
}

export function formatDateLong(iso: string, locale = currentLocale()): string {
  const d = safeDate(iso);
  if (!d) return "";
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(iso: string, locale = currentLocale()): string {
  const d = safeDate(iso);
  if (!d) return "";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hu = pick({ nb: "t", en: "h", sv: "h", da: "t", de: "Std." });
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} ${hu}`;
  return `${h} ${hu} ${m} min`;
}

/** mm:ss for nedtellinger. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function crossesMidnight(a: string, b: string): number {
  // Compare the wall-date portion of each ISO string. Works for naive
  // airport-local strings (demo) and offset strings (Duffel) alike,
  // independent of the viewer's timezone.
  const dayA = Date.parse(`${a.slice(0, 10)}T00:00:00Z`);
  const dayB = Date.parse(`${b.slice(0, 10)}T00:00:00Z`);
  return Math.round((dayB - dayA) / 86_400_000);
}

/**
 * Kalenderdatoen «YYYY-MM-DD» slik den ser ut på flyplassen.
 *
 * Mellomlandinger måles i flyplassens egen tidssone: en overnatting er en
 * overnatting der man faktisk står. Intl gjør dette selv, så vi trenger ikke
 * et tidssonebibliotek i bunten på hver eneste side. En ukjent sone faller
 * tilbake på UTC i stedet for å kaste.
 */
function localDay(ms: number, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(ms);
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

/**
 * Mellomlanding: varighet og om den krysser lokal midnatt – beregnet i
 * flyplassens tidssone når den er kjent (Duffel `time_zone`).
 */
export function layoverInfo(
  arrivingAt: string,
  nextDepartingAt: string,
  timeZone?: string,
): { minutes: number; overnight: boolean; long: boolean } {
  const arr = Date.parse(arrivingAt);
  const dep = Date.parse(nextDepartingAt);
  const valid = Number.isFinite(arr) && Number.isFinite(dep);
  const minutes = valid ? Math.max(0, Math.round((dep - arr) / 60_000)) : 0;
  const a = valid ? localDay(arr, timeZone) : arrivingAt.slice(0, 10);
  const b = valid ? localDay(dep, timeZone) : nextDepartingAt.slice(0, 10);
  const sameDay = a === b;
  return { minutes, overnight: minutes > 6 * 60 && !sameDay, long: minutes > 4 * 60 };
}

// ─── Etiketter ──────────────────────────────────────────────────────────────
// nb-tabellene beholdes for admin/eldre kode; kundesider bruker de
// språkbevisste funksjonene (cabinLabel, paxLabel …) under.

export const CABIN_LABELS: Record<string, string> = {
  economy: "Økonomi",
  premium_economy: "Premium økonomi",
  business: "Business",
  first: "Første klasse",
};

const CABIN_EN: Record<string, string> = { economy: "Economy", premium_economy: "Premium economy", business: "Business", first: "First class" };

export function cabinLabel(cabin: string): string {
  return pick({ nb: CABIN_LABELS[cabin] ?? cabin, en: CABIN_EN[cabin] ?? cabin });
}

export const PAX_LABELS: Record<string, string> = {
  adult: "Voksen",
  child: "Barn",
  infant_without_seat: "Baby",
};

const PAX_EN: Record<string, string> = { adult: "Adult", child: "Child", infant_without_seat: "Infant" };

export function paxLabel(type: string): string {
  return pick({ nb: PAX_LABELS[type] ?? type, en: PAX_EN[type] ?? type });
}

export const STATUS_LABELS: Record<string, string> = {
  scheduled: "Planlagt",
  boarding: "Ombordstigning",
  departed: "Avgått",
  in_air: "I luften",
  landed: "Landet",
  delayed: "Forsinket",
  cancelled: "Kansellert",
};

const TOPIC_LABELS: Record<string, string> = {
  booking: "Bestilling",
  change: "Endring av reise",
  refund: "Refusjon",
  baggage: "Bagasje",
  other: "Annet",
};

const TOPIC_EN: Record<string, string> = { booking: "Booking", change: "Change of trip", refund: "Refund", baggage: "Baggage", other: "Other" };

export function topicLabel(topic: string): string {
  return pick({ nb: TOPIC_LABELS[topic] ?? topic, en: TOPIC_EN[topic] ?? topic });
}

/** Kundevennlige etiketter for bestillingsstatus (api/lib/statemachine.ts). */
const BOOKING_STATE_LABELS: Record<string, string> = {
  DRAFT: "Utkast",
  QUOTE_SENT: "Tilbud sendt",
  AWAITING_PAYMENT: "Venter på betaling",
  PAYMENT_AUTHORIZED: "Betaling reservert",
  BOOKING_PROCESSING: "Venter på flyselskapets bekreftelse",
  AWAITING_RECONCILIATION: "Venter på flyselskapets bekreftelse",
  CONFIRMED: "Bekreftet",
  REVIEW: "Under kontroll",
  BOOKING_FAILED: "Bestillingen gikk ikke gjennom",
  CHANGE_REQUESTED: "Endring bestilt",
  CANCELLATION_REQUESTED: "Kansellering pågår",
  REFUND_PENDING: "Refusjon pågår",
  CANCELLED: "Kansellert",
  PARTIALLY_REFUNDED: "Delvis refundert",
  REFUNDED: "Refundert",
  TRAVELLED: "Reisen er gjennomført",
  EXPIRED: "Utløpt",
};

const BOOKING_STATE_EN: Record<string, string> = {
  DRAFT: "Draft",
  QUOTE_SENT: "Quote sent",
  AWAITING_PAYMENT: "Awaiting payment",
  PAYMENT_AUTHORIZED: "Payment reserved",
  BOOKING_PROCESSING: "Waiting for airline confirmation",
  AWAITING_RECONCILIATION: "Waiting for airline confirmation",
  CONFIRMED: "Confirmed",
  REVIEW: "Under review",
  BOOKING_FAILED: "Booking failed",
  CHANGE_REQUESTED: "Change requested",
  CANCELLATION_REQUESTED: "Cancellation in progress",
  REFUND_PENDING: "Refund in progress",
  CANCELLED: "Cancelled",
  PARTIALLY_REFUNDED: "Partially refunded",
  REFUNDED: "Refunded",
  TRAVELLED: "Trip completed",
  EXPIRED: "Expired",
};

export function bookingStateLabel(state: string): string {
  return pick({ nb: BOOKING_STATE_LABELS[state] ?? state, en: BOOKING_STATE_EN[state] ?? state });
}

/** Etikett for billettvilkår med gebyrbeløp. */
export function fareConditionLabel(
  kind: "refund" | "change",
  cond: { allowed: boolean; penaltyAmount?: string | null; penaltyCurrency?: string | null } | undefined,
  fallbackAllowed: boolean,
): string {
  const allowed = cond?.allowed ?? fallbackAllowed;
  const verb = kind === "refund" ? pick({ nb: "Refunderbar", en: "Refundable" }) : pick({ nb: "Kan endres", en: "Changeable" });
  if (!allowed) return kind === "refund" ? pick({ nb: "Ikke refunderbar", en: "Non-refundable" }) : pick({ nb: "Kan ikke endres", en: "Cannot be changed" });
  const pen = cond?.penaltyAmount ? Number(cond.penaltyAmount) : 0;
  if (pen > 0) return `${verb} ${pick({ nb: "mot gebyr", en: "for a fee of" })} ${formatPrice(cond!.penaltyAmount!, cond?.penaltyCurrency ?? "NOK")}`;
  return kind === "refund" ? pick({ nb: "Refunderbar", en: "Refundable" }) : pick({ nb: "Kan endres uten gebyr", en: "Changeable free of charge" });
}
