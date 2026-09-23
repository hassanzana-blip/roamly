import { createRouter, publicQuery } from "./middleware";
import { mobileAuthRouter } from "./mobileAuth";
import { mobileFlightsRouter } from "./mobileFlights";

/**
 * Appens API (/api/mobile/trpc): flysøk/sammenligning og vanlig kundeinnlogging.
 *
 * Bare det iOS-utgaven faktisk bruker er montert. flights er appens egen
 * variant (api/mobileFlights.ts): flyplassøk og søk med NOK-sammenligningspris.
 * Bestilling (checkout, orders), konto, prisovervåking, reiseplaner og alle
 * interne ruter (staffAuth, admin,
 * team, partners, expenses …) finnes ikke her – de kan verken kalles eller ses
 * i typen appen bygger mot. Konteksten (createMobileContext) leser dessuten
 * aldri staff-cookien. Nettets /api/trpc og appRouter er uendret.
 */
export const mobileAppRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  mobileAuth: mobileAuthRouter,
  flights: mobileFlightsRouter,
});

export type MobileAppRouter = typeof mobileAppRouter;
