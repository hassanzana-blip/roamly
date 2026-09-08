import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { SHARE_KEY_BYTES, SHARE_KEY_RE, SHARE_TOKEN_BYTES, SHARE_TOKEN_RE, isShareToken } from "./shareTokens";

/**
 * Denne testen finnes fordi formatet en gang kom i utakt med generatoren:
 * lenkene ble laget riktig og avvist ved åpning, og både ReiseMatch og
 * reisetavlene sluttet å virke uten at noe feilet høylytt.
 */
const randomToken = (bytes: number) => randomBytes(bytes).toString("base64url");

describe("delingstokens", () => {
  it("godtar det generatoren faktisk lager – hver gang", () => {
    for (let i = 0; i < 200; i++) {
      expect(randomToken(SHARE_TOKEN_BYTES)).toMatch(SHARE_TOKEN_RE);
      expect(randomToken(SHARE_KEY_BYTES)).toMatch(SHARE_KEY_RE);
    }
  });

  it("avviser gammelt format, tomme verdier og tokens fra en annen lengde", () => {
    expect(isShareToken("")).toBe(false);
    expect(isShareToken("a".repeat(24))).toBe(false);
    expect(isShareToken(randomToken(SHARE_KEY_BYTES))).toBe(false);
    expect(isShareToken(`${randomToken(SHARE_TOKEN_BYTES)}!`)).toBe(false);
  });
});
