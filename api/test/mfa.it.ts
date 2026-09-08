import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, expectAppCode, getDb, makeCtx, truncateAll, withCookie, callerFor } from "./setup";
import { staffUsers } from "../../db/schema";
import { hashPassword } from "../lib/passwords";
import { currentTotp, newTotpSecret } from "../lib/totp";

/**
 * Totrinn var skrevet ferdig i api/lib/totp.ts og kalt fra ingenting, mens
 * bootstrap-skriptet fortalte eierne at aktivering krevde autentikator-app.
 * Disse testene finnes for at det aldri skal kunne bli sant igjen at porten
 * står åpen mens grensesnittet sier den er lukket.
 */

const PASSWORD = "adminpassord-2026";

async function seedOwner(over: { mfaEnabled?: boolean; totpSecret?: string | null } = {}) {
  const res = await getDb()
    .insert(staffUsers)
    .values({
      email: "eier@hellosky.test",
      name: "Zyar",
      role: "OWNER",
      status: "active",
      passwordHash: await hashPassword(PASSWORD),
      mfaEnabled: over.mfaEnabled ?? false,
      totpSecret: over.totpSecret ?? null,
    });
  return Number(res[0].insertId);
}

describe("staff: totrinn", () => {
  beforeEach(truncateAll);
  afterAll(closeDb);

  it("uten totrinn logger man inn som før", async () => {
    await seedOwner();
    const ctx = makeCtx();
    const res = await callerFor(ctx).staffAuth.login({ email: "eier@hellosky.test", password: PASSWORD });
    expect(res.mfaRequired).toBe(false);
    const { caller: c } = await withCookie(ctx.resHeaders);
    expect((await c.staffAuth.myPermissions()).permissions.length).toBeGreaterThan(0);
  });

  it("med totrinn bærer sesjonen ingen rettigheter før koden er bekreftet", async () => {
    const secret = newTotpSecret();
    await seedOwner({ mfaEnabled: true, totpSecret: secret });
    const ctx = makeCtx();
    const res = await callerFor(ctx).staffAuth.login({ email: "eier@hellosky.test", password: PASSWORD });
    expect(res.mfaRequired).toBe(true);

    const { caller: c } = await withCookie(ctx.resHeaders);
    // Passordet alene åpner ingenting.
    await expectAppCode(c.staffAuth.myPermissions(), "FORBIDDEN");
    await expectAppCode(c.admin.dashboard(), "FORBIDDEN");

    // Feil kode slipper ingen inn.
    await expectAppCode(c.staffAuth.verifyMfa({ code: "000000" }), "UNAUTHORIZED");

    // Riktig kode åpner sesjonen.
    const ok = await c.staffAuth.verifyMfa({ code: await currentTotp(secret) });
    expect(ok).toMatchObject({ ok: true, usedRecoveryCode: false });

    // Neste forespørsel løser sesjonen på nytt – slik en ekte klient gjør.
    const { caller: after } = await withCookie(ctx.resHeaders);
    expect((await after.staffAuth.myPermissions()).permissions.length).toBeGreaterThan(0);
  });

  it("oppsettet slår ikke på noe før koden stemmer, og kodene vises én gang", async () => {
    const id = await seedOwner();
    const ctx = makeCtx();
    await callerFor(ctx).staffAuth.login({ email: "eier@hellosky.test", password: PASSWORD });
    const { caller: c } = await withCookie(ctx.resHeaders);

    const setup = await c.staffAuth.startMfaSetup();
    expect(setup.uri).toContain("otpauth://");
    let [row] = await getDb().select().from(staffUsers).where(eq(staffUsers.id, id));
    expect(row.mfaEnabled, "hemmeligheten er lagret, men ingenting er slått på").toBe(false);

    await expectAppCode(c.staffAuth.confirmMfaSetup({ code: "000000" }), "UNAUTHORIZED");
    [row] = await getDb().select().from(staffUsers).where(eq(staffUsers.id, id));
    expect(row.mfaEnabled).toBe(false);

    const done = await c.staffAuth.confirmMfaSetup({ code: await currentTotp(setup.secret) });
    expect(done.recoveryCodes).toHaveLength(8);
    [row] = await getDb().select().from(staffUsers).where(eq(staffUsers.id, id));
    expect(row.mfaEnabled).toBe(true);
    // Bare hasher lagres: klartekstkoden finnes ikke i databasen.
    expect(row.recoveryCodesJson).not.toContain(done.recoveryCodes[0]);
  });

  it("en gjenopprettingskode virker én gang", async () => {
    await seedOwner();
    const ctx = makeCtx();
    await callerFor(ctx).staffAuth.login({ email: "eier@hellosky.test", password: PASSWORD });
    const { caller: c } = await withCookie(ctx.resHeaders);
    const setup = await c.staffAuth.startMfaSetup();
    const { recoveryCodes } = await c.staffAuth.confirmMfaSetup({ code: await currentTotp(setup.secret) });

    // Ny innlogging: nå kreves kode.
    const ctx2 = makeCtx();
    const res = await callerFor(ctx2).staffAuth.login({ email: "eier@hellosky.test", password: PASSWORD });
    expect(res.mfaRequired).toBe(true);
    const { caller: c2 } = await withCookie(ctx2.resHeaders);
    const used = await c2.staffAuth.verifyMfa({ code: recoveryCodes[0] });
    expect(used).toMatchObject({ ok: true, usedRecoveryCode: true, remaining: 7 });

    // Samme kode andre gang: nei.
    const ctx3 = makeCtx();
    await callerFor(ctx3).staffAuth.login({ email: "eier@hellosky.test", password: PASSWORD });
    const { caller: c3 } = await withCookie(ctx3.resHeaders);
    await expectAppCode(c3.staffAuth.verifyMfa({ code: recoveryCodes[0] }), "UNAUTHORIZED");
  });
});
