import { describe, expect, it } from "vitest";
import { deviceFrom, marketFrom } from "./metaTracking";

/**
 * De to funksjonene som gjør en forespørsel om til en analyserad. Alt annet
 * i modulen skriver til databasen; dette er det som avgjør *hva* som skrives
 * – og dermed hvor grensen mot personopplysninger går.
 */

const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });

describe("deviceFrom", () => {
  it("kjenner igjen telefon", () => {
    expect(deviceFrom("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("mobile");
    expect(deviceFrom("Mozilla/5.0 (Linux; Android 14) Mobile Safari")).toBe("mobile");
  });

  it("skiller nettbrett fra telefon", () => {
    expect(deviceFrom("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("tablet");
  });

  it("kaller alt annet desktop", () => {
    expect(deviceFrom("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("desktop");
  });

  it("sier «unknown» heller enn å gjette når strengen mangler", () => {
    expect(deviceFrom(undefined)).toBe("unknown");
    expect(deviceFrom("")).toBe("unknown");
  });

  it("lagrer aldri selve user-agent-strengen", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) sporbar-streng";
    expect(["mobile", "tablet", "desktop", "unknown"]).toContain(deviceFrom(ua));
  });
});

describe("marketFrom", () => {
  it("leser landkoden plattformen oppgir", () => {
    expect(marketFrom(headers({ "cf-ipcountry": "NO" }))).toBe("NO");
    expect(marketFrom(headers({ "x-vercel-ip-country": "se" }))).toBe("SE");
  });

  it("er null når ingen oppgir noe", () => {
    expect(marketFrom(headers({}))).toBeNull();
  });

  it("avviser alt som ikke er en tobokstavs kode", () => {
    expect(marketFrom(headers({ "cf-ipcountry": "XX1" }))).toBeNull();
    expect(marketFrom(headers({ "cf-ipcountry": "N" }))).toBeNull();
    expect(marketFrom(headers({ "cf-ipcountry": "" }))).toBeNull();
    expect(marketFrom(headers({ "cf-ipcountry": "norge" }))).toBeNull();
  });
});
