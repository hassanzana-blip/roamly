import { describe, expect, it } from "vitest";
import { candidateDates, offerMatches } from "./watch";
import type { Offer } from "../contracts/types";

/**
 * Prisovervåking: reglene som avgjør om vi sier «funnet». Et falskt treff er
 * verre enn ingen treff — kunden klikker, og prisen i søket er en annen.
 */

const offer = (over: Partial<Offer> & { stops?: number[] } = {}): Offer => ({
  id: "off_1",
  totalAmount: "4200.00",
  totalCurrency: "NOK",
  baseAmount: "4000.00",
  taxAmount: "200.00",
  owner: { iata: "TK", name: "Turkish Airlines" },
  expiresAt: "",
  cabinClass: "economy",
  slices: (over.stops ?? [1]).map((stops, i) => ({
    id: `sli_${i}`,
    origin: { iata: "OSL", name: "", city: "Oslo", country: "NO", lat: 0, lng: 0 },
    destination: { iata: "EBL", name: "", city: "Erbil", country: "IQ", lat: 0, lng: 0 },
    departingAt: "2026-10-02T10:00:00",
    arrivingAt: "2026-10-02T20:00:00",
    durationMinutes: 600,
    stops,
    segments: [],
  })),
  passengers: [{ id: "pax", type: "adult" }],
  baggage: { carryOnBags: 1, checkedBags: 1 },
  emissionsKg: 0,
  refundable: false,
  changeable: false,
  ...over,
});

const noFee = () => 0;
const fee = (minor: number) => Math.round(minor * 0.05);

describe("Prisovervåking: treff", () => {
  it("godtar tilbud under grensen med riktig antall stopp og kolli", () => {
    const m = offerMatches(offer(), { maxPriceMinor: 500_000, currency: "NOK", maxStops: 1, minCheckedBags: 1 }, noFee);
    expect(m).toEqual({ ok: true, totalMinor: 420_000 });
  });

  it("regner vårt gebyr inn i totalen før sammenligning", () => {
    // 4 200 + 5 % = 4 410 — over en grense på 4 300, selv om leverandørprisen er under.
    const m = offerMatches(offer(), { maxPriceMinor: 430_000, currency: "NOK", maxStops: null, minCheckedBags: null }, fee);
    expect(m.ok).toBe(false);
    expect(m.totalMinor).toBe(441_000);
  });

  it("avviser for mange stopp", () => {
    expect(offerMatches(offer({ stops: [2] }), { maxPriceMinor: 500_000, currency: "NOK", maxStops: 1, minCheckedBags: null }, noFee).ok).toBe(false);
  });

  it("avviser når bagasjen er ukjent — «ikke oppgitt» er ikke «minst ett kolli»", () => {
    const o = offer({ baggage: { carryOnBags: 0, checkedBags: 0, checkedUnknown: true } });
    expect(offerMatches(o, { maxPriceMinor: 500_000, currency: "NOK", maxStops: null, minCheckedBags: 1 }, noFee).ok).toBe(false);
  });

  it("finner aldri på valutakurs — annen valuta er ikke et treff", () => {
    const o = offer({ totalCurrency: "EUR", totalAmount: "300.00" });
    expect(offerMatches(o, { maxPriceMinor: 500_000, currency: "NOK", maxStops: null, minCheckedBags: null }, noFee).ok).toBe(false);
  });
});

describe("Prisovervåking: datoer", () => {
  it("velger bare fredag og lørdag ved «kun helger»", () => {
    const dates = candidateDates("2026-10-01", "2026-10-11", true, "2026-09-01");
    for (const d of dates) expect([5, 6]).toContain(new Date(d).getUTCDay());
    expect(dates.length).toBeGreaterThan(0);
  });

  it("sprer maks fire datoer over hele perioden", () => {
    const dates = candidateDates("2026-10-01", "2026-12-01", false, "2026-09-01");
    expect(dates).toHaveLength(4);
    expect(dates[0]).toBe("2026-10-01");
    expect(dates[3]).toBe("2026-12-01");
  });

  it("hopper over datoer som allerede har passert", () => {
    const dates = candidateDates("2026-09-01", "2026-09-05", false, "2026-09-04");
    expect(dates).toEqual(["2026-09-04", "2026-09-05"]);
  });

  it("gir ingen datoer for en periode som er over", () => {
    expect(candidateDates("2026-01-01", "2026-01-05", false, "2026-09-04")).toEqual([]);
  });
});
