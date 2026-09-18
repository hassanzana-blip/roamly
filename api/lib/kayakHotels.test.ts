import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.KAYAK_HOTELS_ENABLED = "true";
  process.env.KAYAK_FLIGHTS_ENABLED = "true";
  process.env.KAYAK_SANDBOX_API_KEY = "test-key-not-real";
  process.env.KAYAK_API_MODE = "sandbox";
});
import { kayakHotelSearch, kayakHotelDetail, nightsBetween, roomsParam } from "./kayakHotels";
import { setKayakFetch } from "./kayak";

/** Fixture = KAYAKs dokumenterte HotelResult/HotelRate-eksempel (Hotels Search API 3.0). */
const RESULT = {
  id: 2589314,
  key: "khotel:2589314",
  name: "citizenM Tower of London",
  address: "40 Trinity Square",
  hotelCountryCode: "GB",
  latitude: 51.51018,
  longitude: -0.07687,
  starRating: 4,
  isSelfRated: false,
  images: [{ large: "https://www.kayak.ch/h/run/api/image?url=/himg/a.jpg&maxheight=460", small: "https://www.kayak.ch/h/run/api/image?url=/himg/a.jpg&maxheight=230" }, { large: "http://insecure.example/x.jpg" }],
  lowestRate: 1213.11,
  href: "https://sandbox-en-us.kayakaffiliates.com/api/3.0/hotel?hotel=khotel%3A2589314",
  distance: 0.63,
  isWithinBoundary: false,
  isGreatValue: false,
  propertyType: 0,
  numberOfProviders: 4,
  numberOfRates: 7,
  guestRating: 8.6,
  numberOfReviews: 3118,
  guestRatingSentiment: "Fabulous, 8.6",
  highestRate: 1429.74,
  rates: [
    { roomName: "King-Zimmer", totalRate: 1215.27, isCheapestRate: false, hasFreeCancellation: false, canPayLater: false, isBundledRate: false, inclusions: [0], availableRooms: 10, providerIndex: 1, isDeprioritisedForExcludedCharges: false, bookUri: "https://sandbox-en-us.kayakaffiliates.com/in?cluster=5&url=%2Fbook%2Fhotel" },
    { roomName: "Club", totalRate: 999, isCheapestRate: true, hasFreeCancellation: true, canPayLater: true, isBundledRate: false, inclusions: [], availableRooms: 2, providerIndex: 0, isDeprioritisedForExcludedCharges: false, bookUri: "https://sandbox-en-us.kayakaffiliates.com/in?cluster=5&url=%2Fbook%2Fhotel2" },
    { roomName: "Bad link", totalRate: 10, isCheapestRate: false, hasFreeCancellation: false, canPayLater: false, isBundledRate: false, inclusions: [], availableRooms: 1, providerIndex: 0, isDeprioritisedForExcludedCharges: false, bookUri: "javascript:alert(1)" },
  ],
};
const PROVIDERS = [
  { code: "BOOKINGDOTCOMAFFILIATE", name: "Booking.com", logo: "https://content.r9cdn.net/rimg/provider-logos/hotels/h/BOOKINGDOTCOM.png", isDirect: false, isLanguageSupported: true },
  { code: "HILTON", name: "Hilton", logo: "https://content.r9cdn.net/rimg/provider-logos/hotels/h/HILTON.png", isDirect: true, isLanguageSupported: true },
];

function fetchJson(handler: (url: URL) => unknown) {
  const calls: URL[] = [];
  setKayakFetch(async (input) => {
    const url = new URL(input);
    calls.push(url);
    return new Response(JSON.stringify(handler(url)), { status: 200, headers: { "content-type": "application/json" } });
  });
  return calls;
}

describe("kayakHotels", () => {
  it("regner netter og rom-parameter etter KAYAKs format", () => {
    expect(nightsBetween("2026-10-24", "2026-10-27")).toBe(3);
    expect(roomsParam([{ adults: 2 }])).toBe("2");
    expect(roomsParam([{ adults: 2, childAges: [4] }, { adults: 3 }])).toBe("2:4|3");
  });

  it("mapper hotellsøk: ekte bilder, gjestevurdering, leverandør og bare sikre bestillingslenker", async () => {
    const calls = fetchJson(() => ({ isComplete: true, searchTime: 10, totalResults: 1, totalAvailableResults: 1, totalFilteredResults: 1, currencyCode: "NOK", languageCode: "EN", results: [RESULT], providers: PROVIDERS, destination: { key: "kplace:58075", name: "London", fullName: "London, UK", placeCountryCode: "GB" } }));
    const res = await kayakHotelSearch({ destination: "kplace:58075", checkin: "2026-10-24", checkout: "2026-10-27", rooms: [{ adults: 2 }], currency: "NOK" }, { userTrackId: "not-a-uuid" });
    const q = calls[0].searchParams;
    expect(calls[0].pathname).toBe("/api/3.0/hotels");
    expect(q.get("apiKey")).toBe("test-key-not-real");
    expect(q.get("destination")).toBe("kplace:58075");
    expect(q.get("rooms")).toBe("2");
    expect(q.get("responseOptions")).toContain("images");
    expect(q.get("userTrackId")).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.sandbox).toBe(true);
    expect(res.nights).toBe(3);
    expect(res.destination?.name).toBe("London");
    const h = res.results[0];
    expect(h.images).toHaveLength(1); // http-bilde forkastet
    expect(h.images[0].large).toContain("kayak.ch");
    expect(h.guestRating).toBe(8.6);
    expect(h.numberOfReviews).toBe(3118);
    expect(h.rates).toHaveLength(2); // javascript:-lenken forkastet
    expect(h.rates[0].totalAmount).toBe(999); // billigst først
    expect(h.rates[0].provider).toMatchObject({ name: "Booking.com", isDirect: false });
    expect(h.rates[0].perNightAmount).toBe(333);
    expect(h.rates[1].provider).toMatchObject({ name: "Hilton", isDirect: true });
    expect(h.rates[1].inclusions).toEqual([0]);
    expect(h.lowestTotal).toBe(999);
  });

  it("markerer «ikke vurdert» (-1) som null", async () => {
    fetchJson(() => ({ isComplete: true, searchTime: 1, totalResults: 1, totalAvailableResults: 1, totalFilteredResults: 1, currencyCode: "USD", languageCode: "EN", results: [{ ...RESULT, guestRating: -1, rates: [] }], providers: PROVIDERS }));
    const res = await kayakHotelSearch({ destination: "kplace:1", checkin: "2026-10-24", checkout: "2026-10-25", rooms: [{ adults: 1 }] });
    expect(res.results[0].guestRating).toBeNull();
    expect(res.results[0].lowestTotal).toBe(1213.11);
  });

  it("avviser ugyldige reisemål før noe kall går ut", async () => {
    const calls = fetchJson(() => ({}));
    await expect(kayakHotelSearch({ destination: "javascript:x", checkin: "2026-10-24", checkout: "2026-10-25", rooms: [{ adults: 1 }] })).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it("henter ett hotell med beskrivelse og vilkår når leverandøren sender dem", async () => {
    // Dokumentert SingleHotelSearchResponse: hotellet på toppnivå, priser i `results`, omtaler i `reviews`.
    const { rates, ...top } = Object.fromEntries(Object.entries(RESULT).filter(([k]) => !["guestRating", "numberOfReviews", "guestRatingSentiment"].includes(k))) as typeof RESULT;
    const calls = fetchJson(() => ({ ...top, isComplete: true, searchTime: 141, totalResults: 2, currencyCode: "NOK", languageCode: "EN", countryCode: "NO", providers: PROVIDERS, results: rates, description: "Fra leverandøren.", policies: [{ code: "checkin", name: "Check-in", description: "From 2:00 pm" }], reviews: { numberOfReviews: 3118, sentiment: "Fabulous, 8.6", quotes: [{ text: "friendly staff", polarity: 1 }], aspects: [], reviewerTypes: [], guestRatings: { OVERALL: 8.6, LOCATION: 9.6 } } }));
    const res = await kayakHotelDetail({ hotelKey: "khotel:2589314", checkin: "2026-10-24", checkout: "2026-10-27", rooms: [{ adults: 2 }] });
    expect(calls[0].pathname).toBe("/api/3.0/hotel");
    expect(calls[0].searchParams.get("hotel")).toBe("khotel:2589314");
    expect(res.hotel.description).toBe("Fra leverandøren.");
    expect(res.hotel.policies[0].description).toBe("From 2:00 pm");
    expect(res.hotel.reviewQuotes).toEqual(["friendly staff"]);
    expect(res.hotel.guestRating).toBe(8.6);
    expect(res.hotel.numberOfReviews).toBe(3118);
    expect(res.hotel.rates).toHaveLength(2);
    expect(res.hotel.rates[0].provider.name).toBe("Booking.com");
  });
});
