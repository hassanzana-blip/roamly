import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { createRouter, customerProcedure } from "./middleware";
import { getDb } from "./queries/connection";
import { customerDocumentBlobs, customerDocuments, tripPlans, DOCUMENT_KINDS } from "../db/schema";
import { AppError } from "./lib/errors";
import { logAudit } from "./lib/audit";
import { clientIp } from "./lib/ratelimit";

/**
 * Kundens private reisedokumenter – metadata via tRPC, bytes via egne
 * HTTP-ruter (api/documentsHttp.ts) fordi tRPC-kroppen er begrenset til 1 MB.
 * Hver spørring filtrerer på kundens id; det finnes ingen vei til et dokument
 * som ikke er ditt. Ingen filinnhold eller referanser logges.
 */

const KIND = z.enum(DOCUMENT_KINDS);

export function documentView(d: typeof customerDocuments.$inferSelect) {
  return {
    id: d.id,
    tripPlanId: d.tripPlanId,
    bookingId: d.bookingId,
    kind: d.kind as (typeof DOCUMENT_KINDS)[number],
    title: d.title,
    fileName: d.fileName,
    mime: d.mime,
    bytes: d.bytes,
    source: d.source as "manual" | "booking",
    travelDate: d.travelDate,
    createdAt: d.createdAt,
    /** Åpnes i ny fane; nedlasting med ?download=1. Krever kundens sesjonscookie. */
    href: `/api/documents/${d.id}`,
  };
}

export const documentsRouter = createRouter({
  list: customerProcedure
    .input(z.object({ tripPlanId: z.number().int().positive().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const where = input?.tripPlanId
        ? and(eq(customerDocuments.customerId, ctx.customer.customerId), eq(customerDocuments.tripPlanId, input.tripPlanId))
        : eq(customerDocuments.customerId, ctx.customer.customerId);
      const rows = await getDb().select().from(customerDocuments).where(where).orderBy(desc(customerDocuments.createdAt)).limit(200);
      return rows.map(documentView);
    }),

  update: customerProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        title: z.string().trim().min(1).max(120).optional(),
        kind: KIND.optional(),
        tripPlanId: z.number().int().positive().nullable().optional(),
        travelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [doc] = await db.select().from(customerDocuments).where(and(eq(customerDocuments.id, input.id), eq(customerDocuments.customerId, ctx.customer.customerId))).limit(1);
      if (!doc) throw new AppError("NOT_FOUND", { message: "Dokumentet finnes ikke." });
      if (input.tripPlanId) {
        const [plan] = await db.select({ id: tripPlans.id }).from(tripPlans).where(and(eq(tripPlans.id, input.tripPlanId), eq(tripPlans.customerId, ctx.customer.customerId))).limit(1);
        if (!plan) throw new AppError("NOT_FOUND", { message: "Reiseplanen finnes ikke." });
      }
      await db
        .update(customerDocuments)
        .set({
          title: input.title ?? doc.title,
          kind: input.kind ?? doc.kind,
          tripPlanId: input.tripPlanId === undefined ? doc.tripPlanId : input.tripPlanId,
          travelDate: input.travelDate === undefined ? doc.travelDate : input.travelDate,
        })
        .where(eq(customerDocuments.id, doc.id));
      const [fresh] = await db.select().from(customerDocuments).where(eq(customerDocuments.id, doc.id)).limit(1);
      return documentView(fresh!);
    }),

  remove: customerProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    const [doc] = await db.select({ id: customerDocuments.id }).from(customerDocuments).where(and(eq(customerDocuments.id, input.id), eq(customerDocuments.customerId, ctx.customer.customerId))).limit(1);
    if (!doc) throw new AppError("NOT_FOUND", { message: "Dokumentet finnes ikke." });
    await db.transaction(async (tx) => {
      await tx.delete(customerDocumentBlobs).where(eq(customerDocumentBlobs.documentId, doc.id));
      await tx.delete(customerDocuments).where(eq(customerDocuments.id, doc.id));
    });
    await logAudit({ actorType: "customer", actorId: ctx.customer.customerId, action: "document.deleted", targetType: "customer_document", targetId: doc.id, ip: clientIp(ctx.req) });
    return { ok: true };
  }),
});
