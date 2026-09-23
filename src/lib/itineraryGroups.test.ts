import { describe, expect, it } from "vitest";
import type { Offer } from "@contracts/types";
import { groupOffers, itinerarySignature } from "./itineraryGroups";

/**
 * Reglene som må holde: én reise gir ett kort, billigste selger
 * representerer den, og grupperingen flytter ingenting i listen.
 */

const place = (iata: string) => ({ iata, name: iata, city: iata, timeZone: "Europe/Oslo" });

function offer(opts: {
  id: string;
  carrier?: string;
  flightNumber?: string;
  depart?: string;
  arrive?: string;
  to?: string;
  provider?: string;
}): Offer {
  const carrier = { iata: opts.carrier ?? "DY", name: opts.carrier === "SK" ? "SAS" : "Norwegian" };
  return {
    id: opts.id,
    owner: carrier,
    totalAmount: "0",
    totalCurrency: "NOK",
    totalMinor: 0,
    expiresAt: "2026-10-01T00:00:00Z",
    slices: [
      {
        id: `${opts.id}-s`,
        origin: place("OSL"),
        destination: place(opts.to ?? "LHR"),
        departingAt: opts.depart ?? "2026-10-14T07:00:00Z",
        arrivingAt: opts.arrive ?? "2026-10-14T09:15:00Z",
        durationMinutes: 135,
        stops: 0,
        segments: [
          {
            id: `${opts.id}-seg`,
            carrier,
            flightNumber: opts.flightNumber ?? "DY1401",
            origin: place("OSL"),
            destination: place(opts.to ?? "LHR"),
            departingAt: opts.depart ?? "2026-10-14T07:00:00Z",
            arrivingAt: opts.arrive ?? "2026-10-14T09:15:00Z",
            durationMinutes: 135,
          },
        ],
      },
    ],
    booking: { kind: "external", url: "https://example.test", provider: { code: "P", name: opts.provider ?? "Norwegian" } },
  } as unknown as Offer;
}

describe("itinerarySignature", () => {
  it("er lik for samme reise solgt av to kanaler", () => {
    expect(itinerarySignature(offer({ id: "a", provider: "Norwegian" }))).toBe(itinerarySignature(offer({ id: "b", provider: "Kiwi.com" })));
  });

  it("skiller reiser som har forskjellig flynummer", () => {
    expect(itinerarySignature(offer({ id: "a", flightNumber: "DY1401" }))).not.toBe(itinerarySignature(offer({ id: "b", flightNumber: "DY1403" })));
  });

  it("skiller reiser som går til forskjellig flyplass", () => {
    expect(itinerarySignature(offer({ id: "a", to: "LHR" }))).not.toBe(itinerarySignature(offer({ id: "b", to: "LGW" })));
  });

  it("skiller reiser som går på forskjellig tid", () => {
    expect(itinerarySignature(offer({ id: "a", depart: "2026-10-14T07:00:00Z" }))).not.toBe(
      itinerarySignature(offer({ id: "b", depart: "2026-10-14T09:00:00Z" })),
    );
  });
});

describe("groupOffers", () => {
  const totals: Record<string, number> = { a: 258000, b: 262000, c: 378000 };
  const totalOf = (o: Offer) => totals[o.id] ?? 0;

  it("samler samme reise i ett kort", () => {
    const groups = groupOffers([offer({ id: "a", provider: "Norwegian" }), offer({ id: "b", provider: "Kiwi.com" })], totalOf);
    expect(groups).toHaveLength(1);
    expect(groups[0].sellers).toHaveLength(2);
  });

  it("lar den billigste selgeren representere reisen", () => {
    const groups = groupOffers([offer({ id: "b", provider: "Kiwi.com" }), offer({ id: "a", provider: "Norwegian" })], totalOf);
    expect(groups[0].best.id).toBe("a");
    expect(groups[0].bestTotal).toBe(258000);
  });

  it("sorterer selgerne billigst først", () => {
    const groups = groupOffers([offer({ id: "b", provider: "Kiwi.com" }), offer({ id: "a", provider: "Norwegian" })], totalOf);
    expect(groups[0].sellers.map((s) => s.offer.id)).toEqual(["a", "b"]);
  });

  it("holder rekkefølgen fra rangeringen", () => {
    const cheapFirst = [offer({ id: "a" }), offer({ id: "c", carrier: "SK", flightNumber: "SK801", depart: "2026-10-14T09:00:00Z" })];
    expect(groupOffers(cheapFirst, totalOf).map((g) => g.best.id)).toEqual(["a", "c"]);
    expect(groupOffers([...cheapFirst].reverse(), totalOf).map((g) => g.best.id)).toEqual(["c", "a"]);
  });

  it("lar forskjellige reiser stå som egne kort", () => {
    const groups = groupOffers(
      [offer({ id: "a" }), offer({ id: "c", carrier: "SK", flightNumber: "SK801", depart: "2026-10-14T09:00:00Z" })],
      totalOf,
    );
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.sellers.length === 1)).toBe(true);
  });

  it("mister ingen tilbud", () => {
    const input = [offer({ id: "a" }), offer({ id: "b" }), offer({ id: "c", carrier: "SK", flightNumber: "SK801", depart: "2026-10-14T09:00:00Z" })];
    const groups = groupOffers(input, totalOf);
    expect(groups.flatMap((g) => g.sellers).length).toBe(input.length);
  });
});
