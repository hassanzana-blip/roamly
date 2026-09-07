import { vi } from "vitest";
import { AppError } from "../lib/errors";

// ─── Kontrollerbar Stripe-mock ───────────────────────────────────────────────
// Brukes med: vi.mock("../lib/stripe", () => import("./stripeMock"))
// Testen styrer PaymentIntent-status via `stripeState.intents` og teller kall.

export type FakeIntent = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  client_secret: string;
  latest_charge: string | null;
  metadata: Record<string, string>;
};

export const stripeState = {
  configured: false,
  intents: new Map<string, FakeIntent>(),
  refunds: new Map<string, { id: string; status: string; amount: number; payment_intent: string; metadata: Record<string, string> }>(),
  /** Status en ny PaymentIntent får ved opprettelse (før "kunden betaler"). */
  initialStatus: "requires_payment_method",
  /** Status en refusjon får ved opprettelse. */
  refundStatus: "succeeded",
  failCapture: false,
  failRefund: false,
  captureCalls: 0,
  cancelCalls: 0,
  createCalls: 0,
  refundCalls: 0,
  seq: 0,
  reset() {
    this.configured = false;
    this.intents.clear();
    this.refunds.clear();
    this.initialStatus = "requires_payment_method";
    this.refundStatus = "succeeded";
    this.failCapture = false;
    this.failRefund = false;
    this.captureCalls = this.cancelCalls = this.createCalls = this.refundCalls = 0;
  },
  /** Simuler at kunden fullførte Stripe Elements: PI blir requires_capture. */
  authorize(id: string, patch: Partial<FakeIntent> = {}) {
    const pi = this.intents.get(id);
    if (!pi) throw new Error(`ukjent PI ${id}`);
    Object.assign(pi, { status: "requires_capture" }, patch);
  },
};

export const stripeConfigured = () => stripeState.configured;

export function stripe(): never {
  throw new Error("stripe() skal ikke kalles direkte i integrasjonstester");
}

export const createPaymentIntent = vi.fn(async (input: { amountMinor: number; currency: string; idempotencyKey: string; checkoutPublicId: string }) => {
  stripeState.createCalls += 1;
  for (const pi of stripeState.intents.values()) if (pi.metadata.idem === input.idempotencyKey) return { id: pi.id, clientSecret: pi.client_secret, status: pi.status };
  const id = `pi_it_${++stripeState.seq}`;
  const pi: FakeIntent = {
    id,
    amount: input.amountMinor,
    currency: input.currency.toLowerCase(),
    status: stripeState.initialStatus,
    client_secret: `${id}_secret`,
    latest_charge: null,
    metadata: { checkout_public_id: input.checkoutPublicId, idem: input.idempotencyKey },
  };
  stripeState.intents.set(id, pi);
  return { id, clientSecret: pi.client_secret, status: pi.status };
});

export const retrievePaymentIntent = vi.fn(async (id: string) => {
  const pi = stripeState.intents.get(id);
  if (!pi) throw new AppError("NOT_FOUND", { message: `No such payment_intent: ${id}` });
  return { ...pi };
});

export const capturePaymentIntent = vi.fn(async (id: string, _idem: string, amountMinor?: number) => {
  stripeState.captureCalls += 1;
  const pi = stripeState.intents.get(id);
  if (!pi) throw new Error(`No such payment_intent: ${id}`);
  if (stripeState.failCapture) throw new Error("capture failed (simulated)");
  if (pi.status !== "requires_capture") throw new Error(`PaymentIntent ${id} cannot be captured in status ${pi.status}`);
  if (amountMinor !== undefined && amountMinor > pi.amount) throw new Error("amount_to_capture exceeds authorized amount");
  pi.status = "succeeded";
  pi.latest_charge = `ch_${id}`;
  return { ...pi };
});

export const cancelPaymentIntent = vi.fn(async (id: string) => {
  stripeState.cancelCalls += 1;
  const pi = stripeState.intents.get(id);
  if (!pi) throw new Error(`No such payment_intent: ${id}`);
  if (pi.status === "succeeded") throw new Error("cannot cancel a captured PaymentIntent");
  pi.status = "canceled";
  return { ...pi };
});

export const createRefund = vi.fn(async (input: { paymentIntentId: string; amountMinor: number; idempotencyKey: string; metadata?: Record<string, string> }) => {
  stripeState.refundCalls += 1;
  if (stripeState.failRefund) throw new Error("refund failed (simulated)");
  const existing = [...stripeState.refunds.values()].find((r) => r.metadata.idem === input.idempotencyKey);
  if (existing) return existing;
  const id = `re_it_${++stripeState.seq}`;
  const r = { id, status: stripeState.refundStatus, amount: input.amountMinor, payment_intent: input.paymentIntentId, metadata: { ...(input.metadata ?? {}), idem: input.idempotencyKey } };
  stripeState.refunds.set(id, r);
  return r;
});

/** Testen setter `constructWebhookEvent.mockImplementation` for å returnere en hendelse. */
export const constructWebhookEvent = vi.fn((...args: [rawBody: string, signature: string]): unknown => {
  void args;
  throw new Error("Ugyldig signatur (mock)");
});
