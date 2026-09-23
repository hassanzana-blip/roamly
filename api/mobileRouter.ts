import { createRouter, publicQuery } from "./middleware";
import { mobileAuthRouter } from "./mobileAuth";
import { flightsRouter } from "./flights";

/**
 * Appens API (/api/mobile/trpc): flysøk/sammenligning og vanlig kundeinnlogging.
 *
 * Bare det iOS-utgaven faktisk bruker er montert. Bestilling (checkout, orders),
 * konto, prisovervåking, reiseplaner og alle interne ruter (staffAuth, admin,
 * team, partners, expenses …) finnes ikke her – de kan verken kalles eller ses
 * i typen appen bygger mot. Konteksten (createMobileContext) leser dessuten
 * aldri staff-cookien. Nettets /api/trpc og appRouter er uendret.
 */
export const mobileAppRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  mobileAuth: mobileAuthRouter,
  flights: flightsRouter,
});

export type MobileAppRouter = typeof mobileAppRouter;
