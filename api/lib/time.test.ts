import { describe, expect, it } from "vitest";
import { segmentInstant, segmentLocal, zoneFor } from "./time";

describe("segmentInstant", () => {
  it("tolker naiv ISO (uten offset) i oppgitt sone", () => {
    // 10:30 i Oslo sommertid = 08:30Z
    expect(segmentInstant("2026-07-01T10:30:00", "Europe/Oslo")).toBe(Date.parse("2026-07-01T08:30:00Z"));
    // Vintertid: +01:00
    expect(segmentInstant("2026-01-15T10:30:00", "Europe/Oslo")).toBe(Date.parse("2026-01-15T09:30:00Z"));
    // Samme veggklokke i New York er 4 timer senere enn Oslo (sommer)
    expect(segmentInstant("2026-07-01T10:30:00", "America/New_York")).toBe(Date.parse("2026-07-01T14:30:00Z"));
  });

  it("beholder tidspunktet når strengen har offset eller Z, uansett sone", () => {
    const z = "2026-07-01T08:30:00Z";
    expect(segmentInstant(z, "Europe/Oslo")).toBe(Date.parse(z));
    expect(segmentInstant(z, "Asia/Tokyo")).toBe(Date.parse(z));
    expect(segmentInstant("2026-07-01T10:30:00+02:00", "America/New_York")).toBe(Date.parse(z));
  });

  it("faller tilbake til UTC uten sone eller ved ukjent sone", () => {
    expect(segmentInstant("2026-07-01T08:30:00")).toBe(Date.parse("2026-07-01T08:30:00Z"));
    expect(segmentInstant("2026-07-01T08:30:00", "Mars/Olympus")).toBe(Date.parse("2026-07-01T08:30:00Z"));
  });

  it("returnerer null for tom/ugyldig input (aldri NaN)", () => {
    expect(segmentInstant("", "Europe/Oslo")).toBeNull();
    expect(segmentInstant(null)).toBeNull();
    expect(segmentInstant(undefined)).toBeNull();
    expect(segmentInstant("ikke en dato", "Europe/Oslo")).toBeNull();
  });
});

describe("zoneFor / segmentLocal", () => {
  it("foretrekker eksplisitt sone, ellers flyplassregister, ellers UTC", () => {
    expect(zoneFor("OSL")).toBe("Europe/Oslo");
    expect(zoneFor("OSL", "Asia/Tokyo")).toBe("Asia/Tokyo");
    expect(zoneFor("OSL", "Ugyldig/Sone")).toBe("Europe/Oslo");
    expect(zoneFor("ZZZ")).toBe("UTC");
    expect(zoneFor(null)).toBe("UTC");
  });

  it("segmentLocal gir veggklokke i sonen", () => {
    expect(segmentLocal("2026-07-01T08:30:00Z", "Europe/Oslo")).toBe("2026-07-01T10:30:00");
    expect(segmentLocal("2026-07-01T10:30:00", "Europe/Oslo")).toBe("2026-07-01T10:30:00");
    expect(segmentLocal(null, "Europe/Oslo")).toBeNull();
  });
});
