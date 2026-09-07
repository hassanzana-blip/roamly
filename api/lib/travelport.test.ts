import { describe, expect, it } from "vitest";
import { buildSearchRequest, isoDurationToMinutes, isTravelportOffer, mapSearchResponse, toIso, TRAVELPORT_OFFER_PREFIX } from "./travelport";
import type { SearchPassengerInput, SearchSliceInput } from "@contracts/types";

/**
 * Fixturen under er bygget fra Travelports publiserte skjema for
 * CatalogProductOfferings, ikke fra et ekte svar — sandkassen har ikke
 * nettverkstilgang til travelport.com. Når noen har kjørt et ekte søk mot
 * pre-production, bytt denne mot det faktiske svaret og se at testene
 * fortsatt går grønt. Da, og først da, er kartleggingen verifisert.
 */
const slices: SearchSliceInput[] = [{ origin: "OSL", destination: "LHR", departureDate: "2026-10-15" }];
const passengers: SearchPassengerInput[] = [{ type: "adult" }, { type: "child", age: 8 }];
const input = { slices, passengers, cabinClass: "economy" as const };

const FIXTURE = {
  CatalogProductOfferingsResponse: {
    CatalogProductOfferings: {
      Identifier: { value: "offreq-123" },
      CatalogProductOffering: [
        {
          id: "off1",
          ProductBrandOptions: [
            {
              flightRefs: ["f1", "f2"],
              ProductBrandOffering: [
                {
                  id: "brand-basic",
                  Price: { TotalPrice: 2450.5, Base: 1900, TotalTaxes: 550.5, CurrencyCode: { value: "NOK" } },
                  Brand: { BrandID: "BASIC", name: "Basic" },
                },
                {
                  id: "brand-flex",
                  Price: { TotalPrice: 3100, Base: 2400, TotalTaxes: 700, CurrencyCode: { value: "NOK" } },
                  Brand: { BrandID: "FLEX", name: "Flex" },
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
            id: "f1",
            carrier: "SK",
            carrierName: "SAS",
            number: "4321",
            duration: "PT2H5M",
            equipment: "32N",
            Departure: { location: "OSL", date: "2026-10-15", time: "08:10:00+02:00", terminal: "2" },
            Arrival: { location: "CPH", date: "2026-10-15", time: "09:15:00+02:00" },
            CabinClass: "Economy",
          },
          {
            id: "f2",
            carrier: "SK",
            carrierName: "SAS",
            number: "1503",
            duration: "PT1H55M",
            equipment: "320",
            Departure: { location: "CPH", date: "2026-10-15", time: "11:00:00+02:00" },
            Arrival: { location: "LHR", date: "2026-10-15", time: "11:55:00+01:00" },
            CabinClass: "Economy",
          },
        ],
      },
    ],
  },
};

describe("Travelport: forespørsel", () => {
  it("teller passasjerer per type og bruker Travelports typekoder", () => {
    const req = buildSearchRequest(input) as never;
    const air = (req as Record<string, Record<string, Record<string, unknown>>>).CatalogProductOfferingsQueryRequest.CatalogProductOfferingsRequestAir;
    expect(air.PassengerCriteria).toEqual([
      { "@type": "PassengerCriteria", number: 1, passengerTypeCode: "ADT" },
      { "@type": "PassengerCriteria", number: 1, passengerTypeCode: "CNN", age: 8 },
    ]);
  });

  it("sender én SearchCriteriaFlight per strekning, med store bokstaver", () => {
    const req = buildSearchRequest({ ...input, slices: [{ origin: "osl", destination: "lhr", departureDate: "2026-10-15" }] }) as never;
    const air = (req as Record<string, Record<string, Record<string, unknown>>>).CatalogProductOfferingsQueryRequest.CatalogProductOfferingsRequestAir;
    expect(air.SearchCriteriaFlight).toEqual([
      { "@type": "SearchCriteriaFlight", departureDate: "2026-10-15", From: { value: "OSL" }, To: { value: "LHR" } },
    ]);
  });

  it("ber om riktig kabin", () => {
    const req = buildSearchRequest({ ...input, cabinClass: "business" }) as never;
    const air = (req as Record<string, Record<string, Record<string, Record<string, unknown>>>>).CatalogProductOfferingsQueryRequest.CatalogProductOfferingsRequestAir;
    expect(JSON.stringify(air.SearchModifiersAir)).toContain("Business");
  });
});

describe("Travelport: varighet og tid", () => {
  it("leser ISO 8601-varighet", () => {
    expect(isoDurationToMinutes("PT2H5M")).toBe(125);
    expect(isoDurationToMinutes("PT45M")).toBe(45);
    expect(isoDurationToMinutes("P1DT2H")).toBe(1560);
    expect(isoDurationToMinutes(undefined)).toBe(0);
    expect(isoDurationToMinutes("tull")).toBe(0);
  });

  it("setter sammen dato og tid uten å miste offset", () => {
    expect(toIso("2026-10-15", "08:10:00+02:00")).toBe("2026-10-15T08:10:00+02:00");
    expect(toIso("2026-10-15")).toBe("2026-10-15T00:00:00");
    expect(toIso(undefined, "08:10")).toBe("");
  });
});

describe("Travelport: kartlegging av svar", () => {
  it("lager ett tilbud per merkevare, med pris og valuta fra svaret", () => {
    const offers = mapSearchResponse(FIXTURE, input);
    expect(offers.length).toBe(2);
    expect(offers[0].totalAmount).toBe("2450.50");
    expect(offers[0].totalCurrency).toBe("NOK");
    expect(offers[0].baseAmount).toBe("1900.00");
    expect(offers[0].taxAmount).toBe("550.50");
    expect(offers[1].totalAmount).toBe("3100.00");
  });

  it("bygger én strekning med to segmenter og riktig mellomlanding", () => {
    const [offer] = mapSearchResponse(FIXTURE, input);
    expect(offer.slices.length).toBe(1);
    const slice = offer.slices[0];
    expect(slice.segments.map((s) => s.flightNumber)).toEqual(["SK4321", "SK1503"]);
    expect(slice.origin.iata).toBe("OSL");
    expect(slice.destination.iata).toBe("LHR");
    expect(slice.stops).toBe(1);
    expect(slice.durationMinutes).toBe(125 + 115);
    expect(slice.segments[0].destination.iata).toBe("CPH");
    expect(slice.segments[0].origin.terminal).toBe("2");
  });

  it("merker tilbud med tp-prefiks så de ikke kan bookes via Duffel", () => {
    const [offer] = mapSearchResponse(FIXTURE, input);
    expect(offer.id.startsWith(TRAVELPORT_OFFER_PREFIX)).toBe(true);
    expect(isTravelportOffer(offer.id)).toBe(true);
    expect(isTravelportOffer("off_123_duffel")).toBe(false);
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
    const utenPris = {
      CatalogProductOfferingsResponse: {
        CatalogProductOfferings: {
          CatalogProductOffering: [
            { id: "x", ProductBrandOptions: [{ flightRefs: ["f1"], ProductBrandOffering: [{ id: "b", Price: { TotalPrice: 100 } }] }] },
          ],
        },
        ReferenceList: FIXTURE.CatalogProductOfferingsResponse.ReferenceList,
      },
    };
    expect(mapSearchResponse(utenPris, input)).toEqual([]);

    const utenSegmenter = {
      CatalogProductOfferingsResponse: {
        CatalogProductOfferings: {
          CatalogProductOffering: [
            { id: "x", ProductBrandOptions: [{ flightRefs: ["mangler"], ProductBrandOffering: [{ id: "b", Price: { TotalPrice: 100, CurrencyCode: { value: "NOK" } } }] }] },
          ],
        },
        ReferenceList: FIXTURE.CatalogProductOfferingsResponse.ReferenceList,
      },
    };
    expect(mapSearchResponse(utenSegmenter, input)).toEqual([]);
  });

  it("tåler et tomt svar", () => {
    expect(mapSearchResponse({}, input)).toEqual([]);
    expect(mapSearchResponse({ CatalogProductOfferingsResponse: {} }, input)).toEqual([]);
  });
});
