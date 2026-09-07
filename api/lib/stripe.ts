import Stripe from "stripe";
import { env } from "./env";
import { AppError } from "./errors";

// ─── Stripe-klient (PSP) ──────────────────────────────────────────────────────
// Kortdata passerer ALDRI HelloSkys server (Stripe Elements i nettleser).
// Alle skrivende kall bruker idempotency-key = attempt-/refund-ID.

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new AppError("PAYMENT_NOT_CONFIGURED");
  if (!client) {
    client = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-08-26.dahlia", maxNetworkRetries: 2, timeout: 20_000 });
  }
  return client;
}

export const stripeConfigured = () => env.stripeConfigured;

export type PaymentMethodChoice = "card" | "klarna" | "vipps";

/** Opprett autorisasjon (manual capture). Beløp i minste enhet. */
export async function createPaymentIntent(input: {
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  checkoutPublicId: string;
  email: string;
  method: PaymentMethodChoice;
  description: string;
}): Promise<{ id: string; clientSecret: string; status: string }> {
  const s = stripe();
  const methods: Record<PaymentMethodChoice, string[]> = { card: ["card"], klarna: ["klarna"], vipps: ["card"] };
  const pi = await s.paymentIntents.create(
    {
      amount: input.amountMinor,
      currency: input.currency.toLowerCase(),
      capture_method: "manual",
      payment_method_types: methods[input.method],
      receipt_email: input.email,
      description: input.description,
      metadata: { checkout_public_id: input.checkoutPublicId, source: "hellosky" },
    },
    { idempotencyKey: `pi:${input.idempotencyKey}` },
  );
  return { id: pi.id, clientSecret: pi.client_secret ?? "", status: pi.status };
}

export async function retrievePaymentIntent(id: string) {
  return stripe().paymentIntents.retrieve(id, { expand: ["latest_charge"] });
}

export async function capturePaymentIntent(id: string, idempotencyKey: string, amountMinor?: number) {
  return stripe().paymentIntents.capture(id, amountMinor ? { amount_to_capture: amountMinor } : {}, { idempotencyKey: `capture:${idempotencyKey}` });
}

export async function cancelPaymentIntent(id: string, idempotencyKey: string, reason: "abandoned" | "requested_by_customer" | "duplicate" | "fraudulent" = "abandoned") {
  return stripe().paymentIntents.cancel(id, { cancellation_reason: reason }, { idempotencyKey: `cancel:${idempotencyKey}` });
}

export async function createRefund(input: { paymentIntentId: string; amountMinor: number; idempotencyKey: string; reason?: string; metadata?: Record<string, string> }) {
  return stripe().refunds.create(
    { payment_intent: input.paymentIntentId, amount: input.amountMinor, reason: "requested_by_customer", metadata: { ...(input.metadata ?? {}), source: "hellosky" } },
    { idempotencyKey: `refund:${input.idempotencyKey}` },
  );
}

export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  if (!env.STRIPE_WEBHOOK_SECRET) throw new AppError("PAYMENT_NOT_CONFIGURED", { message: "STRIPE_WEBHOOK_SECRET mangler" });
  return stripe().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
}
