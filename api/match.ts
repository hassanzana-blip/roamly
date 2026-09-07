import { z } from "zod";
import { and, asc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { createRouter, customerProcedure, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { matchComments, matchParticipants, matchSessions, matchVotes } from "../db/schema";
import { agreementOf, QUIZ_DESTINATIONS, scoreGroup, type QuizAnswers } from "../contracts/quiz";
import { AppError } from "./lib/errors";
import { randomToken, sha256Hex } from "./lib/tokens";
import { assertRateLimit, clientIp } from "./lib/ratelimit";
import { env } from "./lib/env";

// ─── ReiseMatch: Par og venner ───────────────────────────────────────────────
// Person A svarer og får en lenke. B (og C, D …) svarer hver for seg. Vi viser
// enigheten og felles kandidater — aldri hverandres rå svar. Budsjett vises
// bare når alle har sagt ja. Ingen konto nødvendig: eier og deltaker holder
// hver sin hemmelige nøkkel (lagres i nettleseren, hashes hos oss).

const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
const MAX_PARTICIPANTS = 10;
const NAME = z.string().trim().min(1).max(40);
const TOKEN = z.string().regex(/^[a-f0-9]{24}$/);
const KEY = z.string().regex(/^[a-f0-9]{32}$/);
const DEST = z.string().regex(/^[a-z-]{2,40}$/);

const answersSchema = z.object({
  company: z.enum(["solo", "date", "family", "friends"]).optional(),
  mood: z.enum(["romance", "adventure", "relax", "city"]).optional(),
  weather: z.enum(["hot", "mild", "cold", "any"]).optional(),
  sights: z.enum(["beach", "landmarks", "nature", "food"]).optional(),
  budget: z.enum(["low", "mid", "high"]).optional(),
});
const unavailableSchema = z.array(z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).max(12);

type SessionRow = typeof matchSessions.$inferSelect;
type ParticipantRow = typeof matchParticipants.$inferSelect;

async function loadSession(token: string): Promise<SessionRow> {
  const [row] = await getDb().select().from(matchSessions).where(and(eq(matchSessions.token, token), gt(matchSessions.expiresAt, new Date()))).limit(1);
  if (!row) throw new AppError("NOT_FOUND", { message: "Denne lenken finnes ikke lenger. Lag en ny match, så får du en fersk lenke." });
  return row;
}

async function loadParticipant(session: SessionRow, participantKey: string): Promise<ParticipantRow> {
  const [row] = await getDb()
    .select()
    .from(matchParticipants)
    .where(and(eq(matchParticipants.sessionId, session.id), eq(matchParticipants.keyHash, sha256Hex(participantKey))))
    .limit(1);
  if (!row) throw new AppError("FORBIDDEN", { message: "Vi finner ikke svarene dine i denne matchen. Bli med på nytt fra lenken." });
  return row;
}

function parseAnswers(raw: string): QuizAnswers {
  try {
    return answersSchema.parse(JSON.parse(raw));
  } catch {
    return {};
  }
}

const destinationView = (id: string) => {
  const d = QUIZ_DESTINATIONS.find((x) => x.id === id);
  return d ? { id: d.id, city: d.city, country: d.country, iata: d.iata, image: d.image, tagline: d.tagline, romance: d.romance } : null;
};

/** Alt en deltaker (eller eieren) kan se — aldri de andres rå svar. */
async function sessionView(session: SessionRow, viewer: { participantId?: number; ownerKey?: string; customerId?: number | null }) {
  const db = getDb();
  const [participants, votes, comments] = await Promise.all([
    db.select().from(matchParticipants).where(eq(matchParticipants.sessionId, session.id)).orderBy(asc(matchParticipants.createdAt)),
    db.select().from(matchVotes).where(eq(matchVotes.sessionId, session.id)),
    db.select().from(matchComments).where(eq(matchComments.sessionId, session.id)).orderBy(asc(matchComments.createdAt)).limit(200),
  ]);
  const isOwner = Boolean((viewer.ownerKey && session.ownerKeyHash === sha256Hex(viewer.ownerKey)) || (viewer.customerId && session.ownerCustomerId === viewer.customerId));
  const includeBudget = participants.length > 0 && participants.every((p) => p.shareBudget);
  const answers = participants.map((p) => parseAnswers(p.answersJson));
  const ready = session.mode === "couple" ? participants.length >= 2 : participants.length >= 1;
  const couple = session.mode === "couple";

  const results = ready ? scoreGroup(answers, includeBudget).slice(0, couple ? 3 : 6) : [];
  const tally = new Map<string, { up: number; down: number; names: string[] }>();
  for (const v of votes) {
    const cur = tally.get(v.destinationId) ?? { up: 0, down: 0, names: [] };
    if (v.value > 0) {
      cur.up += 1;
      cur.names.push(participants.find((p) => p.id === v.participantId)?.name ?? "?");
    } else cur.down += 1;
    tally.set(v.destinationId, cur);
  }
  const myVotes = viewer.participantId ? votes.filter((v) => v.participantId === viewer.participantId).map((v) => ({ destinationId: v.destinationId, value: v.value })) : [];
  const me = viewer.participantId ? participants.find((p) => p.id === viewer.participantId) : undefined;

  // Datoer ingen kan: flettet, så gruppen ser «hold unna»-perioder uten navn.
  const unavailable = participants.flatMap((p) => {
    try {
      return (p.unavailableJson ? (JSON.parse(p.unavailableJson) as { from: string; to: string }[]) : []).map((r) => ({ ...r, name: p.name }));
    } catch {
      return [];
    }
  });

  return {
    token: session.token,
    mode: session.mode as "couple" | "friends",
    title: session.title,
    isOwner,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    participants: participants.map((p) => ({ id: p.id, name: p.name, sharedBudget: p.shareBudget, isYou: p.id === viewer.participantId })),
    maxParticipants: couple ? 2 : MAX_PARTICIPANTS,
    ready,
    includeBudget,
    agreement: ready ? agreementOf(answers, includeBudget) : {},
    results: results.map((r) => ({
      destination: destinationView(r.destination.id)!,
      floor: r.floor,
      inTopThree: r.inTopThree,
      votes: tally.get(r.destination.id) ?? { up: 0, down: 0, names: [] },
    })),
    myAnswers: me ? parseAnswers(me.answersJson) : null,
    myVotes,
    unavailable,
    comments: comments.map((c) => ({ id: c.id, name: participants.find((p) => p.id === c.participantId)?.name ?? "?", body: c.body, createdAt: c.createdAt.toISOString() })),
    decided: session.decidedDestinationId ? destinationView(session.decidedDestinationId) : null,
    shareUrl: `${env.baseUrl}/m/${session.token}`,
  };
}

export const matchRouter = createRouter({
  create: publicQuery
    .input(z.object({ mode: z.enum(["couple", "friends"]), title: z.string().trim().max(80).optional(), name: NAME, answers: answersSchema, shareBudget: z.boolean().optional() }))
    .mutation(async ({ input, ctx }) => {
      assertRateLimit("match-create", clientIp(ctx.req), 10, 60 * 60_000);
      const db = getDb();
      const token = randomToken(12);
      const ownerKey = randomToken(16);
      const participantKey = randomToken(16);
      const title = input.title?.trim() || (input.mode === "couple" ? `${input.name} + …` : `${input.name} sin tur`);
      const res = await db.insert(matchSessions).values({
        token,
        mode: input.mode,
        title: title.slice(0, 80),
        ownerCustomerId: ctx.customer?.customerId ?? null,
        ownerKeyHash: sha256Hex(ownerKey),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      });
      const sessionId = Number(res[0].insertId);
      const p = await db.insert(matchParticipants).values({
        sessionId,
        name: input.name,
        customerId: ctx.customer?.customerId ?? null,
        keyHash: sha256Hex(participantKey),
        answersJson: JSON.stringify(input.answers),
        shareBudget: input.shareBudget ?? false,
      });
      return { token, ownerKey, participantKey, participantId: Number(p[0].insertId), shareUrl: `${env.baseUrl}/m/${token}` };
    }),

  get: publicQuery.input(z.object({ token: TOKEN, participantKey: KEY.optional(), ownerKey: KEY.optional() })).query(async ({ input, ctx }) => {
    const session = await loadSession(input.token);
    const me = input.participantKey ? await loadParticipant(session, input.participantKey).catch(() => null) : null;
    return sessionView(session, { participantId: me?.id, ownerKey: input.ownerKey, customerId: ctx.customer?.customerId ?? null });
  }),

  join: publicQuery
    .input(z.object({ token: TOKEN, name: NAME, answers: answersSchema, shareBudget: z.boolean().optional(), unavailable: unavailableSchema.optional() }))
    .mutation(async ({ input, ctx }) => {
      assertRateLimit("match-join", clientIp(ctx.req), 30, 60 * 60_000);
      const session = await loadSession(input.token);
      const db = getDb();
      const [count] = await db.select({ n: sql<number>`count(*)` }).from(matchParticipants).where(eq(matchParticipants.sessionId, session.id));
      const max = session.mode === "couple" ? 2 : MAX_PARTICIPANTS;
      if (Number(count?.n ?? 0) >= max) {
        throw new AppError("CONFLICT", { message: session.mode === "couple" ? "Begge har allerede svart i denne matchen." : `Rommet er fullt (${max} deltakere).` });
      }
      const participantKey = randomToken(16);
      const p = await db.insert(matchParticipants).values({
        sessionId: session.id,
        name: input.name,
        customerId: ctx.customer?.customerId ?? null,
        keyHash: sha256Hex(participantKey),
        answersJson: JSON.stringify(input.answers),
        shareBudget: input.shareBudget ?? false,
        unavailableJson: input.unavailable ? JSON.stringify(input.unavailable) : null,
      });
      return { participantKey, participantId: Number(p[0].insertId) };
    }),

  update: publicQuery
    .input(z.object({ token: TOKEN, participantKey: KEY, answers: answersSchema.optional(), shareBudget: z.boolean().optional(), unavailable: unavailableSchema.optional() }))
    .mutation(async ({ input }) => {
      const session = await loadSession(input.token);
      const me = await loadParticipant(session, input.participantKey);
      const patch: Partial<typeof matchParticipants.$inferInsert> = {};
      if (input.answers) patch.answersJson = JSON.stringify(input.answers);
      if (input.shareBudget !== undefined) patch.shareBudget = input.shareBudget;
      if (input.unavailable) patch.unavailableJson = JSON.stringify(input.unavailable);
      if (Object.keys(patch).length) await getDb().update(matchParticipants).set(patch).where(eq(matchParticipants.id, me.id));
      return { ok: true };
    }),

  vote: publicQuery
    .input(z.object({ token: TOKEN, participantKey: KEY, destinationId: DEST, value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) }))
    .mutation(async ({ input }) => {
      const session = await loadSession(input.token);
      const me = await loadParticipant(session, input.participantKey);
      if (!QUIZ_DESTINATIONS.some((d) => d.id === input.destinationId)) throw new AppError("VALIDATION", { message: "Ukjent reisemål." });
      const db = getDb();
      if (input.value === 0) {
        await db.delete(matchVotes).where(and(eq(matchVotes.participantId, me.id), eq(matchVotes.destinationId, input.destinationId)));
      } else {
        await db
          .insert(matchVotes)
          .values({ sessionId: session.id, participantId: me.id, destinationId: input.destinationId, value: input.value })
          .onDuplicateKeyUpdate({ set: { value: input.value } });
      }
      return { ok: true };
    }),

  comment: publicQuery.input(z.object({ token: TOKEN, participantKey: KEY, body: z.string().trim().min(1).max(500) })).mutation(async ({ input, ctx }) => {
    assertRateLimit("match-comment", clientIp(ctx.req), 60, 60 * 60_000);
    const session = await loadSession(input.token);
    const me = await loadParticipant(session, input.participantKey);
    await getDb().insert(matchComments).values({ sessionId: session.id, participantId: me.id, body: input.body });
    return { ok: true };
  }),

  /** Eieren setter «vi drar hit» — resten ser det som avgjort. */
  decide: publicQuery.input(z.object({ token: TOKEN, ownerKey: KEY.optional(), destinationId: DEST.nullable() })).mutation(async ({ input, ctx }) => {
    const session = await loadSession(input.token);
    const isOwner = (input.ownerKey && session.ownerKeyHash === sha256Hex(input.ownerKey)) || (ctx.customer && session.ownerCustomerId === ctx.customer.customerId);
    if (!isOwner) throw new AppError("FORBIDDEN", { message: "Bare den som opprettet rommet kan avgjøre." });
    await getDb().update(matchSessions).set({ decidedDestinationId: input.destinationId }).where(eq(matchSessions.id, session.id));
    return { ok: true };
  }),

  /** Innlogget: matcher jeg eier eller deltar i. */
  mine: customerProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const mineIds = await db
      .select({ id: matchParticipants.sessionId })
      .from(matchParticipants)
      .where(eq(matchParticipants.customerId, ctx.customer.customerId));
    const ids = mineIds.map((r) => r.id);
    const rows = await db
      .select()
      .from(matchSessions)
      .where(and(gt(matchSessions.expiresAt, new Date()), or(eq(matchSessions.ownerCustomerId, ctx.customer.customerId), ids.length ? inArray(matchSessions.id, ids) : sql`0`)))
      .orderBy(asc(matchSessions.createdAt))
      .limit(30);
    const counts = rows.length
      ? await db
          .select({ sessionId: matchParticipants.sessionId, n: sql<number>`count(*)` })
          .from(matchParticipants)
          .where(inArray(matchParticipants.sessionId, rows.map((r) => r.id)))
          .groupBy(matchParticipants.sessionId)
      : [];
    return rows.map((s) => ({
      token: s.token,
      mode: s.mode as "couple" | "friends",
      title: s.title,
      participants: Number(counts.find((c) => c.sessionId === s.id)?.n ?? 0),
      decided: s.decidedDestinationId ? destinationView(s.decidedDestinationId) : null,
      createdAt: s.createdAt.toISOString(),
    }));
  }),
});
