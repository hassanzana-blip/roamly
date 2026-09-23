import { describe, expect, it } from "vitest";
import { OWNER_PROFILES, isOwnerProfileId, ownerProfile, profileLabel } from "./ownerProfiles";

/**
 * Profilen avgjør hvilket navn som står i revisjonsloggen. Den må derfor
 * aldri kunne bli tom, forvekslet eller satt til noe klienten fant på.
 */

describe("eierprofiler", () => {
  it("har to profiler med hver sin id", () => {
    expect(OWNER_PROFILES.map((p) => p.id)).toEqual(["zana", "zyar"]);
  });

  it("gir hver profil sitt eget navn", () => {
    const names = new Set(OWNER_PROFILES.map((p) => p.name));
    expect(names.size).toBe(OWNER_PROFILES.length);
  });

  it("godtar bare de to id-ene", () => {
    expect(isOwnerProfileId("zana")).toBe(true);
    expect(isOwnerProfileId("zyar")).toBe(true);
    expect(isOwnerProfileId("eier")).toBe(false);
    expect(isOwnerProfileId("ZANA")).toBe(false);
  });

  it("avviser verdier som ikke er tekst", () => {
    for (const bad of [null, undefined, 0, 1, {}, [], true]) expect(isOwnerProfileId(bad)).toBe(false);
  });

  it("slår opp profilen bak en id", () => {
    expect(ownerProfile("zyar")?.name).toBe("Zyar");
    expect(ownerProfile("tull")).toBeNull();
    expect(ownerProfile(null)).toBeNull();
  });

  it("gir navnet til revisjonsloggen, og null når ingen profil er valgt", () => {
    expect(profileLabel("zana")).toBe("Zana");
    expect(profileLabel(null)).toBeNull();
    expect(profileLabel("tull")).toBeNull();
  });
});
