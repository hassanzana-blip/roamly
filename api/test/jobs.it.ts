import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, countRows, rows, runJobsUntilIdle, truncateAll } from "./setup";
import { claimNextJob, completeJob, enqueueJob, failJob, retryJob } from "../lib/jobs";
import { dispatch, runJob } from "../lib/workerHandlers";

// ─── Outbox-jobber: dedupe, claim, retry/dead-letter ───────────────────────

describe("jobs", () => {
  beforeEach(truncateAll);
  afterAll(closeDb);

  it("dedupeKey: to enqueue mens pending → 1; etter completeJob → ny jobb (activeDedupeKey frigis)", async () => {
    const a = await enqueueJob("sweep", {}, { dedupeKey: "k1" });
    const b = await enqueueJob("sweep", {}, { dedupeKey: "k1" });
    expect(a.enqueued).toBe(true);
    expect(b.enqueued).toBe(false);
    expect(await countRows("jobs")).toBe(1);

    const job = await claimNextJob("w1");
    expect(job?.id).toBe(a.id);
    // Fortsatt claimed → dedupe blokkerer
    expect((await enqueueJob("sweep", {}, { dedupeKey: "k1" })).enqueued).toBe(false);
    await completeJob(job!.id);
    const [done] = await rows<{ status: string; active_dedupe_key: string | null; dedupe_key: string }>(`SELECT status, active_dedupe_key, dedupe_key FROM jobs WHERE id=${job!.id}`);
    expect(done).toEqual({ status: "done", active_dedupe_key: null, dedupe_key: "k1" });

    const c = await enqueueJob("sweep", {}, { dedupeKey: "k1" });
    expect(c.enqueued).toBe(true);
    expect(await countRows("jobs")).toBe(2);
  });

  it("claim er atomisk: to workere får ikke samme jobb; låste jobber frigis ved utløp", async () => {
    await enqueueJob("sweep", {}, { dedupeKey: "one" });
    const [x, y] = await Promise.all([claimNextJob("w1"), claimNextJob("w2")]);
    expect([x, y].filter(Boolean).length).toBe(1);
    // Simuler krasjet worker: låst for lenge siden
    await rows(`UPDATE jobs SET locked_at = DATE_SUB(NOW(), INTERVAL 10 MINUTE)`);
    const again = await claimNextJob("w3");
    expect(again).not.toBeNull();
  });

  it("failJob: backoff og til slutt dead med activeDedupeKey=null; retryJob reaktiverer", async () => {
    const a = await enqueueJob("sweep", {}, { dedupeKey: "d", maxAttempts: 2 });
    let job = await claimNextJob("w");
    expect(await failJob(job!.id, job!.attempts, job!.maxAttempts, "boom")).toBe("retry");
    let [r] = await rows<{ status: string; attempts: number; run_at: Date; active_dedupe_key: string | null }>(`SELECT status, attempts, run_at, active_dedupe_key FROM jobs WHERE id=${a.id}`);
    expect(r.status).toBe("failed");
    expect(Number(r.attempts)).toBe(1);
    expect(r.active_dedupe_key).toBe("d");
    expect(new Date(r.run_at).getTime()).toBeGreaterThan(Date.now() + 5_000);
    // Ikke klar før run_at
    expect(await claimNextJob("w")).toBeNull();
    await rows(`UPDATE jobs SET run_at = NOW() WHERE id=${a.id}`);
    job = await claimNextJob("w");
    expect(await failJob(job!.id, job!.attempts, job!.maxAttempts, "boom2")).toBe("dead");
    [r] = await rows(`SELECT status, attempts, run_at, active_dedupe_key FROM jobs WHERE id=${a.id}`);
    expect(r.status).toBe("dead");
    expect(r.active_dedupe_key).toBeNull();
    // Død jobb blokkerer ikke ny enqueue
    const b = await enqueueJob("sweep", {}, { dedupeKey: "d" });
    expect(b.enqueued).toBe(true);
    // retryJob på den døde: nøkkelen er opptatt → kjører uten nøkkel
    await retryJob(a.id!);
    [r] = await rows(`SELECT status, attempts, run_at, active_dedupe_key FROM jobs WHERE id=${a.id}`);
    expect(r.status).toBe("pending");
    expect(r.active_dedupe_key).toBeNull();
  });

  it("runJob: ukjent jobbtype går til dead etter maxAttempts og varsler ops", async () => {
    await enqueueJob("finnes_ikke", {}, { maxAttempts: 1 });
    const ran = await runJobsUntilIdle();
    expect(ran).toEqual([expect.objectContaining({ type: "finnes_ikke", outcome: "dead" })]);
    const [r] = await rows<{ status: string; last_error: string }>("SELECT status, last_error FROM jobs");
    expect(r.status).toBe("dead");
    expect(r.last_error).toContain("Ukjent jobbtype");
    expect(await countRows("email_events", "kind='ops_alert'")).toBe(1);
  });

  it("prioritet: lavere tall kjøres først; runJob returnerer done", async () => {
    await enqueueJob("sweep", {}, { priority: 5, dedupeKey: "p5" });
    await enqueueJob("price_alerts", {}, { priority: 1, dedupeKey: "p1" });
    const first = await claimNextJob("w");
    expect(first?.type).toBe("price_alerts");
    expect(await runJob(first!)).toBe("done");
    await expect(dispatch("disruptions", {})).resolves.toBeUndefined();
  });
});
