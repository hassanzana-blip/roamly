import "dotenv/config";
import { assertProductionSafety, env } from "./lib/env";
import { closeDb } from "./queries/connection";
import { claimNextJob, enqueueJob } from "./lib/jobs";
import { duffelConfig } from "./lib/duffel";
import { randomToken } from "./lib/tokens";
import { log } from "./lib/logger";
import { runJob } from "./lib/workerHandlers";
import { flushMonitoring, initMonitoring, installProcessHandlers } from "./lib/monitoring";

// ─── Worker: én prosess som kjører outbox-jobber (OTA-121) ─────────────────
// Selve jobbhåndteringen ligger i lib/workerHandlers.ts (dispatch/runJob) og
// kan importeres uten å starte løkken. Denne filen eier poll-løkken, de
// periodiske jobbene og ryddig avslutning. Løkken startes kun når filen er
// prosessens entrypoint (dist/worker.js) eller WORKER_MAIN=true.

export { dispatch, runJob } from "./lib/workerHandlers";

const POLL_MS = 2000;
let shuttingDown = false;
let current: Promise<unknown> | null = null;

export async function loop(workerId = `worker-${randomToken(6)}`): Promise<void> {
  installProcessHandlers("worker");
  await initMonitoring("worker");
  log.info({ workerId, env: env.APP_ENV, duffelLive: duffelConfig.liveMode }, "worker startet");

  // Periodiske oppgaver legges i kø med dedupe-nøkler (én per intervall)
  const sweep = async () => {
    if (shuttingDown) return;
    await enqueueJob("sweep", {}, { dedupeKey: `sweep:${new Date().toISOString().slice(0, 15)}` }).catch(() => {});
    setTimeout(sweep, 10 * 60_000).unref();
  };
  await sweep();
  const hourly = async () => {
    if (shuttingDown) return;
    const hour = new Date().toISOString().slice(0, 13);
    if (!duffelConfig.configured) await enqueueJob("price_alerts", {}, { dedupeKey: `price-alerts:${hour}` }).catch(() => {});
    setTimeout(hourly, 60 * 60_000).unref();
  };
  await hourly();

  while (!shuttingDown) {
    try {
      const job = await claimNextJob(workerId);
      if (!job) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        continue;
      }
      current = runJob(job);
      await current;
      current = null;
    } catch (err) {
      log.error({ err }, "uventet feil i poll-løkken");
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  log.info({ workerId }, "worker stoppet ryddig");
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ signal }, "avslutter — venter på pågående jobb");
  const deadline = setTimeout(() => process.exit(0), 60_000);
  deadline.unref();
  try {
    if (current) await current;
  } finally {
    await flushMonitoring();
    await closeDb();
    process.exit(0);
  }
}

const isMain = process.argv[1]?.endsWith("worker.js") || process.argv[1]?.endsWith("worker.ts") || process.env.WORKER_MAIN === "true";

if (isMain) {
  assertProductionSafety();
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  loop().catch((err) => {
    log.fatal({ err }, "fatal feil i worker");
    process.exit(1);
  });
}
