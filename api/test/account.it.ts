import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { appRouter } from "../router";
import { createCallerFactory } from "../middleware";
import { caller, closeDb, countRows, expectAppCode, getDb, makeCtx, truncateAll } from "./setup";
import { customerAccounts, priceWatches } from "../../db/schema";
import { checkPriceWatches } from "../watch";
import { recordReward } from "../lib/rewards";

const factory = createCallerFactory(appRouter);

/** Registrer en kunde og gi tilbake en caller med sesjonen hennes. */
async function customerCaller(email: string) {
  const ctx = makeCtx();
  await factory(ctx).customerAuth.register({ identifier: email, password: "kundepassord-2026", firstName: "Kari", lastName: "Nordmann" });
  const cookie = ctx.resHeaders.get("set-cookie")!.split(";")[0];
  const sctx = makeCtx({ headers: { cookie } });
  const { resolveCustomerSession } = await import("../lib/customerSessions");
  sctx.customer = await resolveCustomerSession(sctx.req);
  return { ctx: sctx, caller: factory(sctx) };
}

describe("konto: reiseidentitet", () => {
  beforeEach(async () => {
    await truncateAll();
  });
  afterAll(async () => {
    await closeDb();
  });

  it("gjester slipper ikke inn; profilen er tom til kunden lagrer noe", async () => {
    await expect(caller().account.travelProfile()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const { caller: c } = await customerCaller("kari@hellosky.test");
    const empty = await c.account.travelProfile();
    expect(empty).toMatchObject({ homeAirports: [], completeness: 0, onboardingCompletedAt: null });
    expect(await countRows("customer_travel_profiles")).toBe(0);
  });

  it("lagrer preferanser, avviser ukjent flyplass, og regner fullstendighet", async () => {
    const { caller: c } = await customerCaller("kari@hellosky.test");
    await expectAppCode(c.account.updateTravelProfile({ homeAirports: ["ZZZ"] }), "VALIDATION");
    const p = await c.account.updateTravelProfile({
      homeAirports: ["OSL", "TRF"],
      favouriteDestinations: ["erbil", "istanbul"],
      preferredCabin: "economy",
      baggagePreference: "30kg",
      companions: "family",
      flightPrefs: { maxOneStop: true, avoidSelfTransfer: true },
      seatPreference: "together",
      taste: { family: 90, food: 70, beach: 40 },
    });
    expect(p.homeAirports).toEqual(["OSL", "TRF"]);
    expect(p.completeness).toBe(100);
    await c.account.finishOnboarding({});
    expect((await c.account.travelProfile()).onboardingCompletedAt).not.toBeNull();
  });

  it("lagret innhold er per konto, flettes fra nettleseren og fjernes igjen", async () => {
    const { caller: a } = await customerCaller("a@hellosky.test");
    const { caller: b } = await customerCaller("b@hellosky.test");
    await a.account.save({ kind: "destination", refId: "erbil" });
    await a.account.save({ kind: "destination", refId: "erbil" }); // idempotent
    expect(await a.account.syncSaved({ destinations: ["erbil", "dubai"] })).toEqual({ added: 1 });
    expect((await a.account.saved({ kind: "destination" })).map((s) => s.refId).sort()).toEqual(["dubai", "erbil"]);
    expect(await b.account.saved()).toEqual([]);
    await a.account.unsave({ kind: "destination", refId: "erbil" });
    expect((await a.account.saved()).map((s) => s.refId)).toEqual(["dubai"]);
  });

  it("søkehistorikk dedupliseres og navet oppsummerer uten å finne på tall", async () => {
    const { caller: c } = await customerCaller("kari@hellosky.test");
    const search = { origin: "OSL", destination: "EBL", departDate: "2027-03-01", adults: 2, children: 1, infants: 0, cabin: "economy" as const };
    await c.account.recordSearch(search);
    await c.account.recordSearch(search);
    await c.account.recordSearch({ ...search, destination: "IST" });
    const history = await c.account.searchHistory();
    expect(history).toHaveLength(2);
    expect(history[0].destinationCity).toBe("Istanbul");

    const hub = await c.account.hub();
    expect(hub.nextTrip).toBeNull();
    expect(hub.savedCount).toBe(0);
    expect(hub.routes.map((r) => r.destinationIata)).toEqual(["EBL", "IST"]);
    expect(hub.rewards.tier.id).toBe("explorer");
  });

  it("bonus: reskontroen er idempotent per referanse og saldoen følger med", async () => {
    const { ctx, caller: c } = await customerCaller("kari@hellosky.test");
    const id = ctx.customer!.customerId;
    expect(await recordReward({ customerId: id, kind: "booking", amountKr: 42, refType: "booking", refId: 7 })).toBe(true);
    expect(await recordReward({ customerId: id, kind: "booking", amountKr: 42, refType: "booking", refId: 7 })).toBe(false);
    const [acc] = await getDb().select({ bonusKr: customerAccounts.bonusKr }).from(customerAccounts).where(eq(customerAccounts.id, id));
    expect(acc.bonusKr).toBe(42);
    const rewards = await c.account.rewards();
    expect(rewards.balanceKr).toBe(42);
    expect(rewards.history).toHaveLength(1);
    expect(rewards.memberNumber).toMatch(/^HS-\d{6}$/);
  });

  it("henvisning: dashbordet teller bare ekte kontoer", async () => {
    const { caller: a } = await customerCaller("a@hellosky.test");
    const ref = await a.account.referral();
    expect(ref.code).toMatch(/^[A-Z2-9]{8}$/);
    expect(ref).toMatchObject({ shares: 0, signedUp: 0, qualified: 0, earnedKr: 0 });
    await a.account.referralShared();
    await caller().customerAuth.register({ identifier: "venn@hellosky.test", password: "kundepassord-2026", firstName: "Ola", lastName: "Venn", referralCode: ref.code! });
    const after = await a.account.referral();
    expect(after).toMatchObject({ shares: 1, signedUp: 1, qualified: 0 });
  });

  it("prisovervåking: opprettes, sjekkes mot demo, og varsler aldri på testdata", async () => {
    const { ctx, caller: c } = await customerCaller("kari@hellosky.test");
    const from = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 70 * 86_400_000).toISOString().slice(0, 10);
    await expectAppCode(c.watch.create({ origin: "OSL", destination: "OSL", dateFrom: from, dateTo: to, maxPriceMinor: 500_000 }), "VALIDATION");
    const { id } = await c.watch.create({ origin: "OSL", destination: "EBL", dateFrom: from, dateTo: to, maxPriceMinor: 9_000_000, weekendsOnly: true, maxStops: 2, cadence: "immediate" });
    const list = await c.watch.list();
    expect(list[0]).toMatchObject({ id, destinationCity: "Erbil", active: true, lastCheckedAt: null });

    const r = await checkPriceWatches();
    expect(r.checked).toBe(1);
    const [row] = await getDb().select().from(priceWatches).where(eq(priceWatches.id, id));
    expect(row.lastCheckedAt).not.toBeNull();
    // Demo-modus → treff kan finnes, men er merket live=false og gir verken varsel eller e-post.
    expect(row.lastNotifiedAt).toBeNull();
    expect(await countRows("customer_notifications")).toBe(0);
    expect(await countRows("email_events", "kind='price_alert'")).toBe(0);

    await c.watch.update({ id, active: false });
    expect((await c.watch.list())[0].active).toBe(false);
    await c.watch.remove({ id });
    expect(await c.watch.list()).toEqual([]);
    expect(ctx.customer!.customerId).toBeGreaterThan(0);
  });
});
