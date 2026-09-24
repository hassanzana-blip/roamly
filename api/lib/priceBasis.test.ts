import { describe, expect, it } from "vitest";
import { mapPollResponse, parsePollResponse, priceBasisOf } from "./kayak";
import { priceBasisFor } from "./priceBasis";
import type { SearchPassengerInput } from "../../contracts/types";

// Prisgrunnlaget: KAYAK-svar kalles bare en total for alle når svaret selv sier «total» og har priset nøyaktig de
// reisende det ble søkt for. Ingenting ganges opp, og beløpene er urørt.

const ADULT: SearchPassengerInput = { type: "adult" };
const FAMILY: SearchPassengerInput[] = [ADULT, ADULT, { type: "child", age: 8 }, { type: "child", age: 14 }, { type: "infant_without_seat", age: 1 }];
const FAMILY_COUNTS = { adults: 2, children: 1, infants: 1, infantsInSeat: 0, seniors: 0, students: 0, youth: 1 };
const ONE = { adults: 1, children: 0, infants: 0, infantsInSeat: 0, seniors: 0, students: 0, youth: 0 };
const kayak = (mode: unknown, passengers: unknown) => ({ provider: "kayak" as const, priceBasis: priceBasisOf({ priceMode: mode as string | undefined, passengers }) });

describe("priceBasisOf: KAYAKs egne felter, uendret", () => {
  it("leser priceMode og antall; uleselige antall blir null, ikke gjettet", () => {
    expect(priceBasisOf({ priceMode: "total", passengers: ONE })).toEqual({ mode: "total", passengers: ONE });
    expect(priceBasisOf({ priceMode: undefined, passengers: undefined })).toEqual({ mode: null, passengers: null });
    for (const bad of [{ adults: "2" }, { adults: -1 }, { adults: 1.5 }, [1, 2], "2 adults", null]) {
      expect(priceBasisOf({ priceMode: "total", passengers: bad }).passengers).toBeNull();
    }
  });
});

describe("priceBasisFor", () => {
  it("total og nøyaktig samme reisende (også ungdom og spedbarn på fanget): en total for alle", () => {
    expect(priceBasisFor(kayak("total", FAMILY_COUNTS), FAMILY)).toEqual({ kind: "total" });
    expect(priceBasisFor(kayak("total", ONE), [ADULT])).toEqual({ kind: "total" });
  });

  it("perPerson: bare én reisende som stemmer med svaret er en total; ellers ubekreftet", () => {
    expect(priceBasisFor(kayak("perPerson", ONE), [ADULT])).toEqual({ kind: "total" });
    expect(priceBasisFor(kayak("perPerson", FAMILY_COUNTS), FAMILY)).toEqual({ kind: "unverified", reason: "per_person" });
    expect(priceBasisFor(kayak("perPerson", undefined), [ADULT])).toEqual({ kind: "unverified", reason: "party_missing" });
    expect(priceBasisFor(kayak("perPerson", { ...ONE, adults: 2 }), [ADULT])).toEqual({ kind: "unverified", reason: "party_mismatch" });
  });

  it("manglende eller ukjent priceMode blir aldri bekreftet – heller ikke for én reisende", () => {
    expect(priceBasisFor(kayak(undefined, ONE), [ADULT])).toEqual({ kind: "unverified", reason: "mode_missing" });
    expect(priceBasisFor({ provider: "kayak" }, [ADULT])).toEqual({ kind: "unverified", reason: "mode_missing" });
    expect(priceBasisFor(kayak("TOTAL", ONE), [ADULT])).toEqual({ kind: "unverified", reason: "mode_unknown" });
    expect(priceBasisFor(kayak("perTraveler", ONE), [ADULT])).toEqual({ kind: "unverified", reason: "mode_unknown" });
  });

  it("total, men manglende, ufullstendige eller andre reisende: ubekreftet", () => {
    expect(priceBasisFor(kayak("total", undefined), FAMILY)).toEqual({ kind: "unverified", reason: "party_missing" });
    expect(priceBasisFor(kayak("total", { adults: 2 }), FAMILY)).toEqual({ kind: "unverified", reason: "party_missing" });
    expect(priceBasisFor(kayak("total", { adults: "2", children: 1, youth: 1, infants: 1 }), FAMILY)).toEqual({ kind: "unverified", reason: "party_missing" });
    // Ungdom (14) telt som barn, spedbarn i eget sete, én voksen for lite, en ekstra senior:
    expect(priceBasisFor(kayak("total", { ...FAMILY_COUNTS, children: 2, youth: 0 }), FAMILY)).toEqual({ kind: "unverified", reason: "party_mismatch" });
    expect(priceBasisFor(kayak("total", { ...FAMILY_COUNTS, infants: 0, infantsInSeat: 1 }), FAMILY)).toEqual({ kind: "unverified", reason: "party_mismatch" });
    expect(priceBasisFor(kayak("total", { ...FAMILY_COUNTS, adults: 1 }), FAMILY)).toEqual({ kind: "unverified", reason: "party_mismatch" });
    expect(priceBasisFor(kayak("total", { ...FAMILY_COUNTS, seniors: 1 }), FAMILY)).toEqual({ kind: "unverified", reason: "party_mismatch" });
  });

  it("andre leverandører er totaler i sine egne kontrakter (Duffel, Travelport, demo, eldre svar uten leverandør)", () => {
    for (const provider of ["duffel", "travelport", "demo", undefined] as const) expect(priceBasisFor({ provider }, FAMILY)).toEqual({ kind: "total" });
  });
});

describe("kartleggingen er urørt av prisgrunnlaget", () => {
  const body = (mode: string | undefined, fees: boolean) => ({
    searchId: "s",
    status: "complete",
    currency: "NOK",
    ...(mode ? { priceMode: mode } : {}),
    passengers: ONE,
    results: [
      {
        id: "r1",
        bookingOptions: [
          { type: "regular", bookingUrl: "https://www.kayak.no/book/a", providerCode: "SK", displayPrice: { price: 1200 }, ...(fees ? { fees: { totalPrice: { price: 1500 } } } : {}) },
        ],
        legs: [{ id: "L1" }],
      },
    ],
    legs: { L1: { duration: 60, segments: [{ id: "S1" }], arrivalTime: "2026-10-28T08:00:00", departureTime: "2026-10-28T07:00:00" } },
    segments: { S1: { airline: "SK", flightNumber: "1", origin: "OSL", destination: "BCN", arrivalTime: "2026-10-28T08:00:00", departureTime: "2026-10-28T07:00:00", duration: 60 } },
  });
  const input = { slices: [{ origin: "OSL", destination: "BCN", departureDate: "2026-10-28" }], passengers: [ADULT], cabinClass: "economy" as const };
  const ctx = { searchId: "s", expiresAt: "2099-01-01T00:00:00Z", sandbox: true };

  it.each(["total", "perPerson", undefined])("priceMode %s: fees.totalPrice først, ellers displayPrice; samme beløp og lenke, aldri ganget", (mode) => {
    const withFees = mapPollResponse(parsePollResponse(body(mode, true)), { ...input, passengers: [ADULT, ADULT] }, ctx);
    expect(withFees.map((o) => [o.totalAmount, o.booking?.kind === "external" ? o.booking.url : null])).toEqual([["1500.00", "https://www.kayak.no/book/a"]]);
    const displayOnly = mapPollResponse(parsePollResponse(body(mode, false)), { ...input, passengers: [ADULT, ADULT] }, ctx);
    expect(displayOnly.map((o) => o.totalAmount)).toEqual(["1200.00"]);
  });
});
