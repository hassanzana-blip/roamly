import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./stripe", () => ({
  stripe: () => {
    throw new Error("stripe not available in tests");
  },
  stripeConfigured: () => false,
  createPaymentIntent: vi.fn(),
  retrievePaymentIntent: vi.fn(),
  capturePaymentIntent: vi.fn(),
  cancelPaymentIntent: vi.fn(),
  createRefund: vi.fn(),
  constructWebhookEvent: vi.fn(),
}));

import { decideAfterRevalidation, shouldProcessAttempt, parseOfferSnapshot, quoteIdOf } from "./orchestrator";
import { bookingStateAfterRefund, computeCustomerRefundMinor } from "./refunds";
import {
  ATTEMPT_TRANSITIONS,
  REFUND_TRANSITIONS,
  TRANSITIONS,
  BOOKING_STATES,
  canAttemptTransition,
  canRefundTransition,
  canTransition,
  assertRefundTransition,
} from "./statemachine";
import { BOOKING_ATTEMPT_STATES, REFUND_STATES } from "../../db/schema";
import { mapDuffelError, orderPaymentAmount, selectBagServices, setDuffelClient, duffelConfig, duffelGetOffer, duffelCreateOrder, type BagService } from "./duffel";
import { DuffelFake } from "./duffelFake";
import { vatRateFor, vatPortion, buildReceiptLines } from "./invoices";
import { diffSegments, segmentsFromSlices, type SegmentSnapshot } from "./reconcile";
import { assertBalanced, captureEntries, refundCreatedEntries, refundPaidEntries } from "./ledger";
import { demoSearch } from "./demo";
import { appCodeOf } from "./errors";
import type { Offer } from "../../contracts/types";

// ─── (a) decideAfterRevalidation ────────────────────────────────────────────

describe("decideAfterRevalidation", () => {
  const now = Date.parse("2026-09-07T10:00:00Z");
  const session = { supplierAmountMinor: 100_000, servicesAmountMinor: 54_900, currency: "NOK" };
  const fresh = (over: Partial<{ expiresAt: string | null; supplierMinor: number; servicesMinor: number; currency: string }>) => ({
    expiresAt: "2026-09-07T10:30:00Z",
    supplierMinor: 100_000,
    servicesMinor: 54_900,
    currency: "NOK",
    ...over,
  });

  it("fortsetter når pris og utløp er uendret", () => {
    expect(decideAfterRevalidation(session, fresh({}), now)).toEqual({ action: "proceed" });
  });

  it("fortsetter når leverandørprisen har gått NED", () => {
    expect(decideAfterRevalidation(session, fresh({ supplierMinor: 90_000 }), now).action).toBe("proceed");
  });

  it("stopper med price_changed når leverandør + tjenester har gått opp", () => {
    const d = decideAfterRevalidation(session, fresh({ supplierMinor: 100_100 }), now);
    expect(d).toEqual({ action: "price_changed", previousMinor: 154_900, freshMinor: 155_000, currency: "NOK" });
  });

  it("stopper når kun tjenesteprisen har gått opp", () => {
    expect(decideAfterRevalidation(session, fresh({ servicesMinor: 60_000 }), now).action).toBe("price_changed");
  });

  it("stopper med expired når tilbudet er utløpt eller utløper innen sikkerhetsmarginen", () => {
    expect(decideAfterRevalidation(session, fresh({ expiresAt: "2026-09-07T09:59:00Z" }), now).action).toBe("expired");
    expect(decideAfterRevalidation(session, fresh({ expiresAt: "2026-09-07T10:00:10Z" }), now).action).toBe("expired");
    expect(decideAfterRevalidation(session, fresh({ expiresAt: null }), now).action).toBe("expired");
    expect(decideAfterRevalidation(session, fresh({ expiresAt: "ugyldig" }), now).action).toBe("expired");
  });

  it("valutaendring behandles som prisendring", () => {
    expect(decideAfterRevalidation(session, fresh({ currency: "EUR" }), now).action).toBe("price_changed");
  });

  it("shouldProcessAttempt: SUPPLIER_ORDERING kun når forlatt", () => {
    const t = new Date(now);
    expect(shouldProcessAttempt("PAYMENT_AUTHORIZED", t, now)).toBe(true);
    expect(shouldProcessAttempt("SUPPLIER_ORDERING", t, now)).toBe(false);
    expect(shouldProcessAttempt("SUPPLIER_ORDERING", new Date(now - 3 * 60_000), now)).toBe(true);
    expect(shouldProcessAttempt("CONFIRMED", t, now)).toBe(false);
    expect(shouldProcessAttempt("FAILED_VOIDED", t, now)).toBe(false);
  });

  it("parseOfferSnapshot støtter både nytt og gammelt format", () => {
    const offer = { id: "off_1", totalAmount: "1" } as Offer;
    expect(parseOfferSnapshot(JSON.stringify({ offer, rawServices: [] })).offer.id).toBe("off_1");
    expect(parseOfferSnapshot(JSON.stringify(offer)).offer.id).toBe("off_1");
    expect(quoteIdOf({ searchCtx: "quote:42" })).toBe(42);
    expect(quoteIdOf({ searchCtx: "from=OSL" })).toBeNull();
  });
});

// ─── (b) computeCustomerRefundMinor ─────────────────────────────────────────

describe("computeCustomerRefundMinor", () => {
  const base = { supplierRefundMinor: 80_000, servicesRefundMinor: 0, serviceFeeMinor: 33_000, capturedMinor: 133_000, alreadyRefundedMinor: 0 };

  it("policy keep: kun leverandørrefusjon", () => {
    expect(computeCustomerRefundMinor({ ...base, feePolicy: "keep" })).toEqual({ customerRefundMinor: 80_000, serviceFeeRefundMinor: 0, cappedBy: "none" });
  });

  it("policy refund: leverandør + hele gebyret", () => {
    expect(computeCustomerRefundMinor({ ...base, feePolicy: "refund" })).toEqual({ customerRefundMinor: 113_000, serviceFeeRefundMinor: 33_000, cappedBy: "none" });
  });

  it("aldri mer enn fanget minus allerede refundert", () => {
    const r = computeCustomerRefundMinor({ ...base, feePolicy: "refund", alreadyRefundedMinor: 100_000 });
    expect(r.customerRefundMinor).toBe(33_000);
    expect(r.cappedBy).toBe("captured");
  });

  it("overstyrt beløp respekteres innenfor taket", () => {
    expect(computeCustomerRefundMinor({ ...base, feePolicy: "keep", overrideMinor: 50_000 }).customerRefundMinor).toBe(50_000);
    expect(computeCustomerRefundMinor({ ...base, feePolicy: "keep", overrideMinor: 999_999 }).customerRefundMinor).toBe(133_000);
  });

  it("avviser flyttall/negative beløp", () => {
    expect(() => computeCustomerRefundMinor({ ...base, feePolicy: "keep", supplierRefundMinor: 10.5 })).toThrow();
    expect(() => computeCustomerRefundMinor({ ...base, feePolicy: "keep", capturedMinor: -1 })).toThrow();
  });

  it("bookingStateAfterRefund", () => {
    expect(bookingStateAfterRefund(133_000, 133_000)).toBe("REFUNDED");
    expect(bookingStateAfterRefund(133_000, 80_000)).toBe("PARTIALLY_REFUNDED");
  });
});

// ─── (c) Overgangstabeller ──────────────────────────────────────────────────

describe("tilstandsmaskiner", () => {
  it("alle attempt-tilstander fra skjemaet har en oppføring, og terminaler er tomme", () => {
    for (const s of BOOKING_ATTEMPT_STATES) expect(ATTEMPT_TRANSITIONS[s]).toBeDefined();
    expect(ATTEMPT_TRANSITIONS.CONFIRMED).toHaveLength(0);
    expect(ATTEMPT_TRANSITIONS.FAILED_VOIDED).toHaveLength(0);
    expect(canAttemptTransition("PAYMENT_AUTHORIZED", "SUPPLIER_ORDERING")).toBe(true);
    expect(canAttemptTransition("SUPPLIER_ORDERING", "SUPPLIER_UNKNOWN")).toBe(true);
    expect(canAttemptTransition("SUPPLIER_UNKNOWN", "SUPPLIER_CONFIRMED")).toBe(true);
    expect(canAttemptTransition("SUPPLIER_CONFIRMED", "CAPTURED")).toBe(true);
    expect(canAttemptTransition("CAPTURED", "CONFIRMED")).toBe(true);
    // Aldri tilbake til bestilling etter leverandørbekreftelse (dobbeltbooking)
    expect(canAttemptTransition("SUPPLIER_CONFIRMED", "SUPPLIER_ORDERING")).toBe(false);
    expect(canAttemptTransition("SUPPLIER_CONFIRMED", "FAILED_VOIDED")).toBe(false);
  });

  it("alle refusjonstilstander fra skjemaet har en oppføring", () => {
    for (const s of REFUND_STATES) expect(REFUND_TRANSITIONS[s]).toBeDefined();
    expect(REFUND_TRANSITIONS.closed).toHaveLength(0);
    expect(REFUND_TRANSITIONS.rejected).toHaveLength(0);
    expect(canRefundTransition("requested", "eligibility_checked")).toBe(true);
    expect(canRefundTransition("eligibility_checked", "supplier_requested")).toBe(true);
    expect(canRefundTransition("supplier_requested", "supplier_confirmed")).toBe(true);
    expect(canRefundTransition("supplier_confirmed", "amount_confirmed")).toBe(true);
    expect(canRefundTransition("amount_confirmed", "psp_refund_created")).toBe(true);
    expect(canRefundTransition("psp_refund_created", "psp_refund_succeeded")).toBe(true);
    expect(canRefundTransition("psp_refund_failed", "psp_refund_created")).toBe(true); // retry
    expect(canRefundTransition("psp_refund_succeeded", "customer_notified")).toBe(true);
    expect(canRefundTransition("customer_notified", "closed")).toBe(true);
    expect(canRefundTransition("supplier_rejected", "rejected")).toBe(true);
    // Ingen snarveier
    expect(canRefundTransition("requested", "psp_refund_created")).toBe(false);
    expect(canRefundTransition("psp_refund_succeeded", "psp_refund_created")).toBe(false);
    expect(() => assertRefundTransition("closed", "requested")).toThrow();
  });

  it("booking-tilstandsmaskinen har nye tilstander og trygge overganger", () => {
    for (const s of BOOKING_STATES) expect(TRANSITIONS[s]).toBeDefined();
    expect(canTransition("CONFIRMED", "TRAVELLED")).toBe(true);
    expect(canTransition("CONFIRMED", "REVIEW")).toBe(true);
    expect(canTransition("REVIEW", "CONFIRMED")).toBe(true);
    expect(canTransition("REVIEW", "CANCELLED")).toBe(true);
    expect(canTransition("BOOKING_PROCESSING", "REVIEW")).toBe(true);
    expect(canTransition("TRAVELLED", "CONFIRMED")).toBe(false);
    expect(TRANSITIONS.EXPIRED).toHaveLength(0);
    expect(TRANSITIONS.REFUNDED).toHaveLength(0);
  });
});

// ─── (d) Duffel: beløp og tjenestevalg ──────────────────────────────────────

describe("orderPaymentAmount / selectBagServices", () => {
  const raw: BagService[] = [
    { id: "ase_a1", passengerIds: ["pa"], segmentIds: ["seg1"], totalAmount: "300.00", currency: "NOK", maxQuantity: 3 },
    { id: "ase_a2", passengerIds: ["pa"], segmentIds: ["seg2"], totalAmount: "249.00", currency: "NOK", maxQuantity: 3 },
    { id: "ase_b1", passengerIds: ["pb"], segmentIds: ["seg1"], totalAmount: "300.00", currency: "NOK", maxQuantity: 1 },
  ];
  const pax = [
    { id: "pa", type: "adult" },
    { id: "pb", type: "adult" },
    { id: "pi", type: "infant_without_seat" },
  ];
  const offer = { totalAmount: "1234.50", totalCurrency: "NOK" };

  it("beløp = tilbud + Σ tjenester i minste enhet, formatert for Duffel", () => {
    const selected = selectBagServices(raw, pax, { extraBags: 1, bagsByPassenger: { pa: 1 } });
    expect(selected.map((s) => s.id).sort()).toEqual(["ase_a1", "ase_a2"]);
    const p = orderPaymentAmount(offer, selected);
    expect(p.amountMinor).toBe(123_450 + 30_000 + 24_900);
    expect(p.amount).toBe("1783.50");
    expect(p.currency).toBe("NOK");
  });

  it("uten tjenester = tilbudets total", () => {
    expect(orderPaymentAmount(offer, []).amount).toBe("1234.50");
    expect(selectBagServices(raw, pax, undefined)).toEqual([]);
    expect(selectBagServices(raw, pax, { extraBags: 0 })).toEqual([]);
  });

  it("fordeler rund-robin når fordeling mangler, respekterer maximum_quantity og hopper over baby", () => {
    const selected = selectBagServices(raw, pax, { extraBags: 3 });
    // pa: 2 kolli (a1+a2), pb: 1 kolli (b1)
    const qty = Object.fromEntries(selected.map((s) => [s.id, s.quantity]));
    expect(qty).toEqual({ ase_a1: 2, ase_a2: 2, ase_b1: 1 });
    const capped = selectBagServices(raw, pax, { extraBags: 4, bagsByPassenger: { pa: 1, pb: 3 } });
    expect(capped.find((s) => s.id === "ase_b1")?.quantity).toBe(1);
  });

  it("avviser valuta-mismatch mellom tilbud og tjeneste", () => {
    expect(() => orderPaymentAmount(offer, [{ amountMinor: 100, currency: "EUR" }])).toThrow();
  });
});

// ─── (e) vatRateFor ─────────────────────────────────────────────────────────

describe("vatRateFor / kvitteringslinjer", () => {
  it("12 % kun når hele reisen er innenlands i Norge", () => {
    expect(vatRateFor([{ originCountryCode: "NO", destinationCountryCode: "NO" }])).toBe(0.12);
    expect(vatRateFor([{ originCountryCode: "NO", destinationCountryCode: "NO" }, { originCountryCode: "NO", destinationCountryCode: "NO" }])).toBe(0.12);
    expect(vatRateFor([{ originCountryCode: "NO", destinationCountryCode: "ES" }])).toBe(0);
    expect(vatRateFor([{ originCountryCode: "NO", destinationCountryCode: "NO" }, { originCountryCode: "NO", destinationCountryCode: "DK" }])).toBe(0);
    expect(vatRateFor([{ originCountryCode: null, destinationCountryCode: "NO" }])).toBe(0);
    expect(vatRateFor([])).toBe(0);
  });

  it("MVA-andel av beløp inkl. MVA", () => {
    expect(vatPortion(112_00, 0.12)).toBe(12_00);
    expect(vatPortion(125_00, 0.25)).toBe(25_00);
    expect(vatPortion(100_00, 0)).toBe(0);
  });

  it("kvitteringslinjer summerer til totalen (inkl. bonus som negativ linje)", () => {
    const b = { currency: "NOK", supplierAmountMinor: 100_000, servicesAmountMinor: 54_900, serviceFeeAmountMinor: 33_000, bonusUsedMinor: 10_000, totalAmountMinor: 177_900 };
    const lines = buildReceiptLines(b, 0);
    expect(lines.reduce((s, l) => s + l.amountMinor, 0)).toBe(b.totalAmountMinor);
    expect(lines.find((l) => l.description.startsWith("Servicegebyr"))?.vatRate).toBe(0.25);
    expect(lines[0].vatMinor).toBe(0);
  });
});

// ─── (f) Duffel-feilmapping ─────────────────────────────────────────────────

describe("mapDuffelError", () => {
  it("404/410 på tilbud → OFFER_EXPIRED", () => {
    expect(mapDuffelError({ status: 404, path: "/air/offers/off_1" }).code).toBe("OFFER_EXPIRED");
    expect(mapDuffelError({ status: 410, path: "/air/offers/off_1?x=1" }).code).toBe("OFFER_EXPIRED");
  });
  it("offer_no_longer_available / offer_request_expired → OFFER_EXPIRED uansett sti", () => {
    expect(mapDuffelError({ status: 422, code: "offer_no_longer_available", path: "/air/orders" }).code).toBe("OFFER_EXPIRED");
    expect(mapDuffelError({ status: 400, code: "offer_request_expired", path: "/air/orders" }).code).toBe("OFFER_EXPIRED");
  });
  it("422 → SUPPLIER_REJECTED med data.code", () => {
    const e = mapDuffelError({ status: 422, code: "validation_required", path: "/air/orders" });
    expect(e.code).toBe("SUPPLIER_REJECTED");
    expect(e.data?.code).toBe("validation_required");
    expect(e.retryable).toBe(false);
  });
  it("429/5xx → SUPPLIER_UNAVAILABLE og retryable", () => {
    for (const status of [429, 500, 502, 503, 504]) {
      const e = mapDuffelError({ status, path: "/air/orders" });
      expect(e.code).toBe("SUPPLIER_UNAVAILABLE");
      expect(e.retryable).toBe(true);
    }
  });
  it("404 på ordre → NOT_FOUND, 401 → INTERNAL (konfig)", () => {
    expect(mapDuffelError({ status: 404, path: "/air/orders/ord_1" }).code).toBe("NOT_FOUND");
    expect(mapDuffelError({ status: 401, path: "/air/orders" }).code).toBe("INTERNAL");
  });
});

// ─── (g) Segment-diff ───────────────────────────────────────────────────────

describe("diffSegments", () => {
  const seg = (over: Partial<SegmentSnapshot>): SegmentSnapshot => ({
    sliceIndex: 0,
    segmentIndex: 0,
    id: "seg1",
    carrierIata: "SK",
    flightNumber: "4055",
    originIata: "OSL",
    destinationIata: "CPH",
    departingAt: "2026-10-12T08:00:00Z",
    arrivingAt: "2026-10-12T09:10:00Z",
    ...over,
  });

  it("ingen endring → tom diff (også når id mangler og tidsformat varierer)", () => {
    expect(diffSegments([seg({})], [seg({})])).toEqual([]);
    expect(diffSegments([seg({ id: undefined })], [seg({ id: "other", departingAt: "2026-10-12T10:00:00+02:00" })])).toEqual([]);
  });

  it("tidsendring på samme segment", () => {
    const d = diffSegments([seg({})], [seg({ departingAt: "2026-10-12T09:00:00Z" })]);
    expect(d).toHaveLength(1);
    expect(d[0].old?.departingAt).toBe("2026-10-12T08:00:00Z");
    expect(d[0].new?.departingAt).toBe("2026-10-12T09:00:00Z");
  });

  it("nytt flynummer, lagt til og fjernet segment", () => {
    const d1 = diffSegments([seg({})], [seg({ flightNumber: "4057" })]);
    expect(d1).toHaveLength(1);
    const d2 = diffSegments([seg({})], [seg({}), seg({ id: "seg2", segmentIndex: 1, originIata: "CPH", destinationIata: "ARN" })]);
    expect(d2).toEqual([{ key: "0:CPH-ARN", old: null, new: expect.objectContaining({ id: "seg2" }) }]);
    const d3 = diffSegments([seg({}), seg({ id: "seg2", segmentIndex: 1, originIata: "CPH", destinationIata: "ARN" })], [seg({})]);
    expect(d3).toEqual([{ key: "0:CPH-ARN", old: expect.objectContaining({ id: "seg2" }), new: null }]);
  });

  it("segmentsFromSlices nummererer på tvers av slices", () => {
    const r = demoSearch({ slices: [{ origin: "OSL", destination: "BCN", departureDate: "2026-10-12" }, { origin: "BCN", destination: "OSL", departureDate: "2026-10-19" }], passengers: [{ type: "adult" }], cabinClass: "economy" });
    const segs = segmentsFromSlices(r.offers[0].slices);
    expect(segs[0].sliceIndex).toBe(0);
    expect(segs[segs.length - 1].sliceIndex).toBe(1);
    expect(segs.map((s) => s.segmentIndex)).toEqual(segs.map((_, i) => i));
  });
});

// ─── Hovedbok ───────────────────────────────────────────────────────────────

describe("hovedbok balanserer", () => {
  it("fangst, refusjon opprettet og refusjon betalt", () => {
    const cap = captureEntries({ bookingId: 1, paymentId: 1, currency: "NOK", supplierMinor: 100_000, servicesMinor: 54_900, serviceFeeMinor: 33_000, bonusUsedMinor: 10_000, totalMinor: 177_900 });
    expect(() => assertBalanced(cap)).not.toThrow();
    const created = refundCreatedEntries({ bookingId: 1, paymentId: 1, refundCaseId: 1, currency: "NOK", supplierRefundMinor: 80_000, servicesRefundMinor: 0, serviceFeeRefundMinor: 0, customerRefundMinor: 80_000 });
    expect(() => assertBalanced(created)).not.toThrow();
    const goodwill = refundCreatedEntries({ bookingId: 1, paymentId: 1, refundCaseId: 2, currency: "NOK", supplierRefundMinor: 0, servicesRefundMinor: 0, serviceFeeRefundMinor: 0, customerRefundMinor: 20_000 });
    expect(goodwill.find((e) => e.account === "goodwill_expense")?.amountMinor).toBe(20_000);
    expect(() => assertBalanced(goodwill)).not.toThrow();
    expect(() => assertBalanced(refundPaidEntries({ bookingId: 1, paymentId: 1, refundCaseId: 1, currency: "NOK", customerRefundMinor: 80_000 }))).not.toThrow();
    expect(() => assertBalanced([{ account: "psp_clearing", direction: "debit", amountMinor: 1, currency: "NOK" }])).toThrow(/balanserer/);
  });
});

// ─── Fake Duffel via setDuffelClient ────────────────────────────────────────

describe("duffelFake gjennom duffel.ts", () => {
  const fake = new DuffelFake();
  beforeEach(() => {
    fake.reset();
    setDuffelClient(fake);
  });

  it("aktiverer 'configured' og gir samme svar ved samme Idempotency-Key", async () => {
    expect(duffelConfig.configured).toBe(true);
    const r = await fake.search({ slices: [{ origin: "OSL", destination: "CPH", departureDate: "2026-10-12" }], passengers: [{ type: "adult" }], cabinClass: "economy" });
    const offer = await duffelGetOffer(r.offers[0].id);
    const raw = fake.offers.get(offer.id)!.rawServices;
    const selected = selectBagServices(raw, offer.passengers, { extraBags: 1 });
    const amount = orderPaymentAmount(offer, selected);
    const input = {
      offer,
      rawServices: raw,
      passengers: [{ id: offer.passengers[0].id, type: "adult" as const, givenName: "Kari", familyName: "Nordmann", bornOn: "1990-01-01", title: "ms" as const, gender: "f" as const }],
      contactEmail: "kari@example.com",
      contactPhone: "+4791234567",
      services: { extraBags: 1 },
      idempotencyKey: "idem-1",
      attemptId: 7,
      amountMinor: amount.amountMinor,
      currency: "NOK",
    };
    const a = await duffelCreateOrder(input);
    const b = await duffelCreateOrder(input);
    expect(a.id).toBe(b.id);
    expect(fake.createOrderCalls).toBe(2);
    expect(a.bookingReference).toHaveLength(6);
    expect(a.metadata.attempt_id).toBe("7");
    expect(a.tickets).toHaveLength(1);
    expect(await fake.findOrderByAttempt(7)).not.toBeNull();
  });

  it("timeout: ordren finnes hos leverandøren og kan gjenopprettes via attempt_id", async () => {
    const r = await fake.search({ slices: [{ origin: "OSL", destination: "CPH", departureDate: "2026-10-12" }], passengers: [{ type: "adult" }], cabinClass: "economy" });
    const offer = r.offers[0];
    fake.mode = "timeout";
    const amount = orderPaymentAmount(offer, []);
    await expect(
      duffelCreateOrder({
        offer,
        rawServices: [],
        passengers: [{ id: offer.passengers[0].id, type: "adult", givenName: "Ola", familyName: "Nordmann", bornOn: "1990-01-01" }],
        contactEmail: "ola@example.com",
        contactPhone: "+4791234567",
        idempotencyKey: "idem-2",
        attemptId: 9,
        amountMinor: amount.amountMinor,
        currency: "NOK",
      }),
    ).rejects.toMatchObject({ code: "SUPPLIER_TIMEOUT" });
    const found = await fake.findOrderByAttempt(9);
    expect(found?.metadata.attempt_id).toBe("9");
  });

  it("price_up / expired / reject gir riktige AppError-koder", async () => {
    const r = await fake.search({ slices: [{ origin: "OSL", destination: "CPH", departureDate: "2026-10-12" }], passengers: [{ type: "adult" }], cabinClass: "economy" });
    const offer = r.offers[0];
    fake.mode = "price_up";
    const bumped = await duffelGetOffer(offer.id);
    expect(Number(bumped.totalAmount) > Number(offer.totalAmount)).toBe(true);
    fake.mode = "expired";
    await expect(duffelGetOffer(offer.id)).rejects.toMatchObject({ code: "OFFER_EXPIRED" });
    fake.mode = "reject";
    try {
      await duffelCreateOrder({ offer, rawServices: [], passengers: [], contactEmail: "x@example.com", contactPhone: "+4791234567", idempotencyKey: "idem-3", attemptId: 1, amountMinor: 1, currency: "NOK" });
      expect.unreachable();
    } catch (err) {
      expect(appCodeOf(err)).toBe("SUPPLIER_REJECTED");
    }
    setDuffelClient(null);
  });
});
