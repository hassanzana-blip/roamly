import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { createRouter, customerProcedure } from "./middleware";
import { getDb } from "./queries/connection";
import { bookings, priceWatches, savedItems, savedTravelers } from "../db/schema";
import { AppError } from "./lib/errors";
import { normalizeName } from "./lib/validation";
import { unreadCount } from "./lib/notifications";
import { MAX_SAVED, tripsFromBookings } from "./account";
import type { MobileAccountHub, MobileSavedItem, MobileSavedKind, MobileTraveller, MobileTravellerKind } from "../contracts/mobileAccount";
import type { CabinClass } from "../contracts/types";

// ─── Min side i appen (/api/mobile/trpc, mobileAccount.*) ─────────────────────
// En smal, egen ruter – ikke nettets `account` eller `watch` montert i sin helhet (se mobileRouter.ts). Den gir
// appen det Min side og Lagret trenger, med de samme tabellene som nettet:
// - hub: nærmeste bestilling og tall fra kontoen (lagret, reisende, prisvarsler, uleste varsler). Ingen bonusnivå,
//   ingen anslag, ingen priser.
// - travellers / saveTraveller / removeTraveller: saved_travelers, med bare navn, type og reiseklasse. Fødselsdato og
//   kjønn fra nettet sendes aldri til appen og røres aldri; pass og ID finnes ikke i denne tabellen.
// - saved / save / unsave: saved_items for reisemål, fly og ruter (samme tabell og grense som nettet).
// Alt krever en kundeøkt (Bearer-token fra mobileAuth).

const TRAVELLER_KINDS = ["adult", "child", "infant"] as const;
const CABINS = ["economy", "premium_economy", "business", "first"] as const;
/** Samme grense som nettets «Lagrede reisende» (extras.addTraveler). */
export const MAX_TRAVELLERS = 20;

export const mobileSaveTravellerInput = z.object({
  id: z.number().int().positive().optional(),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  kind: z.enum(TRAVELLER_KINDS),
  cabin: z.enum(CABINS).nullable(),
});

const savedKind = z.enum(["destination", "flight", "route"]);
/** Reisemål: nettets slug. Fly og ruter: appens nøkkel (ruten «OSL-BCN», flyets reise-id). */
const refId = z.string().trim().min(1).max(120);
export const mobileSaveItemInput = z.object({
  kind: savedKind,
  refId,
  // Appens bilde av flyet eller ruten. Grensen er den samme som nettets (8000 tegn lagres); større avvises i stedet
  // for å kuttes midt i JSON-en.
  payload: z
    .record(z.string(), z.unknown())
    .optional()
    .refine((p) => p === undefined || JSON.stringify(p).length <= 8000, { message: "Det lagrede er for stort.", path: ["payload"] }),
});
export const mobileUnsaveItemInput = z.object({ kind: savedKind, refId });
export const mobileSavedInput = z.object({ kind: savedKind.optional() }).optional();

/**
 * Typen for en reisende fra nettet som bare har fødselsdato: regnet ut på serveren i dag (under 2 år spedbarn, under
 * 12 barn – flyselskapenes grenser), så appen kan vise typen uten å få datoen.
 */
export function kindFromBornOn(bornOn: string | null, today: Date = new Date()): MobileTravellerKind | null {
  if (!bornOn || !/^\d{4}-\d{2}-\d{2}$/.test(bornOn)) return null;
  const [y, m, d] = bornOn.split("-").map(Number) as [number, number, number];
  let age = today.getUTCFullYear() - y;
  if (today.getUTCMonth() + 1 < m || (today.getUTCMonth() + 1 === m && today.getUTCDate() < d)) age -= 1;
  if (age < 0 || age > 130) return null;
  return age < 2 ? "infant" : age < 12 ? "child" : "adult";
}

function toTraveller(r: typeof savedTravelers.$inferSelect): MobileTraveller {
  const kind = (TRAVELLER_KINDS as readonly string[]).includes(r.travelerKind ?? "") ? (r.travelerKind as MobileTravellerKind) : kindFromBornOn(r.bornOn);
  const cabin = (CABINS as readonly string[]).includes(r.cabin ?? "") ? (r.cabin as CabinClass) : null;
  return { id: r.id, firstName: r.firstName, lastName: r.lastName, kind, cabin };
}

function parsePayload(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const mobileAccountRouter = createRouter({
  hub: customerProcedure.query(async ({ ctx }): Promise<MobileAccountHub> => {
    const id = ctx.customer.customerId;
    const db = getDb();
    const [tripRows, savedRows, travellerRows, watchRows, unread] = await Promise.all([
      db.select().from(bookings).where(eq(bookings.customerAccountId, id)).orderBy(desc(bookings.createdAt)).limit(50),
      db
        .select({ kind: savedItems.kind, n: sql<number>`count(*)` })
        .from(savedItems)
        .where(and(eq(savedItems.customerId, id), inArray(savedItems.kind, ["destination", "flight", "route"])))
        .groupBy(savedItems.kind),
      db.select({ n: sql<number>`count(*)` }).from(savedTravelers).where(eq(savedTravelers.customerId, id)),
      db.select({ n: sql<number>`count(*)` }).from(priceWatches).where(and(eq(priceWatches.customerId, id), eq(priceWatches.active, true))),
      unreadCount(id),
    ]);
    const upcoming = tripsFromBookings(tripRows)
      .filter((t) => t.upcoming)
      .sort((a, b) => Date.parse(a.departingAt) - Date.parse(b.departingAt));
    const next = upcoming[0];
    const count = (k: MobileSavedKind) => Number(savedRows.find((r) => r.kind === k)?.n ?? 0);
    return {
      nextTrip: next
        ? {
            bookingReference: next.bookingReference,
            originIata: next.originIata,
            originCity: next.originCity,
            destinationIata: next.destinationIata,
            destinationCity: next.destinationCity,
            departingAt: next.departingAt,
            returningAt: next.returningAt,
            passengerCount: next.passengerCount,
          }
        : null,
      upcomingTrips: upcoming.length,
      saved: { destinations: count("destination"), flights: count("flight"), routes: count("route") },
      travellers: Number(travellerRows[0]?.n ?? 0),
      priceWatches: Number(watchRows[0]?.n ?? 0),
      unreadNotifications: unread,
    };
  }),

  // ─── Lagrede reisende ────────────────────────────────────────────────────
  travellers: customerProcedure.query(async ({ ctx }): Promise<MobileTraveller[]> => {
    const rows = await getDb()
      .select()
      .from(savedTravelers)
      .where(eq(savedTravelers.customerId, ctx.customer.customerId))
      .orderBy(savedTravelers.createdAt, savedTravelers.id)
      .limit(MAX_TRAVELLERS);
    return rows.map(toTraveller);
  }),

  /** Ny reisende (uten id) eller endret (med id). Samme navneregel som nettet (extras.addTraveler). */
  saveTraveller: customerProcedure.input(mobileSaveTravellerInput).mutation(async ({ input, ctx }): Promise<MobileTraveller> => {
    const firstName = normalizeName(input.firstName);
    const lastName = normalizeName(input.lastName);
    if (!firstName) throw new AppError("VALIDATION", { message: "Fornavnet må fylles ut med bokstaver.", data: { field: "firstName" } });
    if (!lastName) throw new AppError("VALIDATION", { message: "Etternavnet må fylles ut med bokstaver.", data: { field: "lastName" } });
    const db = getDb();
    const customerId = ctx.customer.customerId;
    let id = input.id;
    if (id) {
      // Bare navn, type og klasse endres; nettets fødselsdato og kjønn står urørt.
      const res = await db
        .update(savedTravelers)
        .set({ firstName, lastName, travelerKind: input.kind, cabin: input.cabin })
        .where(and(eq(savedTravelers.id, id), eq(savedTravelers.customerId, customerId)));
      if (Number(res[0].affectedRows) === 0) throw new AppError("NOT_FOUND");
    } else {
      const [count] = await db.select({ n: sql<number>`count(*)` }).from(savedTravelers).where(eq(savedTravelers.customerId, customerId));
      if (Number(count?.n ?? 0) >= MAX_TRAVELLERS) throw new AppError("VALIDATION", { message: `Du kan lagre maks ${MAX_TRAVELLERS} reisende.`, data: { reason: "limit" } });
      const res = await db.insert(savedTravelers).values({ customerId, firstName, lastName, travelerKind: input.kind, cabin: input.cabin });
      id = Number(res[0].insertId);
    }
    const [row] = await db.select().from(savedTravelers).where(and(eq(savedTravelers.id, id), eq(savedTravelers.customerId, customerId))).limit(1);
    if (!row) throw new AppError("NOT_FOUND");
    return toTraveller(row);
  }),

  removeTraveller: customerProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const res = await getDb().delete(savedTravelers).where(and(eq(savedTravelers.id, input.id), eq(savedTravelers.customerId, ctx.customer.customerId)));
    if (Number(res[0].affectedRows) === 0) throw new AppError("NOT_FOUND");
    return { ok: true as const };
  }),

  // ─── Lagret: reisemål, fly og ruter ──────────────────────────────────────
  saved: customerProcedure.input(mobileSavedInput).query(async ({ input, ctx }): Promise<MobileSavedItem[]> => {
    const kinds = input?.kind ? [input.kind] : (["destination", "flight", "route"] as const);
    const rows = await getDb()
      .select()
      .from(savedItems)
      .where(and(eq(savedItems.customerId, ctx.customer.customerId), inArray(savedItems.kind, [...kinds])))
      .orderBy(desc(savedItems.createdAt), desc(savedItems.id))
      .limit(MAX_SAVED);
    return rows.map((r) => ({ kind: r.kind as MobileSavedKind, refId: r.refId, payload: parsePayload(r.payloadJson), createdAt: r.createdAt.toISOString() }));
  }),

  /** Idempotent: samme ting lagret igjen oppdaterer bildet. Grensen er nettets (200 ting per konto). */
  save: customerProcedure.input(mobileSaveItemInput).mutation(async ({ input, ctx }) => {
    const db = getDb();
    const customerId = ctx.customer.customerId;
    const [existing] = await db
      .select({ id: savedItems.id })
      .from(savedItems)
      .where(and(eq(savedItems.customerId, customerId), eq(savedItems.kind, input.kind), eq(savedItems.refId, input.refId)))
      .limit(1);
    if (!existing) {
      const [count] = await db.select({ n: sql<number>`count(*)` }).from(savedItems).where(eq(savedItems.customerId, customerId));
      if (Number(count?.n ?? 0) >= MAX_SAVED) throw new AppError("VALIDATION", { message: `Du kan lagre inntil ${MAX_SAVED} ting. Rydd litt, så får du plass.`, data: { reason: "limit" } });
    }
    const payloadJson = input.payload ? JSON.stringify(input.payload) : null;
    await db
      .insert(savedItems)
      .values({ customerId, kind: input.kind, refId: input.refId, payloadJson })
      .onDuplicateKeyUpdate({ set: { payloadJson: payloadJson ?? sql`payload_json` } });
    return { ok: true as const };
  }),

  unsave: customerProcedure.input(mobileUnsaveItemInput).mutation(async ({ input, ctx }) => {
    await getDb()
      .delete(savedItems)
      .where(and(eq(savedItems.customerId, ctx.customer.customerId), eq(savedItems.kind, input.kind), eq(savedItems.refId, input.refId)));
    return { ok: true as const };
  }),
});
