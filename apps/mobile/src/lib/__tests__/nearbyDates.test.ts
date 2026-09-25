import { nearbyDates } from "../nearbyDates";

// «Prøv datoene rundt»: samme reise tre og én dag før og etter, samme reiselengde, aldri en dato som har passert.

describe("datoene rundt", () => {
  const today = new Date(2026, 8, 25, 12, 0);

  it("tre og én dag før og etter, begge datoene flyttet like mye", () => {
    expect(nearbyDates({ departDate: "2026-10-23", returnDate: "2026-10-30" }, today)).toEqual([
      { days: -3, departDate: "2026-10-20", returnDate: "2026-10-27" },
      { days: -1, departDate: "2026-10-22", returnDate: "2026-10-29" },
      { days: 1, departDate: "2026-10-24", returnDate: "2026-10-31" },
      { days: 3, departDate: "2026-10-26", returnDate: "2026-11-02" },
    ]);
  });

  it("aldri før i dag: avreise i morgen gir i dag, men ikke tre dager før", () => {
    expect(nearbyDates({ departDate: "2026-09-26", returnDate: "2026-10-03" }, today).map((d) => d.days)).toEqual([-1, 1, 3]);
    expect(nearbyDates({ departDate: "2026-09-26", returnDate: "2026-10-03" }, today)[0]!.departDate).toBe("2026-09-25");
  });

  it("over månedsskifte og sommertid (25. oktober) blir det hele dager", () => {
    expect(nearbyDates({ departDate: "2026-10-24", returnDate: "2026-10-24" }, today).map((d) => d.departDate)).toEqual(["2026-10-21", "2026-10-23", "2026-10-25", "2026-10-27"]);
  });
});
