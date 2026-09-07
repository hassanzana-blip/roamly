import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/stripe", () => import("./stripeMock"));

import { stripeState } from "./stripeMock";
import { caller, closeDb, countRows, rows, runJobsUntilIdle, sessionInput, truncateAll, TOMORROW_PLUS } from "./setup";
import { setDuffelClient } from "../lib/duffel";
import { DuffelFake } from "../lib/duffelFake";
import { reconcileBookingById, sweepBookings } from "../lib/reconcile";
import app from "../boot";
import { signPayload } from "../lib/duffelWebhook";

// ─── Avstemming mot leverandør (fake Duffel) ────────────────────────────────

const fake = new DuffelFake();
let dateSeq = 0;

async function confirmedFakeBooking() {
  const res = await caller().flights.search({
    slices: [{ origin: "OSL", destination: "CPH", departureDate: TOMORROW_PLUS(40 + (dateSeq++ % 100)) }],
    passengers: [{ type: "adult" }],
    cabinClass: "economy",
  });
  const s = await caller().checkout.createSession(sessionInput(res.offers[0]));
  const [sess] = await rows<{ psp_intent_id: string }>(`SELECT psp_intent_id FROM checkout_sessions WHERE public_id='${s.publicId}'`);
  stripeState.authorize(sess.psp_intent_id);
  await caller().checkout.paymentAuthorized({ publicId: s.publicId });
  await runJobsUntilIdle();
  const [b] = await rows<{ id: number; order_id: string; state: string }>("SELECT id, order_id, state FROM bookings");
  expect(b.state).toBe("CONFIRMED");
  return b;
}

describe("reconcile", () => {
  beforeEach(async () => {
    await truncateAll();
    stripeState.reset();
    stripeState.configured = true;
    fake.reset();
    setDuffelClient(fake);
  });
  afterEach(() => setDuffelClient(null));
  afterAll(closeDb);

  it("flyselskapet kansellerer: booking CANCELLED, refusjonssak airline_cancellation, support-sak og e-post — idempotent", async () => {
    const b = await confirmedFakeBooking();
    fake.airlineCancel(b.order_id);
    await reconcileBookingById(b.id, "test");

    const [after] = await rows<{ state: string; cancelled_at: Date | null }>(`SELECT state, cancelled_at FROM bookings WHERE id=${b.id}`);
    expect(after.state).toBe("CANCELLED");
    expect(after.cancelled_at).not.toBeNull();
    const rcs = await rows<{ kind: string; state: string; initiated_by: string }>("SELECT kind, state, initiated_by FROM refund_cases");
    expect(rcs).toEqual([{ kind: "airline_cancellation", state: "requested", initiated_by: "system" }]);
    const cases = await rows<{ priority: string; status: string; tags: string }>("SELECT priority, status, tags FROM support_cases");
    expect(cases.length).toBe(1);
    expect(cases[0].priority).toBe("high");
    expect(cases[0].tags).toContain("airline_cancellation");
    expect(await countRows("jobs", "type='send_email' AND status='pending'")).toBeGreaterThanOrEqual(2);
    expect(await countRows("audit_logs", "action='booking.reconciled_state_change'")).toBe(1);

    const events = await countRows("booking_events");
    await reconcileBookingById(b.id, "test");
    await reconcileBookingById(b.id, "test");
    expect(await countRows("booking_events")).toBe(events);
    expect(await countRows("refund_cases")).toBe(1);
    expect(await countRows("support_cases")).toBe(1);

    await runJobsUntilIdle();
    const kinds = (await rows<{ kind: string }>("SELECT kind FROM email_events")).map((r) => r.kind);
    expect(kinds).toContain("cancellation_confirmed");
    // Refusjonssaken venter på leverandørbeløp (requested) — behandles ikke automatisk
    const [rc] = await rows<{ state: string }>("SELECT state FROM refund_cases");
    expect(rc.state).toBe("requested");
  });

  it("ruteendring: schedule_changes-rad, booking CHANGE_REQUESTED, segmenter oppdatert, e-post — ingen duplikater ved ny kjøring", async () => {
    const b = await confirmedFakeBooking();
    const before = await rows<{ departing_at: string }>(`SELECT departing_at FROM booking_segments WHERE booking_id=${b.id} ORDER BY segment_index`);
    fake.scheduleChange(b.order_id, 90);
    await reconcileBookingById(b.id, "test");

    const [after] = await rows<{ state: string }>(`SELECT state FROM bookings WHERE id=${b.id}`);
    expect(after.state).toBe("CHANGE_REQUESTED");
    const changes = await rows<{ status: string; old_segments_json: string; new_segments_json: string }>("SELECT status, old_segments_json, new_segments_json FROM schedule_changes");
    expect(changes.length).toBe(1);
    expect(changes[0].status).toBe("detected");
    expect(changes[0].old_segments_json).not.toBe(changes[0].new_segments_json);
    const segs = await rows<{ departing_at: string }>(`SELECT departing_at FROM booking_segments WHERE booking_id=${b.id} ORDER BY segment_index`);
    expect(Date.parse(segs[0].departing_at) - Date.parse(before[0].departing_at)).toBe(90 * 60_000);
    const [bk] = await rows<{ payload: string }>(`SELECT payload FROM bookings WHERE id=${b.id}`);
    expect((JSON.parse(bk.payload) as { slices: Array<{ departingAt: string }> }).slices[0].departingAt).toBe(segs[0].departing_at);

    const events = await countRows("booking_events");
    await reconcileBookingById(b.id, "test");
    expect(await countRows("schedule_changes")).toBe(1);
    expect(await countRows("booking_events")).toBe(events);

    await runJobsUntilIdle();
    const kinds = (await rows<{ kind: string }>("SELECT kind FROM email_events")).map((r) => r.kind);
    expect(kinds.filter((k) => k === "schedule_change").length).toBe(1);
    expect(await countRows("audit_logs", "action='booking.schedule_change_detected'")).toBe(1);

    // Kunden ser endringen på ordren
    const st = await rows<{ public_id: string }>("SELECT public_id FROM checkout_sessions");
    const status = await caller().checkout.status({ publicId: st[0].public_id });
    const order = await caller().orders.get({ orderId: b.order_id, accessToken: status.accessToken! });
    expect(order.scheduleChanges.length).toBe(1);
    expect(order.state).toBe("CHANGE_REQUESTED");
  });

  it("Duffel-webhook for ordren utløser avstemming via jobbkø", async () => {
    const b = await confirmedFakeBooking();
    fake.airlineCancel(b.order_id);
    const body = JSON.stringify({ id: "wev_cancel_1", type: "order.cancelled", data: { object: { id: b.order_id } } });
    const ts = String(Math.floor(Date.now() / 1000));
    const res = await app.request("/api/webhooks/duffel", {
      method: "POST",
      headers: { "content-type": "application/json", "x-duffel-signature": `t=${ts},v1=${signPayload(process.env.DUFFEL_WEBHOOK_SECRET!, ts, body)}` },
      body,
    });
    expect(res.status).toBe(200);
    await runJobsUntilIdle();
    const [after] = await rows<{ state: string }>(`SELECT state FROM bookings WHERE id=${b.id}`);
    expect(after.state).toBe("CANCELLED");
    const [ev] = await rows<{ status: string }>("SELECT status FROM webhook_events");
    expect(ev.status).toBe("processed");
  });

  it("sweep legger reconcile-jobber i kø for aktive bookinger og utløper gamle sesjoner", async () => {
    const b = await confirmedFakeBooking();
    await rows(`UPDATE bookings SET state='AWAITING_RECONCILIATION' WHERE id=${b.id}`);
    // En forlatt sesjon (eldre enn 20 min, ingen betaling)
    await rows(`UPDATE checkout_sessions SET status='created', created_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id NOT IN (SELECT checkout_session_id FROM bookings)`);
    const res = await caller().flights.search({ slices: [{ origin: "OSL", destination: "CPH", departureDate: TOMORROW_PLUS(200) }], passengers: [{ type: "adult" }], cabinClass: "economy" });
    const stale = await caller().checkout.createSession(sessionInput(res.offers[0]));
    await rows(`UPDATE checkout_sessions SET created_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE public_id='${stale.publicId}'`);

    await sweepBookings();
    expect(await countRows("jobs", `type='reconcile_order' AND status='pending'`)).toBe(1);
    const st = await caller().checkout.status({ publicId: stale.publicId });
    expect(st.status).toBe("expired");
    expect(st.errorCode).toBe("SESSION_EXPIRED");
    expect(stripeState.cancelCalls).toBe(1);
  });
});
