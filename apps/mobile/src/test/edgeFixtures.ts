import type { MobileOffer, MobileSearchResult } from "@contracts/mobileSearch";
import type { Offer } from "@contracts/types";
import { NOK_OFFER, SEK_OFFER } from "./fixtures";

// TESTDATA FOR KANTILFELLER – fiktive navn og priser (selskapene finnes ikke).
// Flere reisende (2 voksne, 1 barn, 1 spedbarn) og svært lange tilbydernavn,
// så vi ser at prisgrunnlag, selgerens pris, bagasje, vilkår og handlingen
// henger sammen og at ingenting kuttes. Brukes bare i tester og i skjermbildene
// for kantilfellene (docs/evidence, «edge»).

const FAMILY: Offer["passengers"] = [
  { id: "p1", type: "adult" },
  { id: "p2", type: "adult" },
  { id: "p3", type: "child", age: 8 },
  { id: "p4", type: "infant_without_seat", age: 1 },
];

export const EDGE_AIRLINE = "Nordlys Testflyselskap Interkontinentale Ruter";
export const EDGE_AGENCY = "Fjordreise Testbyrå med et svært langt firmanavn AS";
export const EDGE_AGENCY_2 = "Example Long-Name International Travel Agency GmbH (test)";

const ZZ = { iata: "ZZ", name: EDGE_AIRLINE };

/** Alle flyvningene flys av det fiktive selskapet, så det lange navnet også står i tidslinjen. */
const flownByZZ = (slices: Offer["slices"]): Offer["slices"] => slices.map((s) => ({ ...s, segments: s.segments.map((seg) => ({ ...seg, carrier: ZZ })) }));

const nok = (kroner: number): MobileOffer["price"] => ({
  original: { amount: `${kroner}.00`, currency: "NOK" },
  serviceFee: null,
  total: { amount: `${kroner}.00`, currency: "NOK" },
  nok: { kind: "exact", currency: "NOK", amountMinor: kroner * 100, estimate: false },
});

/** Samme reise (samme flynumre og tider som SEK_OFFER, fløyet av ZZ) hos tre selgere – grupperes til én reise. */
function sameTrip(id: string, seller: string, sellerKind: "airline" | "agency", patch: Partial<Offer>): Offer {
  return {
    ...SEK_OFFER.offer,
    id,
    owner: ZZ,
    slices: flownByZZ(SEK_OFFER.offer.slices),
    passengers: FAMILY,
    booking: { kind: "external", url: `https://www.kayak.no/book/${id}`, provider: { code: "ZZ", name: seller }, sellerKind },
    ...patch,
  };
}

/** Byrå: billigst, 2 innsjekkede kolli, refusjon mot gebyr, endring tillatt. */
export const EDGE_AGENCY_OFFER: MobileOffer = {
  offer: sameTrip("edge_agency", EDGE_AGENCY, "agency", {
    totalAmount: "18450.00",
    totalCurrency: "NOK",
    baggage: { carryOnBags: 1, checkedBags: 2 },
    conditions: { refundBeforeDeparture: { allowed: true, feeApplies: true }, changeBeforeDeparture: { allowed: true } },
  }),
  price: nok(18450),
  comparable: true,
};

/** Byrå nr. 2: innsjekket bagasje ikke oppgitt, endring ikke tillatt. */
export const EDGE_AGENCY_2_OFFER: MobileOffer = {
  offer: sameTrip("edge_agency2", EDGE_AGENCY_2, "agency", {
    totalAmount: "18990.00",
    totalCurrency: "NOK",
    baggage: { carryOnBags: 1, checkedBags: 0, checkedUnknown: true },
    conditions: { changeBeforeDeparture: { allowed: false } },
  }),
  price: nok(18990),
  comparable: true,
};

/** Flyselskapet selv: uten innsjekket bagasje, ingen oppgitte vilkår. */
export const EDGE_AIRLINE_OFFER: MobileOffer = {
  offer: sameTrip("edge_airline", EDGE_AIRLINE, "airline", {
    totalAmount: "19990.00",
    totalCurrency: "NOK",
    baggage: { carryOnBags: 1, checkedBags: 0 },
    conditions: undefined,
  }),
  price: nok(19990),
  comparable: true,
};

/** En annen reise med ett tilbud, også for fire reisende. */
export const EDGE_SINGLE_OFFER: MobileOffer = {
  offer: { ...NOK_OFFER.offer, id: "edge_single", owner: ZZ, slices: flownByZZ(NOK_OFFER.offer.slices), passengers: FAMILY, booking: { kind: "external", url: "https://www.kayak.no/book/edge_single", provider: { code: "ZZ", name: EDGE_AGENCY_2 }, sellerKind: "agency" } },
  price: nok(21340),
  comparable: true,
};

export const EDGE_RESULT: MobileSearchResult = {
  offerRequestId: "orq_edge",
  provider: "demo",
  sandbox: true,
  bookingMode: "external",
  liveMode: false,
  demoMode: true,
  cabinClass: "economy",
  slices: [
    { origin: "OSL", destination: "BCN", departureDate: "2026-10-23" },
    { origin: "BCN", destination: "OSL", departureDate: "2026-10-30" },
  ],
  passengers: [{ type: "adult" }, { type: "adult" }, { type: "child", age: 8 }, { type: "infant_without_seat", age: 1 }],
  offers: [EDGE_AGENCY_OFFER, EDGE_AGENCY_2_OFFER, EDGE_AIRLINE_OFFER, EDGE_SINGLE_OFFER],
  fx: { status: "not_needed", unconvertedCount: 0, source: "norges-bank", rateDate: null, indicative: true },
};
