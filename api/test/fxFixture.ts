/**
 * SDMX-JSON i formen Norges Bank leverer for
 * /api/data/EXR/B..NOK.SP?format=sdmx-json&lastNObservations=1 (SDMX-JSON 1.0):
 * seriedimensjoner FREQ, BASE_CUR, QUOTE_CUR, TENOR; serieattributter
 * DECIMALS, CALCULATED, UNIT_MULT, COLLECTION. UNIT_MULT «2» = kurs per 100.
 *
 * Kursene er testverdier, ikke ekte kurser.
 */
export type FixtureRate = { currency: string; rate: string | null; unitMult: 0 | 2 | null; date?: string };

export function norgesBankFixture(rates: FixtureRate[], defaultDate: string): unknown {
  const dates = [...new Set(rates.map((r) => r.date ?? defaultDate))].sort();
  const series: Record<string, unknown> = {};
  rates.forEach((r, i) => {
    const dateIdx = dates.indexOf(r.date ?? defaultDate);
    series[`0:${i}:0:0`] = {
      // [DECIMALS, CALCULATED, UNIT_MULT, COLLECTION] – indekser inn i attributtverdiene
      attributes: [0, 0, r.unitMult === null ? null : r.unitMult === 0 ? 0 : 1, 0],
      observations: r.rate === null ? {} : { [String(dateIdx)]: [r.rate] },
    };
  });
  return {
    meta: { id: "IREF-TEST", prepared: `${defaultDate}T16:05:00`, test: true },
    data: {
      dataSets: [{ action: "Replace", series }],
      structure: {
        name: "Exchange rates",
        dimensions: {
          dataset: [],
          series: [
            { id: "FREQ", name: "Frequency", values: [{ id: "B", name: "Business" }] },
            { id: "BASE_CUR", name: "Base Currency", values: rates.map((r) => ({ id: r.currency, name: r.currency })) },
            { id: "QUOTE_CUR", name: "Quote Currency", values: [{ id: "NOK", name: "Norwegian krone" }] },
            { id: "TENOR", name: "Tenor", values: [{ id: "SP", name: "Spot" }] },
          ],
          observation: [{ id: "TIME_PERIOD", name: "Time Period", role: "time", values: dates.map((d) => ({ id: d, name: d, start: `${d}T00:00:00`, end: `${d}T23:59:59` })) }],
        },
        attributes: {
          dataset: [],
          series: [
            { id: "DECIMALS", name: "Decimals", values: [{ id: "4", name: "Four" }] },
            { id: "CALCULATED", name: "Calculated", values: [{ id: "false", name: "false" }] },
            { id: "UNIT_MULT", name: "Unit Multiplier", values: [{ id: "0", name: "Units" }, { id: "2", name: "Hundreds" }] },
            { id: "COLLECTION", name: "Collection Indicator", values: [{ id: "C", name: "ECB concertation time 14:15 CET" }] },
          ],
          observation: [],
        },
      },
    },
  };
}

/** Testkurser: EUR/USD per 1, SEK/JPY per 100. */
export const TEST_RATES: FixtureRate[] = [
  { currency: "EUR", rate: "11.6420", unitMult: 0 },
  { currency: "USD", rate: "10.0510", unitMult: 0 },
  { currency: "SEK", rate: "96.10", unitMult: 2 },
  { currency: "JPY", rate: "6.8123", unitMult: 2 },
];
