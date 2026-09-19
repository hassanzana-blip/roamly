import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * CSP og Clerk. Knappen «Fortsett med Google» sto på /logg-inn og så ferdig ut,
 * men clerk.browser.js ble blokkert av vår egen script-src og innloggingen døde
 * med failed_to_load_clerk_js – synlig bare i nettleserens konsoll. Testene
 * låser at verten utledes riktig av nøkkelen og faktisk havner i policyen.
 */

const BASE: Record<string, string> = {
  NODE_ENV: "test",
  DATABASE_URL: "mysql://root@localhost:3306/test",
  PII_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
};
const CLERK_VARS = ["CLERK_SECRET_KEY", "CLERK_PUBLISHABLE_KEY", "CLERK_SOCIAL_PROVIDERS"];
const LIVE_KEY = "pk_live_" + Buffer.from("clerk.hellosky.no$", "utf8").toString("base64");

function setEnv(vars: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries({ ...BASE, ...vars })) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

afterEach(() => {
  for (const k of CLERK_VARS) delete process.env[k];
  vi.resetModules();
});

describe("clerkFrontendApiOrigin", () => {
  it("utleder verten fra live- og test-nøkler", async () => {
    setEnv({ CLERK_SECRET_KEY: "sk_live_x", CLERK_PUBLISHABLE_KEY: LIVE_KEY, CLERK_SOCIAL_PROVIDERS: "google" });
    expect((await import("../lib/env")).clerkFrontendApiOrigin()).toBe("https://clerk.hellosky.no");
    const testKey = "pk_test_" + Buffer.from("clerk.example.dev$", "utf8").toString("base64");
    setEnv({ CLERK_SECRET_KEY: "sk_test_x", CLERK_PUBLISHABLE_KEY: testKey, CLERK_SOCIAL_PROVIDERS: "google" });
    expect((await import("../lib/env")).clerkFrontendApiOrigin()).toBe("https://clerk.example.dev");
  });

  it("gir null når Clerk er av eller oppsettet er ufullstendig", async () => {
    setEnv({ CLERK_PUBLISHABLE_KEY: undefined });
    expect((await import("../lib/env")).clerkFrontendApiOrigin()).toBeNull();
    setEnv({ CLERK_SECRET_KEY: "sk_live_x", CLERK_PUBLISHABLE_KEY: LIVE_KEY, CLERK_SOCIAL_PROVIDERS: "" });
    expect((await import("../lib/env")).clerkFrontendApiOrigin()).toBeNull();
  });

  it("slipper ikke søppel inn i en sikkerhetsheader", async () => {
    for (const bad of ["pk_live_" + Buffer.from("ikke en vert/med skråstrek$").toString("base64"), "pk_live_!!!!", "pk_live_"]) {
      setEnv({ CLERK_SECRET_KEY: "sk_live_x", CLERK_PUBLISHABLE_KEY: bad, CLERK_SOCIAL_PROVIDERS: "google" });
      expect((await import("../lib/env")).clerkFrontendApiOrigin()).toBeNull();
    }
  });
});

describe("CSP og Clerk", () => {
  async function csp(vars: Record<string, string | undefined>): Promise<string> {
    setEnv(vars);
    const app = (await import("../boot")).default;
    const res = await app.request("/healthz");
    return res.headers.get("content-security-policy") ?? "";
  }
  const directive = (policy: string, name: string) => policy.split(";").find((d) => d.trim().startsWith(name)) ?? "";

  it("har Clerk-verten i script-src og connect-src når Clerk er på", async () => {
    const policy = await csp({ CLERK_SECRET_KEY: "sk_live_x", CLERK_PUBLISHABLE_KEY: LIVE_KEY, CLERK_SOCIAL_PROVIDERS: "google" });
    expect(directive(policy, "script-src")).toContain("https://clerk.hellosky.no");
    expect(directive(policy, "connect-src")).toContain("https://clerk.hellosky.no");
  });

  it("slipper ikke inn fremmede verter når Clerk er av", async () => {
    const policy = await csp({ CLERK_SECRET_KEY: undefined, CLERK_PUBLISHABLE_KEY: undefined, CLERK_SOCIAL_PROVIDERS: undefined });
    expect(policy).not.toContain("clerk");
  });
});
