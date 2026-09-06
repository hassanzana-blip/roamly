import { createRouter, publicQuery } from "./middleware";
import { flightsRouter } from "./flights";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  flights: flightsRouter,
});

export type AppRouter = typeof appRouter;
