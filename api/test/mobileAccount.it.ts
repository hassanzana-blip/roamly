import { afterAll, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { z } from "zod";

vi.mock("../lib/stripe", () => import("./stripeMock"));
vi.mock("../lib/socialLogin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/socialLogin")>()),
  verifySocialToken: vi.fn(),
}));
// SMS-ene fanges her (ingen leverandør i test), så testene kan lese kodene.
const smsSent: Array<{ to: string; text: string }> = [];
vi.mock("../lib/sms", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/sms")>()),
  sendSms: vi.fn(async (to: string, text: string) => {
    smsSent.push({ to, text });
    return { sent: true, provider: "none" as const };
  }),
}));
// Den ekte e-postmodulen kjører (email_events skrives, ingen SMTP i test); vi lytter bare på kallet.
vi.mock("../lib/mailer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/mailer")>();
  return { ...actual, sendPasswordResetEmail: vi.fn(actual.sendPasswordResetEmail) };
});

import { sql } from "drizzle-orm";
import { appCode, closeDb, countRows, expectAppCode, makeCtx, rows, truncateAll, withCookie } from "./setup";
import { createCallerFactory } from "../middleware";
import { appRouter } from "../router";
import { mobileAppRouter } from "../mobileRouter";
import { mobileConfirmPhoneChangeInput, mobileDeleteAccountInput, mobilePasswordResetInput, mobileRequestPhoneChangeInput, mobileUpdateProfileInput } from "../mobileAuth";
import { registerInput, requestPasswordReset, RESET_RESPONSE_MS } from "../customerAuth";
import { createMobileContext } from "../context";
import { CUSTOMER_COOKIE, resolveCustomerSession } from "../lib/customerSessions";
import { CUSTOMER_DATA_MATRIX, type DeletionAction } from "../lib/customerDeletion";
import { sendPasswordResetEmail } from "../lib/mailer";
import { verifySocialToken } from "../lib/socialLogin";
import { hashPassword } from "../lib/passwords";
import { sha256Hex } from "../lib/tokens";
import { getDb } from "../queries/connection";
import * as s from "../../db/schema";
import type {
  CustomerProfile,
  MobileConfirmPhoneChangeInput,
  MobileDeleteAccountInput,
  MobileOkResult,
  MobilePasswordResetRequestInput,
  MobileRegisterInput,
  MobileRequestPhoneChangeInput,
  MobileUpdateProfileInput,
} from "../../contracts/mobileAuth";
import app from "../boot";

// ─── Appens konto: samme kunder og samme tjenester som nettet ───────────────

const web = createCallerFactory(appRouter);
const mobile = createCallerFactory(mobileAppRouter);

const PASSWORD = "kundepassord-2026";
const NEW_PASSWORD = "nytt-passord-2026";
const STAFF_PASSWORD = "Sikkert-Passord-123";

/** Slik appen kaller: uten Origin, med Bearer når den har et token. */
async function appCtx(token?: string, headers: Record<string, string> = {}) {
  const h = { ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  const ctx = makeCtx({ headers: h, url: "http://localhost:3000/api/mobile/trpc/test" });
  ctx.req.headers.delete("origin");
  ctx.customer = await resolveCustomerSession(ctx.req);
  return ctx;
}
const appCaller = async (token?: string) => mobile(await appCtx(token));

/** En eksisterende konto med telefonnummer (fra før registrering med telefon ble stengt), innlogget i appen. */
async function existingPhoneAccount(phone: string) {
  await getDb().insert(s.customerAccounts).values({ phone, passwordHash: await hashPassword(PASSWORD), firstName: "Kari", lastName: "Nordmann" });
  return (await appCaller()).mobileAuth.login({ identifier: phone, password: PASSWORD });
}

async function registerApp(identifier: string, extra: Partial<MobileRegisterInput> = {}) {
  return (await appCaller()).mobileAuth.register({ identifier, password: PASSWORD, firstName: "Kari", lastName: "Nordmann", ...extra });
}

/** Nettinnlogging med cookie. `loginHeaders` er svaret med Set-Cookie, til å bygge nye kontekster av senere. */
async function webLogin(identifier: string, password = PASSWORD) {
  const ctx = makeCtx();
  await web(ctx).customerAuth.login({ identifier, password });
  return { ...(await withCookie(ctx.resHeaders)), loginHeaders: ctx.resHeaders };
}

async function seedStaffUsers() {
  const passwordHash = await hashPassword(STAFF_PASSWORD);
  await getDb().insert(s.staffUsers).values([
    { email: "eier@hellosky.test", name: "Eier", role: "OWNER", status: "active", passwordHash },
    { email: "admin@hellosky.test", name: "Admin", role: "ADMIN", status: "active", passwordHash },
  ]);
}

/**
 * Tøm databasen og gi kundene nye id-er. Rategrensene (i minnet, per prosess)
 * er delvis nøklet på kunde-id; uten dette ville «kunde 1» i én test arve
 * forsøkene til «kunde 1» i den forrige.
 */
let idFloor = 0;
async function fresh() {
  await truncateAll();
  idFloor += 10_000;
  await getDb().execute(sql.raw(`ALTER TABLE customer_accounts AUTO_INCREMENT = ${idFloor}`));
}

/** Feltet i en VALIDATION/CONFLICT-feil (samme som `details.field` over HTTP). */
function fieldOf(err: unknown): unknown {
  const cause = (err as { cause?: { field?: unknown; data?: { field?: unknown } } }).cause;
  return cause?.field ?? cause?.data?.field;
}

async function expectField(p: Promise<unknown>, code: string, field: string) {
  let caught: unknown = null;
  try {
    await p;
  } catch (err) {
    caught = err;
  }
  expect(caught, `forventet ${code} på ${field}`).not.toBeNull();
  expect(appCode(caught)).toBe(code);
  expect(fieldOf(caught)).toBe(field);
}

/** Detaljene i en feil (samme som `data.details` over HTTP). */
function causeOf(err: unknown): Record<string, unknown> {
  return ((err as { cause?: Record<string, unknown> }).cause ?? {}) as Record<string, unknown>;
}

async function caught(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (err) {
    return err;
  }
  throw new Error("forventet en feil");
}

/** Siste SMS til et nummer, og koden i den. */
function lastCodeTo(phone: string): string {
  const msg = [...smsSent].reverse().find((m) => m.to === phone);
  const code = msg && /(\d{6})/.exec(msg.text)?.[1];
  if (!code) throw new Error(`ingen kode sendt til ${phone}`);
  return code;
}

/** Gjør en sesjon eldre enn grensen for fersk innlogging (10 min). */
async function ageSession(token: string, minutes = 20) {
  await getDb().execute(sql`UPDATE customer_sessions SET created_at = created_at - INTERVAL ${minutes} MINUTE WHERE token_hash = ${sha256Hex(token)}`);
}

/** Nettets egne prosedyrer (venner, grupper) med appens Bearer-token. */
async function webAs(token: string) {
  const ctx = makeCtx({ headers: { authorization: `Bearer ${token}` } });
  ctx.customer = await resolveCustomerSession(ctx.req);
  return web(ctx);
}

// Kontrakttypene appen bygger mot må være gyldig input til serverens skjemaer.
expectTypeOf<MobileRegisterInput>().toExtend<z.input<typeof registerInput>>();
expectTypeOf<MobilePasswordResetRequestInput>().toExtend<z.input<typeof mobilePasswordResetInput>>();
expectTypeOf<MobileUpdateProfileInput>().toExtend<z.input<typeof mobileUpdateProfileInput>>();
expectTypeOf<MobileDeleteAccountInput>().toExtend<z.input<typeof mobileDeleteAccountInput>>();
expectTypeOf<MobileRequestPhoneChangeInput>().toExtend<z.input<typeof mobileRequestPhoneChangeInput>>();
expectTypeOf<MobileConfirmPhoneChangeInput>().toExtend<z.input<typeof mobileConfirmPhoneChangeInput>>();

// ─── 1. Glemt passord ───────────────────────────────────────────────────────

describe("mobileAuth.requestPasswordReset: nettets vei, samme nøytrale svar", () => {
  beforeEach(async () => {
    await fresh();
    vi.mocked(sendPasswordResetEmail).mockClear();
  });
  afterAll(closeDb);

  it("kjent kunde: token i samme tabell, e-post via samme avsender, lenken fullføres på nettsiden", async () => {
    const reg = await registerApp("glemt@hellosky.test");
    const res: MobileOkResult = await (await appCaller()).mobileAuth.requestPasswordReset({ identifier: " Glemt@HelloSky.test ", locale: "en" });
    expect(res).toEqual({ ok: true });

    const stored = await rows<{ customer_id: number; token_hash: string; used_at: Date | null }>("SELECT customer_id, token_hash, used_at FROM customer_password_resets");
    expect(stored).toHaveLength(1);
    expect(stored[0].customer_id).toBe(reg.profile.id);

    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const mail = vi.mocked(sendPasswordResetEmail).mock.calls[0][0];
    expect(mail).toMatchObject({ email: "glemt@hellosky.test", firstName: "Kari", locale: "en" });
    // Lenken går til nettets eksisterende side, og tokenet i den er det som er lagret (som hash).
    const url = new URL(mail.url);
    expect(url.pathname).toBe("/tilbakestill-passord");
    const token = url.searchParams.get("token")!;
    expect(sha256Hex(token)).toBe(stored[0].token_hash);
    expect(await countRows("email_events", "kind='password_reset' AND recipient='glemt@hellosky.test' AND locale='en'")).toBe(1);
    expect(await countRows("audit_logs", "action='customer.password_reset_requested'")).toBe(1);

    // Tilbakestillingen skjer på nettet (ingen egen app-flyt); appen logger så inn med det nye passordet.
    await web(makeCtx()).customerAuth.resetPassword({ token, password: NEW_PASSWORD });
    await expectAppCode((await appCaller()).mobileAuth.login({ identifier: "glemt@hellosky.test", password: PASSWORD }), "UNAUTHORIZED");
    const login = await (await appCaller()).mobileAuth.login({ identifier: "glemt@hellosky.test", password: NEW_PASSWORD });
    expect(login.profile.id).toBe(reg.profile.id);
    // Tokenet appen hadde fra registreringen er tilbakekalt av tilbakestillingen (som på nett).
    expect((await appCtx(reg.session.token)).customer).toBeNull();
  });

  it("uten språk: kontoens eget språk (som nettet)", async () => {
    await registerApp("sprak@hellosky.test", { locale: "en" });
    await (await appCaller()).mobileAuth.requestPasswordReset({ identifier: "sprak@hellosky.test" });
    expect(vi.mocked(sendPasswordResetEmail).mock.calls[0][0].locale).toBe("en");
  });

  it("ukjent, slettet, ansatt og telefon: nøyaktig samme svar, ingen token, ingen e-post", async () => {
    await seedStaffUsers();
    // En kundekonto med en ansatts adresse (fra før) – får aldri lenke.
    await getDb().insert(s.customerAccounts).values({ email: "admin@hellosky.test", passwordHash: await hashPassword(PASSWORD), firstName: "Før", lastName: "Ansatt" });
    const gone = await registerApp("borte@hellosky.test");
    await (await appCaller(gone.session.token)).mobileAuth.deleteAccount({ password: PASSWORD });
    await existingPhoneAccount("+4791112233");

    for (const identifier of ["ukjent@hellosky.test", "borte@hellosky.test", "admin@hellosky.test", "eier@hellosky.test", "+47 911 12 233"]) {
      expect(await (await appCaller()).mobileAuth.requestPasswordReset({ identifier }), identifier).toEqual({ ok: true });
    }
    expect(await countRows("customer_password_resets")).toBe(0);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();

    // Over HTTP er svarene byte for byte like for kjent og ukjent adresse.
    await registerApp("kjent@hellosky.test");
    const bodies: string[] = [];
    let n = 0;
    for (const identifier of ["kjent@hellosky.test", "ukjent2@hellosky.test", "eier@hellosky.test"]) {
      n += 1;
      const res = await app.request("/api/mobile/trpc/mobileAuth.requestPasswordReset", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": `10.55.0.${n}` },
        body: JSON.stringify({ json: { identifier } }),
      });
      expect(res.status).toBe(200);
      bodies.push(await res.text());
    }
    expect(new Set(bodies).size).toBe(1);
    expect(await countRows("customer_password_resets")).toBe(1); // bare den kjente
  });

  it("samme rategrense som nettet – delt mellom nett og app", async () => {
    await registerApp("mange@hellosky.test");
    await web(makeCtx()).customerAuth.requestPasswordReset({ email: "mange@hellosky.test" });
    await web(makeCtx()).customerAuth.requestPasswordReset({ email: "mange@hellosky.test" });
    await (await appCaller()).mobileAuth.requestPasswordReset({ identifier: "mange@hellosky.test" });
    await expectAppCode((await appCaller()).mobileAuth.requestPasswordReset({ identifier: "mange@hellosky.test" }), "RATE_LIMITED");
    await expectAppCode(web(makeCtx()).customerAuth.requestPasswordReset({ email: "mange@hellosky.test" }), "RATE_LIMITED");
    expect(await countRows("customer_password_resets")).toBe(3);
    // Ugyldig identifikator er en skjemafeil, ikke et hint om kontoen.
    await expectField((await appCaller()).mobileAuth.requestPasswordReset({ identifier: "ikke-en-adresse" }), "VALIDATION", "identifier");
  });

  it("R1: en adresse som bare ligner (aksent, Kelvin-tegn, kontrolltegn) gir aldri offerets lenke – og lenken går alltid til den lagrede adressen", async () => {
    const victim = await registerApp("anna@example.com", { firstName: "Anna" });
    // Nettet avviste allerede varianten (zod .email() er ASCII); appen gjør nå det samme.
    await expectAppCode(web(makeCtx()).customerAuth.requestPasswordReset({ email: "anna@exámple.com" }), "VALIDATION");
    // Aksent, Kelvin-tegnet (blir «k» med toLowerCase), et kontrolltegn kollasjonen ignorerer, og fullbredde-«a».
    for (const identifier of ["anna@exámple.com", "\u212Aari@example.com", "anna@example.com\u0001", "\uFF41nna@example.com"]) {
      await expectField((await appCaller()).mobileAuth.requestPasswordReset({ identifier }), "VALIDATION", "identifier");
    }
    // Selv om en variant slipper forbi en parser en dag: tjenesten krever nøyaktig samme adresse.
    for (const value of ["anna@exámple.com", "anna@example.com\u0001"]) {
      await requestPasswordReset({ kind: "email", value }, makeCtx());
    }
    expect(await countRows("customer_password_resets")).toBe(0);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(await countRows("email_events", "kind='password_reset'")).toBe(0);

    // Den ekte adressen (også med store bokstaver) gir lenke – til den lagrede adressen.
    await (await appCaller()).mobileAuth.requestPasswordReset({ identifier: "ANNA@Example.com" });
    expect(vi.mocked(sendPasswordResetEmail).mock.calls.map((c) => c[0].email)).toEqual(["anna@example.com"]);
    expect(await rows("SELECT customer_id FROM customer_password_resets")).toEqual([{ customer_id: victim.profile.id }]);
    expect(await rows("SELECT recipient FROM email_events WHERE kind='password_reset'")).toEqual([{ recipient: "anna@example.com" }]);
  });

  it("R5: samme svartid for kjent og ukjent adresse (felles gulv, som innlogging med SMS-kode)", async () => {
    await registerApp("timing@example.com");
    const time = async (identifier: string) => {
      const t0 = performance.now();
      expect(await (await appCaller()).mobileAuth.requestPasswordReset({ identifier })).toEqual({ ok: true });
      return performance.now() - t0;
    };
    const known = [await time("timing@example.com"), await time("timing@example.com")];
    const unknown = [await time("ingen1@example.com"), await time("ingen2@example.com"), await time("+4790000001")];
    for (const ms of [...known, ...unknown]) {
      expect(ms).toBeGreaterThanOrEqual(RESET_RESPONSE_MS - 5);
      expect(ms).toBeLessThan(RESET_RESPONSE_MS + 100 + 150);
    }
    expect(await countRows("customer_password_resets")).toBe(2);
  });
});

// ─── 1b. E-post som bare ligner: databasens kollasjon gir aldri en annens konto ─

describe("e-postadresser som bare ligner (utf8mb4_unicode_ci / 0900_ai_ci)", () => {
  beforeEach(async () => {
    await fresh();
    vi.mocked(verifySocialToken).mockReset();
  });
  afterAll(closeDb);

  it("registrering med ikke-ASCII-adresse avvises; innlogging med en variant prøver aldri offerets passord", async () => {
    const victim = await registerApp("anna@example.com");
    await expectField(registerApp("anna@exámple.com"), "VALIDATION", "identifier");
    await expectField(registerApp("ny@exámple.com"), "VALIDATION", "identifier");
    await expectAppCode(web(makeCtx()).customerAuth.register({ identifier: "ny@exámple.com", password: PASSWORD, firstName: "Ny", lastName: "Kunde" }), "VALIDATION");
    // Riktig passord, men en variant av adressen: samme svar som feil passord.
    await expectAppCode((await appCaller()).mobileAuth.login({ identifier: "anna@exámple.com", password: PASSWORD }), "UNAUTHORIZED");
    await expectField((await appCaller()).mobileAuth.login({ identifier: "anna@example.com\u0001", password: PASSWORD }), "VALIDATION", "identifier");
    expect((await (await appCaller()).mobileAuth.login({ identifier: "Anna@Example.com", password: PASSWORD })).profile.id).toBe(victim.profile.id);
    // En eldre konto med en slik adresse (fra før regelen) kommer fortsatt inn med sin egen adresse.
    await getDb().insert(s.customerAccounts).values({ email: "bjørn@blåbær.no", passwordHash: await hashPassword(PASSWORD), firstName: "Bjørn", lastName: "Eldre" });
    expect((await (await appCaller()).mobileAuth.login({ identifier: "Bjørn@blåbær.no", password: PASSWORD })).profile.email).toBe("bjørn@blåbær.no");
  });

  it("R6: en verifisert adresse hos leverandøren som bare ligner kobler aldri til kontoen, og lager ingen ny", async () => {
    const victim = await registerApp("anna@example.com");
    vi.mocked(verifySocialToken).mockResolvedValue({ subject: "user_attacker", email: "anna@exámple.com", emailVerified: true, firstName: "A", lastName: null, social: "google" });
    for (const exchange of [async () => (await appCaller()).mobileAuth.exchangeSocialToken({ token: "clerk-session-token-lookalike" }), () => web(makeCtx()).customerAuth.exchangeSocialToken({ token: "clerk-session-token-lookalike" })]) {
      const err = await caught(exchange());
      expect(appCode(err)).toBe("CONFLICT");
      expect(causeOf(err)).toMatchObject({ field: "social", reason: "email_lookalike" });
    }
    expect(await countRows("customer_identities")).toBe(0);
    expect(await countRows("customer_sessions", `customer_id = ${victim.profile.id}`)).toBe(1); // bare registreringens
    expect(await countRows("customer_accounts")).toBe(1);

    // Nøyaktig samme verifiserte adresse kobler fortsatt (som før).
    vi.mocked(verifySocialToken).mockResolvedValue({ subject: "user_anna", email: "anna@example.com", emailVerified: true, firstName: "Anna", lastName: null, social: "apple" });
    const linked = await (await appCaller()).mobileAuth.exchangeSocialToken({ token: "clerk-session-token-annaanna" });
    expect(linked).toMatchObject({ linked: true, created: false, profile: { id: victim.profile.id } });
  });
});

// ─── 2. Profil og 3. språk ved registrering ─────────────────────────────────

describe("registrering med telefonnummer er stengt (ingen ubekreftet innloggingsvei)", () => {
  beforeEach(async () => {
    await fresh();
    smsSent.length = 0;
  });

  it("nett og app: et telefonnummer som identifikator gir VALIDATION, og ingen konto opprettes", async () => {
    for (const register of [
      () => web(makeCtx()).customerAuth.register({ identifier: "+47 900 00 001", password: PASSWORD, firstName: "Kari", lastName: "Nordmann" }),
      async () => (await appCaller()).mobileAuth.register({ identifier: "+4790000001", password: PASSWORD, firstName: "Kari", lastName: "Nordmann" }),
    ]) {
      const err = await caught(register());
      expect(appCode(err)).toBe("VALIDATION");
      expect(causeOf(err)).toMatchObject({ field: "identifier", reason: "phone_registration_unavailable" });
    }
    expect(await countRows("customer_accounts")).toBe(0);
    expect(smsSent).toHaveLength(0);
  });

  it("forhåndsregistrering av andres nummer er umulig, og svaret røper ikke om nummeret finnes", async () => {
    await existingPhoneAccount("+4790000002");
    const taken = await caught((await appCaller()).mobileAuth.register({ identifier: "+4790000002", password: "angriper-passord-1", firstName: "A", lastName: "B" }));
    const free = await caught((await appCaller()).mobileAuth.register({ identifier: "+4790000003", password: "angriper-passord-1", firstName: "A", lastName: "B" }));
    expect([appCode(taken), appCode(free)]).toEqual(["VALIDATION", "VALIDATION"]);
    expect(causeOf(taken)).toEqual(causeOf(free));
    expect(await countRows("customer_accounts")).toBe(1);
  });

  it("eksisterende kontoer med telefon virker som før: passord og SMS-kode", async () => {
    const acc = await existingPhoneAccount("+4790000004");
    expect(acc.profile.phone).toBe("+4790000004");
    await (await appCaller()).mobileAuth.requestLoginCode({ phone: "+4790000004" });
    expect((await (await appCaller()).mobileAuth.verifyLoginCode({ phone: "+4790000004", code: lastCodeTo("+4790000004") })).profile.id).toBe(acc.profile.id);
  });

  it("veien for nye kunder: e-post først, så et bekreftet nummer", async () => {
    const reg = await registerApp("ny@hellosky.test");
    const c = await appCaller(reg.session.token);
    await c.mobileAuth.requestPhoneChange({ phone: "+4790000005", password: PASSWORD });
    const profile = await c.mobileAuth.confirmPhoneChange({ phone: "+4790000005", code: lastCodeTo("+4790000005") });
    expect(profile.phone).toBe("+4790000005");
  });
});

describe("mobileAuth.updateProfile og språk", () => {
  beforeEach(fresh);
  afterAll(closeDb);

  it("oppdaterer samme rad som nettet ser, og svarer i samme form som me", async () => {
    const reg = await registerApp("profil@hellosky.test");
    const updated: CustomerProfile = await (await appCaller(reg.session.token)).mobileAuth.updateProfile({ firstName: " Åse-Marie ", lastName: "O'Neil", locale: "en" });
    expect(updated).toMatchObject({ id: reg.profile.id, firstName: "Åse-Marie", lastName: "O'Neil", phone: null, locale: "en", email: "profil@hellosky.test" });
    expect(updated).toEqual(await (await appCaller(reg.session.token)).mobileAuth.me());

    // Nytt nummer: passord + SMS-kode (se «nytt telefonnummer» under).
    await (await appCaller(reg.session.token)).mobileAuth.requestPhoneChange({ phone: "+47 912 34 000", password: PASSWORD });
    const withPhone = await (await appCaller(reg.session.token)).mobileAuth.confirmPhoneChange({ phone: "+47 912 34 000", code: lastCodeTo("+4791234000") });
    expect(withPhone).toMatchObject({ phone: "+4791234000", firstName: "Åse-Marie" });

    // Nettet (cookie) ser nøyaktig samme profil.
    const w = await webLogin("profil@hellosky.test");
    expect(await w.caller.customerAuth.me()).toEqual(withPhone);

    // Og nettets endringer kommer tilbake i appen.
    await w.caller.customerAuth.updateProfile({ firstName: "Åse", lastName: "Nett" });
    await w.caller.customerAuth.updatePreferences({ locale: "nb" });
    expect(await (await appCaller(reg.session.token)).mobileAuth.me()).toMatchObject({ firstName: "Åse", lastName: "Nett", phone: "+4791234000", locale: "nb" });

    // Utelatt telefon eller samme nummer rører det ikke; tom telefon fjerner nummeret når kontoen har e-post.
    expect((await (await appCaller(reg.session.token)).mobileAuth.updateProfile({ firstName: "Åse", lastName: "Nett" })).phone).toBe("+4791234000");
    expect((await (await appCaller(reg.session.token)).mobileAuth.updateProfile({ firstName: "Åse", lastName: "Nett", phone: "+47 912 34 000" })).phone).toBe("+4791234000");
    expect((await (await appCaller(reg.session.token)).mobileAuth.updateProfile({ firstName: "Åse", lastName: "Nett", phone: "" })).phone).toBeNull();
  });

  it("valideringsfeil har appCode VALIDATION og feltet; ingenting lagres", async () => {
    const reg = await registerApp("feil@hellosky.test");
    const phoneOnly = await existingPhoneAccount("+4791234111");
    const other = await existingPhoneAccount("+4791234222");
    const c = await appCaller(reg.session.token);
    const before = await rows("SELECT * FROM customer_accounts ORDER BY id");

    await expectField(c.mobileAuth.updateProfile({ firstName: "R2D2", lastName: "Nordmann" }), "VALIDATION", "firstName");
    await expectField(c.mobileAuth.updateProfile({ firstName: "Kari", lastName: "" }), "VALIDATION", "lastName");
    await expectField(c.mobileAuth.updateProfile({ firstName: "Kari", lastName: "Nordmann", phone: "abc" }), "VALIDATION", "phone");
    await expectField(c.mobileAuth.updateProfile({ firstName: "Kari", lastName: "Nordmann", locale: "fr" as "en" }), "VALIDATION", "locale");
    // Et annet nummer – ledig eller ikke – lagres aldri her, og svaret sier ikke om nummeret er i bruk.
    for (const phone of ["+47 912 34 222", "+47 912 34 999"]) {
      const err = await caught(c.mobileAuth.updateProfile({ firstName: "Kari", lastName: "Nordmann", phone }));
      expect(appCode(err)).toBe("VALIDATION");
      expect(causeOf(err)).toMatchObject({ field: "phone", reason: "phone_verification_required" });
    }
    await expectField((await appCaller(phoneOnly.session.token)).mobileAuth.updateProfile({ firstName: "Tlf", lastName: "Konto", phone: "" }), "VALIDATION", "phone");
    await expectAppCode((await appCaller()).mobileAuth.updateProfile({ firstName: "Kari", lastName: "Nordmann" }), "UNAUTHORIZED");
    expect(await rows("SELECT * FROM customer_accounts ORDER BY id")).toEqual(before);
    expect(other.profile.phone).toBe("+4791234222");

    // Over HTTP: feltet ligger i data.details.field, som for resten av appens skjemaer.
    const res = await app.request("/api/mobile/trpc/mobileAuth.updateProfile", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${reg.session.token}`, "x-forwarded-for": "10.56.0.1" },
      body: JSON.stringify({ json: { firstName: "Kari", lastName: "Nordmann", phone: "abc" } }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { json: { data: { appCode: string; details: { field: string } } } } };
    expect(body.error.json.data).toMatchObject({ appCode: "VALIDATION", details: { field: "phone" } });
  });

  it("registrering i appen lagrer språket der nettet lagrer det (en og nb)", async () => {
    const en = await registerApp("english@hellosky.test", { locale: "en" });
    const nb = await registerApp("norsk@hellosky.test", { locale: "nb" });
    const none = await registerApp("standard@hellosky.test");
    expect([en.profile.locale, nb.profile.locale, none.profile.locale]).toEqual(["en", "nb", "nb"]);
    const stored = await rows<{ email: string; locale: string }>("SELECT email, locale FROM customer_accounts ORDER BY id");
    expect(stored).toEqual([
      { email: "english@hellosky.test", locale: "en" },
      { email: "norsk@hellosky.test", locale: "nb" },
      { email: "standard@hellosky.test", locale: "nb" },
    ]);
    // Bekreftelses-e-posten går på kontoens språk.
    expect(await countRows("email_events", "kind='verify_email' AND recipient='english@hellosky.test' AND locale='en'")).toBe(1);
    expect(await countRows("email_events", "kind='verify_email' AND recipient='norsk@hellosky.test' AND locale='nb'")).toBe(1);
    // Nettet ser samme språk.
    expect((await (await webLogin("english@hellosky.test")).caller.customerAuth.me())?.locale).toBe("en");
    await expectField(registerApp("fransk@hellosky.test", { locale: "fr" as "en" }), "VALIDATION", "locale");
  });
});

// ─── 2b. Nytt telefonnummer: passord + SMS-kode til nummeret ────────────────

describe("mobileAuth.requestPhoneChange / confirmPhoneChange", () => {
  beforeEach(async () => {
    await fresh();
    smsSent.length = 0;
    vi.mocked(verifySocialToken).mockReset();
  });
  afterAll(closeDb);

  it("R3: et stjålet token kan ikke binde et nytt nummer – uten passord ingen kode, og SMS-innlogging gir ikke kontoen etter «logg ut alle»", async () => {
    const victim = await registerApp("offer@example.com");
    const stolen = await appCaller(victim.session.token);
    const err = await caught(stolen.mobileAuth.updateProfile({ firstName: "Kari", lastName: "Nordmann", phone: "+4793333333" }));
    expect(causeOf(err)).toMatchObject({ field: "phone", reason: "phone_verification_required" });
    // Uten eller med feil passord: UNAUTHORIZED med feltet – og ingen SMS, ingen kode.
    for (const password of [undefined, "gjetter-passord-1"]) {
      const e = await caught(stolen.mobileAuth.requestPhoneChange({ phone: "+4793333333", password }));
      expect(appCode(e)).toBe("UNAUTHORIZED");
      expect(causeOf(e)).toMatchObject({ field: "password" });
    }
    expect(smsSent).toEqual([]);
    expect(await countRows("customer_otp_codes")).toBe(0);
    // Tokenet lever fortsatt – feil passord er ikke en død sesjon.
    expect((await appCtx(victim.session.token)).customer?.customerId).toBe(victim.profile.id);

    // Offeret logger ut alle enheter; angriperens nummer gir ingen vei inn.
    await (await appCaller(victim.session.token)).mobileAuth.logoutAll();
    await (await appCaller()).mobileAuth.requestLoginCode({ phone: "+4793333333" });
    expect(smsSent).toEqual([]);
    await expectAppCode((await appCaller()).mobileAuth.verifyLoginCode({ phone: "+4793333333", code: "123456" }), "UNAUTHORIZED");
    expect(await countRows("customer_accounts", "phone IS NOT NULL")).toBe(0);
  });

  it("med passord og kode: nummeret lagres, andre sesjoner logges ut, kontoen varsles – og nummeret gir SMS-innlogging", async () => {
    const reg = await registerApp("eier@example.com", { firstName: "Eva" });
    const other = await (await appCaller()).mobileAuth.login({ identifier: "eier@example.com", password: PASSWORD });
    const w = await webLogin("eier@example.com");
    const me = await appCaller(reg.session.token);

    expect(await me.mobileAuth.requestPhoneChange({ phone: "+47 911 22 333", password: PASSWORD })).toEqual({ ok: true });
    expect(smsSent.map((m) => m.to)).toEqual(["+4791122333"]);
    const code = lastCodeTo("+4791122333");
    expect(await countRows("customer_accounts", "phone IS NOT NULL")).toBe(0); // ikke lagret før koden

    // Feil kode, eller riktig kode for et annet nummer: VALIDATION på koden (aldri UNAUTHORIZED).
    const wrongCode = code === "000000" ? "000001" : "000000";
    await expectField(me.mobileAuth.confirmPhoneChange({ phone: "+4791122333", code: wrongCode }), "VALIDATION", "code");
    await expectField(me.mobileAuth.confirmPhoneChange({ phone: "+4791122444", code }), "VALIDATION", "code");
    // En annen kundes sesjon kan ikke bruke koden.
    const stranger = await registerApp("fremmed@example.com");
    await expectField((await appCaller(stranger.session.token)).mobileAuth.confirmPhoneChange({ phone: "+4791122333", code }), "VALIDATION", "code");

    const profile = await me.mobileAuth.confirmPhoneChange({ phone: "+4791122333", code });
    expect(profile).toMatchObject({ id: reg.profile.id, phone: "+4791122333" });
    expect(profile).toEqual(await me.mobileAuth.me());
    // Koden er brukt opp.
    await expectField(me.mobileAuth.confirmPhoneChange({ phone: "+4791122333", code }), "VALIDATION", "code");

    // Denne sesjonen lever; de andre (app og nett) er logget ut.
    expect((await appCtx(reg.session.token)).customer?.customerId).toBe(reg.profile.id);
    expect((await appCtx(other.session.token)).customer).toBeNull();
    expect((await withCookie(w.loginHeaders)).ctx.customer).toBeNull();
    // Kontoen får e-post (maskert nummer), og revisjonsloggen har begge steg.
    expect(await countRows("email_events", "kind='phone_changed' AND recipient='eier@example.com'")).toBe(1);
    expect(await countRows("audit_logs", `action IN ('customer.phone_change_requested','customer.phone_changed') AND actor_id='${reg.profile.id}'`)).toBe(2);

    // Nummeret er nå en innloggingsvei til kontoen.
    await (await appCaller()).mobileAuth.requestLoginCode({ phone: "+4791122333" });
    const login = await (await appCaller()).mobileAuth.verifyLoginCode({ phone: "+4791122333", code: lastCodeTo("+4791122333") });
    expect(login.profile.id).toBe(reg.profile.id);

    // Neste bytte: det gamle nummeret får beskjed på SMS.
    smsSent.length = 0;
    await me.mobileAuth.requestPhoneChange({ phone: "+4791122555", password: PASSWORD });
    await me.mobileAuth.confirmPhoneChange({ phone: "+4791122555", code: lastCodeTo("+4791122555") });
    expect(smsSent.find((m) => m.to === "+4791122333")?.text).toMatch(/endret/);
  });

  it("R3b + R2: et nummer som tilhører en annen – eller et fremmed, uregistrert nummer – kan ikke kapres, og svaret røper ikke om det er i bruk", async () => {
    const owner = await existingPhoneAccount("+4794444111");
    const attacker = await registerApp("angriper@example.com");
    const a = await appCaller(attacker.session.token);

    // Et nummer i bruk og et ledig nummer: samme svar.
    expect(await a.mobileAuth.requestPhoneChange({ phone: "+4794444111", password: PASSWORD })).toEqual({ ok: true });
    expect(await a.mobileAuth.requestPhoneChange({ phone: "+4794444222", password: PASSWORD })).toEqual({ ok: true });
    // Eieren av nummeret i bruk får en melding uten kode; det ledige nummeret får en kode – begge på eierens telefon, aldri angriperens.
    expect(smsSent.map((m) => m.to)).toEqual(["+4794444111", "+4794444222"]);
    expect(smsSent[0].text).not.toMatch(/\d{6}/);
    expect(smsSent[1].text).toMatch(/\d{6}/);
    // Uten koden (som ligger på offerets telefon) kommer angriperen ikke videre; gjetting er VALIDATION, ikke CONFLICT.
    await expectField(a.mobileAuth.confirmPhoneChange({ phone: "+4794444111", code: "123456" }), "VALIDATION", "code");
    await expectField(a.mobileAuth.confirmPhoneChange({ phone: "+4794444222", code: "123456" }), "VALIDATION", "code");
    expect(await rows(`SELECT phone FROM customer_accounts WHERE id = ${attacker.profile.id}`)).toEqual([{ phone: null }]);
    // Det ledige nummeret er fortsatt ledig (ingen konto fikk det), og SMS-innlogging for nummeret i bruk går til eieren.
    expect(await countRows("customer_accounts", "phone = '+4794444222'")).toBe(0);
    await (await appCaller()).mobileAuth.requestLoginCode({ phone: "+4794444111" });
    expect((await (await appCaller()).mobileAuth.verifyLoginCode({ phone: "+4794444111", code: lastCodeTo("+4794444111") })).profile.id).toBe(owner.profile.id);

    // Tak: 5 forespørsler i timen per kunde (ikke et ubegrenset oppslag).
    for (let i = 3; i <= 5; i++) await a.mobileAuth.requestPhoneChange({ phone: `+479444433${i}`, password: PASSWORD });
    await expectAppCode(a.mobileAuth.requestPhoneChange({ phone: "+4794444339", password: PASSWORD }), "RATE_LIMITED");
  });

  it("ingen omvei: et nytt nummer krever SMS-kode på BEGGE ruterne, med cookie og med Bearer", async () => {
    const reg = await registerApp("omvei@hellosky.test");
    const w = await webLogin("omvei@hellosky.test");
    const cookieToken = w.cookie.split(`${CUSTOMER_COOKIE}=`)[1]!.split(";")[0]!;
    const phoneOf = async () => (await (await appCaller(reg.session.token)).mobileAuth.me())!.phone;
    const blocked = async (p: Promise<unknown>) => {
      const err = await caught(p);
      expect(appCode(err)).toBe("VALIDATION");
      expect(causeOf(err)).toMatchObject({ field: "phone", reason: "phone_verification_required" });
    };

    // Nettets rute med nett-cookien (nettets egen profilside).
    await blocked(w.caller.customerAuth.updateProfile({ firstName: "Kari", lastName: "Nordmann", phone: "+4795555001" }));
    // Nettets rute med appens Bearer-token (context.ts leser begge).
    await blocked((await webAs(reg.session.token)).customerAuth.updateProfile({ firstName: "Kari", lastName: "Nordmann", phone: "+4795555002" }));
    // Appens rute med nettets cookie.
    const mobileWithCookie = makeCtx({ headers: { cookie: `${CUSTOMER_COOKIE}=${cookieToken}` }, url: "http://localhost:3000/api/mobile/trpc/test" });
    mobileWithCookie.req.headers.delete("origin");
    mobileWithCookie.customer = await resolveCustomerSession(mobileWithCookie.req);
    expect(mobileWithCookie.customer?.customerId).toBe(reg.profile.id);
    await blocked(mobile(mobileWithCookie).mobileAuth.updateProfile({ firstName: "Kari", lastName: "Nordmann", phone: "+4795555003" }));
    // Over HTTP mot nettets endepunkt med Bearer, som en angriper med et stjålet app-token ville gjort.
    const res = await app.request("/api/trpc/customerAuth.updateProfile", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${reg.session.token}`, origin: "http://localhost:3000", "x-forwarded-for": "10.59.0.1" },
      body: JSON.stringify({ json: { firstName: "Kari", lastName: "Nordmann", phone: "+4795555004" } }),
    });
    expect(res.status).toBe(400);
    expect(await phoneOf()).toBeNull();

    // Nettets nye vei: samme tjeneste som appen (passord + kode til det nye nummeret).
    await expectField(w.caller.customerAuth.requestPhoneChange({ phone: "+4795555010", password: "feil-passord-1" }), "UNAUTHORIZED", "password");
    expect(await w.caller.customerAuth.requestPhoneChange({ phone: "+4795555010", password: PASSWORD })).toEqual({ ok: true });
    await expectField(w.caller.customerAuth.confirmPhoneChange({ phone: "+4795555010", code: "000000" }), "VALIDATION", "code");
    expect(await w.caller.customerAuth.confirmPhoneChange({ phone: "+4795555010", code: lastCodeTo("+4795555010") })).toEqual({ ok: true });
    expect(await w.caller.customerAuth.me()).toMatchObject({ phone: "+4795555010" });
    // Andre sesjoner (her appens token) er logget ut; nett-sesjonen som bekreftet lever.
    expect(await (await appCaller(reg.session.token)).mobileAuth.me()).toBeNull();

    // Samme nummer og å fjerne nummeret (kontoen har e-post) går fortsatt uten kode.
    // Ny forespørsel = sesjonen leses på nytt, med dagens nummer (som over HTTP).
    const next = async () => (await withCookie(w.loginHeaders)).caller;
    expect(await (await next()).customerAuth.updateProfile({ firstName: "Kari", lastName: "Nordmann", phone: "+47 955 55 010" })).toEqual({ ok: true });
    expect(await (await next()).customerAuth.updateProfile({ firstName: "Kari", lastName: "Nordmann", phone: "" })).toEqual({ ok: true });
    expect(await (await next()).customerAuth.me()).toMatchObject({ phone: null });
  });

  it("konto uten passord: fersk innlogging kreves; en gammel sesjon gir FORBIDDEN reauth_required", async () => {
    vi.mocked(verifySocialToken).mockResolvedValue({ subject: "user_apple_phone", email: "eple@example.com", emailVerified: true, firstName: "Eple", lastName: null, social: "apple" });
    const first = await (await appCaller()).mobileAuth.exchangeSocialToken({ token: "clerk-session-token-phone-1" });
    await ageSession(first.session.token);
    const err = await caught((await appCaller(first.session.token)).mobileAuth.requestPhoneChange({ phone: "+4796666000" }));
    expect(appCode(err)).toBe("FORBIDDEN");
    expect(causeOf(err)).toMatchObject({ reason: "reauth_required" });
    expect(smsSent).toEqual([]);
    // Logger inn på nytt (Sign in with Apple) → nytt token → koden sendes.
    const again = await (await appCaller()).mobileAuth.exchangeSocialToken({ token: "clerk-session-token-phone-2" });
    expect(await (await appCaller(again.session.token)).mobileAuth.requestPhoneChange({ phone: "+4796666000" })).toEqual({ ok: true });
    const done = await (await appCaller(again.session.token)).mobileAuth.confirmPhoneChange({ phone: "+4796666000", code: lastCodeTo("+4796666000") });
    expect(done.phone).toBe("+4796666000");
  });
});

// ─── 4. Sletting ────────────────────────────────────────────────────────────

type Fk = { t: string; c: string };

async function customerFks(): Promise<Fk[]> {
  return rows<Fk>(
    "SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'customer_accounts' ORDER BY TABLE_NAME, COLUMN_NAME",
  );
}

/** Alt som finnes om en kunde: hver FK-rad, pluss avhengige rader og kontoraden. Brukes for «urørt»-sjekker. */
async function snapshot(id: number): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const { t, c } of await customerFks()) out[`${t}.${c}`] = await rows(`SELECT * FROM \`${t}\` WHERE \`${c}\` = ${id} ORDER BY id`);
  const children: Record<string, string> = {
    account: `SELECT * FROM customer_accounts WHERE id = ${id}`,
    documentBlobs: `SELECT b.* FROM customer_document_blobs b JOIN customer_documents d ON d.id = b.document_id WHERE d.customer_id = ${id} ORDER BY b.document_id`,
    matchVotes: `SELECT v.* FROM match_votes v JOIN match_participants p ON p.id = v.participant_id WHERE p.customer_id = ${id} ORDER BY v.id`,
    matchComments: `SELECT m.* FROM match_comments m JOIN match_participants p ON p.id = m.participant_id WHERE p.customer_id = ${id} ORDER BY m.id`,
    boardVotes: `SELECT * FROM trip_board_votes WHERE voter_key = 'c:${id}' ORDER BY id`,
    boardItemVotes: `SELECT v.* FROM trip_board_votes v JOIN trip_board_items i ON i.id = v.item_id JOIN trip_boards b ON b.id = i.board_id WHERE b.owner_customer_id = ${id} ORDER BY v.id`,
    pollOptions: `SELECT o.* FROM group_poll_options o JOIN group_polls p ON p.id = o.poll_id WHERE p.created_by_id = ${id} ORDER BY o.id`,
    postComments: `SELECT c.* FROM social_comments c JOIN social_posts p ON p.id = c.post_id WHERE p.author_id = ${id} ORDER BY c.id`,
    communityComments: `SELECT c.* FROM community_comments c JOIN community_posts p ON p.id = c.post_id WHERE p.customer_id = ${id} ORDER BY c.id`,
    emailEvents: `SELECT e.* FROM email_events e JOIN customer_accounts a ON a.email = e.recipient WHERE a.id = ${id} ORDER BY e.id`,
    audit: `SELECT * FROM audit_logs WHERE actor_type = 'customer' AND actor_id = '${id}' ORDER BY id`,
  };
  for (const [k, q] of Object.entries(children)) out[k] = await rows(q);
  // last_seen_at fornyes (best effort) når en sesjon brukes; det er ikke en dataendring.
  for (const list of Object.values(out)) for (const r of list as Array<Record<string, unknown>>) delete r.last_seen_at;
  return out;
}

let seq = 0;
const uniq = (p: string) => `${p}${++seq}${Math.random().toString(36).slice(2, 8)}`;
const insertId = (r: unknown) => Number((r as Array<{ insertId: number }>)[0].insertId);

/** Kundens egne data i hver tabell som kan eies av én kunde alene. */
async function seedOwn(id: number, email: string) {
  const db = getDb();
  const future = new Date(Date.now() + 3_600_000);
  await db.insert(s.customerIdentities).values({ customerId: id, provider: "clerk", subject: uniq("sub_"), social: "apple", email });
  await db.insert(s.customerEmailTokens).values({ tokenHash: sha256Hex(uniq("e")), customerId: id, expiresAt: future });
  await db.insert(s.customerOtpCodes).values({ customerId: id, codeHash: sha256Hex(uniq("o")), expiresAt: future });
  await db.insert(s.customerPasswordResets).values({ tokenHash: sha256Hex(uniq("r")), customerId: id, expiresAt: future });
  await db.insert(s.savedTravelers).values({ customerId: id, firstName: "Barn", lastName: "Nordmann", bornOn: "2015-01-01" });
  await db.insert(s.priceAlerts).values({ customerId: id, email, originIata: "OSL", destinationIata: "BCN", departDate: "2027-06-01", targetPrice: 900 });
  await db.insert(s.bookingHolds).values({ tokenHash: sha256Hex(uniq("h")), offerId: uniq("off_"), offerSnapshot: "{}", customerId: id, email, expiresAt: future });
  const bookingId = insertId(await db.insert(s.bookings).values({ orderId: uniq("ord_"), bookingReference: "ABC123", contactEmail: email, payload: "{}", customerAccountId: id }));
  await db.insert(s.checkoutSessions).values({ publicId: uniq("pub-"), offerId: uniq("off_"), offerSnapshot: "{}", passengersJson: "[]", contactEmail: email, contactPhone: "+4790000000", customerAccountId: id, currency: "NOK", supplierAmountMinor: 100000, totalAmountMinor: 100000, breakdownJson: "{}", idempotencyKey: uniq("idem-"), expiresAt: future });
  await db.insert(s.consents).values({ customerAccountId: id, email, type: "terms", version: "2026-09", granted: true, source: "checkout" });
  await db.insert(s.fraudFlags).values({ customerAccountId: id, type: "test_flag", score: 10 });
  await db.insert(s.customerTravelProfiles).values({ customerId: id, homeAirportsJson: '["OSL"]' });
  await db.insert(s.savedItems).values({ customerId: id, kind: "destination", refId: "barcelona" });
  await db.insert(s.searchHistory).values({ customerId: id, originIata: "OSL", destinationIata: "BCN", departDate: "2027-06-01" });
  await db.insert(s.customerNotifications).values({ customerId: id, type: "system", title: "Hei", dedupeKey: uniq("n-") });
  await db.insert(s.priceWatches).values({ customerId: id, originIata: "OSL", destinationIata: "BCN", dateFrom: "2027-06-01", dateTo: "2027-07-01", maxPriceMinor: 200000 });
  await db.insert(s.dealFeedback).values({ customerId: id, dealId: "deal-1", verdict: "interested" });
  await db.insert(s.rewardEvents).values({ customerId: id, kind: "adjustment", amountKr: 50, refType: "test", refId: uniq("rw-") });
  await db.insert(s.providerClicks).values({ clickRef: uniq("click-"), customerId: id, provider: "kayak", originIata: "OSL", destinationIata: "BCN", departDate: "2027-06-01" });
  // Samfunn: eget innlegg med egen kommentar og like
  const cpost = insertId(await db.insert(s.communityPosts).values({ customerId: id, body: "Tips", likes: 1 }));
  await db.insert(s.communityComments).values({ postId: cpost, customerId: id, body: "Egen kommentar" });
  await db.insert(s.communityLikes).values({ postId: cpost, customerId: id });
  // Reiseplan med dokument (og selve filen)
  const plan = insertId(await db.insert(s.tripPlans).values({ customerId: id, title: "Sommer", notes: "Adresse: Gata 1" }));
  const doc = insertId(await db.insert(s.customerDocuments).values({ customerId: id, tripPlanId: plan, kind: "boarding_pass", title: "Boardingkort", fileName: "bp.pdf", mime: "application/pdf", bytes: 4, sha256: sha256Hex("pdf") }));
  await db.insert(s.customerDocumentBlobs).values({ documentId: doc, ciphertext: Buffer.from("kryptert") });
  // Egen gruppe (alene) med innlegg, avstemning og stemme
  const group = insertId(await db.insert(s.travelGroups).values({ ownerId: id, name: "Alene" }));
  await db.insert(s.travelGroupMembers).values({ groupId: group, customerId: id, role: "owner" });
  const gpost = insertId(await db.insert(s.socialPosts).values({ authorId: id, audience: "group", groupId: group, body: "Idé", likes: 1 }));
  await db.insert(s.socialComments).values({ postId: gpost, authorId: id, body: "Egen" });
  await db.insert(s.socialLikes).values({ postId: gpost, customerId: id });
  const poll = insertId(await db.insert(s.groupPolls).values({ groupId: group, createdById: id, question: "Hvor?" }));
  const opt = insertId(await db.insert(s.groupPollOptions).values({ pollId: poll, label: "Roma" }));
  await db.insert(s.groupPollVotes).values({ pollId: poll, optionId: opt, customerId: id });
  await db.insert(s.customerFriendships).values({ requesterId: id, addresseeId: null, status: "pending", inviteTokenHash: sha256Hex(uniq("inv")) });
  // ReiseMatch-økt og reisetavle kunden eier, med egne svar/elementer
  const ms = insertId(await db.insert(s.matchSessions).values({ token: uniq("m").padEnd(32, "x").slice(0, 32), mode: "couple", title: "Oss to", ownerCustomerId: id, expiresAt: future }));
  const mp = insertId(await db.insert(s.matchParticipants).values({ sessionId: ms, name: "Kari", customerId: id, keyHash: sha256Hex(uniq("k")), answersJson: '{"budget":5000}' }));
  await db.insert(s.matchVotes).values({ sessionId: ms, participantId: mp, destinationId: "roma", value: 1 });
  await db.insert(s.matchComments).values({ sessionId: ms, participantId: mp, body: "Roma!" });
  const board = insertId(await db.insert(s.tripBoards).values({ token: uniq("b").padEnd(32, "y").slice(0, 32), ownerCustomerId: id, title: "Tavle" }));
  const item = insertId(await db.insert(s.tripBoardItems).values({ boardId: board, kind: "destination", refId: "roma", addedByCustomerId: id, addedByName: "Kari" }));
  await db.insert(s.tripBoardVotes).values({ itemId: item, voterKey: `c:${id}`, voterName: "Kari" });
  await db.insert(s.tripBoardComments).values({ boardId: board, authorName: "Kari", authorCustomerId: id, body: "Fint" });
  await db.insert(s.contentReports).values({ reporterId: id, targetType: "social_post", targetId: gpost, reason: "spam", details: "fritekst" });
  await db.insert(s.emailEvents).values({ recipient: email, kind: "booking_confirmation", bookingId, status: "sent" });
  await db.insert(s.supportCases).values({ reference: uniq("HS-").slice(0, 16), subject: "Hjelp", customerEmail: email });
  return { bookingId, group };
}

/**
 * Nettets sletting slik den alltid har vært (customerAuth.deleteAccount før
 * appen fikk sletting), og det nettsiden lover kunden: «Kontoen, lagrede
 * reisende, prisvarsler og bonus slettes permanent. Gjennomførte bestillinger
 * beholdes som regnskapsbilag.» Nøkkel: `tabell.kolonne` for hver FK mot
 * customer_accounts. Alt som ikke står her, røres ikke.
 */
const ESTABLISHED: Record<string, DeletionAction> = {
  "customer_sessions.customer_id": "revoke",
  "customer_identities.customer_id": "delete",
  "customer_email_tokens.customer_id": "delete",
  "customer_otp_codes.customer_id": "delete",
  "customer_password_resets.customer_id": "delete",
  "saved_travelers.customer_id": "delete",
  "booking_holds.customer_id": "delete",
  "price_alerts.customer_id": "deactivate",
  "community_posts.customer_id": "delete",
  "community_comments.customer_id": "delete",
  "community_likes.customer_id": "delete",
  "bookings.customer_account_id": "detach",
};

type Snapshot = Record<string, unknown[]>;

/** Hver FK-rad etter slettingen: borte (slettet/frakoblet), fortsatt der (tilbakekalt/slått av) eller urørt rad for rad. */
function expectEstablished(fks: Fk[], before: Snapshot, after: Snapshot) {
  for (const { t, c } of fks) {
    const key = `${t}.${c}`;
    const action = ESTABLISHED[key] ?? "retain";
    if (action === "delete" || action === "detach") expect(after[key], key).toEqual([]);
    else if (action === "retain") expect(after[key], key).toEqual(before[key]);
    else expect(after[key].length, key).toBe(before[key].length);
  }
}

describe("mobileAuth.deleteAccount: én slettetjeneste for nett og app, med nettets sletting", () => {
  beforeEach(fresh);
  afterAll(closeDb);

  it("slettematrisen dekker hver FK mot customer_accounts i databasen og beskriver nøyaktig nettets sletting", async () => {
    const fks = await customerFks();
    expect(fks.length).toBeGreaterThan(40);
    const keys = fks.map(({ t, c }) => `${t}.${c}`);
    expect(keys).toEqual(expect.arrayContaining(Object.keys(ESTABLISHED)));
    const documented = Object.fromEntries(fks.map(({ t, c }) => [`${t}.${c}`, CUSTOMER_DATA_MATRIX.find((r) => r.table === t && r.columns.includes(c))?.action]));
    const established = Object.fromEntries(keys.map((k) => [k, ESTABLISHED[k] ?? "retain"]));
    expect(documented).toEqual(established);
  });

  it("sletter det nettet alltid har slettet, lar resten stå urørt, tilbakekaller nett- og app-sesjoner og rører ikke andre kunder", async () => {
    const db = getDb();
    // A: kunden som sletter seg (registrert i appen, innlogget på nett også).
    const a = await registerApp("a@hellosky.test", { marketingConsent: true, firstName: "Anne" });
    const A = a.profile.id;
    const aWeb = await webLogin("a@hellosky.test");
    // B: samhandler med A. C: en helt uavhengig kunde. D: vervet av A.
    const b = await registerApp("b@hellosky.test", { firstName: "Bjørn" });
    const B = b.profile.id;
    const c = await registerApp("c@hellosky.test", { firstName: "Cecilie" });
    const C = c.profile.id;
    const d = await registerApp("d@hellosky.test", { referralCode: a.profile.referralCode!, firstName: "Dag" });
    const D = d.profile.id;
    const own = await seedOwn(A, "a@hellosky.test");
    await seedOwn(B, "b@hellosky.test");
    await seedOwn(C, "c@hellosky.test");

    // ── Samhandling A ↔ B ──
    await db.insert(s.customerFriendships).values({ requesterId: B, addresseeId: A, status: "accepted" });
    await db.insert(s.customerBlocks).values([{ blockerId: B, blockedId: A }, { blockerId: A, blockedId: D }]);
    const [bCommunityPost] = await rows<{ id: number }>(`SELECT id FROM community_posts WHERE customer_id = ${B}`);
    const [aCommunityPost] = await rows<{ id: number }>(`SELECT id FROM community_posts WHERE customer_id = ${A}`);
    await db.insert(s.communityLikes).values({ postId: bCommunityPost.id, customerId: A });
    await db.update(s.communityPosts).set({ likes: sql`likes + 1` }).where(sql`id = ${bCommunityPost.id}`);
    await db.insert(s.communityComments).values([{ postId: bCommunityPost.id, customerId: A, body: "A hos B" }, { postId: aCommunityPost.id, customerId: B, body: "B hos A" }]);
    // Grupper: G1 eid av A med B som medlem; G3 eid av B med A som medlem.
    const g1 = insertId(await db.insert(s.travelGroups).values({ ownerId: A, name: "Felles" }));
    await db.insert(s.travelGroupMembers).values({ groupId: g1, customerId: A, role: "owner", joinedAt: new Date(Date.now() - 60_000) });
    await db.insert(s.travelGroupMembers).values({ groupId: g1, customerId: B, role: "member" });
    await db.insert(s.socialPosts).values({ authorId: B, audience: "group", groupId: g1, body: "B i G1" });
    const [bGroup] = await rows<{ id: number }>(`SELECT id FROM travel_groups WHERE owner_id = ${B}`);
    const g3 = bGroup.id;
    await db.insert(s.travelGroupMembers).values({ groupId: g3, customerId: A, role: "member" });
    const aInG3 = insertId(await db.insert(s.socialPosts).values({ authorId: A, audience: "group", groupId: g3, body: "A i G3" }));
    await db.insert(s.socialComments).values({ postId: aInG3, authorId: B, body: "B svarer A" });
    const [bPost] = await rows<{ id: number; likes: number }>(`SELECT id, likes FROM social_posts WHERE author_id = ${B} AND group_id = ${g3}`);
    await db.insert(s.socialLikes).values({ postId: bPost.id, customerId: A });
    await db.update(s.socialPosts).set({ likes: sql`likes + 1` }).where(sql`id = ${bPost.id}`);
    await db.insert(s.socialComments).values({ postId: bPost.id, authorId: A, body: "A svarer B" });
    const aPoll = insertId(await db.insert(s.groupPolls).values({ groupId: g3, createdById: A, question: "A spør" }));
    const aOpt = insertId(await db.insert(s.groupPollOptions).values({ pollId: aPoll, label: "Paris" }));
    await db.insert(s.groupPollVotes).values({ pollId: aPoll, optionId: aOpt, customerId: B });
    const [bPoll] = await rows<{ id: number }>(`SELECT id FROM group_polls WHERE created_by_id = ${B}`);
    const [bOpt] = await rows<{ id: number }>(`SELECT id FROM group_poll_options WHERE poll_id = ${bPoll.id}`);
    await db.insert(s.groupPollVotes).values({ pollId: bPoll.id, optionId: bOpt.id, customerId: A });
    await db.insert(s.tripPlans).values({ customerId: B, title: "B i A-s gruppe", groupId: own.group });
    // ReiseMatch: B deltar i A-s økt; A deltar i B-s økt.
    const [aSession] = await rows<{ id: number }>(`SELECT id FROM match_sessions WHERE owner_customer_id = ${A}`);
    const bInA = insertId(await db.insert(s.matchParticipants).values({ sessionId: aSession.id, name: "Bjørn", customerId: B, keyHash: sha256Hex(uniq("k")), answersJson: "{}" }));
    await db.insert(s.matchVotes).values({ sessionId: aSession.id, participantId: bInA, destinationId: "paris", value: 1 });
    const [bSession] = await rows<{ id: number }>(`SELECT id FROM match_sessions WHERE owner_customer_id = ${B}`);
    const aInB = insertId(await db.insert(s.matchParticipants).values({ sessionId: bSession.id, name: "Anne", customerId: A, keyHash: sha256Hex(uniq("k")), answersJson: '{"budget":1}' }));
    await db.insert(s.matchVotes).values({ sessionId: bSession.id, participantId: aInB, destinationId: "paris", value: -1 });
    await db.insert(s.matchComments).values({ sessionId: bSession.id, participantId: aInB, body: "Anne her" });
    // Reisetavler: B bidrar på A-s tavle; A bidrar på B-s tavle.
    const [aBoard] = await rows<{ id: number }>(`SELECT id FROM trip_boards WHERE owner_customer_id = ${A}`);
    const bItemOnA = insertId(await db.insert(s.tripBoardItems).values({ boardId: aBoard.id, kind: "note", note: "B", addedByCustomerId: B }));
    await db.insert(s.tripBoardVotes).values({ itemId: bItemOnA, voterKey: `c:${B}`, voterName: "Bjørn" });
    await db.insert(s.tripBoardComments).values({ boardId: aBoard.id, authorName: "Bjørn", authorCustomerId: B, body: "B hos A" });
    const [bBoard] = await rows<{ id: number }>(`SELECT id FROM trip_boards WHERE owner_customer_id = ${B}`);
    const aItemOnB = insertId(await db.insert(s.tripBoardItems).values({ boardId: bBoard.id, kind: "note", note: "A", addedByCustomerId: A, addedByName: "Anne" }));
    await db.insert(s.tripBoardVotes).values({ itemId: aItemOnB, voterKey: `c:${B}`, voterName: "Bjørn" });
    const [bItem] = await rows<{ id: number }>(`SELECT id FROM trip_board_items WHERE board_id = ${bBoard.id} AND added_by_customer_id = ${B}`);
    await db.insert(s.tripBoardVotes).values({ itemId: bItem.id, voterKey: `c:${A}`, voterName: "Anne" });
    await db.insert(s.tripBoardComments).values({ boardId: bBoard.id, authorName: "Anne", authorCustomerId: A, body: "A hos B" });
    // Moderering: A rapporterte B; B rapporterte A.
    await db.insert(s.contentReports).values({ reporterId: A, targetType: "social_post", targetId: bPost.id, reason: "spam" });
    await db.insert(s.contentReports).values({ reporterId: B, targetType: "customer", targetId: A, reason: "abuse" });

    // A har minst én rad i hver eneste tabell som peker på en kunde.
    const fks = await customerFks();
    for (const { t, c: col } of fks) expect(await countRows(t, `\`${col}\` = ${A}`), `${t}.${col}`).toBeGreaterThan(0);
    const labelled = await countRows("audit_logs", "actor_label = 'Anne'");
    expect(labelled).toBeGreaterThan(0);
    const aMails = await rows("SELECT * FROM email_events WHERE recipient = 'a@hellosky.test' ORDER BY id");
    expect(aMails.length).toBeGreaterThan(1);
    const notificationsBefore = await rows("SELECT * FROM customer_notifications ORDER BY id");
    const aBefore = await snapshot(A);
    const bBefore = await snapshot(B);
    const cBefore = await snapshot(C);

    // ── Feil passord: ingenting endres, sesjonene lever ──
    await expectAppCode((await appCaller(a.session.token)).mobileAuth.deleteAccount({ password: "feil-passord-1" }), "UNAUTHORIZED");
    await expectAppCode((await appCaller(a.session.token)).mobileAuth.deleteAccount({}), "UNAUTHORIZED");
    expect(await snapshot(A)).toEqual(aBefore);
    expect((await appCtx(a.session.token)).customer?.customerId).toBe(A);
    expect((await withCookie(aWeb.loginHeaders)).ctx.customer?.customerId).toBe(A);
    // En annen kundes token sletter bare sin egen konto – aldri A (ingen id i input).
    await expectAppCode((await appCaller()).mobileAuth.deleteAccount({ password: PASSWORD }), "UNAUTHORIZED");

    // ── Sletting fra appen ──
    const delCtx = await appCtx(a.session.token);
    expect(await mobile(delCtx).mobileAuth.deleteAccount({ password: PASSWORD })).toEqual({ ok: true });
    expect(delCtx.resHeaders.get("set-cookie")).toBeNull();

    // Sesjoner: både app-tokenet og nett-cookien er døde. Radene står, tilbakekalt (som før).
    expect((await appCtx(a.session.token)).customer).toBeNull();
    expect(await (await appCaller(a.session.token)).mobileAuth.me()).toBeNull();
    expect((await withCookie(aWeb.loginHeaders)).ctx.customer).toBeNull();
    await expectAppCode(web((await withCookie(aWeb.loginHeaders)).ctx).account.saved(), "UNAUTHORIZED");
    await expectAppCode((await appCaller()).mobileAuth.login({ identifier: "a@hellosky.test", password: PASSWORD }), "UNAUTHORIZED");
    expect(aBefore["customer_sessions.customer_id"]).toHaveLength(2); // app + nett
    expect(await countRows("customer_sessions", `customer_id = ${A}`)).toBe(2);
    expect(await countRows("customer_sessions", `customer_id = ${A} AND revoked_at IS NULL`)).toBe(0);

    // Hver FK-rad: borte, fortsatt der (tilbakekalt / slått av) eller urørt, rad for rad.
    const aAfter = await snapshot(A);
    expectEstablished(fks, aBefore, aAfter);

    // Det nettsiden lover: lagrede reisende og prisvarsler, bonus, kontoen; bestillingen beholdes frakoblet.
    expect(await countRows("saved_travelers", `customer_id = ${A}`)).toBe(0);
    expect(await countRows("price_alerts", `customer_id = ${A}`)).toBe(1);
    expect(await countRows("price_alerts", `customer_id = ${A} AND active = 0 AND email = 'deleted'`)).toBe(1);
    expect(await countRows("bookings", `id = ${own.bookingId} AND customer_account_id IS NULL`)).toBe(1);
    const [acc] = await rows<Record<string, unknown>>(`SELECT * FROM customer_accounts WHERE id = ${A}`);
    expect(acc).toMatchObject({ email: `deleted-${A}@anonymized.invalid`, phone: null, first_name: "Slettet", last_name: "Bruker", password_hash: "!deleted", avatar_url: null, referral_code: null, bonus_kr: 0, marketing_consent_at: null });
    expect(acc.deleted_at).not.toBeNull();
    expect(await countRows("audit_logs", `action='customer.account_deleted' AND target_id='${A}' AND metadata_json LIKE '%mobile%'`)).toBe(1);

    // Dagens sletting rører ikke disse – de står nøyaktig som før.
    for (const t of ["saved_items", "search_history", "price_watches", "trip_plans", "customer_documents", "customer_travel_profiles", "customer_notifications", "deal_feedback", "social_likes", "travel_group_members", "group_poll_votes", "match_participants", "reward_events"]) {
      expect(aAfter[`${t}.customer_id`].length, t).toBeGreaterThan(0);
      expect(aAfter[`${t}.customer_id`], t).toEqual(aBefore[`${t}.customer_id`]);
    }
    for (const [t, col, n] of [["checkout_sessions", "customer_account_id", 1], ["provider_clicks", "customer_id", 1], ["consents", "customer_account_id", 2], ["fraud_flags", "customer_account_id", 1]] as const) {
      expect(await countRows(t, `${col} = ${A}`), t).toBe(n);
    }
    expect(await countRows("customer_accounts", `id = ${D} AND referred_by_id = ${A}`)).toBe(1);
    expect(await rows(`SELECT owner_id FROM travel_groups WHERE id = ${g1}`)).toEqual([{ owner_id: A }]);
    // Avhengige rader: dokumentfiler, match-stemmer/-kommentarer, tavle-stemmer, avstemningsalternativer og
    // kommentarer på egne reiseidéer står. Kommentarer på egne community-innlegg kaskaderer (som før).
    for (const k of ["documentBlobs", "matchVotes", "matchComments", "boardVotes", "boardItemVotes", "pollOptions", "postComments"]) {
      expect(aAfter[k].length, k).toBeGreaterThan(0);
      expect(aAfter[k], k).toEqual(aBefore[k]);
    }
    expect(aBefore.communityComments.length).toBeGreaterThan(0);
    expect(aAfter.communityComments).toEqual([]);
    // Revisjonsloggen (også fornavnet i actor_label), e-postloggen og alle varsler står; bare slettingen er lagt til i loggen.
    expect(await countRows("audit_logs", "actor_label = 'Anne'")).toBe(labelled);
    expect(aAfter.audit.slice(0, aBefore.audit.length)).toEqual(aBefore.audit);
    expect(aAfter.audit.slice(aBefore.audit.length).map((r) => (r as { action: string }).action)).toEqual(["customer.account_deleted"]);
    expect(await rows("SELECT * FROM email_events WHERE recipient = 'a@hellosky.test' ORDER BY id")).toEqual(aMails);
    expect(await rows("SELECT * FROM customer_notifications ORDER BY id")).toEqual(notificationsBefore);
    expect(await countRows("support_cases", "customer_email='a@hellosky.test'")).toBe(1);
    // Brukeren hos Clerk slettes ikke (ingen jobb); bare koblingen i customer_identities er borte.
    expect(await countRows("jobs", "type = 'clerk_delete_user'")).toBe(0);

    // ── B: bare A-s community-bidrag er borte (som før); alt annet står rad for rad ──
    expect(await rows(`SELECT likes FROM community_posts WHERE id = ${bCommunityPost.id}`)).toEqual([{ likes: 1 }]);
    expect(await countRows("community_comments", "body IN ('A hos B', 'B hos A')")).toBe(0);
    const bAfter = await snapshot(B);
    const changedForB = Object.keys(bBefore).filter((k) => JSON.stringify(bAfter[k]) !== JSON.stringify(bBefore[k]));
    expect(changedForB.sort()).toEqual(["communityComments", "community_comments.customer_id", "community_posts.customer_id"]);
    expect((await appCtx(b.session.token)).customer?.customerId).toBe(B);

    // ── C: helt urørt, rad for rad ──
    expect(await snapshot(C)).toEqual(cBefore);
    expect((await appCtx(c.session.token)).customer?.customerId).toBe(C);
  });

  it("alt eller ingenting: feiler et steg, rulles hele slettingen tilbake", async () => {
    const a = await registerApp("atomisk@hellosky.test");
    await seedOwn(a.profile.id, "atomisk@hellosky.test");
    const before = await snapshot(a.profile.id);
    // Siste steg (anonymiseringen) feiler i databasen – alle tidligere endringer i transaksjonen må rulles tilbake.
    await getDb().execute(sql.raw("CREATE TRIGGER it_fail_anonymize BEFORE UPDATE ON customer_accounts FOR EACH ROW BEGIN IF NEW.first_name = 'Slettet' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'it: anonymisering feiler'; END IF; END"));
    try {
      await expectAppCode((await appCaller(a.session.token)).mobileAuth.deleteAccount({ password: PASSWORD }), "INTERNAL_SERVER_ERROR");
    } finally {
      await getDb().execute(sql.raw("DROP TRIGGER IF EXISTS it_fail_anonymize"));
    }
    expect(await snapshot(a.profile.id)).toEqual(before);
    expect((await appCtx(a.session.token)).customer?.customerId).toBe(a.profile.id);
    expect(await countRows("audit_logs", "action='customer.account_deleted'")).toBe(0);
  });

  it("konto uten passord (Apple/Google): DELETE eller SLETT og en fersk innlogging, ellers VALIDATION / FORBIDDEN reauth_required", async () => {
    vi.mocked(verifySocialToken).mockResolvedValue({ subject: "user_apple_1", email: "apple@example.test", emailVerified: true, firstName: "Eple", lastName: "Kunde", social: "apple" });
    const res = await (await appCaller()).mobileAuth.exchangeSocialToken({ token: "clerk-session-token-aaaaaaaa" });
    expect(res.profile.hasPassword).toBe(false);
    await expectField((await appCaller(res.session.token)).mobileAuth.deleteAccount({}), "VALIDATION", "confirmation");
    await expectField((await appCaller(res.session.token)).mobileAuth.deleteAccount({ password: "hva-som-helst-1" }), "VALIDATION", "confirmation");
    await expectField((await appCaller(res.session.token)).mobileAuth.deleteAccount({ confirmation: "JA" as "DELETE" }), "VALIDATION", "confirmation");
    expect(await countRows("customer_identities")).toBe(1);

    // Et token som er eldre enn 10 minutter er ikke bevis på at det er eieren: logg inn på nytt først.
    await ageSession(res.session.token);
    const stale = await caught((await appCaller(res.session.token)).mobileAuth.deleteAccount({ confirmation: "DELETE" }));
    expect(appCode(stale)).toBe("FORBIDDEN");
    expect(causeOf(stale)).toMatchObject({ reason: "reauth_required" });
    expect(await countRows("customer_accounts", "deleted_at IS NULL")).toBe(1);
    expect((await appCtx(res.session.token)).customer?.customerId).toBe(res.profile.id);

    // Sign in with Apple på nytt → nytt, ferskt token → slettingen går gjennom (små bokstaver går også).
    const again = await (await appCaller()).mobileAuth.exchangeSocialToken({ token: "clerk-session-token-bbbbbbbb" });
    expect(await (await appCaller(again.session.token)).mobileAuth.deleteAccount({ confirmation: "delete" as "DELETE" })).toEqual({ ok: true });
    expect(await countRows("customer_identities")).toBe(0);
    expect(await countRows("customer_accounts", "deleted_at IS NOT NULL")).toBe(1);
    // Begge sesjonene (den gamle og den ferske) er tilbakekalt, ikke slettet – som før.
    expect(await countRows("customer_sessions")).toBe(2);
    expect(await countRows("customer_sessions", "revoked_at IS NULL")).toBe(0);
    expect((await appCtx(again.session.token)).customer).toBeNull();

    // SLETT (nettets ord) virker også i appen.
    vi.mocked(verifySocialToken).mockResolvedValue({ subject: "user_google_2", email: "google@example.test", emailVerified: true, firstName: "Gul", lastName: "Kunde", social: "google" });
    const g = await (await appCaller()).mobileAuth.exchangeSocialToken({ token: "clerk-session-token-cccccccc" });
    expect(await (await appCaller(g.session.token)).mobileAuth.deleteAccount({ confirmation: "SLETT" })).toEqual({ ok: true });
    expect(await countRows("customer_accounts", "deleted_at IS NOT NULL")).toBe(2);
  });

  it("konto uten passord: fersk innlogging kreves også på nettets rute og med nett-cookie på appens rute", async () => {
    vi.mocked(verifySocialToken).mockResolvedValue({ subject: "user_apple_web", email: "nettapple@example.com", emailVerified: true, firstName: "Nett", lastName: null, social: "apple" });
    const s1 = await (await appCaller()).mobileAuth.exchangeSocialToken({ token: "clerk-session-token-web-1" });
    await ageSession(s1.session.token);
    // Nettets rute med appens Bearer-token: FORBIDDEN, ingenting slettet.
    const viaWeb = await caught((await webAs(s1.session.token)).customerAuth.deleteAccount({ confirmation: "SLETT" }));
    expect(appCode(viaWeb)).toBe("FORBIDDEN");
    expect(causeOf(viaWeb)).toMatchObject({ reason: "reauth_required" });
    // Appens rute med samme sesjon som nett-cookie: FORBIDDEN.
    const ctx = makeCtx({ headers: { cookie: `${CUSTOMER_COOKIE}=${s1.session.token}` }, url: "http://localhost:3000/api/mobile/trpc/test" });
    ctx.req.headers.delete("origin");
    ctx.customer = await resolveCustomerSession(ctx.req);
    const viaCookie = await caught(mobile(ctx).mobileAuth.deleteAccount({ confirmation: "SLETT" }));
    expect(appCode(viaCookie)).toBe("FORBIDDEN");
    expect(await countRows("customer_accounts", "deleted_at IS NOT NULL")).toBe(0);
    // En fersk innlogging sletter, også via nettets rute.
    const s2 = await (await appCaller()).mobileAuth.exchangeSocialToken({ token: "clerk-session-token-web-2" });
    expect(await (await webAs(s2.session.token)).customerAuth.deleteAccount({ confirmation: "SLETT" })).toEqual({ ok: true });
    expect(await countRows("customer_accounts", "deleted_at IS NOT NULL")).toBe(1);
  });

  it("nettets deleteAccount bruker samme tjeneste og sletter nøyaktig det samme som før", async () => {
    await registerApp("nett@hellosky.test");
    const w = await webLogin("nett@hellosky.test");
    const id = w.ctx.customer!.customerId;
    await seedOwn(id, "nett@hellosky.test");
    const fks = await customerFks();
    const before = await snapshot(id);
    const del = makeCtx({ headers: { cookie: w.cookie } });
    del.customer = await resolveCustomerSession(del.req);
    const wrong = await caught(web(del).customerAuth.deleteAccount({ password: "feil-passord-1" }));
    expect(appCode(wrong)).toBe("UNAUTHORIZED");
    expect(causeOf(wrong)).toMatchObject({ field: "password" });
    expect(await snapshot(id)).toEqual(before);

    expect(await web(del).customerAuth.deleteAccount({ password: PASSWORD })).toEqual({ ok: true });
    expect(del.resHeaders.get("set-cookie")).toContain("Max-Age=0");
    expectEstablished(fks, before, await snapshot(id));
    expect(await countRows("price_alerts", `customer_id = ${id} AND active = 0 AND email = 'deleted'`)).toBe(1);
    expect(await countRows("customer_sessions", `customer_id = ${id} AND revoked_at IS NULL`)).toBe(0);
    for (const t of ["trip_plans", "customer_documents", "customer_document_blobs", "price_watches", "saved_items", "search_history", "travel_groups", "match_sessions", "trip_boards"]) {
      expect(await countRows(t), t).toBeGreaterThan(0);
    }
    expect(await countRows("audit_logs", "action='customer.account_deleted' AND metadata_json LIKE '%web%'")).toBe(1);
  });

  it("dagens sletting rører ikke prisvarsler og holdte tilbud laget uten innlogging, varsler hos andre kunder eller e-postloggen", async () => {
    const db = getDb();
    const future = new Date(Date.now() + 3_600_000);
    const v = await registerApp("vera@example.com", { firstName: "Vera", lastName: "Varsel" });
    await db.execute(sql.raw(`UPDATE customer_accounts SET email_verified = 1 WHERE id = ${v.profile.id}`));
    const other = await registerApp("venn@example.com", { firstName: "Venn" });
    await db.insert(s.priceAlerts).values({ customerId: null, email: "vera@example.com", originIata: "OSL", destinationIata: "BCN", departDate: "2027-06-01", targetPrice: 900 });
    await db.insert(s.bookingHolds).values({ tokenHash: sha256Hex(uniq("h")), offerId: uniq("off_"), offerSnapshot: "{}", customerId: null, email: "vera@example.com", expiresAt: future });
    // Vennskap via invitasjonslenke → «Vera V. er nå vennen din» i den andres innboks.
    await (await webAs(v.session.token)).social.friends.acceptInvite({ token: (await (await webAs(other.session.token)).social.friends.createInviteLink()).token });
    expect(await countRows("customer_notifications", `customer_id = ${other.profile.id} AND title LIKE 'Vera%'`)).toBe(1);
    const tables = ["price_alerts", "booking_holds", "customer_notifications", "customer_friendships", "email_events"];
    const before = await Promise.all(tables.map((t) => rows(`SELECT * FROM ${t} ORDER BY id`)));

    await (await appCaller(v.session.token)).mobileAuth.deleteAccount({ password: PASSWORD });
    expect(await countRows("customer_accounts", `id = ${v.profile.id} AND deleted_at IS NOT NULL`)).toBe(1);
    expect(await Promise.all(tables.map((t) => rows(`SELECT * FROM ${t} ORDER BY id`)))).toEqual(before);
  });

  it("feil passord og død sesjon er to forskjellige svar over HTTP (details.field: password)", async () => {
    const a = await registerApp("tofeil@example.com");
    const call = (token: string) =>
      app.request("/api/mobile/trpc/mobileAuth.deleteAccount", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}`, "x-forwarded-for": "10.58.0.1" },
        body: JSON.stringify({ json: { password: "feil-passord-1" } }),
      });
    type ErrBody = { error: { json: { data: { appCode: string; details?: { field?: string } } } } };
    const wrong = await call(a.session.token);
    expect(wrong.status).toBe(401);
    expect(((await wrong.json()) as ErrBody).error.json.data).toMatchObject({ appCode: "UNAUTHORIZED", details: { field: "password" } });
    const dead = await call("x".repeat(43));
    expect(dead.status).toBe(401);
    const deadData = ((await dead.json()) as ErrBody).error.json.data;
    expect(deadData.appCode).toBe("UNAUTHORIZED");
    expect(deadData.details?.field).toBeUndefined();
    expect((await appCtx(a.session.token)).customer?.customerId).toBe(a.profile.id);
  });

  it("dobbelttrykk: to samtidige slettinger gir begge ok, men bare én sletting og én revisjonsrad", async () => {
    const a = await registerApp("dobbel@example.com");
    await seedOwn(a.profile.id, "dobbel@example.com");
    const [m1, m2] = [await appCaller(a.session.token), await appCaller(a.session.token)];
    const results = await Promise.allSettled([m1.mobileAuth.deleteAccount({ password: PASSWORD }), m2.mobileAuth.deleteAccount({ password: PASSWORD })]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(await countRows("audit_logs", `action='customer.account_deleted' AND target_id='${a.profile.id}'`)).toBe(1);
    expect(await countRows("customer_accounts", "deleted_at IS NOT NULL")).toBe(1);
    expect(await countRows("price_alerts", `customer_id = ${a.profile.id} AND active = 0 AND email = 'deleted'`)).toBe(1);
  });
});

// ─── 5. Samme kunde på nett og i app; ansatte slipper aldri inn ─────────────

describe("samme kundekonto på nett (cookie) og i appen (Bearer)", () => {
  beforeEach(fresh);
  afterAll(closeDb);

  it("registrert på nett → innlogget i appen: samme id og profil", async () => {
    const regCtx = makeCtx();
    const webProfile = await web(regCtx).customerAuth.register({ identifier: "nettforst@hellosky.test", password: PASSWORD, firstName: "Nett", lastName: "Først", locale: "en" });
    const webMe = await (await withCookie(regCtx.resHeaders)).caller.customerAuth.me();
    const login = await (await appCaller()).mobileAuth.login({ identifier: "nettforst@hellosky.test", password: PASSWORD });
    expect(login.profile.id).toBe(webProfile.id);
    expect(login.profile).toEqual(webMe);
    expect(await (await appCaller(login.session.token)).mobileAuth.me()).toEqual(webMe);
    expect(await countRows("customer_accounts")).toBe(1);
  });

  it("registrert i appen → innlogget på nett: samme id og profil", async () => {
    const reg = await registerApp("appforst@hellosky.test", { locale: "en" });
    // Profilen i registreringssvaret er den samme som me gir (også henvisningskoden).
    expect(reg.profile).toEqual(await (await appCaller(reg.session.token)).mobileAuth.me());
    const w = await webLogin("appforst@hellosky.test");
    const webMe = await w.caller.customerAuth.me();
    expect(webMe?.id).toBe(reg.profile.id);
    expect(webMe).toEqual(await (await appCaller(reg.session.token)).mobileAuth.me());
    expect(await countRows("customer_accounts")).toBe(1);
  });
});

describe("ansatte og staff-sesjoner avvises på hver eneste prosedyre i appens API", () => {
  beforeEach(async () => {
    await fresh();
    vi.mocked(verifySocialToken).mockReset();
  });
  afterAll(closeDb);

  it("hver prosedyre er dekket: staff-cookie og staff-token som Bearer gir aldri staff eller kunde", async () => {
    await seedStaffUsers();
    const staffLogin = makeCtx();
    await web(staffLogin).staffAuth.login({ email: "eier@hellosky.test", password: STAFF_PASSWORD });
    const { cookie } = await withCookie(staffLogin.resHeaders);
    const staffToken = cookie.split("hellosky_staff=")[1].split(";")[0];
    // En gammel kundekonto med en ansatts adresse og telefon – med sesjon fra før adressen ble ansatt.
    await getDb().insert(s.customerAccounts).values({ email: "admin+kunde@hellosky.test", phone: "+4790909090", passwordHash: await hashPassword(PASSWORD), firstName: "Før", lastName: "Ansatt" });
    const [legacy] = await rows<{ id: number }>("SELECT id FROM customer_accounts WHERE email = 'admin+kunde@hellosky.test'");
    const legacyToken = "l".repeat(43);
    await getDb().insert(s.customerSessions).values({ tokenHash: sha256Hex(legacyToken), customerId: legacy.id, expiresAt: new Date(Date.now() + 86_400_000) });

    /** Tre måter en ansatt kan prøve seg: staff-cookien, staff-tokenet som Bearer, og en kundesesjon på en ansatts adresse. */
    const contexts = async () => {
      const out = [];
      for (const headers of [{ cookie }, { authorization: `Bearer ${staffToken}` }, { authorization: `Bearer ${legacyToken}` }]) {
        const req = new Request("http://localhost:3000/api/mobile/trpc/x", { method: "POST", headers: { ...headers, "x-forwarded-for": `10.57.${++seq % 250}.1`, "user-agent": "vitest" } });
        const ctx = await createMobileContext({ req, resHeaders: new Headers(), info: {} as never });
        expect(ctx.staff).toBeNull();
        expect(ctx.customer).toBeNull();
        out.push(mobile(ctx));
      }
      return out;
    };

    const checks: Record<string, (m: ReturnType<typeof mobile>) => Promise<void>> = {
      ping: async (m) => expect(await m.ping()).toMatchObject({ ok: true }),
      "mobileAuth.register": (m) => expectAppCode(m.mobileAuth.register({ identifier: "eier+app@hellosky.test", password: PASSWORD, firstName: "X", lastName: "Y" }), "CONFLICT"),
      "mobileAuth.login": (m) => expectAppCode(m.mobileAuth.login({ identifier: "admin+kunde@hellosky.test", password: PASSWORD }), "UNAUTHORIZED"),
      "mobileAuth.requestLoginCode": async (m) => expect(await m.mobileAuth.requestLoginCode({ phone: "+4790909090" })).toEqual({ ok: true }),
      "mobileAuth.verifyLoginCode": (m) => expectAppCode(m.mobileAuth.verifyLoginCode({ phone: "+4790909090", code: "123456" }), "UNAUTHORIZED"),
      "mobileAuth.exchangeSocialToken": async (m) => {
        vi.mocked(verifySocialToken).mockResolvedValue({ subject: "user_staff", email: "EIER@hellosky.test", emailVerified: true, firstName: "Eier", lastName: null, social: "google" });
        await expectAppCode(m.mobileAuth.exchangeSocialToken({ token: "clerk-session-token-staff-xx" }), "FORBIDDEN");
      },
      "mobileAuth.me": async (m) => expect(await m.mobileAuth.me()).toBeNull(),
      // Offentlig og likt for alle: ingen staff-info, ingen hemmelig nøkkel.
      "mobileAuth.providers": async (m) => {
        const p = await m.mobileAuth.providers();
        expect(p.password).toBe(true);
        expect(p.social.map((s) => s.provider)).toEqual(["google", "apple"]);
        expect(JSON.stringify(p)).not.toMatch(/sk_(live|test)_|staff|admin/i);
      },
      "mobileAuth.logout": async (m) => expect(await m.mobileAuth.logout()).toEqual({ ok: true }),
      "mobileAuth.logoutAll": (m) => expectAppCode(m.mobileAuth.logoutAll(), "UNAUTHORIZED"),
      "mobileAuth.requestPasswordReset": async (m) => expect(await m.mobileAuth.requestPasswordReset({ identifier: "admin+kunde@hellosky.test" })).toEqual({ ok: true }),
      "mobileAuth.updateProfile": (m) => expectAppCode(m.mobileAuth.updateProfile({ firstName: "Hack", lastName: "Er" }), "UNAUTHORIZED"),
      "mobileAuth.requestPhoneChange": (m) => expectAppCode(m.mobileAuth.requestPhoneChange({ phone: "+4790909091", password: PASSWORD }), "UNAUTHORIZED"),
      "mobileAuth.confirmPhoneChange": (m) => expectAppCode(m.mobileAuth.confirmPhoneChange({ phone: "+4790909091", code: "123456" }), "UNAUTHORIZED"),
      "mobileAuth.deleteAccount": (m) => expectAppCode(m.mobileAuth.deleteAccount({ password: PASSWORD }), "UNAUTHORIZED"),
      "flights.airports": async (m) => expect(Array.isArray(await m.flights.airports({ query: "OSL" }))).toBe(true),
      "flights.search": async (m) => expect((await m.flights.search({ slices: [{ origin: "OSL", destination: "BGO", departureDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10) }], passengers: [{ type: "adult" }], cabinClass: "economy" })).offers.length).toBeGreaterThan(0),
      "flights.trackProviderClick": async (m) => expect(await m.flights.trackProviderClick({ offerId: "finnes-ikke" })).toEqual({ clickRef: null }),
      // Hotellsøk er avslått i testmiljøet: status sier det, stedsøk er tomt, søk og detaljer avvises – for alle.
      "hotels.status": async (m) => expect(await m.hotels.status()).toMatchObject({ enabled: false, externalBooking: true }),
      "hotels.places": async (m) => expect(await m.hotels.places({ query: "Oslo" })).toEqual([]),
      "hotels.search": (m) => expectAppCode(m.hotels.search({ destination: "kplace:58075", checkin: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), checkout: new Date(Date.now() + 32 * 86_400_000).toISOString().slice(0, 10), rooms: [{ adults: 2 }] }), "SUPPLIER_REJECTED"),
      "hotels.detail": (m) => expectAppCode(m.hotels.detail({ hotelKey: "khotel:2589314", checkin: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), checkout: new Date(Date.now() + 32 * 86_400_000).toISOString().slice(0, 10), rooms: [{ adults: 2 }] }), "SUPPLIER_REJECTED"),
    };
    // Legges det til en prosedyre i appens API, må den få en staff-sjekk her.
    expect(Object.keys(mobileAppRouter._def.procedures).sort()).toEqual(Object.keys(checks).sort());

    for (const [path, check] of Object.entries(checks)) {
      for (const m of await contexts()) {
        try {
          await check(m);
        } catch (err) {
          throw new Error(`${path}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    // Ingen kundesesjon, tilbakestillingslenke, SMS-kode eller identitet ble laget for en ansatt.
    expect(await countRows("customer_sessions")).toBe(1); // bare den gamle, som ikke virker
    expect(await countRows("customer_password_resets")).toBe(0);
    expect(await countRows("customer_otp_codes")).toBe(0);
    expect(await countRows("customer_identities")).toBe(0);
    expect(await countRows("customer_accounts")).toBe(1);
    expect(await countRows("customer_accounts", "deleted_at IS NOT NULL")).toBe(0);
    expect(await countRows("provider_clicks")).toBe(0);

    // Over HTTP: kontoprosedyrene med staff-cookien → 401, ikke 404 og aldri 200.
    for (const path of ["mobileAuth.updateProfile", "mobileAuth.requestPhoneChange", "mobileAuth.deleteAccount", "mobileAuth.logoutAll"]) {
      const res = await app.request(`/api/mobile/trpc/${path}`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ json: { firstName: "A", lastName: "B", phone: "+4790909091", password: PASSWORD } }) });
      expect(res.status, path).toBe(401);
    }
  });
});
