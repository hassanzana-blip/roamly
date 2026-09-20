import { describe, expect, it } from "vitest";
import { formatSupplierMoney } from "./format";

/** Intl skiller tall og valuta med harde mellomrom; testen bryr seg om tallet, ikke om tegnet. */
const norm = (v: string | null) => v?.replace(/[\s\u00a0\u202f]+/g, " ") ?? null;

describe("formatSupplierMoney", () => {
  it("rewrites supplier strings as Norwegian money", () => {
    expect(norm(formatSupplierMoney("NOK 450", "nb-NO"))).toBe("450 kr");
    expect(norm(formatSupplierMoney("NOK58.0", "nb-NO"))).toBe("58 kr");
    expect(norm(formatSupplierMoney("450.00 NOK", "nb-NO"))).toBe("450 kr");
  });
  it("reads thousands separators without inflating or shrinking the amount", () => {
    expect(norm(formatSupplierMoney("NOK 1,250", "nb-NO"))).toBe("1 250 kr");
    expect(norm(formatSupplierMoney("NOK 1.250", "nb-NO"))).toBe("1 250 kr");
    expect(norm(formatSupplierMoney("NOK 1 250,50", "nb-NO"))).toBe("1 251 kr");
  });
  it("keeps other currencies as themselves", () => {
    expect(formatSupplierMoney("EUR 25", "nb-NO")).toContain("25");
  });
  it("shows nothing rather than something unreadable", () => {
    expect(formatSupplierMoney("")).toBeNull();
    expect(formatSupplierMoney(null)).toBeNull();
    expect(formatSupplierMoney("Not available")).toBeNull();
  });
});
