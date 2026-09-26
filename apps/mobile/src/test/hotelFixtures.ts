import type { HotelDetailResult, HotelPlace, HotelRateOffer, HotelSearchResult, HotelSummary, HotelsStatus } from "@contracts/hotels";

/**
 * Hotellfixturer i formen serveren gir (contracts/hotels.ts, mappet fra KAYAK
 * Hotels API 3.0). Navn og beløp er oppdiktede testdata – aldri vist som ekte.
 */

export const STATUS_LIVE: HotelsStatus = { enabled: true, mode: "production", externalBooking: true };
export const STATUS_SANDBOX: HotelsStatus = { enabled: true, mode: "sandbox", externalBooking: true };
export const STATUS_OFF: HotelsStatus = { enabled: false, mode: "production", externalBooking: true };

export const LONDON: HotelPlace = { key: "kplace:58075", name: "London", fullName: "London, England, Storbritannia", countryCode: "GB", type: "city" };
export const LONDON_EYE: HotelPlace = { key: "khotel:48213", name: "Riverside Test Hotel", fullName: "Riverside Test Hotel, London", countryCode: "GB", type: "hotel" };

export const CHECKIN = "2026-10-23";
export const CHECKOUT = "2026-10-26";

export const BOOK_URL_A = "https://www.kayak.no/in?a=hotel-test&url=%2Fbook%2Fhotel%2Fa";
export const BOOK_URL_B = "https://www.kayak.no/in?a=hotel-test&url=%2Fbook%2Fhotel%2Fb";

const rate = (over: Partial<HotelRateOffer>): HotelRateOffer => ({
  roomName: "Dobbeltrom",
  totalAmount: 3639,
  currency: "NOK",
  perNightAmount: 1213,
  freeCancellation: false,
  payLater: false,
  inclusions: [],
  availableRooms: 10,
  isCheapest: false,
  provider: { code: "BOOKINGDOTCOM", name: "Booking.com", isDirect: false },
  bookUrl: BOOK_URL_A,
  ...over,
});

const hotel = (over: Partial<HotelSummary>): HotelSummary => ({
  id: 1,
  key: "khotel:1",
  name: "Testhotell",
  address: "1 Test Street",
  countryCode: "GB",
  lat: 51.51,
  lng: -0.08,
  starRating: 4,
  selfRated: false,
  guestRating: 8.6,
  numberOfReviews: 3118,
  distanceKm: 0.6,
  images: [],
  lowestTotal: null,
  currency: "NOK",
  nights: 3,
  numberOfProviders: 1,
  rates: [],
  greatValue: false,
  ...over,
});

/** Tre hotell i KAYAKs rekkefølge: A (to leverandører), B (uten pris), C (billigst, lavere vurdering). */
export const HOTEL_A = hotel({
  id: 2589314,
  key: "khotel:2589314",
  name: "Tower Test Hotel",
  images: [{ large: "https://content.example-kayak.test/a-large.jpg", small: "https://content.example-kayak.test/a-small.jpg" }],
  rates: [
    rate({ roomName: "King-rom", totalAmount: 4119.5, perNightAmount: 1373.17, provider: { code: "HILTON", name: "Hilton", isDirect: true }, bookUrl: BOOK_URL_B, freeCancellation: true, inclusions: [0] }),
    rate({ roomName: "Club-rom", totalAmount: 3639, perNightAmount: 1213, isCheapest: true, payLater: true, availableRooms: 2 }),
  ],
  lowestTotal: 3639,
  numberOfProviders: 2,
});
export const HOTEL_B = hotel({ id: 77, key: "khotel:77", name: "No Price Inn", starRating: 3, guestRating: 7.9, numberOfReviews: 412, distanceKm: 1.4 });
export const HOTEL_C = hotel({
  id: 91,
  key: "khotel:91",
  name: "Budget Test Rooms",
  starRating: 2,
  guestRating: 6.8,
  numberOfReviews: 1,
  distanceKm: 3.2,
  rates: [rate({ roomName: "Standardrom", totalAmount: 2250, perNightAmount: 750, provider: { code: "EXPEDIA", name: "Expedia", isDirect: false }, bookUrl: BOOK_URL_B })],
  lowestTotal: 2250,
});

export const HOTEL_RESULT: HotelSearchResult = {
  provider: "kayak",
  sandbox: false,
  complete: true,
  destination: LONDON,
  checkin: CHECKIN,
  checkout: CHECKOUT,
  nights: 3,
  rooms: "2",
  currency: "NOK",
  totalResults: 3,
  results: [HOTEL_A, HOTEL_B, HOTEL_C],
  priceRange: { min: 2250, max: 4119.5 },
};

export const HOTEL_DETAIL: HotelDetailResult = {
  provider: "kayak",
  sandbox: false,
  complete: true,
  hotel: {
    ...HOTEL_A,
    description: "Et testhotell ved elven. Teksten er testdata.",
    policies: [{ code: "checkin", name: "Innsjekk", description: "Fra kl. 15.00" }],
    featureSummary: [{ name: "Gratis Wi-Fi", description: "" }],
    reviewQuotes: [],
  },
};
