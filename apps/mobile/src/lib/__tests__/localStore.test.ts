import * as FileSystem from "expo-file-system";
import { __resetLocalStoreForTests, readPref, writePref } from "../localStore";

// Innstillingsfilen på telefonen: en fil fra en annen appversjon skal aldri
// ødelegges av vanlige lagringer, og en feil ved skriving skal aldri krasje.

const PREFS = "file:///documents/hellosky-prefs.json";
const fs = FileSystem as unknown as { __files: Map<string, string>; File: { prototype: { write: (s: string) => void; textSync: () => string } } };
const disk = () => fs.__files.get(PREFS);
const restart = () => __resetLocalStoreForTests();
const asLocale = (v: unknown) => (v === "en" || v === "nb" ? v : null);
const asString = (v: unknown) => (typeof v === "string" ? v : null);

// En fil fra en «nyere» app: annen versjon, ukjente felt, egen formatering.
const FUTURE = '{ "v": 2,\n  "locale": "en", "draft": {"shape": "v2"}, "wallet": [1, 2, 3] }';

beforeEach(() => {
  fs.__files.clear();
  restart();
});

afterEach(() => jest.restoreAllMocks());

describe("vår egen fil (v1)", () => {
  it("lagrer, leses etter omstart, og en verdi kan fjernes", () => {
    writePref("locale", "en", { userChoice: true });
    writePref("draft", { from: "OSL" });
    restart();
    expect(readPref("locale", asLocale)).toBe("en");
    expect(JSON.parse(disk()!)).toEqual({ v: 1, locale: "en", draft: { from: "OSL" } });
    writePref("draft", null);
    restart();
    expect(readPref("draft", (v) => v)).toBeNull();
  });

  it("en feil ved skriving krasjer ikke: verdien gjelder i økten, og filen er urørt etter omstart", () => {
    writePref("locale", "en", { userChoice: true });
    const before = disk();
    jest.spyOn(fs.File.prototype, "write").mockImplementation(() => {
      throw new Error("disk full");
    });
    expect(() => writePref("locale", "nb", { userChoice: true })).not.toThrow();
    expect(() => writePref("draft", { from: "BGO" })).not.toThrow();
    expect(readPref("locale", asLocale)).toBe("nb");
    expect(disk()).toBe(before);
    jest.restoreAllMocks();
    restart();
    expect(readPref("locale", asLocale)).toBe("en");
  });

  it("ødelagt innhold (ikke JSON) gir tomme innstillinger; neste lagring skriver en ny v1-fil", () => {
    fs.__files.set(PREFS, "{ikke json");
    expect(readPref("locale", asLocale)).toBeNull();
    writePref("draft", { from: "OSL" });
    expect(JSON.parse(disk()!)).toEqual({ v: 1, draft: { from: "OSL" } });
  });
});

describe("en fil fra en annen appversjon", () => {
  it("leses gjennom den vanlige valideringen: språket gjelder, en ukjent form på en kjent nøkkel gjør ikke det", () => {
    fs.__files.set(PREFS, FUTURE);
    expect(readPref("locale", asLocale)).toBe("en");
    expect(readPref("draft", (v) => (typeof v === "object" && v && "from" in v ? v : null))).toBeNull();
  });

  it("vanlige lagringer (utkast, siste søk, flyplass) endrer ikke én byte – også etter omstart", () => {
    fs.__files.set(PREFS, FUTURE);
    writePref("draft", { from: "OSL", to: "BCN" });
    writePref("recent", [{ from: "OSL" }]);
    writePref("homeAirport", { iata: "BGO" });
    writePref("recent", null);
    expect(disk()).toBe(FUTURE);
    // I denne økten gjelder de likevel.
    expect(readPref("homeAirport", (v) => v)).toEqual({ iata: "BGO" });
    restart();
    expect(disk()).toBe(FUTURE);
    expect(readPref("homeAirport", (v) => v)).toBeNull();
    expect(readPref("locale", asLocale)).toBe("en");
  });

  it("et bevisst språkvalg skrives inn, med versjonen og alle ukjente felt urørt", () => {
    fs.__files.set(PREFS, FUTURE);
    writePref("draft", { from: "OSL" });
    writePref("locale", "nb", { userChoice: true });
    expect(JSON.parse(disk()!)).toEqual({ v: 2, locale: "nb", draft: { shape: "v2" }, wallet: [1, 2, 3] });
    restart();
    expect(readPref("locale", asLocale)).toBe("nb");
  });

  it("et språkvalg skrives ikke inn når feltet har en annen form i den nye versjonen", () => {
    const shaped = '{"v":3,"locale":{"code":"en"}}';
    fs.__files.set(PREFS, shaped);
    expect(readPref("locale", asLocale)).toBeNull();
    writePref("locale", "en", { userChoice: true });
    expect(disk()).toBe(shaped);
    expect(readPref("locale", asLocale)).toBe("en");
  });

  it("en fil uten versjonsfelt behandles som ukjent versjon og beholdes", () => {
    const unversioned = '{"locale":"en","other":true}';
    fs.__files.set(PREFS, unversioned);
    writePref("draft", { from: "OSL" });
    expect(disk()).toBe(unversioned);
    expect(readPref("locale", asLocale)).toBe("en");
  });

  it("en feil ved skriving av språkvalget krasjer ikke og lar filen stå", () => {
    fs.__files.set(PREFS, FUTURE);
    jest.spyOn(fs.File.prototype, "write").mockImplementation(() => {
      throw new Error("read-only");
    });
    expect(() => writePref("locale", "nb", { userChoice: true })).not.toThrow();
    expect(readPref("locale", asLocale)).toBe("nb");
    expect(disk()).toBe(FUTURE);
  });
});

describe("en fil som ikke kunne leses", () => {
  it("blir aldri overskrevet – heller ikke av et språkvalg – og appen virker i økten", () => {
    fs.__files.set(PREFS, '{"v":1,"locale":"en"}');
    jest.spyOn(fs.File.prototype, "textSync").mockImplementation(() => {
      throw new Error("I/O error");
    });
    expect(readPref("locale", asString)).toBeNull();
    writePref("draft", { from: "OSL" });
    writePref("locale", "nb", { userChoice: true });
    expect(readPref("locale", asLocale)).toBe("nb");
    jest.restoreAllMocks();
    expect(disk()).toBe('{"v":1,"locale":"en"}');
    // Neste oppstart, når filen kan leses igjen: det lagrede valget er der fortsatt.
    restart();
    expect(readPref("locale", asLocale)).toBe("en");
  });
});
