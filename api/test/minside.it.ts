import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../router";
import { createCallerFactory } from "../middleware";
import app from "../boot";
import { closeDb, countRows, expectAppCode, makeCtx, truncateAll } from "./setup";

const factory = createCallerFactory(appRouter);

/** Registrer en kunde og gi tilbake caller + cookie for HTTP-rutene. */
async function customer(email: string, firstName = "Kari") {
  const ctx = makeCtx();
  await factory(ctx).customerAuth.register({ identifier: email, password: "kundepassord-2026", firstName, lastName: "Nordmann" });
  const cookie = ctx.resHeaders.get("set-cookie")!.split(";")[0]!;
  const sctx = makeCtx({ headers: { cookie } });
  const { resolveCustomerSession } = await import("../lib/customerSessions");
  sctx.customer = await resolveCustomerSession(sctx.req);
  return { ctx: sctx, caller: factory(sctx), cookie, id: sctx.customer!.customerId };
}

const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n%âãÏÓ\n1 0 obj<<>>endobj\n"), Buffer.alloc(2048, 0x41)]);
const ORIGIN = { origin: "http://localhost:3000", "content-type": "application/json" };

async function upload(cookie: string, body: Record<string, unknown>) {
  return app.request("/api/documents/upload", { method: "POST", headers: { ...ORIGIN, cookie }, body: JSON.stringify(body) });
}

describe("Min side: reiseplaner", () => {
  beforeEach(async () => {
    await truncateAll();
  });
  afterAll(async () => {
    await closeDb();
  });

  it("lager en idé uten datoer, setter datoer, og blir aldri «bestilt» uten en ekte bestilling", async () => {
    const { caller } = await customer("kari@hellosky.test");
    const plan = await caller.tripPlans.create({ destinationId: "lisboa" });
    expect(plan).toMatchObject({ title: "Lisboa", status: "idea", booked: false, dateFrom: null, destinationIata: "LIS" });
    const dated = await caller.tripPlans.update({ id: plan.id, dateFrom: "2026-10-16", dateTo: "2026-10-19", adults: 2 });
    expect(dated).toMatchObject({ status: "planned", booked: false, adults: 2 });
    await expectAppCode(caller.tripPlans.update({ id: plan.id, dateFrom: "2026-10-20", dateTo: "2026-10-19" }), "VALIDATION");
    await expectAppCode(caller.tripPlans.linkBooking({ id: plan.id, bookingId: 999 }), "NOT_FOUND");
    expect((await caller.tripPlans.list()).map((p) => p.id)).toEqual([plan.id]);
  });

  it("en annen kunde ser ikke planen", async () => {
    const a = await customer("a@hellosky.test");
    const b = await customer("b@hellosky.test", "Bo");
    const plan = await a.caller.tripPlans.create({ destinationId: "rome" });
    await expectAppCode(b.caller.tripPlans.get({ id: plan.id }), "NOT_FOUND");
    expect(await b.caller.tripPlans.list()).toEqual([]);
  });
});

describe("Min side: dokumenter", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("laster opp, åpner og sletter et privat dokument – og nabokontoen får 404", async () => {
    const a = await customer("a@hellosky.test");
    const b = await customer("b@hellosky.test", "Bo");
    const plan = await a.caller.tripPlans.create({ destinationId: "lisboa" });
    const res = await upload(a.cookie, { kind: "flight_ticket", title: "Flybillett", fileName: "../../billett.exe", data: PDF.toString("base64"), tripPlanId: plan.id });
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: number; fileName: string; mime: string };
    expect(created.mime).toBe("application/pdf");
    expect(created.fileName).toBe("billett.pdf");
    expect(await countRows("customer_document_blobs")).toBe(1);

    const list = await a.caller.documents.list({ tripPlanId: plan.id });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: "flight_ticket", source: "manual", bytes: PDF.length });

    const open = await app.request(`/api/documents/${created.id}`, { headers: { cookie: a.cookie } });
    expect(open.status).toBe(200);
    expect(open.headers.get("content-type")).toBe("application/pdf");
    expect(open.headers.get("cache-control")).toBe("private, no-store");
    expect(open.headers.get("content-disposition")).toContain('inline; filename="billett.pdf"');
    expect(Buffer.from(await open.arrayBuffer()).equals(PDF)).toBe(true);
    const dl = await app.request(`/api/documents/${created.id}?download=1`, { headers: { cookie: a.cookie } });
    expect(dl.headers.get("content-disposition")).toContain("attachment;");

    // Nabokontoen: 404, ikke 403 – dokumentet finnes ikke sett fra henne.
    expect((await app.request(`/api/documents/${created.id}`, { headers: { cookie: b.cookie } })).status).toBe(404);
    expect(await b.caller.documents.list()).toEqual([]);
    await expectAppCode(b.caller.documents.remove({ id: created.id }), "NOT_FOUND");
    // Uten innlogging: 401.
    expect((await app.request(`/api/documents/${created.id}`)).status).toBe(401);

    await a.caller.documents.remove({ id: created.id });
    expect(await countRows("customer_documents")).toBe(0);
    expect(await countRows("customer_document_blobs")).toBe(0);
  });

  it("avviser innhold som ikke er PDF eller bilde, og opplasting uten sesjon eller riktig opprinnelse", async () => {
    const a = await customer("a@hellosky.test");
    const html = Buffer.from("<html><script>alert(1)</script></html>".padEnd(64, " ")).toString("base64");
    expect((await upload(a.cookie, { kind: "other", title: "x", fileName: "x.pdf", data: html })).status).toBe(415);
    expect((await app.request("/api/documents/upload", { method: "POST", headers: ORIGIN, body: JSON.stringify({ kind: "other", title: "x", fileName: "x.pdf", data: PDF.toString("base64") }) })).status).toBe(401);
    expect((await app.request("/api/documents/upload", { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example", cookie: a.cookie }, body: JSON.stringify({ kind: "other", title: "x", fileName: "x.pdf", data: PDF.toString("base64") }) })).status).toBe(403);
    expect(await countRows("customer_documents")).toBe(0);
  });
});

describe("Min side: venner og grupper", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("invitasjonslenke → venner; venneinnlegg ses av vennen men ikke av en tredje", async () => {
    const emma = await customer("emma@hellosky.test", "Emma");
    const jo = await customer("jo@hellosky.test", "Jo");
    const x = await customer("x@hellosky.test", "Xenia");
    const invite = await emma.caller.social.friends.createInviteLink();
    expect(invite.url).toContain("/venner/invitasjon/");
    await expectAppCode(emma.caller.social.friends.acceptInvite({ token: invite.token }), "VALIDATION");
    expect(await jo.caller.social.friends.acceptInvite({ token: invite.token })).toMatchObject({ ok: true, alreadyFriends: false });
    // Lenken er brukt opp.
    await expectAppCode(x.caller.social.friends.acceptInvite({ token: invite.token }), "NOT_FOUND");
    expect((await emma.caller.social.friends.list()).friends.map((f) => f.name)).toEqual(["Jo N."]);

    await emma.caller.social.posts.create({ audience: "friends", destinationId: "rome", body: "Siena på ønskelisten. Hvem blir med?" });
    const joFeed = await jo.caller.social.posts.feed();
    expect(joFeed.posts).toHaveLength(1);
    expect(joFeed.posts[0]).toMatchObject({ author: { name: "Emma N." }, destination: { id: "rome" }, likedByMe: false, canRemove: false });
    expect((await x.caller.social.posts.feed()).posts).toEqual([]);

    const post = joFeed.posts[0]!;
    expect(await jo.caller.social.posts.toggleLike({ id: post.id })).toEqual({ liked: true });
    await jo.caller.social.posts.comment({ postId: post.id, body: "Jeg er med!" });
    await expectAppCode(x.caller.social.posts.comment({ postId: post.id, body: "hei" }), "FORBIDDEN");
    expect((await emma.caller.social.posts.comments({ postId: post.id })).map((c) => c.body)).toEqual(["Jeg er med!"]);
    await expectAppCode(jo.caller.social.posts.remove({ id: post.id }), "FORBIDDEN");
    await emma.caller.social.posts.remove({ id: post.id });
    expect(await countRows("social_comments")).toBe(0);
  });

  it("privat gruppe: bli med via lenke, stem, forlat – og tilgangen forsvinner", async () => {
    const emma = await customer("emma@hellosky.test", "Emma");
    const jo = await customer("jo@hellosky.test", "Jo");
    const x = await customer("x@hellosky.test", "Xenia");
    const { id: groupId } = await emma.caller.social.groups.create({ name: "Helgeturen", coverDestinationId: "lisboa" });
    const invite = await emma.caller.social.groups.inviteLink({ id: groupId });
    expect(await jo.caller.social.groups.join({ token: invite.token })).toEqual({ id: groupId, joined: true });
    await expectAppCode(x.caller.social.groups.get({ id: groupId }), "FORBIDDEN");

    const { id: pollId } = await emma.caller.social.polls.create({ groupId, question: "Hvor skal vi dra?", options: [{ destinationId: "lisboa", label: "Lisboa" }, { label: "København" }] });
    const group = await jo.caller.social.groups.get({ id: groupId });
    expect(group.members.map((m) => m.name).sort()).toEqual(["Emma N.", "Jo N."]);
    const poll = group.polls.find((p) => p.id === pollId)!;
    const voted = await jo.caller.social.polls.vote({ pollId, optionId: poll.options[0]!.id });
    expect(voted).toMatchObject({ totalVotes: 1, myOptionId: poll.options[0]!.id });
    // Ombestemmer seg: én stemme per medlem.
    const changed = await jo.caller.social.polls.vote({ pollId, optionId: poll.options[1]!.id });
    expect(changed.totalVotes).toBe(1);
    expect(changed.options.map((o) => o.votes)).toEqual([0, 1]);
    await expectAppCode(x.caller.social.polls.vote({ pollId, optionId: poll.options[0]!.id }), "FORBIDDEN");

    await emma.caller.social.posts.create({ audience: "group", groupId, body: "Jeg sjekker fly fra Oslo." });
    expect((await jo.caller.social.posts.feed()).posts).toHaveLength(1);
    expect((await jo.caller.social.posts.feed()).polls).toHaveLength(1);

    await expectAppCode(emma.caller.social.groups.leave({ id: groupId }), "VALIDATION");
    await jo.caller.social.groups.leave({ id: groupId });
    await expectAppCode(jo.caller.social.groups.get({ id: groupId }), "FORBIDDEN");
    expect((await jo.caller.social.posts.feed()).posts).toEqual([]);
    expect((await jo.caller.social.groups.list())).toEqual([]);
  });

  it("blokkering skjuler innlegg begge veier og hindrer nye vennskap; rapportering lagres", async () => {
    const emma = await customer("emma@hellosky.test", "Emma");
    const jo = await customer("jo@hellosky.test", "Jo");
    const invite = await emma.caller.social.friends.createInviteLink();
    await jo.caller.social.friends.acceptInvite({ token: invite.token });
    const { id: postId } = await emma.caller.social.posts.create({ audience: "friends", body: "Hei" });
    await jo.caller.social.report({ targetType: "social_post", targetId: postId, reason: "spam" });
    expect(await countRows("content_reports")).toBe(1);
    await jo.caller.social.friends.block({ customerId: emma.id });
    expect((await jo.caller.social.posts.feed()).posts).toEqual([]);
    expect((await emma.caller.social.friends.list()).friends).toEqual([]);
    const again = await emma.caller.social.friends.createInviteLink();
    await expectAppCode(jo.caller.social.friends.acceptInvite({ token: again.token }), "FORBIDDEN");
  });
});
