import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/stripe", () => import("./stripeMock"));

import { stripeState } from "./stripeMock";
import { assertLedgerBalanced, caller, closeDb, countRows, expectAppCode, fakeCustomer, fakeStaff, rows, seedStaff, runJobsUntilIdle, sessionInput, truncateAll, TOMORROW_PLUS, CONTACT } from "./setup";
import { setDuffelClient } from "../lib/duffel";
import type { Offer } from "../../contracts/types";

// ─── Ordrer: tilgang, avbestilling/refusjon, admin-refusjoner ──────────────

async function refundableOffer(): Promise<Offer> {
  for (let d = 30; d < 120; d += 3) {
    const res = await caller().flights.search({
      slices: [{ origin: "OSL", destination: "TRD", departureDate: TOMORROW_PLUS(d) }],
      passengers: [{ type: "adult" }],
      cabinClass: "business",
    });
    const o = res.offers.find((x) => x.conditions?.refundBeforeDeparture?.allowed);
    if (o) return o;
  }
  throw new Error("fant ikke refunderbart demo-tilbud");
}

async function confirmedBooking(offer?: Offer) {
  const o = offer ?? (await refundableOffer());
  const s = await caller().checkout.createSession(sessionInput(o));
  await caller().checkout.confirmDemo({ publicId: s.publicId });
  await runJobsUntilIdle();
  const st = await caller().checkout.status({ publicId: s.publicId });
  expect(st.status).toBe("confirmed");
  const [b] = await rows<{ id: number }>("SELECT id FROM bookings");
  return { orderId: st.orderId!, accessToken: st.accessToken!, bookingId: b.id, breakdown: st.breakdown };
}

describe("orders: tilgangskontroll", () => {
  beforeEach(async () => {
    await truncateAll();
    stripeState.reset();
    setDuffelClient(null);
  });
  afterAll(closeDb);

  it("uten token → FORBIDDEN, med token → OK, verifisert kunde med samme e-post → OK, uverifisert → FORBIDDEN", async () => {
    const { orderId, accessToken } = await confirmedBooking();
    await expectAppCode(caller().orders.get({ orderId }), "FORBIDDEN");
    await expectAppCode(caller().orders.get({ orderId, accessToken: "x".repeat(40) }), "FORBIDDEN");
    await expectAppCode(caller().orders.get({ orderId: "ord_finnes_ikke", accessToken }), "FORBIDDEN");
    const ok = await caller().orders.get({ orderId, accessToken });
    expect(ok.state).toBe("CONFIRMED");

    const verified = caller({ customer: fakeCustomer({ email: CONTACT.contactEmail, emailVerified: true }) });
    expect((await verified.orders.get({ orderId })).state).toBe("CONFIRMED");
    const unverified = caller({ customer: fakeCustomer({ email: CONTACT.contactEmail, emailVerified: false }) });
    await expectAppCode(unverified.orders.get({ orderId }), "FORBIDDEN");
    const other = caller({ customer: fakeCustomer({ email: "annen@hellosky.test", emailVerified: true }) });
    await expectAppCode(other.orders.get({ orderId }), "FORBIDDEN");
  });

  it("customerAuth.myTrips krever verifisert e-post (EMAIL_NOT_VERIFIED)", async () => {
    await expectAppCode(caller({ customer: fakeCustomer({ emailVerified: false }) }).customerAuth.myTrips(), "EMAIL_NOT_VERIFIED");
    await expectAppCode(caller().customerAuth.myTrips(), "UNAUTHORIZED");
    const { orderId } = await confirmedBooking();
    const trips = await caller({ customer: fakeCustomer({ email: CONTACT.contactEmail, emailVerified: true }) }).customerAuth.myTrips();
    expect(trips.length).toBe(1);
    expect(JSON.stringify(trips)).toContain(orderId);
  });
});

describe("orders: avbestilling og refusjon (demo)", () => {
  beforeEach(async () => {
    await truncateAll();
    stripeState.reset();
    setDuffelClient(null);
  });
  afterAll(closeDb);

  it("cancellationQuote → confirmCancellation → refusjonssak behandles til closed, hovedbok balansert, booking (delvis) refundert", async () => {
    const { orderId, accessToken, bookingId, breakdown } = await confirmedBooking();
    const c = caller();
    const q = await c.orders.cancellationQuote({ orderId, accessToken });
    expect(q.currency).toBe("NOK");
    expect(q.supplierRefundMinor).toBe(Math.round(breakdown.supplierAmountMinor * 0.8));
    expect(q.totalToCustomerMinor).toBe(q.supplierRefundMinor + q.serviceFeeRefundMinor);
    expect(q.totalToCustomerMinor).toBeLessThanOrEqual(breakdown.totalAmountMinor);

    const r = await c.orders.confirmCancellation({ orderId, accessToken, cancellationId: q.cancellationId });
    expect(r.state).toBe("CANCELLED");
    let [rc] = await rows<{ id: number; state: string; kind: string }>("SELECT id, state, kind FROM refund_cases");
    expect(rc.kind).toBe("customer_cancellation");
    expect(rc.state).toBe("supplier_confirmed");
    let [b] = await rows<{ state: string; cancelled_at: Date | null }>("SELECT state, cancelled_at FROM bookings");
    expect(b.state).toBe("CANCELLED");
    expect(b.cancelled_at).not.toBeNull();

    const ran = await runJobsUntilIdle();
    expect(ran.find((j) => j.type === "process_refund")?.outcome).toBe("done");
    [rc] = await rows("SELECT id, state, kind FROM refund_cases");
    expect(rc.state).toBe("closed");
    const timeline = (await rows<{ to_state: string }>(`SELECT to_state FROM refund_events WHERE refund_case_id=${rc.id} ORDER BY id`)).map((e) => e.to_state);
    expect(timeline).toEqual(["requested", "eligibility_checked", "supplier_requested", "supplier_confirmed", "amount_confirmed", "psp_refund_created", "psp_refund_succeeded", "customer_notified", "closed"]);

    const [p] = await rows<{ refunded_minor: number; amount_minor: number; status: string }>("SELECT refunded_minor, amount_minor, status FROM payments");
    expect(Number(p.refunded_minor)).toBe(q.totalToCustomerMinor);
    const full = Number(p.refunded_minor) >= Number(p.amount_minor);
    expect(p.status).toBe(full ? "refunded" : "partially_refunded");
    [b] = await rows("SELECT state, cancelled_at FROM bookings");
    expect(b.state).toBe(full ? "REFUNDED" : "PARTIALLY_REFUNDED");
    await assertLedgerBalanced(bookingId);
    expect(await countRows("invoices", "kind='credit_note'")).toBe(1);
    const kinds = (await rows<{ kind: string }>("SELECT kind FROM email_events")).map((r) => r.kind);
    expect(kinds).toContain("cancellation_confirmed");
    expect(kinds).toContain("refund_paid");

    // Ny avbestilling → NOT_REFUNDABLE
    await expectAppCode(c.orders.cancellationQuote({ orderId, accessToken }), "NOT_REFUNDABLE");
    await expectAppCode(c.orders.confirmCancellation({ orderId, accessToken, cancellationId: q.cancellationId }), "NOT_REFUNDABLE");
    const status = await c.orders.refundStatus({ orderId, accessToken });
    expect(status.length).toBe(1);
    expect(status[0].state).toBe("closed");
  });

  it("åpen refusjonssak blokkerer ny cancellationQuote (CONFLICT)", async () => {
    const { orderId, accessToken } = await confirmedBooking();
    const q = await caller().orders.cancellationQuote({ orderId, accessToken });
    await caller().orders.confirmCancellation({ orderId, accessToken, cancellationId: q.cancellationId });
    // Sak er åpen (ikke behandlet ennå); booking er CANCELLED → NOT_REFUNDABLE er den første sjekken
    await expectAppCode(caller().orders.cancellationQuote({ orderId, accessToken }), "NOT_REFUNDABLE");
    // Kulanse-sak via admin på en booking med åpen sak: opprettes, men kundekansellering er blokkert
    const admin = caller({ staff: fakeStaff() });
    const [b] = await rows<{ id: number }>("SELECT id FROM bookings");
    const rc = await admin.admin.requestRefund({ bookingId: b.id, kind: "staff_goodwill", amountMinor: 100, reason: "Kulanse for testens skyld" });
    expect(rc.ok).toBe(true);
    const openCases = await rows<{ state: string }>("SELECT state FROM refund_cases");
    expect(openCases.length).toBe(2);
  });

  it("admin.requestRefund over fanget beløp → REFUND_EXCEEDS_CAPTURED; approveRefund krever fersk sesjon", async () => {
    const { bookingId, breakdown } = await confirmedBooking();
    const owner = await seedStaff({ role: "OWNER" });
    const admin = caller({ staff: owner });
    await expectAppCode(
      admin.admin.requestRefund({ bookingId, kind: "staff_goodwill", amountMinor: breakdown.totalAmountMinor + 1, reason: "For mye refusjon i test" }),
      "REFUND_EXCEEDS_CAPTURED",
    );
    const rc = await admin.admin.requestRefund({ bookingId, kind: "staff_goodwill", amountMinor: 5_000, reason: "Kulanse: forsinket svar fra support" });

    const stale = caller({ staff: { ...owner, sessionCreatedAt: new Date(Date.now() - 20 * 60_000) } });
    await expect(stale.admin.approveRefund({ refundCaseId: rc.id })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const support = caller({ staff: fakeStaff({ role: "SUPPORT" }) });
    await expect(support.admin.approveRefund({ refundCaseId: rc.id })).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Innlogget, men uten bekreftet totrinn: autentisert nok til å bli sett,
    // ikke nok til å godkjenne penger. Det er 403, ikke 401.
    const noMfa = caller({ staff: { ...owner, mfaVerified: false } });
    await expect(noMfa.admin.approveRefund({ refundCaseId: rc.id })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const ok = await admin.admin.approveRefund({ refundCaseId: rc.id, note: "Godkjent" });
    expect(ok.amountMinor).toBe(5_000);
    await runJobsUntilIdle();
    const [row] = await rows<{ state: string; customer_refund_amount_minor: number }>(`SELECT state, customer_refund_amount_minor FROM refund_cases WHERE id=${rc.id}`);
    expect(row.state).toBe("closed");
    expect(Number(row.customer_refund_amount_minor)).toBe(5_000);
    const [p] = await rows<{ refunded_minor: number; status: string }>("SELECT refunded_minor, status FROM payments");
    expect(Number(p.refunded_minor)).toBe(5_000);
    expect(p.status).toBe("partially_refunded");
    const [b] = await rows<{ state: string }>("SELECT state FROM bookings");
    expect(b.state).toBe("PARTIALLY_REFUNDED");
    await assertLedgerBalanced(bookingId);
    // Kulanse utover leverandør/gebyr bokføres som goodwill
    expect(await countRows("ledger_entries", "account='goodwill_expense'")).toBe(1);
    expect(await countRows("audit_logs", "action='refund.approved'")).toBe(1);
  });

  it("resendConfirmation legger e-postjobb i kø (dedupe innen 10 min)", async () => {
    const { orderId, accessToken } = await confirmedBooking();
    await runJobsUntilIdle();
    const a = await caller().orders.resendConfirmation({ orderId, accessToken });
    expect(a.queued).toBe(true);
    const b = await caller().orders.resendConfirmation({ orderId, accessToken });
    expect(b.queued).toBe(false);
    expect(await countRows("jobs", "type='send_email' AND status='pending'")).toBe(1);
  });
});

describe("refusjon med Stripe (mock)", () => {
  beforeEach(async () => {
    await truncateAll();
    stripeState.reset();
    stripeState.configured = true;
    setDuffelClient(null);
  });
  afterAll(closeDb);

  it("stripe-refusjon: pending → webhook succeeded lukker saken; feilet refusjon → psp_refund_failed og retry", async () => {
    const offer = await refundableOffer();
    const s = await caller().checkout.createSession(sessionInput(offer));
    expect(s.payment.provider).toBe("stripe");
    const [sess] = await rows<{ psp_intent_id: string }>("SELECT psp_intent_id FROM checkout_sessions");
    stripeState.authorize(sess.psp_intent_id);
    await caller().checkout.paymentAuthorized({ publicId: s.publicId });
    await runJobsUntilIdle();
    const st = await caller().checkout.status({ publicId: s.publicId });
    expect(st.status).toBe("confirmed");

    const q = await caller().orders.cancellationQuote({ orderId: st.orderId!, accessToken: st.accessToken! });
    await caller().orders.confirmCancellation({ orderId: st.orderId!, accessToken: st.accessToken!, cancellationId: q.cancellationId });

    // Første forsøk feiler hos Stripe
    stripeState.failRefund = true;
    await runJobsUntilIdle();
    let [rc] = await rows<{ id: number; state: string; psp_refund_id: string | null }>("SELECT id, state, psp_refund_id FROM refund_cases");
    expect(rc.state).toBe("psp_refund_failed");
    expect(rc.psp_refund_id).toBeNull();
    expect(await countRows("ledger_entries", "refund_case_id IS NOT NULL")).toBe(0);

    // Retry fra admin → pending hos Stripe
    stripeState.failRefund = false;
    stripeState.refundStatus = "pending";
    const admin = caller({ staff: fakeStaff() });
    await admin.admin.retryRefund({ refundCaseId: rc.id });
    await runJobsUntilIdle();
    [rc] = await rows("SELECT id, state, psp_refund_id FROM refund_cases");
    expect(rc.state).toBe("psp_refund_pending");
    expect(rc.psp_refund_id).toMatch(/^re_it_/);
    expect(stripeState.refundCalls).toBe(2);
    const [p] = await rows<{ refunded_minor: number }>("SELECT refunded_minor FROM payments");
    expect(Number(p.refunded_minor)).toBe(q.totalToCustomerMinor);

    // Stripe bekrefter via webhook-hendelse
    const { applyStripeRefundEvent } = await import("../lib/refunds");
    await applyStripeRefundEvent({ id: rc.psp_refund_id!, status: "succeeded", amount: q.totalToCustomerMinor, metadata: { refund_case_id: String(rc.id) } });
    [rc] = await rows("SELECT id, state, psp_refund_id FROM refund_cases");
    expect(rc.state).toBe("closed");
    await assertLedgerBalanced();
    const [b] = await rows<{ state: string }>("SELECT state FROM bookings");
    expect(["REFUNDED", "PARTIALLY_REFUNDED"]).toContain(b.state);
    // Duplikat webhook er ufarlig
    await applyStripeRefundEvent({ id: rc.psp_refund_id!, status: "succeeded", amount: q.totalToCustomerMinor, metadata: null });
    expect(await countRows("refund_events", "to_state='closed'")).toBe(1);
  });
});
