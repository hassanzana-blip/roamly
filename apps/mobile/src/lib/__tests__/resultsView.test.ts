import type { MobileOffer } from "@contracts/mobileSearch";
import { activeFilterCount, applyView, countWith, DEFAULT_VIEW, departBand, maxStops, totalDuration } from "../resultsView";
import { NOK_OFFER, SEARCH_RESULT, THB_OFFER } from "../../test/fixtures";

/** Et tilbud med gitt id, avgangstid, varighet og bytter på hver strekning. */
function offer(id: string, depart: string, legs: { minutes: number; stops: number }[], nok: MobileOffer["price"]["nok"] = NOK_OFFER.price.nok): MobileOffer {
  const base = NOK_OFFER.offer.slices[0]!;
  return {
    ...NOK_OFFER,
    offer: { ...NOK_OFFER.offer, id, slices: legs.map((l, i) => ({ ...base, id: `${id}-${i}`, departingAt: i === 0 ? `2026-10-23T${depart}:00` : base.departingAt, durationMinutes: l.minutes, stops: l.stops })) },
    price: { ...NOK_OFFER.price, nok },
  };
}

const A = offer("a", "07:05", [{ minutes: 300, stops: 1 }, { minutes: 300, stops: 1 }]); // billigst (serverens første)
const B = offer("b", "13:30", [{ minutes: 150, stops: 0 }, { minutes: 160, stops: 0 }]);
const C = offer("c", "19:10", [{ minutes: 200, stops: 2 }]);
const D = offer("d", "02:15", [{ minutes: 100, stops: 0 }], THB_OFFER.price.nok); // uten kronepris – alltid sist
const SERVER = [A, B, C, D];
const ids = (list: MobileOffer[]) => list.map((o) => o.offer.id);

describe("resultatvisning", () => {
  it("standard: serverens rekkefølge, ingen filtre", () => {
    expect(ids(applyView(SERVER, DEFAULT_VIEW))).toEqual(["a", "b", "c", "d"]);
    expect(activeFilterCount(DEFAULT_VIEW)).toBe(0);
  });

  it("raskest: samlet reisetid, og tilbud uten kronepris står fortsatt nederst", () => {
    expect(ids(applyView(SERVER, { ...DEFAULT_VIEW, sort: "duration" }))).toEqual(["c", "b", "a", "d"]);
  });

  it("færrest bytter: summen av bytter; likhet avgjøres av serverens rekkefølge (pris)", () => {
    const E = offer("e", "08:00", [{ minutes: 90, stops: 0 }, { minutes: 90, stops: 0 }]);
    expect(ids(applyView([A, E, B, C, D], { ...DEFAULT_VIEW, sort: "stops" }))).toEqual(["e", "b", "a", "c", "d"]);
  });

  it("bytter-filter bruker flest bytter på én strekning", () => {
    expect(maxStops(A)).toBe(1);
    expect(ids(applyView(SERVER, { ...DEFAULT_VIEW, stops: "direct" }))).toEqual(["b", "d"]);
    expect(ids(applyView(SERVER, { ...DEFAULT_VIEW, stops: "max1" }))).toEqual(["a", "b", "d"]);
  });

  it("avgangstid: utreisens lokale klokkeslett, flere tidsrom kan velges", () => {
    expect([A, B, C, D].map(departBand)).toEqual(["morning", "afternoon", "evening", "night"]);
    expect(ids(applyView(SERVER, { ...DEFAULT_VIEW, departBands: ["morning", "evening"] }))).toEqual(["a", "c"]);
    expect(activeFilterCount({ ...DEFAULT_VIEW, stops: "direct", departBands: ["night"] })).toBe(2);
  });

  it("uleselig tid eller varighet: tas ikke med i tidsfilteret og sorteres sist blant kroneprisene", () => {
    const broken = { ...A, offer: { ...A.offer, id: "x", slices: [{ ...A.offer.slices[0]!, departingAt: "ukjent", durationMinutes: 0 }] } };
    expect(departBand(broken)).toBeNull();
    expect(totalDuration(broken)).toBeNull();
    expect(ids(applyView([broken, B], { ...DEFAULT_VIEW, departBands: ["morning", "afternoon", "evening", "night"] }))).toEqual(["b"]);
    expect(ids(applyView([broken, B], { ...DEFAULT_VIEW, sort: "duration" }))).toEqual(["b", "x"]);
  });

  it("antall per valg regnes med de andre filtrene", () => {
    const v = { ...DEFAULT_VIEW, stops: "direct" as const };
    expect(countWith(SERVER, v, { departBands: ["afternoon"] })).toBe(1);
    expect(countWith(SERVER, v, { departBands: ["morning"] })).toBe(0);
    expect(countWith(SERVER, v, { stops: "any" })).toBe(4);
  });

  it("fixture-resultatet: THB uten kronepris står sist i alle sorteringer", () => {
    for (const sort of ["price", "duration", "stops"] as const) {
      const out = applyView(SEARCH_RESULT.offers, { ...DEFAULT_VIEW, sort });
      expect(out.at(-1)!.offer.id).toBe("thb_1");
    }
  });
});
