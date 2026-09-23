import { randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { and, desc, eq, gt, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { createRouter, customerProcedure, publicQuery, verifiedCustomerProcedure } from "./middleware";
import { getDb } from "./queries/connection";
import {
  auditLogs,
  bookings,
  communityComments,
  communityPosts,
  consents,
  customerAccounts,
  customerEmailTokens,
  customerIdentities,
  customerOtpCodes,
  customerPasswordResets,
  fraudFlags,
  priceAlerts,
  savedTravelers,
  supportCases,
  supportMessages,
} from "../db/schema";
import type { Order } from "../contracts/types";
import type { CustomerProfile } from "../contracts/mobileAuth";
import type { TrpcContext } from "./context";
import { hashPassword, verifyPassword } from "./lib/passwords";
import { randomToken, sha256Hex } from "./lib/tokens";
import {
  clearCustomerCookie,
  createCustomerSession,
  recentCustomerSessions,
  revokeAllCustomerSessions,
  revokeCustomerSession,
  revokeOtherCustomerSessions,
  sessionIsFresh,
  setCustomerCookie,
} from "./lib/customerSessions";
import { assertRateLimit, checkRateLimit, clientIp } from "./lib/ratelimit";
import { sendLoginAlertEmail, sendPasswordResetEmail, sendPhoneChangedEmail, sendVerifyEmail } from "./lib/mailer";
import { maskPhone, sendSms } from "./lib/sms";
import { AppError } from "./lib/errors";
import { env, clerkConfig, configuredOAuthProviders } from "./lib/env";
import { decideLink, hasPassword, NO_PASSWORD_HASH, verifySocialToken } from "./lib/socialLogin";
import { logAudit } from "./lib/audit";
import { log } from "./lib/logger";
import { normalizePhone } from "./lib/validation";
import { recordReward, rewardRules } from "./lib/rewards";
import { isStaffEmail } from "./lib/staffBoundary";
import { deleteCustomerAccount } from "./lib/customerDeletion";

const RESET_TTL_MS = 60 * 60_000; // 1 time
/** Felles svartid for glemt passord (ms), pluss et tilfeldig tillegg på opptil RESET_RESPONSE_JITTER_MS. */
export const RESET_RESPONSE_MS = 200;
const RESET_RESPONSE_JITTER_MS = 100;
const VERIFY_TTL_MS = 72 * 60 * 60_000; // 72 timer
const OTP_TTL_MS = 10 * 60_000; // 10 minutter
const REGISTRATION_VELOCITY_LIMIT = 5; // kontoer per IP per 24t før fraud-flagg
const CONSENT_VERSION = "2026-09";

export const LOCALES = ["nb", "en", "sv", "da", "de"] as const;
const CURRENCIES = ["NOK", "SEK", "DKK", "EUR"] as const;

/** Kort, lesbar henvisningskode (unngår forvekslings-tegn). */
function genReferralCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function issueVerificationEmail(customerId: number, email: string, firstName: string, locale: string) {
  const db = getDb();
  const token = randomToken(32);
  await db.insert(customerEmailTokens).values({
    tokenHash: sha256Hex(token),
    customerId,
    expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
  });
  await sendVerifyEmail({
    email,
    firstName,
    locale,
    url: `${env.baseUrl}/bekreft-epost?token=${encodeURIComponent(token)}`,
  }).catch((err) => log.warn({ err: String(err), customerId }, "verifiserings-e-post feilet"));
}

/** Kundepassord: min 10 tegn (OTA-072). Bevisst enklere enn admin (12 + tegnklasser). */
export function customerPasswordIssues(plain: string): string[] {
  const issues: string[] = [];
  if (plain.length < 10) issues.push("Passordet må være minst 10 tegn.");
  if (plain.length > 128) issues.push("Passordet kan være maks 128 tegn.");
  if (/^(.)\1+$/.test(plain)) issues.push("Passordet kan ikke bestå av bare ett tegn.");
  return issues;
}

export type Identifier = { kind: "email"; value: string } | { kind: "phone"; value: string };

/**
 * Databasen sammenligner e-post uten hensyn til store/små bokstaver OG aksenter
 * (utf8mb4_unicode_ci i test, MySQL 8s 0900_ai_ci i drift): et oppslag på
 * «anna@exámple.com» finner kontoen til anna@example.com, og kontrolltegn som
 * kollasjonen ignorerer gjør det samme. Et e-posttreff teller derfor bare når
 * den lagrede adressen er nøyaktig den som ble oppgitt (bortsett fra store/små
 * bokstaver, som vi alltid normaliserer bort).
 */
export function sameEmail(stored: string | null | undefined, input: string): boolean {
  return stored != null && stored.trim().toLowerCase() === input.trim().toLowerCase();
}

/** Bare synlige ASCII-tegn (0x21–0x7E) – samme strenghet som z.string().email() på nettets egne e-postfelt. */
const PRINTABLE_ASCII = /^[\x21-\x7e]+$/;

/**
 * Kunde kan logge inn/registrere seg med enten e-post eller telefonnummer (E.164).
 *
 * E-post må være ren ASCII: en adresse med aksent eller andre Unicode-tegn kan
 * ellers treffe en annen kundes konto gjennom databasens kollasjon (se
 * sameEmail). Unntaket er innlogging (`allowUnicodeEmail`), slik at en eldre
 * konto med en slik adresse fortsatt kommer inn; innloggingen krever uansett
 * passordet og sjekker at adressen er nøyaktig den lagrede.
 */
export function parseIdentifier(raw: string, opts: { allowUnicodeEmail?: boolean } = {}): Identifier {
  const trimmed = raw.trim();
  if (trimmed.includes("@")) {
    const ascii = PRINTABLE_ASCII.test(trimmed);
    const email = trimmed.toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 255 || (!ascii && !opts.allowUnicodeEmail) || /\p{Cc}/u.test(email)) {
      throw new AppError("VALIDATION", { message: "Skriv inn en gyldig e-postadresse.", data: { field: "identifier" } });
    }
    return { kind: "email", value: email };
  }
  const phone = normalizePhone(trimmed);
  if (!phone) {
    throw new AppError("VALIDATION", {
      message: "Skriv inn et gyldig telefonnummer med landskode, f.eks. +47 912 34 567.",
      data: { field: "identifier" },
    });
  }
  return { kind: "phone", value: phone };
}

/** Eldre kontoer kan ha lagret nummer uten «+». Slå opp begge varianter. */
function phoneCandidates(e164: string): string[] {
  const digits = e164.replace(/^\+/, "");
  const noCc = e164.startsWith("+47") ? e164.slice(3) : null;
  return Array.from(new Set([e164, digits, ...(noCc ? [noCc] : [])]));
}

function whereIdentifier(id: Identifier) {
  return id.kind === "email"
    ? eq(customerAccounts.email, id.value)
    : inArray(customerAccounts.phone, phoneCandidates(id.value));
}

type AccountRow = typeof customerAccounts.$inferSelect;

export function publicProfile(a: Partial<AccountRow> & { id: number; firstName: string; lastName: string }): CustomerProfile {
  return {
    id: a.id,
    email: a.email ?? null,
    phone: a.phone ?? null,
    firstName: a.firstName,
    lastName: a.lastName,
    emailVerified: a.emailVerified ?? false,
    bonusKr: a.bonusKr ?? 0,
    referralCode: a.referralCode ?? null,
    avatarUrl: a.avatarUrl ?? null,
    locale: a.locale ?? "nb",
    currency: a.currency ?? "NOK",
    marketingConsent: Boolean(a.marketingConsentAt),
    /** false for kontoer opprettet med sosial innlogging – da kreves ikke passord for sletting, og «bytt passord» blir «lag passord». */
    hasPassword: a.passwordHash ? hasPassword(a.passwordHash) : true,
  };
}

const identifierSchema = z.string().min(3).max(255);
const nameSchema = z
  .string()
  .trim()
  .min(1, "Obligatorisk")
  .max(60)
  .regex(/^[\p{L}\p{M}' -]+$/u, "Bare bokstaver, mellomrom og bindestrek");

function tripSummary(b: typeof bookings.$inferSelect) {
  let order: Order | null = null;
  try {
    order = JSON.parse(b.payload) as Order;
  } catch {
    order = null;
  }
  const firstSlice = order?.slices?.[0];
  return {
    bookingId: b.id,
    orderId: b.orderId,
    bookingReference: b.bookingReference,
    createdAt: b.createdAt.toISOString(),
    state: b.state,
    totalAmount: b.totalAmount ?? order?.totalAmount ?? "",
    totalCurrency: b.totalCurrency ?? order?.totalCurrency ?? "NOK",
    originIata: firstSlice?.origin.iata ?? "",
    originCity: firstSlice?.origin.city ?? "",
    destinationIata: firstSlice?.destination.iata ?? "",
    destinationCity: firstSlice?.destination.city ?? "",
    departingAt: firstSlice?.departingAt ?? "",
    passengerCount: order?.passengers?.length ?? 0,
    demoMode: order?.demoMode ?? !b.liveMode,
    cancelledAt: b.cancelledAt?.toISOString() ?? null,
  };
}

/**
 * Henvisningsbonus (OTA-073): krediteres først når den hen viste kundens
 * FØRSTE reise er gjennomført (kalles av worker ved travel-complete).
 * Idempotent via auditLogs-oppslag på `bonus.referral_credited`.
 */
export async function creditReferralBonusIfEligible(customerAccountId: number): Promise<{ credited: boolean }> {
  const db = getDb();
  const [account] = await db
    .select({ id: customerAccounts.id, referredById: customerAccounts.referredById, deletedAt: customerAccounts.deletedAt })
    .from(customerAccounts)
    .where(eq(customerAccounts.id, customerAccountId))
    .limit(1);
  if (!account?.referredById || account.deletedAt) return { credited: false };

  const already = await db
    .select({ id: auditLogs.id })
    .from(auditLogs)
    .where(and(eq(auditLogs.action, "bonus.referral_credited"), eq(auditLogs.targetType, "customer_account"), eq(auditLogs.targetId, String(account.id))))
    .limit(1);
  if (already.length) return { credited: false };

  const [referrer] = await db
    .select({ id: customerAccounts.id, deletedAt: customerAccounts.deletedAt })
    .from(customerAccounts)
    .where(eq(customerAccounts.id, account.referredById))
    .limit(1);
  if (!referrer || referrer.deletedAt) return { credited: false };

  // Satsene styres fra admin (rewards.rules). Reskontroen er idempotent på (kind, refType, refId).
  const rules = await rewardRules();
  await db.transaction(async (tx) => {
    await recordReward({ customerId: referrer.id, kind: "referral", amountKr: rules.referralReferrerKr, refType: "customer_account", refId: account.id, note: "Henvisning: den inviterte fullførte sin første reise" }, tx);
    await recordReward({ customerId: account.id, kind: "referral_welcome", amountKr: rules.referralReferredKr, refType: "customer_account", refId: account.id, note: "Velkomstbonus etter første reise" }, tx);
  });
  await logAudit({
    actorType: "system",
    action: "bonus.referral_credited",
    targetType: "customer_account",
    targetId: account.id,
    metadata: { referrerId: referrer.id, referrerKr: rules.referralReferrerKr, referredKr: rules.referralReferredKr },
  });
  return { credited: true };
}

/** Registreringsvelocity per IP siste 24t (OTA-077) — bruker auditLogs som kilde. */
async function flagRegistrationVelocity(customerId: number, ip: string): Promise<void> {
  if (!ip || ip === "local") return;
  const db = getDb();
  const since = new Date(Date.now() - 24 * 60 * 60_000);
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(auditLogs)
    .where(and(eq(auditLogs.actorType, "customer"), eq(auditLogs.action, "customer.registered"), eq(auditLogs.ip, ip), gte(auditLogs.createdAt, since)));
  const n = Number(row?.n ?? 0);
  if (n >= REGISTRATION_VELOCITY_LIMIT) {
    await db.insert(fraudFlags).values({
      customerAccountId: customerId,
      type: "registration_velocity",
      score: Math.min(100, 20 * (n - REGISTRATION_VELOCITY_LIMIT + 1) + 40),
      note: `${n} kontoer registrert fra samme IP siste 24 timer`,
    });
    log.warn({ customerId, count: n }, "fraud: registreringsvelocity");
  }
}

// ─── Innloggingsveiene, delt mellom nett (cookie) og app (Bearer) ───────────
// Samme regler, rategrenser, revisjonslogg og staff-sperre gjelder begge. Det
// eneste som skiller dem, er hvordan den nye sesjonen leveres: nettet får den
// som HttpOnly-cookie (uendret), appen får tokenet i svaret (api/mobileAuth.ts).

/** Samme svar uansett vei inn – det skal ikke kunne brukes til å kartlegge ansattes adresser. */
const STAFF_EMAIL_MESSAGE = "Denne e-postadressen kan ikke brukes til en kundekonto. Kontakt oss hvis du mener dette er feil.";

/** Leverer en ny kundesesjon for kunden. */
export type SessionIssuer = (customerId: number) => Promise<void>;

/** Nettets vei: HttpOnly-cookie, slik den alltid har vært. */
export function cookieIssuer(ctx: TrpcContext): SessionIssuer {
  return async (customerId) => {
    const token = await createCustomerSession(customerId, ctx.req);
    setCustomerCookie(ctx.resHeaders, token);
  };
}

export const registerInput = z.object({
  identifier: identifierSchema,
  password: z.string().min(1).max(128),
  firstName: nameSchema,
  lastName: nameSchema,
  referralCode: z.string().trim().max(16).optional(),
  locale: z.enum(LOCALES).optional(),
  marketingConsent: z.boolean().optional(),
});
export const loginInput = z.object({ identifier: identifierSchema, password: z.string().min(1).max(128) });
export const socialTokenInput = z.object({ token: z.string().min(20).max(4096), locale: z.enum(LOCALES).optional(), referralCode: z.string().trim().max(16).optional() });
export const loginCodeRequestInput = z.object({ phone: z.string().min(8).max(20) });
export const loginCodeVerifyInput = z.object({ phone: z.string().min(8).max(20), code: z.string().regex(/^\d{6}$/) });

export async function registerCustomer(input: z.infer<typeof registerInput>, ctx: TrpcContext, issue: SessionIssuer) {
  const ip = clientIp(ctx.req);
  assertRateLimit("customer-register", ip, 6, 10 * 60_000);
  const id = parseIdentifier(input.identifier);

  const issues = customerPasswordIssues(input.password);
  if (issues.length) {
    throw new AppError("VALIDATION", { message: issues.join(" "), data: { field: "password" } });
  }

  const db = getDb();
  const existing = await db.select({ id: customerAccounts.id }).from(customerAccounts).where(whereIdentifier(id)).limit(1);
  // En ansatts e-post får nøyaktig samme svar som en adresse som allerede er i
  // bruk – på samme sted i rekkefølgen – så registreringen kan ikke brukes til
  // å kartlegge hvem som er ansatt. Den egentlige grunnen står bare i revisjonsloggen.
  const staffEmail = id.kind === "email" && (await isStaffEmail(id.value));
  if (staffEmail) {
    await logAudit({ actorType: "system", action: "customer.register_blocked_staff", targetType: "customer_account", ip, metadata: { reason: "staff_email", emailHash: sha256Hex(id.value).slice(0, 16) } });
  }
  if (existing[0] || staffEmail) {
    throw new AppError("CONFLICT", {
      message:
        id.kind === "email"
          ? "Det finnes allerede en konto med denne e-postadressen. Prøv å logge inn."
          : "Det finnes allerede en konto med dette telefonnummeret. Prøv å logge inn.",
      data: { field: "identifier" },
    });
  }

  // Henvisning: kun relasjonen lagres nå — bonus krediteres når første reise er gjennomført (OTA-073)
  let referrerId: number | null = null;
  if (input.referralCode) {
    const rows = await db
      .select({ id: customerAccounts.id })
      .from(customerAccounts)
      .where(and(eq(customerAccounts.referralCode, input.referralCode.toUpperCase()), isNull(customerAccounts.deletedAt)))
      .limit(1);
    referrerId = rows[0]?.id ?? null;
  }

  const passwordHash = await hashPassword(input.password);
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const locale = input.locale ?? "nb";
  const referralCode = genReferralCode();
  const result = await db.insert(customerAccounts).values({
    email: id.kind === "email" ? id.value : null,
    phone: id.kind === "phone" ? id.value : null,
    passwordHash,
    firstName,
    lastName,
    referralCode,
    referredById: referrerId,
    bonusKr: 0,
    locale,
    marketingConsentAt: input.marketingConsent ? new Date() : null,
  });
  const customerId = Number(result[0].insertId);

  if (input.marketingConsent !== undefined && id.kind === "email") {
    await db.insert(consents).values({
      customerAccountId: customerId,
      email: id.value,
      type: "marketing",
      version: CONSENT_VERSION,
      granted: input.marketingConsent,
      source: "register",
      ip,
    });
  }

  await logAudit({
    actorType: "customer", actorId: customerId, actorLabel: firstName, action: "customer.registered",
    targetType: "customer_account", targetId: customerId, ip,
    metadata: { via: id.kind, referred: referrerId != null },
  });
  await flagRegistrationVelocity(customerId, ip).catch(() => {});

  // Bekreftelses-e-post (verifisering) — blokkerer ikke innlogging.
  // Telefon-kontoer er lovlige, men forblir uverifiserte for reiser/saker på e-post.
  if (id.kind === "email") {
    await issueVerificationEmail(customerId, id.value, firstName, locale);
  }

  await issue(customerId);

  return publicProfile({
    id: customerId,
    email: id.kind === "email" ? id.value : null,
    phone: id.kind === "phone" ? id.value : null,
    firstName,
    lastName,
    emailVerified: false,
    bonusKr: 0,
    // Samme profil som me gir etterpå – også henvisningskoden, som tidligere manglet i svaret.
    referralCode,
    locale,
    marketingConsentAt: input.marketingConsent ? new Date() : null,
  });
}

export async function passwordLogin(input: z.infer<typeof loginInput>, ctx: TrpcContext, issue: SessionIssuer) {
  const ip = clientIp(ctx.req);
  assertRateLimit("customer-login", ip, 8, 5 * 60_000);
  const id = parseIdentifier(input.identifier, { allowUnicodeEmail: true });
  // Også per identitet — hindrer distribuert gjetting mot én konto
  assertRateLimit("customer-login-id", sha256Hex(id.value).slice(0, 32), 20, 15 * 60_000);

  const db = getDb();
  const rows = await db.select().from(customerAccounts).where(whereIdentifier(id)).limit(1);
  // En variant av adressen (aksent, kontrolltegn) treffer samme rad i databasen,
  // men får aldri prøve passordet – ellers kunne hver variant brukt sin egen
  // rategrense til å gjette passordet på den samme kontoen.
  const account = rows[0] && (id.kind !== "email" || sameEmail(rows[0].email, id.value)) ? rows[0] : undefined;
  // Samme feilmelding enten kontoen mangler, er slettet eller passordet er feil.
  const ok = account && !account.deletedAt ? await verifyPassword(account.passwordHash, input.password) : false;
  if (!account || !ok) {
    await logAudit({
      actorType: "customer", actorId: account?.id ?? null, action: "customer.login_failed",
      targetType: "customer_account", targetId: account?.id ?? null, ip,
    });
    throw new AppError("UNAUTHORIZED", { message: "Feil e-post/telefon eller passord." });
  }
  // En ansatts e-post logger aldri inn som kunde – samme svar som feil passord.
  if (await isStaffEmail(account.email)) {
    await logAudit({ actorType: "customer", actorId: account.id, action: "customer.login_blocked_staff", targetType: "customer_account", targetId: account.id, ip });
    throw new AppError("UNAUTHORIZED", { message: "Feil e-post/telefon eller passord." });
  }

  // Innloggingsvarsel kun ved ny enhet/IP (OTA-078): sammenlign med siste 3 sesjoner FØR ny opprettes
  const ua = ctx.req.headers.get("user-agent")?.slice(0, 255) ?? null;
  const recent = await recentCustomerSessions(account.id, 3).catch(() => []);
  const known = recent.some((s) => s.ip === ip && s.userAgent === ua);

  await issue(account.id);
  await logAudit({
    actorType: "customer", actorId: account.id, actorLabel: account.firstName, action: "customer.login",
    targetType: "customer_account", targetId: account.id, ip, metadata: { newDevice: !known },
  });
  if (!known && account.email && account.emailVerified) {
    sendLoginAlertEmail({ email: account.email, firstName: account.firstName, ip, userAgent: ua ?? undefined, locale: account.locale })
      .catch((err) => log.warn({ err: String(err) }, "innloggingsvarsel feilet"));
  }
  return publicProfile(account);
}

export async function socialLogin(input: z.infer<typeof socialTokenInput>, ctx: TrpcContext, issue: SessionIssuer) {
  const ip = clientIp(ctx.req);
  assertRateLimit("customer-social", ip, 10, 5 * 60_000);
  const who = await verifySocialToken(input.token);
  if (await isStaffEmail(who.email)) {
    log.warn({ via: "social" }, "kundeinnlogging avvist: ansatts e-post");
    throw new AppError("FORBIDDEN", { message: STAFF_EMAIL_MESSAGE, data: { field: "social" } });
  }
  const db = getDb();

  const [identity] = await db
    .select({ id: customerIdentities.id, customerId: customerIdentities.customerId })
    .from(customerIdentities)
    .where(and(eq(customerIdentities.provider, "clerk"), eq(customerIdentities.subject, who.subject)))
    .limit(1);
  const collationMatch = who.email
    ? (await db.select({ id: customerAccounts.id, email: customerAccounts.email }).from(customerAccounts).where(and(eq(customerAccounts.email, who.email), isNull(customerAccounts.deletedAt))).limit(1))[0]
    : undefined;
  // Bare nøyaktig samme adresse kobler. «anna@exámple.com» (verifisert hos
  // leverandøren, på et domene angriperen eier) treffer anna@example.com i
  // databasens kollasjon, men er ikke bevis på eierskap til den kontoen. Uten
  // innlogget kunde eller kjent identitet kan den heller ikke få en ny konto –
  // den unike indeksen på e-post ser de to adressene som like.
  const emailMatch = collationMatch && sameEmail(collationMatch.email, who.email!) ? collationMatch : undefined;
  if (collationMatch && !emailMatch && !identity && !ctx.customer) {
    log.warn({ via: "social" }, "sosial innlogging avvist: e-posten ligner en annen kontos adresse");
    throw new AppError("CONFLICT", {
      message: "Denne e-postadressen kan ikke brukes til en ny konto. Logg inn på en annen måte, eller kontakt oss.",
      data: { field: "social", reason: "email_lookalike" },
    });
  }
  const decision = decideLink({
    existingIdentityCustomerId: identity?.customerId ?? null,
    currentCustomerId: ctx.customer?.customerId ?? null,
    emailMatchCustomerId: emailMatch?.id ?? null,
    emailVerified: who.emailVerified,
  });

  if (decision.action === "conflict") {
    throw new AppError("CONFLICT", {
      message:
        decision.reason === "other_account"
          ? "Denne innloggingen er allerede koblet til en annen HelloSky-konto. Logg ut først, eller koble den fra i Sikkerhet på den andre kontoen."
          : "Det finnes allerede en konto med denne e-postadressen. Logg inn med passord først, så kan du koble til innloggingen under Sikkerhet.",
      data: { field: "social", reason: decision.reason },
    });
  }

  let customerId: number;
  let created = false;
  if (decision.action === "create") {
    let referrerId: number | null = null;
    if (input.referralCode) {
      const rows = await db.select({ id: customerAccounts.id }).from(customerAccounts).where(and(eq(customerAccounts.referralCode, input.referralCode.toUpperCase()), isNull(customerAccounts.deletedAt))).limit(1);
      referrerId = rows[0]?.id ?? null;
    }
    const result = await db.insert(customerAccounts).values({
      email: who.email,
      phone: null,
      passwordHash: NO_PASSWORD_HASH,
      firstName: (who.firstName ?? "").trim().slice(0, 60) || "Reisende",
      lastName: (who.lastName ?? "").trim().slice(0, 60) || "",
      emailVerified: Boolean(who.email && who.emailVerified),
      referralCode: genReferralCode(),
      referredById: referrerId,
      locale: input.locale ?? "nb",
    });
    customerId = Number(result[0].insertId);
    created = true;
    await db.insert(customerIdentities).values({ customerId, provider: "clerk", subject: who.subject, social: who.social, email: who.email, lastLoginAt: new Date() });
  } else {
    customerId = decision.customerId;
    const [acc] = await db.select({ id: customerAccounts.id, deletedAt: customerAccounts.deletedAt, emailVerified: customerAccounts.emailVerified, email: customerAccounts.email }).from(customerAccounts).where(eq(customerAccounts.id, customerId)).limit(1);
    if (!acc || acc.deletedAt) throw new AppError("UNAUTHORIZED", { message: "Kontoen finnes ikke lenger." });
    if (decision.action === "link") {
      await db.insert(customerIdentities).values({ customerId, provider: "clerk", subject: who.subject, social: who.social, email: who.email, lastLoginAt: new Date() });
      // En verifisert e-post fra leverandøren bekrefter også vår e-post når den er den samme.
      if (who.email && who.emailVerified && acc.email === who.email && !acc.emailVerified) {
        await db.update(customerAccounts).set({ emailVerified: true }).where(eq(customerAccounts.id, customerId));
      }
    } else if (identity) {
      await db.update(customerIdentities).set({ lastLoginAt: new Date(), email: who.email }).where(eq(customerIdentities.id, identity.id));
    }
  }

  await issue(customerId);
  await logAudit({
    actorType: "customer", actorId: customerId, action: created ? "customer.social_register" : decision.action === "link" ? "customer.social_link" : "customer.social_login",
    targetType: "customer_account", targetId: customerId, ip, metadata: { social: who.social },
  });
  const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, customerId)).limit(1);
  if (!account) throw new AppError("NOT_FOUND");
  return { created, linked: decision.action === "link", profile: publicProfile(account) };
}

export async function sendLoginCode(input: z.infer<typeof loginCodeRequestInput>, ctx: TrpcContext) {
  assertRateLimit("customer-otp", clientIp(ctx.req), 5, 10 * 60_000);
  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new AppError("VALIDATION", { message: "Skriv inn et gyldig telefonnummer med landskode.", data: { field: "phone" } });
  }
  assertRateLimit("customer-otp-phone", phone, 3, 10 * 60_000);
  const db = getDb();
  const rows = await db
    .select()
    .from(customerAccounts)
    .where(and(inArray(customerAccounts.phone, phoneCandidates(phone)), isNull(customerAccounts.deletedAt)))
    .limit(1);
  const account = rows[0];
  if (account && !(await isStaffEmail(account.email))) {
    const code = String(randomInt(100000, 1000000)); // 6 siffer, kryptografisk RNG
    // Kun én aktiv kode om gangen
    await db
      .update(customerOtpCodes)
      .set({ usedAt: new Date() })
      .where(and(eq(customerOtpCodes.customerId, account.id), isNull(customerOtpCodes.usedAt)));
    await db.insert(customerOtpCodes).values({
      customerId: account.id,
      codeHash: sha256Hex(`${account.id}:${code}`),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });
    await sendSms(phone, `HelloSky: innloggingskoden din er ${code}. Gyldig i 10 minutter. Del den aldri med noen.`);
  } else {
    // Samme responstid uansett — ikke røp om nummeret finnes
    await new Promise((r) => setTimeout(r, 150 + randomInt(0, 150)));
  }
  return { ok: true };
}

export async function verifyLoginCodeLogin(input: z.infer<typeof loginCodeVerifyInput>, ctx: TrpcContext, issue: SessionIssuer) {
  const ip = clientIp(ctx.req);
  assertRateLimit("customer-otp-verify", ip, 10, 10 * 60_000);
  const phone = normalizePhone(input.phone);
  if (!phone) throw new AppError("UNAUTHORIZED", { message: "Feil kode eller telefonnummer." });
  // Maks 5 forsøk per nummer per 10 min — beskytter mot gjetting av 6-sifret kode
  assertRateLimit(`otp-verify:${phone}`, "phone", 5, 10 * 60_000);

  const db = getDb();
  const account = (
    await db
      .select()
      .from(customerAccounts)
      .where(and(inArray(customerAccounts.phone, phoneCandidates(phone)), isNull(customerAccounts.deletedAt)))
      .limit(1)
  )[0];
  if (!account || (await isStaffEmail(account.email))) throw new AppError("UNAUTHORIZED", { message: "Feil kode eller telefonnummer." });

  const rows = await db
    .select()
    .from(customerOtpCodes)
    .where(
      and(
        eq(customerOtpCodes.customerId, account.id),
        eq(customerOtpCodes.codeHash, sha256Hex(`${account.id}:${input.code}`)),
        isNull(customerOtpCodes.usedAt),
        gt(customerOtpCodes.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const otp = rows[0];
  if (!otp) {
    await logAudit({ actorType: "customer", actorId: account.id, action: "customer.otp_failed", targetType: "customer_account", targetId: account.id, ip });
    throw new AppError("UNAUTHORIZED", { message: "Feil kode eller telefonnummer." });
  }
  // Engangsbruk: atomisk oppdatering slik at to parallelle kall ikke begge lykkes
  const upd = await db
    .update(customerOtpCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(customerOtpCodes.id, otp.id), isNull(customerOtpCodes.usedAt)));
  if (Number(upd[0].affectedRows) === 0) throw new AppError("UNAUTHORIZED", { message: "Feil kode eller telefonnummer." });

  await issue(account.id);
  await logAudit({ actorType: "customer", actorId: account.id, actorLabel: account.firstName, action: "customer.login", targetType: "customer_account", targetId: account.id, ip, metadata: { via: "otp" } });
  return publicProfile(account);
}

// ─── Kontoens livsløp, delt mellom nett og app ──────────────────────────────

/**
 * Glemt passord: samme vei for nett (e-post) og app (e-post eller telefon).
 * Samme rategrenser, samme tokentabell, samme e-post og samme lenke til
 * nettets tilbakestillingsside – tilbakestillingen gjøres alltid der.
 * Svaret er alltid { ok: true }, enten kontoen finnes, er slettet, tilhører
 * en ansatt eller identifikatoren er et telefonnummer (lenken sendes bare på
 * e-post, som før).
 *
 * Lenken går alltid til adressen som er lagret på kontoen – aldri til den som
 * ble skrevet inn – og bare når de to er nøyaktig like (se sameEmail).
 * Svartiden er den samme enten kontoen finnes eller ikke: alt arbeidet som bare
 * gjøres for en ekte konto (oppslag, token, e-post, revisjon) får vente til et
 * felles gulv (RESET_RESPONSE_MS + tilfeldig tillegg), og det som ikke er
 * ferdig da (typisk en treg SMTP-server), fullføres etter svaret.
 */
export async function requestPasswordReset(id: Identifier, ctx: TrpcContext, opts: { locale?: string } = {}): Promise<{ ok: true }> {
  const started = Date.now();
  const ip = clientIp(ctx.req);
  assertRateLimit("customer-reset-req", ip, 5, 10 * 60_000);
  assertRateLimit("customer-reset-req-email", sha256Hex(id.value).slice(0, 32), 3, 60 * 60_000);
  const work = id.kind === "email" ? sendResetLinkIfAccount(id.value, ip, opts.locale) : Promise.resolve();
  await settleByFloor(work, started, RESET_RESPONSE_MS + randomInt(0, RESET_RESPONSE_JITTER_MS));
  return { ok: true };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));

/** Vent på `work` til senest `targetMs` etter `started`, og så til `targetMs` uansett. Feil i `work` er allerede logget. */
async function settleByFloor(work: Promise<unknown>, started: number, targetMs: number): Promise<void> {
  const remaining = () => targetMs - (Date.now() - started);
  await Promise.race([work, sleep(remaining())]);
  await sleep(remaining());
}

/** Arbeidet bak glemt passord for en e-postadresse. Kaster aldri: feil logges, svaret til kunden er det samme. */
async function sendResetLinkIfAccount(email: string, ip: string, locale: string | undefined): Promise<void> {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(customerAccounts)
      .where(and(eq(customerAccounts.email, email), isNull(customerAccounts.deletedAt)))
      .limit(1);
    const account = rows[0];
    // Kollasjonstreff på en variant av adressen (aksent, kontrolltegn) gir ingen lenke.
    if (!account?.email || !sameEmail(account.email, email)) return;
    // En ansatts e-post får ingen kundelenke – samme «ok» som når kontoen ikke finnes.
    if (await isStaffEmail(account.email)) return;
    // Tak per konto i tillegg til per skrevet adresse; stille, så taket ikke røper at kontoen finnes.
    if (!checkRateLimit("customer-reset-req-account", String(account.id), 3, 60 * 60_000)) return;
    const token = randomToken(32);
    await db.insert(customerPasswordResets).values({
      tokenHash: sha256Hex(token),
      customerId: account.id,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    });
    await logAudit({ actorType: "customer", actorId: account.id, action: "customer.password_reset_requested", targetType: "customer_account", targetId: account.id, ip });
    await sendPasswordResetEmail({
      // Den lagrede adressen – aldri den som ble skrevet inn.
      email: account.email,
      firstName: account.firstName,
      // Appen kan be om språket den vises på; nettet bruker kontoens eget.
      locale: locale ?? account.locale,
      url: `${env.baseUrl}/tilbakestill-passord?token=${encodeURIComponent(token)}`,
    });
  } catch (err) {
    log.warn({ err: String(err) }, "glemt passord: lenken kunne ikke sendes");
  }
}

/** Navn og telefon – samme regler på nett og i appen. */
export const profileInput = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  phone: z.string().trim().max(20).optional(),
});

/**
 * Validerer en profilendring og gir raden som skal skrives. Tom telefon
 * fjerner nummeret (bare når kontoen har e-post).
 *
 * Et nytt nummer er en ny innloggingsvei (SMS-kode), så det kan ikke bare
 * skrives inn:
 *  - `phoneChange: "verified"` (appen): et annet nummer enn dagens gir
 *    VALIDATION (reason: phone_verification_required) – det nye nummeret går
 *    gjennom requestPhoneChange/confirmPhoneChange (passord + SMS-kode).
 *  - `phoneChange: "direct"` (nettets profilside, uendret flyt): nummeret
 *    lagres direkte som før, men oppslaget «er nummeret i bruk?» er begrenset
 *    per kunde og per IP, så det ikke kan brukes til å kartlegge numre.
 */
export async function profilePatch(
  customer: { customerId: number; email: string | null; phone: string | null },
  input: z.infer<typeof profileInput>,
  opts: { ip: string; phoneChange: "direct" | "verified" },
): Promise<Partial<typeof customerAccounts.$inferInsert>> {
  const patch: Partial<typeof customerAccounts.$inferInsert> = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
  };
  if (input.phone !== undefined) {
    if (input.phone.trim() === "") {
      if (!customer.email) {
        throw new AppError("VALIDATION", { message: "Kontoen må ha enten e-post eller telefonnummer.", data: { field: "phone" } });
      }
      patch.phone = null;
    } else {
      const phone = normalizePhone(input.phone);
      if (!phone) throw new AppError("VALIDATION", { message: "Ugyldig telefonnummer. Bruk landskode, f.eks. +47 912 34 567.", data: { field: "phone" } });
      const unchanged = customer.phone != null && phoneCandidates(phone).includes(customer.phone);
      if (!unchanged) {
        if (opts.phoneChange === "verified") {
          throw new AppError("VALIDATION", {
            message: "Et nytt telefonnummer må bekreftes med en SMS-kode.",
            data: { field: "phone", reason: "phone_verification_required" },
          });
        }
        assertRateLimit("customer-phone-lookup", String(customer.customerId), 10, 60 * 60_000);
        assertRateLimit("customer-phone-lookup-ip", opts.ip, 30, 60 * 60_000);
        if (await phoneTakenByOther(phone, customer.customerId)) {
          throw new AppError("CONFLICT", { message: "Telefonnummeret er allerede i bruk på en annen konto.", data: { field: "phone" } });
        }
      }
      patch.phone = phone;
    }
  }
  return patch;
}

async function phoneTakenByOther(phone: string, customerId: number): Promise<boolean> {
  const taken = await getDb()
    .select({ id: customerAccounts.id })
    .from(customerAccounts)
    .where(and(inArray(customerAccounts.phone, phoneCandidates(phone)), sql`${customerAccounts.id} <> ${customerId}`))
    .limit(1);
  return taken.length > 0;
}

// ─── Nytt telefonnummer: bevis på kontoen OG på nummeret ────────────────────
// Telefonnummeret er en innloggingsvei (SMS-kode). Et nummer som bare skrives
// inn, lar den som har et stjålet token binde sitt eget nummer til kontoen og
// komme inn igjen etter «logg ut alle enheter» og passordbytte – eller en
// angriperkonto «reservere» et nummer som tilhører noen andre. Derfor:
//  1. requestPhoneChange: kontoeieren bekrefter seg (passord; uten passord: en
//     fersk innlogging), og en engangskode sendes til det NYE nummeret. Svaret
//     er det samme om nummeret er ledig eller brukt av en annen konto (da får
//     det nummeret en melding i stedet for en kode) – ingen nummer-oppslag.
//  2. confirmPhoneChange: koden, som er bundet til kunden og nummeret, lagrer
//     nummeret. Andre sesjoner logges ut, og kontoen varsles på e-post (og det
//     gamle nummeret på SMS).
// Koden ligger i customer_otp_codes med en hash over kunde, nummer og kode;
// den kan ikke brukes til innlogging, og en innloggingskode kan ikke brukes her.

const PHONE_CODE_TTL_MS = 10 * 60_000;

export const phoneChangeRequestInput = z.object({
  phone: z.string().trim().min(3).max(20),
  /** Påkrevd for kontoer med passord. */
  password: z.string().min(1).max(128).optional(),
});
export const phoneChangeConfirmInput = z.object({
  phone: z.string().trim().min(3).max(20),
  code: z.string().regex(/^\d{6}$/),
});

const phoneCodeHash = (customerId: number, phone: string, code: string) => sha256Hex(`${customerId}:phone-change:${phone}:${code}`);

type SessionCustomer = { customerId: number; phone: string | null; sessionId: number; sessionCreatedAt: Date };

/**
 * Bekreft at det er kontoens eier, ikke bare noen som har tokenet. Konto med
 * passord: passordet (feil gir UNAUTHORIZED med field: password – aldri et
 * tegn på at sesjonen er død). Konto uten passord: en innlogging som er yngre
 * enn RECENT_AUTH_MS; ellers FORBIDDEN med reason: reauth_required.
 */
export async function assertAccountOwner(customer: SessionCustomer, password: string | undefined): Promise<void> {
  const [account] = await getDb()
    .select({ passwordHash: customerAccounts.passwordHash })
    .from(customerAccounts)
    .where(and(eq(customerAccounts.id, customer.customerId), isNull(customerAccounts.deletedAt)))
    .limit(1);
  if (!account) throw new AppError("NOT_FOUND");
  if (hasPassword(account.passwordHash)) {
    assertRateLimit("customer-reauth", String(customer.customerId), 5, 10 * 60_000);
    if (!password || !(await verifyPassword(account.passwordHash, password))) {
      throw new AppError("UNAUTHORIZED", { message: "Passordet er feil.", data: { field: "password" } });
    }
    return;
  }
  if (!sessionIsFresh(customer.sessionCreatedAt)) {
    throw new AppError("FORBIDDEN", { message: "Logg inn på nytt for å bekrefte at det er deg.", data: { reason: "reauth_required" } });
  }
}

export async function requestPhoneChange(customer: SessionCustomer, input: z.infer<typeof phoneChangeRequestInput>, ctx: TrpcContext): Promise<{ ok: true }> {
  const ip = clientIp(ctx.req);
  assertRateLimit("customer-phone-change", String(customer.customerId), 5, 60 * 60_000);
  assertRateLimit("customer-phone-change-ip", ip, 10, 10 * 60_000);
  const phone = normalizePhone(input.phone);
  if (!phone) throw new AppError("VALIDATION", { message: "Ugyldig telefonnummer. Bruk landskode, f.eks. +47 912 34 567.", data: { field: "phone" } });
  if (customer.phone != null && phoneCandidates(phone).includes(customer.phone)) {
    throw new AppError("VALIDATION", { message: "Dette er allerede nummeret ditt.", data: { field: "phone" } });
  }
  await assertAccountOwner(customer, input.password);
  // Samme SMS-budsjett per nummer som innlogging med kode.
  assertRateLimit("customer-otp-phone", phone, 3, 10 * 60_000);

  const db = getDb();
  if (await phoneTakenByOther(phone, customer.customerId)) {
    // Ingen kode (nummeret kan ikke flyttes hit), men samme svar – og eieren av nummeret får vite det.
    await sendSms(phone, "HelloSky: Noen prøvde å legge til dette nummeret på en annen konto. Nummeret er fortsatt koblet til kontoen din. Var det deg, logg inn med SMS-kode i stedet.");
    await logAudit({ actorType: "customer", actorId: customer.customerId, action: "customer.phone_change_requested", targetType: "customer_account", targetId: customer.customerId, ip, metadata: { sent: false } });
    return { ok: true };
  }
  const code = String(randomInt(100000, 1000000));
  // Kun én aktiv kode om gangen (som innlogging med kode).
  await db.update(customerOtpCodes).set({ usedAt: new Date() }).where(and(eq(customerOtpCodes.customerId, customer.customerId), isNull(customerOtpCodes.usedAt)));
  await db.insert(customerOtpCodes).values({
    customerId: customer.customerId,
    codeHash: phoneCodeHash(customer.customerId, phone, code),
    expiresAt: new Date(Date.now() + PHONE_CODE_TTL_MS),
  });
  await sendSms(phone, `HelloSky: koden for å legge til dette nummeret på kontoen din er ${code}. Gyldig i 10 minutter. Del den aldri med noen.`);
  await logAudit({ actorType: "customer", actorId: customer.customerId, action: "customer.phone_change_requested", targetType: "customer_account", targetId: customer.customerId, ip, metadata: { sent: true } });
  return { ok: true };
}

export async function confirmPhoneChange(customer: SessionCustomer, input: z.infer<typeof phoneChangeConfirmInput>, ctx: TrpcContext): Promise<void> {
  const ip = clientIp(ctx.req);
  // Maks 5 forsøk per kunde per 10 min – beskytter mot gjetting av den 6-sifrede koden.
  assertRateLimit("customer-phone-confirm", String(customer.customerId), 5, 10 * 60_000);
  const phone = normalizePhone(input.phone);
  const wrong = () => new AppError("VALIDATION", { message: "Feil eller utløpt kode. Be om en ny kode.", data: { field: "code" } });
  if (!phone) throw wrong();
  const db = getDb();
  const [otp] = await db
    .select({ id: customerOtpCodes.id })
    .from(customerOtpCodes)
    .where(
      and(
        eq(customerOtpCodes.customerId, customer.customerId),
        eq(customerOtpCodes.codeHash, phoneCodeHash(customer.customerId, phone, input.code)),
        isNull(customerOtpCodes.usedAt),
        gt(customerOtpCodes.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!otp) {
    await logAudit({ actorType: "customer", actorId: customer.customerId, action: "customer.phone_change_failed", targetType: "customer_account", targetId: customer.customerId, ip });
    throw wrong();
  }
  // Engangsbruk: atomisk, så to parallelle kall ikke begge lykkes.
  const used = await db.update(customerOtpCodes).set({ usedAt: new Date() }).where(and(eq(customerOtpCodes.id, otp.id), isNull(customerOtpCodes.usedAt)));
  if (Number(used[0].affectedRows) === 0) throw wrong();
  // Nummeret kan ha blitt tatt i mellomtiden. Kunden har nå bevist at nummeret er deres, så det kan sies rett ut.
  if (await phoneTakenByOther(phone, customer.customerId)) {
    throw new AppError("CONFLICT", { message: "Telefonnummeret er allerede i bruk på en annen konto.", data: { field: "phone" } });
  }
  const [before] = await db
    .select({ email: customerAccounts.email, phone: customerAccounts.phone, firstName: customerAccounts.firstName, locale: customerAccounts.locale })
    .from(customerAccounts)
    .where(eq(customerAccounts.id, customer.customerId))
    .limit(1);
  if (!before) throw new AppError("NOT_FOUND");
  await db.update(customerAccounts).set({ phone }).where(eq(customerAccounts.id, customer.customerId));
  // Alle andre enheter (nett og app) må logge inn på nytt; denne beholdes.
  await revokeOtherCustomerSessions(customer.customerId, customer.sessionId);
  await logAudit({ actorType: "customer", actorId: customer.customerId, action: "customer.phone_changed", targetType: "customer_account", targetId: customer.customerId, ip });

  // Varsle eieren på kanalene som fantes før endringen (best effort).
  const at = new Date().toISOString();
  if (before.email) {
    await sendPhoneChangedEmail({ email: before.email, firstName: before.firstName, phone: maskPhone(phone), at, locale: before.locale }).catch((err) =>
      log.warn({ err: String(err) }, "varsel om nytt telefonnummer (e-post) feilet"),
    );
  }
  const oldPhone = before.phone ? normalizePhone(before.phone) : null;
  if (oldPhone && oldPhone !== phone) {
    await sendSms(oldPhone, "HelloSky: telefonnummeret på kontoen din er endret, og dette nummeret kan ikke lenger brukes til innlogging. Var det ikke deg? Kontakt oss.").catch((err) =>
      log.warn({ err: String(err) }, "varsel om nytt telefonnummer (SMS) feilet"),
    );
  }
}

/** Bekreftelse for sletting: passord, eller SLETT for kontoer uten passord (se api/lib/customerDeletion.ts). */
export const deleteAccountInput = z.object({ password: z.string().min(1).max(128).optional(), confirmation: z.string().max(16).optional() });

export const customerAuthRouter = createRouter({
  register: publicQuery.input(registerInput).mutation(({ input, ctx }) => registerCustomer(input, ctx, cookieIssuer(ctx))),

  login: publicQuery.input(loginInput).mutation(({ input, ctx }) => passwordLogin(input, ctx, cookieIssuer(ctx))),

  logout: publicQuery.mutation(async ({ ctx }) => {
    if (ctx.customer) {
      await revokeCustomerSession(ctx.customer.sessionId).catch(() => {});
    }
    clearCustomerCookie(ctx.resHeaders);
    return { ok: true };
  }),

  /**
   * Hvilke innloggingsmetoder som faktisk er satt opp.
   *
   * Frontend gjetter ikke: den spør. Da kan Google skrus på ved å sette to
   * miljøvariabler i Railway, uten at noen rører koden – og en leverandør som
   * ikke er konfigurert blir aldri en død knapp.
   */
  authProviders: publicQuery.query(() => {
    const clerk = clerkConfig();
    return {
      // Egne OAuth-handlere (ikke i bruk) + leverandørene Clerk kjører for oss.
      oauth: Array.from(new Set<string>([...configuredOAuthProviders(), ...clerk.providers])),
      /** Publiserbar nøkkel til Clerk-klienten – laget for nettleseren. null = sosial innlogging er av. */
      clerk: clerk.enabled ? { publishableKey: clerk.publishableKey!, providers: clerk.providers } : null,
      passkeys: false as const,
    };
  }),

  /**
   * Sosial innlogging: bytt et verifisert Clerk-token mot en HelloSky-sesjon.
   *
   * Kjent identitet → innlogging. Innlogget kunde → kobling til egen konto.
   * Verifisert e-post som matcher → kobling. Ellers ny konto uten passord.
   * Vi kobler aldri på en uverifisert e-post alene, og flytter aldri en
   * identitet fra én konto til en annen.
   */
  exchangeSocialToken: publicQuery.input(socialTokenInput).mutation(({ input, ctx }) => socialLogin(input, ctx, cookieIssuer(ctx))),

  /** Sosiale innlogginger koblet til kontoen – til Sikkerhet-siden. */
  identities: customerProcedure.query(async ({ ctx }) => {
    const rows = await getDb()
      .select({ id: customerIdentities.id, social: customerIdentities.social, email: customerIdentities.email, createdAt: customerIdentities.createdAt, lastLoginAt: customerIdentities.lastLoginAt })
      .from(customerIdentities)
      .where(eq(customerIdentities.customerId, ctx.customer.customerId));
    return rows;
  }),

  /** Koble fra en sosial innlogging – aldri den siste veien inn på en konto uten passord. */
  unlinkIdentity: customerProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    const customerId = ctx.customer.customerId;
    const [account] = await db.select({ passwordHash: customerAccounts.passwordHash }).from(customerAccounts).where(eq(customerAccounts.id, customerId)).limit(1);
    const all = await db.select({ id: customerIdentities.id }).from(customerIdentities).where(eq(customerIdentities.customerId, customerId));
    if (!all.some((i) => i.id === input.id)) throw new AppError("NOT_FOUND");
    if (account && !hasPassword(account.passwordHash) && all.length <= 1) {
      throw new AppError("VALIDATION", { message: "Dette er den eneste måten å logge inn på denne kontoen. Lag et passord først (Glemt passord), så kan du koble fra." });
    }
    await db.delete(customerIdentities).where(and(eq(customerIdentities.id, input.id), eq(customerIdentities.customerId, customerId)));
    await logAudit({ actorType: "customer", actorId: customerId, action: "customer.social_unlink", targetType: "customer_account", targetId: customerId, ip: clientIp(ctx.req) });
    return { ok: true };
  }),

  me: publicQuery.query(async ({ ctx }) => {
    if (!ctx.customer) return null;
    // Hent fersk saldo/verifiseringsstatus — sesjonen caches ikke disse
    const rows = await getDb()
      .select()
      .from(customerAccounts)
      .where(and(eq(customerAccounts.id, ctx.customer.customerId), isNull(customerAccounts.deletedAt)))
      .limit(1);
    const acc = rows[0];
    if (!acc) return null;
    return publicProfile(acc);
  }),

  /** Glemt passord — sender tilbakestillingslenke på e-post. Alltid ok (ikke røp om konto finnes). */
  requestPasswordReset: publicQuery
    .input(z.object({ email: z.string().email() }))
    .mutation(({ input, ctx }) => requestPasswordReset({ kind: "email", value: input.email.toLowerCase().trim() }, ctx)),

  /**
   * Kundens egne bestillinger (OTA-060). Krever verifisert e-post. Matcher på
   * eierskap (customerAccountId) ELLER kontaktens e-post — e-posten er bekreftet.
   */
  myTrips: verifiedCustomerProcedure.query(async ({ ctx }) => {
    const conds = [eq(bookings.customerAccountId, ctx.customer.customerId)];
    if (ctx.customer.email) conds.push(eq(bookings.contactEmail, ctx.customer.email));
    const rows = await getDb()
      .select()
      .from(bookings)
      .where(or(...conds))
      .orderBy(desc(bookings.createdAt))
      .limit(50);
    return rows.map(tripSummary);
  }),

  /** Kundens supportsaker med meldinger (ikke interne notater). Krever verifisert e-post. */
  myCasesSecure: verifiedCustomerProcedure.query(async ({ ctx }) => {
    const email = ctx.customer.email;
    if (!email) return [];
    const db = getDb();
    const cases = await db
      .select()
      .from(supportCases)
      .where(eq(supportCases.customerEmail, email))
      .orderBy(desc(supportCases.createdAt))
      .limit(50);
    if (!cases.length) return [];
    const messages = await db
      .select({
        id: supportMessages.id,
        caseId: supportMessages.caseId,
        caseReference: supportMessages.caseReference,
        message: supportMessages.message,
        authorType: supportMessages.authorType,
        createdAt: supportMessages.createdAt,
        topic: supportMessages.topic,
      })
      .from(supportMessages)
      .where(and(inArray(supportMessages.caseId, cases.map((c) => c.id)), eq(supportMessages.isInternal, false)))
      .orderBy(supportMessages.id)
      .limit(500);
    return cases.map((c) => ({
      id: c.id,
      reference: c.reference,
      subject: c.subject,
      status: c.status,
      priority: c.priority,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      messages: messages
        .filter((m) => m.caseId === c.id)
        .map((m) => ({
          id: m.id,
          message: m.message,
          fromStaff: m.authorType !== "customer",
          topic: m.topic,
          createdAt: m.createdAt.toISOString(),
        })),
    }));
  }),

  /** Bekreft e-postadressen via lenken fra registrerings-e-posten. */
  verifyEmail: publicQuery
    .input(z.object({ token: z.string().min(10).max(200) }))
    .mutation(async ({ input, ctx }) => {
      assertRateLimit("customer-verify-email", clientIp(ctx.req), 10, 10 * 60_000);
      const db = getDb();
      const rows = await db
        .select()
        .from(customerEmailTokens)
        .where(
          and(
            eq(customerEmailTokens.tokenHash, sha256Hex(input.token)),
            isNull(customerEmailTokens.usedAt),
            gt(customerEmailTokens.expiresAt, new Date()),
          ),
        )
        .limit(1);
      const tok = rows[0];
      if (!tok) {
        throw new AppError("VALIDATION", { message: "Lenken er utløpt eller ugyldig. Be om en ny fra profilen din." });
      }
      await db.update(customerAccounts).set({ emailVerified: true }).where(eq(customerAccounts.id, tok.customerId));
      await db.update(customerEmailTokens).set({ usedAt: new Date() }).where(eq(customerEmailTokens.id, tok.id));
      await logAudit({ actorType: "customer", actorId: tok.customerId, action: "customer.email_verified", targetType: "customer_account", targetId: tok.customerId, ip: clientIp(ctx.req) });
      return { ok: true };
    }),

  resendVerification: customerProcedure.mutation(async ({ ctx }) => {
    if (!ctx.customer.email) {
      throw new AppError("VALIDATION", { message: "Kontoen har ingen e-postadresse." });
    }
    if (ctx.customer.emailVerified) return { ok: true, alreadyVerified: true };
    assertRateLimit("customer-resend-verify", clientIp(ctx.req), 3, 10 * 60_000);
    assertRateLimit("customer-resend-verify-acct", String(ctx.customer.customerId), 3, 60 * 60_000);
    await issueVerificationEmail(ctx.customer.customerId, ctx.customer.email, ctx.customer.firstName, ctx.customer.locale);
    return { ok: true, alreadyVerified: false };
  }),

  /** Innlogging med engangskode på SMS (OTA-071). Koden logges aldri. */
  requestLoginCode: publicQuery.input(loginCodeRequestInput).mutation(({ input, ctx }) => sendLoginCode(input, ctx)),

  verifyLoginCode: publicQuery.input(loginCodeVerifyInput).mutation(({ input, ctx }) => verifyLoginCodeLogin(input, ctx, cookieIssuer(ctx))),

  /** Logg ut alle enheter (sikkerhet). */
  logoutAll: customerProcedure.mutation(async ({ ctx }) => {
    await revokeAllCustomerSessions(ctx.customer.customerId);
    clearCustomerCookie(ctx.resHeaders);
    await logAudit({ actorType: "customer", actorId: ctx.customer.customerId, action: "customer.logout_all", targetType: "customer_account", targetId: ctx.customer.customerId, ip: clientIp(ctx.req) });
    return { ok: true };
  }),

  /** Rediger navn og telefon. */
  updateProfile: customerProcedure.input(profileInput).mutation(async ({ input, ctx }) => {
    // Nettets profilside lagrer fortsatt nummeret direkte (egen flyt i src/); se profilePatch.
    const patch = await profilePatch(ctx.customer, input, { ip: clientIp(ctx.req), phoneChange: "direct" });
    await getDb().update(customerAccounts).set(patch).where(eq(customerAccounts.id, ctx.customer.customerId));
    return { ok: true };
  }),

  /** Språk, valuta og markedsføringssamtykke (OTA-136). */
  updatePreferences: customerProcedure
    .input(
      z.object({
        locale: z.enum(LOCALES).optional(),
        currency: z.enum(CURRENCIES).optional(),
        marketingConsent: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const patch: Partial<typeof customerAccounts.$inferInsert> = {};
      if (input.locale) patch.locale = input.locale;
      if (input.currency) patch.currency = input.currency;
      if (input.marketingConsent !== undefined) {
        patch.marketingConsentAt = input.marketingConsent ? new Date() : null;
        await db.insert(consents).values({
          customerAccountId: ctx.customer.customerId,
          email: ctx.customer.email ?? `customer-${ctx.customer.customerId}@no-email.invalid`,
          type: "marketing",
          version: CONSENT_VERSION,
          granted: input.marketingConsent,
          source: "profile",
          ip: clientIp(ctx.req),
        });
      }
      if (Object.keys(patch).length) {
        await db.update(customerAccounts).set(patch).where(eq(customerAccounts.id, ctx.customer.customerId));
      }
      return { ok: true };
    }),

  /** Profilbilde — liten data-URL (klienten skalerer til 192 px JPEG). */
  setAvatar: customerProcedure
    .input(z.object({ dataUrl: z.string().max(220_000) }))
    .mutation(async ({ input, ctx }) => {
      if (input.dataUrl && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(input.dataUrl)) {
        throw new AppError("VALIDATION", { message: "Bildet må være JPEG, PNG eller WebP.", data: { field: "dataUrl" } });
      }
      await getDb()
        .update(customerAccounts)
        .set({ avatarUrl: input.dataUrl || null })
        .where(eq(customerAccounts.id, ctx.customer.customerId));
      return { ok: true };
    }),

  changePassword: customerProcedure
    .input(z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(1).max(128) }))
    .mutation(async ({ input, ctx }) => {
      assertRateLimit("customer-change-pw", String(ctx.customer.customerId), 5, 10 * 60_000);
      const issues = customerPasswordIssues(input.newPassword);
      if (issues.length) {
        throw new AppError("VALIDATION", { message: issues.join(" "), data: { field: "newPassword" } });
      }
      const db = getDb();
      const account = (
        await db.select().from(customerAccounts).where(eq(customerAccounts.id, ctx.customer.customerId)).limit(1)
      )[0];
      if (!account || !(await verifyPassword(account.passwordHash, input.currentPassword))) {
        throw new AppError("UNAUTHORIZED", { message: "Nåværende passord er feil." });
      }
      const passwordHash = await hashPassword(input.newPassword);
      await db.update(customerAccounts).set({ passwordHash }).where(eq(customerAccounts.id, account.id));
      await revokeAllCustomerSessions(account.id);
      const token = await createCustomerSession(account.id, ctx.req);
      setCustomerCookie(ctx.resHeaders, token);
      await logAudit({ actorType: "customer", actorId: account.id, action: "customer.password_changed", targetType: "customer_account", targetId: account.id, ip: clientIp(ctx.req) });
      return { ok: true };
    }),

  /**
   * Slett kontoen (GDPR art. 17). Bestillinger beholdes som bokføringspliktige
   * bilag (bokføringsloven § 13, 5 år) men kobles fra kontoen. Kontoen
   * anonymiseres i stedet for å slettes fysisk slik at FK-er og revisjon holder.
   */
  deleteAccount: customerProcedure.input(deleteAccountInput).mutation(async ({ input, ctx }) => {
    // Samme tjeneste som appen (api/lib/customerDeletion.ts) og samme sletting
    // som før (CUSTOMER_DATA_MATRIX); alle sesjoner – nett og app – tilbakekalles.
    const res = await deleteCustomerAccount(ctx.customer.customerId, input, { ip: clientIp(ctx.req), via: "web" });
    clearCustomerCookie(ctx.resHeaders);
    return res;
  }),

  /** Dataeksport (GDPR art. 20). Krever verifisert e-post — ellers kan en telefon-konto ikke bevise eierskap til e-postdata. */
  exportMyData: verifiedCustomerProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const id = ctx.customer.customerId;
    const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, id)).limit(1);
    if (!account) throw new AppError("NOT_FOUND");
    const accountSafe = { ...account } as Partial<typeof account>;
    delete accountSafe.passwordHash; // aldri ut
    delete accountSafe.avatarUrl; // stor data-URL, ikke relevant

    const bookingConds = [eq(bookings.customerAccountId, id)];
    if (ctx.customer.email) bookingConds.push(eq(bookings.contactEmail, ctx.customer.email));

    const [travelers, alerts, consentRows, posts, comments, bookingRows, cases] = await Promise.all([
      db.select().from(savedTravelers).where(eq(savedTravelers.customerId, id)),
      db.select().from(priceAlerts).where(eq(priceAlerts.customerId, id)),
      db.select().from(consents).where(eq(consents.customerAccountId, id)),
      db.select().from(communityPosts).where(eq(communityPosts.customerId, id)),
      db.select().from(communityComments).where(eq(communityComments.customerId, id)),
      db.select().from(bookings).where(or(...bookingConds)).orderBy(desc(bookings.createdAt)).limit(500),
      ctx.customer.email
        ? db.select().from(supportCases).where(eq(supportCases.customerEmail, ctx.customer.email)).limit(200)
        : Promise.resolve([] as (typeof supportCases.$inferSelect)[]),
    ]);
    const caseMessages = cases.length
      ? await db
          .select()
          .from(supportMessages)
          .where(and(inArray(supportMessages.caseId, cases.map((c) => c.id)), eq(supportMessages.isInternal, false)))
      : [];

    await logAudit({ actorType: "customer", actorId: id, action: "customer.data_exported", targetType: "customer_account", targetId: id, ip: clientIp(ctx.req) });

    return {
      exportedAt: new Date().toISOString(),
      account: accountSafe,
      savedTravelers: travelers,
      priceAlerts: alerts,
      consents: consentRows,
      community: { posts, comments },
      bookings: bookingRows.map((b) => {
        let order: unknown = null;
        try { order = JSON.parse(b.payload); } catch { order = null; }
        return { ...tripSummary(b), order };
      }),
      supportCases: cases.map((c) => ({
        ...c,
        messages: caseMessages.filter((m) => m.caseId === c.id).map((m) => ({ id: m.id, authorType: m.authorType, message: m.message, createdAt: m.createdAt })),
      })),
    };
  }),

  resetPassword: publicQuery
    .input(z.object({ token: z.string().min(10).max(200), password: z.string().min(1).max(128) }))
    .mutation(async ({ input, ctx }) => {
      const ip = clientIp(ctx.req);
      assertRateLimit("customer-reset", ip, 8, 10 * 60_000);
      const issues = customerPasswordIssues(input.password);
      if (issues.length) {
        throw new AppError("VALIDATION", { message: issues.join(" "), data: { field: "password" } });
      }
      const db = getDb();
      const rows = await db
        .select()
        .from(customerPasswordResets)
        .where(
          and(
            eq(customerPasswordResets.tokenHash, sha256Hex(input.token)),
            isNull(customerPasswordResets.usedAt),
            gt(customerPasswordResets.expiresAt, new Date()),
          ),
        )
        .limit(1);
      const reset = rows[0];
      if (!reset) {
        throw new AppError("VALIDATION", { message: "Lenken er utløpt eller ugyldig. Be om en ny tilbakestillingslenke." });
      }
      // Sjekkes før lenken brukes opp: en ansatts e-post får verken nytt kundepassord eller kundesesjon.
      const [target] = await db.select({ email: customerAccounts.email }).from(customerAccounts).where(eq(customerAccounts.id, reset.customerId)).limit(1);
      if (await isStaffEmail(target?.email)) {
        throw new AppError("VALIDATION", { message: "Lenken er utløpt eller ugyldig. Be om en ny tilbakestillingslenke." });
      }
      // Engangsbruk — atomisk
      const used = await db
        .update(customerPasswordResets)
        .set({ usedAt: new Date() })
        .where(and(eq(customerPasswordResets.id, reset.id), isNull(customerPasswordResets.usedAt)));
      if (Number(used[0].affectedRows) === 0) {
        throw new AppError("VALIDATION", { message: "Lenken er allerede brukt. Be om en ny tilbakestillingslenke." });
      }

      const passwordHash = await hashPassword(input.password);
      await db.update(customerAccounts).set({ passwordHash }).where(eq(customerAccounts.id, reset.customerId));
      // Gamle sesjoner tilbakekalles — ny sesjon opprettes for denne enheten.
      await revokeAllCustomerSessions(reset.customerId);
      const token = await createCustomerSession(reset.customerId, ctx.req);
      setCustomerCookie(ctx.resHeaders, token);
      await logAudit({ actorType: "customer", actorId: reset.customerId, action: "customer.password_reset", targetType: "customer_account", targetId: reset.customerId, ip });

      const account = (
        await db.select().from(customerAccounts).where(eq(customerAccounts.id, reset.customerId)).limit(1)
      )[0];
      if (!account) throw new AppError("NOT_FOUND");
      return publicProfile(account);
    }),
});
