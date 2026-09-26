import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_RATE_AGE_DAYS,
  REFRESH_MS,
  RETRY_AFTER_FAILURE_MS,
  convertToNok,
  getNokRates,
  parseNorgesBankSdmx,
  rateAgeDays,
  resetFxCache,
  setFxFetcher,
  type FxTable,
} from "./fxRates";
import { norgesBankFixture, TEST_RATES } from "../test/fxFixture";

// Tirsdag 22. september 2026, 12:00 i Oslo.
const NOW = new Date("2026-09-22T10:00:00Z");
const TODAY = "2026-09-22";

function table(rates = TEST_RATES, date = TODAY): FxTable {
  return { rates: parseNorgesBankSdmx(norgesBankFixture(rates, date)), fetchedAt: NOW };
}

describe("parseNorgesBankSdmx", () => {
  it("leser kurs, dato og UNIT_MULT per valuta", () => {
    const rates = parseNorgesBankSdmx(norgesBankFixture(TEST_RATES, TODAY));
    expect(rates.get("EUR")).toEqual({ currency: "EUR", publishedRate: "11.6420", unitMultiplier: 0, rateDate: TODAY });
    expect(rates.get("SEK")).toEqual({ currency: "SEK", publishedRate: "96.10", unitMultiplier: 2, rateDate: TODAY });
    expect(rates.get("JPY")?.unitMultiplier).toBe(2);
  });

  it("antar aldri «per 1»: en serie uten UNIT_MULT brukes ikke", () => {
    const rates = parseNorgesBankSdmx(norgesBankFixture([{ currency: "GBP", rate: "13.40", unitMult: null }, ...TEST_RATES], TODAY));
    expect(rates.has("GBP")).toBe(false);
    expect(rates.has("EUR")).toBe(true);
  });

  it("velger nyeste observasjon og hopper over tomme/ugyldige verdier", () => {
    const json = norgesBankFixture(
      [
        { currency: "EUR", rate: "11.50", unitMult: 0, date: "2026-09-18" },
        { currency: "USD", rate: "NaN", unitMult: 0 },
        { currency: "DKK", rate: null, unitMult: 2 },
      ],
      TODAY,
    );
    // Legg til en nyere EUR-observasjon i samme serie.
    const d = json as { data: { dataSets: { series: Record<string, { observations: Record<string, unknown[]> }> }[]; structure: { dimensions: { observation: { values: { id: string }[] }[] } } } };
    const times = d.data.structure.dimensions.observation[0].values;
    times.push({ id: "2026-09-21" });
    d.data.dataSets[0].series["0:0:0:0"].observations[String(times.length - 1)] = ["11.60"];
    const rates = parseNorgesBankSdmx(json);
    expect(rates.get("EUR")).toMatchObject({ publishedRate: "11.60", rateDate: "2026-09-21" });
    expect(rates.has("USD")).toBe(false);
    expect(rates.has("DKK")).toBe(false);
  });

  it("tåler komma som desimaltegn (locale=no) og søppel", () => {
    expect(parseNorgesBankSdmx(norgesBankFixture([{ currency: "EUR", rate: "11,6420", unitMult: 0 }], TODAY)).get("EUR")?.publishedRate).toBe("11.6420");
    expect(parseNorgesBankSdmx(null).size).toBe(0);
    expect(parseNorgesBankSdmx({ data: {} }).size).toBe(0);
  });
});

describe("convertToNok", () => {
  const t = table();

  it("NOK er eksakt: leverandørens beløp i øre, ikke avrundet, ikke merket som anslag", () => {
    expect(convertToNok("1234.56", "NOK", null, NOW)).toEqual({ kind: "exact", currency: "NOK", amountMinor: 123456, estimate: false });
  });

  it("EUR og USD (per 1) regnes om og rundes til hele kroner", () => {
    // 100.00 EUR × 11.6420 = 1164.20 kr → 1164 kr
    expect(convertToNok("100.00", "EUR", t, NOW)).toMatchObject({ kind: "converted", amountMinor: 116400, estimate: true, roundedTo: "krone" });
    // 199.99 USD × 10.0510 = 2010.0995 kr → 2010 kr
    expect(convertToNok("199.99", "USD", t, NOW)).toMatchObject({ kind: "converted", amountMinor: 201000 });
  });

  it("SEK og JPY publiseres per 100 enheter – kursen deles på 100", () => {
    // 1000.00 SEK × 96.10 / 100 = 961.00 kr (ikke 96 100 kr)
    const sek = convertToNok("1000.00", "SEK", t, NOW);
    expect(sek).toMatchObject({ kind: "converted", amountMinor: 96100 });
    expect(sek.kind === "converted" && sek.rate).toEqual({ source: "norges-bank", baseCurrency: "SEK", rateDate: TODAY, publishedRate: "96.10", quotedPerUnits: 100, indicative: true });
    // JPY har 0 desimaler: 25 000 JPY × 6.8123 / 100 = 1703.075 kr → 1703 kr
    expect(convertToNok("25000", "JPY", t, NOW)).toMatchObject({ kind: "converted", amountMinor: 170300 });
  });

  it("avrunding: halvt opp til hele kroner, med heltallsregning", () => {
    const ten = table([{ currency: "EUR", rate: "10.0000", unitMult: 0 }]);
    expect(convertToNok("12.35", "EUR", ten, NOW)).toMatchObject({ amountMinor: 12400 }); // 123.50 → 124
    expect(convertToNok("12.34", "EUR", ten, NOW)).toMatchObject({ amountMinor: 12300 }); // 123.40 → 123
    expect(convertToNok("12.36", "EUR", ten, NOW)).toMatchObject({ amountMinor: 12400 }); // 123.60 → 124
    expect(convertToNok("0.01", "EUR", ten, NOW)).toMatchObject({ amountMinor: 0 }); // 0.10 → 0
    // Flyttall ville bomme her: 0.1 + 0.2-typen feil
    const odd = table([{ currency: "EUR", rate: "11.15", unitMult: 0 }]);
    expect(convertToNok("0.10", "EUR", odd, NOW)).toMatchObject({ amountMinor: 100 }); // 1.115 → 1
    expect(convertToNok("1234567.89", "EUR", odd, NOW)).toMatchObject({ amountMinor: 1376543200 }); // 13 765 431.9735 → 13 765 432
  });

  it("for store beløp gir ingen NOK-pris i stedet for et unøyaktig tall", () => {
    // 2^53 − 1 cent × 11.6420 overstiger 2^53 øre
    expect(convertToNok("90071992547409.91", "EUR", t, NOW)).toEqual({ kind: "unavailable", reason: "invalid_amount" });
    expect(convertToNok("99999999999999999999", "EUR", t, NOW)).toEqual({ kind: "unavailable", reason: "invalid_amount" });
    // Stort, men trygt: eksakt heltallsresultat
    expect(convertToNok("1000000000.00", "EUR", t, NOW)).toMatchObject({ kind: "converted", amountMinor: 1164200000000 });
  });

  it("valuta uten kurs, ingen kurstabell og ugyldig beløp gir ingen NOK-pris", () => {
    expect(convertToNok("100.00", "THB", t, NOW)).toEqual({ kind: "unavailable", reason: "unsupported_currency" });
    expect(convertToNok("100.00", "EUR", null, NOW)).toEqual({ kind: "unavailable", reason: "rate_unavailable" });
    expect(convertToNok("abc", "EUR", t, NOW)).toEqual({ kind: "unavailable", reason: "invalid_amount" });
    expect(convertToNok("-5.00", "EUR", t, NOW)).toEqual({ kind: "unavailable", reason: "invalid_amount" });
  });

  it("ferskhet: helg og høytid er ok, eldre enn grensen og framtidig dato er ikke", () => {
    // Fredagskurs brukt mandag ettermiddag (Oslo)
    const monday = new Date("2026-09-21T14:00:00Z");
    expect(convertToNok("100.00", "EUR", table(TEST_RATES, "2026-09-18"), monday)).toMatchObject({ kind: "converted", rate: { rateDate: "2026-09-18" } });
    // Påske: onsdag → tirsdag = 6 dager
    expect(convertToNok("100.00", "EUR", table(TEST_RATES, "2026-04-01"), new Date("2026-04-07T06:00:00Z")).kind).toBe("converted");
    // Akkurat på grensen og én dag over
    const edge = new Date(Date.parse(`${TODAY}T10:00:00Z`) - MAX_RATE_AGE_DAYS * 86_400_000).toISOString().slice(0, 10);
    expect(convertToNok("100.00", "EUR", table(TEST_RATES, edge), NOW).kind).toBe("converted");
    const over = new Date(Date.parse(`${TODAY}T10:00:00Z`) - (MAX_RATE_AGE_DAYS + 1) * 86_400_000).toISOString().slice(0, 10);
    expect(convertToNok("100.00", "EUR", table(TEST_RATES, over), NOW)).toEqual({ kind: "unavailable", reason: "rate_stale" });
    expect(convertToNok("100.00", "EUR", table(TEST_RATES, "2026-09-25"), NOW)).toEqual({ kind: "unavailable", reason: "rate_stale" });
    // NOK trenger aldri kurs
    expect(convertToNok("100.00", "NOK", table(TEST_RATES, over), NOW).kind).toBe("exact");
  });

  it("Oslo-dato, ikke UTC: kl. 23:30 UTC 21. sept. er 22. sept. i Oslo", () => {
    expect(rateAgeDays("2026-09-22", new Date("2026-09-21T23:30:00Z"))).toBe(0);
  });
});

describe("getNokRates: henting, cache og feil", () => {
  beforeEach(() => {
    resetFxCache();
    setFxFetcher(null);
  });

  it("feil ved første henting gir null (ingen oppdiktet tabell) og ventetid før nytt forsøk", async () => {
    const f = vi.fn().mockRejectedValue(new Error("nede"));
    setFxFetcher(f);
    expect(await getNokRates(NOW)).toBeNull();
    expect(await getNokRates(new Date(NOW.getTime() + 60_000))).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
    f.mockResolvedValue(norgesBankFixture(TEST_RATES, TODAY));
    expect((await getNokRates(new Date(NOW.getTime() + RETRY_AFTER_FAILURE_MS + 1)))?.rates.has("EUR")).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("gjenbruker tabellen i en time; feiler neste henting, beholdes den gamle", async () => {
    const f = vi.fn().mockResolvedValue(norgesBankFixture(TEST_RATES, TODAY));
    setFxFetcher(f);
    const first = await getNokRates(NOW);
    expect(await getNokRates(new Date(NOW.getTime() + REFRESH_MS - 1))).toBe(first);
    expect(f).toHaveBeenCalledTimes(1);
    f.mockRejectedValue(new Error("tidsavbrudd"));
    expect(await getNokRates(new Date(NOW.getTime() + REFRESH_MS + 1))).toBe(first);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("et svar uten brukbare kurser regnes som feil", async () => {
    setFxFetcher(async () => ({ data: { dataSets: [], structure: {} } }));
    expect(await getNokRates(NOW)).toBeNull();
  });

  it("samtidige kall deler én henting", async () => {
    const f = vi.fn().mockResolvedValue(norgesBankFixture(TEST_RATES, TODAY));
    setFxFetcher(f);
    await Promise.all([getNokRates(NOW), getNokRates(NOW), getNokRates(NOW)]);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
