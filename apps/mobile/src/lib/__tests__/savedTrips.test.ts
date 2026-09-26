import { NOK_OFFER, SEK_OFFER, THB_OFFER } from "../../test/fixtures";
import { initialForm, type SearchForm } from "../searchForm";
import { itinerarySignature } from "../journeys";
import { webSearchUrlForForm } from "../webLinks";
import { MAX_SAVED_FLIGHTS, flightFromOffer, flightIsPast, flightSearch, parseSavedFlights, parseSavedRoutes, routeForm, routeKey, toggleFlight, toggleRoute } from "../savedTrips";

const OSL = { iata: "OSL", name: "Oslo lufthavn Gardermoen", city: "Oslo", country: "Norge" };
const BCN = { iata: "BCN", name: "Barcelona-El Prat", city: "Barcelona", country: "Spania" };
const LHR = { iata: "LHR", name: "London Heathrow Airport", city: "London", country: "Storbritannia" };
const TODAY = new Date("2026-09-25T12:00:00");
const QUERY: SearchForm = { ...initialForm(TODAY), origin: OSL, destination: BCN, departDate: "2026-10-23", returnDate: "2026-10-30" };
const SAVED_AT = new Date("2026-09-25T14:05:00Z");

describe("lagrede fly (bare på telefonen)", () => {
  it("et bilde av reisen: flyplasser, tider, selskap, flynumre og bytter – og prisen kunden så, med tidspunktet", () => {
    const f = flightFromOffer(NOK_OFFER, QUERY, SAVED_AT);
    expect(f.key).toBe(itinerarySignature(NOK_OFFER.offer));
    expect(f.savedAt).toBe("2026-09-25T14:05:00.000Z");
    expect(f.legs).toHaveLength(2);
    expect(f.legs[0]).toEqual({
      origin: { iata: "OSL", name: "OSL lufthavn", city: "Oslo", country: "X" },
      destination: { iata: "BCN", name: "BCN lufthavn", city: "Barcelona", country: "X" },
      departingAt: "2026-10-23T07:05:00",
      arrivingAt: "2026-10-23T13:40:00",
      durationMinutes: 275,
      stops: 1,
      carriers: [{ iata: "SK", name: "SAS" }],
      flightNumbers: ["SK1457", "SK587"],
    });
    expect(f.seenPrice).toEqual({ amountMinor: 210050, estimate: false });
    expect(f.demo).toBe(false);
    expect(f.query).toBe(QUERY);
    // Ingen leverandørlenke, tilbuds-id eller token i bildet.
    expect(JSON.stringify(f)).not.toMatch(/kayak\.no|nok_1|token/);
  });

  it("omregnet pris lagres som «ca.»; uten kronepris lagres ingen pris", () => {
    const sek = SEK_OFFER.price.nok;
    if (sek.kind !== "converted") throw new Error("SEK_OFFER skal være omregnet");
    expect(flightFromOffer(SEK_OFFER, QUERY, SAVED_AT).seenPrice).toEqual({ amountMinor: sek.amountMinor, estimate: true });
    expect(flightFromOffer(THB_OFFER, QUERY, SAVED_AT).seenPrice).toBeNull();
    expect(flightFromOffer({ ...NOK_OFFER, offer: { ...NOK_OFFER.offer, source: "demo" } }, QUERY, SAVED_AT).demo).toBe(true);
  });

  it("samme reise lagres én gang; lagre igjen fjerner; nyeste først; høyst 30", () => {
    const a = flightFromOffer(NOK_OFFER, QUERY, SAVED_AT);
    const b = flightFromOffer(SEK_OFFER, QUERY, SAVED_AT);
    let list = toggleFlight([], a);
    list = toggleFlight(list, b);
    expect(list.map((f) => f.key)).toEqual([b.key, a.key]);
    expect(toggleFlight(list, a).map((f) => f.key)).toEqual([b.key]);
    const many = Array.from({ length: MAX_SAVED_FLIGHTS + 5 }, (_, i) => ({ ...a, key: `k${i}` })).reduce((l, f) => toggleFlight(l, f), [] as typeof list);
    expect(many).toHaveLength(MAX_SAVED_FLIGHTS);
  });

  it("fra fil: overlever en runde gjennom JSON; ødelagte poster og ukjente felt forkastes", () => {
    const a = flightFromOffer(NOK_OFFER, QUERY, SAVED_AT);
    const raw = JSON.parse(JSON.stringify([{ ...a, secret: "x" }, a, { ...a, key: "b", legs: [] }, { ...a, key: "c", seenPrice: { amountMinor: -5 } }, "søppel", null]));
    const parsed = parseSavedFlights(raw, TODAY);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual(a);
    expect(parsed[1]!.seenPrice).toBeNull();
    expect(JSON.stringify(parsed)).not.toContain("secret");
  });

  it("«Søk igjen»: samme søk før avreise; etter avreise samme rute og reisende med dagens standarddatoer", () => {
    const a = flightFromOffer(NOK_OFFER, QUERY, SAVED_AT);
    expect(flightIsPast(a, TODAY)).toBe(false);
    expect(flightSearch(a, TODAY)).toEqual({ form: QUERY, freshDates: false });
    const later = new Date("2026-10-24T12:00:00");
    expect(flightIsPast(a, later)).toBe(true);
    const again = flightSearch(a, later);
    expect(again.freshDates).toBe(true);
    expect(again.form).toEqual({ ...QUERY, departDate: initialForm(later).departDate, returnDate: initialForm(later).returnDate });
  });
});

describe("lagrede ruter", () => {
  it("to flyplasser, nyeste først; samme rute igjen fjerner; motsatt vei er en annen rute", () => {
    let list = toggleRoute([], OSL, BCN, SAVED_AT);
    list = toggleRoute(list, OSL, LHR, SAVED_AT);
    list = toggleRoute(list, BCN, OSL, SAVED_AT);
    expect(list.map(routeKey)).toEqual(["BCN-OSL", "OSL-LHR", "OSL-BCN"]);
    expect(toggleRoute(list, OSL, LHR).map(routeKey)).toEqual(["BCN-OSL", "OSL-BCN"]);
  });

  it("fra fil: samme flyplass begge veier, dobbelte og ødelagte forkastes", () => {
    const raw = [
      { origin: OSL, destination: BCN, savedAt: "2026-09-25T10:00:00Z" },
      { origin: OSL, destination: BCN, savedAt: "2026-09-25T10:00:00Z" },
      { origin: OSL, destination: OSL, savedAt: "2026-09-25T10:00:00Z" },
      { origin: OSL, destination: LHR },
      42,
    ];
    expect(parseSavedRoutes(raw).map(routeKey)).toEqual(["OSL-BCN"]);
  });

  it("som skjema: bare fra og til byttes ut – datoer, reisende og klasse står", () => {
    const form = { ...initialForm(TODAY), adults: 2, cabinClass: "business" as const };
    expect(routeForm({ origin: OSL, destination: LHR, savedAt: "" }, form)).toEqual({ ...form, origin: OSL, destination: LHR });
  });

  it("delingslenken til hellosky.no: nettets parametere, ingen pris eller konto", () => {
    expect(webSearchUrlForForm({ ...QUERY, adults: 2, childAges: [8], directOnly: true })).toBe(
      "https://hellosky.no/sok?adults=2&children=1&infants=0&cabin=economy&childAges=8&from=OSL&to=BCN&depart=2026-10-23&ret=2026-10-30&direct=1",
    );
    expect(webSearchUrlForForm({ ...QUERY, tripType: "oneway" })).toBe("https://hellosky.no/sok?adults=1&children=0&infants=0&cabin=economy&from=OSL&to=BCN&depart=2026-10-23");
    expect(webSearchUrlForForm({ ...QUERY, destination: null })).toBeNull();
  });
});
