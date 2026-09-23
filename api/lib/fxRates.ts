import { currencyExponent, toMinor } from "./money";
import { log } from "./logger";
import { NORGES_BANK_SOURCE, type NokPrice, type NokRateInfo } from "../../contracts/mobileSearch";

/**
 * Valutakurser til NOK fra Norges Bank (åpne data, SDMX-JSON).
 *
 * Kilde: https://data.norges-bank.no/api/data/EXR/B..NOK.SP – daglige
 * indikative midtkurser («spot»), publisert virkedager. Beskrevet på
 * https://www.norges-bank.no/en/topics/Statistics/exchange_rates/ og
 * https://www.norges-bank.no/en/topics/Statistics/open-data/guide-data-warehouse/.
 *
 * Regler:
 *  - Enhetsmultiplikatoren leses fra UNIT_MULT per serie (0 → per 1, 2 → per
 *    100). Mangler den, brukes ikke kursen – vi antar aldri «per 1».
 *  - Ingen kurs dikes opp: mangler valutaen, er kursen for gammel, eller kan
 *    den ikke hentes, blir NOK-prisen «unavailable» med grunn.
 *  - Omregning skjer med heltall (BigInt), ikke flyttall.
 */

export const NORGES_BANK_EXR_URL = "https://data.norges-bank.no/api/data/EXR/B..NOK.SP?format=sdmx-json&lastNObservations=1&locale=en";

/**
 * Hvor gammel en kurs kan være (kalenderdager, Oslo-dato) før den ikke brukes.
 * Norges Bank publiserer ikke i helger og på helligdager; lengste vanlige hull
 * er påsken (onsdag → tirsdag = 6 dager). 7 dekker det med litt margin.
 */
export const MAX_RATE_AGE_DAYS = 7;
/** Hvor lenge en vellykket henting gjenbrukes før vi spør igjen. */
export const REFRESH_MS = 60 * 60_000;
/** Etter en feilet henting: vent så lenge før neste forsøk (den gamle tabellen brukes imens, hvis fersk nok). */
export const RETRY_AFTER_FAILURE_MS = 5 * 60_000;
const FETCH_TIMEOUT_MS = 4_000;

export type ParsedRate = {
  currency: string;
  /** Kursen slik den ble publisert (desimalstreng), for `unitMultiplier`-enheter. */
  publishedRate: string;
  /** 10-eksponent fra UNIT_MULT: 0 = per 1 enhet, 2 = per 100 enheter. */
  unitMultiplier: number;
  /** YYYY-MM-DD */
  rateDate: string;
};

export type FxTable = { rates: Map<string, ParsedRate>; fetchedAt: Date };

// ─── SDMX-JSON ───────────────────────────────────────────────────────────────

type SdmxValue = { id?: string; name?: string } | null;
type SdmxComponent = { id?: string; values?: SdmxValue[] };

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

const RATE_RE = /^\d+(?:[.,]\d+)?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Plukk ut nyeste kurs per valuta fra et SDMX-JSON-svar fra Norges Bank.
 * Tåler både `{ data: { dataSets, structure } }` (SDMX-JSON 1.0) og
 * `{ dataSets, structure }`. Serier uten gyldig kurs, dato eller UNIT_MULT hoppes over.
 */
export function parseNorgesBankSdmx(json: unknown): Map<string, ParsedRate> {
  const root = (json ?? {}) as Record<string, unknown>;
  const data = ((root.data as Record<string, unknown>) ?? root) as Record<string, unknown>;
  const structure = (data.structure ?? root.structure ?? {}) as Record<string, unknown>;
  const dimensions = (structure.dimensions ?? {}) as Record<string, unknown>;
  const seriesDims = asArray<SdmxComponent>(dimensions.series);
  const obsDims = asArray<SdmxComponent>(dimensions.observation);
  const attributes = (structure.attributes ?? {}) as Record<string, unknown>;
  const seriesAttrs = asArray<SdmxComponent>(attributes.series);
  const obsAttrs = asArray<SdmxComponent>(attributes.observation);

  const baseIdx = seriesDims.findIndex((d) => d.id === "BASE_CUR");
  const quoteIdx = seriesDims.findIndex((d) => d.id === "QUOTE_CUR");
  const timeDim = obsDims.find((d) => d.id === "TIME_PERIOD") ?? obsDims[0];
  const seriesUnitIdx = seriesAttrs.findIndex((a) => a.id === "UNIT_MULT");
  const obsUnitIdx = obsAttrs.findIndex((a) => a.id === "UNIT_MULT");
  if (baseIdx < 0 || !timeDim) return new Map();

  const dataSet = asArray<Record<string, unknown>>(data.dataSets ?? root.dataSets)[0] ?? {};
  const series = (dataSet.series ?? {}) as Record<string, { attributes?: (number | null)[]; observations?: Record<string, unknown[]> }>;

  const unitFrom = (component: SdmxComponent | undefined, index: number | null | undefined): number | null => {
    if (!component || index == null) return null;
    const id = component.values?.[index]?.id;
    if (id == null || !/^\d+$/.test(id)) return null;
    return Number(id);
  };

  const out = new Map<string, ParsedRate>();
  for (const [key, s] of Object.entries(series)) {
    const parts = key.split(":").map(Number);
    const currency = seriesDims[baseIdx]?.values?.[parts[baseIdx]]?.id?.toUpperCase();
    if (!currency || !/^[A-Z]{3}$/.test(currency)) continue;
    if (quoteIdx >= 0 && seriesDims[quoteIdx]?.values?.[parts[quoteIdx]]?.id?.toUpperCase() !== "NOK") continue;

    // Nyeste observasjon med en gyldig verdi.
    let best: ParsedRate | null = null;
    for (const [obsKey, obs] of Object.entries(s.observations ?? {})) {
      const rateDate = timeDim.values?.[Number(obsKey)]?.id;
      const raw = obs?.[0];
      const published = raw == null ? "" : String(raw).trim();
      if (!rateDate || !DATE_RE.test(rateDate) || !RATE_RE.test(published)) continue;
      if (Number(published.replace(",", ".")) <= 0) continue;
      // UNIT_MULT: på serien (vanlig) eller på observasjonen. Uten den: ingen kurs.
      const unit =
        unitFrom(seriesAttrs[seriesUnitIdx], seriesUnitIdx >= 0 ? s.attributes?.[seriesUnitIdx] : null) ??
        unitFrom(obsAttrs[obsUnitIdx], obsUnitIdx >= 0 ? (obs[1 + obsUnitIdx] as number | null) : null);
      if (unit == null) continue;
      if (!best || rateDate > best.rateDate) best = { currency, publishedRate: published.replace(",", "."), unitMultiplier: unit, rateDate };
    }
    if (best) out.set(currency, best);
  }
  return out;
}

// ─── Henting og cache ───────────────────────────────────────────────────────

type Fetcher = () => Promise<unknown>;

async function fetchFromNorgesBank(): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(NORGES_BANK_EXR_URL, { headers: { accept: "application/vnd.sdmx.data+json, application/json" }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Norges Bank svarte ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

let fetcher: Fetcher = fetchFromNorgesBank;
let cached: FxTable | null = null;
let nextAttemptAt = 0;
let inFlight: Promise<FxTable | null> | null = null;

/** Kun for tester: bytt ut hentingen (null = ekte Norges Bank). */
export function setFxFetcher(f: Fetcher | null): void {
  fetcher = f ?? fetchFromNorgesBank;
}

/** Kun for tester: tøm cache og ventetid. */
export function resetFxCache(): void {
  cached = null;
  nextAttemptAt = 0;
  inFlight = null;
}

/**
 * Kurstabellen. Hentes på nytt hver time; feiler hentingen, brukes forrige
 * tabell (ferskheten sjekkes per kurs i convertToNok) og nytt forsøk tas
 * etter noen minutter. null = aldri hentet en brukbar tabell.
 */
export async function getNokRates(now: Date = new Date()): Promise<FxTable | null> {
  if (cached && now.getTime() - cached.fetchedAt.getTime() < REFRESH_MS) return cached;
  if (now.getTime() < nextAttemptAt) return cached;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const rates = parseNorgesBankSdmx(await fetcher());
      if (rates.size === 0) throw new Error("svaret inneholdt ingen brukbare kurser");
      cached = { rates, fetchedAt: now };
      nextAttemptAt = 0;
    } catch (err) {
      log.warn({ err: String(err) }, "valutakurser fra Norges Bank kunne ikke hentes");
      nextAttemptAt = now.getTime() + RETRY_AFTER_FAILURE_MS;
    } finally {
      inFlight = null;
    }
    return cached;
  })();
  return inFlight;
}

// ─── Ferskhet og omregning ──────────────────────────────────────────────────

/** Dagens dato i Oslo (YYYY-MM-DD). */
export function osloDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Kalenderdager fra kursdato til Oslo-dato i dag. Negativ = kursdato i framtiden. */
export function rateAgeDays(rateDate: string, now: Date): number {
  return Math.round((Date.parse(`${osloDate(now)}T00:00:00Z`) - Date.parse(`${rateDate}T00:00:00Z`)) / 86_400_000);
}

export function rateIsFresh(rate: ParsedRate, now: Date): boolean {
  const age = rateAgeDays(rate.rateDate, now);
  return age >= 0 && age <= MAX_RATE_AGE_DAYS;
}

function decimalToBigInt(value: string): { num: bigint; scale: number } {
  const [int, frac = ""] = value.split(".");
  return { num: BigInt(int + frac), scale: frac.length };
}

/**
 * Regn om et leverandørbeløp i minste enhet til hele kroner, avrundet
 * halvt opp. Returnerer øre (alltid et multiplum av 100).
 *
 * kroner = minor / 10^exp × kurs / 10^unitMultiplier
 */
export function convertMinorToNokKroner(supplierMinor: number, currency: string, rate: ParsedRate): number {
  if (!Number.isSafeInteger(supplierMinor) || supplierMinor < 0) throw new Error(`Ugyldig beløp: ${supplierMinor}`);
  const { num, scale } = decimalToBigInt(rate.publishedRate);
  const numerator = BigInt(supplierMinor) * num;
  const denominator = 10n ** BigInt(currencyExponent(currency) + scale + rate.unitMultiplier);
  const kroner = (2n * numerator + denominator) / (2n * denominator);
  return Number(kroner) * 100;
}

/**
 * NOK-prisen for et beløp i leverandørens valuta. Ekte NOK beholdes som det
 * er; alt annet regnes om med en fersk Norges Bank-kurs eller blir
 * «unavailable». Kaster aldri.
 */
export function convertToNok(amount: string, currency: string, table: FxTable | null, now: Date = new Date()): NokPrice {
  const cur = currency.trim().toUpperCase();
  let minor: number;
  try {
    minor = toMinor(amount, cur);
  } catch {
    return { kind: "unavailable", reason: "invalid_amount" };
  }
  if (minor < 0) return { kind: "unavailable", reason: "invalid_amount" };
  if (cur === "NOK") return { kind: "exact", currency: "NOK", amountMinor: minor, estimate: false };
  if (!table) return { kind: "unavailable", reason: "rate_unavailable" };
  const rate = table.rates.get(cur);
  if (!rate) return { kind: "unavailable", reason: "unsupported_currency" };
  if (!rateIsFresh(rate, now)) return { kind: "unavailable", reason: "rate_stale" };
  const info: NokRateInfo = {
    source: NORGES_BANK_SOURCE,
    baseCurrency: cur,
    rateDate: rate.rateDate,
    publishedRate: rate.publishedRate,
    quotedPerUnits: 10 ** rate.unitMultiplier,
    indicative: true,
  };
  return { kind: "converted", currency: "NOK", amountMinor: convertMinorToNokKroner(minor, cur, rate), estimate: true, roundedTo: "krone", rate: info };
}
