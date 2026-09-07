import { z } from "zod";
import { and, asc, desc, eq, gte, like, or, sql, count, isNull, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, freshSessionProcedure, permittedProcedure, staffProcedure } from "./middleware";
import { getDb } from "./queries/connection";
import {
  auditLogs,
  bookingAttemptEvents,
  bookingAttempts,
  bookingEvents,
  bookingSegments,
  bookings,
  checkoutSessions,
  customerAccounts,
  customers,
  fraudFlags,
  internalNotes,
  invoices,
  jobs,
  passengerDocuments,
  payments,
  quotes,
  refundCases,
  refundEvents,
  scheduleChanges,
  settings,
  staffUsers,
  supportCases,
  supportMessages,
  tickets as ticketsTable,
  webhookEvents,
  partnerRequests,
  problemReports,
} from "../db/schema";
import { assertTransition, REFUND_STATE_LABELS, STATE_LABELS, type BookingState, type RefundState } from "./lib/statemachine";
import { addAmounts, toMinor } from "./lib/money";
import { getSetting, priceWithServiceFee, SETTING_KEYS, setSetting } from "./lib/pricing";
import { DEFAULT_REWARD_RULES, rewardRules } from "./lib/rewards";
import { enqueueJob, retryJob } from "./lib/jobs";
import { logAudit } from "./lib/audit";
import { humanReference } from "./lib/tokens";
import { sessionIsFresh } from "./lib/sessions";
import { clientIp } from "./lib/ratelimit";
import { randomToken, sha256Hex } from "./lib/tokens";
import { duffelGetOffer } from "./lib/duffel";
import { demoGetOffer } from "./lib/demo";
import { duffelConfig } from "./lib/duffel";
import { decryptField } from "./lib/crypto";
import { toTRPCError, AppError } from "./lib/errors";
import { createRefundCase, refundedSoFarMinor, transitionRefund, capturedPayment, OPEN_REFUND_STATES } from "./lib/refunds";
import { env } from "./lib/env";
import { passengerDetailsSchema } from "./checkout";
import { prepareQuotePassengers } from "./lib/quotePassengers";
import { finalizeCapturedAttempt } from "./lib/orchestrator";
import type { PassengerDetails } from "../contracts/types";

async function resolveOfferForQuote(offerId: string) {
  if (duffelConfig.configured) return duffelGetOffer(offerId);
  const offer = demoGetOffer(offerId);
  if (!offer) throw new TRPCError({ code: "NOT_FOUND", message: "Tilbudet er utløpt. Gjør et nytt søk." });
  return offer;
}

async function transitionBooking(
  bookingId: number,
  to: BookingState,
  actor: { type: string; id: string; label?: string },
  reason?: string,
  correlationId?: string,
) {
  const db = getDb();
  const rows = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  const booking = rows[0];
  if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke bestillingen." });
  assertTransition(booking.state, to);
  await db.update(bookings).set({ state: to }).where(eq(bookings.id, bookingId));
  await db.insert(bookingEvents).values({
    bookingId,
    fromState: booking.state,
    toState: to,
    actorType: actor.type,
    actorId: actor.id,
    reason: reason ?? null,
    correlationId: correlationId ?? null,
  });
  return booking;
}

const stateLabel = (s: string) => STATE_LABELS[s as BookingState] ?? s;

export const adminRouter = createRouter({
  // ─── OVERSIKT ─────────────────────────────────────────────────────────────

  dashboard: permittedProcedure("overview:read").query(async () => {
    const db = getDb();
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60_000);
    const in24h = new Date(Date.now() + 24 * 60 * 60_000);
    const in72h = new Date(Date.now() + 72 * 60 * 60_000);

    const q = async (where?: ReturnType<typeof and>) => {
      const rows = await db.select({ n: count() }).from(bookings).where(where);
      return Number(rows[0]?.n ?? 0);
    };

    const [today, thisWeek, awaitingPayment, processing, reconciliation, failed] = await Promise.all([
      q(gte(bookings.createdAt, dayStart)),
      q(gte(bookings.createdAt, weekStart)),
      q(eq(bookings.state, "AWAITING_PAYMENT")),
      q(eq(bookings.state, "BOOKING_PROCESSING")),
      q(eq(bookings.state, "AWAITING_RECONCILIATION")),
      q(eq(bookings.state, "BOOKING_FAILED")),
    ]);

    const salesRows = await db
      .select({ currency: bookings.totalCurrency, total: sql<string>`COALESCE(SUM(${bookings.totalAmount}), 0)` })
      .from(bookings)
      .where(and(gte(bookings.createdAt, weekStart), inArray(bookings.state, ["CONFIRMED", "TRAVELLED", "CHANGE_REQUESTED"])))
      .groupBy(bookings.totalCurrency);
    const [reviewCount] = await db.select({ n: count() }).from(bookings).where(inArray(bookings.state, ["REVIEW", "BOOKING_FAILED", "AWAITING_RECONCILIATION"]));
    const [stuckAttempts] = await db.select({ n: count() }).from(bookingAttempts).where(inArray(bookingAttempts.state, ["SUPPLIER_UNKNOWN", "FAILED_VOIDED"]));
    const [openChanges] = await db.select({ n: count() }).from(scheduleChanges).where(eq(scheduleChanges.status, "detected"));
    const [openFraud] = await db.select({ n: count() }).from(fraudFlags).where(eq(fraudFlags.status, "open"));

    const departures24 = await db
      .select({ n: count() })
      .from(bookingSegments)
      .innerJoin(bookings, eq(bookings.id, bookingSegments.bookingId))
      .where(and(
        eq(bookings.state, "CONFIRMED"),
        gte(bookingSegments.departingAt, new Date().toISOString()),
        sql`${bookingSegments.departingAt} <= ${in24h.toISOString()}`,
      ));
    const departures72 = await db
      .select({ n: count() })
      .from(bookingSegments)
      .innerJoin(bookings, eq(bookings.id, bookingSegments.bookingId))
      .where(and(
        eq(bookings.state, "CONFIRMED"),
        gte(bookingSegments.departingAt, new Date().toISOString()),
        sql`${bookingSegments.departingAt} <= ${in72h.toISOString()}`,
      ));

    const [unassignedCases] = await db
      .select({ n: count() })
      .from(supportCases)
      .where(and(isNull(supportCases.assigneeId), inArray(supportCases.status, ["open", "pending_customer"])));
    const [pendingRefunds] = await db
      .select({ n: count() })
      .from(refundCases)
      .where(inArray(refundCases.state, ["requested", "eligibility_checked", "supplier_confirmed", "psp_refund_failed"]));
    const [deadJobs] = await db.select({ n: count() }).from(jobs).where(eq(jobs.status, "dead"));
    const [failedWebhooks] = await db
      .select({ n: count() })
      .from(webhookEvents)
      .where(eq(webhookEvents.status, "failed"));
    const [openProblems] = await db
      .select({ n: count() })
      .from(problemReports)
      .where(inArray(problemReports.status, ["open", "in_progress"]));
    const [newPartnerRequests] = await db
      .select({ n: count() })
      .from(partnerRequests)
      .where(eq(partnerRequests.status, "new"));

    const recentActivity = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(12);

    return {
      bookingsToday: today,
      bookingsThisWeek: thisWeek,
      confirmedSalesWeek: salesRows.find((r) => r.currency === "NOK")?.total ?? "0",
      confirmedSalesWeekByCurrency: salesRows.map((r) => ({ currency: r.currency ?? "NOK", total: String(r.total) })),
      awaitingPayment, processing, reconciliation, failed,
      reviewQueue: Number(reviewCount?.n ?? 0) + Number(stuckAttempts?.n ?? 0),
      openScheduleChanges: Number(openChanges?.n ?? 0),
      openFraudFlags: Number(openFraud?.n ?? 0),
      departures24h: Number(departures24[0]?.n ?? 0),
      departures72h: Number(departures72[0]?.n ?? 0),
      unassignedCases: Number(unassignedCases?.n ?? 0),
      pendingRefunds: Number(pendingRefunds?.n ?? 0),
      deadJobs: Number(deadJobs?.n ?? 0),
      failedWebhooks: Number(failedWebhooks?.n ?? 0),
      openProblems: Number(openProblems?.n ?? 0),
      newPartnerRequests: Number(newPartnerRequests?.n ?? 0),
      recentActivity: recentActivity.map((a) => ({
        id: a.id, actorLabel: a.actorLabel ?? a.actorType, action: a.action,
        targetType: a.targetType, targetId: a.targetId, createdAt: a.createdAt,
      })),
    };
  }),

  // ─── BESTILLINGER ─────────────────────────────────────────────────────────

  bookingsList: permittedProcedure("bookings:read")
    .input(z.object({
      query: z.string().max(120).optional(),
      state: z.string().max(32).optional(),
      liveMode: z.boolean().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(5).max(100).default(25),
      sort: z.enum(["newest", "oldest"]).default("newest"),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input.state) conditions.push(eq(bookings.state, input.state));
      if (input.liveMode !== undefined) conditions.push(eq(bookings.liveMode, input.liveMode));
      if (input.query) {
        const term = `%${input.query.trim()}%`;
        // Søk i strukturerte felt (aldri LIKE på payload): ref/ordre/e-post/telefon + passasjernavn (tickets) + kundenavn
        const byTicket = db.select({ id: ticketsTable.bookingId }).from(ticketsTable).where(like(ticketsTable.passengerName, term));
        const byCustomer = db.select({ id: customers.id }).from(customers).where(like(customers.name, term));
        conditions.push(or(
          like(bookings.bookingReference, term),
          like(bookings.orderId, term),
          like(bookings.contactEmail, term),
          like(bookings.contactPhone, term),
          inArray(bookings.id, byTicket),
          inArray(bookings.customerId, byCustomer),
        ));
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const [totalRow] = await db.select({ n: count() }).from(bookings).where(where);
      const rows = await db
        .select()
        .from(bookings)
        .where(where)
        .orderBy(input.sort === "newest" ? desc(bookings.createdAt) : asc(bookings.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      return {
        total: Number(totalRow?.n ?? 0),
        page: input.page,
        pageSize: input.pageSize,
        items: rows.map((b) => {
          let route = "";
          let passenger = "";
          try {
            const p = JSON.parse(b.payload);
            const s = p.slices?.[0];
            route = s ? `${s.origin.iata} → ${p.slices.length > 1 ? p.slices[p.slices.length - 1].destination.iata : s.destination.iata}` : "";
            passenger = p.passengers?.map((x: { givenName: string; familyName: string }) => `${x.givenName} ${x.familyName}`).join(", ") ?? "";
          } catch { /* payload er alltid JSON fra createOrder */ }
          return {
            id: b.id, orderId: b.orderId, bookingReference: b.bookingReference,
            state: b.state, stateLabel: stateLabel(b.state), liveMode: b.liveMode,
            contactEmail: b.contactEmail, totalAmount: b.totalAmount, totalCurrency: b.totalCurrency,
            route, passenger, createdAt: b.createdAt, lastReconciledAt: b.lastReconciledAt,
          };
        }),
      };
    }),

  bookingDetail: permittedProcedure("bookings:read")
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [booking] = await db.select().from(bookings).where(eq(bookings.id, input.id)).limit(1);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke bestillingen." });

      const [events, segments, paymentRows, noteRows, caseRows, quoteRow] = await Promise.all([
        db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, input.id)).orderBy(desc(bookingEvents.createdAt)),
        db.select().from(bookingSegments).where(eq(bookingSegments.bookingId, input.id))
          .orderBy(asc(bookingSegments.sliceIndex), asc(bookingSegments.segmentIndex)),
        db.select().from(payments).where(eq(payments.bookingId, input.id)).orderBy(desc(payments.createdAt)),
        db.select({ note: internalNotes, author: staffUsers.name })
          .from(internalNotes)
          .leftJoin(staffUsers, eq(staffUsers.id, internalNotes.authorId))
          .where(eq(internalNotes.bookingId, input.id))
          .orderBy(desc(internalNotes.createdAt)),
        db.select().from(supportCases).where(eq(supportCases.bookingId, input.id)),
        booking.quoteId
          ? db.select().from(quotes).where(eq(quotes.id, booking.quoteId)).limit(1)
          : Promise.resolve([]),
      ]);

      const [refundRows, ticketRows, docRows, attemptRows, invoiceRows, changeRows, flagRows] = await Promise.all([
        db.select().from(refundCases).where(eq(refundCases.bookingId, input.id)).orderBy(desc(refundCases.createdAt)),
        db.select().from(ticketsTable).where(eq(ticketsTable.bookingId, input.id)),
        db.select().from(passengerDocuments).where(eq(passengerDocuments.bookingId, input.id)),
        booking.checkoutSessionId
          ? db.select().from(bookingAttempts).where(eq(bookingAttempts.checkoutSessionId, booking.checkoutSessionId)).orderBy(desc(bookingAttempts.id))
          : Promise.resolve([]),
        db.select().from(invoices).where(eq(invoices.bookingId, input.id)).orderBy(desc(invoices.issuedAt)),
        db.select().from(scheduleChanges).where(eq(scheduleChanges.bookingId, input.id)).orderBy(desc(scheduleChanges.createdAt)),
        db.select().from(fraudFlags).where(eq(fraudFlags.bookingId, input.id)),
      ]);
      const payload = JSON.parse(booking.payload) as Record<string, unknown>;
      // Passasjerdata i payload skal aldri inneholde dokumentnummer — fjern defensivt likevel
      if (Array.isArray(payload.passengers)) {
        payload.passengers = (payload.passengers as Array<Record<string, unknown>>).map((p) => ({ ...p, identityDocument: undefined }));
      }

      return {
        booking: {
          id: booking.id, orderId: booking.orderId, bookingReference: booking.bookingReference,
          state: booking.state, stateLabel: stateLabel(booking.state), liveMode: booking.liveMode,
          contactEmail: booking.contactEmail, contactPhone: booking.contactPhone,
          totalAmount: booking.totalAmount, totalCurrency: booking.totalCurrency,
          source: booking.source, supplier: booking.supplier, createdAt: booking.createdAt,
          cancelledAt: booking.cancelledAt, travelCompletedAt: booking.travelCompletedAt,
          lastReconciledAt: booking.lastReconciledAt,
          customerAccountId: booking.customerAccountId, checkoutSessionId: booking.checkoutSessionId,
          payload,
        },
        tickets: ticketRows,
        /** Kun siste 4 tegn — hele nummeret krever revealPassengerDocument (customers:reveal + revisjon). */
        passengerDocuments: docRows.map((d) => ({
          id: d.id, passengerId: d.passengerId, type: d.type, last4: d.identifierLast4,
          issuingCountryCode: d.issuingCountryCode, expiresOn: d.expiresOn,
        })),
        attempts: attemptRows.map((a) => ({
          id: a.id, state: a.state, supplierOrderId: a.supplierOrderId, supplierBookingReference: a.supplierBookingReference,
          supplierTotalMinor: a.supplierTotalMinor, supplierCurrency: a.supplierCurrency, pspIntentId: a.pspIntentId,
          attempts: a.attempts, lastErrorCode: a.lastErrorCode, lastError: a.lastError, createdAt: a.createdAt, updatedAt: a.updatedAt,
        })),
        invoices: invoiceRows.map((i) => ({ ...i, lines: JSON.parse(i.linesJson) as unknown })),
        scheduleChanges: changeRows,
        fraudFlags: flagRows,
        events: events.map((e) => ({
          id: e.id, fromState: e.fromState ? stateLabel(e.fromState) : null,
          toState: stateLabel(e.toState), actorType: e.actorType, reason: e.reason, createdAt: e.createdAt,
        })),
        segments,
        payments: paymentRows,
        refundCases: refundRows.map((r) => ({ ...r, stateLabel: REFUND_STATE_LABELS[r.state as RefundState] ?? r.state })),
        notes: noteRows.map((n) => ({
          id: n.note.id, body: n.note.body, author: n.author ?? "Ukjent", createdAt: n.note.createdAt,
        })),
        cases: caseRows,
        quote: quoteRow[0] ?? null,
      };
    }),

  addBookingNote: permittedProcedure("bookings:write")
    .input(z.object({ bookingId: z.number().int(), body: z.string().trim().min(1).max(4000) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db.insert(internalNotes).values({
        bookingId: input.bookingId, authorId: ctx.staff!.userId, body: input.body,
      });
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: "booking.note_added", targetType: "booking", targetId: input.bookingId,
      });
      return { ok: true };
    }),

  resendConfirmation: permittedProcedure("bookings:write")
    .input(z.object({ bookingId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const [booking] = await getDb().select().from(bookings).where(eq(bookings.id, input.bookingId)).limit(1);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke bestillingen." });
      await enqueueJob("send_email", { kind: "booking_confirmation", bookingId: input.bookingId },
        { dedupeKey: `resend-confirmation:${input.bookingId}:${Date.now()}` });
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: "booking.confirmation_resent", targetType: "booking", targetId: input.bookingId,
      });
      return { ok: true };
    }),

  /** Privilegert: vis fullt dokumentnummer (dekrypteres i minnet) — logges alltid. */
  revealPassengerDocument: permittedProcedure("customers:reveal")
    .input(z.object({ documentId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const [doc] = await getDb().select().from(passengerDocuments).where(eq(passengerDocuments.id, input.documentId)).limit(1);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke dokumentet." });
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: "passenger_document.revealed", targetType: "passenger_document", targetId: input.documentId,
        metadata: { bookingId: doc.bookingId, passengerId: doc.passengerId }, ip: clientIp(ctx.req),
      });
      return { uniqueIdentifier: decryptField(doc.identifierCiphertext), issuingCountryCode: doc.issuingCountryCode, expiresOn: doc.expiresOn, type: doc.type };
    }),

  /** Kjør et booking-forsøk på nytt (f.eks. etter feilet fangst når Stripe er rettet). */
  retryAttempt: permittedProcedure("bookings:write")
    .input(z.object({ attemptId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [attempt] = await db.select().from(bookingAttempts).where(eq(bookingAttempts.id, input.attemptId)).limit(1);
      if (!attempt) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke forsøket." });
      if (["CONFIRMED", "FAILED_VOIDED", "FAILED"].includes(attempt.state)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Forsøket er avsluttet (${attempt.state}).` });
      }
      const job = attempt.state === "SUPPLIER_UNKNOWN" ? "recover_attempt" : "process_booking_attempt";
      await db.update(bookingAttempts).set({ lastErrorCode: null }).where(eq(bookingAttempts.id, input.attemptId));
      await enqueueJob(job, { attemptId: input.attemptId }, { dedupeKey: `${job === "recover_attempt" ? "recover" : "attempt"}:${input.attemptId}`, priority: 1 });
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: "booking_attempt.retried", targetType: "booking_attempt", targetId: input.attemptId, metadata: { state: attempt.state },
      });
      return { ok: true };
    }),

  reconcileBooking: permittedProcedure("bookings:reconcile")
    .input(z.object({ bookingId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      await enqueueJob("reconcile_order", { bookingId: input.bookingId },
        { dedupeKey: `reconcile:${input.bookingId}` });
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: "booking.reconcile_requested", targetType: "booking", targetId: input.bookingId,
      });
      return { ok: true };
    }),

  bookingTransition: permittedProcedure("bookings:write")
    .input(z.object({
      bookingId: z.number().int(),
      toState: z.enum(["CHANGE_REQUESTED", "CANCELLATION_REQUESTED", "CANCELLED", "REFUND_PENDING", "CONFIRMED", "REVIEW", "TRAVELLED"]),
      reason: z.string().trim().min(3).max(1000),
    }))
    .mutation(async ({ input, ctx }) => {
      const booking = await transitionBooking(input.bookingId, input.toState,
        { type: "staff", id: String(ctx.staff!.userId) }, input.reason);
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: `booking.state_changed`, targetType: "booking", targetId: input.bookingId,
        metadata: { from: booking.state, to: input.toState, reason: input.reason },
        ip: clientIp(ctx.req),
      });
      return { ok: true, newState: input.toState, newStateLabel: stateLabel(input.toState) };
    }),

  // ─── TILBUD (assisted booking) ────────────────────────────────────────────

  quotesList: permittedProcedure("quotes:read")
    .input(z.object({
      status: z.string().max(24).optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(5).max(100).default(25),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const where = input.status ? eq(quotes.status, input.status) : undefined;
      const [totalRow] = await db.select({ n: count() }).from(quotes).where(where);
      const rows = await db
        .select({ quote: quotes, creator: staffUsers.name })
        .from(quotes)
        .leftJoin(staffUsers, eq(staffUsers.id, quotes.createdById))
        .where(where)
        .orderBy(desc(quotes.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      return {
        total: Number(totalRow?.n ?? 0),
        items: rows.map((r) => ({ ...r.quote, creatorName: r.creator ?? "Ukjent" })),
      };
    }),

  createQuote: permittedProcedure("quotes:write")
    .input(z.object({
      offerId: z.string().min(1),
      customerName: z.string().trim().min(1).max(120),
      customerEmail: z.string().email(),
      customerPhone: z.string().max(32).optional(),
      // Utelates gebyret beregnes det automatisk: 8 % + 250 kr (se pricing.ts).
      serviceFeeAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      expiresInHours: z.number().int().min(1).max(168).default(24),
      /** Valgfritt: passasjerer (samme skjema som checkout). Kunden kan ellers fylle inn via tilbudslenken. */
      passengers: z.array(passengerDetailsSchema).min(1).max(9).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
      const offer = await resolveOfferForQuote(input.offerId);
      const serviceFeeAmount = input.serviceFeeAmount
        ?? priceWithServiceFee(offer.totalAmount).serviceFeeAmount;
      const total = addAmounts(offer.totalAmount, serviceFeeAmount);
      const prepared = input.passengers
        ? prepareQuotePassengers(input.passengers as PassengerDetails[], offer, { email: input.customerEmail, phone: input.customerPhone })
        : null;
      const token = randomToken(32);
      const reference = humanReference("RT", 6);
      const db = getDb();
      const result = await db.insert(quotes).values({
        reference,
        createdById: ctx.staff!.userId,
        customerName: input.customerName,
        customerEmail: input.customerEmail.toLowerCase().trim(),
        customerPhone: prepared?.contact.phone ?? input.customerPhone ?? null,
        offerId: input.offerId,
        offerSnapshot: JSON.stringify(offer),
        passengersJson: prepared ? JSON.stringify(prepared.stored) : null,
        serviceFeeAmount,
        totalAmount: total,
        currency: offer.totalCurrency,
        status: "draft",
        checkoutTokenHash: sha256Hex(token),
        expiresAt: new Date(Date.now() + input.expiresInHours * 60 * 60_000),
      });
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: "quote.created", targetType: "quote", targetId: reference,
        metadata: { offerId: input.offerId, total, currency: offer.totalCurrency, passengers: prepared?.stored.length ?? 0 },
      });
      return {
        id: Number(result[0].insertId), reference, total,
        checkoutPath: `/tilbud/${token}`,
        passengersSubmitted: Boolean(prepared),
      };
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  sendQuote: permittedProcedure("quotes:write")
    .input(z.object({ quoteId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [quote] = await db.select().from(quotes).where(eq(quotes.id, input.quoteId)).limit(1);
      if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke tilbudet." });
      if (!["draft", "sent"].includes(quote.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Tilbudet har status «${quote.status}» og kan ikke sendes.` });
      }
      if (quote.expiresAt < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tilbudet er utløpt. Lag et nytt." });
      }
      // Ny checkout-token ved hver sending (gamle lenker ugyldiggjøres)
      const token = randomToken(32);
      await db.update(quotes)
        .set({ status: "sent", checkoutTokenHash: sha256Hex(token) })
        .where(eq(quotes.id, input.quoteId));
      await enqueueJob("send_email", { kind: "quote_checkout", quoteId: input.quoteId, token },
        { dedupeKey: `quote-send:${input.quoteId}:${Date.now()}` });
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: "quote.sent", targetType: "quote", targetId: quote.reference,
      });
      return { ok: true, checkoutPath: `/tilbud/${token}` };
    }),

  quoteDetail: permittedProcedure("quotes:read")
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select({ quote: quotes, creator: staffUsers.name })
        .from(quotes)
        .leftJoin(staffUsers, eq(staffUsers.id, quotes.createdById))
        .where(eq(quotes.id, input.id))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke tilbudet." });
      return {
        ...row.quote,
        creatorName: row.creator ?? "Ukjent",
        offer: JSON.parse(row.quote.offerSnapshot),
      };
    }),

  /** Manuell betalingsbekreftelse (Vipps/bank) — FINANCE/ADMIN, krever fersk sesjon. */
  markQuotePaid: permittedProcedure("refunds:process")
    .input(z.object({
      quoteId: z.number().int(),
      note: z.string().trim().min(3).max(255),
      confirmFreshSession: z.literal(true),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!sessionIsFresh(ctx.staff!)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Krever nylig innlogging for å bekrefte betaling." });
      }
      const db = getDb();
      const [quote] = await db.select().from(quotes).where(eq(quotes.id, input.quoteId)).limit(1);
      if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke tilbudet." });
      if (quote.status !== "sent") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Kun sendte tilbud kan merkes som betalt." });
      }
      if (quote.expiresAt < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tilbudet er utløpt — prisen må revalideres før booking." });
      }
      await db.update(quotes).set({ status: "paid" }).where(eq(quotes.id, input.quoteId));
      await db.insert(payments).values({
        quoteId: input.quoteId, provider: "manual", amount: quote.totalAmount,
        amountMinor: toMinor(quote.totalAmount, quote.currency),
        currency: quote.currency, status: "captured", note: input.note,
        idempotencyKey: `manual:quote:${input.quoteId}`, capturedAt: new Date(),
      });
      await enqueueJob("book_from_quote", { quoteId: input.quoteId });
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: "quote.marked_paid", targetType: "quote", targetId: quote.reference,
        metadata: { note: input.note, amount: quote.totalAmount, currency: quote.currency },
        ip: clientIp(ctx.req),
      });
      return { ok: true };
    }),

  // ─── KUNDER ───────────────────────────────────────────────────────────────

  customersList: permittedProcedure("customers:read")
    .input(z.object({
      query: z.string().max(120).optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(5).max(100).default(25),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const term = input.query ? `%${input.query}%` : null;
      const where = term ? or(like(customers.email, term), like(customers.name, term), like(customers.phone, term)) : undefined;
      const [totalRow] = await db.select({ n: count() }).from(customers).where(where);
      const rows = await db
        .select()
        .from(customers)
        .where(where)
        .orderBy(desc(customers.updatedAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      const bookingCounts = rows.length > 0
        ? await db
            .select({ customerId: bookings.customerId, n: count() })
            .from(bookings)
            .where(inArray(bookings.customerId, rows.map((c) => c.id)))
            .groupBy(bookings.customerId)
        : [];
      const countMap = new Map(bookingCounts.map((r) => [r.customerId, Number(r.n)]));
      return {
        total: Number(totalRow?.n ?? 0),
        items: rows.map((c) => ({
          id: c.id,
          email: maskEmail(c.email),
          name: c.name ?? "—",
          phone: c.phone ? maskPhone(c.phone) : "—",
          bookings: countMap.get(c.id) ?? 0,
          createdAt: c.createdAt,
        })),
      };
    }),

  /** Registrerte kundekontoer (innloggede kunder) med antall bestillinger. */
  accountList: permittedProcedure("customers:read")
    .input(z.object({ query: z.string().max(120).optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      const term = input.query ? `%${input.query}%` : null;
      const where = term
        ? or(
            like(customerAccounts.email, term),
            like(customerAccounts.firstName, term),
            like(customerAccounts.lastName, term),
            like(customerAccounts.phone, term),
          )
        : undefined;
      const rows = await db
        .select()
        .from(customerAccounts)
        .where(where)
        .orderBy(desc(customerAccounts.createdAt))
        .limit(100);
      const emails = rows.map((r) => r.email).filter((e): e is string => Boolean(e));
      const bookingCounts = emails.length
        ? await db
            .select({ email: bookings.contactEmail, n: count() })
            .from(bookings)
            .where(inArray(bookings.contactEmail, emails))
            .groupBy(bookings.contactEmail)
        : [];
      const countMap = new Map(bookingCounts.map((r) => [r.email, Number(r.n)]));
      return rows.map((r) => ({
        id: r.id,
        name: `${r.firstName} ${r.lastName}`,
        email: r.email ? maskEmail(r.email) : "—",
        phone: r.phone ? maskPhone(r.phone) : "—",
        emailVerified: r.emailVerified,
        bonusKr: r.bonusKr,
        bookings: r.email ? (countMap.get(r.email) ?? 0) : 0,
        createdAt: r.createdAt,
      }));
    }),

  customerDetail: permittedProcedure("customers:read")
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [customer] = await db.select().from(customers).where(eq(customers.id, input.id)).limit(1);
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke kunden." });
      const [bookingRows, quoteRows, caseRows] = await Promise.all([
        db.select().from(bookings).where(eq(bookings.customerId, input.id)).orderBy(desc(bookings.createdAt)).limit(50),
        db.select().from(quotes).where(eq(quotes.customerEmail, customer.email)).orderBy(desc(quotes.createdAt)).limit(20),
        db.select().from(supportCases).where(eq(supportCases.customerEmail, customer.email)).orderBy(desc(supportCases.createdAt)).limit(20),
      ]);
      return {
        customer: { id: customer.id, email: maskEmail(customer.email), name: customer.name, phone: customer.phone ? maskPhone(customer.phone) : null, createdAt: customer.createdAt },
        bookings: bookingRows.map((b) => ({
          id: b.id, bookingReference: b.bookingReference, state: b.state,
          stateLabel: stateLabel(b.state), totalAmount: b.totalAmount,
          totalCurrency: b.totalCurrency, createdAt: b.createdAt,
        })),
        quotes: quoteRows.map((qt) => ({
          id: qt.id, reference: qt.reference, status: qt.status,
          totalAmount: qt.totalAmount, currency: qt.currency, createdAt: qt.createdAt,
        })),
        cases: caseRows,
      };
    }),

  /** Privilegert visning av umaskerte kontaktopplysninger — logges alltid. */
  revealCustomerContact: permittedProcedure("customers:reveal")
    .input(z.object({ customerId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const [customer] = await getDb().select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke kunden." });
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: "customer.contact_revealed", targetType: "customer", targetId: input.customerId,
        ip: clientIp(ctx.req),
      });
      return { email: customer.email, phone: customer.phone };
    }),

  // ─── BETALINGER OG REFUSJONER ─────────────────────────────────────────────

  paymentsList: permittedProcedure("payments:read")
    .input(z.object({
      status: z.string().max(24).optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(5).max(100).default(25),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const where = input.status ? eq(payments.status, input.status) : undefined;
      const [totalRow] = await db.select({ n: count() }).from(payments).where(where);
      const rows = await db
        .select({ payment: payments, bookingRef: bookings.bookingReference, quoteRef: quotes.reference })
        .from(payments)
        .leftJoin(bookings, eq(bookings.id, payments.bookingId))
        .leftJoin(quotes, eq(quotes.id, payments.quoteId))
        .where(where)
        .orderBy(desc(payments.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      return {
        total: Number(totalRow?.n ?? 0),
        items: rows.map((r) => ({
          ...r.payment,
          bookingReference: r.bookingRef ?? null,
          quoteReference: r.quoteRef ?? null,
        })),
      };
    }),

  refundCasesList: permittedProcedure("payments:read")
    .input(z.object({
      state: z.string().max(32).optional(),
      open: z.boolean().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(5).max(100).default(25),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input.state) conditions.push(eq(refundCases.state, input.state));
      if (input.open) conditions.push(inArray(refundCases.state, OPEN_REFUND_STATES));
      const where = conditions.length ? and(...conditions) : undefined;
      const [totalRow] = await db.select({ n: count() }).from(refundCases).where(where);
      const rows = await db
        .select({ rc: refundCases, bookingRef: bookings.bookingReference, email: bookings.contactEmail, approver: staffUsers.name })
        .from(refundCases)
        .innerJoin(bookings, eq(bookings.id, refundCases.bookingId))
        .leftJoin(staffUsers, eq(staffUsers.id, refundCases.approvedById))
        .where(where)
        .orderBy(desc(refundCases.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      return {
        total: Number(totalRow?.n ?? 0),
        items: rows.map((r) => ({
          ...r.rc, stateLabel: REFUND_STATE_LABELS[r.rc.state as RefundState] ?? r.rc.state,
          bookingReference: r.bookingRef, customerEmail: maskEmail(r.email), approverName: r.approver ?? null,
        })),
      };
    }),

  refundCaseDetail: permittedProcedure("payments:read")
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [rc] = await db.select().from(refundCases).where(eq(refundCases.id, input.id)).limit(1);
      if (!rc) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke refusjonssaken." });
      const [booking] = await db.select().from(bookings).where(eq(bookings.id, rc.bookingId)).limit(1);
      const events = await db.select().from(refundEvents).where(eq(refundEvents.refundCaseId, input.id)).orderBy(asc(refundEvents.createdAt));
      const payment = rc.paymentId ? (await db.select().from(payments).where(eq(payments.id, rc.paymentId)).limit(1))[0] ?? null : null;
      const alreadyRefunded = await refundedSoFarMinor(db, rc.bookingId, rc.id);
      return {
        ...rc,
        stateLabel: REFUND_STATE_LABELS[rc.state as RefundState] ?? rc.state,
        booking: booking ? { id: booking.id, bookingReference: booking.bookingReference, state: booking.state, stateLabel: stateLabel(booking.state), contactEmail: booking.contactEmail, totalAmount: booking.totalAmount, totalCurrency: booking.totalCurrency } : null,
        payment: payment ? { id: payment.id, provider: payment.provider, providerRef: payment.providerRef, amountMinor: payment.amountMinor, refundedMinor: payment.refundedMinor, currency: payment.currency, status: payment.status } : null,
        alreadyRefundedMinor: alreadyRefunded,
        events: events.map((e) => ({ ...e, toLabel: REFUND_STATE_LABELS[e.toState as RefundState] ?? e.toState })),
      };
    }),

  /** Opprett refusjonssak (kulanse, kundekansellering registrert av ansatt, flyselskapskansellering). */
  requestRefund: permittedProcedure("refunds:request")
    .input(z.object({
      bookingId: z.number().int(),
      kind: z.enum(["staff_goodwill", "customer_cancellation", "airline_cancellation"]),
      /** Beløp til kunde i minste enhet (påkrevd for kulanse). */
      amountMinor: z.number().int().positive().optional(),
      reason: z.string().trim().min(10).max(1000),
      passengerIds: z.array(z.string().max(64)).max(9).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        if (input.kind === "staff_goodwill" && !input.amountMinor) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Kulanse krever et beløp." });
        }
        const rc = await createRefundCase({
          bookingId: input.bookingId, kind: input.kind, initiatedBy: "staff", requestedById: ctx.staff!.userId,
          reason: input.reason, requestedAmountMinor: input.amountMinor ?? null, passengerIds: input.passengerIds ?? null,
        });
        await logAudit({
          actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
          action: "refund.requested", targetType: "refund_case", targetId: rc.id,
          metadata: { bookingId: input.bookingId, kind: input.kind, amountMinor: input.amountMinor ?? null, reason: input.reason },
          ip: clientIp(ctx.req),
        });
        return { ok: true, id: rc.id, reference: rc.reference };
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /** Godkjenn: beløp bekreftes (evt. overstyrt innen fanget beløp) og PSP-refusjon legges i kø. Krever fersk sesjon. */
  approveRefund: freshSessionProcedure("refunds:process")
    .input(z.object({
      refundCaseId: z.number().int(),
      customerRefundAmountMinor: z.number().int().nonnegative().optional(),
      supplierRefundAmountMinor: z.number().int().nonnegative().optional(),
      serviceFeeRefundMinor: z.number().int().nonnegative().optional(),
      note: z.string().trim().max(1000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const db = getDb();
        const [rc] = await db.select().from(refundCases).where(eq(refundCases.id, input.refundCaseId)).limit(1);
        if (!rc) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke refusjonssaken." });
        const payment = rc.paymentId ? (await db.select().from(payments).where(eq(payments.id, rc.paymentId)).limit(1))[0] : await capturedPayment(db, rc.bookingId);
        const capturedMinor = payment?.amountMinor ?? 0;
        const already = await refundedSoFarMinor(db, rc.bookingId, rc.id);
        const supplierPart = input.supplierRefundAmountMinor ?? rc.supplierRefundAmountMinor ?? 0;
        const feePart = input.serviceFeeRefundMinor ?? rc.serviceFeeRefundMinor;
        const amount = input.customerRefundAmountMinor ?? rc.requestedAmountMinor ?? supplierPart + rc.servicesRefundMinor + feePart;
        if (amount <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Beløpet må være større enn 0." });
        if (already + amount > capturedMinor) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Beløpet overstiger fanget beløp (${capturedMinor} − allerede refundert ${already}).` });
        }
        const actor = { type: "staff" as const, id: ctx.staff!.userId };
        const patch = { approvedById: ctx.staff!.userId, customerRefundAmountMinor: amount, supplierRefundAmountMinor: supplierPart, serviceFeeRefundMinor: feePart };
        // Kjør saken frem til amount_confirmed langs gyldig sti
        let cur = rc.state as RefundState;
        const note = input.note ?? "Godkjent av ansatt";
        if (cur === "requested") cur = (await transitionRefund(rc.id, "eligibility_checked", actor, note)).state as RefundState;
        if (cur === "eligibility_checked") {
          if (rc.kind === "staff_goodwill" || !rc.supplierCancellationId) {
            cur = (await transitionRefund(rc.id, "amount_confirmed", actor, note, patch)).state as RefundState;
          } else {
            cur = (await transitionRefund(rc.id, "supplier_requested", actor, note)).state as RefundState;
          }
        }
        if (cur === "supplier_requested" || cur === "supplier_pending") cur = (await transitionRefund(rc.id, "supplier_confirmed", actor, "Leverandørbeløp bekreftet av ansatt", { supplierRefundAmountMinor: supplierPart })).state as RefundState;
        if (cur === "supplier_confirmed") cur = (await transitionRefund(rc.id, "amount_confirmed", actor, note, patch)).state as RefundState;
        if (cur === "psp_refund_failed") {
          await db.update(refundCases).set(patch).where(eq(refundCases.id, rc.id));
        } else if (cur !== "amount_confirmed") {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Saken kan ikke godkjennes i tilstand ${cur}.` });
        }
        await enqueueJob("process_refund", { refundCaseId: rc.id }, { dedupeKey: `refund:${rc.id}`, priority: 2 });
        await logAudit({
          actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
          action: "refund.approved", targetType: "refund_case", targetId: rc.id,
          metadata: { amountMinor: amount, currency: rc.currency, note: input.note ?? null }, ip: clientIp(ctx.req),
        });
        return { ok: true, amountMinor: amount };
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  rejectRefund: permittedProcedure("refunds:process")
    .input(z.object({ refundCaseId: z.number().int(), reason: z.string().trim().min(3).max(1000) }))
    .mutation(async ({ input, ctx }) => {
      try {
        const db = getDb();
        const [rc] = await db.select().from(refundCases).where(eq(refundCases.id, input.refundCaseId)).limit(1);
        if (!rc) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke refusjonssaken." });
        const actor = { type: "staff" as const, id: ctx.staff!.userId };
        if (rc.state === "supplier_requested" || rc.state === "supplier_pending") await transitionRefund(rc.id, "supplier_rejected", actor, input.reason);
        await transitionRefund(rc.id, "rejected", actor, input.reason);
        const [booking] = await db.select().from(bookings).where(eq(bookings.id, rc.bookingId)).limit(1);
        if (booking) {
          await enqueueJob("send_email", {
            kind: "refund_rejected", to: booking.contactEmail, locale: "nb", bookingId: booking.id,
            payload: { bookingReference: booking.bookingReference, refundReference: rc.reference, reason: input.reason },
          }, { dedupeKey: `refund-rejected:${rc.id}` });
        }
        await logAudit({
          actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
          action: "refund.rejected", targetType: "refund_case", targetId: rc.id, metadata: { reason: input.reason }, ip: clientIp(ctx.req),
        });
        return { ok: true };
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  retryRefund: permittedProcedure("refunds:process")
    .input(z.object({ refundCaseId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [rc] = await db.select().from(refundCases).where(eq(refundCases.id, input.refundCaseId)).limit(1);
      if (!rc) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke refusjonssaken." });
      if (!["psp_refund_failed", "amount_confirmed", "supplier_confirmed"].includes(rc.state)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Kan ikke prøve på nytt i tilstand ${rc.state}.` });
      }
      await enqueueJob("process_refund", { refundCaseId: rc.id }, { dedupeKey: `refund:${rc.id}`, priority: 2 });
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: "refund.retried", targetType: "refund_case", targetId: rc.id,
      });
      return { ok: true };
    }),

  /**
   * Manuell fangst (B4): beløpet er fanget i Stripe-dashboardet etter at automatisk
   * fangst feilet (booking i REVIEW). Kjører samme finalisering som orkestratoren:
   * betaling captured, hovedbok, kvittering, booking REVIEW → CONFIRMED.
   * Krever refunds:process + fersk sesjon; revisjonslogges.
   */
  markAttemptCaptured: permittedProcedure("refunds:process")
    .input(z.object({
      attemptId: z.number().int(),
      pspChargeId: z.string().trim().min(3).max(128).optional(),
      confirmFreshSession: z.literal(true),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        if (!sessionIsFresh(ctx.staff!)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Krever nylig innlogging for å bekrefte fangst." });
        }
        const result = await finalizeCapturedAttempt(input.attemptId, { pspChargeId: input.pspChargeId ?? null, actor: `staff:${ctx.staff!.userId}` });
        await logAudit({
          actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
          action: "attempt.marked_captured", targetType: "booking_attempt", targetId: input.attemptId,
          metadata: { pspChargeId: input.pspChargeId ?? null, bookingId: result.bookingId, state: result.state },
          ip: clientIp(ctx.req),
        });
        return { ok: true, ...result };
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  // ─── RUTEENDRINGER, SVINDELFLAGG, GJENNOMGANGSKØ, SESJONER ──────────────

  scheduleChangesList: permittedProcedure("bookings:read")
    .input(z.object({ status: z.enum(["detected", "resolved", "all"]).default("detected") }))
    .query(async ({ input }) => {
      const db = getDb();
      const where = input.status === "all" ? undefined : eq(scheduleChanges.status, input.status);
      const rows = await db
        .select({ sc: scheduleChanges, bookingRef: bookings.bookingReference, email: bookings.contactEmail, bookingState: bookings.state })
        .from(scheduleChanges)
        .innerJoin(bookings, eq(bookings.id, scheduleChanges.bookingId))
        .where(where)
        .orderBy(desc(scheduleChanges.createdAt))
        .limit(100);
      return rows.map((r) => ({
        ...r.sc,
        oldSegments: JSON.parse(r.sc.oldSegmentsJson) as unknown,
        newSegments: JSON.parse(r.sc.newSegmentsJson) as unknown,
        bookingReference: r.bookingRef, customerEmail: maskEmail(r.email), bookingState: r.bookingState,
      }));
    }),

  resolveScheduleChange: permittedProcedure("bookings:write")
    .input(z.object({ id: z.number().int(), resolution: z.enum(["accepted", "rebooked", "refund"]), note: z.string().trim().max(1000).optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [sc] = await db.select().from(scheduleChanges).where(eq(scheduleChanges.id, input.id)).limit(1);
      if (!sc) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke ruteendringen." });
      await db.update(scheduleChanges).set({ status: "resolved", resolvedAt: new Date(), resolvedById: ctx.staff!.userId }).where(eq(scheduleChanges.id, input.id));
      const [booking] = await db.select().from(bookings).where(eq(bookings.id, sc.bookingId)).limit(1);
      if (booking && booking.state === "CHANGE_REQUESTED") {
        if (input.resolution === "refund") {
          await transitionBooking(booking.id, "CANCELLATION_REQUESTED", { type: "staff", id: String(ctx.staff!.userId) }, `Ruteendring: kunden ønsker refusjon${input.note ? ` — ${input.note}` : ""}`);
          await createRefundCase({ bookingId: booking.id, kind: "airline_cancellation", initiatedBy: "staff", requestedById: ctx.staff!.userId, reason: `Ruteendring ikke akseptert: ${input.note ?? "refusjon"}` }).catch(() => null);
        } else {
          await transitionBooking(booking.id, "CONFIRMED", { type: "staff", id: String(ctx.staff!.userId) }, `Ruteendring ${input.resolution}${input.note ? ` — ${input.note}` : ""}`);
        }
      }
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: "schedule_change.resolved", targetType: "schedule_change", targetId: input.id, metadata: { resolution: input.resolution, note: input.note ?? null },
      });
      return { ok: true };
    }),

  fraudFlagsList: permittedProcedure("bookings:read")
    .input(z.object({ status: z.enum(["open", "reviewed", "all"]).default("open") }))
    .query(async ({ input }) => {
      const where = input.status === "all" ? undefined : eq(fraudFlags.status, input.status);
      return getDb().select().from(fraudFlags).where(where).orderBy(desc(fraudFlags.createdAt)).limit(100);
    }),

  reviewFraudFlag: permittedProcedure("bookings:write")
    .input(z.object({ id: z.number().int(), decision: z.enum(["cleared", "confirmed"]), note: z.string().trim().max(255).optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [flag] = await db.select().from(fraudFlags).where(eq(fraudFlags.id, input.id)).limit(1);
      if (!flag) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke flagget." });
      await db.update(fraudFlags).set({ status: "reviewed", reviewedById: ctx.staff!.userId, note: input.note ?? flag.note }).where(eq(fraudFlags.id, input.id));
      if (flag.bookingId && input.decision === "cleared") {
        const [b] = await db.select().from(bookings).where(eq(bookings.id, flag.bookingId)).limit(1);
        if (b?.state === "REVIEW") await transitionBooking(b.id, "CONFIRMED", { type: "staff", id: String(ctx.staff!.userId) }, "Svindelflagg avklart").catch(() => null);
      }
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: `fraud_flag.${input.decision}`, targetType: "fraud_flag", targetId: input.id, metadata: { bookingId: flag.bookingId },
      });
      return { ok: true };
    }),

  /** Alt som trenger et menneske: bookinger i REVIEW/BOOKING_FAILED/AWAITING_RECONCILIATION + fastlåste forsøk. */
  reviewQueue: permittedProcedure("bookings:read").query(async () => {
    const db = getDb();
    const bookingRows = await db
      .select()
      .from(bookings)
      .where(inArray(bookings.state, ["REVIEW", "BOOKING_FAILED", "AWAITING_RECONCILIATION"]))
      .orderBy(desc(bookings.updatedAt))
      .limit(100);
    const attemptRows = await db
      .select({ attempt: bookingAttempts, session: checkoutSessions })
      .from(bookingAttempts)
      .innerJoin(checkoutSessions, eq(checkoutSessions.id, bookingAttempts.checkoutSessionId))
      .where(or(inArray(bookingAttempts.state, ["SUPPLIER_UNKNOWN", "FAILED_VOIDED", "FAILED"]), and(eq(bookingAttempts.state, "SUPPLIER_CONFIRMED"), eq(bookingAttempts.lastErrorCode, "CAPTURE_FAILED"))))
      .orderBy(desc(bookingAttempts.updatedAt))
      .limit(100);
    return {
      bookings: bookingRows.map((b) => ({
        id: b.id, orderId: b.orderId, bookingReference: b.bookingReference, state: b.state, stateLabel: stateLabel(b.state),
        contactEmail: maskEmail(b.contactEmail), totalAmount: b.totalAmount, totalCurrency: b.totalCurrency, liveMode: b.liveMode, updatedAt: b.updatedAt,
      })),
      attempts: attemptRows.map((r) => ({
        id: r.attempt.id, state: r.attempt.state, lastErrorCode: r.attempt.lastErrorCode, lastError: r.attempt.lastError,
        supplierOrderId: r.attempt.supplierOrderId, pspIntentId: r.attempt.pspIntentId, attempts: r.attempt.attempts,
        bookingId: r.attempt.bookingId, updatedAt: r.attempt.updatedAt,
        sessionPublicId: r.session.publicId, contactEmail: maskEmail(r.session.contactEmail),
        totalAmountMinor: r.session.totalAmountMinor, currency: r.session.currency, pspProvider: r.session.pspProvider,
      })),
    };
  }),

  checkoutSessionsList: permittedProcedure("bookings:read")
    .input(z.object({ status: z.string().max(24).optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const where = input?.status ? eq(checkoutSessions.status, input.status) : undefined;
      const rows = await db.select().from(checkoutSessions).where(where).orderBy(desc(checkoutSessions.createdAt)).limit(100);
      return rows.map((s) => ({
        id: s.id, publicId: s.publicId, status: s.status, contactEmail: maskEmail(s.contactEmail), currency: s.currency,
        totalAmountMinor: s.totalAmountMinor, supplierAmountMinor: s.supplierAmountMinor, serviceFeeAmountMinor: s.serviceFeeAmountMinor,
        bonusUsedMinor: s.bonusUsedMinor, pspProvider: s.pspProvider, pspIntentId: s.pspIntentId, paymentMethod: s.paymentMethod,
        bookingId: s.bookingId, lastError: s.lastError, createdAt: s.createdAt, updatedAt: s.updatedAt, expiresAt: s.expiresAt,
      }));
    }),

  attemptEvents: permittedProcedure("bookings:read")
    .input(z.object({ attemptId: z.number().int() }))
    .query(async ({ input }) => {
      return getDb().select().from(bookingAttemptEvents).where(eq(bookingAttemptEvents.attemptId, input.attemptId)).orderBy(asc(bookingAttemptEvents.createdAt));
    }),

  // ─── INNSTILLINGER ────────────────────────────────────────────────────────

  settingsGet: permittedProcedure("settings:manage").query(async () => {
    const rows = await getDb().select().from(settings);
    const map = new Map(rows.map((r) => [r.key, r]));
    return SETTING_KEYS.map((key) => {
      const row = map.get(key);
      return { key, value: row ? (JSON.parse(row.valueJson) as unknown) : null, updatedAt: row?.updatedAt ?? null, updatedById: row?.updatedById ?? null };
    });
  }),

  settingsSet: permittedProcedure("settings:manage")
    .input(z.discriminatedUnion("key", [
      z.object({ key: z.literal("refund.service_fee_policy"), value: z.enum(["keep", "refund"]) }),
      z.object({ key: z.literal("booking.instant_enabled"), value: z.boolean().nullable() }),
      z.object({ key: z.literal("markup.percent"), value: z.number().min(0).max(1).nullable() }),
      z.object({ key: z.literal("markup.flat_minor_by_currency"), value: z.record(z.string().regex(/^[A-Z]{3}$/), z.number().int().nonnegative()).nullable() }),
    ]))
    .mutation(async ({ input, ctx }) => {
      const previous = await getSetting<unknown>(input.key, null);
      await setSetting(input.key, input.value, ctx.staff!.userId);
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: "settings.changed", targetType: "setting", targetId: input.key, metadata: { previous, value: input.value }, ip: clientIp(ctx.req),
      });
      return { ok: true };
    }),

  // ─── BONUS OG HENVISNING (regelmotor) ─────────────────────────────────────
  // Satser og nivåer bor i settings.rewards.rules. Klienten leser dem via
  // account.rewards/referral — ingen kampanje er hardkodet i frontend.

  rewardRulesGet: permittedProcedure("settings:manage").query(async () => {
    const [rules, stored] = await Promise.all([rewardRules(), getSetting<unknown>("rewards.rules", null)]);
    return { rules, isDefault: stored === null, defaults: DEFAULT_REWARD_RULES };
  }),

  rewardRulesSet: permittedProcedure("settings:manage")
    .input(
      z.object({
        bookingEarnFraction: z.number().min(0).max(0.2),
        referralReferrerKr: z.number().int().min(0).max(5000),
        referralReferredKr: z.number().int().min(0).max(5000),
        programName: z.string().trim().min(2).max(40),
        tiers: z
          .array(
            z.object({
              id: z.string().trim().regex(/^[a-z0-9_-]{2,24}$/),
              name: z.string().trim().min(2).max(40),
              minCompletedTrips: z.number().int().min(0).max(200),
              benefits: z.array(z.string().trim().min(1).max(120)).max(8),
            }),
          )
          .min(1)
          .max(5),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (input.tiers[0].minCompletedTrips !== 0) throw new AppError("VALIDATION", { message: "Første nivå må starte på 0 reiser, ellers står nye kunder uten nivå." });
      const previous = await getSetting<unknown>("rewards.rules", null);
      await setSetting("rewards.rules", input, ctx.staff!.userId);
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: "settings.changed", targetType: "setting", targetId: "rewards.rules", metadata: { previous, value: input }, ip: clientIp(ctx.req),
      });
      return { ok: true };
    }),

  // ─── KUNDESERVICE ─────────────────────────────────────────────────────────

  casesList: permittedProcedure("support:read")
    .input(z.object({
      queue: z.enum(["mine", "unassigned", "urgent", "waiting", "all"]).default("all"),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(5).max(100).default(25),
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      let where;
      switch (input.queue) {
        case "mine": where = eq(supportCases.assigneeId, ctx.staff!.userId); break;
        case "unassigned": where = and(isNull(supportCases.assigneeId), inArray(supportCases.status, ["open", "pending_customer"])); break;
        case "urgent": where = and(eq(supportCases.priority, "urgent"), inArray(supportCases.status, ["open", "pending_customer"])); break;
        case "waiting": where = eq(supportCases.status, "pending_customer"); break;
        default: where = undefined;
      }
      const [totalRow] = await db.select({ n: count() }).from(supportCases).where(where);
      const rows = await db
        .select({ supportCase: supportCases, assignee: staffUsers.name })
        .from(supportCases)
        .leftJoin(staffUsers, eq(staffUsers.id, supportCases.assigneeId))
        .where(where)
        .orderBy(desc(supportCases.updatedAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      return {
        total: Number(totalRow?.n ?? 0),
        items: rows.map((r) => ({ ...r.supportCase, assigneeName: r.assignee ?? null })),
      };
    }),

  caseDetail: permittedProcedure("support:read")
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select({ supportCase: supportCases, assignee: staffUsers.name })
        .from(supportCases)
        .leftJoin(staffUsers, eq(staffUsers.id, supportCases.assigneeId))
        .where(eq(supportCases.id, input.id))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke saken." });
      const messages = await db
        .select()
        .from(supportMessages)
        .where(eq(supportMessages.caseId, input.id))
        .orderBy(asc(supportMessages.createdAt));
      const staffList = await db
        .select({ id: staffUsers.id, name: staffUsers.name })
        .from(staffUsers)
        .where(eq(staffUsers.status, "active"));
      return { ...row.supportCase, assigneeName: row.assignee ?? null, messages, staffList };
    }),

  updateCase: permittedProcedure("support:write")
    .input(z.object({
      id: z.number().int(),
      status: z.enum(["open", "pending_customer", "resolved", "closed"]).optional(),
      priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
      assigneeId: z.number().int().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const updates: Record<string, unknown> = {};
      if (input.status) updates.status = input.status;
      if (input.priority) updates.priority = input.priority;
      if (input.assigneeId !== undefined) updates.assigneeId = input.assigneeId;
      if (Object.keys(updates).length === 0) return { ok: true };
      await db.update(supportCases).set(updates).where(eq(supportCases.id, input.id));
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: "case.updated", targetType: "support_case", targetId: input.id,
        metadata: updates as Record<string, unknown>,
      });
      return { ok: true };
    }),

  replyToCase: permittedProcedure("support:write")
    .input(z.object({
      id: z.number().int(),
      message: z.string().trim().min(1).max(4000),
      internal: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [supportCase] = await db.select().from(supportCases).where(eq(supportCases.id, input.id)).limit(1);
      if (!supportCase) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke saken." });
      await db.insert(supportMessages).values({
        caseReference: supportCase.reference,
        caseId: input.id,
        name: ctx.staff!.name,
        email: supportCase.customerEmail,
        topic: "other",
        message: input.message,
        authorType: "staff",
        authorId: ctx.staff!.userId,
        isInternal: input.internal,
      });
      if (!input.internal) {
        await enqueueJob("send_email", {
          kind: "case_reply", caseId: input.id, message: input.message,
        }, { dedupeKey: `case-reply:${input.id}:${Date.now()}` });
        await db.update(supportCases).set({ status: "pending_customer" }).where(eq(supportCases.id, input.id));
      }
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: input.internal ? "case.internal_note" : "case.replied",
        targetType: "support_case", targetId: input.id,
      });
      return { ok: true };
    }),

  createCaseFromBooking: permittedProcedure("support:write")
    .input(z.object({
      bookingId: z.number().int(),
      subject: z.string().trim().min(3).max(160),
      priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [booking] = await db.select().from(bookings).where(eq(bookings.id, input.bookingId)).limit(1);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke bestillingen." });
      const reference = humanReference("RS", 6);
      const result = await db.insert(supportCases).values({
        reference, subject: input.subject, customerEmail: booking.contactEmail,
        bookingId: input.bookingId, priority: input.priority, assigneeId: ctx.staff!.userId,
      });
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: "case.created", targetType: "support_case", targetId: reference,
        metadata: { bookingId: input.bookingId, subject: input.subject },
      });
      return { ok: true, id: Number(result[0].insertId), reference };
    }),


  // ─── MANUELL BESTILLING (selger legger inn på vegne av kunde) ───────────
  // For telefon/WhatsApp/butikk-salg: kunden bestiller ikke selv. Gebyret
  // (8 % + 250 kr) legges på automatisk, og kvittering kan skrives ut.

  createManualBooking: permittedProcedure("bookings:write")
    .input(z.object({
      customerName: z.string().trim().min(1).max(120),
      customerEmail: z.string().email().max(255),
      customerPhone: z.string().trim().max(32).optional(),
      tripType: z.enum(["flight", "hotel", "car", "package"]),
      title: z.string().trim().min(1).max(160),
      description: z.string().trim().max(2000).optional(),
      travelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      baseAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Ugyldig beløp"),
      currency: z.string().length(3).default("NOK"),
      paymentMethod: z.enum(["vipps", "card", "invoice", "cash"]),
      sendReceiptEmail: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const pricing = priceWithServiceFee(input.baseAmount);
      const reference = humanReference("HS", 6);
      const email = input.customerEmail.toLowerCase().trim();

      const existingCustomer = await db.select().from(customers)
        .where(eq(customers.email, email)).limit(1);
      let customerId = existingCustomer[0]?.id;
      if (!customerId) {
        const result = await db.insert(customers).values({
          email, name: input.customerName, phone: input.customerPhone ?? null,
        });
        customerId = Number(result[0].insertId);
      }

      const payload = {
        manual: true,
        tripType: input.tripType,
        title: input.title,
        description: input.description ?? null,
        travelDate: input.travelDate ?? null,
        customerName: input.customerName,
        contactEmail: email,
        contactPhone: input.customerPhone ?? null,
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentMethod === "invoice" ? "pending" : "succeeded",
        supplierAmount: pricing.baseAmount,
        serviceFeeAmount: pricing.serviceFeeAmount,
        totalAmount: pricing.totalAmount,
        currency: input.currency,
        sellerId: ctx.staff!.userId,
        sellerName: ctx.staff!.name,
        createdAt: new Date().toISOString(),
      };

      const bookingResult = await db.insert(bookings).values({
        orderId: `manual_${reference}`,
        bookingReference: reference,
        contactEmail: email,
        contactPhone: input.customerPhone ?? null,
        liveMode: false,
        payload: JSON.stringify(payload),
        state: "CONFIRMED",
        customerId,
        totalAmount: pricing.totalAmount,
        totalCurrency: input.currency,
        source: "manual",
      });
      const bookingId = Number(bookingResult[0].insertId);

      await db.insert(bookingEvents).values({
        bookingId,
        fromState: null,
        toState: "CONFIRMED",
        actorType: "staff",
        actorId: String(ctx.staff!.userId),
        reason: `Manuell bestilling registrert av ${ctx.staff!.name} (${input.paymentMethod})`,
      });

      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: "booking.manual_created", targetType: "booking", targetId: reference,
        metadata: { total: pricing.totalAmount, currency: input.currency, tripType: input.tripType },
        ip: clientIp(ctx.req),
      });

      return { ok: true, bookingId, reference, total: pricing.totalAmount };
    }),

  /** Kvitteringsdata for utskrift (kun manuelle bestillinger). */
  manualReceipt: permittedProcedure("bookings:read")
    .input(z.object({ bookingId: z.number().int() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [booking] = await db.select().from(bookings)
        .where(eq(bookings.id, input.bookingId)).limit(1);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke bestillingen." });
      const payload = JSON.parse(booking.payload) as Record<string, unknown>;
      if (!payload.manual) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Kvittering finnes kun for manuelle bestillinger." });
      }
      return {
        reference: booking.bookingReference,
        createdAt: booking.createdAt,
        state: booking.state,
        payload,
      };
    }),

  // ─── RAPPORTER ────────────────────────────────────────────────────────────

  salesReport: permittedProcedure("reports:read")
    .input(z.object({ days: z.number().int().min(7).max(90).default(30) }))
    .query(async ({ input }) => {
      const db = getDb();
      const since = new Date(Date.now() - input.days * 24 * 60 * 60_000);
      const soldStates = ["CONFIRMED", "TRAVELLED", "CHANGE_REQUESTED", "PARTIALLY_REFUNDED"];
      const byDay = await db
        .select({
          day: sql<string>`DATE(${bookings.createdAt})`,
          currency: bookings.totalCurrency,
          n: count(),
          total: sql<string>`COALESCE(SUM(${bookings.totalAmount}), 0)`,
        })
        .from(bookings)
        .where(and(gte(bookings.createdAt, since), inArray(bookings.state, soldStates)))
        .groupBy(sql`DATE(${bookings.createdAt})`, bookings.totalCurrency)
        .orderBy(sql`DATE(${bookings.createdAt})`);
      const byCurrency = await db
        .select({ currency: bookings.totalCurrency, n: count(), total: sql<string>`COALESCE(SUM(${bookings.totalAmount}), 0)` })
        .from(bookings)
        .where(and(gte(bookings.createdAt, since), inArray(bookings.state, soldStates)))
        .groupBy(bookings.totalCurrency);
      const feeByCurrency = await db
        .select({ currency: checkoutSessions.currency, total: sql<string>`COALESCE(SUM(${checkoutSessions.serviceFeeAmountMinor}), 0)` })
        .from(checkoutSessions)
        .where(and(gte(checkoutSessions.createdAt, since), eq(checkoutSessions.status, "confirmed")))
        .groupBy(checkoutSessions.currency);
      const byState = await db
        .select({ state: bookings.state, n: count() })
        .from(bookings)
        .where(gte(bookings.createdAt, since))
        .groupBy(bookings.state);
      const [feeRow] = await db
        .select({ total: sql<string>`COALESCE(SUM(${quotes.serviceFeeAmount}), 0)` })
        .from(quotes)
        .where(gte(quotes.createdAt, since));
      const [manualFees] = await db
        .select({ total: sql<string>`COALESCE(SUM(JSON_UNQUOTE(JSON_EXTRACT(${bookings.payload}, '$.serviceFeeAmount'))), 0)` })
        .from(bookings)
        .where(and(gte(bookings.createdAt, since), eq(bookings.source, "manual")));
      return {
        byDay: byDay.map((r) => ({ day: String(r.day), currency: r.currency ?? "NOK", bookings: Number(r.n), sales: String(r.total) })),
        totals: byCurrency.map((r) => ({ currency: r.currency ?? "NOK", bookings: Number(r.n), total: String(r.total) })),
        serviceFees: feeByCurrency.map((r) => ({ currency: r.currency, totalMinor: Number(r.total) })),
        byState: byState.map((r) => ({ state: r.state, stateLabel: stateLabel(r.state), count: Number(r.n) })),
        quoteFees: String(feeRow?.total ?? "0"),
        manualFees: String(manualFees?.total ?? "0"),
      };
    }),

  // ─── AKTIVITETSLOGG ───────────────────────────────────────────────────────

  auditList: permittedProcedure("audit:read")
    .input(z.object({
      action: z.string().max(64).optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(10).max(100).default(50),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const where = input.action ? like(auditLogs.action, `${input.action}%`) : undefined;
      const [totalRow] = await db.select({ n: count() }).from(auditLogs).where(where);
      const rows = await db
        .select()
        .from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      return { total: Number(totalRow?.n ?? 0), items: rows };
    }),

  // ─── SYSTEM: jobber, webhooks, status ─────────────────────────────────────

  jobsList: permittedProcedure("jobs:manage")
    .input(z.object({ status: z.enum(["failed", "dead", "pending", "done"]).default("dead") }))
    .query(async ({ input }) => {
      const rows = await getDb()
        .select()
        .from(jobs)
        .where(eq(jobs.status, input.status))
        .orderBy(desc(jobs.updatedAt))
        .limit(50);
      return rows;
    }),

  retryJobAction: permittedProcedure("jobs:manage")
    .input(z.object({ jobId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      await retryJob(input.jobId);
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: "job.retried", targetType: "job", targetId: input.jobId,
      });
      return { ok: true };
    }),

  webhookEventsList: permittedProcedure("settings:manage").query(async () => {
    return getDb().select().from(webhookEvents).orderBy(desc(webhookEvents.createdAt)).limit(50);
  }),

  systemStatus: staffProcedure.query(() => ({
    environment: env.APP_ENV,
    duffelConfigured: duffelConfig.configured,
    duffelLive: duffelConfig.liveMode,
    stripeConfigured: env.stripeConfigured,
    stripeWebhookConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET),
    smtpConfigured: env.smtpConfigured,
    webhookConfigured: Boolean(env.DUFFEL_WEBHOOK_SECRET),
    publicInstantBooking: env.instantBookingEnabled,
    piiEncryptionConfigured: Boolean(env.PII_ENCRYPTION_KEY),
    maxDailyLiveAmountMinor: env.MAX_DAILY_LIVE_AMOUNT_MINOR,
    appBaseUrl: env.APP_BASE_URL ?? null,
  })),
});

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  return `${"*".repeat(phone.length - 2)}${phone.slice(-2)}`;
}
