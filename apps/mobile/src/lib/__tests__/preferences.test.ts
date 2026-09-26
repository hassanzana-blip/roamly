import { TRACKABLE_CARRIERS } from "@contracts/carriers";
import { DEFAULT_VIEW } from "../resultsView";
import { initialForm } from "../searchForm";
import { NOK_OFFER, SAME_TRIP_OTHER_SELLER } from "../../test/fixtures";
import {
  EMPTY_PREFS,
  PREF_AIRLINES,
  addAltAirport,
  avoidedIn,
  cycleAirline,
  hasFilterPrefs,
  isEmptyPrefs,
  parsePrefs,
  prefsApplied,
  prefsCount,
  prefsView,
  withPrefDefaults,
} from "../preferences";

const OSL = { iata: "OSL", name: "Oslo lufthavn Gardermoen", city: "Oslo", country: "Norge" };
const TRF = { iata: "TRF", name: "Sandefjord lufthavn Torp", city: "Sandefjord", country: "Norge" };
const BGO = { iata: "BGO", name: "Bergen lufthavn Flesland", city: "Bergen", country: "Norge" };
const SVG = { iata: "SVG", name: "Stavanger lufthavn Sola", city: "Stavanger", country: "Norge" };
const TOS = { iata: "TOS", name: "Tromsø lufthavn", city: "Tromsø", country: "Norge" };

describe("reisepreferanser (bare på telefonen)", () => {
  it("flyselskapene er de samme som nettets flystatus (contracts/carriers.ts)", () => {
    expect(PREF_AIRLINES).toEqual(TRACKABLE_CARRIERS);
  });

  it("fra fil: gyldige felt beholdes; ukjente verdier blir standard; aldri andre felt", () => {
    const p = parsePrefs({
      altAirports: [TRF, TRF, { iata: "xx" }, BGO, SVG, TOS],
      stops: "direct",
      cabin: "business",
      checkedBag: true,
      departBands: ["evening", "morning", "morning", "brunch"],
      arriveBands: "morning",
      airlines: ["SK", "ZZ", "SK"],
      avoidAirlines: ["FR", "SK"],
      passport: "N1234567",
      token: "hemmelig",
    });
    expect(p).toEqual({
      altAirports: [TRF, BGO, SVG],
      stops: "direct",
      cabin: "business",
      checkedBag: true,
      departBands: ["morning", "evening"],
      arriveBands: [],
      airlines: ["SK"],
      // Foretrukket vinner: SK kan ikke også unngås.
      avoidAirlines: ["FR"],
    });
    expect(JSON.stringify(p)).not.toMatch(/N1234567|hemmelig/);
    expect(parsePrefs("søppel")).toEqual(EMPTY_PREFS);
    expect(parsePrefs({ stops: "never", cabin: "cargo" })).toEqual(EMPTY_PREFS);
    expect(isEmptyPrefs(EMPTY_PREFS)).toBe(true);
    expect(isEmptyPrefs(p)).toBe(false);
  });

  it("andre flyplasser: nyeste først, aldri den vanlige, høyst tre", () => {
    let p = addAltAirport(EMPTY_PREFS, TRF, OSL);
    p = addAltAirport(p, OSL, OSL);
    p = addAltAirport(p, BGO, OSL);
    p = addAltAirport(p, SVG, OSL);
    p = addAltAirport(p, TOS, OSL);
    expect(p.altAirports.map((a) => a.iata)).toEqual(["TOS", "SVG", "BGO"]);
    expect(addAltAirport(p, SVG, OSL).altAirports.map((a) => a.iata)).toEqual(["SVG", "TOS", "BGO"]);
  });

  it("flyselskap: ingen mening → foretrukket → unngå → ingen mening", () => {
    const a = cycleAirline(EMPTY_PREFS, "SK");
    expect([a.airlines, a.avoidAirlines]).toEqual([["SK"], []]);
    const b = cycleAirline(a, "SK");
    expect([b.airlines, b.avoidAirlines]).toEqual([[], ["SK"]]);
    const c = cycleAirline(b, "SK");
    expect([c.airlines, c.avoidAirlines]).toEqual([[], []]);
  });

  it("nytt skjema: reiseklassen fra preferansene – ingenting annet endres, og uten valg står skjemaet urørt", () => {
    const f = initialForm(new Date("2026-09-25T12:00:00"));
    expect(withPrefDefaults(f, { ...EMPTY_PREFS, cabin: "business", stops: "direct" })).toEqual({ ...f, cabinClass: "business" });
    expect(withPrefDefaults(f, EMPTY_PREFS)).toBe(f);
  });

  it("resultatene: preferansene blir vanlige filtre bare på kundens valg; et selskap som ikke er i svaret, settes ikke", () => {
    const prefs = { ...EMPTY_PREFS, stops: "max1" as const, checkedBag: true, departBands: ["morning" as const], airlines: ["SK", "DY"] };
    const offers = [NOK_OFFER, SAME_TRIP_OTHER_SELLER];
    const v = prefsView({ ...DEFAULT_VIEW, sort: "price" }, prefs, offers);
    expect(v).toEqual({ ...DEFAULT_VIEW, sort: "price", stops: "max1", bags: true, departBands: ["morning"], airlines: ["SK"] });
    expect(prefsApplied(v, prefs, offers)).toBe(true);
    expect(prefsApplied(DEFAULT_VIEW, prefs, offers)).toBe(false);
    expect(hasFilterPrefs(prefs)).toBe(true);
    // Bare reiseklasse eller andre flyplasser er ikke filtre.
    expect(hasFilterPrefs({ ...EMPTY_PREFS, cabin: "business", altAirports: [TRF] })).toBe(false);
  });

  it("selskaper kunden vil unngå, merkes per tilbud (en gang hver) – tilbudet skjules ikke", () => {
    expect(avoidedIn(NOK_OFFER.offer, { ...EMPTY_PREFS, avoidAirlines: ["SK", "FR"] })).toEqual(["SK"]);
    expect(avoidedIn(NOK_OFFER.offer, EMPTY_PREFS)).toEqual([]);
  });

  it("antallet valg til oversikten teller hver preferanse én gang", () => {
    expect(prefsCount(EMPTY_PREFS, null)).toBe(0);
    expect(prefsCount({ ...EMPTY_PREFS, altAirports: [TRF, BGO], airlines: ["SK", "DY"], cabin: "business" }, OSL)).toBe(4);
  });
});
