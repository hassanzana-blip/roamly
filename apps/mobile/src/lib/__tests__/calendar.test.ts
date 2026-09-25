import { applyPick, dayRole, monthGrid, monthIndexOf, monthsFrom, nightsBetween, todayIso } from "../calendar";

// Kalenderen for avreise og retur: rene datoer, mandag først, og et skjema som er gyldig etter hvert trykk.

describe("måneder og uker", () => {
  it("inneværende måned og tolv til, over nyttår", () => {
    const m = monthsFrom("2026-09-25");
    expect(m).toHaveLength(13);
    expect(m[0]).toEqual({ year: 2026, month0: 8 });
    expect(m[3]).toEqual({ year: 2026, month0: 11 });
    expect(m[4]).toEqual({ year: 2027, month0: 0 });
    expect(m[12]).toEqual({ year: 2027, month0: 8 });
  });

  it("uken starter på mandag; oktober 2026 begynner på en torsdag og har 31 dager", () => {
    const weeks = monthGrid({ year: 2026, month0: 9 });
    expect(weeks[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.at(-1)).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", null]);
  });

  it("en måned som starter på mandag har ingen tomme plasser først (februar 2027); skuddår gir 29. februar", () => {
    expect(monthGrid({ year: 2027, month0: 1 })[0]![0]).toBe("2027-02-01");
    expect(monthGrid({ year: 2028, month0: 1 }).flat()).toContain("2028-02-29");
  });

  it("måneden en dato ligger i; før første eller etter siste måned gir kanten", () => {
    const m = monthsFrom("2026-09-25");
    expect(monthIndexOf(m, "2026-10-16")).toBe(1);
    expect(monthIndexOf(m, "2026-01-01")).toBe(0);
    expect(monthIndexOf(m, "2030-01-01")).toBe(12);
  });

  it("netter mellom datoer, også over sommertidsskiftet (25. oktober 2026)", () => {
    expect(nightsBetween("2026-10-23", "2026-10-30")).toBe(7);
    expect(nightsBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(nightsBetween("2026-10-09", "2026-10-09")).toBe(0);
    expect(todayIso(new Date(2026, 8, 25, 23, 59))).toBe("2026-09-25");
  });
});

describe("et trykk i kalenderen", () => {
  const trip = { departDate: "2026-10-09", returnDate: "2026-10-16" };

  it("tur-retur: avreise først, så retur; returen blir stående når den fortsatt er etter", () => {
    const a = applyPick(trip, "2026-10-12", "depart", true);
    expect(a).toEqual({ departDate: "2026-10-12", returnDate: "2026-10-16", next: "return" });
    const b = applyPick(a, "2026-10-20", a.next, true);
    expect(b).toEqual({ departDate: "2026-10-12", returnDate: "2026-10-20", next: "depart" });
  });

  it("ny avreise etter returen: returen flyttes med samme reiselengde, så skjemaet aldri er ugyldig", () => {
    expect(applyPick(trip, "2026-11-02", "depart", true)).toEqual({ departDate: "2026-11-02", returnDate: "2026-11-09", next: "return" });
    // Samme dag ut og hjem (0 netter): ny retur en uke etter.
    expect(applyPick({ departDate: "2026-10-09", returnDate: "2026-10-09" }, "2026-10-20", "depart", true).returnDate).toBe("2026-10-27");
  });

  it("retur valgt før avreisen blir en ny avreise, og neste trykk velger fortsatt retur", () => {
    expect(applyPick(trip, "2026-10-05", "return", true)).toEqual({ departDate: "2026-10-05", returnDate: "2026-10-16", next: "return" });
  });

  it("retur samme dag som avreise er lov (dagstur)", () => {
    expect(applyPick(trip, "2026-10-09", "return", true)).toEqual({ departDate: "2026-10-09", returnDate: "2026-10-09", next: "depart" });
  });

  it("én vei: bare avreise; en retur som nå ligger før, flyttes (brukes hvis kunden bytter til tur-retur)", () => {
    expect(applyPick(trip, "2026-10-11", "return", false)).toEqual({ departDate: "2026-10-11", returnDate: "2026-10-16", next: "depart" });
    expect(applyPick(trip, "2026-10-20", "depart", false)).toEqual({ departDate: "2026-10-20", returnDate: "2026-10-27", next: "depart" });
  });

  it("rollene: avreise, retur, dagene imellom – og samme dag", () => {
    expect(["2026-10-08", "2026-10-09", "2026-10-12", "2026-10-16", "2026-10-17"].map((d) => dayRole(d, trip.departDate, trip.returnDate))).toEqual([null, "depart", "inside", "return", null]);
    expect(dayRole("2026-10-09", "2026-10-09", "2026-10-09")).toBe("same");
    expect(dayRole("2026-10-12", "2026-10-09", null)).toBeNull();
  });
});
