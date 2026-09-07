import { describe, expect, it } from "vitest";
import { calcExtras, distributeBags, seatHolders } from "./extras";

describe("extras-kontrakt (klient = server, minste enhet)", () => {
  it("priser ekstra kolli i minste enhet", () => {
    const r = calcExtras({ passengerTypes: ["adult", "adult"], extraBags: 2, bagPriceMinor: 54900, currency: "NOK" });
    expect(r.bagsMinor).toBe(109800);
    expect(r.total).toBe(109800);
    expect(r.currency).toBe("NOK");
  });

  it("null kolli koster ingenting", () => {
    const r = calcExtras({ passengerTypes: ["adult"], extraBags: 0, bagPriceMinor: 54900, currency: "NOK" });
    expect(r.total).toBe(0);
  });

  it("avviser flyttall og negative verdier", () => {
    expect(() => calcExtras({ passengerTypes: ["adult"], extraBags: 1.5, bagPriceMinor: 100, currency: "NOK" })).toThrow();
    expect(() => calcExtras({ passengerTypes: ["adult"], extraBags: -1, bagPriceMinor: 100, currency: "NOK" })).toThrow();
    expect(() => calcExtras({ passengerTypes: ["adult"], extraBags: 1, bagPriceMinor: 10.5, currency: "NOK" })).toThrow();
  });

  it("seatHolders teller ikke baby i fang", () => {
    expect(seatHolders(["adult", "child", "infant_without_seat"])).toBe(2);
  });
});

describe("distributeBags", () => {
  const pax = [
    { id: "a", type: "adult" as const },
    { id: "b", type: "adult" as const },
    { id: "i", type: "infant_without_seat" as const },
  ];

  it("fordeler rund-robin på reisende med eget sete", () => {
    expect(distributeBags(pax, 3)).toEqual({ a: 2, b: 1 });
    expect(distributeBags(pax, 0)).toEqual({});
  });

  it("respekterer klientens fordeling når summen stemmer", () => {
    expect(distributeBags(pax, 2, { a: 0, b: 2 })).toEqual({ b: 2 });
  });

  it("ignorerer baby og faller tilbake ved feil sum", () => {
    expect(distributeBags(pax, 2, { i: 2 })).toEqual({ a: 1, b: 1 });
  });

  it("respekterer maks per reisende", () => {
    expect(distributeBags([{ id: "a", type: "adult" }], 5, undefined, 3)).toEqual({ a: 3 });
  });
});
