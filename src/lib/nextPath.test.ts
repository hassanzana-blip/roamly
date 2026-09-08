import { describe, expect, it } from "vitest";
import { safeNextPath } from "./nextPath";

describe("safeNextPath", () => {
  it("slipper gjennom stier i appen", () => {
    expect(safeNextPath("/profil")).toBe("/profil");
    expect(safeNextPath("/bestill?offer=abc123")).toBe("/bestill?offer=abc123");
    expect(safeNextPath("/reisemal/barcelona#bilder")).toBe("/reisemal/barcelona#bilder");
  });

  it("avviser alt som peker ut av appen", () => {
    for (const bad of ["//example.com", "https://example.com/x", "http://example.com", "javascript:alert(1)", "/\\example.com", "example.com"]) {
      expect(safeNextPath(bad), bad).toBe("/profil");
    }
  });

  it("faller tilbake på tomt, manglende og kontrolltegn", () => {
    expect(safeNextPath(null)).toBe("/profil");
    expect(safeNextPath("")).toBe("/profil");
    expect(safeNextPath("/god\nnatt")).toBe("/profil");
    expect(safeNextPath(null, "/reiser")).toBe("/reiser");
  });
});
