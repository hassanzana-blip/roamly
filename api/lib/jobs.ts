import { and, asc, eq, lte, or, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { jobs } from "../../db/schema";
import { log } from "./logger";
import { inc } from "./metrics";

export type JobStatus = "pending" | "claimed" | "done" | "failed" | "dead";

const LOCK_TIMEOUT_MS = 5 * 60_000;

export type EnqueueOptions = {
  /** Idempotency key. Only ONE active (pending/claimed/failed) job per key may exist. */
  dedupeKey?: string;
  runAt?: Date;
  maxAttempts?: number;
  /** Lower runs first. Default 5. */
  priority?: number;
};

export type EnqueueResult = { enqueued: boolean; id?: number };

/** MySQL duplicate-key detection (ER_DUP_ENTRY / errno 1062). */
export function isDuplicateKeyError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; errno?: unknown; cause?: unknown };
  if (e.code === "ER_DUP_ENTRY" || e.errno === 1062) return true;
  // drizzle may wrap the driver error
  return isDuplicateKeyError(e.cause);
}

/**
 * Legg en jobb i outboxen (OTA-121).
 * Dedupe skjer via den unike indeksen på `active_dedupe_key`: nøkkelen er satt
 * så lenge jobben er aktiv og nulles ved done/dead. Vi prøver INSERT og fanger
 * ER_DUP_ENTRY — dermed ingen select-then-insert race mellom flere prosesser.
 */
export async function enqueueJob(
  type: string,
  payload: Record<string, unknown>,
  opts: EnqueueOptions = {},
): Promise<EnqueueResult> {
  const db = getDb();
  try {
    const result = await db.insert(jobs).values({
      type,
      payload: JSON.stringify(payload),
      runAt: opts.runAt ?? new Date(),
      maxAttempts: opts.maxAttempts ?? 5,
      dedupeKey: opts.dedupeKey ?? null,
      activeDedupeKey: opts.dedupeKey ?? null,
      priority: opts.priority ?? 5,
    });
    return { enqueued: true, id: Number(result[0].insertId) };
  } catch (err) {
    if (opts.dedupeKey && isDuplicateKeyError(err)) {
      // Samme semantikk som INSERT ... ON DUPLICATE KEY UPDATE id=id: stille no-op.
      log.debug({ type, dedupeKey: opts.dedupeKey }, "job dedupe: already active");
      return { enqueued: false };
    }
    throw err;
  }
}

export type ClaimedJob = {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  priority: number;
};

/**
 * Hent neste jobb — kun én worker kan clame den.
 * Bruker atomisk UPDATE ... WHERE status IN ('pending','failed') som claim-mekanisme,
 * og frigjør utløpte låser fra krasjede workere. Rekkefølge: priority ASC, id ASC.
 */
export async function claimNextJob(workerId: string): Promise<ClaimedJob | null> {
  const db = getDb();
  const lockCutoff = new Date(Date.now() - LOCK_TIMEOUT_MS);

  // Frigjør jobber hvis worker krasjet midt i behandling
  await db
    .update(jobs)
    .set({ status: "pending", lockedBy: null, lockedAt: null })
    .where(and(eq(jobs.status, "claimed"), lt(jobs.lockedAt, lockCutoff)));

  const candidates = await db
    .select()
    .from(jobs)
    .where(
      and(
        or(eq(jobs.status, "pending"), eq(jobs.status, "failed")),
        lte(jobs.runAt, new Date()),
        or(isNull(jobs.lockedBy), lt(jobs.lockedAt, lockCutoff)),
      ),
    )
    .orderBy(asc(jobs.priority), asc(jobs.id))
    .limit(1);

  const candidate = candidates[0];
  if (!candidate) return null;

  // Atomisk claim — kun én worker vinner racet
  const result = await db
    .update(jobs)
    .set({ status: "claimed", lockedBy: workerId, lockedAt: new Date() })
    .where(
      and(
        eq(jobs.id, candidate.id),
        or(eq(jobs.status, "pending"), eq(jobs.status, "failed")),
        sql`(${jobs.lockedBy} IS NULL OR ${jobs.lockedAt} < ${lockCutoff})`,
      ),
    );

  if (Number(result[0].affectedRows) === 0) return null; // tapt race — prøv igjen neste runde

  return {
    id: candidate.id,
    type: candidate.type,
    payload: JSON.parse(candidate.payload) as Record<string, unknown>,
    attempts: candidate.attempts,
    maxAttempts: candidate.maxAttempts,
    priority: candidate.priority,
  };
}

/** Marker fullført: frigjør dedupe-nøkkelen slik at samme nøkkel kan brukes igjen. */
export async function completeJob(id: number): Promise<void> {
  await getDb()
    .update(jobs)
    .set({ status: "done", lockedBy: null, lockedAt: null, activeDedupeKey: null, completedAt: new Date() })
    .where(eq(jobs.id, id));
}

/** Eksponentiell backoff med jitter: min(2^n * 15s, 30 min) ± 25 %. */
export function backoffDelayMs(attempts: number): number {
  const base = Math.min(2 ** attempts * 15_000, 30 * 60_000);
  const jitter = base * 0.25 * (Math.random() * 2 - 1);
  return Math.max(1000, Math.round(base + jitter));
}

export async function failJob(id: number, attempts: number, maxAttempts: number, error: string): Promise<"retry" | "dead"> {
  const nextAttempts = attempts + 1;
  const safeError = error.slice(0, 4000);
  if (nextAttempts >= maxAttempts) {
    await getDb()
      .update(jobs)
      .set({
        status: "dead",
        attempts: nextAttempts,
        lastError: safeError,
        lockedBy: null,
        lockedAt: null,
        activeDedupeKey: null, // død jobb skal ikke blokkere ny enqueue med samme nøkkel
      })
      .where(eq(jobs.id, id));
    const [row] = await getDb().select({ type: jobs.type }).from(jobs).where(eq(jobs.id, id)).limit(1);
    inc("jobs_dead_total", { type: row?.type ?? "unknown" });
    return "dead";
  }
  await getDb()
    .update(jobs)
    .set({
      status: "failed",
      attempts: nextAttempts,
      lastError: safeError,
      lockedBy: null,
      lockedAt: null,
      runAt: new Date(Date.now() + backoffDelayMs(nextAttempts)),
    })
    .where(eq(jobs.id, id));
  return "retry";
}

/**
 * Admin-handling: send en dead/failed-jobb tilbake i kø.
 * Reaktiverer dedupe-nøkkelen; hvis en annen aktiv jobb allerede holder den,
 * lar vi nøkkelen være null (jobben kjører likevel).
 */
export async function retryJob(id: number): Promise<void> {
  const db = getDb();
  const [row] = await db.select({ dedupeKey: jobs.dedupeKey }).from(jobs).where(eq(jobs.id, id)).limit(1);
  const base = { status: "pending" as const, runAt: new Date(), lastError: null, lockedBy: null, lockedAt: null, completedAt: null };
  try {
    await db.update(jobs).set({ ...base, activeDedupeKey: row?.dedupeKey ?? null }).where(eq(jobs.id, id));
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    await db.update(jobs).set({ ...base, activeDedupeKey: null }).where(eq(jobs.id, id));
  }
}
