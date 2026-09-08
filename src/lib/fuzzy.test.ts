import { describe, expect, it } from "vitest";
import { fuzzyScore, rankByQuery } from "./fuzzy";

describe("fuzzyScore", () => {
  it("rangerer treff fra starten høyest", () => {
    expect(fuzzyScore("Refusjoner", "ref")).toBeGreaterThan(fuzzyScore("Prisrefusjon", "ref"));
  });

  it("finner tegn i rekkefølge, med hull", () => {
    expect(fuzzyScore("Bestillinger", "bstl")).toBeGreaterThan(0);
    expect(fuzzyScore("Bestillinger", "zzz")).toBe(-1);
  });

  it("tom søkestreng treffer alt", () => {
    expect(fuzzyScore("hva som helst", "")).toBe(1);
  });
});

describe("rankByQuery", () => {
  const items = [
    { label: "Refusjoner", keywords: "refund tilbakebetaling" },
    { label: "Rapporter", keywords: "omsetning tall" },
    { label: "Bestillinger", keywords: "ordre booking" },
  ];

  it("navnet veier tyngre enn stikkordene", () => {
    expect(rankByQuery(items, "refu")[0].label).toBe("Refusjoner");
    // «booking» finnes bare som stikkord, men skal likevel finne siden
    expect(rankByQuery(items, "booking")[0].label).toBe("Bestillinger");
  });

  it("uten søk beholdes rekkefølgen", () => {
    expect(rankByQuery(items, "  ")).toEqual(items);
  });

  it("ingen treff gir tom liste, ikke alt", () => {
    expect(rankByQuery(items, "qqqq")).toEqual([]);
  });
});
