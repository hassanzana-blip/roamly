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
    expect(air.contentSourceList).toEqual(["GDS"]);
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

  it("oppgir ikke bagasje som leverandøren ikke sendte", () => {
    const [offer] = mapSearchResponse(FIXTURE, input);
    expect(offer.baggage).toEqual({ carryOnBags: 0, checkedBags: 0 });
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
