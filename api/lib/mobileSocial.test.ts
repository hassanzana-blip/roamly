import { describe, expect, it } from "vitest";
import { mobileAuthProviders } from "./mobileSocial";

const off = { enabled: false, publishableKey: null, providers: [] as string[] };
const prodLike = { enabled: true, publishableKey: "pk_live_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk", providers: ["google"] };

describe("mobileAuthProviders: appen viser bare det som virker", () => {
  it("uten Clerk (som staging i dag): bare e-post/passord, ingen nøkkel", () => {
    expect(mobileAuthProviders(off, ["google", "apple"])).toEqual({
      password: true,
      social: [
        { provider: "google", available: false, reason: "not_configured" },
        { provider: "apple", available: false, reason: "not_configured" },
      ],
      clerkPublishableKey: null,
    });
  });

  it("Clerk + Google på nett (som produksjon i dag), men native flyt ikke bekreftet: ingen knapp, ingen nøkkel", () => {
    const r = mobileAuthProviders(prodLike, []);
    expect(r.social).toEqual([
      { provider: "google", available: false, reason: "native_not_ready" },
      { provider: "apple", available: false, reason: "not_configured" },
    ]);
    expect(r.clerkPublishableKey).toBeNull();
  });

  it("Google bekreftet native: Google tilgjengelig med publiserbar nøkkel; Apple fortsatt ikke (ikke i Clerk), selv om den står i native-listen", () => {
    const r = mobileAuthProviders(prodLike, ["google", "apple"]);
    expect(r.social).toEqual([
      { provider: "google", available: true, reason: null },
      { provider: "apple", available: false, reason: "not_configured" },
    ]);
    expect(r.clerkPublishableKey).toBe(prodLike.publishableKey);
  });

  it("andre Clerk-leverandører (facebook, x) vises aldri i appen; ingen hemmelig nøkkel i svaret", () => {
    const r = mobileAuthProviders({ ...prodLike, providers: ["facebook", "x", "google"] }, ["facebook", "x"]);
    expect(r.social.map((s) => s.provider)).toEqual(["google", "apple"]);
    expect(r.social.every((s) => !s.available)).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/sk_(live|test)_/);
  });
});
