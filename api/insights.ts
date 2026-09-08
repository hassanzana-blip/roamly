import { z } from "zod";
import { and, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { permittedProcedure } from "./middleware";
import { getDb } from "./queries/connection";
import { bookingSegments, bookings, checkoutSessions, refundCases } from "../db/schema";
import { airportCity } from "./lib/airportMeta";

/**
 * Tallene bak driften.
 *
 * Rapportsiden svarte på «hvor mye solgte vi». Den svarte ikke på de fire
 * spørsmålene man faktisk stiller på et mandagsmøte: går det bedre eller
 * dårligere enn sist, hvilke ruter tjener vi penger på, hvorfor refunderer vi,
 * og hvor i kassa faller folk fra.
 *
 * Alt her er spørringer mot ekte rader. Finnes ikke tallet – ingen bookinger i
 * fjor, ingen refusjoner i perioden – returnerer vi tomt og lar grensesnittet
 * si det. Et diagram som fyller seg selv med anslag er verre enn ingen graf,
 * fordi det ser like troverdig ut som et ekte.
 */

/** Tilstander der bestillingen faktisk er solgt (samme sett som salgsrapporten). */
const SOLD_STATES = ["CONFIRMED", "TRAVELLED", "CHANGE_REQUESTED", "PARTIALLY_REFUNDED"];

const DAY_MS = 24 * 60 * 60_000;

export const REFUND_KIND_LABELS: Record<string, string> = {
  customer_cancellation: "Kunden avbestilte",
  airline_cancellation: "Flyselskapet kansellerte",
  schedule_change: "Ruteendring",
  staff_goodwill: "Kulanse fra oss",
};

/**
 * Stegene i kassa, i den rekkefølgen kunden møter dem.
 *
 * `expired`, `failed`, `cancelled` og `price_changed` er ikke steg – de er
 * måter å falle ut på. De telles som frafall ved siste steget sesjonen nådde,
 * og det er nettopp den fordelingen trakten skal vise.
 */
const FUNNEL_STEPS = [
  { key: "created", label: "Startet kassa" },
  { key: "payment_pending", label: "Til betaling" },
  { key: "authorized", label: "Betaling godkjent" },
  { key: "booking", label: "Bestiller hos leverandør" },
  { key: "confirmed", label: "Bekreftet" },
] as const;

const DROPOUT_STATES = ["expired", "failed", "cancelled", "price_changed"];

export const insightsProcedures = {
  insights: permittedProcedure("reports:read")
    .input(z.object({ days: z.number().int().min(7).max(90).default(30) }))
    .query(async ({ input }) => {
      const db = getDb();
      const now = Date.now();
      const span = input.days * DAY_MS;
      const since = new Date(now - span);
      const prevSince = new Date(now - 2 * span);
      /** Samme kalenderperiode ett år tilbake – bare meningsfull når det finnes rader. */
      const yearSince = new Date(now - 365 * DAY_MS - span);
      const yearUntil = new Date(now - 365 * DAY_MS);

      /* ── Salg nå, forrige periode og i fjor ─────────────────────────────── */

      const sumSales = async (from: Date, to?: Date) => {
        const rows = await db
          .select({
            currency: bookings.totalCurrency,
            n: count(),
            total: sql<string>`COALESCE(SUM(${bookings.totalAmount}), 0)`,
          })
          .from(bookings)
          .where(
            and(
              gte(bookings.createdAt, from),
              to ? lt(bookings.createdAt, to) : undefined,
              inArray(bookings.state, SOLD_STATES),
            ),
          )
          .groupBy(bookings.totalCurrency);
        return rows.map((r) => ({ currency: r.currency ?? "NOK", bookings: Number(r.n), total: String(r.total) }));
      };

      const [current, previous, lastYear] = await Promise.all([
        sumSales(since),
        sumSales(prevSince, since),
        sumSales(yearSince, yearUntil),
      ]);

      /* ── Ruter, rangert på det vi faktisk tjener ────────────────────────── */

      /**
       * Marginen vår er servicegebyret, ikke billettprisen – den går videre til
       * flyselskapet. En dyr rute kan være en dårlig rute. Derfor sorteres
       * lista på gebyr, med omsetningen ved siden av som kontekst.
       */
      const routeRows = await db
        .select({
          origin: bookingSegments.originIata,
          destination: bookingSegments.destinationIata,
          n: count(),
          revenue: sql<string>`COALESCE(SUM(${bookings.totalAmount}), 0)`,
          feeMinor: sql<string>`COALESCE(SUM(${checkoutSessions.serviceFeeAmountMinor}), 0)`,
          currency: bookings.totalCurrency,
        })
        .from(bookingSegments)
        .innerJoin(bookings, eq(bookingSegments.bookingId, bookings.id))
        .leftJoin(checkoutSessions, eq(bookings.checkoutSessionId, checkoutSessions.id))
        .where(
          and(
            gte(bookings.createdAt, since),
            inArray(bookings.state, SOLD_STATES),
            // Første segment i første strekning = reisens utgangspunkt.
            eq(bookingSegments.sliceIndex, 0),
            eq(bookingSegments.segmentIndex, 0),
          ),
        )
        .groupBy(bookingSegments.originIata, bookingSegments.destinationIata, bookings.totalCurrency)
        .orderBy(desc(sql`COALESCE(SUM(${checkoutSessions.serviceFeeAmountMinor}), 0)`))
        .limit(8);

      const routes = routeRows.map((r) => ({
        origin: r.origin,
        destination: r.destination,
        label: `${r.origin} → ${r.destination}`,
        city: `${airportCity(r.origin)} – ${airportCity(r.destination)}`,
        bookings: Number(r.n),
        revenue: String(r.revenue),
        feeMinor: Number(r.feeMinor),
        currency: r.currency ?? "NOK",
      }));

      /* ── Hvorfor vi refunderer ──────────────────────────────────────────── */

      const refundRows = await db
        .select({
          kind: refundCases.kind,
          n: count(),
          amountMinor: sql<string>`COALESCE(SUM(${refundCases.customerRefundAmountMinor}), 0)`,
        })
        .from(refundCases)
        .where(gte(refundCases.createdAt, since))
        .groupBy(refundCases.kind)
        .orderBy(desc(count()));

      const refunds = refundRows.map((r) => ({
        kind: r.kind,
        label: REFUND_KIND_LABELS[r.kind] ?? r.kind,
        count: Number(r.n),
        amountMinor: Number(r.amountMinor),
      }));

      /* ── Trakten i kassa ────────────────────────────────────────────────── */

      const sessionRows = await db
        .select({ status: checkoutSessions.status, n: count() })
        .from(checkoutSessions)
        .where(gte(checkoutSessions.createdAt, since))
        .groupBy(checkoutSessions.status);

      const funnel = buildFunnel(sessionRows.map((r) => ({ status: r.status, count: Number(r.n) })));

      /* ── Når på døgnet folk bestiller ───────────────────────────────────── */

      /**
       * MySQL teller ukedager fra søndag (1). Vi flytter til mandag = 0, fordi
       * det er den uka folkene som leser dette faktisk jobber i.
       */
      const heatRows = await db
        .select({
          weekday: sql<number>`(DAYOFWEEK(${bookings.createdAt}) + 5) % 7`,
          hour: sql<number>`HOUR(${bookings.createdAt})`,
          n: count(),
        })
        .from(bookings)
        .where(and(gte(bookings.createdAt, since), inArray(bookings.state, SOLD_STATES)))
        .groupBy(sql`(DAYOFWEEK(${bookings.createdAt}) + 5) % 7`, sql`HOUR(${bookings.createdAt})`);

      const heatmap = heatRows.map((r) => ({ weekday: Number(r.weekday), hour: Number(r.hour), count: Number(r.n) }));

      return {
        days: input.days,
        sales: { current, previous, lastYear },
        routes,
        refunds,
        funnel,
        heatmap,
      };
    }),
};

/**
 * Trakten, regnet ut fra én kolonne.
 *
 * `checkout_sessions.status` husker bare hvor sesjonen endte, ikke hvor den
 * har vært. En sesjon som står på «authorized» har åpenbart også passert
 * «created» og «payment_pending», så hvert steg teller alle som kom minst så
 * langt – ellers ser trakten ut som en tilfeldig søylerekke i stedet for et
 * frafall.
 *
 * Frafallstilstandene sier ikke hvor langt kunden rakk før det røk. De telles
 * som startet, og faller ut med én gang; å gjette hvor de sto ville vært å
 * pynte på tallet.
 */
export function buildFunnel(rows: { status: string; count: number }[]) {
  const order: string[] = FUNNEL_STEPS.map((s) => s.key);
  const byStatus = new Map(rows.map((r) => [r.status, r.count]));
  const started = rows.reduce((sum, r) => sum + r.count, 0);

  const steps = FUNNEL_STEPS.map((step, i) => ({
    key: step.key,
    label: step.label,
    count: rows.reduce((sum, r) => {
      const at = order.indexOf(r.status);
      if (at === -1) return sum + (i === 0 ? r.count : 0);
      return sum + (at >= i ? r.count : 0);
    }, 0),
  }));

  const dropouts = DROPOUT_STATES.map((s) => ({ status: s, count: byStatus.get(s) ?? 0 })).filter((d) => d.count > 0);

  return { started, confirmed: byStatus.get("confirmed") ?? 0, steps, dropouts };
}
