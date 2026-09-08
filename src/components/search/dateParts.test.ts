import { describe, expect, it } from "vitest";

/**
 * Regelen `DateParts` melder fra etter: en dato eksisterer bare når året har
 * fire siffer og datoen overlever en tur gjennom `Date`. 31. februar skal bli
 * ingenting, ikke 3. mars.
 */
function isoFrom(d: string, m: string, y: string): string {
  if (d.length === 0 && m.length === 0 && y.length === 0) return "";
  if (y.length !== 4 || m.length === 0 || d.length === 0) return "";
  const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const probe = new Date(`${iso}T00:00:00Z`);
  const round = Number.isNaN(probe.getTime()) ? "" : probe.toISOString().slice(0, 10);
  return round === iso ? iso : "";
}

describe("dato i tre deler", () => {
  it("setter sammen en vanlig dato", () => {
    expect(isoFrom("7", "3", "1987")).toBe("1987-03-07");
    expect(isoFrom("31", "12", "2030")).toBe("2030-12-31");
  });

  it("gir ingenting før alle tre er utfylt", () => {
    expect(isoFrom("", "", "")).toBe("");
    expect(isoFrom("7", "3", "")).toBe("");
    expect(isoFrom("7", "3", "19")).toBe("");
    expect(isoFrom("", "3", "1987")).toBe("");
  });

  it("lar ikke en dato som ikke finnes gli gjennom som en annen", () => {
    // 31. februar ville blitt 3. mars om vi stolte på Date alene.
    expect(isoFrom("31", "2", "1987")).toBe("");
    expect(isoFrom("30", "2", "2024")).toBe("");
    expect(isoFrom("31", "4", "2025")).toBe("");
  });

  it("kjenner skuddår", () => {
    expect(isoFrom("29", "2", "2024")).toBe("2024-02-29");
    expect(isoFrom("29", "2", "2023")).toBe("");
  });
});
