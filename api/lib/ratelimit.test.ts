import { describe, expect, it } from "vitest";
import { assertRateLimit, checkRateLimit, clientIp } from "./ratelimit";
import { AppError } from "./errors";

describe("assertRateLimit", () => {
  it("allows calls up to the limit, then throws AppError RATE_LIMITED with retryAfterSec", () => {
    const scope = `test:${Math.random()}`;
    expect(() => assertRateLimit(scope, "1.2.3.4", 3, 60_000)).not.toThrow();
    expect(() => assertRateLimit(scope, "1.2.3.4", 3, 60_000)).not.toThrow();
    expect(() => assertRateLimit(scope, "1.2.3.4", 3, 60_000)).not.toThrow();
    try {
      assertRateLimit(scope, "1.2.3.4", 3, 60_000);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const e = err as AppError;
      expect(e.code).toBe("RATE_LIMITED");
      expect(e.message).toMatch(/For mange forespørsler.*Vent \d+ sekunder/);
      expect(typeof e.data?.retryAfterSec).toBe("number");
      expect(e.data?.retryAfterSec as number).toBeGreaterThan(0);
      expect(e.data?.retryAfterSec as number).toBeLessThanOrEqual(60);
      expect(e.toTRPC().code).toBe("TOO_MANY_REQUESTS");
    }
  });

  it("tracks scopes and keys independently", () => {
    const scope = `test:${Math.random()}`;
    assertRateLimit(scope, "10.0.0.1", 1, 60_000);
    expect(() => assertRateLimit(scope, "10.0.0.1", 1, 60_000)).toThrow();
    // different key under same scope is fine
    expect(() => assertRateLimit(scope, "10.0.0.2", 1, 60_000)).not.toThrow();
    // same key under a different scope is fine
    expect(() => assertRateLimit(`${scope}:other`, "10.0.0.1", 1, 60_000)).not.toThrow();
  });

  it("lets calls through again once the window has passed", async () => {
    const scope = `test:${Math.random()}`;
    assertRateLimit(scope, "9.9.9.9", 1, 5); // 5 ms window
    await new Promise((r) => setTimeout(r, 10));
    expect(() => assertRateLimit(scope, "9.9.9.9", 1, 5)).not.toThrow();
  });

  it("checkRateLimit returns false instead of throwing", () => {
    const scope = `test:${Math.random()}`;
    expect(checkRateLimit(scope, "k", 1, 60_000)).toBe(true);
    expect(checkRateLimit(scope, "k", 1, 60_000)).toBe(false);
  });
});

describe("clientIp", () => {
  it("uses the LAST x-forwarded-for entry (appended by the trusted proxy), not the spoofable first one", () => {
    const req = new Request("http://x", {
      headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.7" },
    });
    expect(clientIp(req)).toBe("203.0.113.7");
  });

  it("works with a single entry", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.7" } }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then 'local'", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-real-ip": "198.51.100.2" } }))).toBe(
      "198.51.100.2",
    );
    expect(clientIp(new Request("http://x"))).toBe("local");
  });
});
