import { z } from "zod";
import { and, count, desc, eq, gte, inArray, lt, sql, type AnyColumn } from "drizzle-orm";
import { createRouter, permittedProcedure } from "./middleware";
import { getDb } from "./queries/connection";
import { affiliateConversions, bookings, checkoutSessions, customerAccounts, priceAlerts, providerClicks, searchEvents } from "../db/schema";
import { flightProvidersStatus } from "./lib/flightProviders";
import { airportCity } from "./lib/airportMeta";

/**
 * Tallene en eier faktisk spør om.
 *
 * Driftsoversikten (`admin.dashboard`) svarer på «hva må gjøres i dag».
 * Denne svarer på «hvordan går selskapet», og det er et annet spørsmål med
 * andre tall.
 *
 * Tre regler gjelder alt her:
 *
 *  1. **Bruttoverdi er ikke inntekt.** Summen av det folk klikket seg videre
 *     med er reisens verdi hos leverandøren, ikke penger HelloSky har tjent.
 *     De to står i hvert sitt felt og blir aldri lagt sammen.
 *  2. **Estimat er ikke bekreftet.** Provisjon summeres per status, aldri i
 *     én sum. Et estimat kan forsvinne; en utbetaling kan ikke.
 *  3. **Umålt er ikke null.** Et steg vi ikke måler ennå svarer
 *     `measured: false`, ikke 0. Forskjellen er hele poenget: null betyr at
 *     ingen gjorde det, umålt betyr at vi ikke vet.
 */

const PERIODS = ["today", "7d", "30d", "90d", "year"] as const;
type Period = (typeof PERIODS)[number];

const DAY_MS = 24 * 60 * 60_000;

/** Perioden og den forrige like lange, slik at «mot forrige» er sammenlignbart. */
function windowFor(period: Period): { from: Date; to: Date; prevFrom: Date; prevTo: Date; days: number } {
  const to = new Date();
  const from = new Date();
  if (period === "today") from.setHours(0, 0, 0, 0);
  else if (period === "7d") from.setTime(to.getTime() - 7 * DAY_MS);
  else if (period === "30d") from.setTime(to.getTime() - 30 * DAY_MS);
  else if (period === "90d") from.setTime(to.getTime() - 90 * DAY_MS);
  else from.setTime(to.getTime() - 365 * DAY_MS);
  const span = to.getTime() - from.getTime();
  return { from, to, prevFrom: new Date(from.getTime() - span), prevTo: from, days: Math.max(1, Math.round(span / DAY_MS)) };
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const adminOwnerRouter = createRouter({
  /**
   * Alt forsiden trenger, i ett kall.
   *
   * Én runde til databasen i stedet for tolv gjør siden rask, men det er
   * ikke hovedgrunnen: tallene skal være hentet i samme øyeblikk. Et
   * dashbord der klikkene er fra nå og søkene fra ti sekunder siden svarer
   * feil på «hvor mange av søkene ble til klikk».
   */
  summary: permittedProcedure("company:read")
    .input(z.object({ period: z.enum(PERIODS).default("30d") }))
    .query(async ({ input }) => {
      const db = getDb();
      const { from, to, prevFrom, prevTo, days } = windowFor(input.period);

      // Én vindusdefinisjon for alle tabellene, så perioden ikke kan gli fra
      // hverandre mellom to spørringer.
      const inWindow = <T extends AnyColumn>(col: T) => and(gte(col, from), lt(col, to));
      const inPrev = <T extends AnyColumn>(col: T) => and(gte(col, prevFrom), lt(col, prevTo));

      const [
        searchNow,
        searchPrev,
        noResultNow,
        clickNow,
        clickPrev,
        clickValue,
        commissionRows,
        topRouteRows,
        noResultRouteRows,
        providerRows,
        firstSearch,
        firstClick,
        conversionCount,
        newCustomers,
        activeAlerts,
        directSales,
        bookingsNow,
        bookingsPrev,
        serviceFees,
        bookingCustomers,
      ] = await Promise.all([
        db.select({ n: count() }).from(searchEvents).where(inWindow(searchEvents.createdAt)),
        db.select({ n: count() }).from(searchEvents).where(inPrev(searchEvents.createdAt)),
        db.select({ n: count() }).from(searchEvents).where(and(inWindow(searchEvents.createdAt), eq(searchEvents.resultCount, 0))),
        db.select({ n: count() }).from(providerClicks).where(inWindow(providerClicks.createdAt)),
        db.select({ n: count() }).from(providerClicks).where(inPrev(providerClicks.createdAt)),
        // Bruttoverdi på det folk klikket videre med. Ikke inntekt.
        db
          .select({ currency: providerClicks.currency, total: sql<string>`COALESCE(SUM(${providerClicks.shownPriceMinor}), 0)`, n: count() })
          .from(providerClicks)
          .where(and(inWindow(providerClicks.createdAt), eq(providerClicks.sandbox, false)))
          .groupBy(providerClicks.currency),
        // Provisjon per status. Aldri summert på tvers.
        db
          .select({ status: affiliateConversions.status, currency: affiliateConversions.currency, total: sql<string>`COALESCE(SUM(${affiliateConversions.commissionMinor}), 0)`, n: count() })
          .from(affiliateConversions)
          .where(and(gte(affiliateConversions.reportedAt, from), lt(affiliateConversions.reportedAt, to)))
          .groupBy(affiliateConversions.status, affiliateConversions.currency),
        db
          .select({ origin: searchEvents.originIata, destination: searchEvents.destinationIata, n: count() })
          .from(searchEvents)
          .where(inWindow(searchEvents.createdAt))
          .groupBy(searchEvents.originIata, searchEvents.destinationIata)
          .orderBy(desc(count()))
          .limit(8),
        db
          .select({ origin: searchEvents.originIata, destination: searchEvents.destinationIata, n: count() })
          .from(searchEvents)
          .where(and(inWindow(searchEvents.createdAt), eq(searchEvents.resultCount, 0)))
          .groupBy(searchEvents.originIata, searchEvents.destinationIata)
          .orderBy(desc(count()))
          .limit(6),
        db
          .select({
            provider: searchEvents.provider,
            searches: count(),
            errors: sql<string>`SUM(CASE WHEN ${searchEvents.errorCode} IS NOT NULL THEN 1 ELSE 0 END)`,
            empty: sql<string>`SUM(CASE WHEN ${searchEvents.resultCount} = 0 THEN 1 ELSE 0 END)`,
            avgMs: sql<string>`COALESCE(ROUND(AVG(${searchEvents.durationMs})), 0)`,
          })
          .from(searchEvents)
          .where(inWindow(searchEvents.createdAt))
          .groupBy(searchEvents.provider),
        db.select({ at: sql<string>`MIN(${searchEvents.createdAt})` }).from(searchEvents),
        db.select({ at: sql<string>`MIN(${providerClicks.createdAt})` }).from(providerClicks),
        db.select({ n: count() }).from(affiliateConversions),
        db.select({ n: count() }).from(customerAccounts).where(and(gte(customerAccounts.createdAt, from), lt(customerAccounts.createdAt, to))),
        db.select({ n: count() }).from(priceAlerts).where(eq(priceAlerts.active, true)),
        db
          .select({ currency: bookings.totalCurrency, total: sql<string>`COALESCE(SUM(${bookings.totalAmount}), 0)`, n: count() })
          .from(bookings)
          .where(and(gte(bookings.createdAt, from), lt(bookings.createdAt, to), inArray(bookings.state, ["CONFIRMED", "TRAVELLED", "CHANGE_REQUESTED", "PARTIALLY_REFUNDED"])))
          .groupBy(bookings.totalCurrency),
        db.select({ n: count() }).from(bookings).where(inWindow(bookings.createdAt)),
        db.select({ n: count() }).from(bookings).where(inPrev(bookings.createdAt)),
        // Servicegebyret er HelloSkys egne penger, i motsetning til reisens pris.
        db
          .select({ currency: checkoutSessions.currency, total: sql<string>`COALESCE(SUM(${checkoutSessions.serviceFeeAmountMinor}), 0)` })
          .from(checkoutSessions)
          .where(and(inWindow(checkoutSessions.createdAt), eq(checkoutSessions.status, "confirmed")))
          .groupBy(checkoutSessions.currency),
        // «Aktive kunder» i mockupen er udefinert. Dette er definert: kunder
        // med minst én bestilling i perioden.
        db
          .select({ n: sql<string>`COUNT(DISTINCT ${bookings.customerId})` })
          .from(bookings)
          .where(and(inWindow(bookings.createdAt), inArray(bookings.state, ["CONFIRMED", "TRAVELLED", "CHANGE_REQUESTED", "PARTIALLY_REFUNDED"]))),
      ]);

      const searches = num(searchNow[0]?.n);
      const clicks = num(clickNow[0]?.n);
      const noResults = num(noResultNow[0]?.n);

      /**
       * Målingen startet den dagen den ble skrudd på. Står den datoen inne i
       * perioden, er tallene bare delvis dekkende, og det skal stå – ellers
       * ser en halv måned ut som en hel.
       */
      const trackingSince = firstSearch[0]?.at ? new Date(firstSearch[0].at as string) : null;
      const clicksSince = firstClick[0]?.at ? new Date(firstClick[0].at as string) : null;
      const partialPeriod = trackingSince !== null && trackingSince > from;

      /**
       * HelloSkys inntekt.
       *
       * To kilder, begge våre: servicegebyret på egen kasse, og provisjonen
       * en leverandør faktisk har utbetalt. De summeres – begge er penger vi
       * beholder. Bruttoverdien på reisen er det ikke, og den er aldri med.
       * Estimert og bekreftet provisjon er heller ikke med: de er ikke penger
       * før de er utbetalt.
       */
      const feeByCurrency = new Map<string, number>();
      for (const r of serviceFees) feeByCurrency.set(String(r.currency ?? "NOK"), num(r.total));
      const paidByCurrency = new Map<string, number>();
      for (const r of commissionRows) {
        if (String(r.status) !== "paid") continue;
        const cur = String(r.currency ?? "NOK");
        paidByCurrency.set(cur, (paidByCurrency.get(cur) ?? 0) + num(r.total));
      }
      const revenue = [...new Set([...feeByCurrency.keys(), ...paidByCurrency.keys()])].map((currency) => ({
        currency,
        serviceFeeMinor: feeByCurrency.get(currency) ?? 0,
        paidCommissionMinor: paidByCurrency.get(currency) ?? 0,
        totalMinor: (feeByCurrency.get(currency) ?? 0) + (paidByCurrency.get(currency) ?? 0),
      }));

      const commission = commissionRows.map((r) => ({
        status: String(r.status),
        currency: r.currency ?? null,
        amountMinor: num(r.total),
        count: num(r.n),
      }));

      return {
        period: { key: input.period, from: from.toISOString(), to: to.toISOString(), days },
        /** Når målingen faktisk begynte. Null = ingenting målt ennå. */
        tracking: {
          searchesSince: trackingSince?.toISOString() ?? null,
          clicksSince: clicksSince?.toISOString() ?? null,
          conversionsReported: num(conversionCount[0]?.n),
          partialPeriod,
        },
        demand: {
          searches: { value: searches, previous: num(searchPrev[0]?.n) },
          clicks: { value: clicks, previous: num(clickPrev[0]?.n) },
          noResults,
          /** Andel søk som ble til et klikk ut. Null når det ikke er søk å dele på. */
          clickThrough: searches > 0 ? clicks / searches : null,
          bookings: { value: num(bookingsNow[0]?.n), previous: num(bookingsPrev[0]?.n) },
        },
        money: {
          /** Bruttoverdi på reisene folk klikket videre med. Ikke HelloSkys penger. */
          clickedValue: clickValue.map((r) => ({ currency: r.currency ?? null, amountMinor: num(r.total), count: num(r.n) })),
          /** Provisjon per status – estimert, bekreftet, utbetalt, reversert. */
          commission,
          /** Direktesalg gjennom HelloSkys egen kasse (Duffel-modellen). */
          directSales: directSales.map((r) => ({ currency: String(r.currency), amountMajor: num(r.total), count: num(r.n) })),
          /** HelloSkys egne penger: gebyr + utbetalt provisjon. Se kommentaren over. */
          revenue,
        },
        /**
         * Trakten. `measured: false` betyr at vi ikke måler steget ennå –
         * ikke at ingen gjorde det.
         */
        funnel: [
          { stage: "searches", count: searches, measured: true },
          { stage: "results", count: searches - noResults, measured: true },
          { stage: "clicks", count: clicks, measured: true },
          { stage: "conversions", count: num(conversionCount[0]?.n), measured: num(conversionCount[0]?.n) > 0 },
          { stage: "commission", count: commission.filter((c) => c.status === "paid").length, measured: commission.some((c) => c.status === "paid") },
        ],
        /**
         * Bynavnene løses her, ikke i nettleseren: flyplasstabellen er stor,
         * og den har ingenting å gjøre i kundens – eller eierens – JS-bunt.
         */
        topRoutes: topRouteRows.map((r) => ({
          origin: String(r.origin),
          destination: String(r.destination),
          originCity: airportCity(String(r.origin)),
          destinationCity: airportCity(String(r.destination)),
          searches: num(r.n),
        })),
        noResultRoutes: noResultRouteRows.map((r) => ({
          origin: String(r.origin),
          destination: String(r.destination),
          originCity: airportCity(String(r.origin)),
          destinationCity: airportCity(String(r.destination)),
          searches: num(r.n),
        })),
        providerUsage: providerRows
          .filter((r) => r.provider)
          .map((r) => ({
            provider: String(r.provider),
            searches: num(r.searches),
            errors: num(r.errors),
            emptyResults: num(r.empty),
            avgMs: num(r.avgMs),
          })),
        audience: {
          newCustomers: num(newCustomers[0]?.n),
          activePriceAlerts: num(activeAlerts[0]?.n),
          /** Kunder med minst én bestilling i perioden. Definert, i motsetning til «aktive». */
          bookingCustomers: num(bookingCustomers[0]?.n),
        },
        /**
         * Live leverandørstatus – spurt nå, ikke lagret. «sandbox: null»
         * betyr at vi ikke vet for den leverandøren, ikke at den er ekte.
         */
        providers: (() => {
          const st = flightProvidersStatus();
          return st.selectable.map((id) => ({
            id,
            active: id === st.active,
            sandbox: id === "kayak" ? st.kayak.mode === "sandbox" : null,
          }));
        })(),
      };
    }),

  /**
   * Én linje per dag: søk og bestillinger.
   *
   * Grafen er den eneste flaten i panelet som viser utvikling over tid, og da
   * må dagene være komplette. Databasen returnerer bare dager som har rader,
   * så hullene fylles her – en dag uten søk er 0, ikke et brudd i kurven.
   */
  series: permittedProcedure("company:read")
    .input(z.object({ period: z.enum(PERIODS).default("30d") }))
    .query(async ({ input }) => {
      const db = getDb();
      const { from, to, days } = windowFor(input.period);

      const [searchRows, bookingRows] = await Promise.all([
        db
          .select({ day: sql<string>`DATE(${searchEvents.createdAt})`, n: count() })
          .from(searchEvents)
          .where(and(gte(searchEvents.createdAt, from), lt(searchEvents.createdAt, to)))
          .groupBy(sql`DATE(${searchEvents.createdAt})`),
        db
          .select({ day: sql<string>`DATE(${bookings.createdAt})`, n: count() })
          .from(bookings)
          .where(and(gte(bookings.createdAt, from), lt(bookings.createdAt, to)))
          .groupBy(sql`DATE(${bookings.createdAt})`),
      ]);

      const key = (d: Date) => d.toISOString().slice(0, 10);
      const searchBy = new Map(searchRows.map((r) => [String(r.day).slice(0, 10), num(r.n)]));
      const bookingBy = new Map(bookingRows.map((r) => [String(r.day).slice(0, 10), num(r.n)]));

      // Maks 90 punkter. Et år på dagnivå er 365 piksler bred støy; da
      // grupperes det i uker i stedet.
      const step = days > 120 ? 7 : 1;
      const points: { day: string; searches: number; bookings: number }[] = [];
      const start = new Date(from);
      start.setHours(0, 0, 0, 0);
      for (let t = start.getTime(); t < to.getTime(); t += step * DAY_MS) {
        let searches = 0;
        let bookingCount = 0;
        for (let i = 0; i < step; i++) {
          const d = key(new Date(t + i * DAY_MS));
          searches += searchBy.get(d) ?? 0;
          bookingCount += bookingBy.get(d) ?? 0;
        }
        points.push({ day: key(new Date(t)), searches, bookings: bookingCount });
      }

      return { period: { key: input.period, days, step }, points };
    }),
});
