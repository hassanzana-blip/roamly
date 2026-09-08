import { describe, expect, it } from "vitest";
import { searchAirportsWorldwide, airportMetaByIata, WORLD_AIRPORT_COUNT } from "./airportMeta";

/**
 * Flyplassøket er kundens første møte med produktet. Det skal finne stedet
 * enten hun skriver med eller uten aksenter, og det skal svare på norsk.
 */
describe("searchAirportsWorldwide", () => {
  it("finner flyplasser utenfor det kuraterte settet", () => {
    expect(searchAirportsWorldwide("Tbilisi", 3).map((a) => a.iata)).toContain("TBS");
    expect(searchAirportsWorldwide("Gdansk", 3).map((a) => a.iata)).toContain("GDN");
  });

  it("bryr seg ikke om aksenter, ø, æ eller å", () => {
    expect(searchAirportsWorldwide("Malaga", 3).map((a) => a.iata)).toContain("AGP");
    expect(searchAirportsWorldwide("Kobenhavn", 3).map((a) => a.iata)).toContain("CPH");
    expect(searchAirportsWorldwide("Zurich", 3).map((a) => a.iata)).toContain("ZRH");
  });

  it("setter det kuraterte settet først", () => {
    const first = searchAirportsWorldwide("Oslo", 5)[0];
    expect(first.iata).toBe("OSL");
    expect(first.world).toBeUndefined();
  });

  it("oversetter landnavn til norsk der vi har navnet", () => {
    const krk = searchAirportsWorldwide("Krakow", 3).find((a) => a.iata === "KRK");
    expect(krk?.country).toBe("Polen");
  });

  it("slår opp på IATA og har et register av fornuftig størrelse", () => {
    expect(airportMetaByIata("bkk")?.city).toBeTruthy();
    expect(WORLD_AIRPORT_COUNT).toBeGreaterThan(2000);
  });
});
