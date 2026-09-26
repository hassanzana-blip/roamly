import { MAX_TRAVELLERS, parseTravellers, removeTraveller, travellerCounts, travellerInitials, travellerNameProblem, upsertTraveller, type Traveller } from "../travellers";

const per: Traveller = { id: "a", firstName: "Per", lastName: "Nordmann", kind: "adult", cabin: null };
const liv: Traveller = { id: "b", firstName: "Liv", lastName: "Ås-Øvrebø", kind: "child", cabin: "economy" };

describe("lagrede reisende (bare navn, type og klasse)", () => {
  it("navn som kontoens: bokstaver fra alle språk, mellomrom, bindestrek og apostrof; ikke tomt, ikke over 60", () => {
    expect(travellerNameProblem("Åse", "Ødegård-Berg")).toBeNull();
    expect(travellerNameProblem("D'Arcy", "O’Neil")).toBeNull();
    expect(travellerNameProblem("  ", "Nordmann")).toBe("firstName");
    expect(travellerNameProblem("Per", "N0rdmann")).toBe("lastName");
    expect(travellerNameProblem("Per", "x".repeat(61))).toBe("lastName");
    expect(travellerNameProblem("-Per", "Nordmann")).toBe("firstName");
  });

  it("fra fil: bare de fem feltene – pass, ID-nummer og fødselsdato forkastes; ugyldige poster droppes", () => {
    const raw = [
      { ...per, passportNumber: "N1234567", nationalId: "01019012345", bornOn: "1990-01-01" },
      { ...liv },
      { ...per },
      { id: "c", firstName: "", lastName: "X", kind: "adult" },
      { id: "d", firstName: "Ola", lastName: "Nordmann", kind: "pet" },
      "søppel",
    ];
    const list = parseTravellers(raw);
    expect(list).toEqual([per, liv]);
    expect(JSON.stringify(list)).not.toMatch(/N1234567|01019012345|1990/);
  });

  it("legg til nederst, endre på plass (navnet trimmes), fjern; høyst ni", () => {
    let list = upsertTraveller([], per);
    list = upsertTraveller(list, liv);
    list = upsertTraveller(list, { ...per, firstName: "  Per Olav ", cabin: "business" });
    expect(list).toEqual([{ ...per, firstName: "Per Olav", cabin: "business" }, liv]);
    expect(removeTraveller(list, "a")).toEqual([liv]);
    const full = Array.from({ length: MAX_TRAVELLERS + 3 }, (_, i) => ({ ...per, id: `p${i}` })).reduce(upsertTraveller, [] as Traveller[]);
    expect(full).toHaveLength(MAX_TRAVELLERS);
  });

  it("initialer og antall per type", () => {
    expect(travellerInitials(liv)).toBe("LÅ");
    expect(travellerCounts([per, liv, { ...liv, id: "x", kind: "infant" }])).toEqual({ adult: 1, child: 1, infant: 1 });
  });
});
