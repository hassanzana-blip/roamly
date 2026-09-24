import { DESTINATIONS } from "../destinations";
import { normalizeSearch, searchDestinations } from "../destinationSearch";

// Søk blant de 24 kuraterte reisemålene: aldri andre steder, aldri priser.
const ids = (q: string) => searchDestinations(q).map((m) => m.destination.id);
const iatas = (q: string) => searchDestinations(q).map((m) => m.destination.iata);

describe("søk blant reisemålene", () => {
  it("tomt søk (også bare mellomrom/tegn) gir alle 24 i vanlig rekkefølge", () => {
    expect(ids("")).toEqual(DESTINATIONS.map((d) => d.id));
    expect(ids("   ")).toHaveLength(24);
    expect(ids(" – ")).toHaveLength(24);
  });

  it("nøyaktig IATA: LHR er London (Heathrow), og LGW – en annen London-flyplass – gir ingen treff", () => {
    expect(searchDestinations("LHR")).toEqual([{ destination: DESTINATIONS.find((d) => d.id === "london"), field: "iata" }]);
    expect(iatas("lhr")).toEqual(["LHR"]);
    expect(ids("LGW")).toEqual([]);
    expect(ids("NRT")).toEqual([]); // Tokyo søker HND
    expect(iatas("hnd")).toEqual(["HND"]);
  });

  it("hel IATA-kode står først, også når andre treffer på navn", () => {
    // «ist» er IATA for Istanbul, men også starten på «Istanbul» – Istanbul først.
    expect(ids("ist")[0]).toBe("istanbul");
    expect(searchDestinations("ist")[0]!.field).toBe("iata");
  });

  it("by på bokmål og engelsk, uansett språk i appen", () => {
    expect(ids("lisboa")).toEqual(["lisboa"]);
    expect(ids("lisbon")).toEqual(["lisboa"]);
    expect(ids("athen")).toEqual(["athens"]); // «Athen» og «Athens»
    expect(ids("warsaw")).toEqual(["warszawa"]);
    expect(ids("roma")).toEqual(["rome"]);
  });

  it("land på begge språk", () => {
    expect(ids("spania").sort()).toEqual(["barcelona", "malaga"]);
    expect(ids("spain").sort()).toEqual(["barcelona", "malaga"]);
    expect(ids("kurdistan").sort()).toEqual(["erbil", "sulaymaniyah"]);
    expect(ids("usa")).toEqual(["nyc"]);
    expect(ids("united states")).toEqual(["nyc"]);
  });

  it("nøyaktig flyplassnavn, flere ord i vilkårlig rekkefølge", () => {
    expect(searchDestinations("heathrow")).toEqual([{ destination: DESTINATIONS.find((d) => d.id === "london"), field: "airport" }]);
    expect(ids("el prat")).toEqual(["barcelona"]);
    expect(ids("prat el")).toEqual(["barcelona"]);
    expect(ids("gardermoen")).toEqual([]); // avreiseflyplass, ikke et av reisemålene
  });

  it("aksenter og æ/ø/å betyr ikke noe", () => {
    expect(normalizeSearch("Tromsø")).toBe("tromso");
    expect(ids("tromso")).toEqual(["tromso"]);
    expect(ids("TROMSØ")).toEqual(["tromso"]);
    expect(ids("malaga")).toEqual(["malaga"]);
    expect(ids("türkiye")).toEqual(["istanbul"]);
  });

  it("ordstart, ikke midt i ord: «an» treffer ikke Spania/Japan; ukjent gir tomt", () => {
    expect(ids("an")).not.toContain("tokyo");
    expect(ids("an")).not.toContain("barcelona");
    expect(ids("zzz")).toEqual([]);
    expect(ids("paris london")).toEqual([]);
  });

  it("aldri noe utenfor de 24, og aldri et felt med pris", () => {
    for (const q of ["a", "b", "l", "s", "k", "d"]) for (const m of searchDestinations(q)) expect(DESTINATIONS).toContain(m.destination);
    expect(JSON.stringify(searchDestinations("bar"))).not.toMatch(/price|kr|nok/i);
  });
});
