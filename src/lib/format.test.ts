import { describe, expect, it } from "vitest";
import { layoverInfo } from "./format";

/**
 * Mellomlanding måles i flyplassens egen tidssone: en overnatting er en
 * overnatting der man faktisk står og venter. Den forrige implementasjonen
 * ga luxon `setZone: true`, som betyr «bruk sonen fra strengen» og dermed
 * overstyrte flyplassens sone – i praksis ble alt regnet i UTC.
 */
describe("layoverInfo", () => {
  it("regner varighet fra øyeblikkene, uavhengig av hvordan de er skrevet", () => {
    expect(layoverInfo("2026-10-13T22:40:00+03:00", "2026-10-14T07:15:00+03:00", "Europe/Istanbul").minutes).toBe(515);
    expect(layoverInfo("2026-10-13T10:00:00Z", "2026-10-13T15:30:00Z", "Asia/Dubai").minutes).toBe(330);
  });

  it("krysser lokal midnatt i flyplassens sone, ikke i UTC", () => {
    // 21:00Z → 04:00Z er 01:00 → 08:00 i Dubai: syv timer, men samme døgn der.
    expect(layoverInfo("2026-10-13T21:00:00Z", "2026-10-14T04:00:00Z", "Asia/Dubai")).toEqual({
      minutes: 420,
      overnight: false,
      long: true,
    });
    // Samme lengde i Oslo (23:00 → 06:00 lokalt) krysser midnatt.
    expect(layoverInfo("2026-10-13T21:00:00Z", "2026-10-14T04:00:00Z", "Europe/Oslo").overnight).toBe(true);
  });

  it("markerer lang mellomlanding over fire timer", () => {
    expect(layoverInfo("2026-10-13T08:00:00Z", "2026-10-13T12:01:00Z", "Europe/Oslo").long).toBe(true);
    expect(layoverInfo("2026-10-13T08:00:00Z", "2026-10-13T11:59:00Z", "Europe/Oslo").long).toBe(false);
  });

  it("faller tilbake på UTC ved ukjent sone, og på null minutter ved ugyldig dato", () => {
    expect(layoverInfo("2026-06-13T20:00:00Z", "2026-06-14T09:00:00Z", "Not/AZone").overnight).toBe(true);
    expect(layoverInfo("tull", "2026-06-14T09:00:00Z", "Europe/Oslo").minutes).toBe(0);
  });

  it("håndterer sommertidsskiftet i Oslo", () => {
    expect(layoverInfo("2026-03-28T23:00:00+01:00", "2026-03-29T08:00:00+02:00", "Europe/Oslo")).toEqual({
      minutes: 480,
      overnight: true,
      long: true,
    });
  });
});
