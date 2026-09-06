import { and, asc, eq, lte, or, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { jobs } from "../../db/schema";

export type JobStatus = "pending" | "claimed" | "done" | "failed" | "dead";

const LOCK_TIMEOUT_MS = 5 * 60_000;

/** Legg en jobb i outboxen. dedupeKey gjør kallet idempotent. */
export async function enqueueJob(
  type: string,
  payload: Record<string, unknown>,
  opts: { dedupeKey?: string; runAt?: Date; maxAttempts?: number } = {},
): Promise<void> {
  const db = getDb();
  if (opts.dedupeKey) {
    const existing = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(eq(jobs.dedupeKey, opts.dedupeKey))
      .limit(1);
    if (existing.length > 0) return; // allerede i kø — idempotent
  }
  await db.insert(jobs).values({
    type,
    payload: JSON.stringify(payload),
    runAt: opts.runAt ?? new Date(),
    maxAttempts: opts.maxAttempts ?? 5,
    dedupeKey: opts.dedupeKey ?? null,
  });
}

export type ClaimedJob = {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
};

/**
 * Hent neste jobb — kun én worker kan clame den.
 * Bruker atomisk UPDATE ... WHERE status='pending' som claim-mekanisme,
 * og frigjør utløpte låser fra krasjede workere.
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
    .orderBy(asc(jobs.id))
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
  };
}

export async function completeJob(id: number): Promise<void> {
  await getDb()
    .update(jobs)
    .set({ status: "done", lockedBy: null, lockedAt: null })
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
  if (nextAttempts >= maxAttempts) {
    await getDb()
      .update(jobs)
      .set({ status: "dead", attempts: nextAttempts, lastError: error, lockedBy: null, lockedAt: null })
      .where(eq(jobs.id, id));
    return "dead";
  }
  await getDb()
    .update(jobs)
    .set({
      status: "failed",
      attempts: nextAttempts,
      lastError: error,
      lockedBy: null,
      lockedAt: null,
      runAt: new Date(Date.now() + backoffDelayMs(nextAttempts)),
    })
    .where(eq(jobs.id, id));
  return "retry";
}

/** Admin-handling: send en dead/failed-jobb tilbake i kø. */
export async function retryJob(id: number): Promise<void> {
  await getDb()
    .update(jobs)
    .set({ status: "pending", runAt: new Date(), lastError: null, lockedBy: null, lockedAt: null })
    .where(eq(jobs.id, id));
}
