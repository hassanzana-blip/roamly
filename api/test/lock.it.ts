import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { closeDb, expectAppCode, getDb, makeCtx, truncateAll, withCookie, callerFor } from "./setup";
import { staffSessions, staffUsers } from "../../db/schema";
import { hashPassword } from "../lib/passwords";
import { LOCK_MS } from "../lib/sessions";

/**
 * Skjermlåsen.
 *
 * Poenget med disse testene er å bevise at låsen ligger på serveren. Et
 * overlegg i grensesnittet ser like låst ut, men koster ingenting å gå
 * utenom – og denne konsollen holder passdata og refusjoner.
 */

const PASSWORD = "adminpassord-2026";

async function seedOwner() {
  const res = await getDb().insert(staffUsers).values({
    email: "eier@hellosky.test",
    name: "Zyar",
    role: "OWNER",
    status: "active",
    passwordHash: await hashPassword(PASSWORD),
  });
  return Number(res[0].insertId);
}

async function loginAs() {
  await seedOwner();
  const ctx = makeCtx();
  await callerFor(ctx).staffAuth.login({ email: "eier@hellosky.test", password: PASSWORD });
  return ctx;
}

/** Skru klokka tilbake på sesjonen, slik en skjerm som har stått urørt ser ut. */
async function idleFor(ms: number) {
  await getDb()
    .update(staffSessions)
    .set({ lastSeenAt: new Date(Date.now() - ms) })
    .where(isNull(staffSessions.revokedAt));
}

describe("staff: skjermlås", () => {
  beforeEach(truncateAll);
  afterAll(closeDb);

  it("låser seg selv når skjermen har stått urørt", async () => {
    const ctx = await loginAs();
    await idleFor(LOCK_MS + 60_000);

    const { caller } = await withCookie(ctx.resHeaders);
    await expectAppCode(caller.staffAuth.myPermissions(), "FORBIDDEN");
    await expectAppCode(caller.admin.dashboard(), "FORBIDDEN");

    // Låsen er skrevet ned, ikke bare regnet ut i farten.
    const [row] = await getDb().select().from(staffSessions).where(isNull(staffSessions.revokedAt)).limit(1);
    expect(row?.lockedAt).not.toBeNull();
  });

  it("sier fra at det er låsen, ikke noe annet, som stopper deg", async () => {
    const ctx = await loginAs();
    await idleFor(LOCK_MS + 60_000);
    const { caller } = await withCookie(ctx.resHeaders);

    // `me` svarer fortsatt – grensesnittet må kunne vite hvem som skal låse opp.
    const me = await caller.staffAuth.me();
    expect(me).toMatchObject({ authenticated: true, locked: true, name: "Zyar" });
  });

  it("feil passord låser ikke opp", async () => {
    const ctx = await loginAs();
    await idleFor(LOCK_MS + 60_000);
    const { caller } = await withCookie(ctx.resHeaders);

    await expectAppCode(caller.staffAuth.unlockScreen({ password: "noe-helt-annet" }), "UNAUTHORIZED");

    const { caller: again } = await withCookie(ctx.resHeaders);
    await expectAppCode(again.staffAuth.myPermissions(), "FORBIDDEN");
  });

  it("riktig passord gir sesjonen tilbake, uten ny innlogging", async () => {
    const ctx = await loginAs();
    await idleFor(LOCK_MS + 60_000);

    const { caller } = await withCookie(ctx.resHeaders);
    expect(await caller.staffAuth.unlockScreen({ password: PASSWORD })).toEqual({ ok: true });

    const { caller: after } = await withCookie(ctx.resHeaders);
    expect((await after.staffAuth.myPermissions()).permissions.length).toBeGreaterThan(0);
  });

  it("kan låses med vilje, før tiden har gått", async () => {
    const ctx = await loginAs();
    const { caller } = await withCookie(ctx.resHeaders);
    expect(await caller.staffAuth.lockScreen()).toEqual({ ok: true });

    const { caller: after } = await withCookie(ctx.resHeaders);
    await expectAppCode(after.staffAuth.myPermissions(), "FORBIDDEN");
  });

  it("viser dine egne sesjoner, og lar deg logge ut de andre", async () => {
    const userId = await seedOwner();

    // Tre innlogginger: én du sitter i, to andre steder.
    const mine = makeCtx();
    await callerFor(mine).staffAuth.login({ email: "eier@hellosky.test", password: PASSWORD });
    for (let i = 0; i < 2; i++) {
      const other = makeCtx();
      await callerFor(other).staffAuth.login({ email: "eier@hellosky.test", password: PASSWORD });
    }

    const { caller } = await withCookie(mine.resHeaders);
    const before = await caller.staffAuth.mySessions();
    expect(before).toHaveLength(3);
    expect(before.filter((s) => s.current)).toHaveLength(1);

    await caller.staffAuth.signOutOtherSessions();

    const { caller: after } = await withCookie(mine.resHeaders);
    const left = await after.staffAuth.mySessions();
    expect(left).toHaveLength(1);
    expect(left[0].current).toBe(true);

    const live = await getDb()
      .select()
      .from(staffSessions)
      .where(and(eq(staffSessions.userId, userId), isNull(staffSessions.revokedAt)));
    expect(live).toHaveLength(1);
  });
});
