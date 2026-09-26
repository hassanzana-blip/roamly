import { describe, expect, it } from "vitest";
import { calendarDayOffset, parseCalendarDate, searchDateIssue } from "./searchDates";

describe("travel calendar dates", () => {
  it("does not silently roll impossible dates into another month", () => {
    for (const value of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-10-00", "2026-1-2", "not-a-date"]) {
      expect(parseCalendarDate(value)).toBeUndefined();
    }
    expect(parseCalendarDate("2028-02-29")).toBeInstanceOf(Date);
  });

  it("keeps local dates near midnight and crosses month/year boundaries", () => {
    expect(calendarDayOffset(0, new Date(2026, 8, 24, 0, 30))).toBe("2026-09-24");
    expect(calendarDayOffset(1, new Date(2026, 11, 31, 23, 30))).toBe("2027-01-01");
    expect(calendarDayOffset(1, new Date(2026, 2, 28, 23, 30))).toBe("2026-03-29");
    expect(calendarDayOffset(-1, new Date(2028, 2, 1, 0, 30))).toBe("2028-02-29");
  });

  it("rejects stale saved searches without treating a same-day return as invalid", () => {
    expect(searchDateIssue(["2026-09-23", "2026-10-01"], "2026-09-24")).toBe("past");
    expect(searchDateIssue(["2026-09-24", "2026-09-24"], "2026-09-24")).toBeNull();
  });

  it("rejects reversed return and multi-city dates", () => {
    expect(searchDateIssue(["2026-10-02", "2026-10-01"], "2026-09-24")).toBe("order");
    expect(searchDateIssue(["2026-10-02", "2026-10-04", "2026-10-03"], "2026-09-24")).toBe("order");
    expect(searchDateIssue(["2026-10-02", "2026-10-02", "2026-10-03"], "2026-09-24")).toBeNull();
  });

  it("distinguishes unfinished input from invalid calendar dates", () => {
    expect(searchDateIssue([], "2026-09-24")).toBe("missing");
    expect(searchDateIssue(["2026-10-01", ""], "2026-09-24")).toBe("missing");
    expect(searchDateIssue(["2026-02-30"], "2026-09-24")).toBe("invalid");
  });
});
