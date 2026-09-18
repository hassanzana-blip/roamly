import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.KAYAK_CARS_ENABLED = "true";
  process.env.KAYAK_FLIGHTS_ENABLED = "true";
  process.env.KAYAK_SANDBOX_API_KEY = "test-key-not-real";
  process.env.KAYAK_API_MODE = "sandbox";
});
import { buildCarSearchStart, daysBetween, kayakCarSearch } from "./kayakCars";
import { setKayakFetch } from "./kayak";

/** Fixture = KAYAKs dokumenterte SearchResponse-eksempel (Cars Search API → /poll). */
const RESPONSE = {
  searchId: "JTAmAp5JvC",
  cluster: "4",
  status: "complete",
  results: [
    {
      id: "f6e29ded279a166d25dda122c0efbf3f",
      bookingOptions: [
        {
          providerCode: "IPRICELINECAR",
          agencyCode: "hertz",
          bookingUrl: "https://sandbox-en-us.kayakaffiliates.com/in?url=/book/car?code=JXAmCRO",
          pickupLocationId: "28634",
          policy: { cancellation: { isUnlimited: true }, mileage: { code: "limited", limit: 100, displayName: "100 mi" }, fuel: { code: "fullToFull", displayName: "full-to-full", description: "Pick up and drop off the car with a full tank" } },
          car: { image: "https://content.r9cdn.net/carimages/generic/02_economy_red.png", type: { code: "economy", displayName: "Economy", groups: ["small"] }, brand: "Fiat", sipp: "XFDA", fuel: "hybrid", bags: 2, passengers: 5, doors: "doors4" },
          price: { price: 84, displayPrice: "$84" },
          paymentType: "prepay",
          rateType: "bestAvailable",
          badges: [{ code: "freeCancellation", displayName: "Free Cancellation" }, { code: "greatDeal", displayName: "Great Deal" }],
        },
      ],
    },
    {
      id: "a089ccec3b3dd639cab8602be25dfc18",
      bookingOptions: [
        { providerCode: "IAIRPORTRENTALCARS", agencyCode: "hertz", bookingUrl: "https://sandbox-en-us.kayakaffiliates.com/in?url=/book/car?code=A", pickupLocationId: "28634", policy: { cancellation: { isUnlimited: true } }, car: { image: "https://content.r9cdn.net/car-images/generic/02_economy_coolgrey.png", type: { code: "compact", displayName: "Compact", groups: ["small"] }, brand: "Nissan Versa", features: [{ code: "ac", displayName: "Air conditioning" }], bags: 2, passengers: 5, fuel: "diesel", sipp: "CDAR" }, price: { price: 70, displayPrice: "$70" } },
        { providerCode: "IHOTWIRECARCORE", agencyCode: "hertz", bookingUrl: "https://sandbox-en-us.kayakaffiliates.com/in?url=/book/car?code=B", pickupLocationId: "28634", policy: { cancellation: { isUnlimited: false, limitHours: 24 } }, car: { image: "https://content.r9cdn.net/car-images/generic/02_economy_coolgrey.png", type: { code: "compact", displayName: "Compact", groups: ["small"] }, brand: "Nissan Versa", fuel: "electric", transmission: "manual", sipp: "CDAR", bags: 1, passengers: 3 }, price: { price: 60, displayPrice: "$60" }, paymentType: "prepay" },
      ],
    },
  ],
  agencies: { hertz: { code: "hertz", displayName: "Hertz", logoUrls: { horizontalUrl: "https://content.r9cdn.net/rimg/provider-logos/cars/h/hertz.png" }, type: "regular" } },
  providers: {
    IPRICELINECAR: { code: "IPRICELINECAR", displayName: "PricelineCar", logoUrls: { horizontalUrl: "https://content.r9cdn.net/rimg/provider-logos/cars/h/kayak-logo.png" } },
    IAIRPORTRENTALCARS: { code: "IAIRPORTRENTALCARS", displayName: "AirportRentals", logoUrls: { horizontalUrl: "https://content.r9cdn.net/rimg/provider-logos/cars/h/kayak-logo.png" } },
    IHOTWIRECARCORE: { code: "IHOTWIRECARCORE", displayName: "HotWireCar", logoUrls: { horizontalUrl: "https://content.r9cdn.net/rimg/provider-logos/cars/h/kayak-logo.png" } },
  },
  carLocations: { "28634": { locationId: "28634", locationType: "shuttle", coordinates: { latitude: 42.36, longitude: -71.0 }, address: "15 Transportation Way", cityName: "Boston", countryCode: "US", displayDistance: "1.1 mi", airport: { code: "BOS", displayName: "Boston Logan Intl" } } },
  pageSize: 500,
  totalCount: 2,
  currency: "USD",
  priceMode: "total",
  sort: { key: "price" },
  days: 2,
};

describe("kayakCars", () => {
  it("bygger startforespørsel etter dokumentert form", () => {
    const body = buildCarSearchStart({ pickup: { type: "airport", value: "BOS" }, pickupDate: "2026-10-24", dropoffDate: "2026-10-26", pickupHour: 14, currency: "nok" }) as { searchStartParameters: { pickup: { location: { type: string; value: string }; hour: number }; dropoff: { location?: unknown; date: string } }; resultParameters: { currency: string; priceMode: string } };
    expect(body.searchStartParameters.pickup.location).toEqual({ type: "airport", value: "BOS" });
    expect(body.searchStartParameters.pickup.hour).toBe(14);
    expect(body.searchStartParameters.dropoff.location).toBeUndefined();
    expect(body.resultParameters.currency).toBe("NOK");
    expect(body.resultParameters.priceMode).toBe("total");
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });

  it("starter, poller til «complete» og mapper billigste gyldige bestillingsvalg per bil", async () => {
    const bodies: unknown[] = [];
    let n = 0;
    setKayakFetch(async (input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      n += 1;
      const url = new URL(input);
      expect(url.pathname).toBe("/i/api/affiliate/search/car/v1/poll");
      expect(url.searchParams.get("apiKey")).toBe("test-key-not-real");
      return new Response(JSON.stringify({ ...RESPONSE, status: n === 1 ? "first-phase" : "complete" }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const res = await kayakCarSearch({ pickup: { type: "airport", value: "BOS" }, pickupDate: "2026-10-24", dropoffDate: "2026-10-26", currency: "USD" }, { userTrackId: "3e2f8a0c-2b1e-4c6f-9a4d-1f2e3d4c5b6a" });
    expect((bodies[0] as { searchStartParameters?: unknown }).searchStartParameters).toBeTruthy();
    expect(bodies[1]).toEqual({ searchId: "JTAmAp5JvC" });
    expect(res.complete).toBe(true);
    expect(res.sandbox).toBe(true);
    expect(res.days).toBe(2);
    expect(res.results).toHaveLength(2);
    const [cheap, fiat] = res.results;
    expect(cheap.model).toBe("Nissan Versa");
    expect(cheap.totalAmount).toBe(60);
    expect(cheap.perDayAmount).toBe(30);
    expect(cheap.transmission).toBe("manual");
    expect(cheap.provider.name).toBe("HotWireCar");
    expect(cheap.agency).toMatchObject({ name: "Hertz", logoUrl: "https://content.r9cdn.net/rimg/provider-logos/cars/h/hertz.png" });
    expect(cheap.freeCancellation).toBe(true);
    expect(cheap.policies).toContain("Gratis avbestilling inntil 24 t før");
    expect(fiat.model).toBe("Fiat");
    expect(fiat.className).toBe("Economy");
    expect(fiat.seats).toBe(5);
    expect(fiat.doors).toBe(4);
    expect(fiat.unlimitedMileage).toBe(false);
    expect(fiat.policies).toEqual(expect.arrayContaining(["100 mi", "full-to-full", "Free Cancellation", "Great Deal"]));
    expect(fiat.pickup.name).toContain("Boston Logan Intl (BOS)");
    expect(fiat.bookUrl).toMatch(/^https:\/\/sandbox-en-us\.kayakaffiliates\.com\/in/);
    expect(fiat.imageUrl).toContain("content.r9cdn.net");
  });

  it("skjuler agenturnavnet for opaque-agenturer og forkaster usikre lenker", async () => {
    setKayakFetch(async () =>
      new Response(
        JSON.stringify({
          ...RESPONSE,
          agencies: { hertz: { ...RESPONSE.agencies.hertz, type: "opaque" } },
          results: [{ id: "x", bookingOptions: [{ ...RESPONSE.results[0].bookingOptions[0], bookingUrl: "http://evil.example/x" }, { ...RESPONSE.results[0].bookingOptions[0], price: { price: 99, displayPrice: "$99" } }] }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const res = await kayakCarSearch({ pickup: { type: "city", value: "25588" }, pickupDate: "2026-10-24", dropoffDate: "2026-10-26" });
    expect(res.results).toHaveLength(1);
    expect(res.results[0].totalAmount).toBe(99);
    expect(res.results[0].agency.name).toBe("Utleier vises ved bestilling");
  });
});
