import { describe, expect, it } from "vitest";
import { realOrUndefined } from "./kayak";

describe("realOrUndefined", () => {
  it("keeps real airline and provider names", () => {
    expect(realOrUndefined("Norwegian")).toBe("Norwegian");
    expect(realOrUndefined("  SAS  ")).toBe("SAS");
    expect(realOrUndefined("https://logos.example.com/DY.png")).toBe("https://logos.example.com/DY.png");
  });
  it("drops sandbox placeholders instead of rendering them as a brand", () => {
    expect(realOrUndefined("Not available in Sandbox")).toBeUndefined();
    expect(realOrUndefined("not_available")).toBeUndefined();
    expect(realOrUndefined("https://cdn.example.com/sandbox/placeholder.png")).toBeUndefined();
    expect(realOrUndefined("no-image")).toBeUndefined();
  });
  it("treats empty and missing values as missing", () => {
    expect(realOrUndefined("")).toBeUndefined();
    expect(realOrUndefined(undefined)).toBeUndefined();
    expect(realOrUndefined("   ")).toBeUndefined();
  });
});
