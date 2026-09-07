import { describe, expect, it } from "vitest";
import {
  buildBreakdown,
  computeServiceFeeMinor,
  FLAT_FEE_BY_CURRENCY,
  flatFeeMinorFor,
  priceWithServiceFee,
  SERVICE_FEE_FLAT,
} from "./pricing";
import { addAmounts } from "./money";

describe("computeServiceFeeMinor", () => {
  it("legger på 8 % (rundet til hel krone) + 250 kr i NOK", () => {
    // 1000 kr → 80 kr + 250 kr = 330 kr
    expect(computeServiceFeeMinor(100_000, "NOK")).toBe(33_000);
  });

  it("runder prosentdelen til nærmeste hele hovedenhet", () => {
    // 999 kr × 8 % = 79.92 → 80 kr
    expect(computeServiceFeeMinor(99_900, "NOK")).toBe(8_000 + 25_000);
    // 12 499 kr × 8 % = 999.92 → 1000 kr
    expect(computeServiceFeeMinor(1_249_900, "NOK")).toBe(100_000 + 25_000);
  });

  it("bruker fast gebyr per valuta og EUR som fallback", () => {
    expect(computeServiceFeeMinor(0, "EUR")).toBe(FLAT_FEE_BY_CURRENCY.EUR);
    expect(computeServiceFeeMinor(0, "GBP")).toBe(FLAT_FEE_BY_CURRENCY.GBP);
    expect(computeServiceFeeMinor(0, "CHF")).toBe(FLAT_FEE_BY_CURRENCY.EUR);
    expect(flatFeeMinorFor("usd")).toBe(FLAT_FEE_BY_CURRENCY.USD);
  });

  it("håndterer valuta uten desimaler (JPY)", () => {
    // 10 000 JPY × 8 % = 800 JPY, + EUR-fallback 2300
    expect(computeServiceFeeMinor(10_000, "JPY")).toBe(800 + FLAT_FEE_BY_CURRENCY.EUR);
  });

  it("støtter overstyring av prosent og fast gebyr", () => {
    expect(computeServiceFeeMinor(100_000, "NOK", { percent: 0.1, flatByCurrency: { NOK: 10_000 } })).toBe(20_000);
  });

  it("avviser ugyldige beløp", () => {
    expect(() => computeServiceFeeMinor(-1, "NOK")).toThrow();
    expect(() => computeServiceFeeMinor(10.5, "NOK")).toThrow();
  });
});

describe("buildBreakdown", () => {
  it("summerer leverandør + tilvalg + gebyr − bonus i minste enhet", () => {
    const b = buildBreakdown({ supplierMinor: 100_000, servicesMinor: 54_900, bonusUsedMinor: 10_000, currency: "nok" });
    expect(b).toEqual({
      currency: "NOK",
      supplierAmountMinor: 100_000,
      servicesAmountMinor: 54_900,
      serviceFeeAmountMinor: 33_000,
      bonusUsedMinor: 10_000,
      totalAmountMinor: 100_000 + 54_900 + 33_000 - 10_000,
    });
  });

  it("gebyret beregnes kun av leverandørprisen (ikke av tilvalg)", () => {
    const a = buildBreakdown({ supplierMinor: 100_000, servicesMinor: 0, bonusUsedMinor: 0, currency: "NOK" });
    const b = buildBreakdown({ supplierMinor: 100_000, servicesMinor: 99_900, bonusUsedMinor: 0, currency: "NOK" });
    expect(a.serviceFeeAmountMinor).toBe(b.serviceFeeAmountMinor);
  });

  it("nekter bonus som overstiger totalen", () => {
    expect(() => buildBreakdown({ supplierMinor: 1_000, servicesMinor: 0, bonusUsedMinor: 999_999, currency: "NOK" })).toThrow();
  });
});

describe("priceWithServiceFee (legacy, NOK)", () => {
  it("legger på 8 % + 250 kr", () => {
    const p = priceWithServiceFee("1000.00");
    expect(p.percentPart).toBe("80.00");
    expect(p.flatPart).toBe("250.00");
    expect(p.serviceFeeAmount).toBe("330.00");
    expect(p.totalAmount).toBe("1330.00");
  });

  it("runder prosentdelen til nærmeste krone", () => {
    const p = priceWithServiceFee("999.00");
    expect(p.percentPart).toBe("80.00");
    expect(p.serviceFeeAmount).toBe(addAmounts("80.00", SERVICE_FEE_FLAT));
  });

  it("null grunnpris gir kun fast gebyr", () => {
    const p = priceWithServiceFee("0.00");
    expect(p.serviceFeeAmount).toBe("250.00");
    expect(p.totalAmount).toBe("250.00");
  });
});
