import type { Offer, SearchResult } from "../../contracts/types";
import type { BagService, CancellationQuote, CreateOrderInput, DuffelClient, SearchInput, SupplierOrder } from "./duffel";
import { DuffelError, orderPaymentAmount, selectBagServices } from "./duffel";
import { demoSearch } from "./demo";
import { fromMinor, toMinor } from "./money";

// ─── In-process fake Duffel ─────────────────────────────────────────────────
// Brukes av tester og lokale integrasjonskjøringer via setDuffelClient(fake).
// Oppfører seg som ekte Duffel i datamodell, men lar testen styre utfallet:
//   ok        → ordre opprettes med PNR og billetter
//   timeout   → createOrder kaster SUPPLIER_TIMEOUT, men ordren FINNES (gjenoppretting må finne den)
//   timeout_lost → createOrder kaster SUPPLIER_TIMEOUT og ordren finnes IKKE (gjenoppretting gir opp)
//   price_up  → getOffer returnerer 10 % høyere pris enn ved søk
//   expired   → getOffer kaster OFFER_EXPIRED
//   no_pnr    → ordre uten booking_reference (BOOKING_PROCESSING → reconcile)
//   reject    → createOrder kaster SUPPLIER_REJECTED (422)
//   unavailable → createOrder kaster SUPPLIER_UNAVAILABLE (503)

export type FakeMode = "ok" | "timeout" | "timeout_lost" | "price_up" | "expired" | "no_pnr" | "reject" | "unavailable";

let seq = 0;
const nextId = (prefix: string) => `${prefix}_fake${(++seq).toString(36).padStart(4, "0")}`;

export class DuffelFake implements DuffelClient {
  mode: FakeMode = "ok";
  /** Late som live-modus (aktiverer daglig tak m.m. i orkestratoren). */
  liveMode = false;
  /** Alle ordrer opprettet i denne faken (også de som "timet ut"). */
  readonly orders = new Map<string, SupplierOrder>();
  readonly ordersByIdempotency = new Map<string, string>();
  readonly cancellations = new Map<string, CancellationQuote>();
  readonly offers = new Map<string, { offer: Offer; rawServices: BagService[] }>();
  /** Antall createOrder-kall (for å verifisere idempotens). */
  createOrderCalls = 0;
  /** Prosentandel refundert ved kansellering (0–1). */
  cancellationRefundFraction = 0.8;

  reset(): void {
    this.mode = "ok";
    this.liveMode = false;
    this.orders.clear();
    this.ordersByIdempotency.clear();
    this.cancellations.clear();
    this.offers.clear();
    this.createOrderCalls = 0;
  }

  /** Registrer et tilbud direkte (uten søk). */
  seedOffer(offer: Offer, rawServices?: BagService[]): void {
    const raw =
      rawServices ??
      offer.passengers
        .filter((p) => p.type !== "infant_without_seat")
        .map((p) => ({
          id: nextId("ase"),
          passengerIds: [p.id],
          segmentIds: offer.slices.flatMap((s) => s.segments.map((x) => x.id)),
          totalAmount: offer.services?.extraBagPrice ?? "0",
          currency: offer.totalCurrency,
          maxQuantity: offer.services?.maxExtraBags ?? 0,
        }));
    this.offers.set(offer.id, { offer, rawServices: raw });
  }

  async search(input: SearchInput): Promise<SearchResult> {
    const r = demoSearch(input);
    for (const o of r.offers) this.seedOffer(o);
    return { ...r, demoMode: false, liveMode: false };
  }

  async getOffer(offerId: string): Promise<Offer> {
    return (await this.getOfferRaw(offerId)).offer;
  }

  async getOfferRaw(offerId: string): Promise<{ offer: Offer; rawServices: BagService[] }> {
    const hit = this.offers.get(offerId);
    if (!hit || this.mode === "expired") {
      throw new DuffelError("OFFER_EXPIRED", { status: 404, duffelCode: "offer_no_longer_available" });
    }
    if (this.mode === "price_up") {
      const minor = toMinor(hit.offer.totalAmount, hit.offer.totalCurrency);
      const bumped = Math.round(minor * 1.1);
      return { offer: { ...hit.offer, totalAmount: fromMinor(bumped, hit.offer.totalCurrency) }, rawServices: hit.rawServices };
    }
    return hit;
  }

  async createOrder(input: CreateOrderInput): Promise<SupplierOrder> {
    this.createOrderCalls += 1;
    const existingId = this.ordersByIdempotency.get(input.idempotencyKey);
    if (existingId) return this.orders.get(existingId)!;

    if (this.mode === "reject") throw new DuffelError("SUPPLIER_REJECTED", { status: 422, duffelCode: "validation_required" });
    if (this.mode === "unavailable") throw new DuffelError("SUPPLIER_UNAVAILABLE", { status: 503, retryable: true });
    if (this.mode === "timeout_lost") throw new DuffelError("SUPPLIER_TIMEOUT", { status: 0 });

    const selected = selectBagServices(input.rawServices, input.offer.passengers, input.services);
    const payment = orderPaymentAmount(input.offer, selected);
    if (payment.amountMinor !== input.amountMinor) {
      throw new DuffelError("SUPPLIER_REJECTED", { status: 422, duffelCode: "payment_amount_mismatch" });
    }
    const id = nextId("ord");
    const ref = this.mode === "no_pnr" ? "" : `F${(seq * 7919).toString(36).toUpperCase().slice(-5).padStart(5, "X")}`;
    const order: SupplierOrder = {
      id,
      liveMode: false,
      bookingReference: ref,
      createdAt: new Date().toISOString(),
      totalAmount: payment.amount,
      totalCurrency: payment.currency,
      slices: input.offer.slices,
      passengers: input.passengers.map((p) => ({ id: p.id, givenName: p.givenName, familyName: p.familyName, type: p.type })),
      tickets: ref
        ? input.passengers.map((p, i) => ({
            passengerId: p.id,
            passengerName: `${p.givenName} ${p.familyName}`,
            type: "electronic_ticket",
            uniqueIdentifier: `117-${(1000000000 + seq * 13 + i).toString()}`,
          }))
        : [],
      paymentStatus: { awaitingPayment: false, paidAt: new Date().toISOString(), paymentRequiredBy: null },
      cancelledAt: null,
      availableActions: ["cancel"],
      metadata: { source: "hellosky", attempt_id: String(input.attemptId) },
      conditions: input.offer.conditions,
    };
    this.orders.set(id, order);
    this.ordersByIdempotency.set(input.idempotencyKey, id);
    if (this.mode === "timeout") {
      this.mode = "ok"; // neste kall (gjenoppretting) lykkes
      throw new DuffelError("SUPPLIER_TIMEOUT", { status: 0 });
    }
    return order;
  }

  async getOrder(orderId: string): Promise<SupplierOrder> {
    const o = this.orders.get(orderId);
    if (!o) throw new DuffelError("NOT_FOUND", { status: 404 });
    return o;
  }

  async findOrderByAttempt(attemptId: number | string): Promise<SupplierOrder | null> {
    for (const o of this.orders.values()) if (o.metadata.attempt_id === String(attemptId)) return o;
    return null;
  }

  async createOrderCancellation(orderId: string): Promise<CancellationQuote> {
    const o = await this.getOrder(orderId);
    if (!o.availableActions.includes("cancel") || o.cancelledAt) {
      throw new DuffelError("SUPPLIER_REJECTED", { status: 422, duffelCode: "order_not_cancellable" });
    }
    const minor = Math.round(toMinor(o.totalAmount, o.totalCurrency) * this.cancellationRefundFraction);
    const q: CancellationQuote = {
      id: nextId("ore"),
      orderId,
      refundAmount: fromMinor(minor, o.totalCurrency),
      refundCurrency: o.totalCurrency,
      refundTo: "balance",
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      confirmedAt: null,
    };
    this.cancellations.set(q.id, q);
    return q;
  }

  async confirmOrderCancellation(cancellationId: string): Promise<CancellationQuote> {
    const q = this.cancellations.get(cancellationId);
    if (!q) throw new DuffelError("NOT_FOUND", { status: 404 });
    if (q.expiresAt && new Date(q.expiresAt) < new Date()) throw new DuffelError("SUPPLIER_REJECTED", { status: 422, duffelCode: "order_cancellation_expired" });
    const confirmed = { ...q, confirmedAt: new Date().toISOString() };
    this.cancellations.set(cancellationId, confirmed);
    const o = this.orders.get(q.orderId);
    if (o) this.orders.set(q.orderId, { ...o, cancelledAt: confirmed.confirmedAt, availableActions: [] });
    return confirmed;
  }

  async listOrderCancellations(orderId: string): Promise<CancellationQuote[]> {
    return [...this.cancellations.values()].filter((c) => c.orderId === orderId);
  }

  /** Testhjelper: simuler at flyselskapet kansellerer ordren. */
  airlineCancel(orderId: string): void {
    const o = this.orders.get(orderId);
    if (o) this.orders.set(orderId, { ...o, cancelledAt: new Date().toISOString(), availableActions: [] });
  }

  /** Testhjelper: simuler ruteendring (flytt første segment én time). */
  scheduleChange(orderId: string, deltaMinutes = 60): void {
    const o = this.orders.get(orderId);
    if (!o) return;
    const shift = (iso: string) => new Date(new Date(iso).getTime() + deltaMinutes * 60_000).toISOString();
    const slices = o.slices.map((s, si) =>
      si === 0
        ? {
            ...s,
            departingAt: shift(s.departingAt),
            segments: s.segments.map((seg, i) => (i === 0 ? { ...seg, departingAt: shift(seg.departingAt), arrivingAt: shift(seg.arrivingAt) } : seg)),
          }
        : s,
    );
    this.orders.set(orderId, { ...o, slices });
  }
}
