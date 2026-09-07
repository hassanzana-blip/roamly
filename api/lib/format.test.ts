import { describe, expect, it } from "vitest";
import {
  crossesMidnight,
  formatClock,
  formatDateShort,
  formatDuration,
  formatPrice,
} from "@/lib/format";

const tidy = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");

describe("formatPrice", () => {
  it("formats NOK with no decimals and Norwegian grouping", () => {
    expect(tidy(formatPrice(2460))).toBe("2 460 kr");
    expect(tidy(formatPrice("987"))).toBe("987 kr");
  });

  it("formats other currencies with two decimals", () => {
    expect(tidy(formatPrice("12.5", "EUR"))).toContain("12,50");
  });

  it("falls back gracefully for an invalid currency code", () => {
    expect(formatPrice(10, "NOPE")).toBe("10 NOPE");
  });
});

describe("formatDuration", () => {
  it("handles minutes-only, hours-only and mixed durations", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 t");
    expect(formatDuration(85)).toBe("1 t 25 min");
    expect(formatDuration(0)).toBe("0 min");
  });
});

describe("crossesMidnight", () => {
  it("returns 0 for same-day arrival and 1 for next-day arrival", () => {
    expect(crossesMidnight("2026-10-12T06:00:00Z", "2026-10-12T09:30:00Z")).toBe(0);
    expect(crossesMidnight("2026-10-12T22:00:00Z", "2026-10-13T06:05:00Z")).toBe(1);
  });

  it("counts multiple days for long-haul itineraries", () => {
    expect(crossesMidnight("2026-10-12T10:00:00Z", "2026-10-14T05:00:00Z")).toBe(2);
  });
});

describe("date/time formatters", () => {
  it("formats clock time as HH:mm", () => {
    expect(formatClock("2026-10-12T14:30:00Z")).toMatch(/^\d{2}[:.]\d{2}$/);
  });

  it("formats dates in Norwegian", () => {
    expect(formatDateShort("2026-10-12T14:30:00Z")).toMatch(/okt/i);
  });
});
