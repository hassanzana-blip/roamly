import { covers, markSegments, matchRanges, normalizeSearch, searchTokens, searchWords } from "../textMatch";

// Søketeksten: aksenter, æ/ø/å og tegn betyr ikke noe – og uthevingen treffer riktige tegn i originalen.

describe("brettet søketekst", () => {
  it("æ/ø/å, aksenter og bokstaver som ikke brytes ned av Unicode", () => {
    expect(normalizeSearch("Tromsø")).toBe("tromso");
    expect(normalizeSearch("Ålesund")).toBe("alesund");
    expect(normalizeSearch("Málaga-Costa del Sol")).toBe("malaga costa del sol");
    expect(normalizeSearch("Gdańsk Lech Wałęsa")).toBe("gdansk lech walesa");
    expect(normalizeSearch("København")).toBe("kobenhavn");
    expect(normalizeSearch("Færøyene")).toBe("faeroyene");
    expect(normalizeSearch("Keflavík alþjóðaflugvöllur")).toBe("keflavik althjodaflugvollur");
    expect(normalizeSearch("  New   York ")).toBe("new york");
  });

  it("et aksenttegn skrevet som eget tegn deler ikke ordet", () => {
    expect(normalizeSearch("Malé")).toBe("male");
  });

  it("ord i søket og i teksten; hvert søkeord må være starten på et ord", () => {
    expect(searchTokens(" new york ")).toEqual(["new", "york"]);
    expect(searchTokens("   ")).toEqual([]);
    const words = searchWords("Oslo lufthavn Gardermoen", "Norge");
    expect(covers(["gar"], words)).toBe(true);
    expect(covers(["oslo", "gar"], words)).toBe(true);
    expect(covers(["ardermoen"], words)).toBe(false);
  });
});

describe("uthevingen", () => {
  it("treffer hele Tromsø for «tromso», og bare «Åle» i Ålesund for «ale»", () => {
    expect(matchRanges("Tromsø", ["tromso"])).toEqual([{ start: 0, end: 6 }]);
    expect(markSegments("Ålesund lufthavn Vigra", ["ale"])).toEqual([
      { text: "Åle", hit: true },
      { text: "sund lufthavn Vigra", hit: false },
    ]);
  });

  it("flere søkeord: hvert ord uthever sitt; ingen treff gir én bit uten utheving", () => {
    expect(markSegments("New York JFK", ["new", "york"])).toEqual([
      { text: "New", hit: true },
      { text: " ", hit: false },
      { text: "York", hit: true },
      { text: " JFK", hit: false },
    ]);
    expect(markSegments("Barcelona", ["bcn"])).toEqual([{ text: "Barcelona", hit: false }]);
  });

  it("bare starten av et ord uthevet – som søket; midt i et ord gir ingen utheving", () => {
    expect(matchRanges("Budapest, Ungarn", ["gar"])).toEqual([]);
    expect(markSegments("Oslo lufthavn Gardermoen, Norge", ["gar"])).toEqual([
      { text: "Oslo lufthavn ", hit: false },
      { text: "Gar", hit: true },
      { text: "dermoen, Norge", hit: false },
    ]);
  });

  it("et aksenttegn skrevet som eget tegn (NFD) uthevas sammen med bokstaven det hører til", () => {
    expect(markSegments("Ma\u0301laga", ["ma"])).toEqual([
      { text: "Ma\u0301", hit: true },
      { text: "laga", hit: false },
    ]);
  });

  it("en bokstav som blir to (æ → ae) uthever hele bokstaven", () => {
    expect(markSegments("Færder", ["fa"])).toEqual([
      { text: "Fæ", hit: true },
      { text: "rder", hit: false },
    ]);
  });
});
