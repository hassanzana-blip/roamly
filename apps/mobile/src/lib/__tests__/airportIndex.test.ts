import type { Airport } from "@contracts/airports";
import { airportNames, airportRows, cityAlias, searchLocalAirports } from "../airportIndex";

// Flyplassvelgerens egne treff: registeret på norsk og engelsk, Torp under Oslo, og serverens treff under.

const codes = (query: string) => searchLocalAirports(query).map((r) => r.airport.iata);
const world = (iata: string, city: string, country = "Storbritannia", countryCode = "GB"): Airport => ({ iata, name: `${city} Airport`, city, country, countryCode, lat: 0, lng: 0, world: true });

describe("registerets treff", () => {
  it.each([
    ["copenhagen", "CPH"],
    ["helsinki", "HEL"],
    ["munich", "MUC"],
    ["vienna", "VIE"],
    ["rome", "FCO"],
    ["prague", "PRG"],
    ["warsaw", "WAW"],
    ["lisbon", "LIS"],
    ["athens", "ATH"],
    ["venice", "VCE"],
    ["geneva", "GVA"],
    ["gothenburg", "GOT"],
    ["milan", "MXP"],
  ])("engelsk navn: «%s» finner %s (serveren fant ingenting)", (query, iata) => {
    expect(codes(query)[0]).toBe(iata);
  });

  it("skrivemåter med oe/aa/ue i stedet for ø/å/ü: «aalesund», «tromsoe», «goeteborg», «zuerich»", () => {
    expect(codes("aalesund")[0]).toBe("AES");
    expect(codes("tromsoe")[0]).toBe("TOS");
    expect(codes("goeteborg")[0]).toBe("GOT");
    expect(codes("zuerich")[0]).toBe("ZRH");
  });

  it("norske navn og skrivemåter uten æ/ø/å virker som før", () => {
    expect(codes("kobenhavn")[0]).toBe("CPH");
    expect(codes("København")[0]).toBe("CPH");
    expect(codes("wien")[0]).toBe("VIE");
    expect(codes("roma")[0]).toBe("FCO");
    expect(codes("tromso")[0]).toBe("TOS");
    expect(codes("gardermoen")).toEqual(["OSL"]);
  });

  it("hel kode først, så by, flyplassnavn og land; likt treff i registerets rekkefølge (Norge først)", () => {
    expect(codes("ber")).toEqual(["BER", "BGO"]);
    expect(codes("st").slice(0, 3)).toEqual(["SVG", "ARN", "STN"]);
    expect(codes("sa")[0]).toBe("TRF");
    expect(searchLocalAirports("osl")[0]).toMatchObject({ field: "iata" });
    expect(searchLocalAirports("oslo")[0]).toMatchObject({ field: "city" });
    expect(searchLocalAirports("gardermoen")[0]).toMatchObject({ field: "airport" });
    expect(searchLocalAirports("spania")[0]).toMatchObject({ field: "country" });
  });

  it("likt treff: populære byer først, og byens flyplasser samlet – «lon» gir London før Longyearbyen", () => {
    expect(codes("lon")).toEqual(["LHR", "LGW", "STN", "LYR"]);
  });

  it("tomt søk gir ingenting; ingen treff gir tom liste", () => {
    expect(codes("  ")).toEqual([]);
    expect(codes("zzz")).toEqual([]);
  });
});

describe("Torp under Oslo", () => {
  it("søk på byen Oslo: TRF som egen rad rett under OSL, merket med byen", () => {
    const rows = airportRows("oslo", null);
    expect(rows.map((r) => r.airport.iata)).toEqual(["OSL", "TRF"]);
    expect(rows[1]!.near?.iata).toBe("OSL");
    expect(rows[0]!.near).toBeNull();
  });

  it("samme svar mens «Oslo» skrives (os, osl, oslo) – raden kommer ikke og går", () => {
    for (const q of ["os", "osl", "oslo", "OSLO "]) expect([q, airportRows(q, null).slice(0, 2).map((r) => r.airport.iata)]).toEqual([q, ["OSL", "TRF"]]);
  });

  it("den som skriver flyplassnavnet (også med byen), får bare den flyplassen", () => {
    expect(airportRows("gardermoen", null).map((r) => r.airport.iata)).toEqual(["OSL"]);
    expect(airportRows("oslo gardermoen", null).map((r) => r.airport.iata)).toEqual(["OSL"]);
  });

  it("«oslo torp» (flyselskapenes navn) finner Torp, merket med byen, selv om OSL ikke passer", () => {
    const rows = airportRows("oslo torp", null);
    expect(rows.map((r) => r.airport.iata)).toEqual(["TRF"]);
    expect(rows[0]!.near?.iata).toBe("OSL");
  });

  it("står TRF allerede i serverens svar, flyttes den ikke og vises ikke to ganger", () => {
    const rows = airportRows("oslo", [world("OSL", "Oslo"), world("TRF", "Sandefjord")]);
    expect(rows.map((r) => r.airport.iata)).toEqual(["OSL", "TRF"]);
    expect(rows[1]!.near?.iata).toBe("OSL");
  });
});

describe("serverens treff under registerets", () => {
  it("nye flyplasser legges til under, i serverens rekkefølge; ingen dubletter", () => {
    const rows = airportRows("london", [world("LHR", "London"), world("LCY", "London"), world("LTN", "Luton")]);
    expect(rows.map((r) => r.airport.iata)).toEqual(["LHR", "LGW", "STN", "LCY", "LTN"]);
  });

  it("en flyplass i registeret vises med registerets navn, uansett hva serveren sendte", () => {
    const rows = airportRows("gar", [world("OSL", "X"), { ...world("BUD", "Budapest", "X", "HU"), world: undefined }]);
    expect(rows.map((r) => r.airport.iata)).toEqual(["OSL", "BUD"]);
    expect(rows[1]!.airport.country).toBe("Ungarn");
  });

  it("taket på antall rader holder", () => {
    const many = Array.from({ length: 30 }, (_, i) => world(`X${String(i).padStart(2, "0")}`, `By ${i}`));
    expect(airportRows("london", many)).toHaveLength(16);
  });
});

describe("navn på appens språk", () => {
  const cph = searchLocalAirports("cph")[0]!.airport;

  it("bokmål: registerets navn; engelsk: engelske navn der de finnes", () => {
    expect(airportNames(cph, "nb")).toEqual({ city: "København", name: "København lufthavn Kastrup", country: "Danmark" });
    expect(airportNames(cph, "en")).toEqual({ city: "Copenhagen", name: "Copenhagen Kastrup", country: "Denmark" });
    // Ingen norske ord i engelske navn for utenlandske flyplasser (Arlanda het «Stockholm Arlanda flyplass»).
    expect(airportNames(searchLocalAirports("arn")[0]!.airport, "en").name).toBe("Stockholm Arlanda");
    // Norske flyplassnavn er egennavn; landet oversettes.
    expect(airportNames(searchLocalAirports("osl")[0]!.airport, "en")).toEqual({ city: "Oslo", name: "Oslo lufthavn Gardermoen", country: "Norway" });
  });

  it("Kurdistan-regionen beholdes på engelsk; serverens flyplasser får engelsk land etter landkoden", () => {
    expect(airportNames(searchLocalAirports("ebl")[0]!.airport, "en").country).toBe("Kurdistan Region (Iraq)");
    expect(airportNames(world("LCY", "London"), "en").country).toBe("United Kingdom");
    expect(airportNames(world("XXX", "Somewhere", "Atlantis", "ZZ"), "en").country).toBe("Atlantis");
    expect(airportNames(world("LCY", "London"), "nb").country).toBe("Storbritannia");
  });
});

describe("bynavnet på det andre språket", () => {
  const cph = searchLocalAirports("cph")[0]!.airport;

  it("søket passer bare det andre språkets navn: det vises i parentes", () => {
    expect(cityAlias(cph, "copenhagen", "nb")).toBe("Copenhagen");
    expect(cityAlias(cph, "kobenhavn", "en")).toBe("København");
  });

  it("passer søket navnet som vises, eller har byen bare ett navn: ingen parentes", () => {
    expect(cityAlias(cph, "kob", "nb")).toBeNull();
    expect(cityAlias(cph, "copenhagen", "en")).toBeNull();
    expect(cityAlias(cph, "cph", "nb")).toBeNull();
    expect(cityAlias(searchLocalAirports("osl")[0]!.airport, "oslo", "en")).toBeNull();
    expect(cityAlias(world("LCY", "London"), "london", "nb")).toBeNull();
  });
});
