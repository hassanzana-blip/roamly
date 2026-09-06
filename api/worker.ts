import "dotenv/config";
import { and, eq, inArray, lt } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { bookings, bookingEvents, payments, quotes, webhookEvents } from "../db/schema";
import { claimNextJob, completeJob, enqueueJob, failJob } from "./lib/jobs";
import { sendBookingConfirmation, sendQuoteCheckout, sendCaseReply, sendOpsAlert } from "./lib/mailer";
import { duffelConfig, duffelGetOrder } from "./lib/duffel";
import { randomToken } from "./lib/tokens";
import { ACTIVE_STATES } from "./lib/statemachine";
import { logAudit } from "./lib/audit";
import { createOrderFromQuote } from "./lib/bookFromQuote";

const WORKER_ID = `worker-${randomToken(6)}`;
const POLL_MS = 2000;
let shuttingDown = false;

async function handleDuffelWebhook(payload: Record<string, unknown>): Promise<void> {
  const eventRowId = payload.webhookEventId as number;
  const db = getDb();
  const [event] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, eventRowId)).limit(1);
  if (!event) return;
  if (event.status === "processed") return; // idempotent — replay-safe

  const data = JSON.parse(event.payload) as {
    type?: string;
    data?: { object?: { id?: string } };
  };
  const orderId = data.data?.object?.id;

  try {
    if (data.type === "ping.triggered") {
      // ingenting å gjøre — kun en test fra Duffel
    } else if (orderId && (data.type === "order.updated" || data.type === "order.airline_initiated_change_detected" || data.type === "order.created")) {
      // Hent alltid autoritativ tilstand fra Duffel før vi endrer noe lokalt
      const [booking] = await db.select().from(bookings).where(eq(bookings.orderId, orderId)).limit(1);
      if (booking) {
        await reconcileBookingById(booking.id, `webhook:${data.type}`);
        if (data.type === "order.airline_initiated_change_detected") {
          await enqueueJob("send_email", {
            kind: "ops_alert",
            subject: `Ruteendring oppdaget: ${booking.bookingReference}`,
            body: `Duffel rapporterer en airline-initiert endring på ordre ${orderId}. Sjekk bestillingen i admin og kontakt kunden ved behov.`,
          });
          await logAudit({
            actorType: "webhook", actorId: orderId, action: "booking.schedule_change_detected",
            targetType: "booking", targetId: booking.id,
          });
        }
      }
    }
    await db.update(webhookEvents)
      .set({ status: "processed", processedAt: new Date() })
      .where(eq(webhookEvents.id, eventRowId));
  } catch (err) {
    await db.update(webhookEvents)
      .set({ status: "failed", error: String(err) })
      .where(eq(webhookEvents.id, eventRowId));
    throw err; // la jobben retryes
  }
}

/** Avstemming: hent autoritativ ordre fra Duffel og oppdater lokal tilstand. */
export async function reconcileBookingById(bookingId: number, source: string): Promise<void> {
  const db = getDb();
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!booking) return;
  if (!duffelConfig.configured || booking.orderId.startsWith("ord_demo_")) {
    await db.update(bookings).set({ lastReconciledAt: new Date() }).where(eq(bookings.id, bookingId));
    return;
  }

  const duffelOrder = (await duffelGetOrder(booking.orderId)) as {
    cancelled_at?: string | null;
    payment_status?: { paid_at?: string | null };
    documents?: unknown[];
    booking_reference?: string;
  };

  let targetState = booking.state;
  let reason = "";
  if (duffelOrder.cancelled_at && booking.state !== "CANCELLED" && booking.state !== "REFUNDED") {
    targetState = "CANCELLED";
    reason = "Leverandøren har kansellert ordren";
  } else if (booking.state === "BOOKING_PROCESSING" || booking.state === "AWAITING_RECONCILIATION") {
    if (duffelOrder.booking_reference) {
      targetState = "CONFIRMED";
      reason = "Bekreftet hos leverandør ved avstemming";
    }
  }

  if (targetState !== booking.state) {
    await db.update(bookings)
      .set({ state: targetState, lastReconciledAt: new Date() })
      .where(eq(bookings.id, bookingId));
    await db.insert(bookingEvents).values({
      bookingId, fromState: booking.state, toState: targetState,
      actorType: "worker", actorId: source, reason,
    });
    await logAudit({
      actorType: "worker", actorId: source, action: "booking.reconciled_state_change",
      targetType: "booking", targetId: bookingId,
      metadata: { from: booking.state, to: targetState },
    });
  } else {
    await db.update(bookings).set({ lastReconciledAt: new Date() }).where(eq(bookings.id, bookingId));
  }
}

/** Periodisk sweep: avstem aktive bookinger + utløp gamle tilbud. */
async function handleSweep(): Promise<void> {
  const db = getDb();

  // Utløp sendte tilbud som har passert fristen
  const expired = await db
    .select({ id: quotes.id })
    .from(quotes)
    .where(and(inArray(quotes.status, ["draft", "sent"]), lt(quotes.expiresAt, new Date())));
  for (const q of expired) {
    await db.update(quotes).set({ status: "expired" }).where(eq(quotes.id, q.id));
  }

  // Avstem aktive bestillinger (maks 20 per sweep, eldste først)
  const active = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(inArray(bookings.state, ACTIVE_STATES))
    .limit(20);
  for (const b of active) {
    await enqueueJob("reconcile_order", { bookingId: b.id }, { dedupeKey: `reconcile:${b.id}` });
  }
}

async function dispatch(type: string, payload: Record<string, unknown>): Promise<void> {
  switch (type) {
    case "send_email": {
      const kind = payload.kind as string;
      if (kind === "booking_confirmation") {
        const [booking] = await getDb().select().from(bookings).where(eq(bookings.id, payload.bookingId as number)).limit(1);
        if (!booking) throw new Error(`Booking ${payload.bookingId} ikke funnet`);
        await sendBookingConfirmation(JSON.parse(booking.payload));
      } else if (kind === "quote_checkout") {
        await sendQuoteCheckout(payload.quoteId as number, payload.token as string);
      } else if (kind === "case_reply") {
        await sendCaseReply(payload.caseId as number, payload.message as string);
      } else if (kind === "ops_alert") {
        await sendOpsAlert(payload.subject as string, payload.body as string);
      }
      return;
    }
    case "duffel_webhook":
      return handleDuffelWebhook(payload);
    case "reconcile_order":
      return reconcileBookingById(payload.bookingId as number, "worker:reconcile_job");
    case "book_from_quote":
      return createOrderFromQuote(payload.quoteId as number);
    case "sweep":
      return handleSweep();
    default:
      throw new Error(`Ukjent jobbtype: ${type}`);
  }
}

async function loop(): Promise<void> {
  console.log(`[${WORKER_ID}] Worker startet`);
  // Periodiske oppgaver legges i kø med dedupe-nøkler (én per intervall)
  const sweep = async () => {
    if (shuttingDown) return;
    await enqueueJob("sweep", {}, { dedupeKey: `sweep:${new Date().toISOString().slice(0, 13)}` }).catch(() => {});
    setTimeout(sweep, 15 * 60_000).unref();
  };
  await sweep();

  while (!shuttingDown) {
    try {
      const job = await claimNextJob(WORKER_ID);
      if (!job) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        continue;
      }
      try {
        await dispatch(job.type, job.payload);
        await completeJob(job.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const outcome = await failJob(job.id, job.attempts, job.maxAttempts, message);
        console.error(`[${WORKER_ID}] Jobb ${job.id} (${job.type}) feilet → ${outcome}: ${message}`);
        if (outcome === "dead") {
          await sendOpsAlert(
            `Jobb gikk til dead-letter: ${job.type}`,
            `Jobb ${job.id} har feilet ${job.maxAttempts} ganger.\n\nSiste feil: ${message}\n\nÅpne admin → Innstillinger → Jobber for å retrye manuelt.`,
          ).catch(() => {});
        }
      }
    } catch (err) {
      console.error(`[${WORKER_ID}] Uventet feil i poll-løkken:`, err);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  console.log(`[${WORKER_ID}] Worker stoppet ryddig`);
}

process.on("SIGTERM", () => { shuttingDown = true; });
process.on("SIGINT", () => { shuttingDown = true; });

loop().catch((err) => {
  console.error(`[${WORKER_ID}] Fatal feil:`, err);
  process.exit(1);
});
