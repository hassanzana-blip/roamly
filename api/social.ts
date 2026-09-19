import { z } from "zod";
import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { createRouter, customerProcedure } from "./middleware";
import { getDb } from "./queries/connection";
import {
  contentReports,
  customerAccounts,
  customerBlocks,
  customerFriendships,
  groupPollOptions,
  groupPollVotes,
  groupPolls,
  socialComments,
  socialLikes,
  socialPosts,
  travelGroupMembers,
  travelGroups,
} from "../db/schema";
import { AppError } from "./lib/errors";
import { assertRateLimit, clientIp } from "./lib/ratelimit";
import { logAudit } from "./lib/audit";
import { randomToken, sha256Hex } from "./lib/tokens";
import { notify } from "./lib/notifications";
import { env } from "./lib/env";
import { sanitizeText } from "./community";
import { SHARE_TOKEN_BYTES, SHARE_TOKEN_RE } from "../contracts/shareTokens";
import { ALL_DESTINATIONS } from "../src/content/discover";
import { activeMember, areFriends, canLeaveGroup, canRemoveMember, canRemovePost, canViewPost, displayName, isBlockedEitherWay, isGroupOwner, type FriendshipRow, type MembershipRow } from "./lib/socialRules";

/**
 * Venner og private reisegrupper.
 *
 * Alt er privat som standard: venner ser venneinnlegg, medlemmer ser
 * gruppeinnlegg og avstemninger, ingen ser noe offentlig. Invitasjoner er
 * lenker med hashet token – vi slår aldri opp e-poster og laster aldri opp
 * kontakter. Reglene ligger i api/lib/socialRules.ts; her henter vi fakta og
 * lar reglene dømme, i hver eneste prosedyre.
 */

const TOKEN = z.string().regex(SHARE_TOKEN_RE);
const ID = z.number().int().positive();
const DEST = z.string().regex(/^[a-z0-9-]{2,40}$/);
const INVITE_TTL_MS = 14 * 24 * 60 * 60_000;
const MAX_GROUPS = 20;
const MAX_MEMBERS = 30;
const MAX_FRIENDS = 300;
const FEED_PAGE = 20;

type Db = ReturnType<typeof getDb>;

function destinationOf(id: string | null) {
  const d = id ? ALL_DESTINATIONS.find((x) => x.id === id) : undefined;
  return d ? { id: d.id, city: d.city, country: d.country, iata: d.iata, image: d.image ?? null, imageAlt: d.imageAlt } : null;
}

async function people(db: Db, ids: number[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map<number, { id: number; name: string; avatarUrl: string | null }>();
  const rows = await db
    .select({ id: customerAccounts.id, firstName: customerAccounts.firstName, lastName: customerAccounts.lastName, avatarUrl: customerAccounts.avatarUrl, deletedAt: customerAccounts.deletedAt })
    .from(customerAccounts)
    .where(inArray(customerAccounts.id, unique));
  return new Map(rows.map((r) => [r.id, { id: r.id, name: r.deletedAt ? "Slettet bruker" : displayName(r.firstName, r.lastName), avatarUrl: r.deletedAt ? null : r.avatarUrl }]));
}

async function friendshipsOf(db: Db, customerId: number): Promise<(FriendshipRow & { id: number; createdAt: Date; respondedAt: Date | null })[]> {
  return db
    .select({ id: customerFriendships.id, requesterId: customerFriendships.requesterId, addresseeId: customerFriendships.addresseeId, status: customerFriendships.status, createdAt: customerFriendships.createdAt, respondedAt: customerFriendships.respondedAt })
    .from(customerFriendships)
    .where(or(eq(customerFriendships.requesterId, customerId), eq(customerFriendships.addresseeId, customerId)));
}

async function blocksOf(db: Db, customerId: number) {
  return db.select({ blockerId: customerBlocks.blockerId, blockedId: customerBlocks.blockedId }).from(customerBlocks).where(or(eq(customerBlocks.blockerId, customerId), eq(customerBlocks.blockedId, customerId)));
}

async function membersOf(db: Db, groupId: number): Promise<(MembershipRow & { id: number; joinedAt: Date })[]> {
  return db
    .select({ id: travelGroupMembers.id, customerId: travelGroupMembers.customerId, role: travelGroupMembers.role, leftAt: travelGroupMembers.leftAt, joinedAt: travelGroupMembers.joinedAt })
    .from(travelGroupMembers)
    .where(eq(travelGroupMembers.groupId, groupId));
}

async function myGroupIds(db: Db, customerId: number): Promise<number[]> {
  const rows = await db.select({ groupId: travelGroupMembers.groupId }).from(travelGroupMembers).where(and(eq(travelGroupMembers.customerId, customerId), isNull(travelGroupMembers.leftAt)));
  return rows.map((r) => r.groupId);
}

async function requireMember(db: Db, groupId: number, customerId: number) {
  const members = await membersOf(db, groupId);
  const me = activeMember(customerId, members);
  if (!me) throw new AppError("FORBIDDEN", { message: "Du er ikke medlem i denne gruppen." });
  return { members, me };
}

function friendIds(customerId: number, rows: FriendshipRow[]): number[] {
  return rows.filter((r) => r.status === "accepted").map((r) => (r.requesterId === customerId ? r.addresseeId! : r.requesterId)).filter((x): x is number => x != null);
}

async function pollViews(db: Db, groupIds: number[], viewer: number) {
  if (!groupIds.length) return [];
  const polls = await db.select().from(groupPolls).where(and(inArray(groupPolls.groupId, groupIds), isNull(groupPolls.closedAt))).orderBy(desc(groupPolls.createdAt)).limit(10);
  if (!polls.length) return [];
  const pollIds = polls.map((p) => p.id);
  const options = await db.select().from(groupPollOptions).where(inArray(groupPollOptions.pollId, pollIds)).orderBy(groupPollOptions.position);
  const votes = await db.select({ pollId: groupPollVotes.pollId, optionId: groupPollVotes.optionId, customerId: groupPollVotes.customerId }).from(groupPollVotes).where(inArray(groupPollVotes.pollId, pollIds));
  const groups = await db.select({ id: travelGroups.id, name: travelGroups.name }).from(travelGroups).where(inArray(travelGroups.id, groupIds));
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  return polls.map((p) => {
    const mine = votes.find((v) => v.pollId === p.id && v.customerId === viewer);
    const total = votes.filter((v) => v.pollId === p.id).length;
    return {
      id: p.id,
      groupId: p.groupId,
      groupName: groupName.get(p.groupId) ?? "",
      question: p.question,
      createdById: p.createdById,
      createdAt: p.createdAt,
      totalVotes: total,
      myOptionId: mine?.optionId ?? null,
      options: options
        .filter((o) => o.pollId === p.id)
        .map((o) => ({ id: o.id, label: o.label, destination: destinationOf(o.destinationId), votes: votes.filter((v) => v.optionId === o.id).length })),
    };
  });
}

export const socialRouter = createRouter({
  // ─── Venner ────────────────────────────────────────────────────────────
  friends: createRouter({
    list: customerProcedure.query(async ({ ctx }) => {
      const db = getDb();
      const me = ctx.customer.customerId;
      const rows = await friendshipsOf(db, me);
      const blocks = await blocksOf(db, me);
      const accepted = rows.filter((r) => r.status === "accepted");
      const incoming = rows.filter((r) => r.status === "pending" && r.addresseeId === me);
      const ids = [...accepted.map((r) => (r.requesterId === me ? r.addresseeId! : r.requesterId)), ...incoming.map((r) => r.requesterId)];
      const names = await people(db, ids);
      return {
        friends: accepted
          .map((r) => {
            const other = r.requesterId === me ? r.addresseeId! : r.requesterId;
            return { customerId: other, ...(names.get(other) ?? { id: other, name: "Reisende", avatarUrl: null }), since: r.respondedAt ?? r.createdAt, blocked: isBlockedEitherWay(me, other, blocks) };
          })
          .sort((a, b) => a.name.localeCompare(b.name, "nb")),
        incoming: incoming.map((r) => ({ requestId: r.id, customerId: r.requesterId, ...(names.get(r.requesterId) ?? { id: r.requesterId, name: "Reisende", avatarUrl: null }), createdAt: r.createdAt })),
        blocked: blocks.filter((b) => b.blockerId === me).map((b) => b.blockedId),
      };
    }),

    /** Lenke du deler selv – den som åpner den og logger inn, blir venn. Gyldig 14 dager, én person. */
    createInviteLink: customerProcedure.mutation(async ({ ctx }) => {
      const me = ctx.customer.customerId;
      assertRateLimit("friend-invite", String(me), 20, 60 * 60_000);
      const db = getDb();
      const token = randomToken(SHARE_TOKEN_BYTES);
      await db.insert(customerFriendships).values({ requesterId: me, addresseeId: null, status: "pending", inviteTokenHash: sha256Hex(token), inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS) });
      return { token, url: `${env.baseUrl}/venner/invitasjon/${token}`, expiresAt: new Date(Date.now() + INVITE_TTL_MS) };
    }),

    previewInvite: customerProcedure.input(z.object({ token: TOKEN })).query(async ({ input, ctx }) => {
      const db = getDb();
      const [row] = await db.select().from(customerFriendships).where(eq(customerFriendships.inviteTokenHash, sha256Hex(input.token))).limit(1);
      if (!row || row.status !== "pending" || row.addresseeId !== null || (row.inviteExpiresAt && row.inviteExpiresAt < new Date())) return { valid: false as const };
      const names = await people(db, [row.requesterId]);
      return { valid: true as const, from: names.get(row.requesterId)!, self: row.requesterId === ctx.customer.customerId };
    }),

    acceptInvite: customerProcedure.input(z.object({ token: TOKEN })).mutation(async ({ input, ctx }) => {
      const me = ctx.customer.customerId;
      assertRateLimit("friend-accept", clientIp(ctx.req), 30, 60 * 60_000);
      const db = getDb();
      const [row] = await db.select().from(customerFriendships).where(eq(customerFriendships.inviteTokenHash, sha256Hex(input.token))).limit(1);
      if (!row || row.status !== "pending" || row.addresseeId !== null || (row.inviteExpiresAt && row.inviteExpiresAt < new Date())) {
        throw new AppError("NOT_FOUND", { message: "Invitasjonen er brukt eller har gått ut." });
      }
      if (row.requesterId === me) throw new AppError("VALIDATION", { message: "Dette er din egen invitasjonslenke." });
      const existing = await friendshipsOf(db, me);
      if (areFriends(me, row.requesterId, existing)) return { ok: true, alreadyFriends: true };
      if (friendIds(me, existing).length >= MAX_FRIENDS) throw new AppError("VALIDATION", { message: "Du har nådd grensen for antall venner." });
      const blocks = await blocksOf(db, me);
      if (isBlockedEitherWay(me, row.requesterId, blocks)) throw new AppError("FORBIDDEN", { message: "Dere kan ikke bli venner." });
      await db.update(customerFriendships).set({ addresseeId: me, status: "accepted", respondedAt: new Date(), inviteTokenHash: null }).where(eq(customerFriendships.id, row.id));
      await notify({ customerId: row.requesterId, type: "match", title: `${displayName(ctx.customer.firstName, ctx.customer.lastName)} er nå vennen din`, href: "/profil/venner", dedupeKey: `friend-accepted:${row.id}` });
      await logAudit({ actorType: "customer", actorId: me, action: "friend.accepted", targetType: "customer_friendship", targetId: row.id });
      return { ok: true, alreadyFriends: false };
    }),

    respond: customerProcedure.input(z.object({ requestId: ID, accept: z.boolean() })).mutation(async ({ input, ctx }) => {
      const me = ctx.customer.customerId;
      const db = getDb();
      const [row] = await db.select().from(customerFriendships).where(and(eq(customerFriendships.id, input.requestId), eq(customerFriendships.addresseeId, me), eq(customerFriendships.status, "pending"))).limit(1);
      if (!row) throw new AppError("NOT_FOUND", { message: "Forespørselen finnes ikke lenger." });
      await db.update(customerFriendships).set({ status: input.accept ? "accepted" : "declined", respondedAt: new Date() }).where(eq(customerFriendships.id, row.id));
      if (input.accept) await notify({ customerId: row.requesterId, type: "match", title: `${displayName(ctx.customer.firstName, ctx.customer.lastName)} godtok venneforespørselen`, href: "/profil/venner", dedupeKey: `friend-accepted:${row.id}` });
      return { ok: true };
    }),

    /** Direkte forespørsel – bare til noen du deler en gruppe med. */
    request: customerProcedure.input(z.object({ customerId: ID })).mutation(async ({ input, ctx }) => {
      const me = ctx.customer.customerId;
      if (input.customerId === me) throw new AppError("VALIDATION", { message: "Du kan ikke legge til deg selv." });
      assertRateLimit("friend-request", String(me), 30, 60 * 60_000);
      const db = getDb();
      const mine = await myGroupIds(db, me);
      const shared = mine.length
        ? await db.select({ id: travelGroupMembers.id }).from(travelGroupMembers).where(and(inArray(travelGroupMembers.groupId, mine), eq(travelGroupMembers.customerId, input.customerId), isNull(travelGroupMembers.leftAt))).limit(1)
        : [];
      if (!shared.length) throw new AppError("FORBIDDEN", { message: "Du kan bare sende forespørsel til noen du deler en gruppe med. Ellers: del invitasjonslenken din." });
      const existing = await friendshipsOf(db, me);
      if (areFriends(me, input.customerId, existing)) return { ok: true };
      if (existing.some((r) => r.status === "pending" && ((r.requesterId === me && r.addresseeId === input.customerId) || (r.requesterId === input.customerId && r.addresseeId === me)))) return { ok: true };
      if (isBlockedEitherWay(me, input.customerId, await blocksOf(db, me))) throw new AppError("FORBIDDEN", { message: "Dere kan ikke bli venner." });
      const res = await db.insert(customerFriendships).values({ requesterId: me, addresseeId: input.customerId, status: "pending" });
      await notify({ customerId: input.customerId, type: "match", title: `${displayName(ctx.customer.firstName, ctx.customer.lastName)} vil bli venn med deg`, href: "/profil/venner", dedupeKey: `friend-request:${Number(res[0].insertId)}` });
      return { ok: true };
    }),

    remove: customerProcedure.input(z.object({ customerId: ID })).mutation(async ({ input, ctx }) => {
      const me = ctx.customer.customerId;
      const db = getDb();
      await db
        .delete(customerFriendships)
        .where(or(and(eq(customerFriendships.requesterId, me), eq(customerFriendships.addresseeId, input.customerId)), and(eq(customerFriendships.requesterId, input.customerId), eq(customerFriendships.addresseeId, me))));
      return { ok: true };
    }),

    block: customerProcedure.input(z.object({ customerId: ID })).mutation(async ({ input, ctx }) => {
      const me = ctx.customer.customerId;
      if (input.customerId === me) throw new AppError("VALIDATION", { message: "Du kan ikke blokkere deg selv." });
      const db = getDb();
      await db.insert(customerBlocks).values({ blockerId: me, blockedId: input.customerId }).onDuplicateKeyUpdate({ set: { blockerId: me } });
      // En blokkering avslutter vennskapet og eventuelle åpne forespørsler.
      await db
        .delete(customerFriendships)
        .where(or(and(eq(customerFriendships.requesterId, me), eq(customerFriendships.addresseeId, input.customerId)), and(eq(customerFriendships.requesterId, input.customerId), eq(customerFriendships.addresseeId, me))));
      await logAudit({ actorType: "customer", actorId: me, action: "customer.blocked", targetType: "customer_account", targetId: input.customerId });
      return { ok: true };
    }),

    unblock: customerProcedure.input(z.object({ customerId: ID })).mutation(async ({ input, ctx }) => {
      await getDb().delete(customerBlocks).where(and(eq(customerBlocks.blockerId, ctx.customer.customerId), eq(customerBlocks.blockedId, input.customerId)));
      return { ok: true };
    }),
  }),

  // ─── Grupper ───────────────────────────────────────────────────────────
  groups: createRouter({
    list: customerProcedure.query(async ({ ctx }) => {
      const db = getDb();
      const ids = await myGroupIds(db, ctx.customer.customerId);
      if (!ids.length) return [];
      const groups = await db.select().from(travelGroups).where(inArray(travelGroups.id, ids)).orderBy(desc(travelGroups.updatedAt));
      const members = await db.select({ groupId: travelGroupMembers.groupId, customerId: travelGroupMembers.customerId, role: travelGroupMembers.role }).from(travelGroupMembers).where(and(inArray(travelGroupMembers.groupId, ids), isNull(travelGroupMembers.leftAt)));
      const posts = await db.select({ groupId: socialPosts.groupId, n: sql<number>`count(*)` }).from(socialPosts).where(and(inArray(socialPosts.groupId, ids), eq(socialPosts.hidden, false))).groupBy(socialPosts.groupId);
      return groups.map((g) => ({
        id: g.id,
        name: g.name,
        cover: destinationOf(g.coverDestinationId),
        memberCount: members.filter((m) => m.groupId === g.id).length,
        postCount: Number(posts.find((p) => p.groupId === g.id)?.n ?? 0),
        isOwner: members.some((m) => m.groupId === g.id && m.customerId === ctx.customer.customerId && m.role === "owner"),
        updatedAt: g.updatedAt,
      }));
    }),

    create: customerProcedure.input(z.object({ name: z.string().trim().min(1).max(60), coverDestinationId: DEST.optional() })).mutation(async ({ input, ctx }) => {
      const me = ctx.customer.customerId;
      assertRateLimit("group-create", String(me), 10, 60 * 60_000);
      const db = getDb();
      const ids = await myGroupIds(db, me);
      if (ids.length >= MAX_GROUPS) throw new AppError("VALIDATION", { message: `Du kan være med i inntil ${MAX_GROUPS} grupper.` });
      if (input.coverDestinationId && !destinationOf(input.coverDestinationId)) throw new AppError("VALIDATION", { message: "Ukjent reisemål.", data: { field: "coverDestinationId" } });
      const id = await db.transaction(async (tx) => {
        const res = await tx.insert(travelGroups).values({ ownerId: me, name: sanitizeText(input.name, 60), coverDestinationId: input.coverDestinationId ?? null });
        const gid = Number(res[0].insertId);
        await tx.insert(travelGroupMembers).values({ groupId: gid, customerId: me, role: "owner" });
        return gid;
      });
      await logAudit({ actorType: "customer", actorId: me, action: "group.created", targetType: "travel_group", targetId: id });
      return { id };
    }),

    get: customerProcedure.input(z.object({ id: ID })).query(async ({ input, ctx }) => {
      const db = getDb();
      const me = ctx.customer.customerId;
      const { members, me: mine } = await requireMember(db, input.id, me);
      const [g] = await db.select().from(travelGroups).where(eq(travelGroups.id, input.id)).limit(1);
      if (!g) throw new AppError("NOT_FOUND");
      const active = members.filter((m) => m.leftAt === null);
      const names = await people(db, active.map((m) => m.customerId));
      const friendships = await friendshipsOf(db, me);
      return {
        id: g.id,
        name: g.name,
        cover: destinationOf(g.coverDestinationId),
        myRole: mine.role as "owner" | "member",
        members: active.map((m) => ({ customerId: m.customerId, role: m.role as "owner" | "member", joinedAt: m.joinedAt, isYou: m.customerId === me, isFriend: areFriends(me, m.customerId, friendships), ...(names.get(m.customerId) ?? { id: m.customerId, name: "Reisende", avatarUrl: null }) })),
        polls: await pollViews(db, [g.id], me),
        createdAt: g.createdAt,
      };
    }),

    /** Invitasjonslenke til gruppen. Alle aktive medlemmer kan invitere. */
    inviteLink: customerProcedure.input(z.object({ id: ID })).mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireMember(db, input.id, ctx.customer.customerId);
      assertRateLimit("group-invite", String(ctx.customer.customerId), 20, 60 * 60_000);
      const token = randomToken(SHARE_TOKEN_BYTES);
      await db.update(travelGroups).set({ inviteTokenHash: sha256Hex(token) }).where(eq(travelGroups.id, input.id));
      return { token, url: `${env.baseUrl}/grupper/invitasjon/${token}` };
    }),

    previewInvite: customerProcedure.input(z.object({ token: TOKEN })).query(async ({ input, ctx }) => {
      const db = getDb();
      const [g] = await db.select().from(travelGroups).where(eq(travelGroups.inviteTokenHash, sha256Hex(input.token))).limit(1);
      if (!g) return { valid: false as const };
      const members = await membersOf(db, g.id);
      const owner = await people(db, [g.ownerId]);
      return { valid: true as const, groupId: g.id, name: g.name, cover: destinationOf(g.coverDestinationId), memberCount: members.filter((m) => m.leftAt === null).length, owner: owner.get(g.ownerId)!, alreadyMember: Boolean(activeMember(ctx.customer.customerId, members)) };
    }),

    join: customerProcedure.input(z.object({ token: TOKEN })).mutation(async ({ input, ctx }) => {
      const me = ctx.customer.customerId;
      assertRateLimit("group-join", clientIp(ctx.req), 30, 60 * 60_000);
      const db = getDb();
      const [g] = await db.select().from(travelGroups).where(eq(travelGroups.inviteTokenHash, sha256Hex(input.token))).limit(1);
      if (!g) throw new AppError("NOT_FOUND", { message: "Invitasjonen er ikke gyldig lenger." });
      const members = await membersOf(db, g.id);
      if (activeMember(me, members)) return { id: g.id, joined: false };
      if (members.filter((m) => m.leftAt === null).length >= MAX_MEMBERS) throw new AppError("CONFLICT", { message: "Gruppen er full." });
      if (isBlockedEitherWay(me, g.ownerId, await blocksOf(db, me))) throw new AppError("FORBIDDEN", { message: "Du kan ikke bli med i denne gruppen." });
      const previous = members.find((m) => m.customerId === me);
      if (previous) await db.update(travelGroupMembers).set({ leftAt: null, joinedAt: new Date(), role: "member" }).where(eq(travelGroupMembers.id, previous.id));
      else await db.insert(travelGroupMembers).values({ groupId: g.id, customerId: me, role: "member" });
      await notify({ customerId: g.ownerId, type: "match", title: `${displayName(ctx.customer.firstName, ctx.customer.lastName)} ble med i «${g.name}»`, href: `/profil/venner/grupper/${g.id}`, dedupeKey: `group-join:${g.id}:${me}` });
      return { id: g.id, joined: true };
    }),

    leave: customerProcedure.input(z.object({ id: ID })).mutation(async ({ input, ctx }) => {
      const me = ctx.customer.customerId;
      const db = getDb();
      const members = await membersOf(db, input.id);
      const verdict = canLeaveGroup(me, members);
      if (!verdict.ok) throw new AppError(verdict.reason === "owner" ? "VALIDATION" : "NOT_FOUND", { message: verdict.reason === "owner" ? "Eieren kan ikke forlate gruppen. Slett den, eller gjør noen andre til eier først." : "Du er ikke medlem." });
      await db.update(travelGroupMembers).set({ leftAt: new Date() }).where(and(eq(travelGroupMembers.groupId, input.id), eq(travelGroupMembers.customerId, me)));
      return { ok: true };
    }),

    removeMember: customerProcedure.input(z.object({ id: ID, customerId: ID })).mutation(async ({ input, ctx }) => {
      const db = getDb();
      const members = await membersOf(db, input.id);
      if (!canRemoveMember(ctx.customer.customerId, input.customerId, members)) throw new AppError("FORBIDDEN", { message: "Bare eieren kan fjerne medlemmer." });
      await db.update(travelGroupMembers).set({ leftAt: new Date() }).where(and(eq(travelGroupMembers.groupId, input.id), eq(travelGroupMembers.customerId, input.customerId)));
      return { ok: true };
    }),

    transferOwnership: customerProcedure.input(z.object({ id: ID, customerId: ID })).mutation(async ({ input, ctx }) => {
      const db = getDb();
      const members = await membersOf(db, input.id);
      if (!isGroupOwner(ctx.customer.customerId, members) || !activeMember(input.customerId, members)) throw new AppError("FORBIDDEN", { message: "Bare eieren kan overføre gruppen, og bare til et medlem." });
      await db.transaction(async (tx) => {
        await tx.update(travelGroupMembers).set({ role: "member" }).where(and(eq(travelGroupMembers.groupId, input.id), eq(travelGroupMembers.customerId, ctx.customer.customerId)));
        await tx.update(travelGroupMembers).set({ role: "owner" }).where(and(eq(travelGroupMembers.groupId, input.id), eq(travelGroupMembers.customerId, input.customerId)));
        await tx.update(travelGroups).set({ ownerId: input.customerId }).where(eq(travelGroups.id, input.id));
      });
      return { ok: true };
    }),

    remove: customerProcedure.input(z.object({ id: ID })).mutation(async ({ input, ctx }) => {
      const db = getDb();
      const members = await membersOf(db, input.id);
      if (!isGroupOwner(ctx.customer.customerId, members)) throw new AppError("FORBIDDEN", { message: "Bare eieren kan slette gruppen." });
      await db.transaction(async (tx) => {
        const posts = await tx.select({ id: socialPosts.id }).from(socialPosts).where(eq(socialPosts.groupId, input.id));
        if (posts.length) await tx.delete(socialPosts).where(inArray(socialPosts.id, posts.map((p) => p.id)));
        await tx.delete(groupPolls).where(eq(groupPolls.groupId, input.id));
        await tx.delete(travelGroupMembers).where(eq(travelGroupMembers.groupId, input.id));
        await tx.delete(travelGroups).where(eq(travelGroups.id, input.id));
      });
      await logAudit({ actorType: "customer", actorId: ctx.customer.customerId, action: "group.deleted", targetType: "travel_group", targetId: input.id });
      return { ok: true };
    }),
  }),

  // ─── Innlegg ───────────────────────────────────────────────────────────
  posts: createRouter({
    /** «For deg»: dine egne, vennenes og gruppenes innlegg – og åpne avstemninger i gruppene dine. */
    feed: customerProcedure.input(z.object({ before: ID.optional(), groupId: ID.optional() }).optional()).query(async ({ input, ctx }) => {
      const db = getDb();
      const me = ctx.customer.customerId;
      const friendships = await friendshipsOf(db, me);
      const blocks = await blocksOf(db, me);
      const groupIds = await myGroupIds(db, me);
      const friends = friendIds(me, friendships);
      if (input?.groupId && !groupIds.includes(input.groupId)) throw new AppError("FORBIDDEN", { message: "Du er ikke medlem i denne gruppen." });

      const scope = input?.groupId
        ? eq(socialPosts.groupId, input.groupId)
        : or(
            eq(socialPosts.authorId, me),
            friends.length ? and(eq(socialPosts.audience, "friends"), inArray(socialPosts.authorId, friends)) : sql`false`,
            groupIds.length ? and(eq(socialPosts.audience, "group"), inArray(socialPosts.groupId, groupIds)) : sql`false`,
          );
      const rows = await db
        .select()
        .from(socialPosts)
        .where(and(scope, eq(socialPosts.hidden, false), input?.before ? sql`${socialPosts.id} < ${input.before}` : undefined))
        .orderBy(desc(socialPosts.id))
        .limit(FEED_PAGE + 1);

      // Reglene dømmer til slutt, uansett hva spørringen slapp gjennom.
      const membersByGroup = new Map<number, MembershipRow[]>();
      for (const gid of new Set(rows.map((r) => r.groupId).filter((x): x is number => x != null))) membersByGroup.set(gid, await membersOf(db, gid));
      const visible = rows.filter((p) => canViewPost(me, p, { friendships, members: p.groupId ? membersByGroup.get(p.groupId) ?? [] : [], blocks }));
      const page = visible.slice(0, FEED_PAGE);
      const ids = page.map((p) => p.id);
      const likes = ids.length ? await db.select({ postId: socialLikes.postId }).from(socialLikes).where(and(inArray(socialLikes.postId, ids), eq(socialLikes.customerId, me))) : [];
      const comments = ids.length ? await db.select({ postId: socialComments.postId, n: sql<number>`count(*)` }).from(socialComments).where(and(inArray(socialComments.postId, ids), eq(socialComments.hidden, false))).groupBy(socialComments.postId) : [];
      const names = await people(db, page.map((p) => p.authorId));
      const groups = groupIds.length ? await db.select({ id: travelGroups.id, name: travelGroups.name }).from(travelGroups).where(inArray(travelGroups.id, groupIds)) : [];
      return {
        posts: page.map((p) => ({
          id: p.id,
          author: names.get(p.authorId) ?? { id: p.authorId, name: "Reisende", avatarUrl: null },
          mine: p.authorId === me,
          audience: p.audience as "friends" | "group",
          groupId: p.groupId,
          groupName: p.groupId ? groups.find((g) => g.id === p.groupId)?.name ?? null : null,
          destination: destinationOf(p.destinationId),
          body: p.body,
          likes: p.likes,
          likedByMe: likes.some((l) => l.postId === p.id),
          commentCount: Number(comments.find((c) => c.postId === p.id)?.n ?? 0),
          canRemove: canRemovePost(me, p, p.groupId ? membersByGroup.get(p.groupId) ?? [] : []),
          createdAt: p.createdAt,
        })),
        nextBefore: visible.length > FEED_PAGE ? page[page.length - 1]!.id : null,
        polls: input?.groupId ? [] : await pollViews(db, groupIds, me),
        friendCount: friends.length,
        groupCount: groupIds.length,
      };
    }),

    create: customerProcedure
      .input(z.object({ audience: z.enum(["friends", "group"]), groupId: ID.optional(), destinationId: DEST.optional(), body: z.string().min(1).max(1200) }))
      .mutation(async ({ input, ctx }) => {
        const me = ctx.customer.customerId;
        assertRateLimit("social-post", String(me), 10, 60_000);
        assertRateLimit("social-post-h", String(me), 60, 60 * 60_000);
        const db = getDb();
        if (input.audience === "group") {
          if (!input.groupId) throw new AppError("VALIDATION", { message: "Velg en gruppe.", data: { field: "groupId" } });
          await requireMember(db, input.groupId, me);
        }
        if (input.destinationId && !destinationOf(input.destinationId)) throw new AppError("VALIDATION", { message: "Ukjent reisemål.", data: { field: "destinationId" } });
        const body = sanitizeText(input.body, 1000);
        if (!body) throw new AppError("VALIDATION", { message: "Skriv noe først.", data: { field: "body" } });
        const res = await db.insert(socialPosts).values({ authorId: me, audience: input.audience, groupId: input.audience === "group" ? input.groupId! : null, destinationId: input.destinationId ?? null, body });
        if (input.audience === "group" && input.groupId) await db.update(travelGroups).set({ updatedAt: new Date() }).where(eq(travelGroups.id, input.groupId));
        return { id: Number(res[0].insertId) };
      }),

    remove: customerProcedure.input(z.object({ id: ID })).mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [p] = await db.select().from(socialPosts).where(eq(socialPosts.id, input.id)).limit(1);
      if (!p) throw new AppError("NOT_FOUND");
      const members = p.groupId ? await membersOf(db, p.groupId) : [];
      if (!canRemovePost(ctx.customer.customerId, p, members)) throw new AppError("FORBIDDEN", { message: "Du kan bare fjerne egne innlegg." });
      await db.delete(socialPosts).where(eq(socialPosts.id, p.id));
      return { ok: true };
    }),

    toggleLike: customerProcedure.input(z.object({ id: ID })).mutation(async ({ input, ctx }) => {
      const me = ctx.customer.customerId;
      assertRateLimit("social-like", String(me), 60, 60_000);
      const db = getDb();
      const [p] = await db.select().from(socialPosts).where(eq(socialPosts.id, input.id)).limit(1);
      if (!p) throw new AppError("NOT_FOUND");
      const ok = canViewPost(me, p, { friendships: await friendshipsOf(db, me), members: p.groupId ? await membersOf(db, p.groupId) : [], blocks: await blocksOf(db, me) });
      if (!ok) throw new AppError("FORBIDDEN");
      return db.transaction(async (tx) => {
        const [existing] = await tx.select({ id: socialLikes.id }).from(socialLikes).where(and(eq(socialLikes.postId, p.id), eq(socialLikes.customerId, me))).limit(1);
        if (existing) {
          await tx.delete(socialLikes).where(eq(socialLikes.id, existing.id));
          await tx.update(socialPosts).set({ likes: sql`greatest(0, ${socialPosts.likes} - 1)` }).where(eq(socialPosts.id, p.id));
          return { liked: false };
        }
        await tx.insert(socialLikes).values({ postId: p.id, customerId: me });
        await tx.update(socialPosts).set({ likes: sql`${socialPosts.likes} + 1` }).where(eq(socialPosts.id, p.id));
        return { liked: true };
      });
    }),

    comments: customerProcedure.input(z.object({ postId: ID })).query(async ({ input, ctx }) => {
      const me = ctx.customer.customerId;
      const db = getDb();
      const [p] = await db.select().from(socialPosts).where(eq(socialPosts.id, input.postId)).limit(1);
      if (!p) throw new AppError("NOT_FOUND");
      const members = p.groupId ? await membersOf(db, p.groupId) : [];
      if (!canViewPost(me, p, { friendships: await friendshipsOf(db, me), members, blocks: await blocksOf(db, me) })) throw new AppError("FORBIDDEN");
      const rows = await db.select().from(socialComments).where(and(eq(socialComments.postId, p.id), eq(socialComments.hidden, false))).orderBy(socialComments.createdAt).limit(200);
      const names = await people(db, rows.map((r) => r.authorId));
      return rows.map((c) => ({ id: c.id, author: names.get(c.authorId) ?? { id: c.authorId, name: "Reisende", avatarUrl: null }, mine: c.authorId === me, body: c.body, createdAt: c.createdAt, canRemove: c.authorId === me || canRemovePost(me, p, members) }));
    }),

    comment: customerProcedure.input(z.object({ postId: ID, body: z.string().min(1).max(600) })).mutation(async ({ input, ctx }) => {
      const me = ctx.customer.customerId;
      assertRateLimit("social-comment", String(me), 20, 60_000);
      const db = getDb();
      const [p] = await db.select().from(socialPosts).where(eq(socialPosts.id, input.postId)).limit(1);
      if (!p) throw new AppError("NOT_FOUND");
      if (!canViewPost(me, p, { friendships: await friendshipsOf(db, me), members: p.groupId ? await membersOf(db, p.groupId) : [], blocks: await blocksOf(db, me) })) throw new AppError("FORBIDDEN");
      const body = sanitizeText(input.body, 500);
      if (!body) throw new AppError("VALIDATION", { message: "Skriv noe først.", data: { field: "body" } });
      const res = await db.insert(socialComments).values({ postId: p.id, authorId: me, body });
      if (p.authorId !== me) await notify({ customerId: p.authorId, type: "match", title: `${displayName(ctx.customer.firstName, ctx.customer.lastName)} kommenterte reiseidéen din`, href: "/profil/venner", dedupeKey: `comment:${Number(res[0].insertId)}` });
      return { id: Number(res[0].insertId) };
    }),

    removeComment: customerProcedure.input(z.object({ id: ID })).mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [c] = await db.select().from(socialComments).where(eq(socialComments.id, input.id)).limit(1);
      if (!c) throw new AppError("NOT_FOUND");
      const [p] = await db.select().from(socialPosts).where(eq(socialPosts.id, c.postId)).limit(1);
      const members = p?.groupId ? await membersOf(db, p.groupId) : [];
      if (!(c.authorId === ctx.customer.customerId || (p && canRemovePost(ctx.customer.customerId, p, members)))) throw new AppError("FORBIDDEN");
      await db.delete(socialComments).where(eq(socialComments.id, c.id));
      return { ok: true };
    }),
  }),

  // ─── Avstemninger ──────────────────────────────────────────────────────
  polls: createRouter({
    create: customerProcedure
      .input(z.object({ groupId: ID, question: z.string().trim().min(1).max(120), options: z.array(z.object({ destinationId: DEST.optional(), label: z.string().trim().min(1).max(60) })).min(2).max(6) }))
      .mutation(async ({ input, ctx }) => {
        const me = ctx.customer.customerId;
        assertRateLimit("poll-create", String(me), 10, 60 * 60_000);
        const db = getDb();
        await requireMember(db, input.groupId, me);
        for (const o of input.options) if (o.destinationId && !destinationOf(o.destinationId)) throw new AppError("VALIDATION", { message: "Ukjent reisemål.", data: { field: "options" } });
        const id = await db.transaction(async (tx) => {
          const res = await tx.insert(groupPolls).values({ groupId: input.groupId, createdById: me, question: sanitizeText(input.question, 120) });
          const pid = Number(res[0].insertId);
          await tx.insert(groupPollOptions).values(input.options.map((o, i) => ({ pollId: pid, destinationId: o.destinationId ?? null, label: sanitizeText(o.label, 60), position: i })));
          await tx.update(travelGroups).set({ updatedAt: new Date() }).where(eq(travelGroups.id, input.groupId));
          return pid;
        });
        return { id };
      }),

    vote: customerProcedure.input(z.object({ pollId: ID, optionId: ID })).mutation(async ({ input, ctx }) => {
      const me = ctx.customer.customerId;
      assertRateLimit("poll-vote", String(me), 60, 60_000);
      const db = getDb();
      const [poll] = await db.select().from(groupPolls).where(eq(groupPolls.id, input.pollId)).limit(1);
      if (!poll) throw new AppError("NOT_FOUND");
      if (poll.closedAt) throw new AppError("CONFLICT", { message: "Avstemningen er avsluttet." });
      await requireMember(db, poll.groupId, me);
      const [opt] = await db.select({ id: groupPollOptions.id }).from(groupPollOptions).where(and(eq(groupPollOptions.id, input.optionId), eq(groupPollOptions.pollId, poll.id))).limit(1);
      if (!opt) throw new AppError("VALIDATION", { message: "Ugyldig alternativ.", data: { field: "optionId" } });
      await db.insert(groupPollVotes).values({ pollId: poll.id, optionId: opt.id, customerId: me }).onDuplicateKeyUpdate({ set: { optionId: opt.id, createdAt: new Date() } });
      return (await pollViews(db, [poll.groupId], me)).find((p) => p.id === poll.id)!;
    }),

    close: customerProcedure.input(z.object({ pollId: ID })).mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [poll] = await db.select().from(groupPolls).where(eq(groupPolls.id, input.pollId)).limit(1);
      if (!poll) throw new AppError("NOT_FOUND");
      const members = await membersOf(db, poll.groupId);
      if (!(poll.createdById === ctx.customer.customerId || isGroupOwner(ctx.customer.customerId, members))) throw new AppError("FORBIDDEN");
      await db.update(groupPolls).set({ closedAt: new Date() }).where(eq(groupPolls.id, poll.id));
      return { ok: true };
    }),
  }),

  // ─── Rapportering ──────────────────────────────────────────────────────
  report: customerProcedure
    .input(z.object({ targetType: z.enum(["social_post", "social_comment", "customer"]), targetId: ID, reason: z.enum(["spam", "harassment", "inappropriate", "impersonation", "other"]), details: z.string().trim().max(500).optional() }))
    .mutation(async ({ input, ctx }) => {
      const me = ctx.customer.customerId;
      assertRateLimit("social-report", String(me), 10, 60 * 60_000);
      const db = getDb();
      const recent = await db.select({ id: contentReports.id }).from(contentReports).where(and(eq(contentReports.reporterId, me), eq(contentReports.targetType, input.targetType), eq(contentReports.targetId, input.targetId), gt(contentReports.createdAt, new Date(Date.now() - 24 * 60 * 60_000)))).limit(1);
      if (!recent.length) await db.insert(contentReports).values({ reporterId: me, targetType: input.targetType, targetId: input.targetId, reason: input.reason, details: input.details ? sanitizeText(input.details, 500) : null });
      await logAudit({ actorType: "customer", actorId: me, action: "social.reported", targetType: input.targetType, targetId: input.targetId, metadata: { reason: input.reason } });
      return { ok: true };
    }),
});
