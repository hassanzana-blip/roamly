import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/stripe", () => import("./stripeMock"));
// Leverandørvalget byttes ut med en falsk leverandør, så testen styrer valuta og beløp.
// Alt annet (runFlightSearch-validering, rategrense, gebyr, omregning) er ekte.
vi.mock("../lib/flightProviders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/flightProviders")>()),
  getFlightProvider: vi.fn(),
}));

import { closeDb, expectAppCode, makeCtx, TOMORROW_PLUS, truncateAll } from "./setup";
import { createCallerFactory } from "../middleware";
import { appRouter } from "../router";
import { mobileAppRouter } from "../mobileRouter";
import { mobileFlightsRouter } from "../mobileFlights";
import { getFlightProvider, type FlightProvider, type FlightSearchRequest } from "../lib/flightProviders";
import { demoSearch } from "../lib/demo";
import { computeServiceFeeMinor } from "../lib/pricing";
import { osloDate, resetFxCache, setFxFetcher } from "../lib/fxRates";
import { norgesBankFixture, TEST_RATES } from "./fxFixture";
import type { Offer, SearchResult } from "../../contracts/types";
import type { MobileSearchResult } from "../../contracts/mobileSearch";
import app from "../boot";

// ─── Appens NOK-søk ─────────────────────────────────────────────────────────

const web = createCallerFactory(appRouter);
const mobile = createCallerFactory(mobileAppRouter);

const DATE = TOMORROW_PLUS(30);
const INPUT = { slices: [{ origin: "OSL", destination: "BCN", departureDate: DATE }], passengers: [{ type: "adult" as const }], cabinClass: "economy" as const };

function mobileCtx() {
  const ctx = makeCtx({ url: "http://localhost:3000/api/mobile/trpc/flights.search" });
  ctx.req.headers.delete("origin");
  return ctx;
}

const base = (): Offer => demoSearch(INPUT).offers[0];
const external = (id: string, amount: string, currency: string, provider = "Norwegian"): Offer => ({
  ...base(),
  id,
  totalAmount: amount,
  totalCurrency: currency,
  source: "kayak",
  booking: { kind: "external", url: `https://www.kayak.no/book/${id}?a=1&b=2`, provider: { code: provider.slice(0, 2).toUpperCase(), name: provider }, sellerKind: "airline" },
});

/** Leverandørens svar: NOK (KAYAK), EUR (HelloSky-bestilling, med gebyr), USD, SEK (per 100) og THB (ingen kurs). */
function providerResult(): SearchResult {
  return {
    offerRequestId: "orq_test",
    liveMode: false,
    demoMode: false,
    cabinClass: "economy",
    slices: INPUT.slices,
    passengers: INPUT.passengers,
    provider: "kayak",
    sandbox: true,
    bookingMode: "external",
    offers: [
      external("nok_1", "2100.00", "NOK"),
      { ...base(), id: "eur_1", totalAmount: "100.00", totalCurrency: "EUR" },
      external("usd_1", "150.00", "USD", "Expedia"),
      external("sek_1", "1500.00", "SEK", "SAS"),
      external("thb_1", "3000.00", "THB", "Thai"),
    ],
  };
}

let requests: FlightSearchRequest[] = [];
function useProvider(result: SearchResult) {
  requests = [];
  const p: FlightProvider = {
    id: "kayak",
    liveMode: false,
    sandbox: true,
    bookingMode: "external",
    cacheable: false,
    search: async (req) => {
      requests.push(req);
      return structuredClone(result);
    },
  };
  vi.mocked(getFlightProvider).mockReturnValue(p);
}

const nok = (r: MobileSearchResult, id: string) => r.offers.find((o) => o.offer.id === id)!.price.nok;

describe("mobil flights.search: NOK-sammenligning", () => {
  beforeEach(async () => {
    await truncateAll();
    resetFxCache();
    setFxFetcher(async () => norgesBankFixture(TEST_RATES, osloDate(new Date())));
  });
  afterAll(async () => {
    setFxFetcher(null);
    await closeDb();
  });

  it("ekte NOK er eksakt; EUR/USD/SEK regnes om med kilde og dato; THB har ingen NOK-pris; sortert på NOK", async () => {
    const provided = providerResult();
    useProvider(provided);
    const res = await mobile(mobileCtx()).flights.search(INPUT);

    // Appen kan ikke velge valuta: leverandøren bes alltid om NOK (ekte NOK-priser fra metasøk).
    expect(requests[0].currency).toBe("NOK");

    expect(nok(res, "nok_1")).toEqual({ kind: "exact", currency: "NOK", amountMinor: 210000, estimate: false });
    // SEK per 100: 1500 × 96.10 / 100 = 1441.50 → 1442 kr
    expect(nok(res, "sek_1")).toMatchObject({ kind: "converted", amountMinor: 144200, estimate: true, rate: { baseCurrency: "SEK", publishedRate: "96.10", quotedPerUnits: 100, source: "norges-bank", indicative: true } });
    // USD: 150 × 10.0510 = 1507.65 → 1508 kr (eksternt tilbud: ingen servicegebyr)
    expect(nok(res, "usd_1")).toMatchObject({ kind: "converted", amountMinor: 150800, rate: { quotedPerUnits: 1 } });
    // EUR solgt av HelloSky: gebyret legges på i EUR (som på nettet), så regnes totalen om.
    const feeMinor = computeServiceFeeMinor(10000, "EUR");
    const eurTotal = (10000 + feeMinor) / 100;
    expect(nok(res, "eur_1")).toMatchObject({ kind: "converted", amountMinor: Math.round(eurTotal * 11.642) * 100 });
    expect(res.offers.find((o) => o.offer.id === "eur_1")!.price).toMatchObject({
      original: { amount: "100.00", currency: "EUR" },
      serviceFee: { amount: (feeMinor / 100).toFixed(2), currency: "EUR" },
      total: { amount: eurTotal.toFixed(2), currency: "EUR" },
    });
    expect(nok(res, "thb_1")).toEqual({ kind: "unavailable", reason: "unsupported_currency" });

    // Sortering: sammenlignbare stigende på NOK, THB til slutt.
    expect(res.offers.map((o) => o.offer.id)).toEqual(["sek_1", "usd_1", "eur_1", "nok_1", "thb_1"]);
    expect(res.offers.map((o) => o.comparable)).toEqual([true, true, true, true, false]);
    expect(res.fx).toEqual({ status: "ok", source: "norges-bank", rateDate: osloDate(new Date()), indicative: true });

    // Leverandørens tilbud er urørt: beløp, valuta og bestillingslenke.
    for (const original of provided.offers) {
      const got = res.offers.find((o) => o.offer.id === original.id)!;
      expect(got.offer).toEqual(original);
      expect(got.price.original).toEqual({ amount: original.totalAmount, currency: original.totalCurrency });
    }
    expect(res.offers.find((o) => o.offer.id === "usd_1")!.offer.booking?.url).toBe("https://www.kayak.no/book/usd_1?a=1&b=2");
    expect(res.offers.find((o) => o.offer.id === "usd_1")!.price.serviceFee).toBeNull();
  });

  it("kursene kan ikke hentes: utenlandske tilbud får ingen NOK-pris, NOK er uberørt", async () => {
    setFxFetcher(async () => {
      throw new Error("Norges Bank utilgjengelig");
    });
    useProvider(providerResult());
    const res = await mobile(mobileCtx()).flights.search(INPUT);
    expect(res.fx.status).toBe("unavailable");
    expect(res.fx.rateDate).toBeNull();
    expect(res.offers[0].offer.id).toBe("nok_1");
    expect(nok(res, "nok_1").kind).toBe("exact");
    for (const id of ["eur_1", "usd_1", "sek_1", "thb_1"]) {
      expect(nok(res, id)).toEqual({ kind: "unavailable", reason: "rate_unavailable" });
      expect(nok(res, id)).not.toHaveProperty("amountMinor");
    }
    // Uten NOK-pris: leverandørens rekkefølge etter de sammenlignbare.
    expect(res.offers.map((o) => o.offer.id)).toEqual(["nok_1", "eur_1", "usd_1", "sek_1", "thb_1"]);
  });

  it("for gammel kurs brukes ikke", async () => {
    const old = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
    setFxFetcher(async () => norgesBankFixture(TEST_RATES, old));
    useProvider(providerResult());
    const res = await mobile(mobileCtx()).flights.search(INPUT);
    expect(res.fx.status).toBe("stale");
    expect(nok(res, "eur_1")).toEqual({ kind: "unavailable", reason: "rate_stale" });
    expect(nok(res, "nok_1").kind).toBe("exact");
  });

  it("bare NOK-tilbud: ingen kurs hentes", async () => {
    const fetcher = vi.fn(async () => norgesBankFixture(TEST_RATES, osloDate(new Date())));
    setFxFetcher(fetcher);
    useProvider({ ...providerResult(), offers: [external("a", "900.00", "NOK"), external("b", "800.50", "NOK")] });
    const res = await mobile(mobileCtx()).flights.search(INPUT);
    expect(res.fx).toMatchObject({ status: "not_needed", rateDate: null });
    expect(res.offers.map((o) => [o.offer.id, o.price.nok])).toEqual([
      ["b", { kind: "exact", currency: "NOK", amountMinor: 80050, estimate: false }],
      ["a", { kind: "exact", currency: "NOK", amountMinor: 90000, estimate: false }],
    ]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("samme validering som nettet", async () => {
    useProvider(providerResult());
    await expectAppCode(mobile(mobileCtx()).flights.search({ ...INPUT, slices: [{ origin: "OSL", destination: "OSL", departureDate: DATE }] }), "VALIDATION");
    await expectAppCode(mobile(mobileCtx()).flights.search({ ...INPUT, slices: [{ origin: "OSL", destination: "BCN", departureDate: "2020-01-01" }] }), "VALIDATION");
  });
});

describe("nettets flights.search er uendret", () => {
  beforeEach(async () => {
    await truncateAll();
    resetFxCache();
    setFxFetcher(async () => norgesBankFixture(TEST_RATES, osloDate(new Date())));
  });
  afterAll(closeDb);

  it("returnerer leverandørens svar urørt, i leverandørens rekkefølge og valuta, uten NOK-felter", async () => {
    const provided = providerResult();
    useProvider(provided);
    const res = await web(makeCtx()).flights.search(INPUT);
    expect(res).toEqual(provided);
    expect(res.offers[0]).not.toHaveProperty("price");
    expect(res).not.toHaveProperty("fx");
    // Nettet sender valuta videre slik den ble valgt (her: ingen).
    expect(requests[0].currency).toBeUndefined();

    await web(makeCtx()).flights.search({ ...INPUT, currency: "EUR" });
    expect(requests.at(-1)!.currency).toBe("EUR");
  });

  it("over HTTP: appen kan ikke overstyre valutaen, og nettets søk finnes ikke på appens endepunkt", async () => {
    useProvider(providerResult());
    const res = await app.request("/api/mobile/trpc/flights.search", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "10.88.0.1" },
      body: JSON.stringify({ json: { ...INPUT, currency: "EUR" } }),
    });
    expect(res.status).toBe(200);
    expect(requests[0].currency).toBe("NOK");
    const body = (await res.json()) as { result: { data: { json: MobileSearchResult } } };
    expect(body.result.data.json.offers[0].price.nok.kind).not.toBe("unavailable");

    for (const path of ["flights.getOffer", "flights.status", "flights.priceHints", "flights.findBooking"]) {
      expect((await app.request(`/api/mobile/trpc/${path}`)).status, path).toBe(404);
    }
    expect(Object.keys(mobileFlightsRouter._def.record).sort()).toEqual(["airports", "search"]);
  });
});
