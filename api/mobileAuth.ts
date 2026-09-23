import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { createRouter, customerProcedure, publicQuery } from "./middleware";
import type { TrpcContext } from "./context";
import { getDb } from "./queries/connection";
import { customerAccounts } from "../db/schema";
import {
  confirmPhoneChange,
  LOCALES,
  loginCodeRequestInput,
  loginCodeVerifyInput,
  loginInput,
  parseIdentifier,
  passwordLogin,
  phoneChangeConfirmInput,
  phoneChangeRequestInput,
  profileInput,
  profilePatch,
  publicProfile,
  registerCustomer,
  registerInput,
  requestPasswordReset,
  requestPhoneChange,
  sendLoginCode,
  socialLogin,
  socialTokenInput,
  verifyLoginCodeLogin,
  type SessionIssuer,
} from "./customerAuth";
import { deleteCustomerAccount } from "./lib/customerDeletion";
import { issueCustomerSession, revokeAllCustomerSessions, revokeCustomerSession } from "./lib/customerSessions";
import { clientIp } from "./lib/ratelimit";
import { logAudit } from "./lib/audit";
import { AppError } from "./lib/errors";
import type { CustomerProfile, MobileAuthResult, MobileOkResult, MobileSession, MobileSocialAuthResult } from "../contracts/mobileAuth";

// ─── Kundeinnlogging for appen ───────────────────────────────────────────────
// Samme innloggingsveier som nettet (customerAuth), men sesjonen leveres som
// et opakt token i svaret i stedet for en cookie. Appen sender det tilbake som
// `Authorization: Bearer <token>`. Tokenet er det samme som ligger i cookien
// på nett: 32 tilfeldige byte, kun SHA-256-hashen lagres i customer_sessions,
// 30 dagers levetid, og det kan tilbakekalles som alle andre kundesesjoner.
// Ingen Set-Cookie herfra, og ingenting her gir staff-tilgang.
//
// Kontoens livsløp går også gjennom nettets tjenester: requestPasswordReset
// (samme lenke til nettsiden), profilePatch (samme validering) og
// deleteCustomerAccount (api/lib/customerDeletion.ts, samme transaksjon).
// Et nytt telefonnummer (en innloggingsvei) lagres bare etter passord og en
// SMS-kode til nummeret (requestPhoneChange/confirmPhoneChange), og sletting
// av en konto uten passord krever en fersk innlogging.

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

/** Glemt passord fra appen: e-post eller telefon (som innloggingen), og språket appen vises på. */
export const mobilePasswordResetInput = z.object({ identifier: z.string().min(3).max(255), locale: z.enum(LOCALES).optional() });

/**
 * Samme felt og regler som nettets profilside (customerAuth.updateProfile),
 * pluss språk. Et nytt telefonnummer lagres ikke her – det går gjennom
 * requestPhoneChange/confirmPhoneChange.
 */
export const mobileUpdateProfileInput = profileInput.extend({ locale: z.enum(LOCALES).optional() });

/** Nytt telefonnummer, steg 1 og 2 (se api/customerAuth.ts). */
export const mobileRequestPhoneChangeInput = phoneChangeRequestInput;
export const mobileConfirmPhoneChangeInput = phoneChangeConfirmInput;

/**
 * Sletting krever at kunden bekrefter på nytt: passordet, eller – for kontoer
 * uten passord (Apple/Google) – en fersk innlogging (logget inn på nytt de
 * siste 10 minuttene) pluss ordet DELETE eller SLETT. Samme tjeneste som
 * nettet (api/lib/customerDeletion.ts).
 */
export const mobileDeleteAccountInput = z.object({
  password: z.string().min(1).max(128).optional(),
  confirmation: z.string().max(16).optional(),
});

async function currentProfile(customerId: number): Promise<CustomerProfile | null> {
  const [acc] = await getDb()
    .select()
    .from(customerAccounts)
    .where(and(eq(customerAccounts.id, customerId), isNull(customerAccounts.deletedAt)))
    .limit(1);
  return acc ? publicProfile(acc) : null;
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
    return currentProfile(ctx.customer.customerId);
  }),

  /**
   * Glemt passord: nøyaktig nettets vei (samme tokentabell, e-post og
   * rategrenser). Svaret er alltid { ok: true } – også for ukjente, slettede
   * og ansattes adresser og for telefonnumre (lenken sendes bare på e-post).
   * Selve tilbakestillingen skjer på nettsiden lenken peker til.
   */
  requestPasswordReset: publicQuery.input(mobilePasswordResetInput).mutation(async ({ input, ctx }): Promise<MobileOkResult> => {
    await requestPasswordReset(parseIdentifier(input.identifier), ctx, { locale: input.locale });
    return { ok: true };
  }),

  /**
   * Navn og språk – samme validering som nettet – og fjerning av
   * telefonnummeret. Et annet nummer enn dagens gir VALIDATION (field: phone,
   * reason: phone_verification_required): bruk requestPhoneChange. Svarer med
   * profilen i samme form som me.
   */
  updateProfile: customerProcedure.input(mobileUpdateProfileInput).mutation(async ({ input, ctx }): Promise<CustomerProfile> => {
    const { locale, ...profile } = input;
    const patch = await profilePatch(ctx.customer, profile);
    if (locale) patch.locale = locale;
    await getDb().update(customerAccounts).set(patch).where(eq(customerAccounts.id, ctx.customer.customerId));
    const fresh = await currentProfile(ctx.customer.customerId);
    if (!fresh) throw new AppError("NOT_FOUND");
    return fresh;
  }),

  /**
   * Nytt telefonnummer, steg 1: passord (konto uten passord: fersk
   * innlogging) og en SMS-kode til det nye nummeret. Svaret er alltid
   * { ok: true } – også når nummeret brukes av en annen konto (da får det
   * nummeret en melding og ingen kode).
   */
  requestPhoneChange: customerProcedure.input(mobileRequestPhoneChangeInput).mutation(async ({ input, ctx }): Promise<MobileOkResult> => {
    await requestPhoneChange(ctx.customer, input, ctx);
    return { ok: true };
  }),

  /**
   * Nytt telefonnummer, steg 2: koden fra SMS-en lagrer nummeret. Andre
   * sesjoner (nett og app) logges ut; dette tokenet fortsetter å virke.
   */
  confirmPhoneChange: customerProcedure.input(mobileConfirmPhoneChangeInput).mutation(async ({ input, ctx }): Promise<CustomerProfile> => {
    await confirmPhoneChange(ctx.customer, input, ctx);
    const fresh = await currentProfile(ctx.customer.customerId);
    if (!fresh) throw new AppError("NOT_FOUND");
    return fresh;
  }),

  /**
   * Slett kontoen: samme tjeneste og samme sletting som nettet (se
   * CUSTOMER_DATA_MATRIX i api/lib/customerDeletion.ts), i én transaksjon, og
   * alle sesjoner – app og nett – tilbakekalles. Feil passord endrer
   * ingenting (UNAUTHORIZED med field: password). En konto uten passord må ha
   * logget inn på nytt de siste 10 minuttene (ellers FORBIDDEN, reason:
   * reauth_required).
   */
  deleteAccount: customerProcedure.input(mobileDeleteAccountInput).mutation(async ({ input, ctx }): Promise<MobileOkResult> => {
    // Appen kan be engelsktalende kunder skrive DELETE; tjenesten forstår SLETT.
    const confirmation = input.confirmation?.trim().toUpperCase() === "DELETE" ? "SLETT" : input.confirmation;
    await deleteCustomerAccount(ctx.customer.customerId, { password: input.password, confirmation }, {
      ip: clientIp(ctx.req),
      via: "mobile",
      // Et token kan leve i 30 dager; for en konto uten passord er en fersk innlogging beviset på at det er eieren.
      recentAuthForPasswordless: ctx.customer.sessionCreatedAt,
    });
    ctx.resHeaders.set("cache-control", "no-store");
    return { ok: true };
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
