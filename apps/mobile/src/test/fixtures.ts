import type { MobileOffer, MobileSearchResult } from "@contracts/mobileSearch";
import type { Offer, OfferSlice } from "@contracts/types";
import type { CustomerProfile, MobileAuthResult } from "@contracts/mobileAuth";

// Testdata i nøyaktig formen serverkontrakten beskriver (typet mot contracts/),
// så en endring i kontrakten stopper typesjekken her også.

const slice = (id: string, from: string, to: string, day: string): OfferSlice => ({
  id,
  origin: { iata: from, name: `${from} lufthavn`, city: from === "OSL" ? "Oslo" : "Barcelona", country: "X", lat: 0, lng: 0 },
  destination: { iata: to, name: `${to} lufthavn`, city: to === "BCN" ? "Barcelona" : "Oslo", country: "X", lat: 0, lng: 0 },
  departingAt: `${day}T07:05:00`,
  arrivingAt: `${day}T13:40:00`,
  durationMinutes: 275,
  stops: 1,
  segments: [
    {
      id: `${id}-1`,
      origin: { iata: from, name: "", city: from === "OSL" ? "Oslo" : "Barcelona", country: "", lat: 0, lng: 0 },
      destination: { iata: "CPH", name: "", city: "København", country: "", lat: 0, lng: 0 },
      departingAt: `${day}T07:05:00`,
      arrivingAt: `${day}T08:15:00`,
      durationMinutes: 70,
      carrier: { iata: "SK", name: "SAS" },
      flightNumber: "1455",
      aircraft: "",
      cabinClass: "economy",
    },
    {
      id: `${id}-2`,
      origin: { iata: "CPH", name: "", city: "København", country: "", lat: 0, lng: 0 },
      destination: { iata: to, name: "", city: to === "BCN" ? "Barcelona" : "Oslo", country: "", lat: 0, lng: 0 },
      departingAt: `${day}T09:10:00`,
      arrivingAt: `${day}T13:40:00`,
      durationMinutes: 150,
      carrier: { iata: "SK", name: "SAS" },
      flightNumber: "585",
      aircraft: "",
      cabinClass: "economy",
    },
  ],
});

function offer(id: string, amount: string, currency: string, external: { url: string; name: string; sellerKind?: "airline" | "agency" } | null): Offer {
  return {
    id,
    totalAmount: amount,
    totalCurrency: currency,
    baseAmount: amount,
    taxAmount: "0",
    owner: { iata: "SK", name: id.startsWith("hs") ? "Norwegian" : "SAS" },
    expiresAt: "2099-01-01T00:00:00Z",
    cabinClass: "economy",
    slices: [slice(`${id}-s1`, "OSL", "BCN", "2026-10-23"), slice(`${id}-s2`, "BCN", "OSL", "2026-10-30")],
    passengers: [{ id: "p1", type: "adult" }],
    baggage: { carryOnBags: 1, checkedBags: 0, checkedUnknown: true },
    refundable: false,
    changeable: true,
    ...(external
      ? { source: "kayak" as const, booking: { kind: "external" as const, url: external.url, provider: { code: "XX", name: external.name }, sellerKind: external.sellerKind ?? "airline", disclosure: "Billetten kan ikke refunderes." } }
      : {}),
  };
}

export const RATE_DATE = "2026-09-22";
export const KAYAK_URL = "https://www.kayak.no/book/flight?code=abc.DEF-123&sub=F9&a=1&b=%C3%A6";

export const SEK_OFFER: MobileOffer = {
  offer: offer("sek_1", "1500.00", "SEK", { url: KAYAK_URL, name: "SAS", sellerKind: "airline" }),
  price: {
    original: { amount: "1500.00", currency: "SEK" },
    serviceFee: null,
    total: { amount: "1500.00", currency: "SEK" },
    nok: { kind: "converted", currency: "NOK", amountMinor: 144200, estimate: true, roundedTo: "krone", rate: { source: "norges-bank", baseCurrency: "SEK", rateDate: RATE_DATE, publishedRate: "96.10", quotedPerUnits: 100, indicative: true } },
  },
  comparable: true,
};

export const EUR_HS_OFFER: MobileOffer = {
  offer: offer("hs_eur", "100.00", "EUR", null),
  price: {
    original: { amount: "100.00", currency: "EUR" },
    serviceFee: { amount: "31.00", currency: "EUR" },
    total: { amount: "131.00", currency: "EUR" },
    nok: { kind: "converted", currency: "NOK", amountMinor: 152500, estimate: true, roundedTo: "krone", rate: { source: "norges-bank", baseCurrency: "EUR", rateDate: RATE_DATE, publishedRate: "11.6420", quotedPerUnits: 1, indicative: true } },
  },
  comparable: true,
};

export const NOK_OFFER: MobileOffer = {
  offer: offer("nok_1", "2100.50", "NOK", { url: "https://www.kayak.no/book/nok", name: "Kiwi.com", sellerKind: "agency" }),
  price: { original: { amount: "2100.50", currency: "NOK" }, serviceFee: null, total: { amount: "2100.50", currency: "NOK" }, nok: { kind: "exact", currency: "NOK", amountMinor: 210050, estimate: false } },
  comparable: true,
};

export const THB_OFFER: MobileOffer = {
  offer: offer("thb_1", "3000.00", "THB", { url: "https://www.kayak.no/book/thb", name: "Thai" }),
  price: { original: { amount: "3000.00", currency: "THB" }, serviceFee: null, total: { amount: "3000.00", currency: "THB" }, nok: { kind: "unavailable", reason: "unsupported_currency" } },
  comparable: false,
};

export const UNSAFE_LINK_OFFER: MobileOffer = {
  ...NOK_OFFER,
  offer: { ...NOK_OFFER.offer, id: "unsafe_1", booking: { kind: "external", url: "http://evil.example/book", provider: { code: "EV", name: "Evil" }, sellerKind: "agency" } },
};

/** Serverens rekkefølge: sammenlignbare stigende på NOK, THB sist. */
export const SEARCH_RESULT: MobileSearchResult = {
  offerRequestId: "orq_1",
  provider: "kayak",
  sandbox: false,
  bookingMode: "external",
  liveMode: true,
  demoMode: false,
  cabinClass: "economy",
  slices: [
    { origin: "OSL", destination: "BCN", departureDate: "2026-10-23" },
    { origin: "BCN", destination: "OSL", departureDate: "2026-10-30" },
  ],
  passengers: [{ type: "adult" }],
  offers: [SEK_OFFER, EUR_HS_OFFER, NOK_OFFER, UNSAFE_LINK_OFFER, THB_OFFER],
  fx: { status: "partial", unconvertedCount: 1, source: "norges-bank", rateDate: RATE_DATE, indicative: true },
};

export const PROFILE: CustomerProfile = {
  id: 7,
  email: "kari@example.no",
  phone: null,
  firstName: "Kari",
  lastName: "Nordmann",
  emailVerified: true,
  bonusKr: 0,
  referralCode: "ABCDEFGH",
  avatarUrl: null,
  locale: "nb",
  currency: "NOK",
  marketingConsent: false,
  hasPassword: true,
};

export const TOKEN = "tok_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcd";

export const AUTH_RESULT: MobileAuthResult = {
  session: { token: TOKEN, tokenType: "Bearer", expiresAt: "2099-01-01T00:00:00.000Z" },
  profile: PROFILE,
};
