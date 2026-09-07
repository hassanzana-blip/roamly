import { describe, expect, it } from "vitest";
import { buildSearchRequest, isoDurationToMinutes, isTravelportOffer, mapSearchResponse, toIso, TRAVELPORT_OFFER_PREFIX } from "./travelport";
import type { SearchPassengerInput, SearchSliceInput } from "@contracts/types";

/**
 * Fixturen er hentet fra Travelports egen DevKit (v11 GDS Full Payload,
 * v26.11.1) — et ekte, lagret 200-svar, ikke et gjettet skjema. Feltnavnene
 * her er derfor de samme som API-et faktisk sender: prisen ligger i
 * BestCombinablePrice, kabinen på produktet i ReferenceListProduct, og
 * flygningene slås opp via flightRefs mot ReferenceListFlight.
 */
const slices: SearchSliceInput[] = [{ origin: "LAX", destination: "HNL", departureDate: "2026-01-20" }];
const passengers: SearchPassengerInput[] = [{ type: "adult" }, { type: "child", age: 8 }];
const input = { slices, passengers, cabinClass: "economy" as const };

const FIXTURE = {
  CatalogProductOfferingsResponse: {
    "@type": "CatalogProductOfferingsResponseAir",
    transactionId: "abc123",
    CatalogProductOfferings: {
      Identifier: { value: "offreq-123" },
      CatalogProductOffering: [
        {
          "@type": "CatalogProductOfferingAir",
          sequence: 1,
          id: "o1",
          Departure: "LAX",
          Arrival: "HNL",
          ProductBrandOptions: [
            {
              "@type": "ProductBrandOptions",
              flightRefs: ["s1", "s3"],
              ProductBrandOffering: [
                {
                  "@type": "ProductBrandOffering",
                  id: "pbo1",
                  Product: [{ "@type": "ProductID", productRef: "p0" }],
                  BestCombinablePrice: {
                    "@type": "BestCombinablePriceDetail",
                    CurrencyCode: { decimalPlace: 2, value: "AUD" },
                    Base: 232,
                    TotalTaxes: 41.1,
                    TotalFees: 0,
                    TotalPrice: 273.1,
                  },
                },
                {
                  "@type": "ProductBrandOffering",
                  id: "pbo2",
                  Product: [{ "@type": "ProductID", productRef: "p1" }],
                  BestCombinablePrice: {
                    CurrencyCode: { decimalPlace: 2, value: "AUD" },
                    Base: 500,
                    TotalTaxes: 41.1,
                    TotalFees: 8.9,
                    TotalPrice: 550,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    ReferenceList: [
      {
        "@type": "ReferenceListFlight",
        Flight: [
          {
            "@type": "FlightDetail",
            distance: 2566,
            duration: "PT6H3M",
            carrier: "HA",
            number: "869",
            operatingCarrierName: "ALASKA AS HAWAIIAN AIRLINES",
            equipment: "321",
            id: "s1",
            Departure: { "@type": "DepartureDetail", location: "LAX", date: "2026-01-20", time: "07:20:00" },
            Arrival: { "@type": "ArrivalDetail", terminal: "1", location: "SFO", date: "2026-01-20", time: "09:23:00" },
          },
          {
            "@type": "FlightDetail",
            duration: "PT5H30M",
            carrier: "HA",
            number: "12",
            equipment: "332",
            id: "s3",
            Departure: { location: "SFO", date: "2026-01-20", time: "11:00:00" },
            Arrival: { location: "HNL", date: "2026-01-20", time: "13:30:00" },
          },
        ],
      },
      {
        "@type": "ReferenceListProduct",
        Product: [
          {
            "@type": "ProductAir",
            totalDuration: "PT11H33M",
            id: "p0",
            PassengerFlight: [
              { "@type": "PassengerFlight", passengerQuantity: 1, passengerTypeCode: "ADT", FlightProduct: [{ classOfService: "E", cabin: "Economy" }] },
            ],
          },
          {
            "@type": "ProductAir",
            id: "p1",
            PassengerFlight: [{ FlightProduct: [{ classOfService: "J", cabin: "Business" }] }],
          },
        ],
      },
    ],
  },
};

describe("Travelport: forespørsel", () => {
  it("nøster forespørselen slik DevKit-en gjør", () => {
    const req = buildSearchRequest(input) as Record<string, unknown>;
    expect(req["@type"]).toBe("CatalogProductOfferingsQueryRequest");
    const air = req.CatalogProductOfferingsRequest as Record<string, unknown>;
    expect(air["@type"]).toBe("CatalogProductOfferingsRequestAir");
    // Kontoen er provisjonert for NDC; hurtigstarten bruker samme verdi.
    expect(air.contentSourceList).toEqual(["NDC"]);
  });

  it("teller passasjerer per type og bruker Travelports typekoder", () => {
    const req = buildSearchRequest(input) as Record<string, Record<string, unknown>>;
    expect(req.CatalogProductOfferingsRequest.PassengerCriteria).toEqual([
      { "@type": "PassengerCriteria", number: 1, passengerTypeCode: "ADT" },
      { "@type": "PassengerCriteria", number: 1, passengerTypeCode: "CNN", age: 8 },
    ]);
  });

  it("sender én SearchCriteriaFlight per strekning, med store bokstaver", () => {
    const req = buildSearchRequest({ ...input, slices: [{ origin: "osl", destination: "lhr", departureDate: "2026-10-15" }] }) as Record<string, Record<string, unknown>>;
    expect(req.CatalogProductOfferingsRequest.SearchCriteriaFlight).toEqual([
      { "@type": "SearchCriteriaFlight", departureDate: "2026-10-15", From: { value: "OSL" }, To: { value: "LHR" } },
    ]);
  });

  it("ber om riktig kabin", () => {
    const req = buildSearchRequest({ ...input, cabinClass: "business" }) as Record<string, Record<string, unknown>>;
    expect(JSON.stringify(req.CatalogProductOfferingsRequest.SearchModifiersAir)).toContain("Business");
  });
});

describe("Travelport: varighet og tid", () => {
  it("leser ISO 8601-varighet", () => {
    expect(isoDurationToMinutes("PT6H3M")).toBe(363);
    expect(isoDurationToMinutes("PT45M")).toBe(45);
    expect(isoDurationToMinutes("P1DT2H")).toBe(1560);
    expect(isoDurationToMinutes(undefined)).toBe(0);
    expect(isoDurationToMinutes("tull")).toBe(0);
  });

  it("setter sammen dato og tid", () => {
    expect(toIso("2026-01-20", "07:20:00")).toBe("2026-01-20T07:20:00");
    expect(toIso("2026-01-20")).toBe("2026-01-20T00:00:00");
    expect(toIso(undefined, "08:10")).toBe("");
  });
});

describe("Travelport: kartlegging av ekte DevKit-svar", () => {
  it("leser prisen fra BestCombinablePrice, med gebyrer lagt til avgiftene", () => {
    const offers = mapSearchResponse(FIXTURE, input);
    expect(offers.length).toBe(2);
    expect(offers[0].totalAmount).toBe("273.10");
    expect(offers[0].totalCurrency).toBe("AUD");
    expect(offers[0].baseAmount).toBe("232.00");
    expect(offers[0].taxAmount).toBe("41.10");
    // 41.1 avgift + 8.9 gebyr
    expect(offers[1].taxAmount).toBe("50.00");
    expect(offers[1].totalAmount).toBe("550.00");
  });

  it("henter kabinen fra produktet, ikke fra flygningen", () => {
    const offers = mapSearchResponse(FIXTURE, input);
    expect(offers[0].cabinClass).toBe("economy");
    expect(offers[1].cabinClass).toBe("business");
    expect(offers[1].slices[0].segments[0].cabinClass).toBe("business");
  });

  it("slår opp flightRefs mot ReferenceListFlight og bygger strekningen", () => {
    const [offer] = mapSearchResponse(FIXTURE, input);
    const slice = offer.slices[0];
    expect(slice.segments.map((s) => s.flightNumber)).toEqual(["HA869", "HA12"]);
    expect(slice.origin.iata).toBe("LAX");
    expect(slice.destination.iata).toBe("HNL");
    expect(slice.stops).toBe(1);
    expect(slice.durationMinutes).toBe(363 + 330);
    expect(slice.segments[0].destination.iata).toBe("SFO");
    expect(slice.segments[0].destination.terminal).toBe("1");
    expect(slice.segments[0].departingAt).toBe("2026-01-20T07:20:00");
    expect(slice.segments[0].aircraft).toBe("321");
  });

  it("merker tilbud med tp-prefiks så de ikke kan bookes via Duffel", () => {
    const [offer] = mapSearchResponse(FIXTURE, input);
    expect(offer.id.startsWith(TRAVELPORT_OFFER_PREFIX)).toBe(true);
    expect(isTravelportOffer(offer.id)).toBe(true);
    expect(isTravelportOffer("off_123_duffel")).toBe(false);
  });

  it("gir hvert merkenivå sin egen tilbuds-id", () => {
    const offers = mapSearchResponse(FIXTURE, input);
    expect(new Set(offers.map((o) => o.id)).size).toBe(2);
  });

  it("speiler passasjerene fra søket", () => {
    const [offer] = mapSearchResponse(FIXTURE, input);
    expect(offer.passengers.map((p) => p.type)).toEqual(["adult", "child"]);
    expect(offer.passengers[1].age).toBe(8);
  });

  it("merker bagasje som ukjent når leverandøren ikke sendte den", () => {
    const [offer] = mapSearchResponse(FIXTURE, input);
    expect(offer.baggage).toEqual({ carryOnBags: 0, checkedBags: 0, carryOnUnknown: true, checkedUnknown: true });
    expect(offer.refundable).toBe(false);
    expect(offer.changeable).toBe(false);
  });

  it("hopper over tilbud uten pris, valuta eller segmenter framfor å gjette", () => {
    const refs = FIXTURE.CatalogProductOfferingsResponse.ReferenceList;
    const utenValuta = {
      CatalogProductOfferingsResponse: {
        CatalogProductOfferings: {
          CatalogProductOffering: [
            { id: "x", ProductBrandOptions: [{ flightRefs: ["s1"], ProductBrandOffering: [{ id: "b", BestCombinablePrice: { TotalPrice: 100 } }] }] },
          ],
        },
        ReferenceList: refs,
      },
    };
    expect(mapSearchResponse(utenValuta, input)).toEqual([]);

    const utenSegmenter = {
      CatalogProductOfferingsResponse: {
        CatalogProductOfferings: {
          CatalogProductOffering: [
            {
              id: "x",
              ProductBrandOptions: [
                { flightRefs: ["mangler"], ProductBrandOffering: [{ id: "b", BestCombinablePrice: { TotalPrice: 100, CurrencyCode: { value: "NOK" } } }] },
              ],
            },
          ],
        },
        ReferenceList: refs,
      },
    };
    expect(mapSearchResponse(utenSegmenter, input)).toEqual([]);
  });

  it("tåler et tomt svar", () => {
    expect(mapSearchResponse({}, input)).toEqual([]);
    expect(mapSearchResponse({ CatalogProductOfferingsResponse: {} }, input)).toEqual([]);
  });
});

/**
 * NDC-svar er formet annerledes enn GDS: ProductBrandOptions har ingen
 * flightRefs i det hele tatt, og flygningene er kun tilgjengelige via
 * produktets FlightSegment. Denne fixturen er hentet fra et ekte NDC-svar
 * (American Airlines, JFK–LAX) fra pre-production.
 */
const NDC_FIXTURE = {
  CatalogProductOfferingsResponse: {
    CatalogProductOfferings: {
      CatalogProductOffering: [
        {
          "@type": "CatalogProductOffering",
          sequence: 1,
          id: "AA_CPO0",
          Identifier: { authority: "AA", value: "QUFfQ1BPMA==" },
          Departure: "JFK",
          Arrival: "LAX",
          ProductBrandOptions: [
            {
              "@type": "ProductBrandOptions",
              ProductBrandOffering: [
                {
                  "@type": "ProductBrandOffering",
                  Identifier: { authority: "AA", value: "WEJGRDJGN0MwLTE5QjAt" },
                  Brand: { "@type": "BrandID", BrandRef: "AAb1" },
                  Product: [{ "@type": "ProductID", productRef: "AAp0" }],
                  BestCombinablePrice: {
                    "@type": "BestCombinablePriceDetail",
                    CurrencyCode: { decimalPlace: 2, value: "GBP" },
                    Base: 157,
                    TotalTaxes: 23.1,
                    TotalFees: 0,
                    TotalPrice: 180.1,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    ReferenceList: [
      {
        "@type": "ReferenceListFlight",
        Flight: [
          {
            "@type": "FlightDetail",
            duration: "PT6H20M",
            carrier: "AA",
            number: "3",
            equipment: "32B",
            id: "AAs1",
            Departure: { location: "JFK", date: "2026-10-07", time: "08:00:00", terminal: "8" },
            Arrival: { location: "LAX", date: "2026-10-07", time: "11:20:00", terminal: "4" },
          },
        ],
      },
      {
        "@type": "ReferenceListProduct",
        Product: [
          {
            "@type": "ProductAir",
            id: "AAp0",
            totalDuration: "PT6H20M",
            FlightSegment: [{ "@type": "FlightSegment", sequence: 1, Flight: { "@type": "FlightID", FlightRef: "AAs1" } }],
            PassengerFlight: [{ FlightProduct: [{ classOfService: "O", cabin: "Economy" }] }],
          },
        ],
      },
    ],
  },
};

describe("Travelport: NDC-svar (ingen flightRefs)", () => {
  const ndcInput = {
    slices: [{ origin: "JFK", destination: "LAX", departureDate: "2026-10-07" }],
    passengers: [{ type: "adult" as const }],
    cabinClass: "economy" as const,
  };

  it("finner flygningene via produktet når flightRefs mangler", () => {
    const offers = mapSearchResponse(NDC_FIXTURE, ndcInput);
    expect(offers.length).toBe(1);
    const slice = offers[0].slices[0];
    expect(slice.segments.map((s) => s.flightNumber)).toEqual(["AA3"]);
    expect(slice.origin.iata).toBe("JFK");
    expect(slice.destination.iata).toBe("LAX");
    expect(slice.stops).toBe(0);
    expect(slice.segments[0].origin.terminal).toBe("8");
  });

  it("leser pris og kabin fra NDC-svaret", () => {
    const [offer] = mapSearchResponse(NDC_FIXTURE, ndcInput);
    expect(offer.totalAmount).toBe("180.10");
    expect(offer.totalCurrency).toBe("GBP");
    expect(offer.baseAmount).toBe("157.00");
    expect(offer.taxAmount).toBe("23.10");
    expect(offer.cabinClass).toBe("economy");
    expect(offer.owner.iata).toBe("AA");
  });

  it("bruker leverandørens Identifier i tilbuds-id-en når det ikke finnes noen id", () => {
    const [offer] = mapSearchResponse(NDC_FIXTURE, ndcInput);
    expect(offer.id.startsWith(TRAVELPORT_OFFER_PREFIX)).toBe(true);
    expect(offer.id).toContain("AA_CPO0");
  });
});
