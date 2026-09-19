import { describe, expect, it } from "vitest";
import type { CarOffer } from "@contracts/cars";
import { carTerms } from "./carTerms";

const t = (key: string, params?: Record<string, string | number>) => (params ? `${key}:${Object.values(params).join("/")}` : key);

const base: CarOffer = {
  id: "1", model: "Fiat", orSimilar: true, className: "Economy", seats: 5, bags: 2, doors: 4, transmission: "manual", airConditioning: true,
  agency: { code: "hertz", name: "Hertz" }, provider: { code: "p", name: "P" },
  pickup: { name: "BOS", locationType: "shuttle" }, dropoff: { name: "BOS", sameAsPickup: true },
  policies: ["100 mi", "full-to-full", "Free Cancellation", "Great Deal"],
  mileage: { code: "limited", limit: 100, unit: "mi", displayName: "100 mi" },
  fuelPolicy: { code: "fullToFull", displayName: "full-to-full" },
  cancellationLimitHours: 24,
  badges: [{ code: "freeCancellation", displayName: "Free Cancellation" }, { code: "greatDeal", displayName: "Great Deal" }],
  features: [{ code: "ac", displayName: "Air Conditioning" }, { code: "mystery", displayName: "Mystery Box" }],
  unlimitedMileage: false, freeCancellation: true, days: 2, perDayAmount: 30, totalAmount: 60, currency: "USD", bookUrl: "https://x",
};

describe("carTerms", () => {
  it("oversetter kjente koder og utelater engelsk råtekst og reklamemerker", () => {
    expect(carTerms(base, t)).toEqual(["cr.mileage.limited:100/cr.unit.mi", "cr.cancel.until:24", "cr.fuel.fullToFull", "cr.feature.ac"]);
  });

  it("sier aldri «inkludert» om noe leverandøren ikke har oppgitt", () => {
    const bare: CarOffer = { ...base, mileage: null, fuelPolicy: null, cancellationLimitHours: null, badges: [], features: [], freeCancellation: null };
    expect(carTerms(bare, t)).toEqual([]);
    expect(carTerms({ ...bare, mileage: { code: "unlimited" }, freeCancellation: true }, t)).toEqual(["cr.mileage.unlimited", "cr.cancel.free"]);
  });
});
