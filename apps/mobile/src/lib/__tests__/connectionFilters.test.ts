import type { MobileOffer } from "@contracts/mobileSearch";
import type { Segment } from "@contracts/types";
import { activeFilterCount, applyView, arriveBand, clearedFilters, connectionOptions, connectionsOf, DEFAULT_VIEW, journeysVia, returnArriveBand } from "../resultsView";
import { activeFilterChips } from "../filterChips";
import { i18nFor } from "../../i18n";
import { NOK_OFFER } from "../../test/fixtures";

// Mellomlandingsflyplasser og ankomsttid – bare fra tidene og flyplassene leverandøren oppga – og de aktive
// filtrene som brikker over listen.

const point = (iata: string, city: string) => ({ iata, name: `${city} lufthavn`, city, country: "X", lat: 0, lng: 0 });
const base = NOK_OFFER.offer.slices[0]!.segments[0]!;
const seg = (from: [string, string], to: [string, string], dep: string, arr: string, n: string): Segment => ({ ...base, id: n, flightNumber: n, origin: point(...from), destination: point(...to), departingAt: dep, arrivingAt: arr });

/** En reise (én eller to strekninger) med gitte fly; tidene er lokale, som leverandøren oppgir dem. */
function trip(id: string, legs: Segment[][]): MobileOffer {
  const s0 = NOK_OFFER.offer.slices[0]!;
  return {
    ...NOK_OFFER,
    offer: {
      ...NOK_OFFER.offer,
      id,
      slices: legs.map((segments, i) => ({ ...s0, id: `${id}-${i}`, segments, stops: segments.length - 1, departingAt: segments[0]!.departingAt, arrivingAt: segments.at(-1)!.arrivingAt, origin: segments[0]!.origin, destination: segments.at(-1)!.destination })),
    },
  };
}

const OSL: [string, string] = ["OSL", "Oslo"];
const BCN: [string, string] = ["BCN", "Barcelona"];
const CPH: [string, string] = ["CPH", "København"];
const LHR: [string, string] = ["LHR", "London"];
const LGW: [string, string] = ["LGW", "London"];

const direct = trip("direct", [[seg(OSL, BCN, "2026-10-23T09:00", "2026-10-23T13:05", "D1")]]);
const viaCph = trip("cph", [[seg(OSL, CPH, "2026-10-23T07:05", "2026-10-23T08:15", "C1"), seg(CPH, BCN, "2026-10-23T09:10", "2026-10-23T13:40", "C2")]]);
// Flyplassbytte i London: lander på Gatwick, reiser videre fra Heathrow – begge er byttesteder.
const viaLondon = trip("lon", [[seg(OSL, LGW, "2026-10-23T18:00", "2026-10-23T19:55", "L1"), seg(LHR, BCN, "2026-10-24T06:30", "2026-10-24T09:45", "L2")]]);
const ALL = [direct, viaCph, viaLondon];
const ids = (list: MobileOffer[]) => list.map((o) => o.offer.id);
const PRICE = { ...DEFAULT_VIEW, sort: "price" as const };

describe("mellomlandingsflyplasser", () => {
  it("byttestedene: der et fly lander og det neste går fra; flyplassbytte gir begge; direkte gir ingen", () => {
    expect([...connectionsOf(direct)]).toEqual([]);
    expect([...connectionsOf(viaCph)]).toEqual(["CPH"]);
    expect([...connectionsOf(viaLondon)].sort()).toEqual(["LGW", "LHR"]);
  });

  it("valgene kommer fra svaret, med leverandørens bynavn, flest reiser først", () => {
    const again = trip("cph2", [[seg(OSL, CPH, "2026-10-23T12:00", "2026-10-23T13:10", "C3"), seg(CPH, BCN, "2026-10-23T14:00", "2026-10-23T18:30", "C4")]]);
    expect(connectionOptions([...ALL, again])).toEqual([
      { iata: "CPH", city: "København" },
      { iata: "LGW", city: "London" },
      { iata: "LHR", city: "London" },
    ]);
  });

  it("en flyplass slått av skjuler reiser som bytter der; direktefly vises alltid", () => {
    expect(ids(applyView(ALL, { ...PRICE, avoidConnections: ["CPH"] }))).toEqual(["direct", "lon"]);
    expect(ids(applyView(ALL, { ...PRICE, avoidConnections: ["LHR"] }))).toEqual(["direct", "cph"]);
    expect(ids(applyView(ALL, { ...PRICE, avoidConnections: ["CPH", "LGW"] }))).toEqual(["direct"]);
    expect(activeFilterCount({ ...DEFAULT_VIEW, avoidConnections: ["CPH", "LGW"] })).toBe(1);
  });

  it("antallet ved hver flyplass: reiser som bytter der og ellers passer – også mens den er slått av", () => {
    expect(journeysVia(ALL, DEFAULT_VIEW, "CPH")).toBe(1);
    expect(journeysVia(ALL, { ...DEFAULT_VIEW, avoidConnections: ["CPH"] }, "CPH")).toBe(1);
    expect(journeysVia(ALL, { ...DEFAULT_VIEW, departBands: ["evening"] }, "CPH")).toBe(0);
  });
});

describe("ankomsttid", () => {
  it("utreisens ankomst: lokal tid der du lander, også neste døgn", () => {
    expect([direct, viaCph, viaLondon].map(arriveBand)).toEqual(["afternoon", "afternoon", "morning"]);
    expect(ids(applyView(ALL, { ...PRICE, arriveBands: ["morning"] }))).toEqual(["lon"]);
  });

  it("hjemreisens ankomst: bare reiser med hjemreise kan passe", () => {
    const back = trip("rt", [[seg(OSL, BCN, "2026-10-23T09:00", "2026-10-23T13:05", "R1")], [seg(BCN, OSL, "2026-10-30T20:10", "2026-10-30T23:55", "R2")]]);
    expect(returnArriveBand(back)).toBe("evening");
    expect(returnArriveBand(direct)).toBeNull();
    expect(ids(applyView([direct, back], { ...PRICE, returnArriveBands: ["evening"] }))).toEqual(["rt"]);
    expect(activeFilterCount({ ...DEFAULT_VIEW, departBands: ["morning"], arriveBands: ["evening"], returnArriveBands: ["night"] })).toBe(3);
    expect(clearedFilters({ ...DEFAULT_VIEW, sort: "duration", arriveBands: ["evening"], avoidConnections: ["CPH"] })).toEqual({ ...DEFAULT_VIEW, sort: "duration" });
  });
});

describe("aktive filtre som brikker", () => {
  const i18n = (locale: "nb" | "en") => i18nFor(locale);
  const airlines = [
    { iata: "SK", name: "SAS", count: 3 },
    { iata: "DY", name: "Norwegian", count: 2 },
    { iata: "KL", name: "KLM", count: 1 },
  ];
  const labels = (v: typeof DEFAULT_VIEW, roundTrip = true, locale: "nb" | "en" = "nb") => activeFilterChips(v, { airlines, roundTrip }, i18n(locale)).map((c) => c.label);

  it("ingen filtre fra arket: ingen brikker (direkte, maks 1 og bagasje har egne)", () => {
    expect(labels({ ...DEFAULT_VIEW, stops: "direct", bags: true })).toEqual([]);
  });

  it("tider: hvilken vei og om det er avgang eller ankomst; tidsrommene i dagens rekkefølge; mange blir et antall", () => {
    expect(labels({ ...DEFAULT_VIEW, departBands: ["evening", "morning"], returnArriveBands: ["night", "morning", "evening"] })).toEqual(["Avgang ut: morgen, kveld", "Ankomst hjem: 3 tidsrom"]);
    expect(labels({ ...DEFAULT_VIEW, arriveBands: ["afternoon"] }, false)).toEqual(["Ankomst: ettermiddag"]);
    expect(labels({ ...DEFAULT_VIEW, arriveBands: ["afternoon"] }, true, "en")).toEqual(["Outbound arrival: afternoon"]);
  });

  it("flyselskaper med navn, mellomlandinger med kode, pris og reisetid", () => {
    expect(labels({ ...DEFAULT_VIEW, airlines: ["DY", "SK"], avoidConnections: ["CPH"], maxPriceMinor: 3_000_00, maxLegMinutes: 240 })).toEqual([
      "Norwegian, SAS",
      "Ikke via CPH",
      "Opptil 3 000 kr",
      "Reisetid opptil 4 t",
    ]);
    expect(labels({ ...DEFAULT_VIEW, airlines: ["DY", "SK", "KL"], avoidConnections: ["CPH", "LHR", "FRA"] })).toEqual(["3 flyselskaper", "Ikke via 3 flyplasser"]);
  });

  it("VoiceOver sier at et trykk fjerner filteret; trykket fjerner bare det filteret", () => {
    const v = { ...DEFAULT_VIEW, sort: "duration" as const, departBands: ["morning" as const], avoidConnections: ["CPH"] };
    const chips = activeFilterChips(v, { airlines, roundTrip: true }, i18n("nb"));
    expect(chips.map((c) => c.spoken)).toEqual(["Fjern filter: Avgang ut: morgen", "Fjern filter: Ikke via CPH"]);
    expect(chips[0]!.clear(v)).toEqual({ ...v, departBands: [] });
    expect(chips[1]!.clear(v)).toEqual({ ...v, avoidConnections: [] });
  });
});
