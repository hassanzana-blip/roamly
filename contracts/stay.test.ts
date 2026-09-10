import { describe, expect, it } from "vitest";
import { searchHotels, searchCars, searchCruises } from "./stay";

describe("stay-katalog (demomodus)", () => {
  it("hoteller: deterministisk for samme søk", () => {
    const a = searchHotels("Barcelona", "2026-09-28", "2026-10-02", 2);
    const b = searchHotels("Barcelona", "2026-09-28", "2026-10-02", 2);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(8);
  });

  it("hoteller: totalpris = pris per natt × netter, sortert billigst", () => {
    const list = searchHotels("Roma", "2026-10-05", "2026-10-09", 2);
    for (const h of list) {
      expect(h.nights).toBe(4);
      expect(h.totalPrice).toBe(h.pricePerNight * h.nights);
      expect(h.totalPrice).toBeGreaterThan(0);
    }
    for (let i = 1; i < list.length; i++) {
      expect(list[i].totalPrice).toBeGreaterThanOrEqual(list[i - 1].totalPrice);
    }
  });

  it("biler: totalpris = pris per dag × dager, fra alle partnere", () => {
    const list = searchCars("Oslo lufthavn", "2026-09-28", "2026-10-02");
    expect(list.length).toBe(20); // 5 klasser × 4 partnere
    const partners = new Set(list.map((c) => c.partner));
    expect(partners).toEqual(new Set(["Europcar", "Hertz", "Avis", "Sixt"]));
    for (const c of list) {
      expect(c.days).toBe(4);
      expect(c.totalPrice).toBe(c.pricePerDay * c.days);
    }
  });

  it("cruise: deterministisk, totalpris = pris per person × gjester", () => {
    const a = searchCruises("2026-10-05", 2);
    const b = searchCruises("2026-10-05", 2);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(5);
    const regions = new Set(a.map((c) => c.region));
    expect(regions.size).toBeGreaterThanOrEqual(4);
    for (const c of a) {
      expect(c.totalPrice).toBe(c.pricePerPerson * 2);
      expect(c.totalPrice).toBeGreaterThan(0);
      expect(c.nights).toBeGreaterThanOrEqual(5);
      expect(c.image).toMatch(/^\/photos\//);
      expect(c.departureDate >= "2026-10-05").toBe(true);
    }
    for (let i = 1; i < a.length; i++) {
      expect(a[i].totalPrice).toBeGreaterThanOrEqual(a[i - 1].totalPrice);
    }
  });
});
