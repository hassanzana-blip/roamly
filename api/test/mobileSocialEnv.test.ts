import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Appens sosiale knapper følger to ting i miljøet: leverandørene i Clerk
 * (CLERK_*) og operatørens bekreftelse av native flyt (MOBILE_CLERK_NATIVE_PROVIDERS).
 * Uten bekreftelsen vises ingen knapp, selv når nettet har Google.
 */

const BASE: Record<string, string> = {
  NODE_ENV: "test",
  DATABASE_URL: "mysql://root@localhost:3306/test",
  PII_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
};
const VARS = ["CLERK_SECRET_KEY", "CLERK_PUBLISHABLE_KEY", "CLERK_SOCIAL_PROVIDERS", "MOBILE_CLERK_NATIVE_PROVIDERS"];
const LIVE_KEY = "pk_live_" + Buffer.from("clerk.hellosky.no$", "utf8").toString("base64");

async function providersWith(vars: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries({ ...BASE, ...vars })) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const env = await import("../lib/env");
  const { mobileAuthProviders } = await import("../lib/mobileSocial");
  return mobileAuthProviders(env.clerkConfig(), env.mobileClerkNativeProviders());
}

afterEach(() => {
  for (const k of VARS) delete process.env[k];
  vi.resetModules();
});

describe("mobileAuth.providers fra miljøet", () => {
  it("produksjon slik den er i dag (Clerk + Google, ingen native-bekreftelse): ingen sosial knapp i appen", async () => {
    const r = await providersWith({ CLERK_SECRET_KEY: "sk_live_secret", CLERK_PUBLISHABLE_KEY: LIVE_KEY, CLERK_SOCIAL_PROVIDERS: "google" });
    expect(r.social.find((s) => s.provider === "google")).toEqual({ provider: "google", available: false, reason: "native_not_ready" });
    expect(r.clerkPublishableKey).toBeNull();
    expect(JSON.stringify(r)).not.toContain("sk_live_secret");
  });

  it("staging slik den er i dag (ingen Clerk): ingen leverandører", async () => {
    const r = await providersWith({});
    expect(r.social.every((s) => s.reason === "not_configured")).toBe(true);
  });

  it("etter at en operatør har bekreftet Google native (MOBILE_CLERK_NATIVE_PROVIDERS=google): Google med publiserbar nøkkel, ikke den hemmelige", async () => {
    const r = await providersWith({ CLERK_SECRET_KEY: "sk_live_secret", CLERK_PUBLISHABLE_KEY: LIVE_KEY, CLERK_SOCIAL_PROVIDERS: "google", MOBILE_CLERK_NATIVE_PROVIDERS: " Google , apple " });
    expect(r.social).toEqual([
      { provider: "google", available: true, reason: null },
      { provider: "apple", available: false, reason: "not_configured" },
    ]);
    expect(r.clerkPublishableKey).toBe(LIVE_KEY);
    expect(JSON.stringify(r)).not.toContain("sk_live_secret");
  });
});
