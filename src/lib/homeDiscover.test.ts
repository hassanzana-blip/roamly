import { describe, expect, it } from "vitest";
import { ORIGINS, ORIGIN_LABEL, flightSearchHref, photographed, seasonKey } from "./homeDiscover";
import { airportByIata } from "@contracts/airports";

describe("flightSearchHref", () => {
  const trip = { depart: "2026-10-16", ret: "2026-10-19" };
  it("carries the budget in as a real price cap", () => {
    expect(flightSearchHref("OSL", { iata: "LIS" }, trip, 1500)).toContain("maxpris=1500");
  });
  it("leaves the cap out when no budget is chosen", () => {
    expect(flightSearchHref("OSL", { iata: "LIS" }, trip, null)).not.toContain("maxpris");
  });
  it("keeps the chosen airport and dates", () => {
    const href = flightSearchHref("BGO", { iata: "WAW" }, trip, null);
    expect(href).toContain("from=BGO");
    expect(href).toContain("to=WAW");
    expect(href).toContain("depart=2026-10-16");
    expect(href).toContain("ret=2026-10-19");
  });
});

describe("departure airports", () => {
  it("are all real airports we can search from", () => {
    for (const code of ORIGINS) expect(airportByIata(code), code).toBeDefined();
  });
  it("keeps Oslo and Torp apart", () => {
    expect(ORIGIN_LABEL.OSL).toBe("Oslo");
    expect(ORIGIN_LABEL.TRF).toBe("Torp");
    expect(airportByIata("TRF")?.city).not.toBe(airportByIata("OSL")?.city);
  });
});

describe("photographed", () => {
  it("only returns destinations that have a checked photo and an airport", () => {
    const picks = photographed(["lisboa", "warszawa", "asmara", "not-a-place"]);
    expect(picks.map((d) => d.id)).toEqual(["lisboa", "warszawa"]);
    for (const d of picks) expect(d.image).toBeTruthy();
  });
});

describe("seasonKey", () => {
  it("follows the calendar rather than staying on autumn", () => {
    expect(seasonKey(0)).toBe("winter");
    expect(seasonKey(3)).toBe("spring");
    expect(seasonKey(6)).toBe("summer");
    expect(seasonKey(9)).toBe("autumn");
    expect(seasonKey(11)).toBe("winter");
  });
});
