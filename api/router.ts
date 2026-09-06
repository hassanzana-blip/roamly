import { createRouter, publicQuery } from "./middleware";
import { flightsRouter } from "./flights";
import { staffAuthRouter } from "./staffAuth";
import { adminRouter } from "./admin";
import { quotesPublicRouter } from "./quotesPublic";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  flights: flightsRouter,
  staffAuth: staffAuthRouter,
  admin: adminRouter,
  quotesPublic: quotesPublicRouter,
});

export type AppRouter = typeof appRouter;
