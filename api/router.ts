import { createRouter, publicQuery } from "./middleware";
import { flightsRouter } from "./flights";
import { checkoutRouter } from "./checkout";
import { ordersRouter } from "./orders";
import { staffAuthRouter } from "./staffAuth";
import { customerAuthRouter } from "./customerAuth";
import { extrasRouter } from "./extras";
import { teamRouter } from "./team";
import { partnersRouter } from "./partners";
import { hotelsRouter } from "./hotels";
import { carsRouter } from "./cars";
import { adminRouter } from "./admin";
import { expensesRouter } from "./expenses";
import { quotesPublicRouter } from "./quotesPublic";
import { communityRouter } from "./community";
import { accountRouter } from "./account";
import { watchRouter } from "./watch";
import { matchRouter } from "./match";
import { boardsRouter } from "./boards";
import { tripPlansRouter } from "./tripPlans";
import { documentsRouter } from "./documents";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  flights: flightsRouter,
  checkout: checkoutRouter,
  orders: ordersRouter,
  staffAuth: staffAuthRouter,
  customerAuth: customerAuthRouter,
  extras: extrasRouter,
  team: teamRouter,
  partners: partnersRouter,
  hotels: hotelsRouter,
  cars: carsRouter,
  admin: adminRouter,
  expenses: expensesRouter,
  quotesPublic: quotesPublicRouter,
  community: communityRouter,
  account: accountRouter,
  watch: watchRouter,
  match: matchRouter,
  boards: boardsRouter,
  tripPlans: tripPlansRouter,
  documents: documentsRouter,
});

export type AppRouter = typeof appRouter;
