import { describe, expect, it } from "vitest";
import { decideLink, hasPassword, NO_PASSWORD_HASH } from "./socialLogin";

describe("decideLink", () => {
  it("logger inn på kontoen en kjent identitet peker på", () => {
    expect(decideLink({ existingIdentityCustomerId: 7, currentCustomerId: null, emailMatchCustomerId: null, emailVerified: true })).toEqual({ action: "login", customerId: 7 });
    // Kjent identitet vinner over e-postmatch – e-posten kan ha byttet eier.
    expect(decideLink({ existingIdentityCustomerId: 7, currentCustomerId: null, emailMatchCustomerId: 9, emailVerified: true })).toEqual({ action: "login", customerId: 7 });
  });

  it("flytter aldri en identitet til en annen innlogget konto", () => {
    expect(decideLink({ existingIdentityCustomerId: 7, currentCustomerId: 8, emailMatchCustomerId: null, emailVerified: true })).toEqual({ action: "conflict", reason: "other_account" });
    expect(decideLink({ existingIdentityCustomerId: 7, currentCustomerId: 7, emailMatchCustomerId: null, emailVerified: true })).toEqual({ action: "login", customerId: 7 });
  });

  it("kobler til den innloggede kontoen når kunden selv ber om det", () => {
    expect(decideLink({ existingIdentityCustomerId: null, currentCustomerId: 3, emailMatchCustomerId: 5, emailVerified: false })).toEqual({ action: "link", customerId: 3 });
  });

  it("kobler på e-post bare når leverandøren har verifisert den", () => {
    expect(decideLink({ existingIdentityCustomerId: null, currentCustomerId: null, emailMatchCustomerId: 5, emailVerified: true })).toEqual({ action: "link", customerId: 5 });
    expect(decideLink({ existingIdentityCustomerId: null, currentCustomerId: null, emailMatchCustomerId: 5, emailVerified: false })).toEqual({ action: "conflict", reason: "unverified_email" });
  });

  it("oppretter ny konto når ingenting matcher – også uten e-post (Facebook)", () => {
    expect(decideLink({ existingIdentityCustomerId: null, currentCustomerId: null, emailMatchCustomerId: null, emailVerified: false })).toEqual({ action: "create" });
  });
});

describe("hasPassword", () => {
  it("skiller ekte Argon2-hasher fra sperreverdier", () => {
    expect(hasPassword("$argon2id$v=19$m=65536,t=3,p=4$abc$def")).toBe(true);
    expect(hasPassword(NO_PASSWORD_HASH)).toBe(false);
    expect(hasPassword("!deleted")).toBe(false);
  });
});
