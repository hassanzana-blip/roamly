import { addRecent, MAX_RECENT, parseHomeAirport, parseRecent, recentAirports, recentIsPast, recentKey, withFreshDates, type RecentSearch } from "../recent";
import { initialForm } from "../searchForm";

const today = new Date(2026, 8, 23);
const OSL = { iata: "OSL", name: "Oslo lufthavn Gardermoen", city: "Oslo", country: "Norway" };
const BGO = { iata: "BGO", name: "Bergen lufthavn Flesland", city: "Bergen", country: "Norway" };
const BCN = { iata: "BCN", name: "Barcelona-El Prat", city: "Barcelona", country: "Spain" };
const LHR = { iata: "LHR", name: "London Heathrow", city: "London", country: "United Kingdom" };
const trip = (origin: typeof OSL, destination: typeof OSL, departDate = "2026-10-23"): RecentSearch => ({ ...initialForm(today), origin, destination, departDate, returnDate: "2026-10-30" });

describe("nylige søk (bare på telefonen)", () => {
  it("samme reise flyttes øverst i stedet for å stå to ganger; høyst 6", () => {
    let list: RecentSearch[] = [];
    list = addRecent(list, trip(OSL, BCN));
    list = addRecent(list, trip(OSL, LHR));
    list = addRecent(list, trip(OSL, BCN));
    expect(list.map((r) => r.destination.iata)).toEqual(["BCN", "LHR"]);
    for (let d = 1; d <= 10; d++) list = addRecent(list, trip(OSL, BCN, `2026-11-${String(d).padStart(2, "0")}`));
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0]!.departDate).toBe("2026-11-10");
  });

  it("uten begge flyplasser lagres ingenting", () => {
    expect(addRecent([], { ...initialForm(today), destination: null })).toEqual([]);
  });

  it("lagret liste sjekkes post for post; passerte datoer beholdes (aldri flyttet i det stille); ugyldige og like forkastes", () => {
    const raw = [trip(OSL, BCN, "2026-09-01"), { ...trip(OSL, BCN, "2026-09-01") }, { junk: true }, trip(OSL, OSL), trip(BGO, LHR)];
    const list = parseRecent(raw, today);
    expect(list.map((r) => `${r.origin.iata}-${r.destination.iata}`)).toEqual(["OSL-BCN", "BGO-LHR"]);
    expect(list[0]!.departDate).toBe("2026-09-01");
    expect(list[0]!.returnDate).toBe("2026-10-30");
    expect(recentIsPast(list[0]!, today)).toBe(true);
    expect(recentIsPast(list[1]!, today)).toBe(false);
    expect(parseRecent("nonsense", today)).toEqual([]);
  });

  it("nye datoer for et passert søk: samme rute, reisende og klasse; dagens standarddatoer – ikke et søk", () => {
    const old = { ...trip(OSL, BCN, "2026-09-01"), adults: 2, cabinClass: "business" as const, directOnly: true };
    const fresh = withFreshDates(old, today);
    expect(fresh).toMatchObject({ origin: OSL, destination: BCN, adults: 2, cabinClass: "business", directOnly: true, tripType: old.tripType });
    expect(fresh.departDate).toBe(initialForm(today).departDate);
    expect(fresh.returnDate).toBe(initialForm(today).returnDate);
    expect(recentIsPast(fresh, today)).toBe(false);
  });

  it("flyplasser fra nylige søk per felt, nyeste først, uten duplikater", () => {
    const list = [trip(BGO, LHR), trip(OSL, BCN), trip(OSL, LHR)];
    expect(recentAirports(list, "origin").map((a) => a.iata)).toEqual(["BGO", "OSL"]);
    expect(recentAirports(list, "destination").map((a) => a.iata)).toEqual(["LHR", "BCN"]);
  });

  it("nøkkelen skiller reisende, klasse og retur", () => {
    expect(recentKey(trip(OSL, BCN))).not.toBe(recentKey({ ...trip(OSL, BCN), adults: 2 }));
    expect(recentKey({ ...trip(OSL, BCN), tripType: "oneway", returnDate: "2026-11-01" })).toBe(recentKey({ ...trip(OSL, BCN), tripType: "oneway", returnDate: "2026-12-01" }));
  });

  it("vanlig avreiseflyplass sjekkes som et utkast", () => {
    expect(parseHomeAirport(BGO)).toMatchObject({ iata: "BGO" });
    expect(parseHomeAirport({ iata: "bergen" })).toBeNull();
    expect(parseHomeAirport(null)).toBeNull();
  });
});
