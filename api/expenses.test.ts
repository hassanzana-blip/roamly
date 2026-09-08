import { describe, expect, it } from "vitest";
import { EXPENSE_CATEGORIES, VAT_RATES, vatFromGross } from "./expenses";

/**
 * Mva regnes ut på serveren, fra bruttobeløpet. Regnestykket må stemme med det
 * regnskapsføreren gjør for hånd, og det må stemme hver gang – to bilag med
 * samme sum skal aldri få ulik mva.
 */
describe("mva av bruttobeløp", () => {
  it("25 % av 1 250,00 er 250,00", () => {
    expect(vatFromGross(125_000, 2500)).toBe(25_000);
  });

  it("12 % av 1 120,00 er 120,00", () => {
    expect(vatFromGross(112_000, 1200)).toBe(12_000);
  });

  it("15 % av 115,00 er 15,00", () => {
    expect(vatFromGross(11_500, 1500)).toBe(1_500);
  });

  it("uten sats er det ingen mva", () => {
    expect(vatFromGross(99_900, null)).toBe(0);
    expect(vatFromGross(99_900, 0)).toBe(0);
  });

  it("netto pluss mva er alltid nøyaktig brutto – ingen øre på avveie", () => {
    for (const rate of VAT_RATES.map((v) => v.bp)) {
      for (let gross = 1; gross < 5000; gross += 7) {
        const vat = vatFromGross(gross, rate);
        expect(gross - vat + vat).toBe(gross);
        expect(vat).toBeGreaterThanOrEqual(0);
        expect(vat).toBeLessThan(gross);
      }
    }
  });

  it("kategoriene har unike id-er", () => {
    const ids = EXPENSE_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
