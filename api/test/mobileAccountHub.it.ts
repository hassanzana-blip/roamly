import { afterAll, beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import type { z } from "zod";
import { sql } from "drizzle-orm";
import { closeDb, countRows, expectAppCode, makeCtx, rows, truncateAll } from "./setup";
import { createCallerFactory } from "../middleware";
import { mobileAppRouter } from "../mobileRouter";
import { kindFromBornOn, MAX_TRAVELLERS, mobileSaveItemInput, mobileSaveTravellerInput, mobileUnsaveItemInput } from "../mobileAccount";
import { resolveCustomerSession } from "../lib/customerSessions";
import { getDb } from "../queries/connection";
import * as s from "../../db/schema";
import type { MobileSaveItemInput, MobileSaveTravellerInput, MobileUnsaveItemInput } from "../../contracts/mobileAccount";
import app from "../boot";

// ─── Min side og Lagret i appen (mobileAccount.*): kontoens egne data, samme tabeller som nettet ──────────────

const mobile = createCallerFactory(mobileAppRouter);
const PASSWORD = "kundepassord-2026";

async function appCtx(token?: string) {
  const ctx = makeCtx({ headers: token ? { authorization: `Bearer ${token}` } : {}, url: "http://localhost:3000/api/mobile/trpc/test" });
  ctx.req.headers.delete("origin");
  ctx.customer = await resolveCustomerSession(ctx.req);
  return ctx;
}
const as = async (token?: string) => mobile(await appCtx(token));

let seq = 0;
/** En ny kunde registrert i appen; token og id. */
async function customer(first = "Kari") {
  const res = await (await as()).mobileAuth.register({ identifier: `kunde${++seq}@hellosky.test`, password: PASSWORD, firstName: first, lastName: "Nordmann" });
  const [row] = await rows<{ id: number }>(`SELECT id FROM customer_accounts WHERE email = 'kunde${seq}@hellosky.test'`);
  return { token: res.session.token, id: row!.id };
}

const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

/** En bestilling på kontoen, med ordren slik bestillingsflyten lagrer den (bare feltene «Mine reiser» leser). */
async function booking(customerAccountId: number, ref: string, departingAt: string, opts: { cancelled?: boolean; returnAt?: string } = {}) {
  const slice = (from: string, fromCity: string, to: string, toCity: string, at: string) => ({ origin: { iata: from, city: fromCity }, destination: { iata: to, city: toCity }, departingAt: at });
  const slices = [slice("OSL", "Oslo", "BCN", "Barcelona", departingAt), ...(opts.returnAt ? [slice("BCN", "Barcelona", "OSL", "Oslo", opts.returnAt)] : [])];
  await getDb()
    .insert(s.bookings)
    .values({ orderId: `ord_${ref}`, bookingReference: ref, contactEmail: "kari@hellosky.test", payload: JSON.stringify({ slices, passengers: [{}, {}] }), customerAccountId, cancelledAt: opts.cancelled ? new Date() : null });
}

beforeEach(async () => {
  await truncateAll();
});
afterAll(async () => {
  await closeDb();
});

describe("mobileAccount: kontraktene", () => {
  it("serverens inndata passer appens typer (contracts/mobileAccount.ts)", () => {
    expectTypeOf<MobileSaveTravellerInput>().toExtend<z.input<typeof mobileSaveTravellerInput>>();
    expectTypeOf<MobileSaveItemInput>().toExtend<z.input<typeof mobileSaveItemInput>>();
    expectTypeOf<MobileUnsaveItemInput>().toExtend<z.input<typeof mobileUnsaveItemInput>>();
  });

  it("uten innlogging: UNAUTHORIZED, også over HTTP", async () => {
    const m = await as();
    await expectAppCode(m.mobileAccount.hub(), "UNAUTHORIZED");
    await expectAppCode(m.mobileAccount.travellers(), "UNAUTHORIZED");
    await expectAppCode(m.mobileAccount.saved(), "UNAUTHORIZED");
    const res = await app.request("/api/mobile/trpc/mobileAccount.hub");
    expect(res.status).toBe(401);
  });
});

describe("mobileAccount.hub", () => {
  it("en ny konto: ingen reise, bare nuller – aldri anslag eller bonusnivå", async () => {
    const { token } = await customer();
    const hub = await (await as(token)).mobileAccount.hub();
    expect(hub).toEqual({ nextTrip: null, upcomingTrips: 0, saved: { destinations: 0, flights: 0, routes: 0 }, travellers: 0, priceWatches: 0, unreadNotifications: 0 });
    expect(JSON.stringify(hub)).not.toMatch(/reward|tier|bonus/i);
  });

  it("nærmeste kommende bestilling; kansellerte, passerte og andres bestillinger teller ikke", async () => {
    const kari = await customer();
    const ola = await customer("Ola");
    const out = days(10);
    const back = days(17);
    await booking(kari.id, "LATER1", days(40));
    await booking(kari.id, "NEXT01", out, { returnAt: back });
    await booking(kari.id, "CANCEL", days(5), { cancelled: true });
    await booking(kari.id, "PAST01", days(-3));
    await booking(ola.id, "OLA001", days(2));
    const hub = await (await as(kari.token)).mobileAccount.hub();
    expect(hub.upcomingTrips).toBe(2);
    expect(hub.nextTrip).toEqual({ bookingReference: "NEXT01", originIata: "OSL", originCity: "Oslo", destinationIata: "BCN", destinationCity: "Barcelona", departingAt: out, returningAt: back, passengerCount: 2 });
  });

  it("tallene er kontoens egne rader: lagret per type, reisende, aktive prisvarsler, uleste varsler", async () => {
    const kari = await customer();
    const ola = await customer("Ola");
    const m = await as(kari.token);
    await m.mobileAccount.save({ kind: "destination", refId: "barcelona" });
    await m.mobileAccount.save({ kind: "flight", refId: "SK1:OSL>BCN" });
    await m.mobileAccount.save({ kind: "route", refId: "OSL-BCN" });
    await m.mobileAccount.save({ kind: "route", refId: "OSL-LHR" });
    // En artikkel lagret på nettet er ikke noe appen viser.
    await getDb().insert(s.savedItems).values({ customerId: kari.id, kind: "article", refId: "tips" });
    await m.mobileAccount.saveTraveller({ firstName: "Per", lastName: "Nordmann", kind: "child", cabin: null });
    const watch = { originIata: "OSL", destinationIata: "BCN", dateFrom: "2027-01-01", dateTo: "2027-01-31", maxPriceMinor: 200_000 };
    await getDb().insert(s.priceWatches).values([
      { customerId: kari.id, ...watch },
      { customerId: kari.id, ...watch, active: false },
      { customerId: ola.id, ...watch },
    ]);
    await getDb().insert(s.customerNotifications).values([
      { customerId: kari.id, type: "system", title: "Hei" },
      { customerId: kari.id, type: "system", title: "Lest", readAt: new Date() },
    ]);
    const hub = await m.mobileAccount.hub();
    expect(hub.saved).toEqual({ destinations: 1, flights: 1, routes: 2 });
    expect(hub.travellers).toBe(1);
    expect(hub.priceWatches).toBe(1);
    expect(hub.unreadNotifications).toBe(1);
  });
});

describe("mobileAccount: lagrede reisende", () => {
  it("legg til, endre og fjern – bare navn, type og klasse", async () => {
    const { token } = await customer();
    const m = await as(token);
    const per = await m.mobileAccount.saveTraveller({ firstName: " Per ", lastName: "Nordmann", kind: "child", cabin: "economy" });
    expect(per).toMatchObject({ firstName: "Per", lastName: "Nordmann", kind: "child", cabin: "economy" });
    const changed = await m.mobileAccount.saveTraveller({ id: per.id, firstName: "Per Olav", lastName: "Nordmann", kind: "adult", cabin: null });
    expect(changed).toEqual({ id: per.id, firstName: "Per Olav", lastName: "Nordmann", kind: "adult", cabin: null });
    expect(await m.mobileAccount.travellers()).toEqual([changed]);
    expect(await m.mobileAccount.removeTraveller({ id: per.id })).toEqual({ ok: true });
    expect(await m.mobileAccount.travellers()).toEqual([]);
  });

  it("aldri pass, ID eller personnummer: ukjente felt avvises ikke, men lagres aldri; fødselsdato sendes aldri ut", async () => {
    const kari = await customer();
    const m = await as(kari.token);
    await m.mobileAccount.saveTraveller({ firstName: "Per", lastName: "Nordmann", kind: "adult", cabin: null, passportNumber: "N1234567", nationalId: "01019012345" } as MobileSaveTravellerInput);
    const [row] = await rows<Record<string, unknown>>("SELECT * FROM saved_travelers");
    expect(JSON.stringify(row)).not.toMatch(/N1234567|01019012345/);
    // En reisende fra nettet med fødselsdato: typen regnes ut, datoen og kjønnet sendes aldri til appen.
    const born = new Date(Date.now() - 5 * 365 * 86_400_000).toISOString().slice(0, 10);
    await getDb().insert(s.savedTravelers).values({ customerId: kari.id, firstName: "Liv", lastName: "Nordmann", bornOn: born, gender: "f" });
    const list = await m.mobileAccount.travellers();
    const liv = list.find((t) => t.firstName === "Liv")!;
    expect(liv.kind).toBe("child");
    expect(Object.keys(liv).sort()).toEqual(["cabin", "firstName", "id", "kind", "lastName"]);
    expect(JSON.stringify(list)).not.toContain(born);
    // Endret i appen: nettets fødselsdato og kjønn står urørt.
    await m.mobileAccount.saveTraveller({ id: liv.id, firstName: "Liv", lastName: "Hansen", kind: "child", cabin: null });
    const [after] = await rows<{ born_on: string; gender: string; last_name: string }>(`SELECT born_on, gender, last_name FROM saved_travelers WHERE id = ${liv.id}`);
    expect(after).toEqual({ born_on: born, gender: "f", last_name: "Hansen" });
  });

  it("en annens reisende kan verken endres eller fjernes (NOT_FOUND)", async () => {
    const kari = await customer();
    const ola = await customer("Ola");
    const per = await (await as(kari.token)).mobileAccount.saveTraveller({ firstName: "Per", lastName: "Nordmann", kind: "adult", cabin: null });
    const m = await as(ola.token);
    await expectAppCode(m.mobileAccount.saveTraveller({ id: per.id, firstName: "Hack", lastName: "Er", kind: "adult", cabin: null }), "NOT_FOUND");
    await expectAppCode(m.mobileAccount.removeTraveller({ id: per.id }), "NOT_FOUND");
    expect(await m.mobileAccount.travellers()).toEqual([]);
    expect(await countRows("saved_travelers", "first_name = 'Per'")).toBe(1);
  });

  it("navn uten bokstaver avvises med feltet; grensen er nettets 20", async () => {
    const { token } = await customer();
    const m = await as(token);
    await expect(m.mobileAccount.saveTraveller({ firstName: "   ", lastName: "Nordmann", kind: "adult", cabin: null })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    for (let i = 0; i < MAX_TRAVELLERS; i++) await m.mobileAccount.saveTraveller({ firstName: `Per`, lastName: `Nordmann`, kind: "adult", cabin: null });
    await expectAppCode(m.mobileAccount.saveTraveller({ firstName: "En", lastName: "Til", kind: "adult", cabin: null }), "VALIDATION");
  });

  it("typen fra fødselsdato: under 2 spedbarn, under 12 barn, ellers voksen; ugyldig gir null", () => {
    const today = new Date("2026-09-26T12:00:00Z");
    expect(kindFromBornOn("2025-01-01", today)).toBe("infant");
    expect(kindFromBornOn("2024-09-26", today)).toBe("child");
    expect(kindFromBornOn("2014-09-27", today)).toBe("child");
    expect(kindFromBornOn("2014-09-26", today)).toBe("adult");
    expect(kindFromBornOn(null, today)).toBeNull();
    expect(kindFromBornOn("26.09.2014", today)).toBeNull();
  });

  it("slettet konto: de reisende slettes (nettets regel)", async () => {
    const kari = await customer();
    await (await as(kari.token)).mobileAccount.saveTraveller({ firstName: "Per", lastName: "Nordmann", kind: "adult", cabin: null });
    await (await as(kari.token)).mobileAuth.deleteAccount({ password: PASSWORD });
    expect(await countRows("saved_travelers")).toBe(0);
  });
});

describe("mobileAccount: lagret", () => {
  it("lagre er idempotent og oppdaterer bildet; nyeste først; fjern", async () => {
    const { token } = await customer();
    const m = await as(token);
    await m.mobileAccount.save({ kind: "route", refId: "OSL-BCN", payload: { origin: { iata: "OSL" } } });
    await getDb().execute(sql`UPDATE saved_items SET created_at = created_at - INTERVAL 1 MINUTE`);
    await m.mobileAccount.save({ kind: "flight", refId: "SK1:OSL>BCN", payload: { key: "SK1:OSL>BCN", seenPrice: { amountMinor: 123400, estimate: false } } });
    await m.mobileAccount.save({ kind: "route", refId: "OSL-BCN", payload: { origin: { iata: "OSL" }, v: 2 } });
    const all = await m.mobileAccount.saved();
    expect(all.map((i) => `${i.kind}:${i.refId}`)).toEqual(["flight:SK1:OSL>BCN", "route:OSL-BCN"]);
    expect(all[1]!.payload).toEqual({ origin: { iata: "OSL" }, v: 2 });
    expect(await m.mobileAccount.saved({ kind: "route" })).toHaveLength(1);
    expect(await m.mobileAccount.unsave({ kind: "route", refId: "OSL-BCN" })).toEqual({ ok: true });
    expect(await m.mobileAccount.unsave({ kind: "route", refId: "OSL-BCN" })).toEqual({ ok: true });
    expect(await m.mobileAccount.saved({ kind: "route" })).toEqual([]);
  });

  it("nettets artikler og reiseideer vises ikke i appen; en annen kundes lagrede heller ikke", async () => {
    const kari = await customer();
    const ola = await customer("Ola");
    await getDb().insert(s.savedItems).values({ customerId: kari.id, kind: "article", refId: "tips" });
    await (await as(ola.token)).mobileAccount.save({ kind: "route", refId: "BGO-TOS" });
    expect(await (await as(kari.token)).mobileAccount.saved()).toEqual([]);
  });

  it("et for stort bilde avvises i stedet for å kuttes midt i JSON-en", async () => {
    const { token } = await customer();
    const m = await as(token);
    await expect(m.mobileAccount.save({ kind: "flight", refId: "x", payload: { big: "x".repeat(9000) } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await countRows("saved_items")).toBe(0);
  });
});
