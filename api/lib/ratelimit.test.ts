import { describe, expect, it } from "vitest";
import { assertRateLimit, clientIp } from "./ratelimit";

describe("assertRateLimit", () => {
  it("allows calls up to the limit, then throws a Norwegian retry message", () => {
    const scope = `test:${Math.random()}`;
    expect(() => assertRateLimit(scope, "1.2.3.4", 3, 60_000)).not.toThrow();
    expect(() => assertRateLimit(scope, "1.2.3.4", 3, 60_000)).not.toThrow();
    expect(() => assertRateLimit(scope, "1.2.3.4", 3, 60_000)).not.toThrow();
    expect(() => assertRateLimit(scope, "1.2.3.4", 3, 60_000)).toThrowError(
      /For mange forespørsler.*Vent \d+ sekunder/,
    );
  });

  it("tracks scopes and IPs independently", () => {
    const scope = `test:${Math.random()}`;
    assertRateLimit(scope, "10.0.0.1", 1, 60_000);
    expect(() => assertRateLimit(scope, "10.0.0.1", 1, 60_000)).toThrow();
    // different IP under same scope is fine
    expect(() => assertRateLimit(scope, "10.0.0.2", 1, 60_000)).not.toThrow();
    // same IP under a different scope is fine
    expect(() => assertRateLimit(`${scope}:other`, "10.0.0.1", 1, 60_000)).not.toThrow();
  });

  it("lets calls through again once the window has passed", async () => {
    const scope = `test:${Math.random()}`;
    assertRateLimit(scope, "9.9.9.9", 1, 5); // 5 ms window
    await new Promise((r) => setTimeout(r, 10));
    expect(() => assertRateLimit(scope, "9.9.9.9", 1, 5)).not.toThrow();
  });
});

describe("clientIp", () => {
  it("prefers the first x-forwarded-for entry", () => {
    const req = new Request("http://x", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(clientIp(req)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then 'local'", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-real-ip": "198.51.100.2" } }))).toBe(
      "198.51.100.2",
    );
    expect(clientIp(new Request("http://x"))).toBe("local");
  });
});
