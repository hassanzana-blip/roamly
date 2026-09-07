import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { bookings, webhookEvents } from "../../db/schema";
import { env } from "../lib/env";
import { verifyDuffelSignature } from "../lib/duffelWebhook";
import { enqueueJob, isDuplicateKeyError } from "../lib/jobs";
import { log } from "../lib/logger";
import { logAudit } from "../lib/audit";

// ─── Duffel-webhook: verifiser signatur, dedupe, legg i kø, svar raskt ────

export const duffelWebhookApp = new Hono();

duffelWebhookApp.post("/", async (c) => {
  const secret = env.DUFFEL_WEBHOOK_SECRET;
  if (!secret) return c.json({ error: "Webhook ikke konfigurert" }, 503);

  const rawBody = await c.req.text();
  const check = verifyDuffelSignature(secret, c.req.header("x-duffel-signature") ?? "", rawBody);
  if (!check.ok) {
    const message = check.reason === "missing" ? "Mangler signatur" : check.reason === "expired" ? "Utløpt hendelse" : "Ugyldig signatur";
    return c.json({ error: message }, 401);
  }

  let event: { id?: string; type?: string };
  try {
    event = JSON.parse(rawBody) as { id?: string; type?: string };
  } catch {
    return c.json({ error: "Ugyldig JSON" }, 400);
  }
  if (!event.id || !event.type) return c.json({ error: "Mangler felt" }, 400);

  try {
    const db = getDb();
    let webhookEventId: number;
    try {
      const result = await db.insert(webhookEvents).values({ provider: "duffel", eventId: event.id, eventType: event.type, payload: rawBody });
      webhookEventId = Number(result[0].insertId);
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      return c.json({ success: true, duplicate: true });
    }
    await enqueueJob("duffel_webhook", { webhookEventId }, { dedupeKey: `duffel-webhook:${webhookEventId}`, priority: 2 });
    return c.json({ success: true });
  } catch (err) {
    log.error({ err }, "Duffel-webhook: lagring feilet");
    return c.json({ error: "Intern feil" }, 500);
  }
});

/** Worker-handler for jobbtypen duffel_webhook. Idempotent (status processed). */
export async function handleDuffelWebhook(webhookEventId: number): Promise<void> {
  const db = getDb();
  const [event] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, webhookEventId)).limit(1);
  if (!event || event.status === "processed") return;
  await db.update(webhookEvents).set({ attempts: event.attempts + 1 }).where(eq(webhookEvents.id, webhookEventId));

  const data = JSON.parse(event.payload) as { type?: string; data?: { object?: { id?: string } } };
  const orderId = data.data?.object?.id;
  try {
    if (data.type === "ping.triggered") {
      // kun en test fra Duffel
    } else if (orderId && (data.type === "order.updated" || data.type === "order.airline_initiated_change_detected" || data.type === "order.created" || data.type === "order.cancelled")) {
      const [booking] = await db.select().from(bookings).where(eq(bookings.orderId, orderId)).limit(1);
      if (booking) {
        const { reconcileBookingById } = await import("../lib/reconcile");
        await reconcileBookingById(booking.id, `webhook:${data.type}`);
        if (data.type === "order.airline_initiated_change_detected") {
          await logAudit({ actorType: "webhook", actorId: orderId, action: "booking.airline_change_webhook", targetType: "booking", targetId: booking.id });
        }
      } else {
        log.warn({ orderId, type: data.type }, "Duffel-webhook for ukjent ordre");
      }
    }
    await db.update(webhookEvents).set({ status: "processed", processedAt: new Date(), error: null }).where(eq(webhookEvents.id, webhookEventId));
  } catch (err) {
    await db.update(webhookEvents).set({ status: "failed", error: String(err).slice(0, 4000) }).where(eq(webhookEvents.id, webhookEventId));
    throw err;
  }
}
