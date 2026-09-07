import { randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { and, desc, eq, gt, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { createRouter, customerProcedure, publicQuery, verifiedCustomerProcedure } from "./middleware";
import { getDb } from "./queries/connection";
import {
  auditLogs,
  bookingHolds,
  bookings,
  communityComments,
  communityLikes,
  communityPosts,
  consents,
  customerAccounts,
  customerEmailTokens,
  customerOtpCodes,
  customerPasswordResets,
  customerSessions,
  fraudFlags,
  priceAlerts,
  savedTravelers,
  supportCases,
  supportMessages,
} from "../db/schema";
import type { Order } from "../contracts/types";
import { hashPassword, verifyPassword } from "./lib/passwords";
import { randomToken, sha256Hex } from "./lib/tokens";
import {
  clearCustomerCookie,
  createCustomerSession,
  recentCustomerSessions,
  revokeAllCustomerSessions,
  revokeCustomerSession,
  setCustomerCookie,
} from "./lib/customerSessions";
import { assertRateLimit, clientIp } from "./lib/ratelimit";
import { sendLoginAlertEmail, sendPasswordResetEmail, sendVerifyEmail } from "./lib/mailer";
import { sendSms } from "./lib/sms";
import { AppError } from "./lib/errors";
import { env } from "./lib/env";
import { logAudit } from "./lib/audit";
import { log } from "./lib/logger";
import { normalizePhone } from "./lib/validation";
import { recordReward, rewardRules } from "./lib/rewards";

const RESET_TTL_MS = 60 * 60_000; // 1 time
const VERIFY_TTL_MS = 72 * 60 * 60_000; // 72 timer
const OTP_TTL_MS = 10 * 60_000; // 10 minutter
const REGISTRATION_VELOCITY_LIMIT = 5; // kontoer per IP per 24t før fraud-flagg
const CONSENT_VERSION = "2026-09";

const LOCALES = ["nb", "en", "sv", "da", "de"] as const;
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

type Identifier = { kind: "email"; value: string } | { kind: "phone"; value: string };

/** Kunde kan logge inn/registrere seg med enten e-post eller telefonnummer (E.164). */
export function parseIdentifier(raw: string): Identifier {
  const trimmed = raw.trim();
  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 255) {
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

function publicProfile(a: Partial<AccountRow> & { id: number; firstName: string; lastName: string }) {
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

export const customerAuthRouter = createRouter({
  register: publicQuery
    .input(
      z.object({
        identifier: identifierSchema,
        password: z.string().min(1).max(128),
        firstName: nameSchema,
        lastName: nameSchema,
        referralCode: z.string().trim().max(16).optional(),
        locale: z.enum(LOCALES).optional(),
        marketingConsent: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const ip = clientIp(ctx.req);
      assertRateLimit("customer-register", ip, 6, 10 * 60_000);
      const id = parseIdentifier(input.identifier);

      const issues = customerPasswordIssues(input.password);
      if (issues.length) {
        throw new AppError("VALIDATION", { message: issues.join(" "), data: { field: "password" } });
      }

      const db = getDb();
      const existing = await db.select({ id: customerAccounts.id }).from(customerAccounts).where(whereIdentifier(id)).limit(1);
      if (existing[0]) {
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
      const result = await db.insert(customerAccounts).values({
        email: id.kind === "email" ? id.value : null,
        phone: id.kind === "phone" ? id.value : null,
        passwordHash,
        firstName,
        lastName,
        referralCode: genReferralCode(),
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

      const token = await createCustomerSession(customerId, ctx.req);
      setCustomerCookie(ctx.resHeaders, token);

      return publicProfile({
        id: customerId,
        email: id.kind === "email" ? id.value : null,
        phone: id.kind === "phone" ? id.value : null,
        firstName,
        lastName,
        emailVerified: false,
        bonusKr: 0,
        locale,
        marketingConsentAt: input.marketingConsent ? new Date() : null,
      });
    }),

  login: publicQuery
    .input(z.object({ identifier: identifierSchema, password: z.string().min(1).max(128) }))
    .mutation(async ({ input, ctx }) => {
      const ip = clientIp(ctx.req);
      assertRateLimit("customer-login", ip, 8, 5 * 60_000);
      const id = parseIdentifier(input.identifier);
      // Også per identitet — hindrer distribuert gjetting mot én konto
      assertRateLimit("customer-login-id", sha256Hex(id.value).slice(0, 32), 20, 15 * 60_000);

      const db = getDb();
      const rows = await db.select().from(customerAccounts).where(whereIdentifier(id)).limit(1);
      const account = rows[0];
      // Samme feilmelding enten kontoen mangler, er slettet eller passordet er feil.
      const ok = account && !account.deletedAt ? await verifyPassword(account.passwordHash, input.password) : false;
      if (!account || !ok) {
        await logAudit({
          actorType: "customer", actorId: account?.id ?? null, action: "customer.login_failed",
          targetType: "customer_account", targetId: account?.id ?? null, ip,
        });
        throw new AppError("UNAUTHORIZED", { message: "Feil e-post/telefon eller passord." });
      }

      // Innloggingsvarsel kun ved ny enhet/IP (OTA-078): sammenlign med siste 3 sesjoner FØR ny opprettes
      const ua = ctx.req.headers.get("user-agent")?.slice(0, 255) ?? null;
      const recent = await recentCustomerSessions(account.id, 3).catch(() => []);
      const known = recent.some((s) => s.ip === ip && s.userAgent === ua);

      const token = await createCustomerSession(account.id, ctx.req);
      setCustomerCookie(ctx.resHeaders, token);
      await logAudit({
        actorType: "customer", actorId: account.id, actorLabel: account.firstName, action: "customer.login",
        targetType: "customer_account", targetId: account.id, ip, metadata: { newDevice: !known },
      });
      if (!known && account.email && account.emailVerified) {
        sendLoginAlertEmail({ email: account.email, firstName: account.firstName, ip, userAgent: ua ?? undefined, locale: account.locale })
          .catch((err) => log.warn({ err: String(err) }, "innloggingsvarsel feilet"));
      }
      return publicProfile(account);
    }),

  logout: publicQuery.mutation(async ({ ctx }) => {
    if (ctx.customer) {
      await revokeCustomerSession(ctx.customer.sessionId).catch(() => {});
    }
    clearCustomerCookie(ctx.resHeaders);
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
    .mutation(async ({ input, ctx }) => {
      const ip = clientIp(ctx.req);
      assertRateLimit("customer-reset-req", ip, 5, 10 * 60_000);
      const email = input.email.toLowerCase().trim();
      assertRateLimit("customer-reset-req-email", sha256Hex(email).slice(0, 32), 3, 60 * 60_000);
      const db = getDb();
      const rows = await db
        .select()
        .from(customerAccounts)
        .where(and(eq(customerAccounts.email, email), isNull(customerAccounts.deletedAt)))
        .limit(1);
      const account = rows[0];
      if (account) {
        const token = randomToken(32);
        await db.insert(customerPasswordResets).values({
          tokenHash: sha256Hex(token),
          customerId: account.id,
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        });
        await sendPasswordResetEmail({
          email,
          firstName: account.firstName,
          locale: account.locale,
          url: `${env.baseUrl}/tilbakestill-passord?token=${encodeURIComponent(token)}`,
        }).catch((err) => log.warn({ err: String(err) }, "reset-e-post feilet"));
        await logAudit({ actorType: "customer", actorId: account.id, action: "customer.password_reset_requested", targetType: "customer_account", targetId: account.id, ip });
      }
      return { ok: true };
    }),

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
  requestLoginCode: publicQuery
    .input(z.object({ phone: z.string().min(8).max(20) }))
    .mutation(async ({ input, ctx }) => {
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
      if (account) {
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
    }),

  verifyLoginCode: publicQuery
    .input(z.object({ phone: z.string().min(8).max(20), code: z.string().regex(/^\d{6}$/) }))
    .mutation(async ({ input, ctx }) => {
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
      if (!account) throw new AppError("UNAUTHORIZED", { message: "Feil kode eller telefonnummer." });

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

      const token = await createCustomerSession(account.id, ctx.req);
      setCustomerCookie(ctx.resHeaders, token);
      await logAudit({ actorType: "customer", actorId: account.id, actorLabel: account.firstName, action: "customer.login", targetType: "customer_account", targetId: account.id, ip, metadata: { via: "otp" } });
      return publicProfile(account);
    }),

  /** Logg ut alle enheter (sikkerhet). */
  logoutAll: customerProcedure.mutation(async ({ ctx }) => {
    await revokeAllCustomerSessions(ctx.customer.customerId);
    clearCustomerCookie(ctx.resHeaders);
    await logAudit({ actorType: "customer", actorId: ctx.customer.customerId, action: "customer.logout_all", targetType: "customer_account", targetId: ctx.customer.customerId, ip: clientIp(ctx.req) });
    return { ok: true };
  }),

  /** Rediger navn og telefon. */
  updateProfile: customerProcedure
    .input(
      z.object({
        firstName: nameSchema,
        lastName: nameSchema,
        phone: z.string().trim().max(20).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const patch: Partial<typeof customerAccounts.$inferInsert> = {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
      };
      if (input.phone !== undefined) {
        if (input.phone.trim() === "") {
          if (!ctx.customer.email) {
            throw new AppError("VALIDATION", { message: "Kontoen må ha enten e-post eller telefonnummer.", data: { field: "phone" } });
          }
          patch.phone = null;
        } else {
          const phone = normalizePhone(input.phone);
          if (!phone) throw new AppError("VALIDATION", { message: "Ugyldig telefonnummer. Bruk landskode, f.eks. +47 912 34 567.", data: { field: "phone" } });
          const taken = await db
            .select({ id: customerAccounts.id })
            .from(customerAccounts)
            .where(and(inArray(customerAccounts.phone, phoneCandidates(phone)), sql`${customerAccounts.id} <> ${ctx.customer.customerId}`))
            .limit(1);
          if (taken.length) throw new AppError("CONFLICT", { message: "Telefonnummeret er allerede i bruk på en annen konto.", data: { field: "phone" } });
          patch.phone = phone;
        }
      }
      await db.update(customerAccounts).set(patch).where(eq(customerAccounts.id, ctx.customer.customerId));
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
  deleteAccount: customerProcedure
    .input(z.object({ password: z.string().min(1).max(128) }))
    .mutation(async ({ input, ctx }) => {
      const ip = clientIp(ctx.req);
      assertRateLimit("customer-delete", String(ctx.customer.customerId), 5, 10 * 60_000);
      const db = getDb();
      const account = (
        await db.select().from(customerAccounts).where(eq(customerAccounts.id, ctx.customer.customerId)).limit(1)
      )[0];
      if (!account || !(await verifyPassword(account.passwordHash, input.password))) {
        throw new AppError("UNAUTHORIZED", { message: "Passordet er feil." });
      }
      const id = account.id;
      await db.transaction(async (tx) => {
        // Sesjoner og engangs-tokens
        await tx.update(customerSessions).set({ revokedAt: new Date() }).where(and(eq(customerSessions.customerId, id), isNull(customerSessions.revokedAt)));
        await tx.delete(customerOtpCodes).where(eq(customerOtpCodes.customerId, id));
        await tx.delete(customerEmailTokens).where(eq(customerEmailTokens.customerId, id));
        await tx.delete(customerPasswordResets).where(eq(customerPasswordResets.customerId, id));
        // Personopplysninger knyttet til kontoen
        await tx.delete(savedTravelers).where(eq(savedTravelers.customerId, id));
        await tx.delete(bookingHolds).where(eq(bookingHolds.customerId, id));
        await tx.update(priceAlerts).set({ active: false, email: "deleted" }).where(eq(priceAlerts.customerId, id));
        // Samfunn: fjern likes (og juster tellere), kommentarer og innlegg
        const likedPosts = await tx.select({ postId: communityLikes.postId }).from(communityLikes).where(eq(communityLikes.customerId, id));
        if (likedPosts.length) {
          await tx
            .update(communityPosts)
            .set({ likes: sql`greatest(0, ${communityPosts.likes} - 1)` })
            .where(inArray(communityPosts.id, likedPosts.map((l) => l.postId)));
        }
        await tx.delete(communityLikes).where(eq(communityLikes.customerId, id));
        await tx.delete(communityComments).where(eq(communityComments.customerId, id));
        await tx.delete(communityPosts).where(eq(communityPosts.customerId, id)); // kommentarer/likes på egne innlegg kaskaderer
        // Bestillinger beholdes (bokføring) men kobles fra kontoen
        await tx.update(bookings).set({ customerAccountId: null }).where(eq(bookings.customerAccountId, id));
        // Anonymiser kontoen
        await tx
          .update(customerAccounts)
          .set({
            email: `deleted-${id}@anonymized.invalid`,
            phone: null,
            firstName: "Slettet",
            lastName: "Bruker",
            passwordHash: "!deleted", // kan aldri verifiseres
            emailVerified: false,
            avatarUrl: null,
            referralCode: null,
            bonusKr: 0,
            marketingConsentAt: null,
            deletedAt: new Date(),
          })
          .where(eq(customerAccounts.id, id));
      });
      await logAudit({
        actorType: "customer", actorId: id, action: "customer.account_deleted",
        targetType: "customer_account", targetId: id, ip,
      });
      clearCustomerCookie(ctx.resHeaders);
      return { ok: true };
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
