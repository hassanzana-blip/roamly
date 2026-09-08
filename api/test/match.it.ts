import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../router";
import { createCallerFactory } from "../middleware";
import { caller, closeDb, countRows, expectAppCode, makeCtx, truncateAll } from "./setup";
import { SHARE_KEY_BYTES, SHARE_TOKEN_BYTES, SHARE_TOKEN_RE } from "../../contracts/shareTokens";

/** Riktig format, ukjent verdi — det er tilgangen som skal avvises, ikke formen. */
const WRONG_KEY = "0".repeat(Math.ceil((SHARE_KEY_BYTES * 4) / 3));
const WRONG_TOKEN = "f".repeat(Math.ceil((SHARE_TOKEN_BYTES * 4) / 3));

const factory = createCallerFactory(appRouter);

async function customerCaller(email: string) {
  const ctx = makeCtx();
  await factory(ctx).customerAuth.register({ identifier: email, password: "kundepassord-2026", firstName: "Kari", lastName: "Nordmann" });
  const cookie = ctx.resHeaders.get("set-cookie")!.split(";")[0];
  const sctx = makeCtx({ headers: { cookie } });
  const { resolveCustomerSession } = await import("../lib/customerSessions");
  sctx.customer = await resolveCustomerSession(sctx.req);
  return { ctx: sctx, caller: factory(sctx) };
}

const A = { mood: "relax" as const, weather: "hot" as const, sights: "beach" as const, budget: "low" as const, company: "date" as const };
const B = { mood: "relax" as const, weather: "hot" as const, sights: "food" as const, budget: "high" as const, company: "date" as const };

describe("ReiseMatch: par og venner", () => {
  beforeEach(async () => {
    await truncateAll();
  });
  afterAll(async () => {
    await closeDb();
  });

  it("par: A svarer, B blir med via lenke, ingen ser den andres rå svar, budsjett skjules til begge deler", async () => {
    const a = caller();
    const created = await a.match.create({ mode: "couple", name: "Zana", answers: A, shareBudget: true });
    expect(created.token).toMatch(SHARE_TOKEN_RE);
    expect(created.shareUrl).toContain(`/m/${created.token}`);

    const waiting = await caller().match.get({ token: created.token, participantKey: created.participantKey });
    expect(waiting.ready).toBe(false);
    expect(waiting.participants).toHaveLength(1);
    expect(waiting.myAnswers).toEqual(A);

    const b = caller();
    const joined = await b.match.join({ token: created.token, name: "Helin", answers: B, shareBudget: false });
    // Tredje person slipper ikke inn i en par-match.
    await expectAppCode(caller().match.join({ token: created.token, name: "Ahmed", answers: B }), "CONFLICT");

    const view = await b.match.get({ token: created.token, participantKey: joined.participantKey });
    expect(view.ready).toBe(true);
    expect(view.includeBudget).toBe(false);
    expect(view.agreement).toEqual({ mood: "relax", weather: "hot" });
    expect(view.results).toHaveLength(3);
    expect(view.myAnswers).toEqual(B);
    // Svarene til A finnes ikke i B sitt bilde.
    expect(JSON.stringify(view)).not.toContain('"sights":"beach"');

    // Uten nøkkel: kun det offentlige bildet, ingen egne svar.
    const anon = await caller().match.get({ token: created.token });
    expect(anon.myAnswers).toBeNull();
    expect(anon.isOwner).toBe(false);
    const owner = await caller().match.get({ token: created.token, ownerKey: created.ownerKey });
    expect(owner.isOwner).toBe(true);
  });

  it("venner: stemmer, kommentarer, utilgjengelige datoer og avgjørelse — bare eieren avgjør", async () => {
    const created = await caller().match.create({ mode: "friends", title: "Sommerturen", name: "Zana", answers: { ...A, company: "friends" } });
    const j1 = await caller().match.join({ token: created.token, name: "Helin", answers: { ...B, company: "friends" }, unavailable: [{ from: "2027-07-01", to: "2027-07-10" }] });
    const view = await caller().match.get({ token: created.token, participantKey: j1.participantKey });
    expect(view.ready).toBe(true);
    expect(view.unavailable).toEqual([{ from: "2027-07-01", to: "2027-07-10", name: "Helin" }]);

    const dest = view.results[0].destination.id;
    await caller().match.vote({ token: created.token, participantKey: j1.participantKey, destinationId: dest, value: 1 });
    await caller().match.vote({ token: created.token, participantKey: created.participantKey, destinationId: dest, value: 1 });
    await caller().match.comment({ token: created.token, participantKey: j1.participantKey, body: "Jeg er med!" });
    const after = await caller().match.get({ token: created.token, participantKey: j1.participantKey });
    expect(after.results[0].votes).toEqual({ up: 2, down: 0, names: expect.arrayContaining(["Zana", "Helin"]) });
    expect(after.comments[0]).toMatchObject({ name: "Helin", body: "Jeg er med!" });
    expect(after.myVotes).toEqual([{ destinationId: dest, value: 1 }]);

    await expectAppCode(caller().match.decide({ token: created.token, destinationId: dest }), "FORBIDDEN");
    await caller().match.decide({ token: created.token, ownerKey: created.ownerKey, destinationId: dest });
    expect((await caller().match.get({ token: created.token })).decided?.id).toBe(dest);
    await expectAppCode(caller().match.vote({ token: created.token, participantKey: WRONG_KEY, destinationId: dest, value: 1 }), "FORBIDDEN");
    await expectAppCode(caller().match.get({ token: WRONG_TOKEN }), "NOT_FOUND");
  });
});

describe("Reisetavler", () => {
  beforeEach(async () => {
    await truncateAll();
  });
  afterAll(async () => {
    await closeDb();
  });

  it("eieren lager tavla; gjester med lenken legger til, stemmer og kommenterer med navn; bare eieren sletter", async () => {
    const { caller: owner } = await customerCaller("kari@hellosky.test");
    const { token } = await owner.boards.create({ title: "Ibiza med gutta", when: "Juli 2027" });
    expect((await owner.boards.mine())[0]).toMatchObject({ title: "Ibiza med gutta", items: 0 });

    await owner.boards.addItem({ token, kind: "destination", refId: "barcelona" });
    const guest = caller();
    await expectAppCode(guest.boards.addItem({ token, kind: "note", note: "Ahmed har ikke pass" }), "VALIDATION");
    await guest.boards.addItem({ token, kind: "note", note: "Ahmed har ikke pass", name: "Zana" });

    const view = await guest.boards.get({ token, voterKey: "guest-key-0001" });
    expect(view.canEdit).toBe(false);
    expect(view.items).toHaveLength(2);
    const dest = view.items.find((i) => i.kind === "destination")!;

    expect(await guest.boards.vote({ token, itemId: dest.id, voterKey: "guest-key-0001", name: "Zana" })).toEqual({ voted: true });
    expect(await guest.boards.vote({ token, itemId: dest.id, voterKey: "guest-key-0001", name: "Zana" })).toEqual({ voted: false });
    await guest.boards.vote({ token, itemId: dest.id, voterKey: "guest-key-0001", name: "Zana" });
    await owner.boards.vote({ token, itemId: dest.id });
    const voted = await guest.boards.get({ token, voterKey: "guest-key-0001" });
    expect(voted.items.find((i) => i.id === dest.id)).toMatchObject({ votes: 2, votedByMe: true, voters: expect.arrayContaining(["Zana", "Kari"]) });

    await guest.boards.comment({ token, body: "Fredag passer best", name: "Zana" });
    expect((await owner.boards.get({ token })).comments[0]).toMatchObject({ name: "Zana", body: "Fredag passer best" });

    await expectAppCode(guest.boards.removeItem({ token, itemId: dest.id }), "UNAUTHORIZED");
    const { caller: other } = await customerCaller("ola@hellosky.test");
    await expectAppCode(other.boards.remove({ token }), "FORBIDDEN");
    await owner.boards.remove({ token });
    expect(await countRows("trip_boards")).toBe(0);
    expect(await countRows("trip_board_items")).toBe(0);
    expect(await countRows("trip_board_votes")).toBe(0);
  });
});
