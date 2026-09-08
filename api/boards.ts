import { z } from "zod";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { createRouter, customerProcedure, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { tripBoardComments, tripBoardItems, tripBoardVotes, tripBoards } from "../db/schema";
import { AppError } from "./lib/errors";
import { randomToken, sha256Hex } from "./lib/tokens";
import { SHARE_TOKEN_BYTES, SHARE_TOKEN_RE } from "../contracts/shareTokens";
import { assertRateLimit, clientIp } from "./lib/ratelimit";
import { env } from "./lib/env";

// ─── Reisetavler ─────────────────────────────────────────────────────────────
// «Ibiza med gutta», «Familie Kurdistan», «Sommer 2027». Eieren har konto og
// deler en privat lenke; alle med lenken kan legge til, stemme og kommentere
// med navn. Elementer er øyeblikksbilder (rute, dato, pris sett da) — en tavle
// er en idé, aldri en bestilling.

const TOKEN = z.string().regex(SHARE_TOKEN_RE);
const NAME = z.string().trim().min(1).max(40);
const VOTER = z.string().trim().min(8).max(64);
const MAX_BOARDS = 20;
const MAX_ITEMS = 60;

type BoardRow = typeof tripBoards.$inferSelect;

async function loadBoard(token: string): Promise<BoardRow> {
  const [row] = await getDb().select().from(tripBoards).where(eq(tripBoards.token, token)).limit(1);
  if (!row) throw new AppError("NOT_FOUND", { message: "Fant ikke tavla. Sjekk lenken." });
  return row;
}

function assertOwner(board: BoardRow, customerId: number | undefined) {
  if (!customerId || board.ownerCustomerId !== customerId) throw new AppError("FORBIDDEN", { message: "Bare eieren av tavla kan gjøre dette." });
}

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function boardView(board: BoardRow, viewer: { customerId?: number | null; voterKey?: string }) {
  const db = getDb();
  const [items, comments] = await Promise.all([
    db.select().from(tripBoardItems).where(eq(tripBoardItems.boardId, board.id)).orderBy(asc(tripBoardItems.createdAt)).limit(MAX_ITEMS),
    db.select().from(tripBoardComments).where(eq(tripBoardComments.boardId, board.id)).orderBy(asc(tripBoardComments.createdAt)).limit(200),
  ]);
  const votes = items.length ? await db.select().from(tripBoardVotes).where(inArray(tripBoardVotes.itemId, items.map((i) => i.id))) : [];
  const myKey = viewer.customerId ? `c:${viewer.customerId}` : viewer.voterKey ? sha256Hex(viewer.voterKey) : null;
  return {
    token: board.token,
    title: board.title,
    when: board.when,
    coverDestinationId: board.coverDestinationId,
    canEdit: Boolean(viewer.customerId && board.ownerCustomerId === viewer.customerId),
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
    shareUrl: `${env.baseUrl}/tavler/${board.token}`,
    items: items.map((i) => {
      const v = votes.filter((x) => x.itemId === i.id);
      return {
        id: i.id,
        kind: i.kind as "destination" | "flight" | "article" | "note",
        refId: i.refId,
        payload: parse<Record<string, unknown> | null>(i.payloadJson, null),
        note: i.note,
        addedByName: i.addedByName,
        votes: v.length,
        voters: v.map((x) => x.voterName),
        votedByMe: Boolean(myKey && v.some((x) => x.voterKey === myKey)),
        createdAt: i.createdAt.toISOString(),
      };
    }),
    comments: comments.map((c) => ({ id: c.id, name: c.authorName, body: c.body, createdAt: c.createdAt.toISOString() })),
  };
}

export const boardsRouter = createRouter({
  create: customerProcedure
    .input(z.object({ title: z.string().trim().min(1).max(80), when: z.string().trim().max(60).optional(), coverDestinationId: z.string().regex(/^[a-z-]{2,40}$/).optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [count] = await db.select({ n: sql<number>`count(*)` }).from(tripBoards).where(eq(tripBoards.ownerCustomerId, ctx.customer.customerId));
      if (Number(count?.n ?? 0) >= MAX_BOARDS) throw new AppError("VALIDATION", { message: `Du kan ha ${MAX_BOARDS} tavler. Slett en gammel for å lage en ny.` });
      const token = randomToken(SHARE_TOKEN_BYTES);
      await db.insert(tripBoards).values({ token, ownerCustomerId: ctx.customer.customerId, title: input.title, when: input.when ?? null, coverDestinationId: input.coverDestinationId ?? null });
      return { token, shareUrl: `${env.baseUrl}/tavler/${token}` };
    }),

  mine: customerProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db.select().from(tripBoards).where(eq(tripBoards.ownerCustomerId, ctx.customer.customerId)).orderBy(desc(tripBoards.updatedAt)).limit(MAX_BOARDS);
    const counts = rows.length
      ? await db
          .select({ boardId: tripBoardItems.boardId, n: sql<number>`count(*)` })
          .from(tripBoardItems)
          .where(inArray(tripBoardItems.boardId, rows.map((r) => r.id)))
          .groupBy(tripBoardItems.boardId)
      : [];
    return rows.map((b) => ({
      token: b.token,
      title: b.title,
      when: b.when,
      coverDestinationId: b.coverDestinationId,
      items: Number(counts.find((c) => c.boardId === b.id)?.n ?? 0),
      updatedAt: b.updatedAt.toISOString(),
    }));
  }),

  get: publicQuery.input(z.object({ token: TOKEN, voterKey: VOTER.optional() })).query(async ({ input, ctx }) => {
    const board = await loadBoard(input.token);
    return boardView(board, { customerId: ctx.customer?.customerId ?? null, voterKey: input.voterKey });
  }),

  update: customerProcedure
    .input(z.object({ token: TOKEN, title: z.string().trim().min(1).max(80).optional(), when: z.string().trim().max(60).nullable().optional(), coverDestinationId: z.string().regex(/^[a-z-]{2,40}$/).nullable().optional() }))
    .mutation(async ({ input, ctx }) => {
      const board = await loadBoard(input.token);
      assertOwner(board, ctx.customer.customerId);
      const patch: Partial<typeof tripBoards.$inferInsert> = {};
      if (input.title) patch.title = input.title;
      if (input.when !== undefined) patch.when = input.when;
      if (input.coverDestinationId !== undefined) patch.coverDestinationId = input.coverDestinationId;
      if (Object.keys(patch).length) await getDb().update(tripBoards).set(patch).where(eq(tripBoards.id, board.id));
      return { ok: true };
    }),

  remove: customerProcedure.input(z.object({ token: TOKEN })).mutation(async ({ input, ctx }) => {
    const board = await loadBoard(input.token);
    assertOwner(board, ctx.customer.customerId);
    const db = getDb();
    const items = await db.select({ id: tripBoardItems.id }).from(tripBoardItems).where(eq(tripBoardItems.boardId, board.id));
    if (items.length) await db.delete(tripBoardVotes).where(inArray(tripBoardVotes.itemId, items.map((i) => i.id)));
    await db.delete(tripBoardItems).where(eq(tripBoardItems.boardId, board.id));
    await db.delete(tripBoardComments).where(eq(tripBoardComments.boardId, board.id));
    await db.delete(tripBoards).where(eq(tripBoards.id, board.id));
    return { ok: true };
  }),

  /** Alle med lenken kan legge til — med navn. Eieren trenger ikke oppgi navn. */
  addItem: publicQuery
    .input(
      z.object({
        token: TOKEN,
        kind: z.enum(["destination", "flight", "article", "note"]),
        refId: z.string().trim().max(120).optional(),
        payload: z.record(z.string(), z.unknown()).optional(),
        note: z.string().trim().max(500).optional(),
        name: NAME.optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertRateLimit("board-add", clientIp(ctx.req), 60, 60 * 60_000);
      const board = await loadBoard(input.token);
      const isOwner = ctx.customer?.customerId === board.ownerCustomerId;
      const name = isOwner ? ctx.customer!.firstName : input.name;
      if (!name) throw new AppError("VALIDATION", { message: "Skriv navnet ditt, så vet de andre hvem som la det til.", data: { field: "name" } });
      if (input.kind === "note" && !input.note) throw new AppError("VALIDATION", { message: "Notatet er tomt.", data: { field: "note" } });
      const db = getDb();
      const [count] = await db.select({ n: sql<number>`count(*)` }).from(tripBoardItems).where(eq(tripBoardItems.boardId, board.id));
      if (Number(count?.n ?? 0) >= MAX_ITEMS) throw new AppError("VALIDATION", { message: `Tavla er full (${MAX_ITEMS} elementer).` });
      const res = await db.insert(tripBoardItems).values({
        boardId: board.id,
        kind: input.kind,
        refId: input.refId ?? null,
        payloadJson: input.payload ? JSON.stringify(input.payload).slice(0, 8000) : null,
        note: input.note ?? null,
        addedByName: name,
        addedByCustomerId: ctx.customer?.customerId ?? null,
      });
      await db.update(tripBoards).set({ updatedAt: new Date() }).where(eq(tripBoards.id, board.id));
      return { id: Number(res[0].insertId) };
    }),

  removeItem: customerProcedure.input(z.object({ token: TOKEN, itemId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const board = await loadBoard(input.token);
    assertOwner(board, ctx.customer.customerId);
    const db = getDb();
    await db.delete(tripBoardVotes).where(eq(tripBoardVotes.itemId, input.itemId));
    await db.delete(tripBoardItems).where(and(eq(tripBoardItems.id, input.itemId), eq(tripBoardItems.boardId, board.id)));
    return { ok: true };
  }),

  /** Stem med navn. Innloggede stemmer som seg selv; gjester med nettleserens nøkkel. Samme kall igjen fjerner stemmen. */
  vote: publicQuery.input(z.object({ token: TOKEN, itemId: z.number().int().positive(), voterKey: VOTER.optional(), name: NAME.optional() })).mutation(async ({ input, ctx }) => {
    const board = await loadBoard(input.token);
    const db = getDb();
    const [item] = await db.select({ id: tripBoardItems.id }).from(tripBoardItems).where(and(eq(tripBoardItems.id, input.itemId), eq(tripBoardItems.boardId, board.id))).limit(1);
    if (!item) throw new AppError("NOT_FOUND");
    const key = ctx.customer ? `c:${ctx.customer.customerId}` : input.voterKey ? sha256Hex(input.voterKey) : null;
    const name = ctx.customer ? ctx.customer.firstName : input.name;
    if (!key || !name) throw new AppError("VALIDATION", { message: "Skriv navnet ditt for å stemme.", data: { field: "name" } });
    const existing = await db.select({ id: tripBoardVotes.id }).from(tripBoardVotes).where(and(eq(tripBoardVotes.itemId, item.id), eq(tripBoardVotes.voterKey, key))).limit(1);
    if (existing[0]) {
      await db.delete(tripBoardVotes).where(eq(tripBoardVotes.id, existing[0].id));
      return { voted: false };
    }
    await db.insert(tripBoardVotes).values({ itemId: item.id, voterKey: key, voterName: name });
    return { voted: true };
  }),

  comment: publicQuery.input(z.object({ token: TOKEN, body: z.string().trim().min(1).max(500), name: NAME.optional() })).mutation(async ({ input, ctx }) => {
    assertRateLimit("board-comment", clientIp(ctx.req), 60, 60 * 60_000);
    const board = await loadBoard(input.token);
    const name = ctx.customer ? ctx.customer.firstName : input.name;
    if (!name) throw new AppError("VALIDATION", { message: "Skriv navnet ditt for å kommentere.", data: { field: "name" } });
    await getDb().insert(tripBoardComments).values({ boardId: board.id, authorName: name, authorCustomerId: ctx.customer?.customerId ?? null, body: input.body });
    return { ok: true };
  }),
});
