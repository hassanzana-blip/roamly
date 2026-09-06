import { z } from "zod";
import { and, asc, desc, eq, gte, like, or, sql, count, isNull, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, permittedProcedure, staffProcedure } from "./middleware";
import { getDb } from "./queries/connection";
import {
  auditLogs,
  bookingEvents,
  bookingSegments,
  bookings,
  customers,
  internalNotes,
  jobs,
  payments,
  quotes,
  refunds,
  staffUsers,
  supportCases,
  supportMessages,
  webhookEvents,
} from "../db/schema";
import { assertTransition, STATE_LABELS, type BookingState } from "./lib/statemachine";
import { addAmounts } from "./lib/money";
import { enqueueJob, retryJob } from "./lib/jobs";
import { logAudit } from "./lib/audit";
import { humanReference } from "./lib/tokens";
import { sessionIsFresh } from "./lib/sessions";
import { clientIp } from "./lib/ratelimit";
import { randomToken, sha256Hex } from "./lib/tokens";
import { duffelGetOffer } from "./lib/duffel";
import { demoGetOffer } from "./lib/demo";
import { duffelConfig } from "./lib/duffel";

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
      .select({ total: sql<string>`COALESCE(SUM(${bookings.totalAmount}), 0)` })
      .from(bookings)
      .where(and(gte(bookings.createdAt, weekStart), eq(bookings.state, "CONFIRMED")));

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
      .from(refunds)
      .where(eq(refunds.status, "requested"));
    const [deadJobs] = await db.select({ n: count() }).from(jobs).where(eq(jobs.status, "dead"));
    const [failedWebhooks] = await db
      .select({ n: count() })
      .from(webhookEvents)
      .where(eq(webhookEvents.status, "failed"));

    const recentActivity = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(12);

    return {
      bookingsToday: today,
      bookingsThisWeek: thisWeek,
      confirmedSalesWeek: salesRows[0]?.total ?? "0",
      awaitingPayment, processing, reconciliation, failed,
      departures24h: Number(departures24[0]?.n ?? 0),
      departures72h: Number(departures72[0]?.n ?? 0),
      unassignedCases: Number(unassignedCases?.n ?? 0),
      pendingRefunds: Number(pendingRefunds?.n ?? 0),
      deadJobs: Number(deadJobs?.n ?? 0),
      failedWebhooks: Number(failedWebhooks?.n ?? 0),
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
        const term = `%${input.query}%`;
        conditions.push(or(
          like(bookings.bookingReference, term),
          like(bookings.orderId, term),
          like(bookings.contactEmail, term),
          like(bookings.contactPhone, term),
          like(bookings.payload, term),
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

      const refundRows = paymentRows.length > 0
        ? await db.select().from(refunds).where(inArray(refunds.paymentId, paymentRows.map((p) => p.id)))
        : [];

      return {
        booking: {
          id: booking.id, orderId: booking.orderId, bookingReference: booking.bookingReference,
          state: booking.state, stateLabel: stateLabel(booking.state), liveMode: booking.liveMode,
          contactEmail: booking.contactEmail, contactPhone: booking.contactPhone,
          totalAmount: booking.totalAmount, totalCurrency: booking.totalCurrency,
          source: booking.source, createdAt: booking.createdAt,
          lastReconciledAt: booking.lastReconciledAt,
          payload: JSON.parse(booking.payload),
        },
        events: events.map((e) => ({
          id: e.id, fromState: e.fromState ? stateLabel(e.fromState) : null,
          toState: stateLabel(e.toState), actorType: e.actorType, reason: e.reason, createdAt: e.createdAt,
        })),
        segments,
        payments: paymentRows,
        refunds: refundRows,
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
      toState: z.enum(["CHANGE_REQUESTED", "CANCELLATION_REQUESTED", "CANCELLED", "REFUND_PENDING", "CONFIRMED"]),
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
      serviceFeeAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
      expiresInHours: z.number().int().min(1).max(168).default(24),
    }))
    .mutation(async ({ input, ctx }) => {
      const offer = await resolveOfferForQuote(input.offerId);
      const total = addAmounts(offer.totalAmount, input.serviceFeeAmount);
      const token = randomToken(32);
      const reference = humanReference("RT", 6);
      const db = getDb();
      const result = await db.insert(quotes).values({
        reference,
        createdById: ctx.staff!.userId,
        customerName: input.customerName,
        customerEmail: input.customerEmail.toLowerCase().trim(),
        customerPhone: input.customerPhone ?? null,
        offerId: input.offerId,
        offerSnapshot: JSON.stringify(offer),
        serviceFeeAmount: input.serviceFeeAmount,
        totalAmount: total,
        currency: offer.totalCurrency,
        status: "draft",
        checkoutTokenHash: sha256Hex(token),
        expiresAt: new Date(Date.now() + input.expiresInHours * 60 * 60_000),
      });
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: "quote.created", targetType: "quote", targetId: reference,
        metadata: { offerId: input.offerId, total, currency: offer.totalCurrency },
      });
      return {
        id: Number(result[0].insertId), reference, total,
        checkoutPath: `/tilbud/${token}`,
      };
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
        currency: quote.currency, status: "captured", note: input.note,
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

  refundsList: permittedProcedure("payments:read").query(async () => {
    const db = getDb();
    const rows = await db
      .select({ refund: refunds, payment: payments, requester: staffUsers.name })
      .from(refunds)
      .innerJoin(payments, eq(payments.id, refunds.paymentId))
      .leftJoin(staffUsers, eq(staffUsers.id, refunds.requestedById))
      .orderBy(desc(refunds.createdAt))
      .limit(100);
    return rows.map((r) => ({ ...r.refund, payment: r.payment, requesterName: r.requester ?? "Ukjent" }));
  }),

  requestRefund: permittedProcedure("refunds:request")
    .input(z.object({
      paymentId: z.number().int(),
      amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
      reason: z.string().trim().min(10).max(1000),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [payment] = await db.select().from(payments).where(eq(payments.id, input.paymentId)).limit(1);
      if (!payment) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke betalingen." });
      if (Number(input.amount) <= 0 || Number(input.amount) > Number(payment.amount)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Beløpet må være mellom 0 og ${payment.amount} ${payment.currency}.` });
      }
      await db.insert(refunds).values({
        paymentId: input.paymentId, amount: input.amount,
        reason: input.reason, requestedById: ctx.staff!.userId,
      });
      if (payment.bookingId) {
        await transitionBooking(payment.bookingId, "REFUND_PENDING",
          { type: "staff", id: String(ctx.staff!.userId) }, `Refusjon forespurt: ${input.reason}`).catch(() => {});
      }
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: "refund.requested", targetType: "payment", targetId: input.paymentId,
        metadata: { amount: input.amount, currency: payment.currency, reason: input.reason },
        ip: clientIp(ctx.req),
      });
      return { ok: true };
    }),

  processRefund: permittedProcedure("refunds:process")
    .input(z.object({
      refundId: z.number().int(),
      decision: z.enum(["processed", "rejected"]),
      confirmFreshSession: z.literal(true),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!sessionIsFresh(ctx.staff!)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Krever nylig innlogging for å behandle refusjoner." });
      }
      const db = getDb();
      const [refund] = await db.select().from(refunds).where(eq(refunds.id, input.refundId)).limit(1);
      if (!refund) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke refusjonen." });
      if (refund.status !== "requested") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Refusjonen er allerede behandlet." });
      }
      await db.update(refunds)
        .set({ status: input.decision, processedById: ctx.staff!.userId, processedAt: new Date() })
        .where(eq(refunds.id, input.refundId));

      const [payment] = await db.select().from(payments).where(eq(payments.id, refund.paymentId)).limit(1);
      if (input.decision === "processed" && payment) {
        const isFull = Number(refund.amount) >= Number(payment.amount);
        await db.update(payments)
          .set({ status: isFull ? "refunded" : "partially_refunded" })
          .where(eq(payments.id, payment.id));
        if (payment.bookingId) {
          await transitionBooking(payment.bookingId, isFull ? "REFUNDED" : "PARTIALLY_REFUNDED",
            { type: "staff", id: String(ctx.staff!.userId) }, `Refusjon ${refund.amount} ${payment.currency} behandlet`).catch(() => {});
        }
      }
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: `refund.${input.decision}`, targetType: "refund", targetId: input.refundId,
        metadata: { amount: refund.amount }, ip: clientIp(ctx.req),
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

  // ─── RAPPORTER ────────────────────────────────────────────────────────────

  salesReport: permittedProcedure("reports:read")
    .input(z.object({ days: z.number().int().min(7).max(90).default(30) }))
    .query(async ({ input }) => {
      const db = getDb();
      const since = new Date(Date.now() - input.days * 24 * 60 * 60_000);
      const byDay = await db
        .select({
          day: sql<string>`DATE(${bookings.createdAt})`,
          n: count(),
          total: sql<string>`COALESCE(SUM(${bookings.totalAmount}), 0)`,
        })
        .from(bookings)
        .where(and(gte(bookings.createdAt, since), eq(bookings.state, "CONFIRMED")))
        .groupBy(sql`DATE(${bookings.createdAt})`)
        .orderBy(sql`DATE(${bookings.createdAt})`);
      const byState = await db
        .select({ state: bookings.state, n: count() })
        .from(bookings)
        .where(gte(bookings.createdAt, since))
        .groupBy(bookings.state);
      return {
        byDay: byDay.map((r) => ({ day: String(r.day), bookings: Number(r.n), sales: String(r.total) })),
        byState: byState.map((r) => ({ state: r.state, stateLabel: stateLabel(r.state), count: Number(r.n) })),
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
    environment: process.env.APP_ENV ?? (process.env.NODE_ENV === "production" ? "production" : "development"),
    duffelConfigured: duffelConfig.configured,
    duffelLive: duffelConfig.liveMode,
    smtpConfigured: Boolean(process.env.SMTP_URL ?? process.env.SMTP_HOST),
    webhookConfigured: Boolean(process.env.DUFFEL_WEBHOOK_SECRET),
    publicInstantBooking: process.env.PUBLIC_INSTANT_BOOKING !== "false",
    appBaseUrl: process.env.APP_BASE_URL ?? null,
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
