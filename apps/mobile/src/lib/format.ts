/**
 * Norsk formatering uten flyttall og uten å stole på enhetens Intl-data.
 * Kroner vises alltid med «kr»; andre valutaer alltid med valutakoden – et
 * utenlandsk beløp kan aldri se ut som kroner.
 */

const NBSP = " ";

function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** 123450 → «1 234,50 kr»; 123400 → «1 234 kr». */
export function formatNok(amountMinor: number): string {
  const negative = amountMinor < 0;
  const abs = Math.abs(Math.trunc(amountMinor));
  const kroner = Math.floor(abs / 100);
  const ore = abs % 100;
  return `${negative ? "−" : ""}${group(String(kroner))}${ore ? `,${String(ore).padStart(2, "0")}` : ""}${NBSP}kr`;
}

/** Leverandørens desimalstreng i sin valuta: («131.00», «EUR») → «131,00 EUR». Aldri «kr». */
export function formatForeign(amount: string, currency: string): string {
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  const code = currency.trim().toUpperCase();
  if (!m) return `${amount.trim()}${NBSP}${code}`;
  return `${m[1] ? "−" : ""}${group(m[2]!)}${m[3] ? `,${m[3]}` : ""}${NBSP}${code}`;
}

const WEEKDAYS = ["søn.", "man.", "tir.", "ons.", "tor.", "fre.", "lør."];
const MONTHS = ["jan.", "feb.", "mars", "apr.", "mai", "juni", "juli", "aug.", "sep.", "okt.", "nov.", "des."];

function parseIsoDate(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** «2026-10-23» → «fre. 23. okt.» */
export function formatDay(iso: string): string {
  const p = parseIsoDate(iso);
  if (!p) return "";
  const weekday = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  return `${WEEKDAYS[weekday]} ${p.d}. ${MONTHS[p.m - 1]}`;
}

/** «2026-09-22» → «22.09.2026» */
export function formatNumericDate(iso: string): string {
  const p = parseIsoDate(iso);
  if (!p) return "";
  return `${String(p.d).padStart(2, "0")}.${String(p.m).padStart(2, "0")}.${p.y}`;
}

/** Klokkeslett slik leverandøren oppga det (lokal tid på flyplassen): «2026-10-23T07:05:00» → «07:05». */
export function formatTime(isoDateTime: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(isoDateTime);
  return m ? `${m[1]}:${m[2]}` : "";
}

/** 155 → «2 t 35 min» */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m ? `${h} t ${m} min` : `${h} t`;
}

export function formatStops(stops: number): string {
  if (stops <= 0) return "Direkte";
  return stops === 1 ? "1 stopp" : `${stops} stopp`;
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
