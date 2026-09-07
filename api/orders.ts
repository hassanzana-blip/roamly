import { z } from "zod";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { bookingEvents, bookings, invoices, payments, refundCases, refundEvents, scheduleChanges, tickets as ticketsTable } from "../db/schema";
import { env } from "./lib/env";
import { AppError, toTRPCError } from "./lib/errors";
import { assertRateLimit, clientIp } from "./lib/ratelimit";
import { fromMinor, toMinor } from "./lib/money";
import { enqueueJob } from "./lib/jobs";
import { logAudit } from "./lib/audit";
import { resolveBookingAccess, type BookingRow } from "./lib/bookingAccess";
import { duffelConfig, duffelConfirmOrderCancellation, duffelCreateOrderCancellation, duffelListOrderCancellations } from "./lib/duffel";
import { segmentInstant, zoneFor } from "./lib/time";
import { log } from "./lib/logger";
import type { InvoiceLine } from "./lib/invoices";
import { demoCancellationQuote } from "./lib/demo";
import { assertTransition, canTransition, REFUND_STATE_LABELS, type BookingState, type RefundState } from "./lib/statemachine";
import { computeCustomerRefundMinor, feePolicyText, openCustomerCancellationCase, OPEN_REFUND_STATES, serviceFeePolicy } from "./lib/refunds";
import type { Order, Ticket } from "../contracts/types";

// ─── Ordrer etter booking (OTA-051–060): kundens side ──────────────────────
// Tilgang via bookingAccess (token fra bekreftelseslenke / innlogget kunde).

const accessInput = z.object({ orderId: z.string().min(1).max(64), accessToken: z.string().min(16).max(256).optional() });

type CustomerCtx = { customerId: number; email: string | null; emailVerified?: boolean } | null;

function parseOrder(b: BookingRow): Order {
  const o = JSON.parse(b.payload) as Order;
  return { ...o, bookingReference: b.bookingReference || o.bookingReference, cancelledAt: b.cancelledAt?.toISOString() ?? o.cancelledAt ?? null };
}

/** Første avgang (epoch ms) tolket i avgangsflyplassens tidssone (B9). */
export function firstDepartureMs(order: Pick<Order, "slices">): number | null {
  const first = order.slices[0]?.segments?.[0] ?? order.slices[0];
  if (!first) return null;
  const origin = "origin" in first ? first.origin : undefined;
  return segmentInstant(first.departingAt, zoneFor(origin?.iata, origin?.timeZone));
}

/** Refunderbart: vilkår tillater det, og reisen har ikke startet. */
export function isCancellable(booking: BookingRow, order: Order, nowMs = Date.now()): { ok: boolean; reason?: string } {
  if (booking.state !== "CONFIRMED" && booking.state !== "CHANGE_REQUESTED") return { ok: false, reason: "Bestillingen kan ikke avbestilles i nåværende status." };
  const allowed = order.conditions?.refundBeforeDeparture?.allowed ?? order.paymentStatus === "succeeded";
  if (!allowed && order.conditions?.refundBeforeDeparture) return { ok: false, reason: "Billettvilkårene tillater ikke refusjon." };
  const dep = firstDepartureMs(order);
  if (dep !== null && dep <= nowMs) return { ok: false, reason: "Reisen har allerede startet." };
  return { ok: true };
}

/** Sist 8 tegn av PSP-referansen (nok til oppslag i Stripe-dashboardet, aldri hele ID-en til klienten). */
export function pspReferenceOf(providerRef: string | null | undefined): string | null {
  if (!providerRef) return null;
  return providerRef.slice(-8);
}

async function access(input: { orderId: string; accessToken?: string }, customer: CustomerCtx): Promise<BookingRow> {
  return resolveBookingAccess({ orderId: input.orderId, accessToken: input.accessToken ?? null, customer });
}

export const ordersRouter = createRouter({
  get: publicQuery.input(accessInput).query(async ({ input, ctx }) => {
    try {
      assertRateLimit("orders-get", clientIp(ctx.req), 60, 60_000);
      const db = getDb();
      const booking = await access(input, ctx.customer as CustomerCtx);
      const order = parseOrder(booking);
      const [ticketRows, cases, changes, paymentRows, receiptRows] = await Promise.all([
        db.select().from(ticketsTable).where(eq(ticketsTable.bookingId, booking.id)),
        db.select().from(refundCases).where(eq(refundCases.bookingId, booking.id)).orderBy(desc(refundCases.createdAt)),
        db.select().from(scheduleChanges).where(eq(scheduleChanges.bookingId, booking.id)).orderBy(desc(scheduleChanges.createdAt)),
        db.select().from(payments).where(eq(payments.bookingId, booking.id)).orderBy(desc(payments.createdAt)),
        db.select().from(invoices).where(and(eq(invoices.bookingId, booking.id), eq(invoices.kind, "receipt"))).orderBy(desc(invoices.issuedAt), desc(invoices.id)).limit(1),
      ]);
      const receipt = receiptRows[0];
      let receiptLines: InvoiceLine[] = [];
      if (receipt) {
        try {
          receiptLines = JSON.parse(receipt.linesJson) as InvoiceLine[];
        } catch {
          receiptLines = [];
        }
      }
      const tickets: Ticket[] = ticketRows.map((t) => ({ passengerId: t.passengerId, passengerName: t.passengerName, type: t.type, uniqueIdentifier: t.uniqueIdentifier }));
      const cancellable = isCancellable(booking, order);
      const openRefund = cases.find((c) => OPEN_REFUND_STATES.includes(c.state as RefundState));
      return {
        order: { ...order, tickets },
        state: booking.state,
        liveMode: booking.liveMode,
        createdAt: booking.createdAt.toISOString(),
        cancelledAt: booking.cancelledAt?.toISOString() ?? null,
        payment: paymentRows[0]
          ? {
              provider: paymentRows[0].provider,
              status: paymentRows[0].status,
              amountMinor: paymentRows[0].amountMinor,
              refundedMinor: paymentRows[0].refundedMinor,
              currency: paymentRows[0].currency,
              pspReference: pspReferenceOf(paymentRows[0].providerRef),
            }
          : null,
        invoice: receipt
          ? { invoiceNumber: receipt.invoiceNumber, issuedAt: receipt.issuedAt.toISOString(), currency: receipt.currency, totalMinor: receipt.totalMinor, vatMinor: receipt.vatMinor, lines: receiptLines }
          : null,
        refundCases: cases.map((c) => ({
          id: c.id,
          reference: c.reference,
          kind: c.kind,
          state: c.state,
          stateLabel: REFUND_STATE_LABELS[c.state as RefundState] ?? c.state,
          currency: c.currency,
          customerRefundAmountMinor: c.customerRefundAmountMinor,
          createdAt: c.createdAt.toISOString(),
          closedAt: c.closedAt?.toISOString() ?? null,
        })),
        scheduleChanges: changes.map((s) => ({
          id: s.id,
          status: s.status,
          oldSegments: JSON.parse(s.oldSegmentsJson) as unknown,
          newSegments: JSON.parse(s.newSegmentsJson) as unknown,
          createdAt: s.createdAt.toISOString(),
        })),
        actions: {
          canCancel: cancellable.ok && !openRefund,
          cancelReason: cancellable.ok ? null : cancellable.reason ?? null,
          canResendConfirmation: ["CONFIRMED", "CHANGE_REQUESTED", "BOOKING_PROCESSING"].includes(booking.state),
          hasOpenRefund: Boolean(openRefund),
        },
      };
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  cancellationQuote: publicQuery.input(accessInput).mutation(async ({ input, ctx }) => {
    try {
      assertRateLimit("orders-cancel-quote", clientIp(ctx.req), 10, 60_000);
      const db = getDb();
      const booking = await access(input, ctx.customer as CustomerCtx);
      const order = parseOrder(booking);
      const c = isCancellable(booking, order);
      if (!c.ok) throw new AppError("NOT_REFUNDABLE", { message: c.reason });
      const openCases = await db.select().from(refundCases).where(eq(refundCases.bookingId, booking.id));
      if (openCases.some((rc) => OPEN_REFUND_STATES.includes(rc.state as RefundState))) {
        throw new AppError("CONFLICT", { message: "Det finnes allerede en åpen refusjonssak for denne bestillingen." });
      }

      const [payment] = await db.select().from(payments).where(eq(payments.bookingId, booking.id)).orderBy(desc(payments.createdAt)).limit(1);
      const currency = payment?.currency ?? order.totalCurrency;
      const supplierMinor = order.supplierAmount ? toMinor(order.supplierAmount, currency) : 0;

      let cancellationId: string;
      let supplierRefundMinor: number;
      let expiresAt: string | null;
      const live = duffelConfig.configured && booking.supplier === "duffel" && !booking.orderId.startsWith("ord_demo_");
      if (live) {
        const q = await duffelCreateOrderCancellation(booking.orderId);
        cancellationId = q.id;
        supplierRefundMinor = toMinor(q.refundAmount, q.refundCurrency);
        expiresAt = q.expiresAt;
        if (q.refundCurrency.toUpperCase() !== currency) {
          throw new AppError("INTERNAL", { message: "Leverandøren refunderer i en annen valuta. Kontakt oss." });
        }
      } else {
        if (env.isProdEnv) throw new AppError("NOT_REFUNDABLE", { message: "Denne bestillingen kan bare avbestilles via kundeservice." });
        const q = demoCancellationQuote(booking.orderId, supplierMinor, currency);
        cancellationId = q.id;
        supplierRefundMinor = q.refundMinor;
        expiresAt = q.expiresAt;
      }

      const policy = await serviceFeePolicy();
      const serviceFeeMinor = order.serviceFeeAmount ? toMinor(order.serviceFeeAmount, currency) : 0;
      const capturedMinor = payment?.amountMinor ?? toMinor(order.totalAmount, currency);
      const amount = computeCustomerRefundMinor({
        supplierRefundMinor,
        servicesRefundMinor: 0,
        serviceFeeMinor,
        feePolicy: policy,
        capturedMinor,
        alreadyRefundedMinor: payment?.refundedMinor ?? 0,
      });
      return {
        cancellationId,
        supplierRefundMinor,
        currency,
        serviceFeeRefundMinor: amount.serviceFeeRefundMinor,
        servicesRefundMinor: 0,
        totalToCustomerMinor: amount.customerRefundMinor,
        totalToCustomer: fromMinor(amount.customerRefundMinor, currency),
        expiresAt,
        feePolicyText: feePolicyText(policy),
      };
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  confirmCancellation: publicQuery.input(accessInput.extend({ cancellationId: z.string().min(1).max(64) })).mutation(async ({ input, ctx }) => {
    try {
      assertRateLimit("orders-cancel", clientIp(ctx.req), 5, 60_000);
      const db = getDb();
      const booking = await access(input, ctx.customer as CustomerCtx);
      const order = parseOrder(booking);
      const c = isCancellable(booking, order);
      if (!c.ok) throw new AppError("NOT_REFUNDABLE", { message: c.reason });

      const live = duffelConfig.configured && booking.supplier === "duffel" && !booking.orderId.startsWith("ord_demo_");
      const [payment] = await db.select().from(payments).where(eq(payments.bookingId, booking.id)).orderBy(desc(payments.createdAt)).limit(1);
      const currency = payment?.currency ?? order.totalCurrency;

      // 0) Kanselleringstilbudet må tilhøre DENNE ordren (aldri bekreft et fremmed tilbud)
      if (live) {
        const known = await duffelListOrderCancellations(booking.orderId);
        const match = known.find((q) => q.id === input.cancellationId);
        if (!match || match.orderId !== booking.orderId) {
          throw new AppError("NOT_FOUND", { message: "Kanselleringstilbudet tilhører ikke denne bestillingen eller er utløpt. Hent et nytt." });
        }
      } else if (!input.cancellationId.includes(booking.orderId)) {
        throw new AppError("NOT_FOUND", { message: "Kanselleringstilbudet tilhører ikke denne bestillingen." });
      }

      // 1) CANCELLATION_REQUESTED — compare-and-swap på tilstanden vi leste (B6): kun ÉN av
      //    parallelle bekreftelser vinner; resten får CONFLICT uten å røre leverandøren.
      const from = booking.state as BookingState;
      assertTransition(from, "CANCELLATION_REQUESTED");
      const res = await db.update(bookings).set({ state: "CANCELLATION_REQUESTED" }).where(and(eq(bookings.id, booking.id), eq(bookings.state, from)));
      if (Number(res[0].affectedRows) !== 1) throw new AppError("CONFLICT", { message: "Bestillingen er allerede under avbestilling." });
      await db.insert(bookingEvents).values({ bookingId: booking.id, fromState: from, toState: "CANCELLATION_REQUESTED", actorType: "customer", actorId: booking.contactEmail, reason: "Kunden ba om avbestilling" });

      // 2) Bekreft hos leverandør
      let supplierRefundMinor: number;
      let confirmedAt: string;
      try {
        if (live) {
          const q = await duffelConfirmOrderCancellation(input.cancellationId);
          if (q.orderId && q.orderId !== booking.orderId) {
            // Skal ikke kunne skje etter sjekk 0 — men aldri bokfør en fremmed kansellering.
            log.error({ bookingId: booking.id, orderId: booking.orderId, cancellationOrderId: q.orderId }, "Kansellering bekreftet for feil ordre");
            throw new AppError("INTERNAL", { message: "Leverandøren bekreftet kansellering for en annen ordre. Kontakt oss." });
          }
          supplierRefundMinor = toMinor(q.refundAmount, q.refundCurrency);
          confirmedAt = q.confirmedAt ?? new Date().toISOString();
        } else {
          if (env.isProdEnv) throw new AppError("NOT_REFUNDABLE");
          const supplierMinor = order.supplierAmount ? toMinor(order.supplierAmount, currency) : 0;
          supplierRefundMinor = demoCancellationQuote(booking.orderId, supplierMinor, currency).refundMinor;
          confirmedAt = new Date().toISOString();
        }
      } catch (err) {
        // Tilbake til forrige tilstand — ingenting er kansellert (CAS: kun hvis vi fortsatt holder låsen)
        const back = await db.update(bookings).set({ state: from }).where(and(eq(bookings.id, booking.id), eq(bookings.state, "CANCELLATION_REQUESTED")));
        if (Number(back[0].affectedRows) === 1) {
          await db.insert(bookingEvents).values({ bookingId: booking.id, fromState: "CANCELLATION_REQUESTED", toState: from, actorType: "system", reason: `Leverandør avviste kansellering: ${err instanceof Error ? err.message : String(err)}` });
        }
        throw err;
      }

      // 3) CANCELLED + refusjonssak (CAS fra CANCELLATION_REQUESTED)
      const done = await db
        .update(bookings)
        .set({ state: "CANCELLED", cancelledAt: new Date(confirmedAt), payload: JSON.stringify({ ...order, cancelledAt: confirmedAt }) })
        .where(and(eq(bookings.id, booking.id), eq(bookings.state, "CANCELLATION_REQUESTED")));
      if (Number(done[0].affectedRows) !== 1) throw new AppError("CONFLICT", { message: "Bestillingen endret tilstand underveis." });
      await db.insert(bookingEvents).values({ bookingId: booking.id, fromState: "CANCELLATION_REQUESTED", toState: "CANCELLED", actorType: "system", reason: `Kansellering bekreftet hos leverandør (${input.cancellationId})` });
      const rc = await openCustomerCancellationCase({
        bookingId: booking.id,
        requestedById: booking.contactEmail,
        supplierCancellationId: input.cancellationId,
        supplierRefundAmountMinor: supplierRefundMinor,
        supplierRefundCurrency: currency,
        reason: "Kunden avbestilte reisen selv.",
      });
      await enqueueJob("process_refund", { refundCaseId: rc.id }, { dedupeKey: `refund:${rc.id}`, priority: 2 });
      await enqueueJob(
        "send_email",
        {
          kind: "cancellation_confirmed",
          to: booking.contactEmail,
          locale: "nb",
          bookingId: booking.id,
          payload: { bookingReference: booking.bookingReference, refundReference: rc.reference, supplierRefund: fromMinor(supplierRefundMinor, currency), currency, byAirline: false },
        },
        { dedupeKey: `cancel-confirmed:${booking.id}` },
      ).catch(() => {});
      await logAudit({ actorType: "customer", actorId: booking.contactEmail, action: "booking.cancelled_by_customer", targetType: "booking", targetId: booking.id, metadata: { refundCaseId: rc.id, supplierRefundMinor }, ip: clientIp(ctx.req) });
      return { ok: true, state: "CANCELLED", refundReference: rc.reference, refundCaseId: rc.id };
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  refundStatus: publicQuery.input(accessInput).query(async ({ input, ctx }) => {
    try {
      assertRateLimit("orders-refund-status", clientIp(ctx.req), 60, 60_000);
      const db = getDb();
      const booking = await access(input, ctx.customer as CustomerCtx);
      const cases = await db.select().from(refundCases).where(eq(refundCases.bookingId, booking.id)).orderBy(desc(refundCases.createdAt));
      const events = cases.length ? await db.select().from(refundEvents).where(inArray(refundEvents.refundCaseId, cases.map((c) => c.id))).orderBy(asc(refundEvents.createdAt)) : [];
      return cases.map((c) => ({
        id: c.id,
        reference: c.reference,
        kind: c.kind,
        state: c.state,
        stateLabel: REFUND_STATE_LABELS[c.state as RefundState] ?? c.state,
        currency: c.currency,
        supplierRefundAmountMinor: c.supplierRefundAmountMinor,
        serviceFeeRefundMinor: c.serviceFeeRefundMinor,
        customerRefundAmountMinor: c.customerRefundAmountMinor,
        createdAt: c.createdAt.toISOString(),
        closedAt: c.closedAt?.toISOString() ?? null,
        timeline: events
          .filter((e) => e.refundCaseId === c.id && e.actorType !== "staff")
          .map((e) => ({ toState: e.toState, label: REFUND_STATE_LABELS[e.toState as RefundState] ?? e.toState, at: e.createdAt.toISOString() })),
      }));
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  resendConfirmation: publicQuery.input(accessInput).mutation(async ({ input, ctx }) => {
    try {
      assertRateLimit("orders-resend", clientIp(ctx.req), 3, 10 * 60_000);
      const booking = await access(input, ctx.customer as CustomerCtx);
      if (!canTransition(booking.state as BookingState, "CANCELLATION_REQUESTED") && booking.state !== "BOOKING_PROCESSING") {
        throw new AppError("CONFLICT", { message: "Bekreftelse kan ikke sendes for denne bestillingen." });
      }
      const { enqueued } = await enqueueJob("send_email", { kind: "booking_confirmation", bookingId: booking.id }, { dedupeKey: `resend-confirmation:${booking.id}:${Math.floor(Date.now() / 600_000)}` });
      return { ok: true, queued: enqueued };
    } catch (err) {
      throw toTRPCError(err);
    }
  }),
});
