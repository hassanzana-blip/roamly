import { describe, expect, it } from "vitest";
import { mapOffer } from "./duffel";

/**
 * Bagasje: «flyselskapet sa 0» og «flyselskapet sa ingenting» er to ulike ting.
 * Det første er «ikke inkludert», det andre er «ikke oppgitt». Vi må aldri
 * vise det andre som det første.
 */
const seg = (baggages: { type: string; quantity: number }[] | undefined) => ({
  id: "seg",
  origin: { iata_code: "OSL", name: "Oslo Gardermoen", city_name: "Oslo" },
  destination: { iata_code: "LHR", name: "Heathrow", city_name: "London" },
  departing_at: "2026-10-15T08:10:00",
  arriving_at: "2026-10-15T09:30:00",
  duration: "PT2H20M",
  marketing_carrier: { iata_code: "SK", name: "SAS" },
  marketing_carrier_flight_number: "805",
  passengers: [{ passenger_id: "pax_1", cabin_class: "economy", ...(baggages ? { baggages } : {}) }],
});

const offer = (baggages: { type: string; quantity: number }[] | undefined) =>
  ({
    id: "off_1",
    total_amount: "1000.00",
    total_currency: "NOK",
    owner: { iata_code: "SK", name: "SAS" },
    passengers: [{ id: "pax_1", type: "adult" }],
    slices: [{ id: "sli_1", origin: { iata_code: "OSL" }, destination: { iata_code: "LHR" }, duration: "PT2H20M", segments: [seg(baggages)] }],
  }) as never;

describe("Duffel: bagasje — oppgitt kontra ukjent", () => {
  it("0 kolli oppgitt eksplisitt er «ikke inkludert», ikke ukjent", () => {
    const o = mapOffer(offer([{ type: "carry_on", quantity: 1 }, { type: "checked", quantity: 0 }]));
    expect(o.baggage).toEqual({ carryOnBags: 1, checkedBags: 0 });
  });

  it("mangler innsjekket i listen, er innsjekket ukjent", () => {
    const o = mapOffer(offer([{ type: "carry_on", quantity: 1 }]));
    expect(o.baggage).toEqual({ carryOnBags: 1, checkedBags: 0, checkedUnknown: true });
  });

  it("mangler hele listen, er begge ukjente", () => {
    const o = mapOffer(offer(undefined));
    expect(o.baggage.carryOnUnknown).toBe(true);
    expect(o.baggage.checkedUnknown).toBe(true);
  });
});
