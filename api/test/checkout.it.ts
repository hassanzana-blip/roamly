import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/stripe", () => import("./stripeMock"));

import { stripeState } from "./stripeMock";
import {
  adultFor,
  assertLedgerBalanced,
  caller,
  closeDb,
  countRows,
  expectAppCode,
  fakeStaff,
  rows,
  runJobsUntilIdle,
  searchOffer,
  sessionInput,
  truncateAll,
  TOMORROW_PLUS,
} from "./setup";
import { setDuffelClient } from "../lib/duffel";
import { DuffelFake } from "../lib/duffelFake";
import { env } from "../lib/env";
import { toMinor } from "../lib/money";
import { reconcileBookingById } from "../lib/reconcile";

// ─── Checkout → orkestrator → booking (ekte DB) ────────────────────────────

const fake = new DuffelFake();
let dateSeq = 0;
/** Ulik avreisedato per søk slik at søkecachen (live/fake-modus) ikke gjenbruker gamle tilbud. */
const nextDate = () => TOMORROW_PLUS(30 + (dateSeq++ % 200));

async function fakeOffer(input: Parameters<typeof searchOffer>[0] = {}) {
  const res = await caller().flights.search({
    slices: [{ origin: input.origin ?? "OSL", destination: input.destination ?? "BGO", departureDate: nextDate() }],
    passengers: input.pax ?? [{ type: "adult" }],
    cabinClass: input.cabinClass ?? "economy",
  });
  return res.offers[0];
}

describe("checkout (demo-modus)", () => {
  beforeEach(async () => {
    await truncateAll();
    stripeState.reset();
    setDuffelClient(null);
  });
  afterAll(closeDb);

  it("full happy path: søk → sesjon → confirmDemo → jobber → bekreftet ordre med billetter, betaling, hovedbok, kvittering og e-poster", async () => {
    const offer = await searchOffer();
    const c = caller();
    const s = await c.checkout.createSession(sessionInput(offer));
    expect(s.payment.provider).toBe("demo");
    expect(s.demoMode).toBe(true);
    expect(s.breakdown.supplierAmountMinor).toBe(toMinor(offer.totalAmount, "NOK"));
    expect(s.breakdown.totalAmountMinor).toBe(s.breakdown.supplierAmountMinor + s.breakdown.serviceFeeAmountMinor + s.breakdown.servicesAmountMinor);

    const auth = await c.checkout.confirmDemo({ publicId: s.publicId });
    expect(auth.status).toBe("authorized");

    const ran = await runJobsUntilIdle();
    expect(ran.every((j) => j.outcome === "done")).toBe(true);
    expect(ran.map((j) => j.type)).toContain("process_booking_attempt");

    const st = await c.checkout.status({ publicId: s.publicId });
    expect(st.status).toBe("confirmed");
    expect(st.orderId).toBeTruthy();
    expect(st.accessToken).toBeTruthy();
    expect(st.bookingReference).toMatch(/^[A-Z0-9]{6}$/);

    const order = await caller().orders.get({ orderId: st.orderId!, accessToken: st.accessToken! });
    expect(order.state).toBe("CONFIRMED");
    expect(order.order.tickets.length).toBe(1);
    expect(order.payment?.status).toBe("captured");
    expect(order.payment?.amountMinor).toBe(s.breakdown.totalAmountMinor);

    expect(await countRows("bookings")).toBe(1);
    expect(await countRows("booking_attempts")).toBe(1);
    expect(await countRows("booking_events")).toBeGreaterThanOrEqual(3);
    expect(await countRows("booking_segments")).toBeGreaterThanOrEqual(1);
    expect(await countRows("payments", "status='captured'")).toBe(1);
    await assertLedgerBalanced();
    const inv = await rows<{ invoice_number: number; kind: string }>("SELECT invoice_number, kind FROM invoices");
    expect(inv).toEqual([{ invoice_number: 1, kind: "receipt" }]);
    const kinds = (await rows<{ kind: string }>("SELECT kind FROM email_events")).map((r) => r.kind);
    expect(kinds).toContain("booking_confirmation");
    expect(kinds).toContain("payment_receipt");
    expect(await countRows("jobs", "status <> 'done'")).toBe(0);
  });

  it("idempotens: samme idempotencyKey gir samme sesjon; 10 parallelle confirmDemo gir ett forsøk og én booking", async () => {
    const offer = await searchOffer();
    const input = sessionInput(offer);
    const a = await caller().checkout.createSession(input);
    const b = await caller().checkout.createSession(input);
    expect(b.publicId).toBe(a.publicId);
    expect(await countRows("checkout_sessions")).toBe(1);

    const results = await Promise.allSettled(Array.from({ length: 10 }, () => caller().checkout.confirmDemo({ publicId: a.publicId })));
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(10);
    expect(await countRows("booking_attempts")).toBe(1);
    expect(await countRows("jobs", "type='process_booking_attempt'")).toBe(1);

    await runJobsUntilIdle();
    expect(await countRows("bookings")).toBe(1);
    // Ny kjøring av samme forsøk er en no-op
    await caller().checkout.confirmDemo({ publicId: a.publicId }).catch(() => {});
    await runJobsUntilIdle();
    expect(await countRows("bookings")).toBe(1);
    expect(await countRows("payments")).toBe(1);
    expect(await countRows("invoices")).toBe(1);
  });

  it("validering: barn med voksen fødselsdato → INVALID_PASSENGER", async () => {
    const offer = await searchOffer({ pax: [{ type: "adult" }, { type: "child", age: 8 }] });
    const passengers = [adultFor(offer, 0), { ...adultFor(offer, 1), type: "child" as const, bornOn: "1985-04-12" }];
    await expectAppCode(caller().checkout.createSession(sessionInput(offer, { passengers })), "INVALID_PASSENGER");
  });

  it("validering: baby uten voksen-kobling → INFANT_LINK", async () => {
    const offer = await searchOffer({ pax: [{ type: "adult" }, { type: "infant_without_seat", age: 1 }] });
    const passengers = [adultFor(offer, 0), { ...adultFor(offer, 1), givenName: "Lille", type: "infant_without_seat" as const, bornOn: TOMORROW_PLUS(-200), title: undefined, gender: undefined }];
    await expectAppCode(caller().checkout.createSession(sessionInput(offer, { passengers })), "INFANT_LINK");
  });

  it("validering: tilbud som krever pass uten pass → IDENTITY_DOCUMENT_REQUIRED; med pass lagres nummeret kryptert og maskeres i admin", async () => {
    const offer = await searchOffer({ destination: "JFK" });
    expect(offer.identityDocumentsRequired).toBe(true);
    await expectAppCode(caller().checkout.createSession(sessionInput(offer)), "IDENTITY_DOCUMENT_REQUIRED");

    const passport = "NO1234567";
    const passengers = [adultFor(offer, 0, { identityDocument: { type: "passport", uniqueIdentifier: passport, issuingCountryCode: "NO", expiresOn: "2035-01-01" } })];
    const s = await caller().checkout.createSession(sessionInput(offer, { passengers }));
    const docs = await rows<{ identifier_ciphertext: string; identifier_last4: string }>("SELECT identifier_ciphertext, identifier_last4 FROM passenger_documents");
    expect(docs.length).toBe(1);
    expect(docs[0].identifier_ciphertext).not.toContain(passport);
    expect(docs[0].identifier_last4).toBe("4567");
    // Passnummer skal ikke ligge i klartekst i sesjonen
    const sess = await rows<{ passengers_json: string; offer_snapshot: string }>("SELECT passengers_json, offer_snapshot FROM checkout_sessions");
    expect(sess[0].passengers_json).not.toContain(passport);

    await caller().checkout.confirmDemo({ publicId: s.publicId });
    await runJobsUntilIdle();
    const [b] = await rows<{ id: number; payload: string }>("SELECT id, payload FROM bookings");
    expect(b.payload).not.toContain(passport);

    const admin = caller({ staff: fakeStaff({ role: "OWNER" }) });
    const detail = await admin.admin.bookingDetail({ id: b.id });
    expect(detail.passengerDocuments.length).toBe(1);
    expect(detail.passengerDocuments[0].last4).toBe("4567");
    expect(JSON.stringify(detail)).not.toContain(passport);

    const revealed = await admin.admin.revealPassengerDocument({ documentId: detail.passengerDocuments[0].id });
    expect(revealed.uniqueIdentifier).toBe(passport);
    expect(await countRows("audit_logs", "action='passenger_document.revealed'")).toBe(1);

    // Uten customers:reveal → FORBIDDEN
    const support = caller({ staff: fakeStaff({ role: "SUPPORT" }) });
    await expect(support.admin.revealPassengerDocument({ documentId: detail.passengerDocuments[0].id })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("bags (demo): 2 ekstra kolli prises som 2 × bagpris", async () => {
    const offer = await searchOffer();
    const bag = toMinor(offer.services!.extraBagPrice!, "NOK");
    const s = await caller().checkout.createSession(sessionInput(offer, { services: { extraBags: 2 } }));
    expect(s.breakdown.servicesAmountMinor).toBe(2 * bag);
    await caller().checkout.confirmDemo({ publicId: s.publicId });
    await runJobsUntilIdle();
    const [p] = await rows<{ amount_minor: number }>("SELECT amount_minor FROM payments");
    expect(Number(p.amount_minor)).toBe(s.breakdown.totalAmountMinor);
    const [l] = await rows<{ amount_minor: number }>("SELECT amount_minor FROM ledger_entries WHERE account='supplier_payable' AND direction='credit'");
    expect(Number(l.amount_minor)).toBe(s.breakdown.supplierAmountMinor + 2 * bag);
  });
});

describe("checkout (Stripe mock + Duffel-fake)", () => {
  beforeEach(async () => {
    await truncateAll();
    stripeState.reset();
    stripeState.configured = true;
    fake.reset();
    setDuffelClient(fake);
    env.MAX_DAILY_LIVE_AMOUNT_MINOR = 0;
  });
  afterEach(() => setDuffelClient(null));
  afterAll(closeDb);

  async function authorizedSession(over: Record<string, unknown> = {}, offerInput: Parameters<typeof fakeOffer>[0] = {}) {
    const offer = await fakeOffer(offerInput);
    const s = await caller().checkout.createSession(sessionInput(offer, over));
    expect(s.payment.provider).toBe("stripe");
    if (s.payment.provider !== "stripe") throw new Error("unreachable");
    expect(s.payment.clientSecret).toMatch(/_secret$/);
    const [sess] = await rows<{ psp_intent_id: string; status: string }>(`SELECT psp_intent_id, status FROM checkout_sessions WHERE public_id='${s.publicId}'`);
    expect(sess.status).toBe("payment_pending");
    return { offer, session: s, intentId: sess.psp_intent_id };
  }

  it("stripe happy path: PI requires_capture → paymentAuthorized → fangst én gang → CONFIRMED", async () => {
    const { session, intentId } = await authorizedSession();
    // Før kunden har betalt: PAYMENT_REQUIRED
    await expectAppCode(caller().checkout.paymentAuthorized({ publicId: session.publicId }), "PAYMENT_REQUIRED");
    stripeState.authorize(intentId);

    const results = await Promise.allSettled(Array.from({ length: 10 }, () => caller().checkout.paymentAuthorized({ publicId: session.publicId })));
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(10);
    expect(await countRows("booking_attempts")).toBe(1);

    await runJobsUntilIdle();
    expect(fake.createOrderCalls).toBe(1);
    expect(stripeState.captureCalls).toBe(1);
    expect(stripeState.intents.get(intentId)!.status).toBe("succeeded");
    const st = await caller().checkout.status({ publicId: session.publicId });
    expect(st.status).toBe("confirmed");
    expect(st.bookingState).toBe("CONFIRMED");
    const [p] = await rows<{ provider: string; provider_ref: string; status: string; note: string }>("SELECT provider, provider_ref, status, note FROM payments");
    expect(p).toMatchObject({ provider: "stripe", provider_ref: intentId, status: "captured" });
    expect(p.note).toContain("ch_");
    await assertLedgerBalanced();
    expect(await countRows("bookings", "supplier='duffel' AND state='CONFIRMED'")).toBe(1);
  });

  it("stripe: beløpsavvik på PaymentIntent avvises uten å starte booking", async () => {
    const { session, intentId } = await authorizedSession();
    stripeState.authorize(intentId, { amount: session.breakdown.totalAmountMinor - 100 });
    await expectAppCode(caller().checkout.paymentAuthorized({ publicId: session.publicId }), "PAYMENT_REQUIRED");
    expect(await countRows("booking_attempts")).toBe(0);
    stripeState.authorize(intentId, { amount: session.breakdown.totalAmountMinor, currency: "eur" });
    await expectAppCode(caller().checkout.paymentAuthorized({ publicId: session.publicId }), "PAYMENT_REQUIRED");
    expect(await countRows("booking_attempts")).toBe(0);
  });

  it("stripe: kansellert PI → PAYMENT_FAILED", async () => {
    const { session, intentId } = await authorizedSession();
    stripeState.intents.get(intentId)!.status = "canceled";
    await expectAppCode(caller().checkout.paymentAuthorized({ publicId: session.publicId }), "PAYMENT_FAILED");
  });

  it("timeout hos leverandør, ordren finnes: gjenoppretting finner den → CONFIRMED med nøyaktig én ordre", async () => {
    const { session, intentId } = await authorizedSession();
    stripeState.authorize(intentId);
    fake.mode = "timeout";
    await caller().checkout.paymentAuthorized({ publicId: session.publicId });
    // Første kjøring: SUPPLIER_UNKNOWN + recover-jobb (planlagt)
    const first = await runJobsUntilIdle({ advanceScheduled: false });
    expect(first.map((j) => j.type)).toContain("process_booking_attempt");
    let [att] = await rows<{ state: string }>("SELECT state FROM booking_attempts");
    expect(att.state).toBe("SUPPLIER_UNKNOWN");
    expect(await countRows("jobs", "type='recover_attempt' AND status='pending'")).toBe(1);

    const ran = await runJobsUntilIdle();
    expect(ran.map((j) => j.type)).toContain("recover_attempt");
    [att] = await rows<{ state: string }>("SELECT state FROM booking_attempts");
    expect(att.state).toBe("CONFIRMED");
    expect(fake.orders.size).toBe(1);
    expect(fake.createOrderCalls).toBe(1);
    expect(stripeState.captureCalls).toBe(1);
    const st = await caller().checkout.status({ publicId: session.publicId });
    expect(st.status).toBe("confirmed");
  });

  it("timeout og ordren finnes aldri: FAILED_VOIDED, PI annullert, sesjon feilet, kunde-e-post i kø", async () => {
    const { session, intentId } = await authorizedSession();
    stripeState.authorize(intentId);
    fake.mode = "timeout_lost";
    await caller().checkout.paymentAuthorized({ publicId: session.publicId });
    const ran = await runJobsUntilIdle();
    expect(ran.filter((j) => j.type === "recover_attempt").length).toBe(3);
    const [att] = await rows<{ state: string; last_error_code: string; attempts: number }>("SELECT state, last_error_code, attempts FROM booking_attempts");
    expect(att.state).toBe("FAILED_VOIDED");
    expect(att.last_error_code).toBe("SUPPLIER_TIMEOUT");
    expect(Number(att.attempts)).toBe(3);
    expect(stripeState.cancelCalls).toBe(1);
    expect(stripeState.intents.get(intentId)!.status).toBe("canceled");
    expect(fake.orders.size).toBe(0);
    const st = await caller().checkout.status({ publicId: session.publicId });
    expect(st.status).toBe("failed");
    expect(st.errorCode).toBe("SUPPLIER_TIMEOUT");
    const kinds = (await rows<{ kind: string }>("SELECT kind FROM email_events")).map((r) => r.kind);
    expect(kinds).toContain("booking_failed_refunded");
    expect(kinds).toContain("ops_alert");
    expect(await countRows("bookings")).toBe(0);
  });

  it("price_up: sesjon price_changed, ingen ordre, PI annullert", async () => {
    const { session, intentId } = await authorizedSession();
    stripeState.authorize(intentId);
    fake.mode = "price_up";
    await caller().checkout.paymentAuthorized({ publicId: session.publicId });
    await runJobsUntilIdle();
    const st = await caller().checkout.status({ publicId: session.publicId });
    expect(st.status).toBe("price_changed");
    expect(st.errorCode).toBe("PRICE_CHANGED");
    expect(fake.createOrderCalls).toBe(0);
    expect(stripeState.cancelCalls).toBe(1);
    expect(await countRows("bookings")).toBe(0);
  });

  it("expired: OFFER_EXPIRED, ingen ordre, PI annullert", async () => {
    const { session, intentId } = await authorizedSession();
    stripeState.authorize(intentId);
    fake.mode = "expired";
    await caller().checkout.paymentAuthorized({ publicId: session.publicId });
    await runJobsUntilIdle();
    const st = await caller().checkout.status({ publicId: session.publicId });
    expect(st.status).toBe("failed");
    expect(st.errorCode).toBe("OFFER_EXPIRED");
    expect(stripeState.cancelCalls).toBe(1);
    expect(await countRows("bookings")).toBe(0);
  });

  it("reject (422): SUPPLIER_REJECTED terminal, ops varslet", async () => {
    const { session, intentId } = await authorizedSession();
    stripeState.authorize(intentId);
    fake.mode = "reject";
    await caller().checkout.paymentAuthorized({ publicId: session.publicId });
    await runJobsUntilIdle();
    const st = await caller().checkout.status({ publicId: session.publicId });
    expect(st.status).toBe("failed");
    expect(st.errorCode).toBe("SUPPLIER_REJECTED");
    expect(stripeState.cancelCalls).toBe(1);
    const kinds = (await rows<{ kind: string }>("SELECT kind FROM email_events")).map((r) => r.kind);
    expect(kinds).toContain("booking_failed_refunded");
    expect(kinds).toContain("ops_alert");
  });

  it("no_pnr: booking BOOKING_PROCESSING → avstemming setter CONFIRMED når PNR kommer", async () => {
    const { session, intentId } = await authorizedSession();
    stripeState.authorize(intentId);
    fake.mode = "no_pnr";
    await caller().checkout.paymentAuthorized({ publicId: session.publicId });
    const first = await runJobsUntilIdle({ advanceScheduled: false });
    expect(first.map((j) => j.type)).not.toContain("reconcile_order");
    let [b] = await rows<{ id: number; state: string; booking_reference: string; order_id: string }>("SELECT id, state, booking_reference, order_id FROM bookings");
    expect(b.state).toBe("BOOKING_PROCESSING");
    expect(b.booking_reference).toBe("");
    expect(stripeState.captureCalls).toBe(1);
    expect(await countRows("jobs", "type='reconcile_order' AND status='pending'")).toBe(1);
    const st = await caller().checkout.status({ publicId: session.publicId });
    expect(st.status).toBe("confirmed");
    expect(st.bookingState).toBe("BOOKING_PROCESSING");

    // Avstemming uten PNR → AWAITING_RECONCILIATION
    await runJobsUntilIdle();
    [b] = await rows("SELECT id, state, booking_reference, order_id FROM bookings");
    expect(b.state).toBe("AWAITING_RECONCILIATION");

    // Leverandøren utsteder PNR + billetter
    const o = fake.orders.get(b.order_id)!;
    fake.orders.set(b.order_id, {
      ...o,
      bookingReference: "PNR123",
      tickets: [{ passengerId: o.passengers[0].id, passengerName: "Ola Nordmann", type: "electronic_ticket", uniqueIdentifier: "117-0000000001" }],
    });
    await reconcileBookingById(b.id, "test");
    [b] = await rows("SELECT id, state, booking_reference, order_id FROM bookings");
    expect(b.state).toBe("CONFIRMED");
    expect(b.booking_reference).toBe("PNR123");
    expect(await countRows("tickets")).toBe(1);
    // Idempotent: ny avstemming gir ingen nye hendelser
    const before = await countRows("booking_events");
    await reconcileBookingById(b.id, "test");
    expect(await countRows("booking_events")).toBe(before);
  });

  it("bags (fake Duffel): leverandøren mottar tilbud + 2 × bagpris, breakdown korrekt", async () => {
    const spy = vi.spyOn(fake, "createOrder");
    const { offer, session, intentId } = await authorizedSession({ services: { extraBags: 2 } });
    const bag = toMinor(offer.services!.extraBagPrice!, "NOK");
    expect(session.breakdown.servicesAmountMinor).toBe(2 * bag);
    stripeState.authorize(intentId);
    await caller().checkout.paymentAuthorized({ publicId: session.publicId });
    await runJobsUntilIdle();
    expect(spy).toHaveBeenCalledTimes(1);
    const input = spy.mock.calls[0][0];
    expect(input.amountMinor).toBe(toMinor(offer.totalAmount, "NOK") + 2 * bag);
    expect(input.services?.extraBags).toBe(2);
    const order = spy.mock.results[0].value as Promise<{ totalAmount: string }>;
    expect(toMinor((await order).totalAmount, "NOK")).toBe(input.amountMinor);
    const st = await caller().checkout.status({ publicId: session.publicId });
    expect(st.status).toBe("confirmed");
    spy.mockRestore();
  });

  it("daglig live-tak (MAX_DAILY_LIVE_AMOUNT_MINOR): FAILED_VOIDED med DAILY_CAP og ops-varsel", async () => {
    fake.liveMode = true;
    env.MAX_DAILY_LIVE_AMOUNT_MINOR = 1_000; // 10 kr — alle bookinger er over
    const { session, intentId } = await authorizedSession();
    stripeState.authorize(intentId);
    await caller().checkout.paymentAuthorized({ publicId: session.publicId });
    await runJobsUntilIdle();
    const [att] = await rows<{ state: string; last_error_code: string }>("SELECT state, last_error_code FROM booking_attempts");
    expect(att.state).toBe("FAILED_VOIDED");
    expect(att.last_error_code).toBe("DAILY_CAP");
    expect(fake.createOrderCalls).toBe(0);
    expect(stripeState.cancelCalls).toBe(1);
    const kinds = (await rows<{ kind: string }>("SELECT kind FROM email_events")).map((r) => r.kind);
    expect(kinds).toContain("ops_alert");
    expect(kinds).toContain("booking_failed_refunded");
  });

  it("fangst feiler etter leverandørbekreftelse: booking i REVIEW, ingen auto-kansellering, ops varslet", async () => {
    const { session, intentId } = await authorizedSession();
    stripeState.authorize(intentId);
    stripeState.failCapture = true;
    await caller().checkout.paymentAuthorized({ publicId: session.publicId });
    await runJobsUntilIdle();
    const [b] = await rows<{ state: string }>("SELECT state FROM bookings");
    expect(b.state).toBe("REVIEW");
    const [att] = await rows<{ state: string; last_error_code: string }>("SELECT state, last_error_code FROM booking_attempts");
    expect(att.state).toBe("SUPPLIER_CONFIRMED");
    expect(att.last_error_code).toBe("CAPTURE_FAILED");
    expect(stripeState.cancelCalls).toBe(0);
    expect(fake.orders.size).toBe(1);
    expect(await countRows("payments", "status='authorized'")).toBe(1);
    expect(await countRows("ledger_entries")).toBe(0);
    const kinds = (await rows<{ kind: string }>("SELECT kind FROM email_events")).map((r) => r.kind);
    expect(kinds).toContain("ops_alert");
  });
});
