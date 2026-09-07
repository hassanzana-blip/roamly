// HelloSky servicegebyr — én kilde til sannhet for all prissetting.
// Regel: SERVICE_FEE_PERCENT (standard 8 %) av leverandørprisen + fast gebyr
// per valuta. ALLE beregninger i minste enhet (øre/cent); prosentdelen rundes
// til nærmeste hele hovedenhet for pene kvitteringer.

import { eq } from "drizzle-orm";
import { env } from "./env";
import { addAmounts, currencyExponent, fromMinor, toMinor } from "./money";
import type { PriceBreakdownMinor } from "../../contracts/types";

export const SERVICE_FEE_PERCENT = env.SERVICE_FEE_PERCENT;
/** Fast gebyr i minste enhet per valuta (≈ 250 NOK). Ukjent valuta → EUR. */
export const FLAT_FEE_BY_CURRENCY: Record<string, number> = {
  NOK: 25000,
  SEK: 25000,
  DKK: 17500,
  EUR: 2300,
  GBP: 2000,
  USD: 2500,
};
/** Beholdes for eldre kallere (NOK). */
export const SERVICE_FEE_FLAT = fromMinor(FLAT_FEE_BY_CURRENCY.NOK, "NOK");

export type PricingOverrides = {
  /** Prosentandel som brøk (0.08 = 8 %). */
  percent?: number;
  /** Fast gebyr i minste enhet per valuta. */
  flatByCurrency?: Record<string, number>;
};

export function flatFeeMinorFor(currency: string, overrides?: PricingOverrides): number {
  const table = { ...FLAT_FEE_BY_CURRENCY, ...(overrides?.flatByCurrency ?? {}) };
  const c = currency.toUpperCase();
  return table[c] ?? table.EUR;
}

/**
 * Servicegebyr i minste enhet: prosentdel (rundet til hel hovedenhet) + fast del.
 * Deterministisk og ren — brukes både i checkout og på kvittering.
 */
export function computeServiceFeeMinor(supplierMinor: number, currency: string, overrides?: PricingOverrides): number {
  if (!Number.isInteger(supplierMinor) || supplierMinor < 0) {
    throw new Error(`Ugyldig leverandørbeløp (minor): ${supplierMinor}`);
  }
  const pct = overrides?.percent ?? SERVICE_FEE_PERCENT;
  if (!(pct >= 0 && pct <= 1)) throw new Error(`Ugyldig gebyrprosent: ${pct}`);
  const unit = 10 ** currencyExponent(currency);
  const percentMinor = Math.round((supplierMinor * pct) / unit) * unit;
  return percentMinor + flatFeeMinorFor(currency, overrides);
}

export function buildBreakdown(input: {
  supplierMinor: number;
  servicesMinor: number;
  bonusUsedMinor: number;
  currency: string;
  overrides?: PricingOverrides;
}): PriceBreakdownMinor {
  const { supplierMinor, servicesMinor, bonusUsedMinor } = input;
  for (const [k, v] of Object.entries({ supplierMinor, servicesMinor, bonusUsedMinor })) {
    if (!Number.isInteger(v) || v < 0) throw new Error(`Ugyldig beløp for ${k}: ${v}`);
  }
  const currency = input.currency.toUpperCase();
  const serviceFeeAmountMinor = computeServiceFeeMinor(supplierMinor, currency, input.overrides);
  const gross = supplierMinor + servicesMinor + serviceFeeAmountMinor;
  if (bonusUsedMinor > gross) throw new Error("Bonus kan ikke overstige totalbeløpet");
  return {
    currency,
    supplierAmountMinor: supplierMinor,
    servicesAmountMinor: servicesMinor,
    serviceFeeAmountMinor,
    bonusUsedMinor,
    totalAmountMinor: gross - bonusUsedMinor,
  };
}

// ─── Eldre grensesnitt (desimal-strenger, NOK) ──────────────────────────────

export interface PriceBreakdown {
  baseAmount: string;
  percentPart: string;
  flatPart: string;
  serviceFeeAmount: string;
  totalAmount: string;
}

/** Legacy: "1000.00" → 8 % + 250 kr (NOK). Implementert via computeServiceFeeMinor. */
export function priceWithServiceFee(baseAmount: string, currency = "NOK"): PriceBreakdown {
  const base = toMinor(baseAmount, currency);
  const fee = computeServiceFeeMinor(base, currency);
  const flat = flatFeeMinorFor(currency);
  const percentPart = fromMinor(fee - flat, currency);
  const flatPart = fromMinor(flat, currency);
  const serviceFeeAmount = fromMinor(fee, currency);
  return {
    baseAmount: fromMinor(base, currency),
    percentPart,
    flatPart,
    serviceFeeAmount,
    totalAmount: addAmounts(fromMinor(base, currency), serviceFeeAmount),
  };
}

// ─── Innstillinger (settings-tabellen) ──────────────────────────────────────
// Nøkler: refund.service_fee_policy ("keep"|"refund"), booking.instant_enabled
// (boolean-overstyring), markup.percent (brøk), markup.flat_minor_by_currency.

export const SETTING_KEYS = [
  "refund.service_fee_policy",
  "booking.instant_enabled",
  "markup.percent",
  "markup.flat_minor_by_currency",
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export async function getSetting<T>(key: SettingKey, fallback: T): Promise<T> {
  try {
    const { getDb } = await import("../queries/connection");
    const { settings } = await import("../../db/schema");
    const [row] = await getDb().select().from(settings).where(eq(settings.key, key)).limit(1);
    if (!row) return fallback;
    return JSON.parse(row.valueJson) as T;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: SettingKey, value: unknown, staffId: number | null): Promise<void> {
  const { getDb } = await import("../queries/connection");
  const { settings } = await import("../../db/schema");
  const valueJson = JSON.stringify(value);
  await getDb()
    .insert(settings)
    .values({ key, valueJson, updatedById: staffId })
    .onDuplicateKeyUpdate({ set: { valueJson, updatedById: staffId } });
}

/** Overstyringer fra admin (markup.*) — tomme når ingenting er satt. */
export async function loadPricingOverrides(): Promise<PricingOverrides> {
  const percent = await getSetting<number | null>("markup.percent", null);
  const flat = await getSetting<Record<string, number> | null>("markup.flat_minor_by_currency", null);
  const out: PricingOverrides = {};
  if (typeof percent === "number" && percent >= 0 && percent <= 1) out.percent = percent;
  if (flat && typeof flat === "object") {
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(flat)) {
      if (/^[A-Z]{3}$/.test(k) && Number.isInteger(v) && v >= 0) clean[k] = v;
    }
    if (Object.keys(clean).length) out.flatByCurrency = clean;
  }
  return out;
}

/** Effektiv direktebooking-status: miljøflagg AND evt. admin-overstyring. */
export async function instantBookingEnabled(): Promise<boolean> {
  if (!env.instantBookingEnabled) return false;
  const override = await getSetting<boolean | null>("booking.instant_enabled", null);
  return override === null ? true : Boolean(override);
}
