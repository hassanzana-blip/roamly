import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/stripe", () => import("./stripeMock"));
// Leverandørvalget byttes ut med en falsk leverandør, så testen styrer valuta og beløp.
// Alt annet (runFlightSearch-validering, rategrense, gebyr, omregning) er ekte.
vi.mock("../lib/flightProviders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/flightProviders")>()),
  getFlightProvider: vi.fn(),
}));

import { closeDb, expectAppCode, getDb, makeCtx, TOMORROW_PLUS, truncateAll } from "./setup";
import { providerClicks } from "../../db/schema";
import { flightsRouter, trackProviderClickProcedure } from "../flights";
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
    // EUR/USD/SEK omregnet, THB ikke: statusen sier «partial», ikke «ok».
    expect(res.fx).toEqual({ status: "partial", unconvertedCount: 1, source: "norges-bank", rateDate: osloDate(new Date()), indicative: true });

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
    expect(res.fx).toMatchObject({ status: "unavailable", unconvertedCount: 4, rateDate: null });
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
    expect(res.fx).toMatchObject({ status: "stale", unconvertedCount: 4 });
    expect(nok(res, "eur_1")).toEqual({ kind: "unavailable", reason: "rate_stale" });
    expect(nok(res, "nok_1").kind).toBe("exact");
  });

  it("bare NOK-tilbud: ingen kurs hentes", async () => {
    const fetcher = vi.fn(async () => norgesBankFixture(TEST_RATES, osloDate(new Date())));
    setFxFetcher(fetcher);
    useProvider({ ...providerResult(), offers: [external("a", "900.00", "NOK"), external("b", "800.50", "NOK")] });
    const res = await mobile(mobileCtx()).flights.search(INPUT);
    expect(res.fx).toMatchObject({ status: "not_needed", unconvertedCount: 0, rateDate: null });
    expect(res.offers.map((o) => [o.offer.id, o.price.nok])).toEqual([
      ["b", { kind: "exact", currency: "NOK", amountMinor: 80050, estimate: false }],
      ["a", { kind: "exact", currency: "NOK", amountMinor: 90000, estimate: false }],
    ]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("alle utenlandske tilbud omregnet: «ok»; bare valuta uten kurs: «unavailable», aldri «ok»", async () => {
    useProvider({ ...providerResult(), offers: [external("e", "100.00", "EUR"), external("n", "900.00", "NOK")] });
    expect((await mobile(mobileCtx()).flights.search(INPUT)).fx).toMatchObject({ status: "ok", unconvertedCount: 0 });
    useProvider({ ...providerResult(), offers: [external("t", "3000.00", "THB"), external("n", "900.00", "NOK")] });
    const onlyThb = await mobile(mobileCtx()).flights.search(INPUT);
    expect(onlyThb.fx).toMatchObject({ status: "unavailable", unconvertedCount: 1 });
    expect(onlyThb.offers.map((o) => o.offer.id)).toEqual(["n", "t"]);
  });

  it("enorme beløp velter ikke søket: tilbudet får ingen NOK-pris, resten er uberørt", async () => {
    const huge = "90071992547409.91"; // 2^53 − 1 i minste enhet
    useProvider({
      ...providerResult(),
      offers: [
        { ...base(), id: "nok_fee_overflow", totalAmount: huge, totalCurrency: "NOK" }, // + gebyr > 2^53
        external("eur_overflow", huge, "EUR"), // × 11.642 > 2^53 øre
        external("garbage", "1e309", "EUR"),
        external("ok", "100.00", "EUR"),
      ],
    });
    const res = await mobile(mobileCtx()).flights.search(INPUT);
    expect(res.offers.map((o) => o.offer.id)).toEqual(["ok", "nok_fee_overflow", "eur_overflow", "garbage"]);
    for (const id of ["nok_fee_overflow", "eur_overflow", "garbage"]) {
      expect(nok(res, id)).toEqual({ kind: "unavailable", reason: "invalid_amount" });
    }
    expect(res.offers.find((o) => o.offer.id === "eur_overflow")!.offer.totalAmount).toBe(huge);
    expect(res.fx).toMatchObject({ status: "partial", unconvertedCount: 2 });
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
    // Appens flyruter: søk, flyplassøk og nettets klikkmåling – ingen bestilling eller tilbudsoppslag.
    expect(Object.keys(mobileFlightsRouter._def.record).sort()).toEqual(["airports", "search", "trackProviderClick"]);
  });
});

describe("mobil flights.trackProviderClick: nettets klikkmåling, urørt", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("er nøyaktig nettets prosedyre, ikke en kopi", () => {
    expect(mobileFlightsRouter._def.record.trackProviderClick).toBe(trackProviderClickProcedure);
    expect(flightsRouter._def.record.trackProviderClick).toBe(trackProviderClickProcedure);
  });

  it("registrerer klikket ut fra tilbuds-id og søkeøkt alene – rute og pris slås opp på serveren", async () => {
    useProvider(providerResult());
    const offer = base(); // demotilbud, lagret på serveren av demoSearch
    const res = await mobile(mobileCtx()).flights.trackProviderClick({ offerId: offer.id, sessionId: "app-okt-1" });
    expect(res.clickRef).toMatch(/^[0-9a-f-]{36}$/);
    const rows = await getDb().select().from(providerClicks);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      clickRef: res.clickRef,
      sessionRef: "app-okt-1",
      customerId: null,
      originIata: offer.slices[0].origin.iata,
      destinationIata: offer.slices[0].destination.iata,
      sandbox: true,
    });
  });

  it("ukjent tilbud: ingen feil og ingen rad – lenken skal åpnes uansett", async () => {
    const res = await mobile(mobileCtx()).flights.trackProviderClick({ offerId: "finnes-ikke" });
    expect(res).toEqual({ clickRef: null });
    expect(await getDb().select().from(providerClicks)).toHaveLength(0);
  });

  it("KAYAK-tilbud fra et ekte søk måles – på appens og nettets endepunkt", async () => {
    // KAYAK-id-er (kyk_…) kan ikke slås opp hos leverandøren i etterkant, og
    // resolveOffer avviser dem med vilje (de bestilles aldri i vår checkout).
    // Klikket måles derfor mot tilbudet serveren selv returnerte i søket.
    const kayakId = "kyk_sok123.res9.0";
    const provided = { ...providerResult(), offers: [external(kayakId, "1234.50", "NOK", "Norwegian"), external("kyk_sok123.res9.1", "1500.00", "EUR", "Kiwi.com")] };
    useProvider(provided);
    await mobile(mobileCtx()).flights.search(INPUT);

    const app1 = await mobile(mobileCtx()).flights.trackProviderClick({ offerId: kayakId, sessionId: "app-okt-kayak" });
    expect(app1.clickRef).toMatch(/^[0-9a-f-]{36}$/);
    const [row] = await getDb().select().from(providerClicks);
    const offer = provided.offers[0];
    expect(row).toMatchObject({
      clickRef: app1.clickRef,
      provider: "kayak",
      sellerName: "Norwegian",
      sessionRef: "app-okt-kayak",
      originIata: offer.slices[0].origin.iata,
      destinationIata: offer.slices[0].destination.iata,
      departDate: offer.slices[0].departingAt.slice(0, 10),
      shownPriceMinor: 123450,
      currency: "NOK",
      sandbox: true,
    });

    // Samme prosedyre på nettet: tilbudet fra appens søk er også kjent der (samme server).
    const web1 = await web(makeCtx()).flights.trackProviderClick({ offerId: "kyk_sok123.res9.1" });
    expect(web1.clickRef).toMatch(/^[0-9a-f-]{36}$/);
    expect((await getDb().select().from(providerClicks)).map((r) => [r.sellerName, r.shownPriceMinor, r.currency])).toEqual([
      ["Norwegian", 123450, "NOK"],
      ["Kiwi.com", 150000, "EUR"],
    ]);

    // Nettets tilbudsoppslag og checkout avviser fortsatt KAYAK-tilbud.
    await expectAppCode(web(makeCtx()).flights.getOffer({ offerId: kayakId }), "SUPPLIER_REJECTED");
  });

  it("KAYAK-id som ikke kom fra et søk her: ingen rad – klienten kan ikke dikte opp rute eller pris", async () => {
    const res = await mobile(mobileCtx()).flights.trackProviderClick({ offerId: "kyk_oppdiktet.res1.0" });
    expect(res).toEqual({ clickRef: null });
    expect(await getDb().select().from(providerClicks)).toHaveLength(0);
  });

  it("over HTTP på appens endepunkt, uten token", async () => {
    useProvider(providerResult());
    const offer = base();
    const res = await app.request("/api/mobile/trpc/flights.trackProviderClick", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "10.88.0.2" },
      body: JSON.stringify({ json: { offerId: offer.id, sessionId: "app-okt-2" } }),
    });
    expect(res.status).toBe(200);
    const rows = await getDb().select().from(providerClicks);
    expect(rows.map((r) => r.sessionRef)).toEqual(["app-okt-2"]);
  });
});
