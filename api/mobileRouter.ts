import { createRouter, publicQuery } from "./middleware";
import { mobileAuthRouter } from "./mobileAuth";
import { flightsRouter } from "./flights";
import { checkoutRouter } from "./checkout";
import { ordersRouter } from "./orders";
import { accountRouter } from "./account";
import { watchRouter } from "./watch";
import { tripPlansRouter } from "./tripPlans";

/**
 * Appens API (/api/mobile/trpc): bare kundevendte ruter for fly.
 *
 * staffAuth, admin, team, partners, expenses og de andre interne rutene finnes
 * ikke her – de kan verken kalles eller ses i typen appen bygger mot. Konteksten
 * (createMobileContext) leser dessuten aldri staff-cookien. Nettets /api/trpc
 * og appRouter er uendret.
 */
export const mobileAppRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  mobileAuth: mobileAuthRouter,
  flights: flightsRouter,
  checkout: checkoutRouter,
  orders: ordersRouter,
  account: accountRouter,
  watch: watchRouter,
  tripPlans: tripPlansRouter,
});

export type MobileAppRouter = typeof mobileAppRouter;
