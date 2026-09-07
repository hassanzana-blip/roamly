import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { createRouter, customerProcedure, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { consents, priceAlerts, savedTravelers } from "../db/schema";
import { assertRateLimit, clientIp } from "./lib/ratelimit";
import { AppError } from "./lib/errors";
import { normalizeName } from "./lib/validation";

// OTA-162: «Hold prisen i 24 timer» (createHold/getHold) er fjernet. Duffel-
// tilbud utløper etter minutter, og en «holdt pris» uten leverandørgaranti er
// villedende markedsføring. Tabellen booking_holds beholdes kun for historikk.

const CONSENT_VERSION = "2026-09";
const IATA = z.string().trim().length(3).regex(/^[A-Za-z]{3}$/);
const MAX_ALERTS_PER_EMAIL = 20;

export const extrasRouter = createRouter({
  // ─── Prisvarsler ─────────────────────────────────────────────────────────
  createPriceAlert: publicQuery
    .input(
      z.object({
        origin: IATA,
        destination: IATA,
        departDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        targetPrice: z.number().int().min(100).max(100_000),
        email: z.string().email().max(255).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const ip = clientIp(ctx.req);
      assertRateLimit("price-alert", ip, 5, 60_000);
      const email = (input.email ?? ctx.customer?.email ?? "").toLowerCase().trim();
      if (!email) {
        throw new AppError("VALIDATION", { message: "Vi trenger en e-postadresse for å sende varselet.", data: { field: "email" } });
      }
      // Innloggede kunder kan bare opprette varsler til sin egen e-post
      if (ctx.customer?.email && email !== ctx.customer.email) {
        throw new AppError("VALIDATION", { message: "Varselet må gå til e-postadressen på kontoen din.", data: { field: "email" } });
      }
      if (input.departDate < new Date().toISOString().slice(0, 10)) {
        throw new AppError("VALIDATION", { message: "Avreisedatoen har passert.", data: { field: "departDate" } });
      }
      const db = getDb();
      const [count] = await db
        .select({ n: sql<number>`count(*)` })
        .from(priceAlerts)
        .where(and(eq(priceAlerts.email, email), eq(priceAlerts.active, true)));
      if (Number(count?.n ?? 0) >= MAX_ALERTS_PER_EMAIL) {
        throw new AppError("VALIDATION", { message: `Du kan ha maks ${MAX_ALERTS_PER_EMAIL} aktive prisvarsler.` });
      }
      const result = await db.insert(priceAlerts).values({
        customerId: ctx.customer?.customerId ?? null,
        email,
        originIata: input.origin.toUpperCase(),
        destinationIata: input.destination.toUpperCase(),
        departDate: input.departDate,
        targetPrice: input.targetPrice,
      });
      // Samtykke til prisvarsel på e-post (markedsføringslovens § 15) — dokumenteres
      await db.insert(consents).values({
        customerAccountId: ctx.customer?.customerId ?? null,
        email,
        type: "price_alert",
        version: CONSENT_VERSION,
        granted: true,
        source: ctx.customer ? "price_alert_form_auth" : "price_alert_form",
        ip,
      });
      return { id: Number(result[0].insertId) };
    }),

  myPriceAlerts: customerProcedure.query(async ({ ctx }) => {
    const rows = await getDb()
      .select()
      .from(priceAlerts)
      .where(and(eq(priceAlerts.customerId, ctx.customer.customerId), eq(priceAlerts.active, true)))
      .orderBy(desc(priceAlerts.createdAt))
      .limit(MAX_ALERTS_PER_EMAIL);
    return rows.map((r) => ({
      id: r.id,
      originIata: r.originIata,
      destinationIata: r.destinationIata,
      departDate: r.departDate,
      targetPrice: r.targetPrice,
      createdAt: r.createdAt.toISOString(),
    }));
  }),

  deletePriceAlert: customerProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const result = await getDb()
        .update(priceAlerts)
        .set({ active: false })
        .where(and(eq(priceAlerts.id, input.id), eq(priceAlerts.customerId, ctx.customer.customerId)));
      if (Number(result[0].affectedRows) === 0) throw new AppError("NOT_FOUND");
      return { ok: true };
    }),

  // ─── Lagrede reisende ────────────────────────────────────────────────────
  myTravelers: customerProcedure.query(async ({ ctx }) => {
    const rows = await getDb()
      .select()
      .from(savedTravelers)
      .where(eq(savedTravelers.customerId, ctx.customer.customerId))
      .orderBy(desc(savedTravelers.createdAt))
      .limit(20);
    return rows;
  }),

  addTraveler: customerProcedure
    .input(
      z.object({
        firstName: z.string().trim().min(1).max(60),
        lastName: z.string().trim().min(1).max(60),
        bornOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        gender: z.enum(["m", "f"]).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const firstName = normalizeName(input.firstName);
      const lastName = normalizeName(input.lastName);
      if (!firstName || !lastName) {
        throw new AppError("VALIDATION", { message: "Navn må fylles ut med bokstaver.", data: { field: "firstName" } });
      }
      const db = getDb();
      const [count] = await db
        .select({ n: sql<number>`count(*)` })
        .from(savedTravelers)
        .where(eq(savedTravelers.customerId, ctx.customer.customerId));
      if (Number(count?.n ?? 0) >= 20) {
        throw new AppError("VALIDATION", { message: "Du kan lagre maks 20 reisende." });
      }
      const result = await db.insert(savedTravelers).values({
        customerId: ctx.customer.customerId,
        firstName,
        lastName,
        bornOn: input.bornOn ?? null,
        gender: input.gender ?? null,
      });
      return { id: Number(result[0].insertId) };
    }),

  deleteTraveler: customerProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const result = await getDb()
        .delete(savedTravelers)
        .where(and(eq(savedTravelers.id, input.id), eq(savedTravelers.customerId, ctx.customer.customerId)));
      if (Number(result[0].affectedRows) === 0) throw new AppError("NOT_FOUND");
      return { ok: true };
    }),
});
