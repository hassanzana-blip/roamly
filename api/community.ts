import { z } from "zod";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { createRouter, customerProcedure, permittedProcedure, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  communityComments,
  communityLikes,
  communityPosts,
  customerAccounts,
} from "../db/schema";
import { assertRateLimit, clientIp } from "./lib/ratelimit";
import { AppError } from "./lib/errors";
import { logAudit } from "./lib/audit";
import { isDuplicateKeyError } from "./lib/jobs";

/**
 * Samfunn — kundenes egen møteplass: reisetips, spørsmål og svar.
 * Alle kan lese; kun innloggede kunder kan skrive. Moderering via
 * `hidden`-flagg (support kan skjule/vise, forfatter kan slette sitt eget).
 * Rapporter logges i auditLogs (`community.reported`) — ingen egen tabell.
 */

const POST_MAX = 2000;
const COMMENT_MAX = 1000;

/** Fjern kontrolltegn (unntatt linjeskift/tab), normaliser og trim (OTA-150). */
export function sanitizeText(raw: string, max: number): string {
  return raw
    .normalize("NFC")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\uFEFF]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

/** Visningsnavn: fornavn + første bokstav i etternavn — aldri full identitet. */
function displayName(first: string, last: string) {
  return `${first} ${last.charAt(0).toUpperCase()}.`;
}

const PAGE = 12;
const routeTagSchema = z.string().trim().regex(/^[A-Z]{3}[–-][A-Z]{3}$/).optional();

export const communityRouter = createRouter({
  /** Feed — nyeste først, valgfritt kun spørsmål eller kun reisetips. */
  feed: publicQuery
    .input(
      z.object({
        kind: z.enum(["all", "question", "story"]).default("all"),
        before: z.number().int().positive().optional(), // paginering: post-id
      }),
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conds = [eq(communityPosts.hidden, false)];
      if (input.kind !== "all") conds.push(eq(communityPosts.kind, input.kind));
      if (input.before) conds.push(lt(communityPosts.id, input.before));
      const rows = await db
        .select({
          id: communityPosts.id,
          kind: communityPosts.kind,
          body: communityPosts.body,
          routeTag: communityPosts.routeTag,
          likes: communityPosts.likes,
          createdAt: communityPosts.createdAt,
          customerId: communityPosts.customerId,
          firstName: customerAccounts.firstName,
          lastName: customerAccounts.lastName,
          avatarUrl: customerAccounts.avatarUrl,
          commentCount: sql<number>`(select count(*) from ${communityComments} where ${communityComments.postId} = ${communityPosts.id} and ${communityComments.hidden} = false)`,
        })
        .from(communityPosts)
        .innerJoin(customerAccounts, eq(customerAccounts.id, communityPosts.customerId))
        .where(and(...conds))
        .orderBy(desc(communityPosts.id))
        .limit(PAGE + 1);

      const liked = new Set<number>();
      const pageRows = rows.slice(0, PAGE);
      if (ctx.customer && pageRows.length) {
        const mine = await db
          .select({ postId: communityLikes.postId })
          .from(communityLikes)
          .where(
            and(
              eq(communityLikes.customerId, ctx.customer.customerId),
              inArray(communityLikes.postId, pageRows.map((r) => r.id)),
            ),
          );
        mine.forEach((m) => liked.add(m.postId));
      }

      const hasMore = rows.length > PAGE;
      const posts = pageRows.map((r) => ({
        id: r.id,
        kind: r.kind as "question" | "story",
        body: r.body,
        routeTag: r.routeTag,
        likes: r.likes,
        commentCount: Number(r.commentCount),
        createdAt: r.createdAt,
        author: displayName(r.firstName, r.lastName),
        avatarUrl: r.avatarUrl,
        mine: ctx.customer?.customerId === r.customerId,
        likedByMe: liked.has(r.id),
      }));
      return { posts, nextBefore: hasMore ? posts[posts.length - 1].id : null };
    }),

  /** Kommentarer til et innlegg. */
  comments: publicQuery
    .input(z.object({ postId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db
        .select({
          id: communityComments.id,
          body: communityComments.body,
          createdAt: communityComments.createdAt,
          customerId: communityComments.customerId,
          firstName: customerAccounts.firstName,
          lastName: customerAccounts.lastName,
          avatarUrl: customerAccounts.avatarUrl,
        })
        .from(communityComments)
        .innerJoin(customerAccounts, eq(customerAccounts.id, communityComments.customerId))
        .innerJoin(communityPosts, eq(communityPosts.id, communityComments.postId))
        .where(and(eq(communityComments.postId, input.postId), eq(communityComments.hidden, false), eq(communityPosts.hidden, false)))
        .orderBy(communityComments.id)
        .limit(100);
      return rows.map((r) => ({
        id: r.id,
        body: r.body,
        createdAt: r.createdAt,
        author: displayName(r.firstName, r.lastName),
        avatarUrl: r.avatarUrl,
        mine: ctx.customer?.customerId === r.customerId,
      }));
    }),

  createPost: customerProcedure
    .input(
      z.object({
        kind: z.enum(["question", "story"]).default("story"),
        body: z.string().min(2).max(POST_MAX + 200),
        routeTag: routeTagSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertRateLimit("community-post", clientIp(ctx.req), 8, 60_000);
      assertRateLimit("community-post-acct", String(ctx.customer.customerId), 20, 60 * 60_000);
      const body = sanitizeText(input.body, POST_MAX);
      if (body.length < 2) throw new AppError("VALIDATION", { message: "Innlegget er for kort.", data: { field: "body" } });
      const result = await getDb().insert(communityPosts).values({
        customerId: ctx.customer.customerId,
        kind: input.kind,
        body,
        routeTag: input.routeTag?.replace("-", "–") ?? null,
      });
      return { id: Number(result[0].insertId) };
    }),

  createComment: customerProcedure
    .input(
      z.object({
        postId: z.number().int().positive(),
        body: z.string().min(1).max(COMMENT_MAX + 200),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertRateLimit("community-comment", clientIp(ctx.req), 15, 60_000);
      assertRateLimit("community-comment-acct", String(ctx.customer.customerId), 60, 60 * 60_000);
      const body = sanitizeText(input.body, COMMENT_MAX);
      if (!body) throw new AppError("VALIDATION", { message: "Kommentaren kan ikke være tom.", data: { field: "body" } });
      const db = getDb();
      const post = (
        await db
          .select({ id: communityPosts.id })
          .from(communityPosts)
          .where(and(eq(communityPosts.id, input.postId), eq(communityPosts.hidden, false)))
          .limit(1)
      )[0];
      if (!post) throw new AppError("NOT_FOUND", { message: "Innlegget finnes ikke." });
      const result = await db.insert(communityComments).values({
        postId: input.postId,
        customerId: ctx.customer.customerId,
        body,
      });
      return { id: Number(result[0].insertId) };
    }),

  /**
   * Liker av/på — én per kunde per innlegg. Unik nøkkel (postId, customerId)
   * + transaksjon gjør telleren korrekt selv ved dobbeltklikk/parallelle kall.
   */
  toggleLike: customerProcedure
    .input(z.object({ postId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      assertRateLimit("community-like", clientIp(ctx.req), 30, 60_000);
      const db = getDb();
      const customerId = ctx.customer.customerId;
      const post = (
        await db
          .select({ id: communityPosts.id })
          .from(communityPosts)
          .where(and(eq(communityPosts.id, input.postId), eq(communityPosts.hidden, false)))
          .limit(1)
      )[0];
      if (!post) throw new AppError("NOT_FOUND", { message: "Innlegget finnes ikke." });

      return db.transaction(async (tx) => {
        // Forsøk å like først; ER_DUP_ENTRY betyr at liken finnes → fjern den
        try {
          await tx.insert(communityLikes).values({ postId: input.postId, customerId });
        } catch (err) {
          if (!isDuplicateKeyError(err)) throw err;
          const del = await tx
            .delete(communityLikes)
            .where(and(eq(communityLikes.postId, input.postId), eq(communityLikes.customerId, customerId)));
          if (Number(del[0].affectedRows) > 0) {
            await tx
              .update(communityPosts)
              .set({ likes: sql`greatest(0, ${communityPosts.likes} - 1)` })
              .where(eq(communityPosts.id, input.postId));
          }
          return { liked: false };
        }
        await tx
          .update(communityPosts)
          .set({ likes: sql`${communityPosts.likes} + 1` })
          .where(eq(communityPosts.id, input.postId));
        return { liked: true };
      });
    }),

  /** Slett eget innlegg (kommentarer/likes kaskaderer via FK). */
  deletePost: customerProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const result = await db
        .delete(communityPosts)
        .where(and(eq(communityPosts.id, input.id), eq(communityPosts.customerId, ctx.customer.customerId)));
      if (Number(result[0].affectedRows) === 0) {
        // Ikke ditt innlegg (eller finnes ikke) — ingen kaskade, ingen lekkasje
        throw new AppError("NOT_FOUND", { message: "Innlegget finnes ikke, eller det er ikke ditt." });
      }
      // Eksplisitt opprydding i tilfelle FK-kaskade ikke er aktivert i DB-en
      await db.delete(communityComments).where(eq(communityComments.postId, input.id));
      await db.delete(communityLikes).where(eq(communityLikes.postId, input.id));
      return { ok: true };
    }),

  deleteComment: customerProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const result = await getDb()
        .delete(communityComments)
        .where(and(eq(communityComments.id, input.id), eq(communityComments.customerId, ctx.customer.customerId)));
      if (Number(result[0].affectedRows) === 0) {
        throw new AppError("NOT_FOUND", { message: "Kommentaren finnes ikke, eller den er ikke din." });
      }
      return { ok: true };
    }),

  /** Rapporter innlegg/kommentar — logges for support (ingen egen tabell). */
  report: customerProcedure
    .input(
      z.object({
        targetType: z.enum(["post", "comment"]),
        targetId: z.number().int().positive(),
        reason: z.enum(["spam", "harassment", "misinformation", "other"]).default("other"),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertRateLimit("community-report", String(ctx.customer.customerId), 10, 60 * 60_000);
      const db = getDb();
      const exists =
        input.targetType === "post"
          ? await db.select({ id: communityPosts.id }).from(communityPosts).where(eq(communityPosts.id, input.targetId)).limit(1)
          : await db.select({ id: communityComments.id }).from(communityComments).where(eq(communityComments.id, input.targetId)).limit(1);
      if (!exists.length) throw new AppError("NOT_FOUND");
      await logAudit({
        actorType: "customer",
        actorId: ctx.customer.customerId,
        action: "community.reported",
        targetType: `community_${input.targetType}`,
        targetId: input.targetId,
        ip: clientIp(ctx.req),
        metadata: { reason: input.reason, note: input.note ? sanitizeText(input.note, 500) : undefined },
      });
      return { ok: true };
    }),

  /** Teller for profilsiden — kundens egne innlegg. */
  myStats: customerProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const [row] = await db
      .select({ posts: sql<number>`count(*)`, likes: sql<number>`coalesce(sum(${communityPosts.likes}),0)` })
      .from(communityPosts)
      .where(eq(communityPosts.customerId, ctx.customer.customerId));
    return { posts: Number(row?.posts ?? 0), likesReceived: Number(row?.likes ?? 0) };
  }),

  // ─── Moderering (support:write) ──────────────────────────────────────────

  adminList: permittedProcedure("support:write")
    .input(
      z.object({
        hidden: z.enum(["all", "hidden", "visible"]).default("all"),
        before: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conds = [];
      if (input.hidden === "hidden") conds.push(eq(communityPosts.hidden, true));
      if (input.hidden === "visible") conds.push(eq(communityPosts.hidden, false));
      if (input.before) conds.push(lt(communityPosts.id, input.before));
      const rows = await db
        .select({
          id: communityPosts.id,
          kind: communityPosts.kind,
          body: communityPosts.body,
          routeTag: communityPosts.routeTag,
          likes: communityPosts.likes,
          hidden: communityPosts.hidden,
          createdAt: communityPosts.createdAt,
          customerId: communityPosts.customerId,
          authorName: sql<string>`concat(${customerAccounts.firstName}, ' ', ${customerAccounts.lastName})`,
          authorEmail: customerAccounts.email,
          commentCount: sql<number>`(select count(*) from ${communityComments} where ${communityComments.postId} = ${communityPosts.id})`,
        })
        .from(communityPosts)
        .innerJoin(customerAccounts, eq(customerAccounts.id, communityPosts.customerId))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(communityPosts.id))
        .limit(input.limit + 1);
      const hasMore = rows.length > input.limit;
      const posts = rows.slice(0, input.limit).map((r) => ({ ...r, commentCount: Number(r.commentCount) }));
      return { posts, nextBefore: hasMore ? posts[posts.length - 1].id : null };
    }),

  adminHide: permittedProcedure("support:write")
    .input(z.object({ targetType: z.enum(["post", "comment"]), id: z.number().int().positive(), reason: z.string().max(200).optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const result =
        input.targetType === "post"
          ? await db.update(communityPosts).set({ hidden: true }).where(eq(communityPosts.id, input.id))
          : await db.update(communityComments).set({ hidden: true }).where(eq(communityComments.id, input.id));
      if (Number(result[0].affectedRows) === 0) throw new AppError("NOT_FOUND");
      await logAudit({
        actorType: "staff", actorId: ctx.staff.userId, actorLabel: ctx.staff.name,
        action: "community.hidden", targetType: `community_${input.targetType}`, targetId: input.id,
        metadata: { reason: input.reason }, ip: clientIp(ctx.req),
      });
      return { ok: true };
    }),

  adminUnhide: permittedProcedure("support:write")
    .input(z.object({ targetType: z.enum(["post", "comment"]), id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const result =
        input.targetType === "post"
          ? await db.update(communityPosts).set({ hidden: false }).where(eq(communityPosts.id, input.id))
          : await db.update(communityComments).set({ hidden: false }).where(eq(communityComments.id, input.id));
      if (Number(result[0].affectedRows) === 0) throw new AppError("NOT_FOUND");
      await logAudit({
        actorType: "staff", actorId: ctx.staff.userId, actorLabel: ctx.staff.name,
        action: "community.unhidden", targetType: `community_${input.targetType}`, targetId: input.id, ip: clientIp(ctx.req),
      });
      return { ok: true };
    }),
});
