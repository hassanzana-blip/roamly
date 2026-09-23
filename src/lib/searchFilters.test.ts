import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  applyFilters,
  clearFilters,
  filtersFromParams,
  searchRequestKey,
  type SearchFilters,
} from "./searchFilters";

const p = (q: string) => new URLSearchParams(q);
const QUERY = "from=OSL&to=LHR&depart=2026-10-14&ret=2026-10-21&adults=1&cabin=economy";

describe("URL → tilstand", () => {
  it("gir standardfiltre for et søk uten filtre", () => {
    expect(filtersFromParams(p(QUERY))).toEqual(DEFAULT_FILTERS);
  });

  it("leser hvert filter", () => {
    const f = filtersFromParams(
      p(
        `${QUERY}&sort=cheapest&stopp=direct&selskap=DY,SK&bagasje=1&direktesalg=1&refunderbar=1` +
          "&avgangstid=morning&ankomsttid=evening&maksreisetid=8&maksmellomlanding=4&maxpris=2500&fraflyplass=OSL&tilflyplass=LHR,LGW",
      ),
    );
    expect(f).toEqual({
      sort: "cheapest",
      stops: "direct",
      airlines: ["DY", "SK"],
      baggageOnly: true,
      airlineDirectOnly: true,
      refundableOnly: true,
      depTime: "morning",
      arrTime: "evening",
      maxDurationH: 8,
      maxLayoverH: 4,
      priceMaxMinor: 250000,
      originAirports: ["OSL"],
      destAirports: ["LGW", "LHR"],
    } satisfies SearchFilters);
  });

  it("normaliserer selskapslister til store bokstaver, uten duplikater, sortert", () => {
    expect(filtersFromParams(p("selskap=sk,DY,dy , BA")).airlines).toEqual(["BA", "DY", "SK"]);
  });
});

describe("ugyldige verdier faller trygt tilbake", () => {
  it.each([
    ["sort=finnes-ikke", "sort", DEFAULT_FILTERS.sort],
    ["stopp=tull", "stops", "all"],
    ["avgangstid=13", "depTime", "all"],
    ["ankomsttid=", "arrTime", "all"],
  ])("%s", (q, key, expected) => {
    expect(filtersFromParams(p(q))[key as keyof SearchFilters]).toBe(expected);
  });

  it.each(["maksreisetid=-5", "maksreisetid=abc", "maksreisetid=0"])("%s gir ingen grense", (q) => {
    expect(filtersFromParams(p(q)).maxDurationH).toBe(0);
  });

  it("klipper urimelig store tall i stedet for å stole på dem", () => {
    expect(filtersFromParams(p("maksreisetid=99999")).maxDurationH).toBe(72);
    expect(filtersFromParams(p("maksmellomlanding=99999")).maxLayoverH).toBe(48);
  });

  it.each(["maxpris=-100", "maxpris=null", "maxpris=0"])("%s gir ingen pristak", (q) => {
    expect(filtersFromParams(p(q)).priceMaxMinor).toBeNull();
  });

  it("forkaster søppel i kodelister i stedet for å filtrere på det", () => {
    expect(filtersFromParams(p("selskap=<script>,DY,,TOOLONGCODE")).airlines).toEqual(["DY"]);
  });

  it("tar ikke imot en uendelig lang kodeliste", () => {
    const many = Array.from({ length: 200 }, (_, i) => `A${String(i).padStart(2, "0")}`).join(",");
    expect(filtersFromParams(p(`selskap=${many}`)).airlines.length).toBeLessThanOrEqual(40);
  });
});

describe("tilstand → URL", () => {
  it("skriver ingenting for standardverdier", () => {
    expect(applyFilters(p(QUERY), DEFAULT_FILTERS).toString()).toBe(p(QUERY).toString());
  });

  it("lar søkeparameterne være i fred", () => {
    const out = applyFilters(p(QUERY), { ...DEFAULT_FILTERS, stops: "direct" });
    for (const k of ["from", "to", "depart", "ret", "adults", "cabin"]) expect(out.get(k)).toBe(p(QUERY).get(k));
  });

  it("fjerner et filter igjen når det settes tilbake til standard", () => {
    const on = applyFilters(p(QUERY), { ...DEFAULT_FILTERS, stops: "direct", airlines: ["DY"] });
    expect(on.get("stopp")).toBe("direct");
    const off = applyFilters(on, DEFAULT_FILTERS);
    expect(off.has("stopp")).toBe(false);
    expect(off.has("selskap")).toBe(false);
  });

  it("er deterministisk: samme tilstand gir samme streng", () => {
    const a = applyFilters(p(QUERY), { ...DEFAULT_FILTERS, airlines: ["SK", "DY"] });
    const b = applyFilters(p(QUERY), { ...DEFAULT_FILTERS, airlines: ["DY", "SK"] });
    expect(a.toString()).toBe(b.toString());
  });
});

describe("rundtur URL → tilstand → URL", () => {
  const cases: SearchFilters[] = [
    DEFAULT_FILTERS,
    { ...DEFAULT_FILTERS, sort: "fastest", stops: "max1" },
    { ...DEFAULT_FILTERS, airlines: ["BA", "DY"], baggageOnly: true, priceMaxMinor: 199900 },
    { ...DEFAULT_FILTERS, depTime: "night", arrTime: "day", maxDurationH: 12, maxLayoverH: 3 },
    { ...DEFAULT_FILTERS, originAirports: ["OSL", "TRF"], destAirports: ["LGW"], refundableOnly: true, airlineDirectOnly: true },
  ];
  it.each(cases.map((c, i) => [i, c] as const))("case %i overlever turen begge veier", (_i, filters) => {
    const url = applyFilters(p(QUERY), filters);
    expect(filtersFromParams(url)).toEqual(filters);
    expect(applyFilters(url, filtersFromParams(url)).toString()).toBe(url.toString());
  });
});

describe("søkenøkkelen skiller søk fra filtre", () => {
  it("er lik når bare filtrene endrer seg", () => {
    const base = p(QUERY);
    for (const q of ["stopp=direct", "selskap=DY", "sort=cheapest", "maxpris=1500", "avgangstid=morning", "maksreisetid=8"]) {
      expect(searchRequestKey(p(`${QUERY}&${q}`))).toBe(searchRequestKey(base));
    }
  });

  it("endrer seg når søket faktisk endrer seg", () => {
    const base = searchRequestKey(p(QUERY));
    expect(searchRequestKey(p(QUERY.replace("to=LHR", "to=CDG")))).not.toBe(base);
    expect(searchRequestKey(p(QUERY.replace("depart=2026-10-14", "depart=2026-10-15")))).not.toBe(base);
    expect(searchRequestKey(p(QUERY.replace("adults=1", "adults=2")))).not.toBe(base);
    expect(searchRequestKey(p(QUERY.replace("cabin=economy", "cabin=business")))).not.toBe(base);
    expect(searchRequestKey(p(`${QUERY}&direct=1`))).not.toBe(base);
  });

  it("bryr seg ikke om rekkefølgen på parameterne", () => {
    expect(searchRequestKey(p("to=LHR&from=OSL&depart=2026-10-14"))).toBe(searchRequestKey(p("from=OSL&depart=2026-10-14&to=LHR")));
  });
});

describe("gamle lenker fortsetter å virke", () => {
  it("«maxpris» og «bagasje» fra forsiden leses som filtre", () => {
    const f = filtersFromParams(p(`${QUERY}&maxpris=1500&bagasje=1`));
    expect(f.priceMaxMinor).toBe(150000);
    expect(f.baggageOnly).toBe(true);
  });

  it("«sort» beholder navnet sitt", () => {
    expect(filtersFromParams(p(`${QUERY}&sort=cheapest`)).sort).toBe("cheapest");
  });
});

describe("nullstilling og telling", () => {
  it("nullstilling beholder søket og sorteringen", () => {
    const url = applyFilters(p(`${QUERY}&sort=fastest`), { ...DEFAULT_FILTERS, sort: "fastest", stops: "direct", airlines: ["DY"], priceMaxMinor: 100000 });
    const cleared = clearFilters(url);
    expect(cleared.get("from")).toBe("OSL");
    expect(cleared.get("sort")).toBe("fastest");
    expect(activeFilterCount(filtersFromParams(cleared))).toBe(0);
  });

  it("sortering teller ikke som filter", () => {
    expect(activeFilterCount(filtersFromParams(p(`${QUERY}&sort=cheapest`)))).toBe(0);
  });

  it("teller hvert valgte selskap og hver flyplass for seg", () => {
    expect(activeFilterCount(filtersFromParams(p("selskap=DY,SK&stopp=direct&tilflyplass=LHR")))).toBe(4);
  });
});
