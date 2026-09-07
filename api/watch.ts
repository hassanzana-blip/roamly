import { z } from "zod";
import { and, asc, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { createRouter, customerProcedure } from "./middleware";
import { getDb } from "./queries/connection";
import { customerAccounts, priceWatches } from "../db/schema";
import type { Offer, SearchResult } from "../contracts/types";
import { AppError } from "./lib/errors";
import { env } from "./lib/env";
import { duffelConfig, duffelSearch } from "./lib/duffel";
import { demoSearch } from "./lib/demo";
import { computeServiceFeeMinor, loadPricingOverrides } from "./lib/pricing";
import { toMinor } from "./lib/money";
import { notify, notificationPrefsFor } from "./lib/notifications";
import { sendTemplatedEmail } from "./lib/mailer";
import { airportByIata } from "../contracts/airports";
import { log } from "./lib/logger";

// ─── Prisovervåking ──────────────────────────────────────────────────────────
// En stående bestilling: «Oslo → Erbil, helger i september–oktober, under
// 5 000 kr, maks ett stopp, minst ett innsjekket kolli». Workeren sjekker den
// mot leverandøren i kundens takt og melder fra KUN når et ekte tilbud
// oppfyller alle vilkårene. Testpriser fra leverandøren varsles aldri på
// e-post — de vises høyst i appen, merket som test.

const IATA = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/);
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const MAX_WATCHES = 10;
const MAX_WINDOW_DAYS = 120;

/** Hvor ofte vi spør leverandøren per takt. Sjekk koster; «umiddelbart» er hver 6. time. */
const CHECK_INTERVAL_MS: Record<string, number> = { immediate: 6 * 60 * 60_000, daily: 24 * 60 * 60_000, weekly: 7 * 24 * 60 * 60_000 };
/** Minste avstand mellom to varsler for samme overvåking. */
const NOTIFY_GAP_MS: Record<string, number> = { immediate: 6 * 60 * 60_000, daily: 24 * 60 * 60_000, weekly: 7 * 24 * 60 * 60_000 };
const DATES_PER_CHECK = 4;
const WATCHES_PER_RUN = 10;

const watchInput = z
  .object({
    origin: IATA,
    destination: IATA,
    dateFrom: DATE,
    dateTo: DATE,
    weekendsOnly: z.boolean().optional(),
    nightsMin: z.number().int().min(1).max(30).nullable().optional(),
    nightsMax: z.number().int().min(1).max(30).nullable().optional(),
    maxPriceMinor: z.number().int().min(10_000).max(50_000_000),
    currency: z.enum(["NOK", "SEK", "DKK", "EUR"]).optional(),
    maxStops: z.number().int().min(0).max(2).nullable().optional(),
    minCheckedBags: z.number().int().min(0).max(3).nullable().optional(),
    adults: z.number().int().min(1).max(9).optional(),
    children: z.number().int().min(0).max(8).optional(),
    infants: z.number().int().min(0).max(4).optional(),
    cabin: z.enum(["economy", "premium_economy", "business", "first"]).optional(),
    cadence: z.enum(["immediate", "daily", "weekly"]).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.origin === v.destination) ctx.addIssue({ code: "custom", path: ["destination"], message: "Avreise og reisemål kan ikke være samme sted." });
    if (v.dateTo < v.dateFrom) ctx.addIssue({ code: "custom", path: ["dateTo"], message: "Sluttdato må være etter startdato." });
    const days = (Date.parse(v.dateTo) - Date.parse(v.dateFrom)) / 86_400_000;
    if (days > MAX_WINDOW_DAYS) ctx.addIssue({ code: "custom", path: ["dateTo"], message: `Vi følger inntil ${MAX_WINDOW_DAYS} dager om gangen.` });
    if (v.dateTo < new Date().toISOString().slice(0, 10)) ctx.addIssue({ code: "custom", path: ["dateTo"], message: "Perioden har passert." });
    if (v.nightsMin && v.nightsMax && v.nightsMax < v.nightsMin) ctx.addIssue({ code: "custom", path: ["nightsMax"], message: "Maks netter må være minst like mange som minimum." });
  });

export type WatchResult = {
  priceMinor: number;
  currency: string;
  departDate: string;
  returnDate: string | null;
  stops: number;
  checkedBags: number | null;
  carrier: string;
  offerId: string;
  /** false = leverandøren svarte med testdata; vises aldri som et ekte treff. */
  live: boolean;
  seenAt: string;
};

function serialize(w: typeof priceWatches.$inferSelect) {
  let lastResult: WatchResult | null = null;
  try {
    lastResult = w.lastResultJson ? (JSON.parse(w.lastResultJson) as WatchResult) : null;
  } catch {
    lastResult = null;
  }
  return {
    id: w.id,
    originIata: w.originIata,
    destinationIata: w.destinationIata,
    originCity: airportByIata(w.originIata)?.city ?? w.originIata,
    destinationCity: airportByIata(w.destinationIata)?.city ?? w.destinationIata,
    dateFrom: w.dateFrom,
    dateTo: w.dateTo,
    weekendsOnly: w.weekendsOnly,
    nightsMin: w.nightsMin,
    nightsMax: w.nightsMax,
    maxPriceMinor: w.maxPriceMinor,
    currency: w.currency,
    maxStops: w.maxStops,
    minCheckedBags: w.minCheckedBags,
    adults: w.adults,
    children: w.children,
    infants: w.infants,
    cabin: w.cabin,
    cadence: w.cadence as "immediate" | "daily" | "weekly",
    active: w.active,
    lastCheckedAt: w.lastCheckedAt?.toISOString() ?? null,
    lastNotifiedAt: w.lastNotifiedAt?.toISOString() ?? null,
    lastResult,
    createdAt: w.createdAt.toISOString(),
  };
}

export const watchRouter = createRouter({
  list: customerProcedure.query(async ({ ctx }) => {
    const rows = await getDb()
      .select()
      .from(priceWatches)
      .where(eq(priceWatches.customerId, ctx.customer.customerId))
      .orderBy(desc(priceWatches.active), desc(priceWatches.createdAt))
      .limit(MAX_WATCHES * 2);
    return rows.map(serialize);
  }),

  create: customerProcedure.input(watchInput).mutation(async ({ input, ctx }) => {
    const db = getDb();
    if (!airportByIata(input.origin) || !airportByIata(input.destination)) {
      throw new AppError("VALIDATION", { message: "Vi kjenner ikke en av flyplassene." });
    }
    const [count] = await db
      .select({ n: sql<number>`count(*)` })
      .from(priceWatches)
      .where(and(eq(priceWatches.customerId, ctx.customer.customerId), eq(priceWatches.active, true)));
    if (Number(count?.n ?? 0) >= MAX_WATCHES) {
      throw new AppError("VALIDATION", { message: `Du kan ha ${MAX_WATCHES} aktive prisovervåkinger. Slå av en for å legge til en ny.` });
    }
    const result = await db.insert(priceWatches).values({
      customerId: ctx.customer.customerId,
      originIata: input.origin,
      destinationIata: input.destination,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      weekendsOnly: input.weekendsOnly ?? false,
      nightsMin: input.nightsMin ?? null,
      nightsMax: input.nightsMax ?? input.nightsMin ?? null,
      maxPriceMinor: input.maxPriceMinor,
      currency: input.currency ?? "NOK",
      maxStops: input.maxStops ?? null,
      minCheckedBags: input.minCheckedBags ?? null,
      adults: input.adults ?? 1,
      children: input.children ?? 0,
      infants: input.infants ?? 0,
      cabin: input.cabin ?? "economy",
      cadence: input.cadence ?? "daily",
    });
    return { id: Number(result[0].insertId) };
  }),

  update: customerProcedure
    .input(z.object({ id: z.number().int().positive(), active: z.boolean().optional(), cadence: z.enum(["immediate", "daily", "weekly"]).optional(), maxPriceMinor: z.number().int().min(10_000).max(50_000_000).optional() }))
    .mutation(async ({ input, ctx }) => {
      const patch: Partial<typeof priceWatches.$inferInsert> = {};
      if (input.active !== undefined) patch.active = input.active;
      if (input.cadence) patch.cadence = input.cadence;
      if (input.maxPriceMinor) patch.maxPriceMinor = input.maxPriceMinor;
      if (!Object.keys(patch).length) return { ok: true };
      const res = await getDb()
        .update(priceWatches)
        .set(patch)
        .where(and(eq(priceWatches.id, input.id), eq(priceWatches.customerId, ctx.customer.customerId)));
      if (Number(res[0].affectedRows) === 0) throw new AppError("NOT_FOUND");
      return { ok: true };
    }),

  remove: customerProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const res = await getDb().delete(priceWatches).where(and(eq(priceWatches.id, input.id), eq(priceWatches.customerId, ctx.customer.customerId)));
    if (Number(res[0].affectedRows) === 0) throw new AppError("NOT_FOUND");
    return { ok: true };
  }),
});

// ─── Worker ──────────────────────────────────────────────────────────────────

/** Avreisedatoer vi faktisk spør om: fredag/lørdag ved «kun helger», ellers jevnt fordelt. Maks DATES_PER_CHECK. */
export function candidateDates(dateFrom: string, dateTo: string, weekendsOnly: boolean, today = new Date().toISOString().slice(0, 10)): string[] {
  const start = Date.parse(dateFrom < today ? today : dateFrom);
  const end = Date.parse(dateTo);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const all: string[] = [];
  for (let t = start; t <= end; t += 86_400_000) {
    const d = new Date(t);
    const dow = d.getUTCDay();
    if (weekendsOnly && dow !== 5 && dow !== 6) continue;
    all.push(d.toISOString().slice(0, 10));
  }
  if (all.length <= DATES_PER_CHECK) return all;
  // Jevn spredning over perioden, slik at hele vinduet dekkes over tid.
  const out: string[] = [];
  for (let i = 0; i < DATES_PER_CHECK; i++) out.push(all[Math.round((i * (all.length - 1)) / (DATES_PER_CHECK - 1))]);
  return [...new Set(out)];
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);
}

function offerStops(o: Offer): number {
  return Math.max(...o.slices.map((s) => s.stops));
}

/** Sjekk ett tilbud mot vilkårene. Totalen inkluderer vårt gebyr — kunden får aldri en «under 5 000» som blir 5 200 i kassen. */
export function offerMatches(
  o: Offer,
  w: { maxPriceMinor: number; currency: string; maxStops: number | null; minCheckedBags: number | null },
  feeMinor: (supplierMinor: number, currency: string) => number,
): { ok: boolean; totalMinor: number } {
  if (o.totalCurrency !== w.currency) return { ok: false, totalMinor: 0 }; // ingen oppdiktet valutakurs
  const supplierMinor = toMinor(o.totalAmount, o.totalCurrency);
  const totalMinor = supplierMinor + feeMinor(supplierMinor, o.totalCurrency);
  if (totalMinor > w.maxPriceMinor) return { ok: false, totalMinor };
  if (w.maxStops !== null && offerStops(o) > w.maxStops) return { ok: false, totalMinor };
  if (w.minCheckedBags !== null && w.minCheckedBags > 0) {
    if (o.baggage.checkedUnknown || o.baggage.checkedBags < w.minCheckedBags) return { ok: false, totalMinor };
  }
  return { ok: true, totalMinor };
}

async function runSearch(w: typeof priceWatches.$inferSelect, departDate: string, returnDate: string | null): Promise<SearchResult> {
  const passengers = [
    ...Array.from({ length: w.adults }, () => ({ type: "adult" as const })),
    ...Array.from({ length: w.children }, () => ({ type: "child" as const, age: 8 })),
    ...Array.from({ length: w.infants }, () => ({ type: "infant_without_seat" as const, age: 1 })),
  ];
  const slices = [{ origin: w.originIata, destination: w.destinationIata, departureDate: departDate }];
  if (returnDate) slices.push({ origin: w.destinationIata, destination: w.originIata, departureDate: returnDate });
  const input = { slices, passengers, cabinClass: w.cabin as Offer["cabinClass"] };
  return duffelConfig.configured ? duffelSearch(input) : demoSearch(input);
}

/**
 * Sjekk forfalte overvåkinger. Kjøres av workeren hver time; hver overvåking
 * sjekkes i sin egen takt. Feil i én overvåking stopper ikke de andre.
 */
export async function checkPriceWatches(now = new Date()): Promise<{ checked: number; matched: number }> {
  const db = getDb();
  const today = now.toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(priceWatches)
    .where(and(eq(priceWatches.active, true), sql`${priceWatches.dateTo} >= ${today}`))
    .orderBy(asc(priceWatches.lastCheckedAt))
    .limit(WATCHES_PER_RUN * 3);

  const due = rows
    .filter((w) => !w.lastCheckedAt || now.getTime() - w.lastCheckedAt.getTime() >= (CHECK_INTERVAL_MS[w.cadence] ?? CHECK_INTERVAL_MS.daily))
    .slice(0, WATCHES_PER_RUN);
  if (!due.length) return { checked: 0, matched: 0 };

  const overrides = await loadPricingOverrides();
  const feeMinor = (supplierMinor: number, currency: string) => computeServiceFeeMinor(supplierMinor, currency, overrides);
  let matched = 0;

  for (const w of due) {
    try {
      const dates = candidateDates(w.dateFrom, w.dateTo, w.weekendsOnly, today);
      let best: WatchResult | null = null;
      for (const departDate of dates) {
        const returnDate = w.nightsMin ? addDays(departDate, w.nightsMin) : null;
        const result = await runSearch(w, departDate, returnDate);
        for (const o of result.offers) {
          const m = offerMatches(o, w, feeMinor);
          if (!m.ok) continue;
          if (!best || m.totalMinor < best.priceMinor) {
            best = {
              priceMinor: m.totalMinor,
              currency: o.totalCurrency,
              departDate,
              returnDate,
              stops: offerStops(o),
              checkedBags: o.baggage.checkedUnknown ? null : o.baggage.checkedBags,
              carrier: o.owner.name,
              offerId: o.id,
              live: result.liveMode,
              seenAt: now.toISOString(),
            };
          }
        }
      }

      await db
        .update(priceWatches)
        .set({ lastCheckedAt: now, lastResultJson: best ? JSON.stringify(best) : null })
        .where(eq(priceWatches.id, w.id));

      if (best && best.live) {
        matched += 1;
        const gap = NOTIFY_GAP_MS[w.cadence] ?? NOTIFY_GAP_MS.daily;
        if (!w.lastNotifiedAt || now.getTime() - w.lastNotifiedAt.getTime() >= gap) {
          await notifyMatch(w, best);
          await db.update(priceWatches).set({ lastNotifiedAt: now }).where(eq(priceWatches.id, w.id));
        }
      }
    } catch (err) {
      log.warn({ watchId: w.id, err: String(err).slice(0, 200) }, "prisovervåking: sjekk feilet");
      await db.update(priceWatches).set({ lastCheckedAt: now }).where(eq(priceWatches.id, w.id));
    }
  }
  return { checked: due.length, matched };
}

async function notifyMatch(w: typeof priceWatches.$inferSelect, best: WatchResult): Promise<void> {
  const route = `${airportByIata(w.originIata)?.city ?? w.originIata} → ${airportByIata(w.destinationIata)?.city ?? w.destinationIata}`;
  const q = new URLSearchParams({ from: w.originIata, to: w.destinationIata, depart: best.departDate, adults: String(w.adults), children: String(w.children), infants: String(w.infants), cabin: w.cabin });
  if (best.returnDate) q.set("ret", best.returnDate);
  const href = `/sok?${q.toString()}`;
  const price = Math.round(best.priceMinor / 100);

  await notify({
    customerId: w.customerId,
    type: "price_watch",
    title: `${route}: ${price} ${best.currency} funnet`,
    body: `Avreise ${best.departDate}${best.returnDate ? `, hjem ${best.returnDate}` : ""} · ${best.stops === 0 ? "direkte" : `${best.stops} stopp`}${best.checkedBags != null ? ` · ${best.checkedBags} kolli` : ""}. Prisen inkluderer gebyrer og kan endre seg før du bestiller.`,
    href,
    dedupeKey: `watch:${w.id}:${best.departDate}:${best.priceMinor}`,
  });

  const prefs = await notificationPrefsFor(w.customerId);
  if (prefs.email.price_watch === false) return;
  const [acc] = await getDb()
    .select({ email: customerAccounts.email, emailVerified: customerAccounts.emailVerified, locale: customerAccounts.locale })
    .from(customerAccounts)
    .where(eq(customerAccounts.id, w.customerId))
    .limit(1);
  if (!acc?.email || !acc.emailVerified) return;
  await sendTemplatedEmail("price_alert", acc.email, acc.locale, {
    route,
    price,
    currency: best.currency,
    targetPrice: Math.round(w.maxPriceMinor / 100),
    url: `${env.baseUrl}${href}`,
  }).catch((err) => log.warn({ watchId: w.id, err: String(err).slice(0, 160) }, "prisovervåking: e-post feilet"));
}

/** Overvåkinger som er utløpt (perioden passert) slås av stille — de dukker opp som «avsluttet» i lista. */
export async function expirePriceWatches(now = new Date()): Promise<number> {
  const today = now.toISOString().slice(0, 10);
  const res = await getDb()
    .update(priceWatches)
    .set({ active: false })
    .where(and(eq(priceWatches.active, true), or(lt(priceWatches.dateTo, today), isNull(priceWatches.dateTo))));
  return Number(res[0].affectedRows ?? 0);
}
