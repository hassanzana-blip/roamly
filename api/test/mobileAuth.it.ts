import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/stripe", () => import("./stripeMock"));
// Sosial innlogging: Clerk-verifiseringen byttes ut; koblingsreglene (decideLink) er ekte.
vi.mock("../lib/socialLogin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/socialLogin")>()),
  verifySocialToken: vi.fn(),
}));

import { closeDb, countRows, expectAppCode, makeCtx, rows, truncateAll, withCookie, type CtxOptions } from "./setup";
import { createCallerFactory } from "../middleware";
import { appRouter } from "../router";
import { mobileAppRouter } from "../mobileRouter";
import { createMobileContext } from "../context";
import { resolveSession } from "../lib/sessions";
import { resolveCustomerSession } from "../lib/customerSessions";
import { hashPassword } from "../lib/passwords";
import { sha256Hex } from "../lib/tokens";
import { verifySocialToken } from "../lib/socialLogin";
import { getDb } from "../queries/connection";
import { customerAccounts, customerOtpCodes, customerPasswordResets, staffUsers } from "../../db/schema";
import app from "../boot";

// ─── Appens kundesesjon (Bearer) og skillet mellom ansatte og kunder ────────

const web = createCallerFactory(appRouter);
const mobile = createCallerFactory(mobileAppRouter);

const PASSWORD = "kundepassord-2026";
const STAFF_PASSWORD = "Sikkert-Passord-123";

/** Kontekst uten cookie og uten Origin – slik appen kaller. Sesjonen løses opp som i context.ts. */
async function appCtx(token?: string, extra: CtxOptions = {}) {
  const headers: Record<string, string> = { ...(extra.headers ?? {}) };
  if (token) headers.authorization = `Bearer ${token}`;
  const ctx = makeCtx({ ...extra, headers, url: "http://localhost:3000/api/mobile/trpc/test" });
  ctx.req.headers.delete("origin");
  ctx.customer = await resolveCustomerSession(ctx.req);
  return ctx;
}

async function mobileCaller(token?: string) {
  return mobile(await appCtx(token));
}

/** Eier og admin i staff_users. Navnene er bare pynt – regelen følger e-posten. */
async function seedStaff() {
  const passwordHash = await hashPassword(STAFF_PASSWORD);
  await getDb().insert(staffUsers).values([
    { email: "eier@hellosky.test", name: "Zyar", role: "OWNER", status: "active", passwordHash },
    { email: "admin@hellosky.test", name: "Zana", role: "ADMIN", status: "active", passwordHash },
  ]);
}

describe("app: kundesesjon med Bearer-token", () => {
  beforeEach(truncateAll);
  afterAll(closeDb);

  it("register og login gir et opakt token i svaret, ingen cookie; bare hashen lagres", async () => {
    const ctx = await appCtx();
    const reg = await mobile(ctx).mobileAuth.register({ identifier: "kari@hellosky.test", password: PASSWORD, firstName: "Kari", lastName: "Nordmann" });
    expect(reg.session).toMatchObject({ tokenType: "Bearer" });
    expect(reg.session.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Date.parse(reg.session.expiresAt) - Date.now()).toBeGreaterThan(29 * 24 * 60 * 60_000);
    expect(reg.profile).toMatchObject({ email: "kari@hellosky.test", firstName: "Kari" });
    expect(ctx.resHeaders.get("set-cookie")).toBeNull();
    expect(ctx.resHeaders.get("cache-control")).toBe("no-store");

    const loginCtx = await appCtx();
    const login = await mobile(loginCtx).mobileAuth.login({ identifier: "kari@hellosky.test", password: PASSWORD });
    expect(login.session.token).not.toBe(reg.session.token);
    expect(loginCtx.resHeaders.get("set-cookie")).toBeNull();

    const stored = await rows<{ token_hash: string }>("SELECT token_hash FROM customer_sessions ORDER BY id");
    expect(stored.map((r) => r.token_hash)).toEqual([sha256Hex(reg.session.token), sha256Hex(login.session.token)]);
    expect(JSON.stringify(stored)).not.toContain(login.session.token);

    await expectAppCode(mobile(await appCtx()).mobileAuth.login({ identifier: "kari@hellosky.test", password: "feil-passord-1" }), "UNAUTHORIZED");
  });

  it("Bearer-tokenet gir tilgang til kundeprosedyrer – på appens endepunkt og på /api/trpc", async () => {
    const { session } = await (await mobileCaller()).mobileAuth.register({ identifier: "per@hellosky.test", password: PASSWORD, firstName: "Per", lastName: "Hansen" });

    expect(await (await mobileCaller(session.token)).mobileAuth.me()).toMatchObject({ email: "per@hellosky.test" });

    // Samme token virker også mot kundeprosedyrer i nettets router (samme kundesesjoner, samme regler).
    const webBearer = web(await appCtx(session.token));
    expect(await webBearer.customerAuth.me()).toMatchObject({ email: "per@hellosky.test" });
    await webBearer.account.save({ kind: "destination", refId: "barcelona" });
    expect((await webBearer.account.saved()).map((s) => s.refId)).toEqual(["barcelona"]);

    // Uten token, med feil token eller med feil form: ingen kunde.
    expect(await (await mobileCaller()).mobileAuth.me()).toBeNull();
    await expectAppCode((await mobileCaller()).mobileAuth.logoutAll(), "UNAUTHORIZED");
    await expectAppCode((await mobileCaller("x".repeat(43))).mobileAuth.logoutAll(), "UNAUTHORIZED");
    await expectAppCode(web(await appCtx("x".repeat(43))).account.saved(), "UNAUTHORIZED");
    const malformed = await appCtx(undefined, { headers: { authorization: "Bearer ikke gyldig!" } });
    expect(malformed.customer).toBeNull();
  });

  it("logout tilbakekaller akkurat denne sesjonen; logoutAll tar resten", async () => {
    await (await mobileCaller()).mobileAuth.register({ identifier: "ali@hellosky.test", password: PASSWORD, firstName: "Ali", lastName: "Test" });
    const a = (await (await mobileCaller()).mobileAuth.login({ identifier: "ali@hellosky.test", password: PASSWORD })).session.token;
    const b = (await (await mobileCaller()).mobileAuth.login({ identifier: "ali@hellosky.test", password: PASSWORD })).session.token;

    expect(await (await mobileCaller(a)).mobileAuth.logout()).toEqual({ ok: true });
    expect((await appCtx(a)).customer).toBeNull();
    await expectAppCode(web(await appCtx(a)).account.saved(), "UNAUTHORIZED");
    expect((await appCtx(b)).customer).not.toBeNull();
    // Idempotent: et allerede tilbakekalt token gir fortsatt ok.
    expect(await (await mobileCaller(a)).mobileAuth.logout()).toEqual({ ok: true });

    // En nettsesjon for samme kunde, så logoutAll fra appen: alt er tilbakekalt.
    const webCtx = makeCtx();
    await web(webCtx).customerAuth.login({ identifier: "ali@hellosky.test", password: PASSWORD });
    expect((await withCookie(webCtx.resHeaders)).ctx.customer).not.toBeNull();
    await (await mobileCaller(b)).mobileAuth.logoutAll();
    expect((await appCtx(b)).customer).toBeNull();
    expect((await withCookie(webCtx.resHeaders)).ctx.customer).toBeNull();
    expect(await countRows("customer_sessions", "revoked_at IS NULL")).toBe(0);
  });

  it("engangskode på SMS gir token i appen", async () => {
    // En eksisterende konto med telefon (ny registrering med telefon er stengt).
    await getDb().insert(customerAccounts).values({ phone: "+4791234567", passwordHash: "!", firstName: "Siri", lastName: "Test" });
    const [acc] = await getDb().select().from(customerAccounts).limit(1);
    await getDb().insert(customerOtpCodes).values({ customerId: acc.id, codeHash: sha256Hex(`${acc.id}:123456`), expiresAt: new Date(Date.now() + 600_000) });
    const res = await (await mobileCaller()).mobileAuth.verifyLoginCode({ phone: "+47 912 34 567", code: "123456" });
    expect((await appCtx(res.session.token)).customer?.customerId).toBe(acc.id);
  });
});

describe("nett: cookie-innlogging er uendret", () => {
  beforeEach(truncateAll);
  afterAll(closeDb);

  it("login setter HttpOnly-cookien og returnerer ikke noe token", async () => {
    await web(makeCtx()).customerAuth.register({ identifier: "ola@hellosky.test", password: PASSWORD, firstName: "Ola", lastName: "Nordmann" });
    const ctx = makeCtx();
    const profile = await web(ctx).customerAuth.login({ identifier: "ola@hellosky.test", password: PASSWORD });
    expect(profile).not.toHaveProperty("session");
    expect(profile).not.toHaveProperty("token");
    const cookie = ctx.resHeaders.get("set-cookie") ?? "";
    expect(cookie).toContain("hellosky_customer=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=2592000");

    const s = await withCookie(ctx.resHeaders);
    expect(await s.caller.customerAuth.me()).toMatchObject({ email: "ola@hellosky.test" });

    // En Basic-header (passordbeskyttet testmiljø) rører ikke cookie-veien.
    const withBasic = makeCtx({ headers: { cookie: s.cookie, authorization: "Basic dXNlcjpwYXNz" } });
    expect((await resolveCustomerSession(withBasic.req))?.email).toBe("ola@hellosky.test");

    await s.caller.customerAuth.logout();
    expect((await withCookie(ctx.resHeaders)).ctx.customer).toBeNull();
  });
});

describe("ansatte kan ikke være kunder", () => {
  beforeEach(async () => {
    await truncateAll();
    vi.mocked(verifySocialToken).mockReset();
  });
  afterAll(closeDb);

  it("en ansatts e-post kan ikke registreres – på nett, i appen, med store bokstaver eller +merkelapp i begge retninger", async () => {
    await seedStaff();
    // Lagret med merkelapp og blandede store bokstaver – sperrer likevel grunnadressen.
    await getDb().insert(staffUsers).values({ email: "Owner+Staff@HelloSky.TEST", name: "Eier to", role: "OWNER", status: "invited" });
    const blocked = ["eier@hellosky.test", "ADMIN@HelloSky.test", "eier+reise@hellosky.test", "owner@hellosky.test", "OWNER+kunde@hellosky.test", "owner+staff@hellosky.test"];
    for (const identifier of blocked) {
      await expectAppCode(web(makeCtx()).customerAuth.register({ identifier, password: PASSWORD, firstName: "Test", lastName: "Test" }), "CONFLICT");
      await expectAppCode((await mobileCaller()).mobileAuth.register({ identifier, password: PASSWORD, firstName: "Test", lastName: "Test" }), "CONFLICT");
    }
    expect(await countRows("audit_logs", "action='customer.register_blocked_staff'")).toBe(blocked.length * 2);
    expect(await countRows("customer_accounts")).toBe(0);
    expect(await countRows("customer_sessions")).toBe(0);

    // Regelen følger staff-tabellen, ikke navn: en kunde som heter Zana, med egen e-post, går fint.
    const ok = await (await mobileCaller()).mobileAuth.register({ identifier: "zana.kunde@example.test", password: PASSWORD, firstName: "Zana", lastName: "Kunde" });
    expect(ok.session.token).toBeTruthy();
  });

  it("en kundekonto med en ansatts e-post (fra før) kan ikke logge inn og mister sesjonene sine", async () => {
    // Kunden fantes før adressen ble lagt inn som ansatt.
    const reg = await (await mobileCaller()).mobileAuth.register({ identifier: "admin@hellosky.test", password: PASSWORD, firstName: "Før", lastName: "Ansatt" });
    const webCtx = makeCtx();
    await web(webCtx).customerAuth.login({ identifier: "admin@hellosky.test", password: PASSWORD });
    await seedStaff();

    // Eksisterende sesjoner – Bearer og cookie – bærer ikke lenger en kunde.
    expect((await appCtx(reg.session.token)).customer).toBeNull();
    expect((await withCookie(webCtx.resHeaders)).ctx.customer).toBeNull();

    // Ny innlogging: samme svar som feil passord, ingen ny sesjon.
    const before = await countRows("customer_sessions");
    await expectAppCode(web(makeCtx()).customerAuth.login({ identifier: "admin@hellosky.test", password: PASSWORD }), "UNAUTHORIZED");
    await expectAppCode((await mobileCaller()).mobileAuth.login({ identifier: "admin@hellosky.test", password: PASSWORD }), "UNAUTHORIZED");
    expect(await countRows("customer_sessions")).toBe(before);
    expect(await countRows("audit_logs", "action='customer.login_blocked_staff'")).toBe(2);

    // Glemt passord: ingen lenke sendes, og en lenke fra før kan ikke brukes.
    const [acc] = await getDb().select().from(customerAccounts).limit(1);
    expect(await web(makeCtx()).customerAuth.requestPasswordReset({ email: "admin@hellosky.test" })).toEqual({ ok: true });
    expect(await countRows("customer_password_resets")).toBe(0);
    await getDb().insert(customerPasswordResets).values({ tokenHash: sha256Hex("gammel-lenke-123456"), customerId: acc.id, expiresAt: new Date(Date.now() + 3_600_000) });
    await expectAppCode(web(makeCtx()).customerAuth.resetPassword({ token: "gammel-lenke-123456", password: "nytt-passord-2026" }), "VALIDATION");
    expect(await countRows("customer_password_resets", "used_at IS NULL")).toBe(1);
    expect(await countRows("customer_sessions")).toBe(before);
  });

  it("engangskode og sosial innlogging slipper ikke en ansatt inn som kunde", async () => {
    await getDb().insert(customerAccounts).values({ phone: "+4798765432", passwordHash: "!", firstName: "Tlf", lastName: "Konto" });
    const [acc] = await getDb().select().from(customerAccounts).limit(1);
    await getDb().update(customerAccounts).set({ email: "eier@hellosky.test" }).where((await import("drizzle-orm")).eq(customerAccounts.id, acc.id));
    await seedStaff();
    await getDb().insert(customerOtpCodes).values({ customerId: acc.id, codeHash: sha256Hex(`${acc.id}:654321`), expiresAt: new Date(Date.now() + 600_000) });
    await expectAppCode((await mobileCaller()).mobileAuth.verifyLoginCode({ phone: "+4798765432", code: "654321" }), "UNAUTHORIZED");
    expect(await countRows("customer_otp_codes", "used_at IS NULL")).toBe(1);

    vi.mocked(verifySocialToken).mockResolvedValue({ subject: "user_zyar", email: "eier@hellosky.test", emailVerified: true, firstName: "Zyar", lastName: null, social: "google" });
    await expectAppCode((await mobileCaller()).mobileAuth.exchangeSocialToken({ token: "clerk-session-token-xxxxxxxx" }), "FORBIDDEN");
    await expectAppCode(web(makeCtx()).customerAuth.exchangeSocialToken({ token: "clerk-session-token-xxxxxxxx" }), "FORBIDDEN");
    expect(await countRows("customer_identities")).toBe(0);
    expect(await countRows("customer_sessions")).toBe(0); // verken kode eller sosial innlogging utstedte en sesjon

    // En vanlig kunde via sosial innlogging i appen får token.
    vi.mocked(verifySocialToken).mockResolvedValue({ subject: "user_kunde", email: "reisende@example.test", emailVerified: true, firstName: "Reisende", lastName: "Kunde", social: "apple" });
    const res = await (await mobileCaller()).mobileAuth.exchangeSocialToken({ token: "clerk-session-token-yyyyyyyy" });
    expect(res).toMatchObject({ created: true, session: { tokenType: "Bearer" } });
    expect((await appCtx(res.session.token)).customer?.email).toBe("reisende@example.test");
  });

  it("registrering: en ansatts e-post gir nøyaktig samme offentlige svar som en e-post som allerede er i bruk", async () => {
    await seedStaff();
    await (await mobileCaller()).mobileAuth.register({ identifier: "opptatt@hellosky.test", password: PASSWORD, firstName: "Opptatt", lastName: "Kunde" });

    let n = 0;
    async function attempt(endpoint: string, identifier: string, password = PASSWORD) {
      n += 1;
      const res = await app.request(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": `10.77.0.${n}` },
        body: JSON.stringify({ json: { identifier, password, firstName: "Test", lastName: "Test" } }),
      });
      const body = (await res.json()) as { error: { json: { data: Record<string, unknown> } } };
      delete body.error.json.data.requestId; // unik per forespørsel
      return { status: res.status, body };
    }

    for (const endpoint of ["/api/trpc/customerAuth.register", "/api/mobile/trpc/mobileAuth.register"]) {
      const taken = await attempt(endpoint, "opptatt@hellosky.test");
      const staff = await attempt(endpoint, "eier@hellosky.test");
      expect(taken.status).toBe(409);
      expect(taken.body.error.json).toMatchObject({ data: { appCode: "CONFLICT", details: { field: "identifier" } } });
      expect(staff).toEqual(taken);

      // Samme rekkefølge på sjekkene: et svakt passord gir VALIDATION for begge.
      const weakTaken = await attempt(endpoint, "opptatt@hellosky.test", "kort");
      const weakStaff = await attempt(endpoint, "eier@hellosky.test", "kort");
      expect(weakTaken.body.error.json.data.appCode).toBe("VALIDATION");
      expect(weakStaff).toEqual(weakTaken);
    }

    // Den egentlige grunnen står bare i revisjonsloggen – uten selve adressen.
    const audit = await rows<{ metadata_json: string }>("SELECT metadata_json FROM audit_logs WHERE action='customer.register_blocked_staff'");
    expect(audit).toHaveLength(2);
    expect(JSON.parse(audit[0].metadata_json)).toMatchObject({ reason: "staff_email" });
    expect(audit[0].metadata_json).not.toContain("eier@hellosky.test");
    expect(await countRows("customer_accounts")).toBe(1);
  });

  it("appens API har ingen staff-/admin-ruter og leser aldri staff-cookien", async () => {
    const keys = Object.keys(mobileAppRouter._def.record);
    expect(keys.sort()).toEqual(["flights", "mobileAuth", "ping"]);
    for (const excluded of ["staffAuth", "admin", "team", "partners", "expenses", "checkout", "orders", "account", "watch", "tripPlans", "customerAuth"]) expect(keys).not.toContain(excluded);

    await seedStaff();
    const staffLogin = makeCtx();
    await web(staffLogin).staffAuth.login({ email: "eier@hellosky.test", password: STAFF_PASSWORD });
    const { cookie } = await withCookie(staffLogin.resHeaders);
    expect(cookie).toContain("hellosky_staff=");

    // Staff-cookien mot appens kontekst: ingen staff, ingen kunde.
    const req = new Request("http://localhost:3000/api/mobile/trpc/ping", { headers: { cookie } });
    const mctx = await createMobileContext({ req, resHeaders: new Headers(), info: {} as never });
    expect(mctx.staff).toBeNull();
    expect(mctx.customer).toBeNull();

    // Staff-tokenet sendt som Bearer: verken kunde eller staff.
    const staffToken = cookie.split("hellosky_staff=")[1].split(";")[0];
    const asBearer = await appCtx(staffToken);
    expect(asBearer.customer).toBeNull();
    expect(await resolveSession(asBearer.req)).toBeNull();

    // Over HTTP: admin/staffAuth finnes ikke på appens endepunkt; ping gjør det.
    const ping = await app.request("/api/mobile/trpc/ping");
    expect(ping.status).toBe(200);
    const excluded: Array<[string, "GET" | "POST"]> = [
      ["staffAuth.me", "GET"],
      ["staffAuth.login", "POST"],
      ["admin.dashboard", "GET"],
      ["checkout.createSession", "POST"],
      ["checkout.status", "GET"],
      ["orders.get", "GET"],
      ["account.saved", "GET"],
      ["watch.list", "GET"],
      ["tripPlans.list", "GET"],
      ["customerAuth.login", "POST"],
    ];
    for (const [path, method] of excluded) {
      const res = await app.request(`/api/mobile/trpc/${path}`, { method, headers: { cookie, "content-type": "application/json" }, body: method === "POST" ? "{}" : undefined });
      expect(res.status, path).toBe(404);
    }
    // Nettets /api/trpc er uendret: rutene finnes der (uinnlogget → 401, ikke 404).
    expect((await app.request("/api/trpc/account.saved")).status).toBe(401);
    expect((await app.request("/api/trpc/checkout.status?input=%7B%7D")).status).not.toBe(404);
  });

  it("over HTTP: appen logger inn uten Origin, bruker Bearer og logger ut", async () => {
    await (await mobileCaller()).mobileAuth.register({ identifier: "http@hellosky.test", password: PASSWORD, firstName: "Http", lastName: "Test" });
    const login = await app.request("/api/mobile/trpc/mobileAuth.login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "10.99.0.1" },
      body: JSON.stringify({ json: { identifier: "http@hellosky.test", password: PASSWORD } }),
    });
    expect(login.status).toBe(200);
    expect(login.headers.get("set-cookie")).toBeNull();
    const token = ((await login.json()) as { result: { data: { json: { session: { token: string } } } } }).result.data.json.session.token;

    const me = await app.request("/api/mobile/trpc/mobileAuth.me", { headers: { authorization: `Bearer ${token}` } });
    expect(((await me.json()) as { result: { data: { json: { email: string } } } }).result.data.json.email).toBe("http@hellosky.test");

    const out = await app.request("/api/mobile/trpc/mobileAuth.logout", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: "{}" });
    expect(out.status).toBe(200);
    const after = await app.request("/api/mobile/trpc/mobileAuth.me", { headers: { authorization: `Bearer ${token}` } });
    expect(((await after.json()) as { result: { data: { json: unknown } } }).result.data.json).toBeNull();
  });
});
