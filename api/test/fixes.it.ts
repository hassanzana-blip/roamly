import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/stripe", () => import("./stripeMock"));

import { capturePaymentIntent, stripeState } from "./stripeMock";
import {
  adultFor,
  appCode,
  assertLedgerBalanced,
  caller,
  closeDb,
  countRows,
  expectAppCode,
  fakeCustomer,
  fakeStaff,
  getDb,
  rows,
  runJobsUntilIdle,
  searchOffer,
  seedStaff,
  sessionInput,
  truncateAll,
  TOMORROW_PLUS,
  CONTACT,
} from "./setup";
import { setDuffelClient } from "../lib/duffel";
import { DuffelFake } from "../lib/duffelFake";
import { reconcileBookingById, scheduleChangeFingerprint, STUCK_ATTEMPT_MS, sweepBookings } from "../lib/reconcile";
import { processBookingAttempt } from "../lib/orchestrator";
import { runRetention } from "../lib/retention";
import { setSetting } from "../lib/pricing";
import { isCancellable } from "../orders";
import type { CreateSessionResult } from "../checkout";
import { customerAccounts } from "../../db/schema";
import type { Offer, Order } from "../../contracts/types";
import type { BookingRow } from "../lib/bookingAccess";

// ─── Regresjonstester for revisjonsfunn B1–B9, OTA-040, retention ──────────

const fake = new DuffelFake();
let dateSeq = 0;
const nextDate = () => TOMORROW_PLUS(30 + (dateSeq++ % 200));

async function fakeOffer(input: { origin?: string; destination?: string; pax?: Array<{ type: "adult" | "child" | "infant_without_seat"; age?: number }> } = {}): Promise<Offer> {
  const res = await caller().flights.search({
    slices: [{ origin: input.origin ?? "OSL", destination: input.destination ?? "CPH", departureDate: nextDate() }],
    passengers: input.pax ?? [{ type: "adult" }],
    cabinClass: "economy",
  });
  return res.offers[0];
}

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

async function insertAccount(over: { email: string; bonusKr?: number; referredById?: number | null }): Promise<number> {
  const res = await getDb().insert(customerAccounts).values({
    email: over.email,
    passwordHash: "x",
    firstName: "Test",
    lastName: "Konto",
    emailVerified: true,
    bonusKr: over.bonusKr ?? 0,
    referredById: over.referredById ?? null,
  });
  return Number(res[0].insertId);
}

async function bonusOf(id: number): Promise<number> {
  const [r] = await rows<{ bonus_kr: number }>(`SELECT bonus_kr FROM customer_accounts WHERE id=${id}`);
  return Number(r.bonus_kr);
}

/** Stripe+fake: sesjon med autorisert PaymentIntent, forsøk i kø (jobber IKKE kjørt). */
async function authorizedAttempt(over: Record<string, unknown> = {}) {
  const offer = await fakeOffer();
  const s = await caller().checkout.createSession(sessionInput(offer, over));
  const [sess] = await rows<{ psp_intent_id: string }>(`SELECT psp_intent_id FROM checkout_sessions WHERE public_id='${s.publicId}'`);
  stripeState.authorize(sess.psp_intent_id);
  const { attemptId } = await caller().checkout.paymentAuthorized({ publicId: s.publicId });
  return { offer, session: s, intentId: sess.psp_intent_id, attemptId };
}

describe("B1: henvisningsbonus krediteres på kundekontoen ved TRAVELLED (demo)", () => {
  beforeEach(async () => {
    await truncateAll();
    stripeState.reset();
    setDuffelClient(null);
  });
  afterAll(closeDb);

  it("begge kontoer +200 kr nøyaktig én gang selv om sweep kjøres to ganger", async () => {
    const referrerId = await insertAccount({ email: "verver@hellosky.test", bonusKr: 10 });
    const referredId = await insertAccount({ email: CONTACT.contactEmail, referredById: referrerId });
    const offer = await searchOffer();
    const c = caller({ customer: fakeCustomer({ customerId: referredId, email: CONTACT.contactEmail }) });
    const s = await c.checkout.createSession(sessionInput(offer));
    await c.checkout.confirmDemo({ publicId: s.publicId });
    await runJobsUntilIdle();
    const [b] = await rows<{ id: number; state: string; customer_account_id: number }>("SELECT id, state, customer_account_id FROM bookings");
    expect(b.state).toBe("CONFIRMED");
    expect(Number(b.customer_account_id)).toBe(referredId);

    const referredBefore = await bonusOf(referredId); // inkl. 1 % opptjening
    const referrerBefore = await bonusOf(referrerId);

    // Reisen er gjennomført for to dager siden
    const past = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString().slice(0, 19);
    await rows(`UPDATE booking_segments SET departing_at='${past}', arriving_at='${past}' WHERE booking_id=${b.id}`);

    await sweepBookings();
    const [after] = await rows<{ state: string; travel_completed_at: Date | null }>(`SELECT state, travel_completed_at FROM bookings WHERE id=${b.id}`);
    expect(after.state).toBe("TRAVELLED");
    expect(after.travel_completed_at).not.toBeNull();
    expect(await bonusOf(referredId)).toBe(referredBefore + 200);
    expect(await bonusOf(referrerId)).toBe(referrerBefore + 200);
    expect(await countRows("audit_logs", "action='bonus.referral_credited'")).toBe(1);

    await sweepBookings();
    expect(await bonusOf(referredId)).toBe(referredBefore + 200);
    expect(await bonusOf(referrerId)).toBe(referrerBefore + 200);
    expect(await countRows("audit_logs", "action='bonus.referral_credited'")).toBe(1);
  });
});

describe("B2: tilbud krever passasjerer (Stripe mock + Duffel-fake)", () => {
  beforeEach(async () => {
    await truncateAll();
    stripeState.reset();
    stripeState.configured = true;
    fake.reset();
    setDuffelClient(fake);
  });
  afterEach(() => setDuffelClient(null));
  afterAll(closeDb);

  async function sentQuote(offer: Offer) {
    const staff = await seedStaff({ role: "OWNER" });
    const admin = caller({ staff });
    const q = await admin.admin.createQuote({ offerId: offer.id, customerName: "Ola Nordmann", customerEmail: CONTACT.contactEmail, customerPhone: CONTACT.contactPhone });
    expect(q.passengersSubmitted).toBe(false);
    const sent = await admin.admin.sendQuote({ quoteId: q.id });
    const token = sent.checkoutPath.replace("/tilbud/", "");
    return { quoteId: q.id, token, admin };
  }

  it("uten passasjerer → INVALID_PASSENGER «Passasjeropplysninger mangler»; etter submitPassengers → betaling → CONFIRMED med passasjerene", async () => {
    const offer = await fakeOffer();
    const { quoteId, token } = await sentQuote(offer);

    const view = await caller().quotesPublic.getByToken({ token });
    expect(view.passengersSubmitted).toBe(false);
    expect(view.passengerSlots).toEqual([{ id: offer.passengers[0].id, type: "adult", age: undefined }]);
    expect(view.onlinePaymentAvailable).toBe(false);

    await expectAppCode(caller().quotesPublic.startPayment({ token }), "INVALID_PASSENGER");
    await expect(caller().quotesPublic.startPayment({ token })).rejects.toMatchObject({ message: "Passasjeropplysninger mangler" });
    expect(await countRows("checkout_sessions")).toBe(0);

    // Feil antall/ID → validering avviser
    await expectAppCode(caller().quotesPublic.submitPassengers({ token, passengers: [{ ...adultFor(offer), id: "pas_feil" }] }), "INVALID_PASSENGER");

    const sub = await caller().quotesPublic.submitPassengers({ token, passengers: [adultFor(offer)], contactPhone: "912 34 567" });
    expect(sub.passengersSubmitted).toBe(true);
    const after = await caller().quotesPublic.getByToken({ token });
    expect(after.passengersSubmitted).toBe(true);
    expect(after.onlinePaymentAvailable).toBe(true);
    expect(after.submittedPassengers[0]).toMatchObject({ givenName: "Ola", familyName: "Nordmann", hasIdentityDocument: false });
    const [q] = await rows<{ customer_phone: string }>(`SELECT customer_phone FROM quotes WHERE id=${quoteId}`);
    expect(q.customer_phone).toBe("+4791234567");

    const pay = await caller().quotesPublic.startPayment({ token });
    expect(pay.status).toBe("payment_pending");
    const [sess] = await rows<{ psp_intent_id: string; passengers_json: string }>(`SELECT psp_intent_id, passengers_json FROM checkout_sessions WHERE public_id='${pay.publicId}'`);
    expect((JSON.parse(sess.passengers_json) as Array<{ givenName: string }>).length).toBe(1);
    stripeState.authorize(sess.psp_intent_id);
    await caller().checkout.paymentAuthorized({ publicId: pay.publicId });
    await runJobsUntilIdle();

    const [b] = await rows<{ state: string; payload: string; source: string }>("SELECT state, payload, source FROM bookings");
    expect(b.state).toBe("CONFIRMED");
    expect(b.source).toBe("admin_quote");
    const order = JSON.parse(b.payload) as Order;
    expect(order.passengers.map((p) => `${p.givenName} ${p.familyName}`)).toEqual(["Ola Nordmann"]);
    const [quote] = await rows<{ status: string }>(`SELECT status FROM quotes WHERE id=${quoteId}`);
    expect(quote.status).toBe("booked");
    const st = await caller().quotesPublic.status({ token });
    expect(st.bookingReference).toBeTruthy();

    // Etter betaling kan passasjerene ikke endres
    await expectAppCode(caller().quotesPublic.submitPassengers({ token, passengers: [adultFor(offer)] }), "CONFLICT");
  });

  it("pass lagres kryptert i tilbudet og havner i passenger_documents for sesjonen", async () => {
    const offer = await fakeOffer({ destination: "JFK" });
    expect(offer.identityDocumentsRequired).toBe(true);
    const { token } = await sentQuote(offer);
    await expectAppCode(caller().quotesPublic.submitPassengers({ token, passengers: [adultFor(offer)] }), "IDENTITY_DOCUMENT_REQUIRED");

    const passport = "NO9876543";
    await caller().quotesPublic.submitPassengers({
      token,
      passengers: [adultFor(offer, 0, { identityDocument: { type: "passport", uniqueIdentifier: passport, issuingCountryCode: "NO", expiresOn: "2035-01-01" } })],
    });
    const [q] = await rows<{ passengers_json: string }>("SELECT passengers_json FROM quotes");
    expect(q.passengers_json).not.toContain(passport);
    expect(q.passengers_json).toContain('"encrypted":true');
    const view = await caller().quotesPublic.getByToken({ token });
    expect(view.submittedPassengers[0]).toMatchObject({ hasIdentityDocument: true, identityDocumentLast4: "6543" });
    expect(JSON.stringify(view)).not.toContain(passport);

    const pay = await caller().quotesPublic.startPayment({ token });
    const docs = await rows<{ identifier_last4: string; identifier_ciphertext: string; checkout_session_id: number }>("SELECT identifier_last4, identifier_ciphertext, checkout_session_id FROM passenger_documents");
    expect(docs.length).toBe(1);
    expect(docs[0].identifier_last4).toBe("6543");
    expect(docs[0].identifier_ciphertext).not.toContain(passport);
    const [sess] = await rows<{ psp_intent_id: string; passengers_json: string; id: number }>(`SELECT id, psp_intent_id, passengers_json FROM checkout_sessions WHERE public_id='${pay.publicId}'`);
    expect(sess.passengers_json).not.toContain(passport);
    expect(Number(docs[0].checkout_session_id)).toBe(sess.id);

    const spy = vi.spyOn(fake, "createOrder");
    stripeState.authorize(sess.psp_intent_id);
    await caller().checkout.paymentAuthorized({ publicId: pay.publicId });
    await runJobsUntilIdle();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].passengers[0].identityDocument?.uniqueIdentifier).toBe(passport);
    spy.mockRestore();
    const [b] = await rows<{ state: string; payload: string }>("SELECT state, payload FROM bookings");
    expect(b.state).toBe("CONFIRMED");
    expect(b.payload).not.toContain(passport);
  });

  it("admin.createQuote med passasjerer validerer mot tilbudet og markerer tilbudet som klart", async () => {
    const offer = await fakeOffer();
    const admin = caller({ staff: await seedStaff({ role: "OWNER" }) });
    await expectAppCode(
      admin.admin.createQuote({ offerId: offer.id, customerName: "Ola", customerEmail: CONTACT.contactEmail, passengers: [{ ...adultFor(offer), type: "child", bornOn: "1985-04-12" }] }),
      "INVALID_PASSENGER",
    );
    const q = await admin.admin.createQuote({ offerId: offer.id, customerName: "Ola", customerEmail: CONTACT.contactEmail, passengers: [adultFor(offer)] });
    expect(q.passengersSubmitted).toBe(true);
    const sent = await admin.admin.sendQuote({ quoteId: q.id });
    const view = await caller().quotesPublic.getByToken({ token: sent.checkoutPath.replace("/tilbud/", "") });
    expect(view.passengersSubmitted).toBe(true);
    expect(view.onlinePaymentAvailable).toBe(true);
  });

  it("bookFromQuote (manuell betaling) nekter uten passasjerer: tilbud failed + ops-varsel, ingen ordre", async () => {
    const offer = await fakeOffer();
    const { quoteId } = await sentQuote(offer);
    const owner = await seedStaff({ role: "OWNER" });
    await caller({ staff: owner }).admin.markQuotePaid({ quoteId, note: "Betalt via Vipps", confirmFreshSession: true });
    await runJobsUntilIdle();
    expect(fake.createOrderCalls).toBe(0);
    expect(await countRows("bookings")).toBe(0);
    const [q] = await rows<{ status: string }>(`SELECT status FROM quotes WHERE id=${quoteId}`);
    expect(q.status).toBe("failed");
    expect(await countRows("audit_logs", "action='quote.booking_failed_missing_passengers'")).toBe(1);
    expect(await countRows("email_events", "kind='ops_alert'")).toBeGreaterThanOrEqual(1);
  });
});

describe("B3: fastlåst SUPPLIER_ORDERING gjenopprettes via sweep", () => {
  beforeEach(async () => {
    await truncateAll();
    stripeState.reset();
    stripeState.configured = true;
    fake.reset();
    setDuffelClient(fake);
  });
  afterEach(() => setDuffelClient(null));
  afterAll(closeDb);

  it("forsøk i SUPPLIER_ORDERING med gammel updated_at → sweep → recover-jobb → ordre funnet → CONFIRMED", async () => {
    fake.mode = "timeout"; // ordren opprettes hos leverandøren, men svaret går tapt
    const { attemptId, intentId } = await authorizedAttempt();
    await runJobsUntilIdle({ advanceScheduled: false });
    expect(fake.orders.size).toBe(1);
    // Simuler prosesskrasj midt i bestillingen: tilbake til SUPPLIER_ORDERING, 10 min gammel, ingen recover-jobb
    await rows(`DELETE FROM jobs WHERE type='recover_attempt'`);
    await rows(`UPDATE booking_attempts SET state='SUPPLIER_ORDERING', updated_at = DATE_SUB(NOW(), INTERVAL 10 MINUTE) WHERE id=${attemptId}`);
    expect(await countRows("jobs", "type='recover_attempt' AND status='pending'")).toBe(0);

    // Forutsetningen for sveipen, sjekket her og ikke antatt: står forsøket
    // fortsatt i SUPPLIER_ORDERING, og er raden gammel nok? Uten denne så en
    // feil ut som «sveipen fant ingenting», mens den egentlige årsaken var at
    // raden var skrevet på nytt av noe annet.
    const [pre] = await rows<{ state: string; age_s: number }>(
      `SELECT state, TIMESTAMPDIFF(SECOND, updated_at, NOW()) AS age_s FROM booking_attempts WHERE id=${attemptId}`,
    );
    expect(pre.state).toBe("SUPPLIER_ORDERING");
    expect(Number(pre.age_s)).toBeGreaterThan(STUCK_ATTEMPT_MS / 1000);

    const minuteA = new Date().toISOString().slice(0, 16);
    await sweepBookings();
    expect(await countRows("jobs", "type='recover_attempt' AND status='pending'")).toBe(1);
    await sweepBookings(); // samme runde (minutt) → ingen duplikat
    const minuteB = new Date().toISOString().slice(0, 16);
    if (minuteA === minuteB) expect(await countRows("jobs", "type='recover_attempt' AND status='pending'")).toBe(1);

    const ran = await runJobsUntilIdle();
    // Gjenoppretting skal ha kjørt. Hvor mange gjenopprettingsjobber som
    // tilfeldigvis ble utført i akkurat dette kallet er derimot bokføring:
    // både sveipen og «stale»-stien legger inn en jobb, og rekkefølgen mellom
    // dem avgjør om den andre finner noe å gjøre. Det som betyr noe står
    // under – én ordre, én belastning, én bestilling, balansert hovedbok.
    expect(ran.filter((j) => j.type === "recover_attempt").length, JSON.stringify(ran)).toBeGreaterThanOrEqual(1);
    const [att] = await rows<{ state: string }>(`SELECT state FROM booking_attempts WHERE id=${attemptId}`);
    expect(att.state).toBe("CONFIRMED");
    expect(fake.createOrderCalls).toBe(1);
    expect(fake.orders.size).toBe(1);
    expect(stripeState.captureCalls).toBe(1);
    expect(stripeState.intents.get(intentId)!.status).toBe("succeeded");
    expect(await countRows("bookings", "state='CONFIRMED'")).toBe(1);
    await assertLedgerBalanced();
  });

  it("prosesskrasj i SUPPLIER_ORDERING oppdaget av process_booking_attempt legger recover_attempt i kø", async () => {
    fake.mode = "timeout";
    const { attemptId } = await authorizedAttempt();
    await runJobsUntilIdle({ advanceScheduled: false });
    await rows(`DELETE FROM jobs WHERE type='recover_attempt'`);
    await rows(`UPDATE booking_attempts SET state='SUPPLIER_ORDERING', updated_at = DATE_SUB(NOW(), INTERVAL 10 MINUTE) WHERE id=${attemptId}`);
    await processBookingAttempt(attemptId);
    const [att] = await rows<{ state: string }>(`SELECT state FROM booking_attempts WHERE id=${attemptId}`);
    expect(att.state).toBe("SUPPLIER_UNKNOWN");
    expect(await countRows("jobs", "type='recover_attempt' AND status='pending' AND dedupe_key LIKE '%:stale'")).toBe(1);
    await runJobsUntilIdle();
    expect((await rows<{ state: string }>(`SELECT state FROM booking_attempts WHERE id=${attemptId}`))[0].state).toBe("CONFIRMED");
  });
});

describe("B4: fangst-idempotens og manuell fangst", () => {
  beforeEach(async () => {
    await truncateAll();
    stripeState.reset();
    stripeState.configured = true;
    fake.reset();
    setDuffelClient(fake);
    capturePaymentIntent.mockClear();
  });
  afterEach(() => setDuffelClient(null));
  afterAll(closeDb);

  it("nytt fangstforsøk etter feil bruker NY idempotensnøkkel og fullfører booking REVIEW → CONFIRMED", async () => {
    stripeState.failCapture = true;
    const { attemptId, intentId } = await authorizedAttempt();
    await runJobsUntilIdle();
    expect((await rows<{ state: string }>("SELECT state FROM bookings"))[0].state).toBe("REVIEW");
    expect(capturePaymentIntent).toHaveBeenCalledTimes(1);
    const [att] = await rows<{ idempotency_key: string; state: string }>(`SELECT idempotency_key, state FROM booking_attempts WHERE id=${attemptId}`);
    expect(att.state).toBe("SUPPLIER_CONFIRMED");
    expect(capturePaymentIntent.mock.calls[0][1]).toBe(att.idempotency_key);

    stripeState.failCapture = false;
    await processBookingAttempt(attemptId);
    expect(capturePaymentIntent).toHaveBeenCalledTimes(2);
    expect(capturePaymentIntent.mock.calls[1][1]).toBe(`${att.idempotency_key}:c1`);
    expect(capturePaymentIntent.mock.calls[1][1]).not.toBe(capturePaymentIntent.mock.calls[0][1]);
    expect(stripeState.intents.get(intentId)!.status).toBe("succeeded");

    const [b] = await rows<{ state: string }>("SELECT state FROM bookings");
    expect(b.state).toBe("CONFIRMED");
    expect((await rows<{ state: string }>(`SELECT state FROM booking_attempts WHERE id=${attemptId}`))[0].state).toBe("CONFIRMED");
    expect(await countRows("payments", "status='captured'")).toBe(1);
    expect(await countRows("invoices", "kind='receipt'")).toBe(1);
    await assertLedgerBalanced();
    expect(await countRows("bookings")).toBe(1);
  });

  it("admin.markAttemptCaptured: fersk sesjon + refunds:process, samme finalisering, revisjonslogg, idempotent", async () => {
    stripeState.failCapture = true;
    const { attemptId, intentId, session } = await authorizedAttempt();
    await runJobsUntilIdle();
    expect((await rows<{ state: string }>("SELECT state FROM bookings"))[0].state).toBe("REVIEW");
    expect(await countRows("ledger_entries")).toBe(0);

    const owner = await seedStaff({ role: "OWNER" });
    const stale = caller({ staff: { ...owner, sessionCreatedAt: new Date(Date.now() - 20 * 60_000) } });
    await expect(stale.admin.markAttemptCaptured({ attemptId, confirmFreshSession: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller({ staff: fakeStaff({ role: "SUPPORT" }) }).admin.markAttemptCaptured({ attemptId, confirmFreshSession: true })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const res = await caller({ staff: owner }).admin.markAttemptCaptured({ attemptId, pspChargeId: "ch_manual_123", confirmFreshSession: true });
    expect(res.state).toBe("CONFIRMED");
    expect(res.bookingId).toBeTruthy();
    expect(stripeState.captureCalls).toBe(1); // ingen nytt Stripe-kall — fangsten er gjort i dashboardet
    const [b] = await rows<{ state: string }>("SELECT state FROM bookings");
    expect(b.state).toBe("CONFIRMED");
    const [p] = await rows<{ status: string; note: string; provider_ref: string }>("SELECT status, note, provider_ref FROM payments");
    expect(p.status).toBe("captured");
    expect(p.note).toContain("ch_manual_123");
    expect(await countRows("invoices", "kind='receipt'")).toBe(1);
    await assertLedgerBalanced();
    expect(await countRows("audit_logs", "action='attempt.marked_captured'")).toBe(1);
    const [att] = await rows<{ state: string; psp_charge_id: string }>(`SELECT state, psp_charge_id FROM booking_attempts WHERE id=${attemptId}`);
    expect(att).toEqual({ state: "CONFIRMED", psp_charge_id: "ch_manual_123" });

    // Idempotent
    const again = await caller({ staff: owner }).admin.markAttemptCaptured({ attemptId, confirmFreshSession: true });
    expect(again.state).toBe("CONFIRMED");
    expect(await countRows("invoices")).toBe(1);
    expect(await countRows("bookings")).toBe(1);

    // B7: kunden ser kvittering + kort PSP-referanse
    const st = await caller().checkout.status({ publicId: session.publicId });
    const order = await caller().orders.get({ orderId: st.orderId!, accessToken: st.accessToken! });
    expect(order.invoice?.invoiceNumber).toBe(1);
    expect(order.payment?.pspReference).toBe(intentId.slice(-8));
  });
});

describe("B5: parallelle createSession med samme idempotensnøkkel", () => {
  beforeEach(async () => {
    await truncateAll();
    stripeState.reset();
    setDuffelClient(null);
  });
  afterAll(closeDb);

  it("5 parallelle kall → én sesjon, bonus trukket nøyaktig én gang", async () => {
    const accountId = await insertAccount({ email: CONTACT.contactEmail, bonusKr: 300 });
    const offer = await searchOffer();
    const input = sessionInput(offer, { bonusUse: true });
    const customer = fakeCustomer({ customerId: accountId, email: CONTACT.contactEmail });
    const results: PromiseSettledResult<CreateSessionResult>[] = await Promise.allSettled(Array.from({ length: 5 }, () => caller({ customer }).checkout.createSession(input)));
    const ok = results.filter((r): r is PromiseFulfilledResult<CreateSessionResult> => r.status === "fulfilled");
    expect(ok.length).toBe(5);
    expect(new Set(ok.map((r) => r.value.publicId)).size).toBe(1);
    expect(await countRows("checkout_sessions")).toBe(1);
    const [s] = await rows<{ bonus_used_minor: number; total_amount_minor: number }>("SELECT bonus_used_minor, total_amount_minor FROM checkout_sessions");
    expect(Number(s.bonus_used_minor)).toBe(300 * 100);
    expect(await bonusOf(accountId)).toBe(0);
    for (const r of ok) expect(r.value.breakdown.bonusUsedMinor).toBe(300 * 100);
    expect(await countRows("consents", "type='terms'")).toBe(1);

    // Avbrutt sesjon gir bonusen tilbake én gang
    await caller().checkout.cancelSession({ publicId: ok[0].value.publicId });
    expect(await bonusOf(accountId)).toBe(300);
    await caller().checkout.cancelSession({ publicId: ok[0].value.publicId });
    expect(await bonusOf(accountId)).toBe(300);
  });
});

describe("B6/B7: avbestilling (compare-and-swap) og ordre-visning", () => {
  beforeEach(async () => {
    await truncateAll();
    stripeState.reset();
    setDuffelClient(null);
  });
  afterAll(closeDb);

  async function confirmedBooking() {
    const o = await refundableOffer();
    const s = await caller().checkout.createSession(sessionInput(o));
    await caller().checkout.confirmDemo({ publicId: s.publicId });
    await runJobsUntilIdle();
    const st = await caller().checkout.status({ publicId: s.publicId });
    return { orderId: st.orderId!, accessToken: st.accessToken!, breakdown: st.breakdown };
  }

  it("2 parallelle confirmCancellation → nøyaktig én refusjonssak og én CANCELLED-overgang", async () => {
    const { orderId, accessToken } = await confirmedBooking();
    const q = await caller().orders.cancellationQuote({ orderId, accessToken });
    const results = await Promise.allSettled([
      caller().orders.confirmCancellation({ orderId, accessToken, cancellationId: q.cancellationId }),
      caller().orders.confirmCancellation({ orderId, accessToken, cancellationId: q.cancellationId }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(["CONFLICT", "NOT_REFUNDABLE"]).toContain(appCode(failed.reason));
    expect(await countRows("refund_cases")).toBe(1);
    expect(await countRows("booking_events", "to_state='CANCELLED'")).toBe(1);
    expect(await countRows("booking_events", "to_state='CANCELLATION_REQUESTED'")).toBe(1);
    expect(await countRows("jobs", "type='process_refund'")).toBe(1);
  });

  it("kanselleringstilbud som ikke tilhører ordren avvises før noe endres", async () => {
    const { orderId, accessToken } = await confirmedBooking();
    await expectAppCode(caller().orders.confirmCancellation({ orderId, accessToken, cancellationId: "ore_demo_ord_demo_annen_x" }), "NOT_FOUND");
    expect((await rows<{ state: string }>("SELECT state FROM bookings"))[0].state).toBe("CONFIRMED");
    expect(await countRows("booking_events", "to_state='CANCELLATION_REQUESTED'")).toBe(0);
  });

  it("orders.get returnerer kvittering (siste receipt) og kort PSP-referanse", async () => {
    const { orderId, accessToken, breakdown } = await confirmedBooking();
    const o = await caller().orders.get({ orderId, accessToken });
    expect(o.invoice).not.toBeNull();
    expect(o.invoice!.invoiceNumber).toBe(1);
    expect(o.invoice!.currency).toBe("NOK");
    expect(o.invoice!.totalMinor).toBe(breakdown.totalAmountMinor);
    expect(o.invoice!.lines.length).toBeGreaterThanOrEqual(2);
    expect(o.invoice!.lines.reduce((s, l) => s + l.amountMinor, 0)).toBe(breakdown.totalAmountMinor);
    expect(typeof o.invoice!.issuedAt).toBe("string");
    expect(o.payment?.pspReference).toBeNull(); // demo-betaling har ingen PSP-referanse
  });
});

describe("B8: flights.status eksponerer gebyroppsettet (inkl. admin-overstyring)", () => {
  beforeEach(async () => {
    await truncateAll();
    setDuffelClient(null);
  });
  afterAll(closeDb);

  it("feeConfig speiler pricing.ts og settings-overstyringer", async () => {
    const base = await caller().flights.status();
    expect(base.feeConfig).toEqual({ percent: 0.08, flatMinorByCurrency: expect.objectContaining({ NOK: 25000, EUR: 2300 }) });
    await setSetting("markup.percent", 0.1, null);
    await setSetting("markup.flat_minor_by_currency", { NOK: 30000 }, null);
    const over = await caller().flights.status();
    expect(over.feeConfig.percent).toBe(0.1);
    expect(over.feeConfig.flatMinorByCurrency.NOK).toBe(30000);
    expect(over.feeConfig.flatMinorByCurrency.EUR).toBe(2300);
    // Samme tall som serveren faktisk priser med
    const offer = await searchOffer();
    const s = await caller().checkout.createSession(sessionInput(offer));
    const expectedFee = Math.round((s.breakdown.supplierAmountMinor * 0.1) / 100) * 100 + 30000;
    expect(s.breakdown.serviceFeeAmountMinor).toBe(expectedFee);
  });
});

describe("B9: tidssoner for segmenter", () => {
  afterAll(closeDb);

  function orderWithDeparture(departingAt: string, originIata: string, timeZone?: string): Order {
    const point = { iata: originIata, name: "", city: "", country: "", lat: 0, lng: 0, ...(timeZone ? { timeZone } : {}) };
    const dest = { iata: "CPH", name: "", city: "", country: "", lat: 0, lng: 0 };
    return {
      id: "ord_x",
      bookingReference: "ABC123",
      liveMode: false,
      demoMode: true,
      createdAt: new Date().toISOString(),
      totalAmount: "1000.00",
      totalCurrency: "NOK",
      cabinClass: "economy",
      slices: [
        {
          id: "sli_x",
          origin: point,
          destination: dest,
          departingAt,
          arrivingAt: departingAt,
          durationMinutes: 60,
          stops: 0,
          segments: [{ id: "seg_x", origin: point, destination: dest, departingAt, arrivingAt: departingAt, durationMinutes: 60, carrier: { iata: "SK", name: "SAS" }, flightNumber: "1", aircraft: "", cabinClass: "economy" }],
        },
      ],
      passengers: [],
      contactEmail: "",
      contactPhone: "",
      paymentStatus: "succeeded",
      conditions: { refundBeforeDeparture: { allowed: true } },
    };
  }
  const booking = { state: "CONFIRMED" } as BookingRow;

  it("isCancellable tolker naiv avgangstid i flyplassens sone (OSL), ikke server-/UTC-tid", () => {
    // Avgang 10:30 lokal Oslo-tid 1. juli = 08:30Z
    const order = orderWithDeparture("2026-07-01T10:30:00", "OSL");
    expect(isCancellable(booking, order, Date.parse("2026-07-01T08:00:00Z")).ok).toBe(true);
    // Mellom 08:30Z og 10:30Z: reisen HAR startet i Oslo — en UTC-tolkning ville feilaktig sagt «kan avbestilles»
    expect(isCancellable(booking, order, Date.parse("2026-07-01T09:00:00Z"))).toEqual({ ok: false, reason: "Reisen har allerede startet." });
  });

  it("eksplisitt sone fra leverandøren vinner over flyplassregisteret", () => {
    const order = orderWithDeparture("2026-07-01T10:30:00", "OSL", "America/New_York"); // 14:30Z
    expect(isCancellable(booking, order, Date.parse("2026-07-01T12:00:00Z")).ok).toBe(true);
    expect(isCancellable(booking, order, Date.parse("2026-07-01T15:00:00Z")).ok).toBe(false);
  });
});

describe("OTA-040: avstemming — én transaksjon, deterministisk dedupe for ruteendringer", () => {
  beforeEach(async () => {
    await truncateAll();
    stripeState.reset();
    stripeState.configured = true;
    fake.reset();
    setDuffelClient(fake);
  });
  afterEach(() => setDuffelClient(null));
  afterAll(closeDb);

  it("samme diff avstemt flere ganger → 1 schedule_changes-rad og 1 e-postjobb; identisk diff senere gjenbruker nøkkelen", async () => {
    await authorizedAttempt();
    await runJobsUntilIdle();
    const [b] = await rows<{ id: number; order_id: string; state: string }>("SELECT id, order_id, state FROM bookings");
    expect(b.state).toBe("CONFIRMED");
    fake.scheduleChange(b.order_id, 90);

    await reconcileBookingById(b.id, "test");
    await reconcileBookingById(b.id, "test");
    expect(await countRows("schedule_changes")).toBe(1);
    const jobs = await rows<{ dedupe_key: string; payload: string }>(`SELECT dedupe_key, payload FROM jobs WHERE type='send_email' AND dedupe_key LIKE 'schedule-change:${b.id}:%'`);
    expect(jobs.length).toBe(1);
    expect(jobs[0].dedupe_key).toMatch(new RegExp(`^schedule-change:${b.id}:[0-9a-f]{16}$`));
    expect(await countRows("jobs", `type='send_email' AND dedupe_key LIKE 'schedule-change-ops:${b.id}:%'`)).toBe(1);
    expect((await rows<{ state: string }>(`SELECT state FROM bookings WHERE id=${b.id}`))[0].state).toBe("CHANGE_REQUESTED");

    // Samme endring «oppdages» igjen (segmentene tilbakestilles og saken lukkes): ny rad, men SAMME e-postnøkkel → ingen ny jobb
    const [sc] = await rows<{ id: number; old_segments_json: string }>("SELECT id, old_segments_json FROM schedule_changes");
    const oldSegs = JSON.parse(sc.old_segments_json) as Array<{ sliceIndex: number; segmentIndex: number; originIata: string; destinationIata: string; carrierIata: string; flightNumber: string; departingAt: string; arrivingAt: string }>;
    await rows(`UPDATE schedule_changes SET status='resolved' WHERE id=${sc.id}`);
    await rows(`DELETE FROM booking_segments WHERE booking_id=${b.id}`);
    for (const s of oldSegs) {
      await rows(
        `INSERT INTO booking_segments (booking_id, slice_index, segment_index, origin_iata, destination_iata, carrier_iata, flight_number, departing_at, arriving_at) VALUES (${b.id}, ${s.sliceIndex}, ${s.segmentIndex}, '${s.originIata}', '${s.destinationIata}', '${s.carrierIata}', '${s.flightNumber}', '${s.departingAt}', '${s.arrivingAt}')`,
      );
    }
    await reconcileBookingById(b.id, "test");
    expect(await countRows("schedule_changes")).toBe(2);
    expect(await countRows("jobs", `type='send_email' AND dedupe_key LIKE 'schedule-change:${b.id}:%'`)).toBe(1);

    await runJobsUntilIdle();
    const kinds = (await rows<{ kind: string }>("SELECT kind FROM email_events")).map((r) => r.kind);
    expect(kinds.filter((k) => k === "schedule_change").length).toBe(1);
  });

  it("scheduleChangeFingerprint er deterministisk og uavhengig av rekkefølge", () => {
    const a = { sliceIndex: 0, segmentIndex: 0, id: "seg_1", carrierIata: "SK", flightNumber: "1", originIata: "OSL", destinationIata: "CPH", departingAt: "2026-07-01T10:00:00", arrivingAt: "2026-07-01T11:00:00" };
    const b = { ...a, departingAt: "2026-07-01T11:30:00", arrivingAt: "2026-07-01T12:30:00" };
    const c = { ...a, id: "seg_2", sliceIndex: 1, originIata: "CPH", destinationIata: "OSL" };
    const f1 = scheduleChangeFingerprint([{ key: "0:OSL-CPH", old: a, new: b }, { key: "1:CPH-OSL", old: c, new: null }]);
    const f2 = scheduleChangeFingerprint([{ key: "1:CPH-OSL", old: c, new: null }, { key: "0:OSL-CPH", old: a, new: b }]);
    expect(f1).toBe(f2);
    expect(f1).toMatch(/^[0-9a-f]{16}$/);
    expect(scheduleChangeFingerprint([{ key: "0:OSL-CPH", old: a, new: { ...b, departingAt: "2026-07-01T12:00:00" } }])).not.toBe(f1);
  });

  it("feil midt i avstemmingen ruller tilbake alle skriv (ingen halvveis tilstand)", async () => {
    await authorizedAttempt();
    await runJobsUntilIdle();
    const [b] = await rows<{ id: number; order_id: string }>("SELECT id, order_id FROM bookings");
    const eventsBefore = await countRows("booking_events");
    const segsBefore = await countRows("booking_segments", `booking_id=${b.id}`);
    // Ruteendring med ugyldig flyplasskode (varchar(3)) → INSERT i booking_segments feiler ETTER at
    // schedule_changes-raden er skrevet og de gamle segmentene er slettet i samme transaksjon.
    const o = fake.orders.get(b.order_id)!;
    const slices = o.slices.map((s, i) => (i === 0 ? { ...s, segments: s.segments.map((seg, j) => (j === 0 ? { ...seg, origin: { ...seg.origin, iata: "FORLANG" } } : seg)) } : s));
    fake.orders.set(b.order_id, { ...o, slices });
    await expect(reconcileBookingById(b.id, "test")).rejects.toThrow();
    const [after] = await rows<{ state: string; last_reconciled_at: Date | null }>(`SELECT state, last_reconciled_at FROM bookings WHERE id=${b.id}`);
    expect(after.state).toBe("CONFIRMED");
    expect(after.last_reconciled_at).toBeNull();
    expect(await countRows("booking_events")).toBe(eventsBefore);
    expect(await countRows("schedule_changes")).toBe(0);
    expect(await countRows("booking_segments", `booking_id=${b.id}`)).toBe(segsBefore);
    expect(await countRows("jobs", "type='send_email' AND dedupe_key LIKE 'schedule-change:%'")).toBe(0);
  });
});

describe("Retention (OTA-141/109)", () => {
  beforeEach(async () => {
    await truncateAll();
    setDuffelClient(null);
  });
  afterAll(closeDb);

  it("sletter utløpte tokens/koder/holds, arkiverer gamle webhook-payloads og anonymiserer inaktive kunder", async () => {
    const accountId = await insertAccount({ email: "ret@hellosky.test" });
    const old = "DATE_SUB(NOW(), INTERVAL 3 DAY)";
    const fresh = "DATE_ADD(NOW(), INTERVAL 1 DAY)";
    await rows(`INSERT INTO customer_otp_codes (customer_id, code_hash, expires_at) VALUES (${accountId}, 'a', ${old}), (${accountId}, 'b', ${fresh})`);
    await rows(`INSERT INTO customer_email_tokens (token_hash, customer_id, expires_at) VALUES ('t1', ${accountId}, ${old}), ('t2', ${accountId}, ${fresh})`);
    await rows(`INSERT INTO customer_password_resets (token_hash, customer_id, expires_at, used_at) VALUES ('r1', ${accountId}, ${fresh}, ${old}), ('r2', ${accountId}, ${fresh}, NULL)`);
    await rows(`INSERT INTO booking_holds (token_hash, offer_id, offer_snapshot, expires_at) VALUES ('h1', 'off', '{}', ${old}), ('h2', 'off', '{}', ${fresh})`);
    await rows(`INSERT INTO webhook_events (provider, event_id, event_type, payload, status, created_at) VALUES ('stripe', 'evt_old', 'x', '{"big":true}', 'processed', DATE_SUB(NOW(), INTERVAL 100 DAY)), ('stripe', 'evt_new', 'x', '{"big":true}', 'processed', NOW())`);
    await rows(`INSERT INTO customers (email, name, phone, created_at) VALUES ('gammel@hellosky.test', 'Gammel Kunde', '+4790000000', DATE_SUB(NOW(), INTERVAL 6 YEAR)), ('ny@hellosky.test', 'Ny Kunde', '+4791111111', NOW()), ('aktiv@hellosky.test', 'Aktiv Kunde', '+4792222222', DATE_SUB(NOW(), INTERVAL 6 YEAR))`);
    const [aktiv] = await rows<{ id: number }>("SELECT id FROM customers WHERE email='aktiv@hellosky.test'");
    await rows(
      `INSERT INTO bookings (order_id, booking_reference, contact_email, payload, state, customer_id, supplier, created_at) VALUES ('ord_demo_ret', 'RET123', 'aktiv@hellosky.test', '{}', 'TRAVELLED', ${aktiv.id}, 'demo', DATE_SUB(NOW(), INTERVAL 1 YEAR))`,
    );

    const report = await runRetention();
    expect(report).toMatchObject({ otpCodes: 1, emailTokens: 1, passwordResets: 1, bookingHolds: 1, webhookEventsArchived: 1, customersAnonymised: 1 });
    expect(await countRows("customer_otp_codes")).toBe(1);
    expect(await countRows("customer_email_tokens")).toBe(1);
    expect(await countRows("customer_password_resets")).toBe(1);
    expect(await countRows("booking_holds")).toBe(1);
    const wh = await rows<{ event_id: string; payload: string; status: string }>("SELECT event_id, payload, status FROM webhook_events ORDER BY event_id");
    expect(wh).toEqual([
      { event_id: "evt_new", payload: '{"big":true}', status: "processed" },
      { event_id: "evt_old", payload: "", status: "archived" },
    ]);
    const cs = await rows<{ email: string; name: string | null; phone: string | null }>("SELECT email, name, phone FROM customers ORDER BY id");
    expect(cs[0].email).toMatch(/^anon-\d+@anonymised\.invalid$/);
    expect(cs[0].name).toBeNull();
    expect(cs[0].phone).toBeNull();
    expect(cs[1]).toEqual({ email: "ny@hellosky.test", name: "Ny Kunde", phone: "+4791111111" });
    expect(cs[2]).toEqual({ email: "aktiv@hellosky.test", name: "Aktiv Kunde", phone: "+4792222222" });
    expect(await countRows("audit_logs", "action='customers.anonymised'")).toBe(1);

    // Idempotent
    const again = await runRetention();
    expect(again.customersAnonymised).toBe(0);
    expect(again.webhookEventsArchived).toBe(0);
    expect(await countRows("audit_logs", "action='customers.anonymised'")).toBe(1);
  });

  it("sweep kjører retention (utløpt OTP forsvinner)", async () => {
    const accountId = await insertAccount({ email: "sweep@hellosky.test" });
    await rows(`INSERT INTO customer_otp_codes (customer_id, code_hash, expires_at) VALUES (${accountId}, 'a', DATE_SUB(NOW(), INTERVAL 3 DAY))`);
    await sweepBookings();
    expect(await countRows("customer_otp_codes")).toBe(0);
  });
});
