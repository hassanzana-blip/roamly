import { and, eq, gte } from "drizzle-orm";
import { env } from "./env";
import { getDb } from "../queries/connection";
import { bookings, priceAlerts, tickets as ticketsTable } from "../../db/schema";
import { claimNextJob, completeJob, failJob } from "./jobs";
import { sendBookingConfirmation, sendCaseReply, sendOpsAlert, sendQuoteCheckout, sendTemplatedEmail } from "./mailer";
import { duffelConfig } from "./duffel";
import { demoPaxFactor, demoPriceHint } from "./demo";
import { log, withContext } from "./logger";
import { issueBookingAccessToken } from "./bookingAccess";
import { createOrderFromQuote } from "./bookFromQuote";
import { processBookingAttempt, recoverBookingAttempt } from "./orchestrator";
import { processRefundCase } from "./refunds";
import { reconcileBookingById, sweepBookings } from "./reconcile";
import { handleStripeWebhook } from "../webhooks/stripe";
import { handleDuffelWebhook } from "../webhooks/duffel";
import { captureException } from "./monitoring";
import type { Order, Ticket } from "../../contracts/types";
import type { EmailKind, EmailPayloads } from "./emails/templates";
import { checkPriceWatches, expirePriceWatches } from "../watch";

// ─── Jobbhåndterere (OTA-121) ───────────────────────────────────────────────
// Skilt fra worker.ts slik at `dispatch`/`runJob` kan importeres av tester og
// verktøy uten å starte poll-løkken. Jobbtyper: process_booking_attempt,
// recover_attempt, process_refund, stripe_webhook, duffel_webhook,
// reconcile_order, sweep, send_email, book_from_quote, price_alerts (kun demo).

export type EmailJob = {
  kind: string;
  to?: string;
  locale?: string;
  payload?: Record<string, unknown>;
  bookingId?: number;
  subject?: string;
  body?: string;
  quoteId?: number;
  token?: string;
  caseId?: number;
  message?: string;
};

export async function handleSendEmail(p: EmailJob): Promise<void> {
  const kind = String(p.kind);
  const db = getDb();
  switch (kind) {
    case "booking_confirmation": {
      const bookingId = Number(p.bookingId);
      const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
      if (!booking) throw new Error(`Booking ${bookingId} ikke funnet`);
      const order = JSON.parse(booking.payload) as Order;
      const ticketRows = await db.select().from(ticketsTable).where(eq(ticketsTable.bookingId, bookingId));
      const tickets: Ticket[] = ticketRows.map((t) => ({ passengerId: t.passengerId, passengerName: t.passengerName, type: t.type, uniqueIdentifier: t.uniqueIdentifier }));
      const token = await issueBookingAccessToken(bookingId);
      const accessUrl = `${env.baseUrl}/bekreftelse/${encodeURIComponent(booking.orderId)}?t=${encodeURIComponent(token)}`;
      await sendBookingConfirmation({ ...order, bookingReference: booking.bookingReference || order.bookingReference, tickets }, { accessUrl, bookingId, locale: p.locale ?? "nb" });
      return;
    }
    case "ops_alert":
      await sendOpsAlert(String(p.subject ?? "Driftsvarsel"), String(p.body ?? ""));
      return;
    case "quote_checkout":
      await sendQuoteCheckout(Number(p.quoteId), String(p.token));
      return;
    case "case_reply":
      await sendCaseReply(Number(p.caseId), String(p.message));
      return;
    default: {
      if (!p.to) throw new Error(`send_email(${kind}) mangler mottaker`);
      const typedKind = kind as EmailKind;
      await sendTemplatedEmail(typedKind, p.to, p.locale ?? "nb", (p.payload ?? {}) as EmailPayloads[typeof typedKind], p.bookingId ? { bookingId: p.bookingId } : undefined);
    }
  }
}

/** Sjekk aktive prisvarsler mot demo-priser; send e-post når målet er nådd (kun demo). */
export async function handlePriceAlerts(): Promise<void> {
  if (duffelConfig.configured) return; // live-modus krever ekte prisoppslag per varsel
  const db = getDb();
  const alerts = await db
    .select()
    .from(priceAlerts)
    .where(and(eq(priceAlerts.active, true), gte(priceAlerts.departDate, new Date().toISOString().slice(0, 10))))
    .limit(50);
  for (const a of alerts) {
    const price = demoPriceHint(a.originIata, a.destinationIata, "economy", a.departDate, demoPaxFactor(["adult"]));
    if (price !== null && Number(price) <= a.targetPrice) {
      await sendTemplatedEmail("price_alert", a.email, "nb", {
        route: `${a.originIata} → ${a.destinationIata}`,
        price: Number(price),
        currency: "NOK",
        targetPrice: a.targetPrice,
        url: `${env.baseUrl}/sok?from=${a.originIata}&to=${a.destinationIata}&depart=${a.departDate}&adults=1&children=0&infants=0&cabin=economy`,
      });
      await db.update(priceAlerts).set({ active: false }).where(eq(priceAlerts.id, a.id));
    }
  }
}

/** Kjør én jobb av gitt type. Kaster ved feil (kalleren avgjør retry/dead). */
export async function dispatch(type: string, payload: Record<string, unknown>): Promise<void> {
  switch (type) {
    case "process_booking_attempt":
      return processBookingAttempt(Number(payload.attemptId));
    case "recover_attempt":
      return recoverBookingAttempt(Number(payload.attemptId));
    case "process_refund":
      return processRefundCase(Number(payload.refundCaseId));
    case "stripe_webhook":
      return handleStripeWebhook(Number(payload.webhookEventId));
    case "duffel_webhook":
      return handleDuffelWebhook(Number(payload.webhookEventId));
    case "reconcile_order":
      return reconcileBookingById(Number(payload.bookingId), "worker:reconcile_job");
    case "sweep":
      return sweepBookings();
    case "send_email":
      return handleSendEmail(payload as EmailJob);
    case "book_from_quote":
      return createOrderFromQuote(Number(payload.quoteId));
    case "price_alerts":
      return handlePriceAlerts();
    case "price_watches": {
      await expirePriceWatches();
      const r = await checkPriceWatches();
      log.info(r, "prisovervåking sjekket");
      return;
    }
    case "disruptions":
    case "disruption_email":
      log.warn({ type }, "Utfaset jobbtype ignorert (OTA-132)");
      return;
    default:
      throw new Error(`Ukjent jobbtype: ${type}`);
  }
}

export type ClaimedJob = NonNullable<Awaited<ReturnType<typeof claimNextJob>>>;

/** Kjør en claimet jobb: dispatch → completeJob, eller failJob med backoff/dead-letter. */
export async function runJob(job: ClaimedJob): Promise<"done" | "retry" | "dead"> {
  return withContext({ requestId: `job-${job.id}` }, async () => {
    const started = Date.now();
    try {
      await dispatch(job.type, job.payload);
      await completeJob(job.id);
      log.info({ jobId: job.id, type: job.type, ms: Date.now() - started }, "jobb fullført");
      return "done";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const outcome = await failJob(job.id, job.attempts, job.maxAttempts, message);
      log.error({ jobId: job.id, type: job.type, outcome, err: message }, "jobb feilet");
      captureException(err, { tags: { source: "worker", jobType: job.type, outcome }, extra: { jobId: job.id, attempts: job.attempts } });
      if (outcome === "dead") {
        await sendOpsAlert(
          `Jobb gikk til dead-letter: ${job.type}`,
          `Jobb ${job.id} har feilet ${job.maxAttempts} ganger.\n\nSiste feil: ${message}\n\nÅpne admin → Innstillinger → Jobber for å retrye manuelt.`,
        ).catch(() => {});
      }
      return outcome;
    }
  });
}
