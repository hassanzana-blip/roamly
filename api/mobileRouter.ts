import { createRouter, publicQuery } from "./middleware";
import { mobileAuthRouter } from "./mobileAuth";
import { mobileFlightsRouter } from "./mobileFlights";
import { mobileHotelsRouter } from "./mobileHotels";

/**
 * Appens API (/api/mobile/trpc): fly- og hotellsøk/sammenligning og vanlig kundekonto.
 *
 * Bare det iOS-utgaven faktisk bruker er montert. flights er appens egen
 * variant (api/mobileFlights.ts): flyplassøk, søk med NOK-sammenligningspris
 * og nettets egen klikkmåling før kunden sendes til leverandøren.
 * mobileAuth (api/mobileAuth.ts) er innlogging og kontoens livsløp – glemt
 * passord, profil, nytt telefonnummer (passord + SMS-kode) og sletting – over
 * nøyaktig samme tjenester og kunder som nettet, med Bearer-token i stedet for
 * cookie.
 * hotels (api/mobileHotels.ts) er nettets hotellsøk – status, stedsøk, søk og
 * detaljer – med valuta låst til NOK; bestillingen skjer hos leverandøren.
 * Bestilling (checkout, orders), prisovervåking, reiseplaner, nettets
 * account-/customerAuth-rutere og alle interne ruter (staffAuth, admin,
 * team, partners, expenses …) finnes ikke her – de kan verken kalles eller ses
 * i typen appen bygger mot. Konteksten (createMobileContext) leser dessuten
 * aldri staff-cookien. Nettets /api/trpc og appRouter er uendret.
 */
export const mobileAppRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  mobileAuth: mobileAuthRouter,
  flights: mobileFlightsRouter,
  hotels: mobileHotelsRouter,
});

export type MobileAppRouter = typeof mobileAppRouter;
