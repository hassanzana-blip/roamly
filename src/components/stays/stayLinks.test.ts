import { describe, expect, it } from "vitest";
import { carSearchHref, hotelSearchHref, hourLabel, parseChildAges, parseHour, splitRooms } from "./stayLinks";

describe("splitRooms", () => {
  it("fordeler voksne jevnt og teller aldri dobbelt", () => {
    // Gammel avrunding ga 3 + 3 for fem voksne på to rom – én gjest for mye på prisen.
    expect(splitRooms(5, [], 2)).toEqual([{ adults: 3 }, { adults: 2 }]);
    expect(splitRooms(2, [], 1)).toEqual([{ adults: 2 }]);
    expect(splitRooms(4, [], 3)).toEqual([{ adults: 2 }, { adults: 1 }, { adults: 1 }]);
  });

  it("gir hvert rom minst én voksen", () => {
    expect(splitRooms(1, [], 2)).toEqual([{ adults: 1 }, { adults: 1 }]);
  });

  it("legger barna etter tur fra første rom og beholder aldrene", () => {
    expect(splitRooms(2, [7, 12], 1)).toEqual([{ adults: 2, childAges: [7, 12] }]);
    expect(splitRooms(2, [7, 12, 3], 2)).toEqual([
      { adults: 1, childAges: [7, 3] },
      { adults: 1, childAges: [12] },
    ]);
  });
});

describe("parseChildAges", () => {
  it("leser kids-parameteren og forkaster tull", () => {
    expect(parseChildAges("7,12")).toEqual([7, 12]);
    expect(parseChildAges("0,17,18,-1,x")).toEqual([0, 17]);
    expect(parseChildAges(null)).toEqual([]);
    expect(parseChildAges("")).toEqual([]);
  });
});

describe("hotelSearchHref", () => {
  it("tar barnas alder med i lenken bare når det er barn", () => {
    const base = { dest: "kplace:1", place: "Lisboa", checkin: "2026-10-03", checkout: "2026-10-06", adults: 2, rooms: 1 };
    expect(hotelSearchHref(base)).not.toContain("kids=");
    expect(hotelSearchHref({ ...base, childAges: [4, 9] })).toContain("kids=4%2C9");
  });
});

describe("carSearchHref", () => {
  const base = { type: "airport" as const, value: "OSL", place: "Oslo Gardermoen", pickup: "2026-10-03", dropoff: "2026-10-06" };
  it("utelater standardtiden og tar med avvikende tider og annet leveringssted", () => {
    expect(carSearchHref(base)).not.toMatch(/ph=|dh=|dtype=/);
    const href = carSearchHref({ ...base, pickupHour: 14, dropoffHour: 10, dropoffType: "airport", dropoffValue: "BGO", dropoffPlace: "Bergen" });
    expect(href).toContain("ph=14");
    expect(href).not.toContain("dh=");
    expect(href).toContain("dtype=airport");
    expect(href).toContain("dvalue=BGO");
  });
  it("leser timer trygt", () => {
    expect(parseHour("14")).toBe(14);
    expect(parseHour("24")).toBe(10);
    expect(parseHour(null)).toBe(10);
    expect(hourLabel(9)).toBe("09:00");
  });
});
