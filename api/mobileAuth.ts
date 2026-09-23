import { and, eq, isNull } from "drizzle-orm";
import { createRouter, customerProcedure, publicQuery } from "./middleware";
import type { TrpcContext } from "./context";
import { getDb } from "./queries/connection";
import { customerAccounts } from "../db/schema";
import {
  loginCodeRequestInput,
  loginCodeVerifyInput,
  loginInput,
  passwordLogin,
  publicProfile,
  registerCustomer,
  registerInput,
  sendLoginCode,
  socialLogin,
  socialTokenInput,
  verifyLoginCodeLogin,
  type SessionIssuer,
} from "./customerAuth";
import { issueCustomerSession, revokeAllCustomerSessions, revokeCustomerSession } from "./lib/customerSessions";
import { clientIp } from "./lib/ratelimit";
import { logAudit } from "./lib/audit";
import type { CustomerProfile, MobileAuthResult, MobileSession, MobileSocialAuthResult } from "../contracts/mobileAuth";

// ─── Kundeinnlogging for appen ───────────────────────────────────────────────
// Samme innloggingsveier som nettet (customerAuth), men sesjonen leveres som
// et opakt token i svaret i stedet for en cookie. Appen sender det tilbake som
// `Authorization: Bearer <token>`. Tokenet er det samme som ligger i cookien
// på nett: 32 tilfeldige byte, kun SHA-256-hashen lagres i customer_sessions,
// 30 dagers levetid, og det kan tilbakekalles som alle andre kundesesjoner.
// Ingen Set-Cookie herfra, og ingenting her gir staff-tilgang.

export type { MobileSession } from "../contracts/mobileAuth";

function tokenIssuer(ctx: TrpcContext) {
  let issued: { token: string; expiresAt: Date } | null = null;
  const issue: SessionIssuer = async (customerId) => {
    issued = await issueCustomerSession(customerId, ctx.req);
  };
  const session = (): MobileSession => {
    if (!issued) throw new Error("mobileAuth: ingen sesjon ble opprettet");
    ctx.resHeaders.set("cache-control", "no-store");
    return { token: issued.token, tokenType: "Bearer", expiresAt: issued.expiresAt.toISOString() };
  };
  return { issue, session };
}

export const mobileAuthRouter = createRouter({
  register: publicQuery.input(registerInput).mutation(async ({ input, ctx }): Promise<MobileAuthResult> => {
    const t = tokenIssuer(ctx);
    const profile = await registerCustomer(input, ctx, t.issue);
    return { session: t.session(), profile };
  }),

  login: publicQuery.input(loginInput).mutation(async ({ input, ctx }): Promise<MobileAuthResult> => {
    const t = tokenIssuer(ctx);
    const profile = await passwordLogin(input, ctx, t.issue);
    return { session: t.session(), profile };
  }),

  requestLoginCode: publicQuery.input(loginCodeRequestInput).mutation(({ input, ctx }) => sendLoginCode(input, ctx)),

  verifyLoginCode: publicQuery.input(loginCodeVerifyInput).mutation(async ({ input, ctx }): Promise<MobileAuthResult> => {
    const t = tokenIssuer(ctx);
    const profile = await verifyLoginCodeLogin(input, ctx, t.issue);
    return { session: t.session(), profile };
  }),

  /** Clerk-token fra appens sosiale innlogging → HelloSky-sesjon (samme koblingsregler som nett). */
  exchangeSocialToken: publicQuery.input(socialTokenInput).mutation(async ({ input, ctx }): Promise<MobileSocialAuthResult> => {
    const t = tokenIssuer(ctx);
    const result = await socialLogin(input, ctx, t.issue);
    return { session: t.session(), ...result };
  }),

  /** Hvem er innlogget med dette tokenet? null når tokenet mangler, er utløpt eller tilbakekalt. */
  me: publicQuery.query(async ({ ctx }): Promise<CustomerProfile | null> => {
    if (!ctx.customer) return null;
    const [acc] = await getDb()
      .select()
      .from(customerAccounts)
      .where(and(eq(customerAccounts.id, ctx.customer.customerId), isNull(customerAccounts.deletedAt)))
      .limit(1);
    return acc ? publicProfile(acc) : null;
  }),

  /** Tilbakekaller sesjonen tokenet tilhører. Idempotent: et allerede ugyldig token gir også ok. */
  logout: publicQuery.mutation(async ({ ctx }): Promise<{ ok: true }> => {
    if (ctx.customer) await revokeCustomerSession(ctx.customer.sessionId);
    return { ok: true };
  }),

  /** Logg ut alle enheter – app og nett. */
  logoutAll: customerProcedure.mutation(async ({ ctx }): Promise<{ ok: true }> => {
    await revokeAllCustomerSessions(ctx.customer.customerId);
    await logAudit({ actorType: "customer", actorId: ctx.customer.customerId, action: "customer.logout_all", targetType: "customer_account", targetId: ctx.customer.customerId, ip: clientIp(ctx.req), metadata: { via: "mobile" } });
    return { ok: true };
  }),
});
