import { describe, expect, it } from "vitest";
import { datesFor } from "./tripDates";

describe("datesFor", () => {
  it("sends «neste helg» to the coming Friday", () => {
    // Onsdag 2026-10-14 → fredag 2026-10-16
    expect(datesFor("weekend", 2, new Date("2026-10-14T09:00:00Z")).depart).toBe("2026-10-16");
  });
  it("skips today when today is already Friday", () => {
    expect(datesFor("weekend", 2, new Date("2026-10-16T09:00:00Z")).depart).toBe("2026-10-23");
  });
  it("returns home after the chosen number of nights", () => {
    const { depart, ret } = datesFor("weekend", 3, new Date("2026-10-14T09:00:00Z"));
    expect(depart).toBe("2026-10-16");
    expect(ret).toBe("2026-10-19");
  });
  it("counts a month and a quarter from today", () => {
    expect(datesFor("month", 7, new Date("2026-01-01T09:00:00Z")).depart).toBe("2026-01-31");
    expect(datesFor("quarter", 7, new Date("2026-01-01T09:00:00Z")).depart).toBe("2026-04-01");
  });
});
