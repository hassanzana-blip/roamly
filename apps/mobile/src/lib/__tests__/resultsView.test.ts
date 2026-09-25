import type { MobileOffer } from "@contracts/mobileSearch";
import { activeFilterCount, airlineOptions, applyView, averageLegMinutes, bestContext, bestScore, clearedFilters, countWith, DEFAULT_VIEW, departBand, departureKey, legThresholds, longestLayover, maxStops, priceThresholds, SORT_TABS, SORTS, thresholds, topFor, totalDuration } from "../resultsView";
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
/** Serverens rekkefølge (stigende kronepris) – for tester av filtre, der sorteringen ikke er poenget. */
const PRICE = { ...DEFAULT_VIEW, sort: "price" as const };

describe("resultatvisning", () => {
  it("standard er «Best», uten filtre; «Billigst» er serverens rekkefølge", () => {
    expect(DEFAULT_VIEW.sort).toBe("best");
    expect(activeFilterCount(DEFAULT_VIEW)).toBe(0);
    expect(ids(applyView(SERVER, PRICE))).toEqual(["a", "b", "c", "d"]);
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
    expect(ids(applyView(SERVER, { ...PRICE, stops: "direct" }))).toEqual(["b", "d"]);
    expect(ids(applyView(SERVER, { ...PRICE, stops: "max1" }))).toEqual(["a", "b", "d"]);
  });

  it("avgangstid: utreisens lokale klokkeslett, flere tidsrom kan velges", () => {
    expect([A, B, C, D].map(departBand)).toEqual(["morning", "afternoon", "evening", "night"]);
    expect(ids(applyView(SERVER, { ...PRICE, departBands: ["morning", "evening"] }))).toEqual(["a", "c"]);
    expect(activeFilterCount({ ...DEFAULT_VIEW, stops: "direct", departBands: ["night"] })).toBe(2);
  });

  it("uleselig tid eller varighet: tas ikke med i tidsfilteret og sorteres sist blant kroneprisene", () => {
    const broken = { ...A, offer: { ...A.offer, id: "x", slices: [{ ...A.offer.slices[0]!, departingAt: "ukjent", durationMinutes: 0 }] } };
    expect(departBand(broken)).toBeNull();
    expect(totalDuration(broken)).toBeNull();
    expect(ids(applyView([broken, B], { ...PRICE, departBands: ["morning", "afternoon", "evening", "night"] }))).toEqual(["b"]);
    expect(ids(applyView([broken, B], { ...DEFAULT_VIEW, sort: "duration" }))).toEqual(["b", "x"]);
  });

  it("antall per valg regnes med de andre filtrene", () => {
    const v = { ...DEFAULT_VIEW, stops: "direct" as const };
    expect(countWith(SERVER, v, { departBands: ["afternoon"] })).toBe(1);
    expect(countWith(SERVER, v, { departBands: ["morning"] })).toBe(0);
    expect(countWith(SERVER, v, { stops: "any" })).toBe(4);
  });

  it("fixture-resultatet: THB uten kronepris står sist i alle sorteringer", () => {
    for (const sort of SORTS) {
      const out = applyView(SEARCH_RESULT.offers, { ...DEFAULT_VIEW, sort });
      expect(out.at(-1)!.offer.id).toBe("thb_1");
    }
  });
});

describe("nye filtre: flyselskap, pris, lengste strekning, hjemreisens avgang", () => {
  const nok = (kr: number): MobileOffer["price"]["nok"] => ({ kind: "exact", currency: "NOK", amountMinor: kr * 100, estimate: false });
  const withCarrier = (o: MobileOffer, iata: string, name: string): MobileOffer => ({
    ...o,
    offer: { ...o.offer, slices: o.offer.slices.map((s) => ({ ...s, segments: s.segments.map((g) => ({ ...g, carrier: { iata, name } })) })) },
  });
  const withReturnAt = (o: MobileOffer, hhmm: string): MobileOffer => ({
    ...o,
    offer: { ...o.offer, slices: o.offer.slices.map((s, i) => (i === o.offer.slices.length - 1 && i > 0 ? { ...s, departingAt: `2026-10-30T${hhmm}:00` } : s)) },
  });
  const P1 = withReturnAt(withCarrier(offer("p1", "08:00", [{ minutes: 120, stops: 0 }, { minutes: 125, stops: 0 }], nok(1000)), "DY", "Norwegian"), "20:00");
  const P2 = withReturnAt(withCarrier(offer("p2", "09:00", [{ minutes: 300, stops: 1 }, { minutes: 320, stops: 1 }], nok(1500)), "KL", "KLM"), "07:30");
  const P3 = withCarrier(offer("p3", "10:00", [{ minutes: 600, stops: 2 }], nok(4000)), "KL", "KLM");
  const P4 = withCarrier(offer("p4", "11:00", [{ minutes: 0, stops: 0 }], THB_OFFER.price.nok), "SK", "SAS"); // ukjent varighet og ingen kronepris
  const ALL = [P1, P2, P3, P4];

  it("flyselskap: minst ett fly med et valgt selskap; valgene kommer fra svaret", () => {
    expect(airlineOptions(ALL).map((a) => [a.iata, a.count])).toEqual([["KL", 2], ["DY", 1], ["SK", 1]]);
    expect(ids(applyView(ALL, { ...PRICE, airlines: ["KL"] }))).toEqual(["p2", "p3"]);
    expect(ids(applyView(ALL, { ...PRICE, airlines: ["KL", "DY"] }))).toEqual(["p1", "p2", "p3"]);
  });

  it("makspris: bare kronepriser; tilbud uten kronepris skjules mens grensen er på", () => {
    expect(ids(applyView(ALL, { ...PRICE, maxPriceMinor: 1500_00 }))).toEqual(["p1", "p2"]);
    expect(priceThresholds(ALL)).toEqual([1000_00, 1500_00]);
  });

  it("lengste strekning: ukjent varighet skjules mens grensen er på", () => {
    expect(ids(applyView(ALL, { ...PRICE, maxLegMinutes: 300 }))).toEqual(["p1"]);
    expect(ids(applyView(ALL, { ...PRICE, maxLegMinutes: 360 }))).toEqual(["p1", "p2"]);
    expect(legThresholds(ALL)).toEqual([180, 360]);
  });

  it("hjemreisens avgang: bare reiser med hjemreise kan passe", () => {
    expect(ids(applyView(ALL, { ...PRICE, returnBands: ["evening"] }))).toEqual(["p1"]);
    expect(ids(applyView(ALL, { ...PRICE, returnBands: ["morning"] }))).toEqual(["p2"]);
  });

  it("alle filtre teller, og «nullstill» beholder sorteringen", () => {
    const busy = { ...DEFAULT_VIEW, sort: "duration" as const, airlines: ["KL"], maxPriceMinor: 1500_00, maxLegMinutes: 360, returnBands: ["morning" as const] };
    expect(activeFilterCount(busy)).toBe(4);
    expect(clearedFilters(busy)).toEqual({ ...DEFAULT_VIEW, sort: "duration" });
  });

  it("terskler: bare verdier som faktisk skiller, rundet opp", () => {
    expect(thresholds([100], 60)).toEqual([]);
    expect(thresholds([100, 100, 100], 60)).toEqual([]);
    expect(thresholds([61, 130, 250, 400], 60)).toEqual([120, 180, 300]);
    expect(thresholds([61, 130, 250, 290], 60)).toEqual([120, 180]); // 300 ≥ høyeste verdi skiller ingenting
  });
});

describe("«Best», tidligst avgang og fanene over listen", () => {
  const nok = (kr: number): MobileOffer["price"]["nok"] => ({ kind: "exact", currency: "NOK", amountMinor: kr * 100, estimate: false });
  /** To strekninger med gitt reisetid og bytter, solgt av flyselskapet, med egne flynumre (en egen reise). */
  const trip = (id: string, kr: number, minutes: number, stops: number, depart = "10:00"): MobileOffer => {
    const o = offer(id, depart, [{ minutes, stops }, { minutes, stops }], nok(kr));
    return {
      ...o,
      offer: { ...o.offer, booking: { ...o.offer.booking!, sellerKind: "airline" }, slices: o.offer.slices.map((sl) => ({ ...sl, segments: sl.segments.map((g) => ({ ...g, flightNumber: `${id}${g.flightNumber}` })) })) },
    };
  };
  const agency = (o: MobileOffer): MobileOffer => ({ ...o, offer: { ...o.offer, booking: { ...o.offer.booking!, sellerKind: "agency" } } });
  /** Et bytte med gitt ventetid i hver strekning (tider uten sone, samme flyplass). */
  const withLayover = (o: MobileOffer, minutes: number): MobileOffer => {
    const arrive = "2026-10-23T12:00:00";
    const depart = new Date(Date.parse(`${arrive}Z`) + minutes * 60_000).toISOString().slice(0, 19);
    return {
      ...o,
      offer: {
        ...o.offer,
        slices: o.offer.slices.map((s) => ({ ...s, segments: [{ ...s.segments[0]!, arrivingAt: arrive }, { ...s.segments[1]!, departingAt: depart }] })),
      },
    };
  };

  it("en lang nattforbindelse som er litt billigere, havner under en rask direkterute (samme vekter som nettet)", () => {
    const night = withLayover(trip("natt", 1600, 776, 1, "19:50"), 535);
    const direct = trip("direkte", 1620, 196, 0, "12:15");
    const server = [night, direct]; // serverens rekkefølge: billigst først
    expect(ids(applyView(server, PRICE))).toEqual(["natt", "direkte"]);
    expect(ids(applyView(server, DEFAULT_VIEW))).toEqual(["direkte", "natt"]);
    // Tallene: pris mot billigste (0,6), tid mot raskeste (0,3), bytter (0,15), bytte over 5 t (0,1).
    const ctx = bestContext(server);
    expect(ctx).toEqual({ minPrice: 1600_00, minMinutes: 392 });
    expect(bestScore(direct, ctx)).toBeCloseTo((1620 / 1600) * 0.6 + 1 * 0.3, 6);
    expect(bestScore(night, ctx)).toBeCloseTo(1 * 0.6 + (1552 / 392) * 0.3 + 0.15 + 0.1, 6);
    expect(longestLayover(night)).toBe(535);
  });

  it("ved nesten lik pris står flyselskapets egen salgskanal foran et reisebyrå – et lite dytt, ingen overstyring", () => {
    const airline = trip("fly", 2000, 300, 1);
    const byra = agency(trip("byraa", 1990, 300, 1));
    expect(ids(applyView([byra, airline], DEFAULT_VIEW))).toEqual(["fly", "byraa"]);
    // Er byrået tydelig billigere, vinner prisen.
    const billigByra = agency(trip("byraa", 1700, 300, 1));
    expect(ids(applyView([billigByra, airline], DEFAULT_VIEW))).toEqual(["byraa", "fly"]);
  });

  it("målestokken regnes av hele svaret, så et filter ikke stokker om rekkefølgen på det som står igjen", () => {
    const a = trip("a", 1000, 600, 1);
    const b = trip("b", 1300, 300, 0);
    const c = trip("c", 1250, 330, 0);
    const all = [a, c, b];
    const unfiltered = ids(applyView(all, DEFAULT_VIEW)).filter((id) => id !== "a");
    expect(ids(applyView(all, { ...DEFAULT_VIEW, stops: "direct" }))).toEqual(unfiltered);
  });

  it("uten kronepris eller med ukjent reisetid kan tilbudet ikke veies og står sist", () => {
    const ukjent = offer("ukjent", "08:00", [{ minutes: 0, stops: 0 }], nok(500));
    const x = trip("x", 3000, 400, 1);
    expect(bestScore(ukjent, bestContext([ukjent, x]))).toBe(Number.POSITIVE_INFINITY);
    expect(ids(applyView([ukjent, x, D], DEFAULT_VIEW))).toEqual(["x", "ukjent", "d"]);
  });

  it("tidligst avgang: utreisens lokale klokkeslett; lik tid avgjøres av prisen; uleselig tid sist", () => {
    const tidlig = trip("tidlig", 2500, 300, 1, "06:00");
    const sen = trip("sen", 900, 300, 1, "21:30");
    const likDyr = trip("likdyr", 2000, 300, 1, "09:15");
    const likBillig = trip("likbillig", 1500, 300, 1, "09:15");
    const ukjent = { ...trip("ukjent", 100, 300, 1), offer: { ...trip("ukjent", 100, 300, 1).offer, slices: [{ ...trip("u", 1, 1, 0).offer.slices[0]!, departingAt: "?" }] } };
    expect(departureKey(ukjent)).toBeNull();
    const server = [ukjent, sen, likBillig, likDyr, tidlig];
    expect(ids(applyView(server, { ...DEFAULT_VIEW, sort: "departure" }))).toEqual(["tidlig", "likbillig", "likdyr", "sen", "ukjent"]);
  });

  it("fanene: Best, Billigst og Raskest, hver med reisen som står øverst med filtrene som gjelder", () => {
    expect(SORT_TABS).toEqual(["best", "price", "duration"]);
    const billig = withLayover(trip("billig", 1600, 776, 1, "19:50"), 535);
    const rask = trip("rask", 2400, 180, 0, "07:00");
    const god = trip("god", 1700, 200, 0, "12:00");
    const all = [billig, god, rask];
    expect(topFor(all, DEFAULT_VIEW, "price")!.best.offer.id).toBe("billig");
    expect(topFor(all, DEFAULT_VIEW, "duration")!.best.offer.id).toBe("rask");
    expect(topFor(all, DEFAULT_VIEW, "best")!.best.offer.id).toBe("god");
    // Med «Direkte» er nattforbindelsen borte også fra «Billigst».
    expect(topFor(all, { ...DEFAULT_VIEW, stops: "direct" }, "price")!.best.offer.id).toBe("god");
    expect(topFor(all, { ...DEFAULT_VIEW, airlines: ["XX"] }, "best")).toBeNull();
    // Snittet per strekning: (180 + 180) / 2.
    expect(averageLegMinutes(rask)).toBe(180);
  });
});
