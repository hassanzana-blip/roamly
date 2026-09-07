import { createHash } from "node:crypto";
import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { bookingAttempts, bookingEvents, bookingSegments, bookings, scheduleChanges, tickets as ticketsTable } from "../../db/schema";
import type { OfferSlice, Order } from "../../contracts/types";
import { duffelConfig, duffelGetOrder, type SupplierOrder } from "./duffel";
import { enqueueJob, isDuplicateKeyError } from "./jobs";
import { log, withContext } from "./logger";
import { logAudit } from "./audit";
import { toMinor } from "./money";
import { ACTIVE_STATES, canTransition, type BookingState } from "./statemachine";
import { openAirlineCancellationCase } from "./refunds";
import type { DbOrTx } from "./ledger";
import { segmentInstant, zoneFor } from "./time";
import { inc } from "./metrics";

// ─── Avstemming mot leverandør (OTA-038/039/040/058) ───────────────────────
// Henter autoritativ ordre fra Duffel og oppdaterer lokal tilstand. Alle
// skriv skjer i ÉN transaksjon; jobber/e-poster/refusjonssaker legges i kø
// ETTER commit. Skriver hendelser KUN ved faktisk endring, og er idempotent
// under retry (deterministiske dedupe-nøkler per oppdaget endring).

export type SegmentSnapshot = {
  sliceIndex: number;
  segmentIndex: number;
  id?: string;
  carrierIata: string;
  flightNumber: string;
  originIata: string;
  destinationIata: string;
  departingAt: string;
  arrivingAt: string;
  /** IANA-sone for avgangsflyplass (fra leverandør når tilgjengelig). */
  originTimeZone?: string;
  destinationTimeZone?: string;
};

export type SegmentDiff = { key: string; old: SegmentSnapshot | null; new: SegmentSnapshot | null };

export function segmentsFromSlices(slices: OfferSlice[]): SegmentSnapshot[] {
  const out: SegmentSnapshot[] = [];
  let idx = 0;
  slices.forEach((s, si) => {
    for (const seg of s.segments) {
      out.push({
        sliceIndex: si,
        segmentIndex: idx++,
        id: seg.id,
        carrierIata: seg.carrier.iata,
        flightNumber: seg.flightNumber,
        originIata: seg.origin.iata,
        destinationIata: seg.destination.iata,
        departingAt: seg.departingAt,
        arrivingAt: seg.arrivingAt,
        ...(seg.origin.timeZone ? { originTimeZone: seg.origin.timeZone } : {}),
        ...(seg.destination.timeZone ? { destinationTimeZone: seg.destination.timeZone } : {}),
      });
    }
  });
  return out;
}

function segKey(s: SegmentSnapshot): string {
  return `${s.sliceIndex}:${s.originIata}-${s.destinationIata}`;
}

const sameInstant = (a: string, b: string) => {
  const x = Date.parse(a);
  const y = Date.parse(b);
  return Number.isFinite(x) && Number.isFinite(y) ? x === y : a === b;
};

/**
 * Diff av segmenter: matcher på id, ellers på (slice, origin→destination).
 * Endring = annet fly (carrier+nummer) eller endret avgang/ankomst; lagt til/fjernet segment.
 */
export function diffSegments(oldSegs: SegmentSnapshot[], newSegs: SegmentSnapshot[]): SegmentDiff[] {
  const diffs: SegmentDiff[] = [];
  const usedNew = new Set<number>();
  for (const o of oldSegs) {
    let ni = newSegs.findIndex((n, i) => !usedNew.has(i) && o.id && n.id && o.id === n.id);
    if (ni < 0) ni = newSegs.findIndex((n, i) => !usedNew.has(i) && segKey(n) === segKey(o));
    if (ni < 0) {
      diffs.push({ key: segKey(o), old: o, new: null });
      continue;
    }
    usedNew.add(ni);
    const n = newSegs[ni];
    const changed =
      `${o.carrierIata}${o.flightNumber}` !== `${n.carrierIata}${n.flightNumber}` ||
      !sameInstant(o.departingAt, n.departingAt) ||
      !sameInstant(o.arrivingAt, n.arrivingAt);
    if (changed) diffs.push({ key: segKey(o), old: o, new: n });
  }
  newSegs.forEach((n, i) => {
    if (!usedNew.has(i)) diffs.push({ key: segKey(n), old: null, new: n });
  });
  return diffs;
}

/**
 * Deterministisk nøkkel for én oppdaget ruteendring: hash av gamle+nye
 * segment-ID-er/tider. Samme diff → samme nøkkel → e-post sendes én gang.
 */
export function scheduleChangeFingerprint(diffs: SegmentDiff[]): string {
  const part = (s: SegmentSnapshot | null) => (s ? `${s.id ?? ""}|${s.carrierIata}${s.flightNumber}|${s.originIata}-${s.destinationIata}|${s.departingAt}|${s.arrivingAt}` : "-");
  const canonical = diffs
    .map((d) => `${d.key}=>${part(d.old)}=>${part(d.new)}`)
    .sort()
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

export function describeSegment(s: SegmentSnapshot): string {
  return `${s.carrierIata} ${s.flightNumber} ${s.originIata} → ${s.destinationIata}, avgang ${s.departingAt.replace("T", " ").slice(0, 16)}, ankomst ${s.arrivingAt.replace("T", " ").slice(0, 16)}`;
}

function parseOrder(payload: string): Order | null {
  try {
    return JSON.parse(payload) as Order;
  } catch {
    return null;
  }
}

async function transition(db: DbOrTx, bookingId: number, from: string, to: BookingState, actorId: string, reason: string): Promise<boolean> {
  if (from === to) return false;
  if (!canTransition(from as BookingState, to)) {
    log.warn({ bookingId, from, to }, "Avstemming: ugyldig overgang hoppet over");
    return false;
  }
  const res = await db
    .update(bookings)
    .set({ state: to, ...(to === "CANCELLED" ? { cancelledAt: new Date() } : {}) })
    .where(and(eq(bookings.id, bookingId), eq(bookings.state, from)));
  if (Number(res[0].affectedRows) === 0) return false;
  await db.insert(bookingEvents).values({ bookingId, fromState: from, toState: to, actorType: "worker", actorId, reason });
  await logAudit({ actorType: "worker", actorId, action: "booking.reconciled_state_change", targetType: "booking", targetId: bookingId, metadata: { from, to, reason } });
  if (to === "CONFIRMED") inc("bookings_confirmed_total");
  return true;
}

type AfterCommit = () => Promise<void>;

/** Avstem én booking mot leverandøren. */
export async function reconcileBookingById(bookingId: number, source: string): Promise<void> {
  const db = getDb();
  return withContext({ requestId: `reconcile-${bookingId}`, bookingId }, async () => {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (!booking) return;

    if (!duffelConfig.configured || booking.supplier !== "duffel" || booking.orderId.startsWith("ord_demo_") || booking.orderId.startsWith("manual_")) {
      await db.update(bookings).set({ lastReconciledAt: new Date() }).where(eq(bookings.id, bookingId));
      return;
    }

    let order: SupplierOrder;
    try {
      order = await duffelGetOrder(booking.orderId);
    } catch (err) {
      log.warn({ err, bookingId }, "Avstemming: kunne ikke hente ordre");
      throw err;
    }

    const payload = parseOrder(booking.payload);

    // Alle skriv i én transaksjon; sideeffekter (kø, refusjonssak) etter commit.
    const after: AfterCommit[] = [];
    const queue = (fn: AfterCommit) => after.push(fn);

    await db.transaction(async (tx) => {
      const [fresh] = await tx.select({ state: bookings.state }).from(bookings).where(eq(bookings.id, bookingId)).for("update");
      if (!fresh) return;
      let state = fresh.state;

      // 1) PNR
      if (order.bookingReference && (state === "BOOKING_PROCESSING" || state === "AWAITING_RECONCILIATION")) {
        await tx.update(bookings).set({ bookingReference: order.bookingReference }).where(eq(bookings.id, bookingId));
        if (await transition(tx, bookingId, state, "CONFIRMED", source, `Bekreftet hos leverandør ved avstemming (${order.bookingReference})`)) state = "CONFIRMED";
      } else if (!order.bookingReference && state === "BOOKING_PROCESSING") {
        await transition(tx, bookingId, state, "AWAITING_RECONCILIATION", source, "Leverandør har fortsatt ikke utstedt PNR");
        state = "AWAITING_RECONCILIATION";
      }

      // 2) Billetter
      const existing = await tx.select({ uid: ticketsTable.uniqueIdentifier }).from(ticketsTable).where(eq(ticketsTable.bookingId, bookingId));
      const known = new Set(existing.map((t) => t.uid));
      const newTickets = order.tickets.filter((t) => !known.has(t.uniqueIdentifier));
      for (const t of newTickets) {
        try {
          await tx.insert(ticketsTable).values({ bookingId, passengerId: t.passengerId, passengerName: t.passengerName, type: t.type, uniqueIdentifier: t.uniqueIdentifier });
        } catch (err) {
          if (!isDuplicateKeyError(err)) throw err;
        }
      }
      if (newTickets.length > 0 && known.size === 0) {
        queue(async () => {
          await enqueueJob("send_email", { kind: "booking_confirmation", bookingId }, { dedupeKey: `booking-confirmation:${bookingId}:tickets` }).catch(() => {});
          await logAudit({ actorType: "worker", actorId: source, action: "booking.tickets_received", targetType: "booking", targetId: bookingId, metadata: { count: newTickets.length } });
        });
      }

      // 3) Beløp (leverandørbeløp = det vi skylder Duffel: billett + tilvalg)
      if (payload?.supplierAmount) {
        const expected = toMinor(payload.supplierAmount, payload.totalCurrency) + (payload.servicesAmount ? toMinor(payload.servicesAmount, payload.totalCurrency) : 0);
        const actual = toMinor(order.totalAmount, order.totalCurrency);
        if (order.totalCurrency !== payload.totalCurrency || actual !== expected) {
          queue(async () => {
            await enqueueJob(
              "send_email",
              {
                kind: "ops_alert",
                subject: `Beløpsavvik ved avstemming: ${booking.bookingReference || booking.orderId}`,
                body: `Leverandøren rapporterer ${order.totalAmount} ${order.totalCurrency}, vi har bokført ${payload.supplierAmount} (+ tilvalg ${payload.servicesAmount ?? "0"}) ${payload.totalCurrency}.\nBooking-ID: ${bookingId}`,
              },
              { dedupeKey: `amount-mismatch:${bookingId}:${order.totalAmount}` },
            ).catch(() => {});
          });
        }
      }

      // 4) Kansellert hos flyselskap
      if (order.cancelledAt && !["CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED", "REFUND_PENDING", "TRAVELLED"].includes(state)) {
        const moved = await transition(tx, bookingId, state, "CANCELLED", source, "Leverandøren har kansellert ordren");
        if (moved) {
          state = "CANCELLED";
          await tx.update(bookings).set({ cancelledAt: new Date(order.cancelledAt), payload: JSON.stringify({ ...(payload ?? {}), cancelledAt: order.cancelledAt }) }).where(eq(bookings.id, bookingId));
          queue(async () => {
            await openAirlineCancellationCase(bookingId, source);
          });
        }
      }

      // 5) Ruteendringer
      if (!order.cancelledAt && payload && order.slices.length) {
        const stored = await tx
          .select()
          .from(bookingSegments)
          .where(eq(bookingSegments.bookingId, bookingId))
          .orderBy(asc(bookingSegments.sliceIndex), asc(bookingSegments.segmentIndex));
        const oldSegs: SegmentSnapshot[] = stored.length
          ? stored.map((s) => ({
              sliceIndex: s.sliceIndex,
              segmentIndex: s.segmentIndex,
              carrierIata: s.carrierIata ?? "",
              flightNumber: s.flightNumber ?? "",
              originIata: s.originIata,
              destinationIata: s.destinationIata,
              departingAt: s.departingAt ?? "",
              arrivingAt: s.arrivingAt ?? "",
            }))
          : segmentsFromSlices(payload.slices);
        const newSegs = segmentsFromSlices(order.slices);
        const diffs = diffSegments(oldSegs, newSegs);
        if (diffs.length > 0) {
          const [open] = await tx
            .select({ id: scheduleChanges.id, newJson: scheduleChanges.newSegmentsJson })
            .from(scheduleChanges)
            .where(and(eq(scheduleChanges.bookingId, bookingId), eq(scheduleChanges.status, "detected")))
            .limit(1);
          const newJson = JSON.stringify(newSegs);
          if (!open || open.newJson !== newJson) {
            await tx.insert(scheduleChanges).values({ bookingId, oldSegmentsJson: JSON.stringify(oldSegs), newSegmentsJson: newJson, status: "detected", customerNotifiedAt: new Date() });
            // Oppdater lagrede segmenter + payload til ny rute (historikk ligger i schedule_changes)
            await tx.delete(bookingSegments).where(eq(bookingSegments.bookingId, bookingId));
            if (newSegs.length) {
              await tx.insert(bookingSegments).values(
                newSegs.map((s) => ({
                  bookingId,
                  sliceIndex: s.sliceIndex,
                  segmentIndex: s.segmentIndex,
                  originIata: s.originIata,
                  destinationIata: s.destinationIata,
                  carrierIata: s.carrierIata || null,
                  flightNumber: s.flightNumber || null,
                  departingAt: s.departingAt,
                  arrivingAt: s.arrivingAt,
                  cabinClass: payload.cabinClass,
                })),
              );
            }
            await tx.update(bookings).set({ payload: JSON.stringify({ ...payload, slices: order.slices }) }).where(eq(bookings.id, bookingId));
            if (state === "CONFIRMED") {
              if (await transition(tx, bookingId, state, "CHANGE_REQUESTED", source, "Ruteendring fra flyselskapet oppdaget")) state = "CHANGE_REQUESTED";
            }
            const fingerprint = scheduleChangeFingerprint(diffs);
            queue(async () => {
              await enqueueJob(
                "send_email",
                {
                  kind: "schedule_change",
                  to: booking.contactEmail,
                  locale: "nb",
                  bookingId,
                  payload: {
                    firstName: payload.passengers?.[0]?.givenName,
                    bookingReference: booking.bookingReference,
                    note: "Flyselskapet har endret rutetidene dine. Se ny plan under — ta kontakt hvis den nye tiden ikke passer.",
                    oldSegments: diffs.filter((d) => d.old).map((d) => describeSegment(d.old!)),
                    newSegments: diffs.filter((d) => d.new).map((d) => describeSegment(d.new!)),
                  },
                },
                { dedupeKey: `schedule-change:${bookingId}:${fingerprint}` },
              ).catch(() => {});
              await enqueueJob(
                "send_email",
                {
                  kind: "ops_alert",
                  subject: `Ruteendring: ${booking.bookingReference || booking.orderId}`,
                  body: `Flyselskapet har endret ${diffs.length} segment(er) på booking ${bookingId}. Kunden er varslet. Følg opp i admin → Ruteendringer.`,
                },
                { dedupeKey: `schedule-change-ops:${bookingId}:${fingerprint}` },
              ).catch(() => {});
              await logAudit({ actorType: "worker", actorId: source, action: "booking.schedule_change_detected", targetType: "booking", targetId: bookingId, metadata: { changes: diffs.length, fingerprint } });
            });
          }
        }
      }

      await tx.update(bookings).set({ lastReconciledAt: new Date() }).where(eq(bookings.id, bookingId));
    });

    for (const fn of after) {
      try {
        await fn();
      } catch (err) {
        log.error({ err, bookingId }, "Avstemming: sideeffekt etter commit feilet");
      }
    }
  });
}

// ─── Periodisk sweep ───────────────────────────────────────────────────────

/** Sist ankomst (epoch ms) for en booking ut fra segmentene, tolket i ankomstflyplassens sone. */
async function lastArrivalMs(db: DbOrTx, bookingId: number): Promise<number | null> {
  const rows = await db.select({ arr: bookingSegments.arrivingAt, dest: bookingSegments.destinationIata }).from(bookingSegments).where(eq(bookingSegments.bookingId, bookingId));
  let max: number | null = null;
  for (const r of rows) {
    const t = segmentInstant(r.arr, zoneFor(r.dest));
    if (t !== null && (max === null || t > max)) max = t;
  }
  return max;
}

/** Forsøk som har stått i SUPPLIER_ORDERING/SUPPLIER_UNKNOWN lenger enn dette får gjenoppretting fra sweep. */
export const STUCK_ATTEMPT_MS = 5 * 60_000;

/** Bredde (ms) SQL-vinduet utvides med før presis tidssonefiltrering i JS. */
const TZ_SLACK_MS = 15 * 60 * 60_000;

export async function sweepBookings(): Promise<void> {
  const db = getDb();
  const now = Date.now();
  const round = new Date(now).toISOString().slice(0, 16); // per-minutt dedupe for denne runden

  // 1) Avstem aktive + snarlige avreiser (maks 50, eldst avstemt først)
  const in7d = new Date(now + 7 * 24 * 60 * 60_000 + TZ_SLACK_MS).toISOString();
  const nowIso = new Date(now - TZ_SLACK_MS).toISOString();
  const soon = db
    .select({ id: bookingSegments.bookingId })
    .from(bookingSegments)
    .where(and(sql`${bookingSegments.departingAt} >= ${nowIso}`, sql`${bookingSegments.departingAt} <= ${in7d}`));
  const candidates = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.supplier, "duffel"),
        or(inArray(bookings.state, ACTIVE_STATES), and(eq(bookings.state, "CONFIRMED"), inArray(bookings.id, soon))),
      ),
    )
    .orderBy(sql`${bookings.lastReconciledAt} IS NULL DESC`, asc(bookings.lastReconciledAt))
    .limit(50);
  for (const b of candidates) {
    await enqueueJob("reconcile_order", { bookingId: b.id }, { dedupeKey: `reconcile:${b.id}` }).catch(() => {});
  }

  // 1b) Booking-forsøk som sitter fast i SUPPLIER_ORDERING/SUPPLIER_UNKNOWN (> 5 min) → gjenoppretting (B3)
  try {
    const stuck = await db
      .select({ id: bookingAttempts.id })
      .from(bookingAttempts)
      .where(and(inArray(bookingAttempts.state, ["SUPPLIER_ORDERING", "SUPPLIER_UNKNOWN"]), lt(bookingAttempts.updatedAt, new Date(now - STUCK_ATTEMPT_MS))))
      .limit(100);
    for (const a of stuck) {
      await enqueueJob("recover_attempt", { attemptId: a.id }, { dedupeKey: `recover:${a.id}:sweep:${round}`, priority: 1 }).catch(() => {});
    }
    if (stuck.length) log.warn({ count: stuck.length }, "sweep: fastlåste booking-forsøk sendt til gjenoppretting");
  } catch (err) {
    log.warn({ err }, "sweep: kunne ikke skanne fastlåste forsøk");
  }

  // 2) Utløp gamle checkout-sesjoner
  try {
    const { expireStaleSessions } = await import("../checkout");
    await expireStaleSessions();
  } catch (err) {
    log.warn({ err }, "sweep: kunne ikke utløpe sesjoner");
  }

  // 3) TRAVELLED når siste ankomst er > 24 t siden (B1: henvisningsbonus på kundekontoen, ikke booking-ID)
  const travelled = await db
    .select({ id: bookings.id, customerAccountId: bookings.customerAccountId })
    .from(bookings)
    .where(and(inArray(bookings.state, ["CONFIRMED", "PARTIALLY_REFUNDED", "CHANGE_REQUESTED"]), isNull(bookings.travelCompletedAt)))
    .limit(200);
  for (const b of travelled) {
    const last = await lastArrivalMs(db, b.id);
    if (last === null || last > now - 24 * 60 * 60_000) continue;
    const [row] = await db.select({ state: bookings.state }).from(bookings).where(eq(bookings.id, b.id)).limit(1);
    if (!row) continue;
    const moved = await transition(db, b.id, row.state, "TRAVELLED", "sweep", "Reisen er gjennomført");
    if (moved) {
      await db.update(bookings).set({ travelCompletedAt: new Date(last) }).where(eq(bookings.id, b.id));
      if (b.customerAccountId) {
        try {
          const { creditReferralBonusIfEligible } = await import("../customerAuth");
          await creditReferralBonusIfEligible(b.customerAccountId);
        } catch (err) {
          log.warn({ err, bookingId: b.id, customerAccountId: b.customerAccountId }, "sweep: henvisningsbonus feilet");
        }
      }
    }
  }

  // 4) Rydd utløpte sesjoner/tokens/koder + arkivering/anonymisering (OTA-141/109)
  try {
    const { runRetention } = await import("./retention");
    await runRetention();
  } catch (err) {
    log.warn({ err }, "sweep: retention feilet");
  }

  // 5) Reisepåminnelse T-24h (dedupe per booking + segment). SQL-vindu utvides med tidssoneslakk,
  //    presis filtrering i JS med avgangsflyplassens sone.
  const from = new Date(now + 23 * 60 * 60_000 - TZ_SLACK_MS).toISOString();
  const to = new Date(now + 25 * 60 * 60_000 + TZ_SLACK_MS).toISOString();
  const upcoming = await db
    .select({ bookingId: bookingSegments.bookingId, departingAt: bookingSegments.departingAt, origin: bookingSegments.originIata, seg: bookingSegments.segmentIndex })
    .from(bookingSegments)
    .innerJoin(bookings, eq(bookings.id, bookingSegments.bookingId))
    .where(and(eq(bookings.state, "CONFIRMED"), eq(bookingSegments.segmentIndex, 0), sql`${bookingSegments.departingAt} >= ${from}`, sql`${bookingSegments.departingAt} <= ${to}`))
    .limit(200);
  for (const u of upcoming) {
    const [b] = await db.select().from(bookings).where(eq(bookings.id, u.bookingId)).limit(1);
    if (!b) continue;
    const order = parseOrder(b.payload);
    const tz = zoneFor(u.origin, order?.slices?.[0]?.origin?.timeZone);
    const dep = segmentInstant(u.departingAt, tz);
    if (dep === null || dep < now + 23 * 60 * 60_000 || dep > now + 25 * 60 * 60_000) continue;
    await enqueueJob(
      "send_email",
      {
        kind: "trip_reminder",
        to: b.contactEmail,
        locale: "nb",
        bookingId: b.id,
        payload: {
          bookingReference: b.bookingReference,
          departingAt: u.departingAt ?? "",
          firstName: order?.passengers?.[0]?.givenName ?? "",
          route: order?.slices?.map((s) => `${s.origin.iata} → ${s.destination.iata}`).join(" · ") ?? "",
        },
      },
      { dedupeKey: `trip-reminder:${b.id}:${(u.departingAt ?? "").slice(0, 10)}` },
    ).catch(() => {});
  }

  // 6) Utløpte tilbud (quotes)
  try {
    const { quotes } = await import("../../db/schema");
    await db.update(quotes).set({ status: "expired" }).where(and(inArray(quotes.status, ["draft", "sent"]), lt(quotes.expiresAt, new Date())));
  } catch (err) {
    log.warn({ err }, "sweep: kunne ikke utløpe tilbud");
  }
}
