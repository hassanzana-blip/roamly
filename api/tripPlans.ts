import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { createRouter, customerProcedure } from "./middleware";
import { getDb } from "./queries/connection";
import { bookings, customerDocuments, tripPlans, travelGroupMembers, TRIP_PLAN_STATUSES } from "../db/schema";
import { AppError } from "./lib/errors";
import { assertRateLimit } from "./lib/ratelimit";
import { logAudit } from "./lib/audit";
import { ALL_DESTINATIONS } from "../src/content/discover";

/**
 * Reiseplaner – «Din neste reiseidé» på Min side.
 *
 * En plan er kundens egen: reisemål, kanskje datoer og reisefølge, kanskje en
 * gruppe. Statusen «bestilt» settes bare når kunden kobler planen til en ekte
 * bestilling hos oss – aldri fordi hen klikket seg videre til en leverandør.
 */

const MAX_PLANS = 40;
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const DEST = z.string().regex(/^[a-z0-9-]{2,40}$/);
const IATA = z.string().regex(/^[A-Z]{3}$/);

function destinationOf(id: string | null) {
  return id ? ALL_DESTINATIONS.find((d) => d.id === id) ?? null : null;
}

async function loadOwnPlan(customerId: number, id: number) {
  const [plan] = await getDb().select().from(tripPlans).where(and(eq(tripPlans.id, id), eq(tripPlans.customerId, customerId))).limit(1);
  if (!plan) throw new AppError("NOT_FOUND", { message: "Reiseplanen finnes ikke." });
  return plan;
}

export function planView(p: typeof tripPlans.$inferSelect, documentCount = 0) {
  const d = destinationOf(p.destinationId);
  return {
    id: p.id,
    title: p.title,
    destinationId: p.destinationId,
    destination: d ? { id: d.id, city: d.city, country: d.country, iata: d.iata, image: d.image ?? null, imageAlt: d.imageAlt } : null,
    originIata: p.originIata,
    destinationIata: p.destinationIata ?? d?.iata ?? null,
    dateFrom: p.dateFrom,
    dateTo: p.dateTo,
    adults: p.adults,
    children: p.children,
    status: p.status as (typeof TRIP_PLAN_STATUSES)[number],
    /** Sant først når en bestilling hos oss er koblet til. */
    booked: p.status === "booked" && p.bookingId !== null,
    bookingId: p.bookingId,
    groupId: p.groupId,
    note: p.note,
    documentCount,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export const tripPlansRouter = createRouter({
  /** Aktive planer, nyeste først. Arkiverte holdes utenfor. */
  list: customerProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const plans = await db
      .select()
      .from(tripPlans)
      .where(and(eq(tripPlans.customerId, ctx.customer.customerId), isNull(tripPlans.archivedAt)))
      .orderBy(desc(tripPlans.updatedAt))
      .limit(MAX_PLANS);
    const docs = await db
      .select({ planId: customerDocuments.tripPlanId })
      .from(customerDocuments)
      .where(eq(customerDocuments.customerId, ctx.customer.customerId));
    const counts = new Map<number, number>();
    for (const d of docs) if (d.planId != null) counts.set(d.planId, (counts.get(d.planId) ?? 0) + 1);
    return plans.map((p) => planView(p, counts.get(p.id) ?? 0));
  }),

  get: customerProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input, ctx }) => {
    const plan = await loadOwnPlan(ctx.customer.customerId, input.id);
    const [{ n } = { n: 0 }] = await getDb()
      .select({ n: customerDocuments.id })
      .from(customerDocuments)
      .where(and(eq(customerDocuments.tripPlanId, plan.id), eq(customerDocuments.customerId, ctx.customer.customerId)))
      .then((rows) => [{ n: rows.length }]);
    return planView(plan, n);
  }),

  create: customerProcedure
    .input(
      z.object({
        destinationId: DEST.optional(),
        title: z.string().trim().min(1).max(80).optional(),
        originIata: IATA.optional(),
        destinationIata: IATA.optional(),
        dateFrom: DATE.optional(),
        dateTo: DATE.optional(),
        adults: z.number().int().min(1).max(9).optional(),
        children: z.number().int().min(0).max(8).optional(),
        groupId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const customerId = ctx.customer.customerId;
      assertRateLimit("tripplan-create", String(customerId), 30, 60 * 60_000);
      const db = getDb();
      const existing = await db.select({ id: tripPlans.id }).from(tripPlans).where(and(eq(tripPlans.customerId, customerId), isNull(tripPlans.archivedAt)));
      if (existing.length >= MAX_PLANS) throw new AppError("VALIDATION", { message: `Du kan ha inntil ${MAX_PLANS} aktive reiseplaner. Arkiver noen først.` });
      const d = destinationOf(input.destinationId ?? null);
      if (input.destinationId && !d) throw new AppError("VALIDATION", { message: "Ukjent reisemål.", data: { field: "destinationId" } });
      if (input.dateFrom && input.dateTo && input.dateTo < input.dateFrom) throw new AppError("VALIDATION", { message: "Hjemreise må være etter avreise.", data: { field: "dateTo" } });
      if (input.groupId) {
        const [m] = await db.select({ id: travelGroupMembers.id }).from(travelGroupMembers).where(and(eq(travelGroupMembers.groupId, input.groupId), eq(travelGroupMembers.customerId, customerId), isNull(travelGroupMembers.leftAt))).limit(1);
        if (!m) throw new AppError("FORBIDDEN", { message: "Du er ikke medlem i den gruppen." });
      }
      const title = input.title ?? (d ? d.city : "Ny reiseidé");
      const result = await db.insert(tripPlans).values({
        customerId,
        title,
        destinationId: d?.id ?? null,
        originIata: input.originIata ?? "OSL",
        destinationIata: input.destinationIata ?? d?.iata ?? null,
        dateFrom: input.dateFrom ?? null,
        dateTo: input.dateTo ?? null,
        adults: input.adults ?? 1,
        children: input.children ?? 0,
        status: input.dateFrom ? "planned" : "idea",
        groupId: input.groupId ?? null,
      });
      const id = Number(result[0].insertId);
      await logAudit({ actorType: "customer", actorId: customerId, action: "tripplan.created", targetType: "trip_plan", targetId: id });
      return planView(await loadOwnPlan(customerId, id));
    }),

  update: customerProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        title: z.string().trim().min(1).max(80).optional(),
        dateFrom: DATE.nullable().optional(),
        dateTo: DATE.nullable().optional(),
        adults: z.number().int().min(1).max(9).optional(),
        children: z.number().int().min(0).max(8).optional(),
        originIata: IATA.optional(),
        note: z.string().trim().max(500).nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const plan = await loadOwnPlan(ctx.customer.customerId, input.id);
      const dateFrom = input.dateFrom === undefined ? plan.dateFrom : input.dateFrom;
      const dateTo = input.dateTo === undefined ? plan.dateTo : input.dateTo;
      if (dateFrom && dateTo && dateTo < dateFrom) throw new AppError("VALIDATION", { message: "Hjemreise må være etter avreise.", data: { field: "dateTo" } });
      // Statusen følger datoene bare så lenge planen ikke er bestilt eller gjennomført.
      const status = plan.status === "booked" || plan.status === "done" ? plan.status : dateFrom ? "planned" : "idea";
      await getDb()
        .update(tripPlans)
        .set({
          title: input.title ?? plan.title,
          dateFrom,
          dateTo,
          adults: input.adults ?? plan.adults,
          children: input.children ?? plan.children,
          originIata: input.originIata ?? plan.originIata,
          note: input.note === undefined ? plan.note : input.note,
          status,
        })
        .where(eq(tripPlans.id, plan.id));
      return planView(await loadOwnPlan(ctx.customer.customerId, plan.id));
    }),

  /** Koble planen til en av kundens egne bestillinger – det eneste som gjør den «bestilt». */
  linkBooking: customerProcedure
    .input(z.object({ id: z.number().int().positive(), bookingId: z.number().int().positive().nullable() }))
    .mutation(async ({ input, ctx }) => {
      const plan = await loadOwnPlan(ctx.customer.customerId, input.id);
      const db = getDb();
      if (input.bookingId !== null) {
        const [b] = await db.select({ id: bookings.id, customerAccountId: bookings.customerAccountId }).from(bookings).where(eq(bookings.id, input.bookingId)).limit(1);
        if (!b || b.customerAccountId !== ctx.customer.customerId) throw new AppError("NOT_FOUND", { message: "Fant ingen bestilling å koble til." });
      }
      await db
        .update(tripPlans)
        .set({ bookingId: input.bookingId, status: input.bookingId ? "booked" : plan.dateFrom ? "planned" : "idea" })
        .where(eq(tripPlans.id, plan.id));
      return planView(await loadOwnPlan(ctx.customer.customerId, plan.id));
    }),

  archive: customerProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const plan = await loadOwnPlan(ctx.customer.customerId, input.id);
    await getDb().update(tripPlans).set({ archivedAt: new Date() }).where(eq(tripPlans.id, plan.id));
    return { ok: true };
  }),
});
