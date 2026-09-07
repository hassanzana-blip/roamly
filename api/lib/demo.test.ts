import { describe, expect, it } from "vitest";
import { demoSearch, demoPaxFactor, demoPriceHint, demoFlightStatus, demoGetOffer, demoCreateOrder, demoCancellationQuote, demoServicesMinor } from "./demo";
import type { SearchPassengerInput, SearchSliceInput } from "../../contracts/types";

const slices: SearchSliceInput[] = [
  { origin: "OSL", destination: "BCN", departureDate: "2026-10-12" },
  { origin: "BCN", destination: "OSL", departureDate: "2026-10-19" },
];

const passengers: SearchPassengerInput[] = [
  { type: "adult" },
  { type: "adult" },
  { type: "child", age: 7 },
  { type: "infant_without_seat", age: 1 },
];

describe("demoSearch", () => {
  it("is deterministic for prices and carriers", () => {
    const a = demoSearch({ slices, passengers, cabinClass: "economy" });
    const b = demoSearch({ slices, passengers, cabinClass: "economy" });
    const sig = (r: typeof a) => r.offers.map((o) => `${o.owner.iata}:${o.totalAmount}`);
    expect(sig(a)).toEqual(sig(b));
    expect(a.offers.length).toBeGreaterThan(0);
  });

  it("returns offers sorted by price, capped at 24", () => {
    const r = demoSearch({ slices, passengers, cabinClass: "economy" });
    expect(r.offers.length).toBeLessThanOrEqual(24);
    const prices = r.offers.map((o) => Number(o.totalAmount));
    expect([...prices].sort((x, y) => x - y)).toEqual(prices);
  });

  it("mirrors the requested slices and passengers (with ages)", () => {
    const r = demoSearch({ slices, passengers, cabinClass: "economy" });
    for (const offer of r.offers) {
      expect(offer.slices).toHaveLength(2);
      expect(offer.slices[0].origin.iata).toBe("OSL");
      expect(offer.slices[0].destination.iata).toBe("BCN");
      expect(offer.slices[1].origin.iata).toBe("BCN");
      // at most one stop per slice
      for (const s of offer.slices) expect(s.stops).toBeLessThanOrEqual(1);
      // base + tax equals total
      expect(Number(offer.baseAmount) + Number(offer.taxAmount)).toBe(Number(offer.totalAmount));
      // extras services are present and priced
      expect(offer.services?.maxExtraBags).toBeGreaterThan(0);
      expect(Number(offer.services?.extraBagPrice)).toBeGreaterThan(0);
      expect(offer.passengers).toHaveLength(4);
      expect(offer.passengers[2]).toMatchObject({ type: "child", age: 7 });
      expect(offer.passengers[3]).toMatchObject({ type: "infant_without_seat", age: 1 });
    }
  });

  it("supports multi-city slice shapes", () => {
    const r = demoSearch({
      slices: [
        { origin: "OSL", destination: "CPH", departureDate: "2026-10-12" },
        { origin: "CPH", destination: "LHR", departureDate: "2026-10-15" },
        { origin: "LHR", destination: "OSL", departureDate: "2026-10-20" },
      ],
      passengers: [{ type: "adult" }],
      cabinClass: "economy",
    });
    expect(r.offers.length).toBeGreaterThan(0);
    expect(r.offers[0].slices).toHaveLength(3);
  });

  it("stores offers retrievable via demoGetOffer", () => {
    const r = demoSearch({ slices, passengers, cabinClass: "economy" });
    const id = r.offers[0].id;
    expect(demoGetOffer(id)?.id).toBe(id);
    expect(demoGetOffer("off_does_not_exist")).toBeNull();
  });

  it("returns no offers for an unknown airport", () => {
    const r = demoSearch({
      slices: [{ origin: "XXX", destination: "YYY", departureDate: "2026-10-12" }],
      passengers: [{ type: "adult" }],
      cabinClass: "economy",
    });
    expect(r.offers).toHaveLength(0);
  });
});

describe("demoPriceHint", () => {
  it("returns a numeric string for a known route", () => {
    const hint = demoPriceHint("OSL", "BCN", "economy", "2026-10-12", 2);
    expect(hint).not.toBeNull();
    expect(Number(hint)).toBeGreaterThan(0);
  });

  it("is deterministic and scales with the passenger factor", () => {
    const one = Number(demoPriceHint("OSL", "BCN", "economy", "2026-10-12", 1));
    const two = Number(demoPriceHint("OSL", "BCN", "economy", "2026-10-12", 2));
    expect(two).toBeCloseTo(one * 2, -1);
    expect(demoPaxFactor(["adult", "adult", "child", "infant_without_seat"])).toBeCloseTo(2.85);
  });

  it("prices a round trip above a one-way for the same day", () => {
    const oneway = Number(demoPriceHint("OSL", "BCN", "economy", "2026-10-12", 1));
    const roundtrip = Number(demoPriceHint("OSL", "BCN", "economy", "2026-10-12", 1, "2026-10-19"));
    expect(roundtrip).toBeGreaterThan(oneway);
    expect(roundtrip).toBeLessThan(oneway * 2 + 500);
  });

  it("returns null for unknown airports", () => {
    expect(demoPriceHint("XXX", "YYY", "economy", "2026-10-12", 1)).toBeNull();
  });
});

describe("demo offers carry supplier-shaped conditions", () => {
  it("exposes conditions, identity-document flag, time zones and per-segment baggage", () => {
    const r = demoSearch({ slices, passengers, cabinClass: "economy" });
    for (const offer of r.offers) {
      expect(offer.conditions?.refundBeforeDeparture?.allowed).toBe(offer.refundable);
      expect(typeof offer.identityDocumentsRequired).toBe("boolean");
      expect(offer.slices[0].origin.timeZone).toBe("Europe/Oslo");
      expect(offer.slices[0].segments[0].baggage).toBeDefined();
      expect(offer.services?.bagServiceId).toBeTruthy();
    }
  });
});

describe("demoCreateOrder", () => {
  it("creates a Duffel-shaped order with PNR, tickets and attempt metadata", () => {
    const r = demoSearch({ slices, passengers, cabinClass: "economy" });
    const offer = r.offers[0];
    const pax = offer.passengers.map((p, i) => ({ id: p.id, givenName: `Kari${i}`, familyName: "Nordmann", type: p.type }));
    const order = demoCreateOrder({ offer, passengers: pax, amountMinor: Number(offer.totalAmount) * 100 + 54900, attemptId: 42 });
    expect(order.id.startsWith("ord_demo_")).toBe(true);
    expect(order.bookingReference).toHaveLength(6);
    expect(order.tickets).toHaveLength(4);
    expect(order.metadata.attempt_id).toBe("42");
    expect(order.totalAmount).toBe(`${Number(offer.totalAmount) + 549}.00`);
    expect(order.cancelledAt).toBeNull();
  });

  it("can create an order without PNR (BOOKING_PROCESSING path)", () => {
    const r = demoSearch({ slices, passengers, cabinClass: "economy" });
    const offer = r.offers[0];
    const order = demoCreateOrder({ offer, passengers: [], amountMinor: 100000, attemptId: "x", withPnr: false });
    expect(order.bookingReference).toBe("");
    expect(order.tickets).toHaveLength(0);
  });

  it("quotes 80 % refund on cancellation and prices extra bags in minor units", () => {
    const q = demoCancellationQuote("ord_demo_x", 100_000, "NOK");
    expect(q.refundMinor).toBe(80_000);
    expect(q.refundAmount).toBe("800.00");
    const r = demoSearch({ slices, passengers, cabinClass: "economy" });
    const offer = r.offers[0];
    expect(demoServicesMinor(offer, 2)).toBe(Number(offer.services?.extraBagPrice) * 100 * 2);
  });
});

describe("demoFlightStatus", () => {
  it("returns a deterministic status for a known carrier", () => {
    const a = demoFlightStatus("DY", "400", "2026-10-12");
    const b = demoFlightStatus("DY", "400", "2026-10-12");
    expect(a).not.toBeNull();
    expect(a).toEqual(b);
    expect(a?.carrier.iata).toBe("DY");
  });

  it("returns null for an unknown carrier", () => {
    expect(demoFlightStatus("ZZ", "1", "2026-10-12")).toBeNull();
  });
});
