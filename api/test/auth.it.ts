import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/stripe", () => import("./stripeMock"));

import { NobleCryptoPlugin, ScureBase32Plugin, generate } from "otplib";
import { caller, closeDb, countRows, expectAppCode, makeCtx, rows, runJobsUntilIdle, searchOffer, sessionInput, truncateAll, type CtxOptions } from "./setup";
import { createCallerFactory } from "../middleware";
import { appRouter } from "../router";
import { hashPassword } from "../lib/passwords";
import { resolveSession } from "../lib/sessions";
import { resolveCustomerSession } from "../lib/customerSessions";
import { randomToken, sha256Hex } from "../lib/tokens";
import { getDb } from "../queries/connection";
import { customerEmailTokens, staffUsers } from "../../db/schema";
import { setDuffelClient } from "../lib/duffel";

// ─── Autentisering: staff (passord + TOTP) og kunde (registrering → sletting) ──

const factory = createCallerFactory(appRouter);

/** Plukk cookie fra Set-Cookie og bygg en ny kontekst med sesjonen løst opp som i context.ts. */
async function withCookie(resHeaders: Headers, extra: CtxOptions = {}) {
  const setCookie = resHeaders.get("set-cookie") ?? "";
  const cookie = setCookie
    .split(/,(?=\s*hellosky_)/)
    .map((c) => c.split(";")[0].trim())
    .filter((c) => c.includes("=") && !c.endsWith("="))
    .join("; ");
  const ctx = makeCtx({ ...extra, headers: { ...(extra.headers ?? {}), cookie } });
  ctx.staff = await resolveSession(ctx.req);
  ctx.customer = await resolveCustomerSession(ctx.req);
  return { ctx, caller: factory(ctx), cookie };
}

async function totpCode(otpauthUri: string): Promise<string> {
  const secret = new URL(otpauthUri).searchParams.get("secret")!;
  return generate({ secret, crypto: new NobleCryptoPlugin(), base32: new ScureBase32Plugin() });
}

describe("staff-autentisering", () => {
  beforeEach(truncateAll);
  afterAll(closeDb);

  const PASSWORD = "Sikkert-Passord-123";

  it("login → MFA-oppsett påkrevd → beginMfaSetup → completeMfaSetup (TOTP) → tillatelsesprosedyre virker; uten MFA avvises", async () => {
    await getDb().insert(staffUsers).values({ email: "eier@hellosky.test", name: "Eier", role: "OWNER", status: "active", mfaEnabled: false, passwordHash: await hashPassword(PASSWORD) });

    // Feil passord
    await expect(caller().staffAuth.login({ email: "eier@hellosky.test", password: "feil" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(await countRows("audit_logs", "action='auth.login_failed'")).toBe(1);

    const ctx1 = makeCtx();
    const login = await factory(ctx1).staffAuth.login({ email: "eier@hellosky.test", password: PASSWORD });
    expect(login).toMatchObject({ mfaRequired: false, mfaSetupRequired: true, role: "OWNER" });
    expect(ctx1.resHeaders.get("set-cookie")).toContain("hellosky_staff=");
    expect(ctx1.resHeaders.get("set-cookie")).toContain("HttpOnly");
    expect(ctx1.resHeaders.get("set-cookie")).toContain("SameSite=Strict");

    const s1 = await withCookie(ctx1.resHeaders);
    expect(s1.ctx.staff?.mfaEnabled).toBe(false);
    const me = await s1.caller.staffAuth.me();
    expect(me).toMatchObject({ authenticated: true, mfaSetupRequired: true });
    // Uten MFA: alle tillatelsesprosedyrer avvises med reason mfa_setup_required
    try {
      await s1.caller.admin.dashboard();
      throw new Error("skulle feilet");
    } catch (err) {
      expect(err).toMatchObject({ code: "UNAUTHORIZED" });
      const cause = (err as { cause?: { reason?: string; data?: { reason?: string } } }).cause;
      expect(cause?.reason ?? cause?.data?.reason).toBe("mfa_setup_required");
    }
    await expect(s1.caller.staffAuth.listStaff()).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const setup = await s1.caller.staffAuth.beginMfaSetup();
    expect(setup.otpauthUri).toContain("otpauth://totp/");
    expect(setup.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    await expect(s1.caller.staffAuth.completeMfaSetup({ code: "000000" })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const done = await s1.caller.staffAuth.completeMfaSetup({ code: await totpCode(setup.otpauthUri) });
    expect(done.ok).toBe(true);
    expect(done.recoveryCodes.length).toBe(8);
    // Sesjonen er rotert → ny cookie
    const s2 = await withCookie(s1.ctx.resHeaders);
    expect(s2.ctx.staff).toMatchObject({ mfaEnabled: true, mfaVerified: true, role: "OWNER" });
    const staff = await s2.caller.staffAuth.listStaff();
    expect(staff.length).toBe(1);
    expect(staff[0].mfaEnabled).toBe(true);
    const dash = await s2.caller.admin.dashboard();
    expect(dash).toBeTruthy();
    // Gammel cookie er ugyldig etter rotasjon
    const stale = await withCookie(ctx1.resHeaders);
    expect(stale.ctx.staff).toBeNull();

    // Ny innlogging: MFA kreves → verifyMfa
    const ctx3 = makeCtx();
    const login2 = await factory(ctx3).staffAuth.login({ email: "eier@hellosky.test", password: PASSWORD });
    expect(login2).toMatchObject({ mfaRequired: true, mfaSetupRequired: false });
    const s3 = await withCookie(ctx3.resHeaders);
    expect(s3.ctx.staff?.mfaVerified).toBe(false);
    await expect(s3.caller.staffAuth.listStaff()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(s3.caller.staffAuth.verifyMfa({ code: "123456" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await s3.caller.staffAuth.verifyMfa({ code: await totpCode(setup.otpauthUri) });
    const s4 = await withCookie(s3.ctx.resHeaders);
    expect(s4.ctx.staff?.mfaVerified).toBe(true);
    expect((await s4.caller.staffAuth.myPermissions()).permissions).toContain("staff:manage");

    // Gjenopprettingskode fungerer som MFA ved innlogging
    const ctx5 = makeCtx();
    await factory(ctx5).staffAuth.login({ email: "eier@hellosky.test", password: PASSWORD });
    const s5 = await withCookie(ctx5.resHeaders);
    await s5.caller.staffAuth.verifyMfa({ code: done.recoveryCodes[0] });
    const s6 = await withCookie(s5.ctx.resHeaders);
    expect(s6.ctx.staff?.mfaVerified).toBe(true);
    // Samme kode kan ikke brukes to ganger
    const ctx7 = makeCtx();
    await factory(ctx7).staffAuth.login({ email: "eier@hellosky.test", password: PASSWORD });
    const s7 = await withCookie(ctx7.resHeaders);
    await expect(s7.caller.staffAuth.verifyMfa({ code: done.recoveryCodes[0] })).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    // Logout tilbakekaller sesjonen
    await s6.caller.staffAuth.logout();
    expect((await withCookie(s5.ctx.resHeaders)).ctx.staff).toBeNull();
    expect(await countRows("audit_logs", "action='auth.mfa_enabled'")).toBe(1);
  });

  it("deaktivert konto kan ikke logge inn; førstegangsoppsett er selvdeaktiverende", async () => {
    expect((await caller().staffAuth.setupStatus()).needsSetup).toBe(true);
    await getDb().insert(staffUsers).values({ email: "x@hellosky.test", name: "X", role: "ADMIN", status: "disabled", mfaEnabled: true, passwordHash: await hashPassword(PASSWORD) });
    await expect(caller().staffAuth.login({ email: "x@hellosky.test", password: PASSWORD })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await caller().staffAuth.setupStatus()).needsSetup).toBe(false);
    await expect(caller().staffAuth.claimFirstOwner({ email: "ny@hellosky.test", name: "Ny" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("kunde-autentisering", () => {
  beforeEach(async () => {
    await truncateAll();
    setDuffelClient(null);
  });
  afterAll(closeDb);

  const PASSWORD = "kundepassord-2026";
  const EMAIL = "ola@hellosky.test";

  it("register → login → verifyEmail → myTrips/exportMyData → deleteAccount anonymiserer", async () => {
    const ctx = makeCtx();
    const profile = await factory(ctx).customerAuth.register({ identifier: EMAIL, password: PASSWORD, firstName: "Ola", lastName: "Nordmann", marketingConsent: true });
    expect(profile).toMatchObject({ email: EMAIL, emailVerified: false });
    expect(ctx.resHeaders.get("set-cookie")).toContain("hellosky_customer=");
    expect(await countRows("customer_email_tokens")).toBe(1);
    expect(await countRows("consents", "type='marketing' AND granted=1")).toBe(1);
    expect(await countRows("email_events", "kind='verify_email'")).toBe(1);

    await expectAppCode(caller().customerAuth.register({ identifier: EMAIL, password: PASSWORD, firstName: "Ola", lastName: "Nordmann" }), "CONFLICT");
    await expectAppCode(caller().customerAuth.register({ identifier: "kort@hellosky.test", password: "kort", firstName: "A", lastName: "B" }), "VALIDATION");

    const s1 = await withCookie(ctx.resHeaders);
    expect(s1.ctx.customer?.emailVerified).toBe(false);
    await expectAppCode(s1.caller.customerAuth.myTrips(), "EMAIL_NOT_VERIFIED");
    await expectAppCode(s1.caller.customerAuth.exportMyData(), "EMAIL_NOT_VERIFIED");

    // Bekreft e-post (token sendes på e-post — her utstedes ett direkte i DB som resendVerification ville gjort)
    const token = randomToken(32);
    await getDb().insert(customerEmailTokens).values({ tokenHash: sha256Hex(token), customerId: s1.ctx.customer!.customerId, expiresAt: new Date(Date.now() + 3_600_000) });
    await expectAppCode(caller().customerAuth.verifyEmail({ token: "ugyldig-token-123" }), "VALIDATION");
    expect((await caller().customerAuth.verifyEmail({ token })).ok).toBe(true);
    await expectAppCode(caller().customerAuth.verifyEmail({ token }), "VALIDATION"); // engangs

    // Innlogging (feil passord avvises)
    await expectAppCode(caller().customerAuth.login({ identifier: EMAIL, password: "feil-passord-1" }), "UNAUTHORIZED");
    const ctx2 = makeCtx();
    const me = await factory(ctx2).customerAuth.login({ identifier: EMAIL, password: PASSWORD });
    expect(me.emailVerified).toBe(true);
    const s2 = await withCookie(ctx2.resHeaders);

    // Booking på samme e-post (uten innlogging) dukker opp i "mine reiser"
    const offer = await searchOffer();
    const sess = await caller().checkout.createSession(sessionInput(offer, { contactEmail: EMAIL }));
    await caller().checkout.confirmDemo({ publicId: sess.publicId });
    await runJobsUntilIdle();
    const trips = await s2.caller.customerAuth.myTrips();
    expect(trips.length).toBe(1);

    const exported = await s2.caller.customerAuth.exportMyData();
    expect(exported.account).not.toHaveProperty("passwordHash");
    expect(exported.bookings.length).toBe(1);
    expect(exported.consents.length).toBe(1);
    expect(await countRows("audit_logs", "action='customer.data_exported'")).toBe(1);

    // Sletting krever riktig passord og anonymiserer
    await expectAppCode(s2.caller.customerAuth.deleteAccount({ password: "feil-passord-1" }), "UNAUTHORIZED");
    expect((await s2.caller.customerAuth.deleteAccount({ password: PASSWORD })).ok).toBe(true);
    const [acc] = await rows<{ email: string; first_name: string; password_hash: string; deleted_at: Date | null; email_verified: number }>(
      "SELECT email, first_name, password_hash, deleted_at, email_verified FROM customer_accounts",
    );
    expect(acc.email).toMatch(/^deleted-\d+@anonymized\.invalid$/);
    expect(acc.first_name).toBe("Slettet");
    expect(acc.password_hash).toBe("!deleted");
    expect(acc.deleted_at).not.toBeNull();
    expect(Number(acc.email_verified)).toBe(0);
    expect(await countRows("customer_sessions", "revoked_at IS NULL")).toBe(0);
    // Bookingen beholdes (bokføring), men er koblet fra kontoen
    expect(await countRows("bookings")).toBe(1);
    expect(await countRows("bookings", "customer_account_id IS NOT NULL")).toBe(0);
    // Slettet konto kan ikke logge inn, og gammel sesjon er død
    await expectAppCode(caller().customerAuth.login({ identifier: EMAIL, password: PASSWORD }), "UNAUTHORIZED");
    expect((await withCookie(ctx2.resHeaders)).ctx.customer).toBeNull();
  });
});
