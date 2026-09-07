import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/stripe", () => import("./stripeMock"));

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

// ─── Autentisering: staff (e-post + passord) og kunde (registrering → sletting) ──

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

describe("staff-autentisering", () => {
  beforeEach(truncateAll);
  afterAll(closeDb);

  const PASSWORD = "Sikkert-Passord-123";

  it("login med e-post og passord gir en ferdig sesjon; tillatelsesprosedyrer virker; logout tilbakekaller", async () => {
    await getDb().insert(staffUsers).values({ email: "eier@hellosky.test", name: "Eier", role: "OWNER", status: "active", passwordHash: await hashPassword(PASSWORD) });

    // Feil passord
    await expect(caller().staffAuth.login({ email: "eier@hellosky.test", password: "feil" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(await countRows("audit_logs", "action='auth.login_failed'")).toBe(1);

    const ctx1 = makeCtx();
    const login = await factory(ctx1).staffAuth.login({ email: "eier@hellosky.test", password: PASSWORD });
    expect(login).toMatchObject({ ok: true, role: "OWNER" });
    expect(ctx1.resHeaders.get("set-cookie")).toContain("hellosky_staff=");
    expect(ctx1.resHeaders.get("set-cookie")).toContain("HttpOnly");
    expect(ctx1.resHeaders.get("set-cookie")).toContain("SameSite=Strict");

    const s1 = await withCookie(ctx1.resHeaders);
    expect(await s1.caller.staffAuth.me()).toMatchObject({ authenticated: true, role: "OWNER" });

    // Sesjonen er ferdig med én gang — ingen ekstra steg
    const staff = await s1.caller.staffAuth.listStaff();
    expect(staff.length).toBe(1);
    expect(await s1.caller.admin.dashboard()).toBeTruthy();
    expect((await s1.caller.staffAuth.myPermissions()).permissions).toContain("staff:manage");

    // Logout tilbakekaller sesjonen
    await s1.caller.staffAuth.logout();
    expect((await withCookie(ctx1.resHeaders)).ctx.staff).toBeNull();
    expect(await countRows("audit_logs", "action='auth.login'")).toBe(1);
  });

  it("utlogget bruker slipper ikke inn i admin", async () => {
    await expect(caller().staffAuth.listStaff()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller().admin.dashboard()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("deaktivert konto kan ikke logge inn; førstegangsoppsett er selvdeaktiverende", async () => {
    expect((await caller().staffAuth.setupStatus()).needsSetup).toBe(true);
    await getDb().insert(staffUsers).values({ email: "x@hellosky.test", name: "X", role: "ADMIN", status: "disabled", passwordHash: await hashPassword(PASSWORD) });
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
