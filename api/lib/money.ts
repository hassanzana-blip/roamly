// Penger håndteres som heltall i minste enhet (øre/cent) + valutakode.
// Desimal-strenger brukes kun i grensesnitt mot Duffel/DB DECIMAL-kolonner.
// Ingen flyttall i beregninger.

/** Antall desimaler per valuta (ISO 4217). Ukjent → 2. */
const EXPONENTS: Record<string, number> = {
  JPY: 0, KRW: 0, ISK: 0, HUF: 2, CLP: 0, VND: 0, XOF: 0, XAF: 0,
  BHD: 3, KWD: 3, OMR: 3, JOD: 3, TND: 3,
};
export function currencyExponent(currency: string): number {
  return EXPONENTS[currency.toUpperCase()] ?? 2;
}

export type Money = { amountMinor: number; currency: string };

/** "1234.50" + "NOK" → 123450. Kaster ved ugyldig format. */
export function toMinor(amount: string, currency = "NOK"): number {
  const trimmed = String(amount).trim();
  const m = /^(-)?(\d+)(?:\.(\d{1,3}))?$/.exec(trimmed);
  if (!m) throw new Error(`Ugyldig beløp: ${amount}`);
  const exp = currencyExponent(currency);
  const frac = (m[3] ?? "").padEnd(exp, "0").slice(0, exp);
  const minor = Number(m[2]) * 10 ** exp + (exp > 0 ? Number(frac) : 0);
  if (!Number.isSafeInteger(minor)) throw new Error(`Beløp utenfor rekkevidde: ${amount}`);
  return m[1] ? -minor : minor;
}

/** 123450 + "NOK" → "1234.50" */
export function fromMinor(minor: number, currency = "NOK"): string {
  if (!Number.isInteger(minor)) throw new Error(`Ugyldig minor-beløp: ${minor}`);
  const exp = currencyExponent(currency);
  const negative = minor < 0;
  const abs = Math.abs(minor);
  if (exp === 0) return `${negative ? "-" : ""}${abs}`;
  const major = Math.floor(abs / 10 ** exp);
  const frac = String(abs % 10 ** exp).padStart(exp, "0");
  return `${negative ? "-" : ""}${major}.${frac}`;
}

export function addAmounts(...amounts: string[]): string {
  return fromMinor(amounts.reduce((sum, a) => sum + toMinor(a), 0));
}

export function multiplyAmount(amount: string, factor: number): string {
  if (!Number.isInteger(factor)) throw new Error("Faktor må være heltall");
  return fromMinor(toMinor(amount) * factor);
}

/** Prosent av minor-beløp, avrundet til nærmeste hele enhet (bankers ikke nødvendig her). */
export function percentOfMinor(minor: number, fraction: number): number {
  return Math.round(minor * fraction);
}

export function assertSameCurrency(a: string, b: string): void {
  if (a.toUpperCase() !== b.toUpperCase()) throw new Error(`Valuta-mismatch: ${a} vs ${b}`);
}

export function formatMoneyMinor(minor: number, currency: string, locale = "nb-NO"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: currencyExponent(currency) })
    .format(minor / 10 ** currencyExponent(currency));
}
