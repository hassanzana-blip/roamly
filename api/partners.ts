import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { createRouter, permittedProcedure, publicQuery } from "./middleware";
import { AppError } from "./lib/errors";
import { getDb } from "./queries/connection";
import { partnerRequests } from "../db/schema";
import { assertRateLimit, clientIp } from "./lib/ratelimit";
import { logAudit } from "./lib/audit";
import { sendOpsAlert } from "./lib/mailer";
import { searchHotels, searchCars, type CarResult, type HotelResult } from "../contracts/stay";

/**
 * Katalogen er demodata (OTA-160). Vi viser ALDRI fabrikkerte «rating»,
 * «reviews» eller «gratis avbestilling» til kunden — kun veiledende pris og
 * fakta som vi faktisk kan stå inne for. Feltene strippes her siden
 * contracts/stay.ts deles med andre og ikke endres i denne omgangen.
 */
const PARTNER_NOTE = "Veiledende — vi sender forespørsel til partner";

function stripHotel(h: HotelResult): Omit<HotelResult, "rating" | "reviews" | "freeCancellation"> & { note: string } {
  const rest: Partial<HotelResult> = { ...h };
  delete rest.rating;
  delete rest.reviews;
  delete rest.freeCancellation;
  return { ...(rest as Omit<HotelResult, "rating" | "reviews" | "freeCancellation">), note: PARTNER_NOTE };
}

function stripCar(c: CarResult): Omit<CarResult, "freeCancellation"> & { note: string } {
  const rest: Partial<CarResult> = { ...c };
  delete rest.freeCancellation;
  return { ...(rest as Omit<CarResult, "freeCancellation">), note: PARTNER_NOTE };
}

const PARTNER_TYPES = ["hotel", "car"] as const;
const PARTNER_STATUSES = ["new", "in_progress", "done", "cancelled"] as const;

const requestSchema = z.object({
  type: z.enum(PARTNER_TYPES),
  partner: z.string().trim().max(40).optional(),
  customerName: z.string().trim().min(1).max(120),
  customerEmail: z.string().email().max(255),
  customerPhone: z.string().trim().max(32).optional(),
  // Fritekst-detaljer fra skjemaet (by, datoer, antall, ønsker …)
  details: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
  // Honeypot — skal alltid være tom
  website: z.string().max(0).optional(),
});

/** Hotell- og bilutleieforespørsler via partnere (Europcar, Hertz m.fl.). */
export const partnersRouter = createRouter({
  // ─── Søk i katalogen (demomodus — deterministiske, veiledende priser) ─────

  searchHotels: publicQuery
    .input(
      z.object({
        place: z.string().trim().min(2).max(80),
        checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        guests: z.number().int().min(1).max(8).default(2),
      }),
    )
    .query(({ input, ctx }) => {
      assertRateLimit("hotel-search", clientIp(ctx.req), 30, 60_000);
      assertRateLimit("hotel-search-hourly", clientIp(ctx.req), 300, 60 * 60_000);
      if (input.checkout <= input.checkin) {
        throw new AppError("VALIDATION", { message: "Utsjekk må være etter innsjekk.", data: { field: "checkout" } });
      }
      return {
        demoMode: true,
        note: PARTNER_NOTE,
        results: searchHotels(input.place, input.checkin, input.checkout, input.guests).map(stripHotel),
      };
    }),

  searchCars: publicQuery
    .input(
      z.object({
        place: z.string().trim().min(2).max(80),
        pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .query(({ input, ctx }) => {
      assertRateLimit("car-search", clientIp(ctx.req), 30, 60_000);
      assertRateLimit("car-search-hourly", clientIp(ctx.req), 300, 60 * 60_000);
      if (input.returnDate < input.pickupDate) {
        throw new AppError("VALIDATION", { message: "Leveringsdato må være etter hentedato.", data: { field: "returnDate" } });
      }
      return {
        demoMode: true,
        note: PARTNER_NOTE,
        results: searchCars(input.place, input.pickupDate, input.returnDate).map(stripCar),
      };
    }),

  // ─── Offentlig forespørsel fra kundesiden ────────────────────────────────

  submitRequest: publicQuery.input(requestSchema).mutation(async ({ input, ctx }) => {
    assertRateLimit("partner-request", clientIp(ctx.req), 6, 60 * 60_000);
    if (input.website) return { ok: true }; // honeypot — lat som alt gikk bra
    const db = getDb();
    // Begrens størrelse/antall felter i fritekstdetaljene
    const details: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(input.details).slice(0, 30)) {
      details[k.slice(0, 40)] = typeof v === "string" ? v.slice(0, 500) : v;
    }
    await db.insert(partnerRequests).values({
      type: input.type,
      partner: input.partner ?? null,
      customerName: input.customerName,
      customerEmail: input.customerEmail.toLowerCase().trim(),
      customerPhone: input.customerPhone ?? null,
      detailsJson: JSON.stringify(details),
    });
    void sendOpsAlert(
      input.type === "hotel" ? "Ny hotellforespørsel" : "Ny forespørsel om leiebil",
      `Kunde: ${input.customerName}\nE-post: ${input.customerEmail}\nTelefon: ${input.customerPhone ?? "—"}\nPartner: ${input.partner ?? "valgfri"}\nDetaljer: ${JSON.stringify(details)}\n\nÅpne admin → Hotell og bil for å følge opp.`,
    );
    return { ok: true };
  }),

  // ─── Admin: innboks og oppfølging ────────────────────────────────────────

  listRequests: permittedProcedure("partners:read")
    .input(z.object({
      status: z.enum(PARTNER_STATUSES).optional(),
      type: z.enum(PARTNER_TYPES).optional(),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(partnerRequests)
        .orderBy(desc(partnerRequests.createdAt))
        .limit(300);
      return rows
        .filter((r) => (!input.status || r.status === input.status) && (!input.type || r.type === input.type))
        .map((r) => ({ ...r, details: JSON.parse(r.detailsJson) as Record<string, unknown> }));
    }),

  updateRequest: permittedProcedure("partners:write")
    .input(z.object({
      id: z.number().int(),
      status: z.enum(PARTNER_STATUSES),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [req] = await db.select().from(partnerRequests)
        .where(eq(partnerRequests.id, input.id)).limit(1);
      if (!req) throw new AppError("NOT_FOUND", { message: "Fant ikke forespørselen." });
      await db.update(partnerRequests)
        .set({ status: input.status, handledById: ctx.staff.userId })
        .where(eq(partnerRequests.id, input.id));
      await logAudit({
        actorType: "staff", actorId: ctx.staff.userId, actorLabel: ctx.staff.name,
        action: `partner_request.${input.status}`, targetType: "partner_request",
        targetId: String(input.id),
      });
      return { ok: true };
    }),
});
