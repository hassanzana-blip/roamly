import { Hono } from "hono";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { bookings, bookingEvents, checkoutSessions, fraudFlags, webhookEvents } from "../../db/schema";
import { env } from "../lib/env";
import { constructWebhookEvent } from "../lib/stripe";
import { enqueueJob, isDuplicateKeyError } from "../lib/jobs";
import { log } from "../lib/logger";
import { failSession } from "../lib/orchestrator";
import { applyStripeRefundEvent } from "../lib/refunds";
import { canTransition, type BookingState } from "../lib/statemachine";
import { inc } from "../lib/metrics";

// ─── Stripe-webhook: verifiser signatur, dedupe, legg i kø, svar raskt ────
// Behandling skjer i worker (handleStripeWebhook) slik at Stripe alltid får 2xx
// innen fristen og replays er ufarlige (unik (provider, event_id)).

export const stripeWebhookApp = new Hono();

stripeWebhookApp.post("/", async (c) => {
  if (!env.STRIPE_WEBHOOK_SECRET) return c.json({ error: "Webhook ikke konfigurert" }, 503);
  const rawBody = await c.req.text();
  const signature = c.req.header("stripe-signature") ?? "";
  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err) }, "Stripe-webhook: ugyldig signatur");
    inc("stripe_webhooks_total", { outcome: "invalid_signature" });
    return c.json({ error: "Ugyldig signatur" }, 400);
  }
  try {
    const db = getDb();
    let webhookEventId: number | null = null;
    try {
      const res = await db.insert(webhookEvents).values({ provider: "stripe", eventId: event.id, eventType: event.type, payload: rawBody });
      webhookEventId = Number(res[0].insertId);
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      inc("stripe_webhooks_total", { outcome: "duplicate" });
      return c.json({ received: true, duplicate: true });
    }
    await enqueueJob("stripe_webhook", { webhookEventId }, { dedupeKey: `stripe-webhook:${webhookEventId}`, priority: 1 });
    inc("stripe_webhooks_total", { outcome: "received" });
    return c.json({ received: true });
  } catch (err) {
    inc("stripe_webhooks_total", { outcome: "error" });
    log.error({ err }, "Stripe-webhook: lagring feilet");
    return c.json({ error: "Intern feil" }, 500);
  }
});

const RELEVANT = new Set([
  "payment_intent.amount_capturable_updated",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "charge.refund.updated",
  "refund.updated",
  "refund.failed",
  "refund.created",
  "charge.dispute.created",
]);

/** Worker-handler for jobbtypen stripe_webhook. Idempotent (status processed). */
export async function handleStripeWebhook(webhookEventId: number): Promise<void> {
  const db = getDb();
  const [row] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, webhookEventId)).limit(1);
  if (!row || row.status === "processed") return;
  const event = JSON.parse(row.payload) as Stripe.Event;
  await db.update(webhookEvents).set({ attempts: row.attempts + 1 }).where(eq(webhookEvents.id, webhookEventId));

  try {
    if (RELEVANT.has(event.type)) await dispatchStripeEvent(event);
    await db.update(webhookEvents).set({ status: "processed", processedAt: new Date(), error: null }).where(eq(webhookEvents.id, webhookEventId));
  } catch (err) {
    await db.update(webhookEvents).set({ status: "failed", error: String(err).slice(0, 4000) }).where(eq(webhookEvents.id, webhookEventId));
    throw err;
  }
}

async function sessionByIntent(intentId: string) {
  const [s] = await getDb().select().from(checkoutSessions).where(eq(checkoutSessions.pspIntentId, intentId)).limit(1);
  return s ?? null;
}

async function dispatchStripeEvent(event: Stripe.Event): Promise<void> {
  const db = getDb();
  switch (event.type) {
    case "payment_intent.amount_capturable_updated":
    case "payment_intent.succeeded": {
      const pi = event.data.object;
      const session = await sessionByIntent(pi.id);
      if (!session) {
        log.warn({ intentId: pi.id }, "Stripe: PaymentIntent uten sesjon");
        return;
      }
      if (pi.status !== "requires_capture" && pi.status !== "succeeded") return;
      if (pi.amount !== session.totalAmountMinor || pi.currency.toUpperCase() !== session.currency) {
        await enqueueJob("send_email", {
          kind: "ops_alert",
          subject: `Beløpsavvik i Stripe-autorisasjon: ${session.publicId}`,
          body: `PaymentIntent ${pi.id} har ${pi.amount} ${pi.currency}, sesjonen forventer ${session.totalAmountMinor} ${session.currency}. Bookingen er IKKE startet.`,
        });
        return;
      }
      if (["failed", "expired", "cancelled", "price_changed"].includes(session.status)) {
        // Autorisert etter at sesjonen ble avsluttet → ikke book; annuller PI så kunden ikke får reservasjon hengende
        const { cancelPaymentIntent } = await import("../lib/stripe");
        await cancelPaymentIntent(pi.id, `late:${session.idempotencyKey}`, "abandoned").catch(() => {});
        return;
      }
      const { onPaymentAuthorized } = await import("../checkout");
      await onPaymentAuthorized(session.id, "webhook");
      return;
    }
    case "payment_intent.payment_failed":
    case "payment_intent.canceled": {
      const pi = event.data.object;
      const session = await sessionByIntent(pi.id);
      if (!session) return;
      if (!["created", "payment_pending"].includes(session.status)) return; // allerede i booking/avsluttet — orkestratoren eier tilstanden
      const code = event.type === "payment_intent.canceled" ? "PAYMENT_CANCELLED" : "PAYMENT_FAILED";
      const message = pi.last_payment_error?.message ?? (event.type === "payment_intent.canceled" ? "Betalingen ble avbrutt." : "Betalingen ble avvist.");
      const changed = await failSession(db, session.id, event.type === "payment_intent.canceled" ? "cancelled" : "failed", code, message);
      if (changed && event.type === "payment_intent.payment_failed") {
        await enqueueJob(
          "send_email",
          { kind: "payment_failed", to: session.contactEmail, locale: session.locale, payload: { reason: code, message, checkoutPublicId: session.publicId } },
          { dedupeKey: `payment-failed:session:${session.id}` },
        ).catch(() => {});
      }
      return;
    }
    case "charge.refund.updated":
    case "refund.updated":
    case "refund.failed":
    case "refund.created": {
      const refund = event.data.object;
      await applyStripeRefundEvent({ id: refund.id, status: refund.status ?? null, amount: refund.amount, metadata: (refund.metadata ?? null) as Record<string, string> | null });
      return;
    }
    case "charge.dispute.created": {
      const dispute = event.data.object;
      const intentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
      const session = intentId ? await sessionByIntent(intentId) : null;
      const bookingId = session?.bookingId ?? null;
      await db.insert(fraudFlags).values({
        customerAccountId: session?.customerAccountId ?? null,
        checkoutSessionId: session?.id ?? null,
        bookingId,
        type: "dispute",
        score: 100,
        note: `Stripe dispute ${dispute.id} (${dispute.reason ?? "ukjent"}), ${dispute.amount} ${dispute.currency}`.slice(0, 255),
        status: "open",
      });
      if (bookingId) {
        const [b] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
        if (b && canTransition(b.state as BookingState, "REVIEW")) {
          await db.update(bookings).set({ state: "REVIEW" }).where(eq(bookings.id, bookingId));
          await db.insert(bookingEvents).values({ bookingId, fromState: b.state, toState: "REVIEW", actorType: "webhook", actorId: dispute.id, reason: "Chargeback/dispute mottatt fra Stripe" });
        }
      }
      await enqueueJob("send_email", {
        kind: "ops_alert",
        subject: `CHARGEBACK: ${dispute.id}`,
        body: `Stripe rapporterer en dispute på ${dispute.amount} ${dispute.currency} (årsak: ${dispute.reason ?? "ukjent"}).\nBooking-ID: ${bookingId ?? "ukjent"}\nSesjon: ${session?.publicId ?? "ukjent"}\n\nSvar i Stripe-dashboardet innen fristen og vurder kansellering hos leverandør.`,
      });
      return;
    }
    default:
      return;
  }
}
