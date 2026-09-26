import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// env.ts leser process.env ved import – sandkassen må være «på» før modulen lastes.
vi.hoisted(() => {
  process.env.KAYAK_FLIGHTS_ENABLED = "true";
  process.env.KAYAK_SANDBOX_API_KEY = "test-key-not-real";
  process.env.KAYAK_API_MODE = "sandbox";
});
import {
  applyAirlineDirect,
  buildSearchStart,
  classifySeller,
  isKayakOffer,
  KAYAK_OFFER_PREFIX,
  kayakAutocomplete,
  kayakSearch,
  mapHttpError,
  mapPollResponse,
  normalizeUserTrackId,
  parsePollResponse,
  passengerCode,
  resetKayakAutocompleteState,
  scrubSecret,
  setKayakFetch,
  type KayakSearchInput,
} from "./kayak";
import { AppError } from "./errors";

/**
 * Fixturen bygger på KAYAKs dokumenterte PollResponse-eksempel (developers.kayak.com,
 * Flights Search API → /poll → Response), men er ikke en nøyaktig kopi av dagens eksempel:
 * dagens eksempel har priceMode «perPerson», her er det «total» (det vi ber om). Feltnavnene
 * her er dermed de API-et faktisk sender.
 */
const POLL_COMPLETE = {
  searchId: "gcHiCo3fUc",
  cluster: "4",
  status: "complete",
  pageSize: 2,
  totalCount: 123,
  sort: { key: "price", direction: "asc" },
  currency: "GBP",
  priceMode: "total",
  passengers: { adults: 1, children: 0, infants: 0, infantsInSeat: 0, seniors: 0, students: 0, youth: 0 },
  results: [
    {
      id: "ad4e36f9db46abb34f878812e55e1161",
      bookingOptions: [
        {
          type: "regular",
          bookingUrl: "https://sandbox-en-us.kayakaffiliates.com/in?url=%2Fbook%2Fflight%3Fcode%3Dabc",
          providerCode: "B6",
          displayPrice: { price: 442, displayPrice: "£442" },
          segmentFares: [
            { segmentId: "1750604400000B614881155", cabin: { code: "economy", displayName: "Economy" }, qualityItems: [] },
            { segmentId: "1751104800000B614870630", cabin: { code: "economy", displayName: "Economy" }, qualityItems: [] },
          ],
          fareFamilies: [
            {
              id: "AN",
              displayName: "Blue",
              amenities: [
                { code: "carryOnBag", restriction: "included", displayName: "Carry-on bag included" },
                { code: "checkedBag", restriction: "fee", displayName: "Checked bag fee" },
                { code: "change", restriction: "included", displayName: "Change fee waived" },
                { code: "refundable", restriction: "unavailable", displayName: "Refunds unavailable" },
              ],
              legIndices: [0, 1],
            },
          ],
          badges: [
            { code: "direct", displayName: "Direct flight" },
            { code: "freeCancellation", displayName: "Free cancellation" },
          ],
          fees: {
            basePrice: { price: 400, displayPrice: "£400" },
            totalPrice: { price: 442, displayPrice: "£442" },
            carryOnBag: [{ bagNumber: "first", restriction: "included", displayPrice: { price: 0, displayPrice: "£0" } }],
            checkedBag: [
              { bagNumber: "first", restriction: "fee", displayPrice: { price: 56, displayPrice: "£56" } },
              { bagNumber: "second", restriction: "fee", displayPrice: { price: 80, displayPrice: "£80" } },
            ],
          },
        },
        {
          type: "regular",
          bookingUrl: "https://sandbox-en-us.kayakaffiliates.com/in?url=%2Fbook%2Fflight%3Fcode%3Ddef",
          providerCode: "SKYPICKER",
          displayPrice: { price: 389, displayPrice: "£389" },
          segmentFares: [],
          fareFamilies: [],
          badges: [],
          fees: { totalPrice: { price: 389, displayPrice: "£389" }, nonRefundableDisclosure: "Non-refundable ticket." },
        },
        // Kun rutetid, ingen pris – skal filtreres bort.
        { type: "regular", bookingUrl: "https://example.com/x", providerCode: "B6", displayPrice: { price: -1, displayPrice: "—" }, segmentFares: [], fareFamilies: [] },
      ],
      legs: [{ id: "LAXBOS1750604400000B614881" }, { id: "BOSLAX1751104800000B614871" }],
    },
  ],
  legs: {
    LAXBOS1750604400000B614881: {
      duration: 338,
      segments: [{ id: "1750604400000B614881155", departureDayMismatch: true }],
      arrivalTime: "2025-06-23T00:33:00",
      departureTime: "2025-06-22T15:55:00",
    },
    BOSLAX1751104800000B614871: {
      duration: 375,
      segments: [{ id: "1751104800000B614870630" }],
      arrivalTime: "2025-06-28T13:45:00",
      departureTime: "2025-06-28T10:30:00",
    },
  },
  segments: {
    "1750604400000B614881155": {
      airline: "B6",
      flightNumber: "1488",
      origin: "LAX",
      destination: "BOS",
      arrivalTime: "2025-06-23T00:33:00",
      departureTime: "2025-06-22T15:55:00",
      equipmentTypeName: "Airbus A318/A319/A320/A321",
      duration: 338,
      type: "flight",
    },
    "1751104800000B614870630": {
      airline: "B6",
      flightNumber: "1487",
      origin: "BOS",
      destination: "LAX",
      arrivalTime: "2025-06-28T13:45:00",
      departureTime: "2025-06-28T10:30:00",
      equipmentTypeName: "Airbus A318/A319/A320/A321",
      duration: 375,
      type: "flight",
    },
  },
  airlines: {
    B6: {
      logoUrl: "https://content.r9cdn.net/rimg/provider-logos/airlines/v/B6.png",
      displayName: "JetBlue",
      airlineFeeUrl: "https://www.jetblue.com/at-the-airport/baggage-information",
      baggagePolicies: [],
    },
  },
  airports: { LAX: { displayName: "Los Angeles", cityName: "Los Angeles" }, BOS: { displayName: "Boston Logan Intl", cityName: "Boston" } },
  providers: {
    B6: { displayName: "JetBlue", logoUrls: { imageUrl: "https://content.r9cdn.net/rimg/provider-logos/airlines/v/B6.png" } },
    SKYPICKER: { displayName: "Kiwi.com", logoUrls: { imageUrl: "https://content.r9cdn.net/rimg/provider-logos/airlines/v/SKYPICKER.png" } },
  },
};

const input: KayakSearchInput = {
  slices: [
    { origin: "LAX", destination: "BOS", departureDate: "2025-06-22" },
    { origin: "BOS", destination: "LAX", departureDate: "2025-06-28" },
  ],
  passengers: [{ type: "adult" }],
  cabinClass: "economy",
  currency: "GBP",
};

const ctx = { searchId: "gcHiCo3fUc", expiresAt: "2025-06-01T12:20:00.000Z", sandbox: true };

function enableSandbox() {
  process.env.KAYAK_FLIGHTS_ENABLED = "true";
  process.env.KAYAK_SANDBOX_API_KEY = "test-key-not-real";
  process.env.KAYAK_API_MODE = "sandbox";
}

describe("KAYAK: forespørsel", () => {
  it("bygger et dokumentert PollRequest for tur-retur med barn og spedbarn", () => {
    const body = buildSearchStart({
      ...input,
      passengers: [{ type: "adult" }, { type: "child", age: 8 }, { type: "child", age: 14 }, { type: "infant_without_seat", age: 1 }],
      directOnly: true,
    }) as {
      searchStartParameters: { cabin: string; passengers: string[]; legs: { origin: unknown; destination: unknown; date: string; flex: string }[] };
      resultParameters: Record<string, unknown>;
    };
    expect(body.searchStartParameters.cabin).toBe("economy");
    expect(body.searchStartParameters.passengers).toEqual(["ADT", "CHD", "YTH", "INL"]);
    expect(body.searchStartParameters.legs).toHaveLength(2);
    expect(body.searchStartParameters.legs[0]).toEqual({
      origin: { locationType: "airports", airports: ["LAX"] },
      destination: { locationType: "airports", airports: ["BOS"] },
      date: "2025-06-22",
      flex: "exact",
    });
    expect(body.resultParameters).toMatchObject({ currency: "GBP", priceMode: "total", maxStops: 0, sort: { key: "price", direction: "asc" } });
  });

  it("kabin og passasjertyper følger KAYAKs enum", () => {
    expect((buildSearchStart({ ...input, cabinClass: "premium_economy" }) as { searchStartParameters: { cabin: string } }).searchStartParameters.cabin).toBe("premiumEconomy");
    expect(passengerCode({ type: "child" })).toBe("CHD");
    expect(passengerCode({ type: "child", age: 12 })).toBe("YTH");
    expect(passengerCode({ type: "infant_without_seat" })).toBe("INL");
  });

  it("userTrackId må være UUID – ellers lages en ny, aldri en konstant", () => {
    expect(normalizeUserTrackId("550E8400-E29B-41D4-A716-446655440000")).toBe("550e8400-e29b-41d4-a716-446655440000");
    const a = normalizeUserTrackId("test");
    const b = normalizeUserTrackId(undefined);
    expect(a).not.toBe("test");
    expect(a).not.toBe(b);
  });
});

describe("KAYAK: kartlegging", () => {
  it("leser det dokumenterte eksempelet til HelloSky-tilbud med ekstern bestilling", () => {
    const offers = mapPollResponse(parsePollResponse(POLL_COMPLETE), input, ctx);
    // To bestillingsalternativer med pris; det uten pris (-1) er borte.
    expect(offers).toHaveLength(2);
    const jetblue = offers.find((o) => o.booking?.provider.code === "B6")!;
    expect(jetblue.id.startsWith(KAYAK_OFFER_PREFIX)).toBe(true);
    expect(jetblue.id.length).toBeLessThanOrEqual(128);
    expect(jetblue.totalAmount).toBe("442.00");
    expect(jetblue.baseAmount).toBe("400.00");
    expect(jetblue.taxAmount).toBe("42.00");
    expect(jetblue.totalCurrency).toBe("GBP");
    expect(jetblue.owner).toEqual({ iata: "B6", name: "JetBlue", logoUrl: "https://content.r9cdn.net/rimg/provider-logos/airlines/v/B6.png" });
    expect(jetblue.slices).toHaveLength(2);
    expect(jetblue.slices[0].origin.iata).toBe("LAX");
    expect(jetblue.slices[0].origin.city).toBe("Los Angeles");
    expect(jetblue.slices[0].destination.name).toBe("Boston Logan Intl");
    expect(jetblue.slices[0].stops).toBe(0);
    expect(jetblue.slices[0].durationMinutes).toBe(338);
    expect(jetblue.slices[0].segments[0]).toMatchObject({ flightNumber: "1488", aircraft: "Airbus A318/A319/A320/A321", cabinClass: "economy", departingAt: "2025-06-22T15:55:00" });
    expect(jetblue.baggage).toEqual({ carryOnBags: 1, checkedBags: 0 });
    expect(jetblue.baggageFees).toEqual({ checked: "£56" });
    expect(jetblue.refundable).toBe(true); // badge freeCancellation
    expect(jetblue.changeable).toBe(true);
    expect(jetblue.emissionsKg).toBeUndefined();
    expect(jetblue.source).toBe("kayak");
    expect(jetblue.booking).toMatchObject({ kind: "external", url: expect.stringContaining("https://sandbox-en-us.kayakaffiliates.com/in?"), sellerKind: "airline", badges: ["direct", "freeCancellation"] });
    expect(jetblue.expiresAt).toBe(ctx.expiresAt);
  });

  it("uten bagasjefelter sier vi «ukjent», ikke «ikke inkludert»", () => {
    const offers = mapPollResponse(parsePollResponse(POLL_COMPLETE), input, ctx);
    const kiwi = offers.find((o) => o.booking?.provider.code === "SKYPICKER")!;
    expect(kiwi.baggage).toEqual({ carryOnBags: 0, checkedBags: 0, carryOnUnknown: true, checkedUnknown: true });
    expect(kiwi.booking?.sellerKind).toBe("agency");
    expect(kiwi.booking?.provider.name).toBe("Kiwi.com");
    expect(kiwi.booking?.disclosure).toBe("Non-refundable ticket.");
    expect(kiwi.refundable).toBe(false);
    expect(kiwi.conditions).toBeUndefined();
  });

  it("refusjon/endring: «fee» er tillatt mot gebyr, ukjente verdier gir ingen påstand", () => {
    const body = structuredClone(POLL_COMPLETE) as unknown as { results: { bookingOptions: { fareFamilies: { amenities: { code: string; restriction: string }[] }[] }[] }[] };
    const amenities = body.results[0]!.bookingOptions[0]!.fareFamilies[0]!.amenities;
    amenities.find((a) => a.code === "change")!.restriction = "fee";
    amenities.find((a) => a.code === "refundable")!.restriction = "somethingNew";
    const [offer] = mapPollResponse(parsePollResponse(body), input, ctx);
    expect(offer.conditions).toEqual({ changeBeforeDeparture: { allowed: true, feeApplies: true } });
    expect(offer.changeable).toBe(false);
  });

  it("bagasje: en ukjent begrensning er «ukjent», ikke «ikke inkludert»", () => {
    const body = structuredClone(POLL_COMPLETE) as unknown as { results: { bookingOptions: { fees?: { checkedBag?: { restriction: string }[] }; fareFamilies: { amenities: { code: string; restriction: string }[] }[] }[] }[] };
    const bo = body.results[0]!.bookingOptions[0]!;
    for (const b of bo.fees?.checkedBag ?? []) b.restriction = "somethingNew";
    bo.fareFamilies[0]!.amenities.find((a) => a.code === "checkedBag")!.restriction = "somethingNew";
    const [offer] = mapPollResponse(parsePollResponse(body), input, ctx);
    expect(offer.baggage).toEqual({ carryOnBags: 1, checkedBags: 0, checkedUnknown: true });
  });

  it("refusjon/endring fra fasilitetene: inkludert = tillatt, «unavailable» = ikke tillatt", () => {
    const [offer] = mapPollResponse(parsePollResponse(POLL_COMPLETE), input, ctx);
    expect(offer.conditions).toEqual({ changeBeforeDeparture: { allowed: true }, refundBeforeDeparture: { allowed: false } });
  });

  it("«operert av» vises bare når operatøren er en annen enn det markedsførende selskapet", () => {
    const body = structuredClone(POLL_COMPLETE) as unknown as { segments: Record<string, Record<string, unknown>> };
    body.segments["1750604400000B614881155"].operationalDisplay = "JetBlue";
    body.segments["1751104800000B614870630"].operationalDisplay = "Operated by Cape Air";
    const [offer] = mapPollResponse(parsePollResponse(body), input, ctx);
    expect(offer.slices[0].segments[0].operatingCarrier).toBeUndefined();
    expect(offer.slices[1].segments[0].operatingCarrier).toEqual({ iata: "", name: "Operated by Cape Air" });
  });

  it("hopper over resultater som peker på manglende leg/segment (misdannet svar)", () => {
    const broken = structuredClone(POLL_COMPLETE) as typeof POLL_COMPLETE;
    delete (broken.segments as Record<string, unknown>)["1751104800000B614870630"];
    expect(mapPollResponse(parsePollResponse(broken), input, ctx)).toHaveLength(0);
  });

  it("avviser svar uten dokumenterte kjernefelter", () => {
    expect(() => parsePollResponse({ foo: 1 })).toThrowError(AppError);
    expect(() => parsePollResponse(null)).toThrowError(AppError);
  });

  it("selger: leverandørkode lik markedsførende flyselskap = flyselskapet, kjent annen leverandør = byrå", () => {
    const airlines = new Set(["B6", "NK"]);
    expect(classifySeller("B6", airlines, POLL_COMPLETE.providers)).toBe("airline");
    expect(classifySeller("b6", airlines, POLL_COMPLETE.providers)).toBe("airline");
    expect(classifySeller("SKYPICKER", airlines, POLL_COMPLETE.providers)).toBe("agency");
    expect(classifySeller("XYZ", airlines, {})).toBe("unknown");
  });

  it("airline-direct: prefer setter flyselskapet først, only skjuler byråer, off beholder prisrekkefølgen", () => {
    const offers = mapPollResponse(parsePollResponse(POLL_COMPLETE), input, ctx);
    const off = applyAirlineDirect(offers, "off");
    expect(off.map((o) => o.booking?.provider.code)).toEqual(["SKYPICKER", "B6"]); // billigst først
    expect(applyAirlineDirect(offers, "prefer").map((o) => o.booking?.provider.code)).toEqual(["B6", "SKYPICKER"]);
    expect(applyAirlineDirect(offers, "only").map((o) => o.booking?.provider.code)).toEqual(["B6"]);
  });

  it("kjenner igjen KAYAK-tilbud på prefiks", () => {
    expect(isKayakOffer("kyk_abc.def.0")).toBe(true);
    expect(isKayakOffer("off_123")).toBe(false);
    expect(isKayakOffer("tp_123")).toBe(false);
  });
});

describe("KAYAK: feil", () => {
  it("oversetter dokumenterte feilformer uten å lekke nøkkel eller råtekst til kunden", () => {
    const unauthorized = mapHttpError(401, { status: 401, errorCode: "INVALID_API_KEY", errorMessage: "Invalid API key: XXX" }, "/poll");
    expect(unauthorized.code).toBe("SUPPLIER_REJECTED");
    expect(unauthorized.retryable).toBe(false);
    expect(unauthorized.message).not.toContain("XXX");
    expect(unauthorized.data?.kayakCode).toBe("INVALID_API_KEY");

    const rate = mapHttpError(429, { status: 429, errorCode: "RATE_LIMIT", errorMessage: "slow down" }, "/poll");
    expect(rate.code).toBe("SUPPLIER_UNAVAILABLE");
    expect(rate.retryable).toBe(true);

    const search = mapHttpError(400, { url: "/poll", errors: [{ code: "UNRECOGNIZED_LOCATION", description: "bad", localizedDescription: "Bad" }] }, "/poll");
    expect(search.code).toBe("SUPPLIER_REJECTED");
    expect(search.data?.kayakCode).toBe("UNRECOGNIZED_LOCATION");

    expect(mapHttpError(503, null, "/poll").code).toBe("SUPPLIER_UNAVAILABLE");
  });

  it("renser nøkkelen ut av tekst før logging", () => {
    process.env.KAYAK_SANDBOX_API_KEY = "test-key-not-real";
    expect(scrubSecret("Invalid API key: test-key-not-real")).not.toContain("test-key-not-real");
    expect(scrubSecret("https://x/poll?apiKey=abc123&userTrackId=u")).toBe("https://x/poll?apiKey=[redacted]&userTrackId=u");
  });
});

describe("KAYAK: søk med polling (falsk fetch)", () => {
  const calls: { url: URL; init?: RequestInit }[] = [];
  beforeEach(() => {
    enableSandbox();
    calls.length = 0;
  });
  afterEach(() => setKayakFetch(null));

  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

  it("starter søket, poller med cluster + cookie til complete, og svarer med eksterne tilbud", async () => {
    let n = 0;
    setKayakFetch(async (url, init) => {
      calls.push({ url: new URL(url), init });
      n += 1;
      if (n === 1) return json({ ...POLL_COMPLETE, status: "first-phase", results: [] }, 200, { "set-cookie": "cluster=4; Path=/; HttpOnly" });
      if (n === 2) return json({ ...POLL_COMPLETE, status: "second-phase" });
      return json(POLL_COMPLETE);
    });
    const result = await kayakSearch(
      { ...input, userTrackId: "550e8400-e29b-41d4-a716-446655440000", userAgent: "Mozilla/5.0 test", clientIp: "203.0.113.7" },
      { sleep: async () => {}, now: (() => { let t = 0; return () => (t += 100); })() },
    );
    expect(calls).toHaveLength(3);
    const first = calls[0].url;
    expect(first.origin + first.pathname).toBe("https://sandbox-en-us.kayakaffiliates.com/i/api/affiliate/search/flight/v1/poll");
    expect(first.searchParams.get("apiKey")).toBe("test-key-not-real");
    expect(first.searchParams.get("userTrackId")).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(first.searchParams.get("cluster")).toBeNull();
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe("Mozilla/5.0 test");
    expect(headers["x-original-client-ip"]).toBe("203.0.113.7");
    expect(JSON.parse(String(calls[0].init?.body))).toHaveProperty("searchStartParameters");

    const second = calls[1];
    expect(second.url.searchParams.get("cluster")).toBe("4");
    expect((second.init?.headers as Record<string, string>).Cookie).toBe("cluster=4");
    expect(JSON.parse(String(second.init?.body))).toMatchObject({ searchId: "gcHiCo3fUc" });

    expect(result.provider).toBe("kayak");
    expect(result.sandbox).toBe(true);
    expect(result.liveMode).toBe(false);
    expect(result.demoMode).toBe(false);
    expect(result.bookingMode).toBe("external");
    expect(result.partial).toBeUndefined();
    expect(result.offers).toHaveLength(2);
    expect(result.offers[0].booking?.kind).toBe("external");
  });

  it("gir opp pollingen når tidsbudsjettet er brukt og merker svaret som delvis", async () => {
    setKayakFetch(async () => json({ ...POLL_COMPLETE, status: "second-phase" }));
    let t = 0;
    const result = await kayakSearch(input, { sleep: async () => {}, now: () => (t += 5_000), budgetMs: 20_000 });
    expect(result.partial).toBe(true);
    expect(result.offers.length).toBeGreaterThan(0);
  });

  it("nøkkel avvist (401) → SUPPLIER_REJECTED uten nøkkelen i meldingen", async () => {
    setKayakFetch(async () => json({ status: 401, errorCode: "INVALID_API_KEY", errorMessage: "Invalid API key: test-key-not-real" }, 401));
    await expect(kayakSearch(input, { sleep: async () => {} })).rejects.toMatchObject({ code: "SUPPLIER_REJECTED" });
  });

  it("rate limit (429) → retryable SUPPLIER_UNAVAILABLE", async () => {
    setKayakFetch(async () => json({ status: 429, errorCode: "RATE_LIMIT_EXCEEDED", errorMessage: "Too many" }, 429));
    await expect(kayakSearch(input, { sleep: async () => {} })).rejects.toMatchObject({ code: "SUPPLIER_UNAVAILABLE", retryable: true });
  });

  it("ingen treff → tom liste, ikke feil", async () => {
    setKayakFetch(async () => json({ ...POLL_COMPLETE, results: [], totalCount: 0 }));
    const result = await kayakSearch(input, { sleep: async () => {} });
    expect(result.offers).toEqual([]);
  });

  it("uleselig svar → retryable feil", async () => {
    setKayakFetch(async () => new Response("<html>oops</html>", { status: 200, headers: { "content-type": "text/html" } }));
    await expect(kayakSearch(input, { sleep: async () => {} })).rejects.toMatchObject({ code: "SUPPLIER_UNAVAILABLE", retryable: true });
  });

  it("nettverksfeil ved start → SUPPLIER_UNAVAILABLE; feilet poll etter resultater → delvis svar", async () => {
    setKayakFetch(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(kayakSearch(input, { sleep: async () => {} })).rejects.toMatchObject({ code: "SUPPLIER_UNAVAILABLE" });

    let n = 0;
    setKayakFetch(async () => {
      n += 1;
      if (n === 1) return json({ ...POLL_COMPLETE, status: "first-phase" });
      return json({ status: 503, errorCode: "INTERNAL", errorMessage: "down" }, 503);
    });
    const result = await kayakSearch(input, { sleep: async () => {} });
    expect(result.partial).toBe(true);
    expect(result.offers).toHaveLength(2);
  });
});

describe("KAYAK: autocomplete", () => {
  beforeEach(() => {
    enableSandbox();
    resetKayakAutocompleteState();
  });
  afterEach(() => setKayakFetch(null));

  it("bruker dokumentert GET-endepunkt, cacher per søkeord og tar bare treff med IATA-kode", async () => {
    let n = 0;
    setKayakFetch(async (url) => {
      n += 1;
      const u = new URL(url);
      expect(u.pathname).toBe("/api/affiliate/autocomplete/v1/flights");
      expect(u.searchParams.get("searchTerm")).toBe("boston");
      expect(u.searchParams.get("apiKey")).toBe("test-key-not-real");
      return new Response(
        JSON.stringify({
          results: [
            { placeId: 1, primaryPlaceType: "airport", name: "Logan Intl", fullName: "Logan Intl, Boston", countryName: "United States", cityName: "Boston", iataCode: "BOS", isMetro: false },
            { placeId: 2, primaryPlaceType: "city", name: "Boston", fullName: "Boston, United States" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const a = await kayakAutocomplete("Boston");
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ iata: "BOS", city: "Boston", world: true });
    await kayakAutocomplete("boston ");
    expect(n).toBe(1);
  });

  it("feil hos KAYAK → tom liste (registeret vårt står uansett)", async () => {
    setKayakFetch(async () => new Response("{}", { status: 500 }));
    expect(await kayakAutocomplete("Kraków")).toEqual([]);
  });
});
