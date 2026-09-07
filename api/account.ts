import { z } from "zod";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { createRouter, customerProcedure } from "./middleware";
import { getDb } from "./queries/connection";
import {
  bookings,
  customerAccounts,
  customerNotifications,
  customerSessions,
  customerTravelProfiles,
  dealFeedback,
  priceWatches,
  rewardEvents,
  savedItems,
  searchHistory,
} from "../db/schema";
import type { Order } from "../contracts/types";
import { AppError } from "./lib/errors";
import { env } from "./lib/env";
import { revokeCustomerSession } from "./lib/customerSessions";
import { cleanNotificationPrefs, DEFAULT_NOTIFICATION_PREFS, listNotifications, unreadCount, type NotificationPrefs } from "./lib/notifications";
import { qualifiedReferralCount, rewardHistory, rewardRules, tierFor } from "./lib/rewards";
import { airportByIata } from "../contracts/airports";

// ─── Kontoens reiseidentitet ─────────────────────────────────────────────────
// Alt her er kundens egne valg og egne hendelser. Ingen modul på klienten skal
// vise et tall som ikke kommer herfra.

const IATA = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/);
const SLUG = z.string().trim().regex(/^[a-z0-9-]{2,40}$/);

export const CABINS = ["economy", "premium_economy", "business", "first"] as const;
export const BAGGAGE_PREFS = ["cabin_only", "20kg", "30kg", "40kg"] as const;
export const COMPANIONS = ["solo", "partner", "family", "friends"] as const;
export const SEAT_PREFS = ["window", "aisle", "together"] as const;
export const TASTE_DIMENSIONS = ["beach", "city", "food", "culture", "nature", "shopping", "family", "nightlife", "luxury", "adventure", "calm", "romantic", "football", "events"] as const;
export type TasteDimension = (typeof TASTE_DIMENSIONS)[number];

const flightPrefsSchema = z.object({
  directPreferred: z.boolean().optional(),
  maxOneStop: z.boolean().optional(),
  avoidSelfTransfer: z.boolean().optional(),
  avoidAirportChange: z.boolean().optional(),
  shortLayovers: z.boolean().optional(),
  flexibleTickets: z.boolean().optional(),
  refundablePreferred: z.boolean().optional(),
});
const timingPrefsSchema = z.object({
  morningDeparture: z.boolean().optional(),
  daytimeArrival: z.boolean().optional(),
  avoidOvernightConnection: z.boolean().optional(),
});
const tasteSchema = z
  .record(z.string(), z.number().int().min(0).max(100))
  .transform((raw) => Object.fromEntries(Object.entries(raw).filter(([k]) => (TASTE_DIMENSIONS as readonly string[]).includes(k))) as Partial<Record<TasteDimension, number>>);
// Løs form her; cleanNotificationPrefs beholder kun kjente typer.
const notificationPrefsSchema = z.object({
  email: z.record(z.string(), z.boolean()).optional(),
  inApp: z.record(z.string(), z.boolean()).optional(),
});

export type FlightPrefs = z.infer<typeof flightPrefsSchema>;
export type TimingPrefs = z.infer<typeof timingPrefsSchema>;

export type TravelProfile = {
  homeAirports: string[];
  favouriteDestinations: string[];
  preferredCabin: (typeof CABINS)[number] | null;
  baggagePreference: (typeof BAGGAGE_PREFS)[number] | null;
  companions: (typeof COMPANIONS)[number] | null;
  flightPrefs: FlightPrefs;
  timingPrefs: TimingPrefs;
  seatPreference: (typeof SEAT_PREFS)[number] | null;
  taste: Partial<Record<TasteDimension, number>>;
  notificationPrefs: NotificationPrefs;
  referralShares: number;
  onboardingCompletedAt: string | null;
  onboardingSkippedAt: string | null;
  /** Hvor komplett profilen er, 0–100 — for én rolig fremdriftslinje, ikke gamification. */
  completeness: number;
};

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const EMPTY_PROFILE: TravelProfile = {
  homeAirports: [],
  favouriteDestinations: [],
  preferredCabin: null,
  baggagePreference: null,
  companions: null,
  flightPrefs: {},
  timingPrefs: {},
  seatPreference: null,
  taste: {},
  notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
  referralShares: 0,
  onboardingCompletedAt: null,
  onboardingSkippedAt: null,
  completeness: 0,
};

function completenessOf(p: Omit<TravelProfile, "completeness">): number {
  const checks = [
    p.homeAirports.length > 0,
    p.favouriteDestinations.length > 0,
    p.preferredCabin !== null,
    p.baggagePreference !== null,
    p.companions !== null,
    Object.keys(p.flightPrefs).length > 0,
    p.seatPreference !== null,
    Object.keys(p.taste).length >= 3,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function toProfile(row: typeof customerTravelProfiles.$inferSelect | undefined): TravelProfile {
  if (!row) return EMPTY_PROFILE;
  const base = {
    homeAirports: parseJson<string[]>(row.homeAirportsJson, []),
    favouriteDestinations: parseJson<string[]>(row.favouriteDestinationsJson, []),
    preferredCabin: (row.preferredCabin as TravelProfile["preferredCabin"]) ?? null,
    baggagePreference: (row.baggagePreference as TravelProfile["baggagePreference"]) ?? null,
    companions: (row.companions as TravelProfile["companions"]) ?? null,
    flightPrefs: parseJson<FlightPrefs>(row.flightPrefsJson, {}),
    timingPrefs: parseJson<TimingPrefs>(row.timingPrefsJson, {}),
    seatPreference: (row.seatPreference as TravelProfile["seatPreference"]) ?? null,
    taste: parseJson<Partial<Record<TasteDimension, number>>>(row.tasteJson, {}),
    notificationPrefs: cleanNotificationPrefs(parseJson<unknown>(row.notificationPrefsJson, null)),
    referralShares: row.referralShares,
    onboardingCompletedAt: row.onboardingCompletedAt?.toISOString() ?? null,
    onboardingSkippedAt: row.onboardingSkippedAt?.toISOString() ?? null,
  };
  return { ...base, completeness: completenessOf(base) };
}

export async function loadTravelProfile(customerId: number): Promise<TravelProfile> {
  const [row] = await getDb().select().from(customerTravelProfiles).where(eq(customerTravelProfiles.customerId, customerId)).limit(1);
  return toProfile(row);
}

/** Upsert på customer_id — raden opprettes første gang kunden lagrer noe. */
async function upsertProfile(customerId: number, patch: Partial<typeof customerTravelProfiles.$inferInsert>): Promise<void> {
  await getDb()
    .insert(customerTravelProfiles)
    .values({ customerId, ...patch })
    .onDuplicateKeyUpdate({ set: patch });
}

const savedKindSchema = z.enum(["destination", "flight", "article", "trip_idea"]);
export type SavedKind = z.infer<typeof savedKindSchema>;
const MAX_SAVED = 200;

function tripsFromBookings(rows: (typeof bookings.$inferSelect)[]) {
  const now = Date.now();
  return rows
    .map((b) => {
      const order = parseJson<Order | null>(b.payload, null);
      const first = order?.slices?.[0];
      const last = order?.slices?.[order.slices.length - 1];
      const departingAt = first?.departingAt ?? "";
      return {
        bookingId: b.id,
        orderId: b.orderId,
        bookingReference: b.bookingReference,
        state: b.state,
        originIata: first?.origin.iata ?? "",
        originCity: first?.origin.city ?? "",
        destinationIata: first?.destination.iata ?? "",
        destinationCity: first?.destination.city ?? "",
        departingAt,
        returningAt: order && order.slices.length > 1 ? (last?.departingAt ?? null) : null,
        passengerCount: order?.passengers?.length ?? 0,
        cancelled: Boolean(b.cancelledAt),
        upcoming: Boolean(departingAt) && Date.parse(departingAt) > now && !b.cancelledAt,
        completed: Boolean(b.travelCompletedAt),
      };
    })
    .filter((t) => t.departingAt);
}

export const accountRouter = createRouter({
  // ─── Reiseprofil ───────────────────────────────────────────────────────────
  travelProfile: customerProcedure.query(({ ctx }) => loadTravelProfile(ctx.customer.customerId)),

  updateTravelProfile: customerProcedure
    .input(
      z.object({
        homeAirports: z.array(IATA).max(4).optional(),
        favouriteDestinations: z.array(SLUG).max(8).optional(),
        preferredCabin: z.enum(CABINS).nullable().optional(),
        baggagePreference: z.enum(BAGGAGE_PREFS).nullable().optional(),
        companions: z.enum(COMPANIONS).nullable().optional(),
        flightPrefs: flightPrefsSchema.optional(),
        timingPrefs: timingPrefsSchema.optional(),
        seatPreference: z.enum(SEAT_PREFS).nullable().optional(),
        taste: tasteSchema.optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const patch: Partial<typeof customerTravelProfiles.$inferInsert> = {};
      if (input.homeAirports) {
        const unknown = input.homeAirports.find((a) => !airportByIata(a));
        if (unknown) throw new AppError("VALIDATION", { message: `Vi kjenner ikke flyplassen ${unknown}.`, data: { field: "homeAirports" } });
        patch.homeAirportsJson = JSON.stringify([...new Set(input.homeAirports)]);
      }
      if (input.favouriteDestinations) patch.favouriteDestinationsJson = JSON.stringify([...new Set(input.favouriteDestinations)]);
      if (input.preferredCabin !== undefined) patch.preferredCabin = input.preferredCabin;
      if (input.baggagePreference !== undefined) patch.baggagePreference = input.baggagePreference;
      if (input.companions !== undefined) patch.companions = input.companions;
      if (input.flightPrefs) patch.flightPrefsJson = JSON.stringify(input.flightPrefs);
      if (input.timingPrefs) patch.timingPrefsJson = JSON.stringify(input.timingPrefs);
      if (input.seatPreference !== undefined) patch.seatPreference = input.seatPreference;
      if (input.taste) patch.tasteJson = JSON.stringify(input.taste);
      if (Object.keys(patch).length) await upsertProfile(ctx.customer.customerId, patch);
      return loadTravelProfile(ctx.customer.customerId);
    }),

  /** Onboarding kan hoppes over — vi maser ikke om det igjen. */
  finishOnboarding: customerProcedure.input(z.object({ skipped: z.boolean().optional() })).mutation(async ({ input, ctx }) => {
    await upsertProfile(ctx.customer.customerId, input.skipped ? { onboardingSkippedAt: new Date() } : { onboardingCompletedAt: new Date() });
    return { ok: true };
  }),

  updateNotificationPrefs: customerProcedure.input(notificationPrefsSchema).mutation(async ({ input, ctx }) => {
    const current = (await loadTravelProfile(ctx.customer.customerId)).notificationPrefs;
    const merged = cleanNotificationPrefs({
      email: { ...current.email, ...(input.email ?? {}) },
      inApp: { ...current.inApp, ...(input.inApp ?? {}) },
    });
    await upsertProfile(ctx.customer.customerId, { notificationPrefsJson: JSON.stringify(merged) });
    return merged;
  }),

  // ─── Lagret ───────────────────────────────────────────────────────────────
  saved: customerProcedure.input(z.object({ kind: savedKindSchema.optional() }).optional()).query(async ({ input, ctx }) => {
    const conds = [eq(savedItems.customerId, ctx.customer.customerId)];
    if (input?.kind) conds.push(eq(savedItems.kind, input.kind));
    const rows = await getDb().select().from(savedItems).where(and(...conds)).orderBy(desc(savedItems.createdAt)).limit(MAX_SAVED);
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind as SavedKind,
      refId: r.refId,
      payload: parseJson<Record<string, unknown> | null>(r.payloadJson, null),
      createdAt: r.createdAt.toISOString(),
    }));
  }),

  save: customerProcedure
    .input(z.object({ kind: savedKindSchema, refId: z.string().trim().min(1).max(120), payload: z.record(z.string(), z.unknown()).optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [count] = await db.select({ n: sql<number>`count(*)` }).from(savedItems).where(eq(savedItems.customerId, ctx.customer.customerId));
      if (Number(count?.n ?? 0) >= MAX_SAVED) throw new AppError("VALIDATION", { message: `Du kan lagre inntil ${MAX_SAVED} ting. Rydd litt, så får du plass.` });
      const payloadJson = input.payload ? JSON.stringify(input.payload).slice(0, 8000) : null;
      await db
        .insert(savedItems)
        .values({ customerId: ctx.customer.customerId, kind: input.kind, refId: input.refId, payloadJson })
        .onDuplicateKeyUpdate({ set: { payloadJson: payloadJson ?? sql`payload_json` } });
      return { ok: true };
    }),

  unsave: customerProcedure.input(z.object({ kind: savedKindSchema, refId: z.string().trim().min(1).max(120) })).mutation(async ({ input, ctx }) => {
    await getDb()
      .delete(savedItems)
      .where(and(eq(savedItems.customerId, ctx.customer.customerId), eq(savedItems.kind, input.kind), eq(savedItems.refId, input.refId)));
    return { ok: true };
  }),

  /** Ved innlogging: flett favorittene fra nettleseren inn på kontoen (tap ingenting). */
  syncSaved: customerProcedure
    .input(z.object({ destinations: z.array(SLUG).max(100) }))
    .mutation(async ({ input, ctx }) => {
      if (!input.destinations.length) return { added: 0 };
      const db = getDb();
      const existing = await db
        .select({ refId: savedItems.refId })
        .from(savedItems)
        .where(and(eq(savedItems.customerId, ctx.customer.customerId), eq(savedItems.kind, "destination")));
      const have = new Set(existing.map((r) => r.refId));
      const fresh = input.destinations.filter((d) => !have.has(d)).slice(0, MAX_SAVED - have.size);
      if (fresh.length) {
        await db.insert(savedItems).values(fresh.map((refId) => ({ customerId: ctx.customer.customerId, kind: "destination", refId })));
      }
      return { added: fresh.length };
    }),

  // ─── Søkehistorikk ────────────────────────────────────────────────────────
  searchHistory: customerProcedure.query(async ({ ctx }) => {
    const rows = await getDb()
      .select()
      .from(searchHistory)
      .where(eq(searchHistory.customerId, ctx.customer.customerId))
      .orderBy(desc(searchHistory.createdAt))
      .limit(12);
    // Samme rute + dato vises én gang, nyeste først.
    const seen = new Set<string>();
    return rows
      .filter((r) => {
        const key = `${r.originIata}-${r.destinationIata}-${r.departDate}-${r.returnDate ?? ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((r) => ({
        id: r.id,
        originIata: r.originIata,
        destinationIata: r.destinationIata,
        originCity: airportByIata(r.originIata)?.city ?? r.originIata,
        destinationCity: airportByIata(r.destinationIata)?.city ?? r.destinationIata,
        departDate: r.departDate,
        returnDate: r.returnDate,
        adults: r.adults,
        children: r.children,
        infants: r.infants,
        cabin: r.cabin,
        createdAt: r.createdAt.toISOString(),
      }));
  }),

  recordSearch: customerProcedure
    .input(
      z.object({
        origin: IATA,
        destination: IATA,
        departDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        adults: z.number().int().min(1).max(9),
        children: z.number().int().min(0).max(8),
        infants: z.number().int().min(0).max(4),
        cabin: z.enum(CABINS),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db.insert(searchHistory).values({
        customerId: ctx.customer.customerId,
        originIata: input.origin,
        destinationIata: input.destination,
        departDate: input.departDate,
        returnDate: input.returnDate ?? null,
        adults: input.adults,
        children: input.children,
        infants: input.infants,
        cabin: input.cabin,
      });
      // Behold de 50 siste — historikk er en snarvei, ikke et arkiv.
      const old = await db
        .select({ id: searchHistory.id })
        .from(searchHistory)
        .where(eq(searchHistory.customerId, ctx.customer.customerId))
        .orderBy(desc(searchHistory.createdAt))
        .offset(50)
        .limit(100);
      if (old.length) await db.delete(searchHistory).where(inArray(searchHistory.id, old.map((o) => o.id)));
      return { ok: true };
    }),

  removeSearch: customerProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    await getDb().delete(searchHistory).where(and(eq(searchHistory.id, input.id), eq(searchHistory.customerId, ctx.customer.customerId)));
    return { ok: true };
  }),

  clearSearchHistory: customerProcedure.mutation(async ({ ctx }) => {
    await getDb().delete(searchHistory).where(eq(searchHistory.customerId, ctx.customer.customerId));
    return { ok: true };
  }),

  // ─── Varsler ──────────────────────────────────────────────────────────────
  notifications: customerProcedure.query(({ ctx }) => listNotifications(ctx.customer.customerId)),
  unreadCount: customerProcedure.query(async ({ ctx }) => ({ count: await unreadCount(ctx.customer.customerId) })),
  markRead: customerProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    await getDb()
      .update(customerNotifications)
      .set({ readAt: new Date() })
      .where(and(eq(customerNotifications.id, input.id), eq(customerNotifications.customerId, ctx.customer.customerId), isNull(customerNotifications.readAt)));
    return { ok: true };
  }),
  markAllRead: customerProcedure.mutation(async ({ ctx }) => {
    await getDb()
      .update(customerNotifications)
      .set({ readAt: new Date() })
      .where(and(eq(customerNotifications.customerId, ctx.customer.customerId), isNull(customerNotifications.readAt)));
    return { ok: true };
  }),

  // ─── Sikkerhet ────────────────────────────────────────────────────────────
  sessions: customerProcedure.query(async ({ ctx }) => {
    const rows = await getDb()
      .select({ id: customerSessions.id, ip: customerSessions.ip, userAgent: customerSessions.userAgent, createdAt: customerSessions.createdAt, expiresAt: customerSessions.expiresAt })
      .from(customerSessions)
      .where(and(eq(customerSessions.customerId, ctx.customer.customerId), isNull(customerSessions.revokedAt)))
      .orderBy(desc(customerSessions.createdAt))
      .limit(20);
    return rows.map((r) => ({
      id: r.id,
      current: r.id === ctx.customer.sessionId,
      // IP maskeres i svaret — kunden trenger «hvor omtrent», ikke hele adressen.
      ipHint: r.ip ? r.ip.replace(/(\d+\.\d+)\.\d+\.\d+/, "$1.x.x") : null,
      device: describeUserAgent(r.userAgent),
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
    }));
  }),
  revokeSession: customerProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    if (input.id === ctx.customer.sessionId) throw new AppError("VALIDATION", { message: "Bruk «Logg ut» for denne enheten." });
    const [row] = await getDb()
      .select({ id: customerSessions.id })
      .from(customerSessions)
      .where(and(eq(customerSessions.id, input.id), eq(customerSessions.customerId, ctx.customer.customerId)))
      .limit(1);
    if (!row) throw new AppError("NOT_FOUND");
    await revokeCustomerSession(row.id);
    return { ok: true };
  }),

  // ─── Bonus og henvisning ──────────────────────────────────────────────────
  rewards: customerProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const [rules, history, account, completed] = await Promise.all([
      rewardRules(),
      rewardHistory(ctx.customer.customerId),
      db.select({ bonusKr: customerAccounts.bonusKr, createdAt: customerAccounts.createdAt }).from(customerAccounts).where(eq(customerAccounts.id, ctx.customer.customerId)).limit(1),
      db
        .select({ n: sql<number>`count(*)` })
        .from(bookings)
        .where(and(eq(bookings.customerAccountId, ctx.customer.customerId), sql`${bookings.travelCompletedAt} IS NOT NULL`)),
    ]);
    const completedTrips = Number(completed[0]?.n ?? 0);
    const tier = tierFor(rules, completedTrips);
    return {
      programName: rules.programName,
      balanceKr: account[0]?.bonusKr ?? 0,
      memberSince: account[0]?.createdAt.toISOString() ?? null,
      /** Medlemsnummer: kontonummeret, aldri noe som ligner et kort- eller betalingsnummer. */
      memberNumber: `HS-${String(ctx.customer.customerId).padStart(6, "0")}`,
      completedTrips,
      tier: tier.current,
      nextTier: tier.next,
      tripsToNext: tier.tripsToNext,
      earnFraction: rules.bookingEarnFraction,
      history,
    };
  }),

  referral: customerProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const [[account], profile, signedUp, qualified, earned] = await Promise.all([
      db.select({ referralCode: customerAccounts.referralCode }).from(customerAccounts).where(eq(customerAccounts.id, ctx.customer.customerId)).limit(1),
      loadTravelProfile(ctx.customer.customerId),
      db
        .select({ n: sql<number>`count(*)` })
        .from(customerAccounts)
        .where(and(eq(customerAccounts.referredById, ctx.customer.customerId), isNull(customerAccounts.deletedAt))),
      qualifiedReferralCount(ctx.customer.customerId),
      db
        .select({ sum: sql<number>`coalesce(sum(${rewardEvents.amountKr}), 0)` })
        .from(rewardEvents)
        .where(and(eq(rewardEvents.customerId, ctx.customer.customerId), eq(rewardEvents.kind, "referral"))),
    ]);
    const rules = await rewardRules();
    const code = account?.referralCode ?? null;
    return {
      code,
      link: code ? `${env.baseUrl}/logg-inn?modus=registrer&ref=${encodeURIComponent(code)}` : null,
      referrerKr: rules.referralReferrerKr,
      referredKr: rules.referralReferredKr,
      shares: profile.referralShares,
      signedUp: Number(signedUp[0]?.n ?? 0),
      qualified,
      earnedKr: Number(earned[0]?.sum ?? 0),
    };
  }),

  /** Teller delinger — vi lagrer aldri hvem lenken gikk til. */
  referralShared: customerProcedure.mutation(async ({ ctx }) => {
    await getDb()
      .insert(customerTravelProfiles)
      .values({ customerId: ctx.customer.customerId, referralShares: 1 })
      .onDuplicateKeyUpdate({ set: { referralShares: sql`${customerTravelProfiles.referralShares} + 1` } });
    return { ok: true };
  }),

  // ─── Tilbud for deg: tilbakemelding ───────────────────────────────────────
  dealFeedback: customerProcedure
    .input(z.object({ dealId: z.string().trim().min(1).max(64), verdict: z.enum(["interested", "not_for_me", "saved"]) }))
    .mutation(async ({ input, ctx }) => {
      await getDb()
        .insert(dealFeedback)
        .values({ customerId: ctx.customer.customerId, dealId: input.dealId, verdict: input.verdict })
        .onDuplicateKeyUpdate({ set: { verdict: input.verdict, createdAt: new Date() } });
      return { ok: true };
    }),
  dealFeedbackList: customerProcedure.query(async ({ ctx }) => {
    const rows = await getDb().select().from(dealFeedback).where(eq(dealFeedback.customerId, ctx.customer.customerId)).limit(200);
    return rows.map((r) => ({ dealId: r.dealId, verdict: r.verdict as "interested" | "not_for_me" | "saved" }));
  }),

  // ─── Navet: alt forsiden og profilen trenger, i ett kall ──────────────────
  hub: customerProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const id = ctx.customer.customerId;
    const [profile, tripRows, savedCount, watches, unread, rules, completed, history] = await Promise.all([
      loadTravelProfile(id),
      db.select().from(bookings).where(eq(bookings.customerAccountId, id)).orderBy(desc(bookings.createdAt)).limit(50),
      db.select({ n: sql<number>`count(*)` }).from(savedItems).where(eq(savedItems.customerId, id)),
      db
        .select({ id: priceWatches.id, originIata: priceWatches.originIata, destinationIata: priceWatches.destinationIata, lastResultJson: priceWatches.lastResultJson, lastCheckedAt: priceWatches.lastCheckedAt })
        .from(priceWatches)
        .where(and(eq(priceWatches.customerId, id), eq(priceWatches.active, true)))
        .limit(10),
      unreadCount(id),
      rewardRules(),
      db.select({ n: sql<number>`count(*)` }).from(bookings).where(and(eq(bookings.customerAccountId, id), sql`${bookings.travelCompletedAt} IS NOT NULL`)),
      db.select().from(searchHistory).where(eq(searchHistory.customerId, id)).orderBy(desc(searchHistory.createdAt)).limit(20),
    ]);
    const trips = tripsFromBookings(tripRows);
    const upcoming = trips.filter((t) => t.upcoming).sort((a, b) => a.departingAt.localeCompare(b.departingAt));
    const completedTrips = Number(completed[0]?.n ?? 0);
    const tier = tierFor(rules, completedTrips);

    // «Rutene dine»: ruter kunden faktisk har søkt på eller reist, tellet.
    const routeCounts = new Map<string, { originIata: string; destinationIata: string; n: number }>();
    for (const h of history) {
      const key = `${h.originIata}-${h.destinationIata}`;
      const cur = routeCounts.get(key) ?? { originIata: h.originIata, destinationIata: h.destinationIata, n: 0 };
      cur.n += 1;
      routeCounts.set(key, cur);
    }
    for (const t of trips) {
      const key = `${t.originIata}-${t.destinationIata}`;
      const cur = routeCounts.get(key) ?? { originIata: t.originIata, destinationIata: t.destinationIata, n: 0 };
      cur.n += 2;
      routeCounts.set(key, cur);
    }
    const routes = [...routeCounts.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, 4)
      .map((r) => ({
        ...r,
        originCity: airportByIata(r.originIata)?.city ?? r.originIata,
        destinationCity: airportByIata(r.destinationIata)?.city ?? r.destinationIata,
      }));

    return {
      firstName: ctx.customer.firstName,
      profile,
      nextTrip: upcoming[0] ?? null,
      upcomingCount: upcoming.length,
      pastCount: trips.filter((t) => !t.upcoming && !t.cancelled).length,
      savedCount: Number(savedCount[0]?.n ?? 0),
      watches: watches.map((w) => ({
        id: w.id,
        originIata: w.originIata,
        destinationIata: w.destinationIata,
        destinationCity: airportByIata(w.destinationIata)?.city ?? w.destinationIata,
        lastCheckedAt: w.lastCheckedAt?.toISOString() ?? null,
        lastResult: parseJson<Record<string, unknown> | null>(w.lastResultJson, null),
      })),
      unreadNotifications: unread,
      routes,
      rewards: { programName: rules.programName, tier: tier.current, completedTrips, tripsToNext: tier.tripsToNext, nextTier: tier.next },
    };
  }),
});

/** Kort, menneskelig beskrivelse av en User-Agent — ingen fingerprinting. */
function describeUserAgent(ua: string | null): string {
  if (!ua) return "Ukjent enhet";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "";
  return [browser, os].filter(Boolean).join(" på ") || "Nettleser";
}
