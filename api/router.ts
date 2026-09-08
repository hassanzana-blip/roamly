import { createRouter, publicQuery } from "./middleware";
import { flightsRouter } from "./flights";
import { checkoutRouter } from "./checkout";
import { ordersRouter } from "./orders";
import { staffAuthRouter } from "./staffAuth";
import { customerAuthRouter } from "./customerAuth";
import { extrasRouter } from "./extras";
import { teamRouter } from "./team";
import { partnersRouter } from "./partners";
import { adminRouter } from "./admin";
import { expensesRouter } from "./expenses";
import { quotesPublicRouter } from "./quotesPublic";
import { communityRouter } from "./community";
import { accountRouter } from "./account";
import { watchRouter } from "./watch";
import { matchRouter } from "./match";
import { boardsRouter } from "./boards";

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
  admin: adminRouter,
  expenses: expensesRouter,
  quotesPublic: quotesPublicRouter,
  community: communityRouter,
  account: accountRouter,
  watch: watchRouter,
  match: matchRouter,
  boards: boardsRouter,
});

export type AppRouter = typeof appRouter;
