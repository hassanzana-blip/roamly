import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { hasPermission, ROLE_PERMISSIONS, VALID_ROLES } from "./rbac";
import { hashPassword, verifyPassword, passwordIssues } from "./passwords";
import {
  parseSignatureHeader,
  signPayload,
  verifyDuffelSignature,
  REPLAY_WINDOW_SEC,
} from "./duffelWebhook";
import { assertTransition, canTransition, ACTIVE_STATES, TRANSITIONS, BOOKING_STATES } from "./statemachine";
import { toMinor, fromMinor, addAmounts } from "./money";
import { randomToken, sha256Hex, humanReference } from "./tokens";
import { backoffDelayMs } from "./jobs";

describe("RBAC", () => {
  it("alle roller har et tillatelsessett", () => {
    for (const role of VALID_ROLES) {
      expect(ROLE_PERMISSIONS[role].size).toBeGreaterThan(0);
    }
  });

  it("OWNER har alle tillatelser ADMIN har", () => {
    for (const perm of ROLE_PERMISSIONS.ADMIN) {
      expect(ROLE_PERMISSIONS.OWNER.has(perm)).toBe(true);
    }
  });

  it("kun OWNER kan administrere ansatte", () => {
    expect(hasPermission("OWNER", "staff:manage")).toBe(true);
    expect(hasPermission("ADMIN", "staff:manage")).toBe(false);
    expect(hasPermission("SUPPORT", "staff:manage")).toBe(false);
    expect(hasPermission("FINANCE", "staff:manage")).toBe(false);
    expect(hasPermission("READ_ONLY", "staff:manage")).toBe(false);
  });

  it("READ_ONLY kan ikke skrive noe som helst", () => {
    for (const perm of ROLE_PERMISSIONS.READ_ONLY) {
      expect(perm.endsWith(":read") || perm === "overview:read").toBe(true);
    }
  });

  it("SUPPORT kan ikke behandle refusjoner eller se aktivitetslogg", () => {
    expect(hasPermission("SUPPORT", "refunds:process")).toBe(false);
    expect(hasPermission("SUPPORT", "audit:read")).toBe(false);
  });

  it("ukjent rolle har ingen tillatelser", () => {
    expect(hasPermission("SUPERUSER", "bookings:read")).toBe(false);
  });
});

describe("Booking-tilstandsmaskin", () => {
  it("alle tilstander har en overgangsoppføring", () => {
    for (const state of BOOKING_STATES) {
      expect(TRANSITIONS[state]).toBeDefined();
    }
  });

  it("REFUNDED er en terminal tilstand", () => {
    expect(TRANSITIONS.REFUNDED).toHaveLength(0);
    expect(canTransition("REFUNDED", "CONFIRMED")).toBe(false);
  });

  it("bekreftet bestilling kan kanselleres eller endres, men ikke bookes på nytt", () => {
    expect(canTransition("CONFIRMED", "CANCELLED")).toBe(true);
    expect(canTransition("CONFIRMED", "CHANGE_REQUESTED")).toBe(true);
    expect(canTransition("CONFIRMED", "BOOKING_PROCESSING")).toBe(false);
  });

  it("full refusjon krever å gå via REFUND_PENDING", () => {
    expect(canTransition("CONFIRMED", "REFUNDED")).toBe(false);
    expect(canTransition("CONFIRMED", "REFUND_PENDING")).toBe(true);
    expect(canTransition("REFUND_PENDING", "REFUNDED")).toBe(true);
  });

  it("assertTransition kaster på ugyldige overganger", () => {
    expect(() => assertTransition("REFUNDED", "CONFIRMED")).toThrow(/Ugyldig statusovergang/);
    expect(() => assertTransition("DRAFT", "REFUNDED")).toThrow();
  });

  it("assertTransition slipper gjennom gyldige overganger", () => {
    expect(() => assertTransition("AWAITING_PAYMENT", "PAYMENT_AUTHORIZED")).not.toThrow();
  });

  it("alle aktive tilstander er gyldige tilstander", () => {
    for (const state of ACTIVE_STATES) {
      expect(BOOKING_STATES).toContain(state);
    }
    expect(ACTIVE_STATES).not.toContain("REFUNDED");
    expect(ACTIVE_STATES).not.toContain("CANCELLED");
  });
});

describe("Penger (desimal, aldri flyttall)", () => {
  it("konverterer til/fra minste enhet uten avrundingsfeil", () => {
    expect(toMinor("1234.56")).toBe(123456);
    expect(fromMinor(123456)).toBe("1234.56");
    expect(toMinor("0.10")).toBe(10);
    expect(fromMinor(1)).toBe("0.01");
  });

  it("adderer beløp korrekt også der flyttall feiler", () => {
    expect(addAmounts("0.10", "0.20")).toBe("0.30");
    expect(addAmounts("999.99", "0.01")).toBe("1000.00");
    expect(addAmounts("19.90", "-19.90")).toBe("0.00");
  });
});

describe("Tokens og referanser", () => {
  it("randomToken gir unike, URL-trygge tokens", () => {
    const a = randomToken(32);
    const b = randomToken(32);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThanOrEqual(40);
  });

  it("sha256Hex er deterministisk og 64 tegn", () => {
    const h = sha256Hex("roamly");
    expect(h).toHaveLength(64);
    expect(h).toBe(sha256Hex("roamly"));
    expect(h).not.toBe(sha256Hex("Roamly"));
  });

  it("humanReference har prefiks og 6 tegn", () => {
    const ref = humanReference("RT");
    expect(ref).toMatch(/^RT-[A-Z0-9]{6}$/);
  });
});

describe("Jobbkø: backoff", () => {
  it("øker eksponentielt med antall forsøk", () => {
    const samples = (attempt: number) =>
      Array.from({ length: 20 }, () => backoffDelayMs(attempt));
    const minOf = (arr: number[]) => Math.min(...arr);
    // Med ±25 % jitter: grunnverdi for attempt n er 15s * 2^n (maks 30 min)
    expect(minOf(samples(1))).toBeGreaterThanOrEqual(15_000 * 2 * 0.75);
    expect(minOf(samples(3))).toBeGreaterThanOrEqual(15_000 * 8 * 0.75);
    // Over maks-taket (30 min) skal den aldri overstige 30 min * 1.25
    const high = samples(20);
    expect(Math.max(...high)).toBeLessThanOrEqual(30 * 60_000 * 1.25 + 1);
  });

  it("returnerer alltid positiv forsinkelse", () => {
    for (let attempt = 1; attempt <= 10; attempt++) {
      expect(backoffDelayMs(attempt)).toBeGreaterThan(0);
    }
  });
});

describe("Passordhashing (Argon2id)", () => {
  it("hash verifiseres mot riktig passord, avvises mot feil", async () => {
    const hash = await hashPassword("Sterkt-Passord-123");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "Sterkt-Passord-123")).toBe(true);
    expect(await verifyPassword(hash, "Feil-Passord-123")).toBe(false);
  });

  it("to hasher av samme passord er ulike (salt)", async () => {
    const a = await hashPassword("Samme-Passord-1");
    const b = await hashPassword("Samme-Passord-1");
    expect(a).not.toBe(b);
  });

  it("passordregler: minst 12 tegn, store/små bokstaver og tall", () => {
    expect(passwordIssues("Kort1")).not.toHaveLength(0);
    expect(passwordIssues("uten-tall-og-stor")).not.toHaveLength(0);
    expect(passwordIssues("UTEN-SMA-123")).not.toHaveLength(0);
    expect(passwordIssues("Sterkt-Passord-123")).toHaveLength(0);
  });
});

describe("Duffel webhook-signatur", () => {
  const secret = "test-webhook-secret";
  const body = JSON.stringify({ id: "evt_123", type: "order.created", data: {} });

  const headerFor = (ts: string, sig: string) => `t=${ts},v1=${sig}`;

  it("gyldig signatur godkjennes", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = signPayload(secret, ts, body);
    const result = verifyDuffelSignature(secret, headerFor(ts, sig), body);
    expect(result.ok).toBe(true);
  });

  it("feil hemmelighet avvises", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = signPayload("annen-hemmelighet", ts, body);
    const result = verifyDuffelSignature(secret, headerFor(ts, sig), body);
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("endret body avvises (signaturen passer ikke lenger)", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = signPayload(secret, ts, body);
    const tampered = body.replace("evt_123", "evt_999");
    const result = verifyDuffelSignature(secret, headerFor(ts, sig), tampered);
    expect(result.ok).toBe(false);
  });

  it("gammel tidsstempel avvises (replay-beskyttelse)", () => {
    const now = Date.now();
    const oldTs = String(Math.floor(now / 1000) - REPLAY_WINDOW_SEC - 10);
    const sig = signPayload(secret, oldTs, body);
    const result = verifyDuffelSignature(secret, headerFor(oldTs, sig), body, now);
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("manglende eller feilformatert header avvises", () => {
    expect(verifyDuffelSignature(secret, "", body)).toEqual({ ok: false, reason: "missing" });
    expect(verifyDuffelSignature(secret, "v1=abc", body)).toEqual({ ok: false, reason: "missing" });
    expect(verifyDuffelSignature(secret, "t=123", body)).toEqual({ ok: false, reason: "missing" });
  });

  it("signatur med feil lengde krasjer ikke timingSafeEqual", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const result = verifyDuffelSignature(secret, headerFor(ts, "kort"), body);
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("parser header-formatet korrekt", () => {
    expect(parseSignatureHeader("t=1700000000,v1=abc123")).toEqual({
      t: "1700000000",
      v1: "abc123",
    });
  });

  it("signaturen følger Duffel-formatet: HMAC-SHA256 over '{t}.{body}'", () => {
    const ts = "1700000000";
    const manual = createHmac("sha256", secret).update(`${ts}.${body}`, "utf8").digest("hex");
    expect(signPayload(secret, ts, body)).toBe(manual);
  });
});
