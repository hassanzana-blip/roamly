import { z } from "zod";
import { eq, isNull, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import QRCode from "qrcode";
import { createRouter, freshSessionProcedure, permittedProcedure, publicQuery, staffProcedure } from "./middleware";
import { getDb } from "./queries/connection";
import { staffInvites, staffUsers } from "../db/schema";
import { hashPassword, passwordIssues, verifyPassword } from "./lib/passwords";
import { randomToken, sha256Hex } from "./lib/tokens";
import {
  clearSessionCookie,
  createSession,
  markMfaVerified,
  revokeAllUserSessions,
  revokeOtherUserSessions,
  revokeSession,
  rotateSession,
  sessionIsFresh,
  setSessionCookie,
} from "./lib/sessions";
import { generateRecoveryCodes, newTotpSecret, totpUri, verifyTotp } from "./lib/totp";
import { assertRateLimit, clientIp } from "./lib/ratelimit";
import { logAudit } from "./lib/audit";
import { env } from "./lib/env";
import { AppError } from "./lib/errors";
import { ROLE_PERMISSIONS, VALID_ROLES, type StaffRole } from "./lib/rbac";

const INVITE_TTL_MS = 48 * 60 * 60_000;

async function issueRecoveryCodes(): Promise<{ plain: string[]; hashedJson: string }> {
  const plain = generateRecoveryCodes(8);
  const hashed = await Promise.all(plain.map((c) => hashPassword(c)));
  return { plain, hashedJson: JSON.stringify(hashed) };
}

async function consumeRecoveryCode(userId: number, code: string): Promise<boolean> {
  const db = getDb();
  const rows = await db.select().from(staffUsers).where(eq(staffUsers.id, userId)).limit(1);
  const user = rows[0];
  if (!user?.recoveryCodesJson) return false;
  const hashes = JSON.parse(user.recoveryCodesJson) as string[];
  for (let i = 0; i < hashes.length; i++) {
    if (await verifyPassword(hashes[i], code.trim().toUpperCase())) {
      hashes.splice(i, 1);
      await db
        .update(staffUsers)
        .set({ recoveryCodesJson: JSON.stringify(hashes) })
        .where(eq(staffUsers.id, userId));
      return true;
    }
  }
  return false;
}

async function qrDataUrl(uri: string): Promise<string> {
  return QRCode.toDataURL(uri, { errorCorrectionLevel: "M", margin: 1, width: 240 });
}

/** Innlogget staff uten krav om bekreftet MFA (kun for selve MFA-flyten). */
const preMfaStaffProcedure = publicQuery.use(({ ctx, next }) => {
  if (!ctx.staff) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sesjonen er utløpt." });
  return next({ ctx: { ...ctx, staff: ctx.staff } });
});

export const staffAuthRouter = createRouter({
  /**
   * Innlogging steg 1: e-post + passord → sesjon (OTA-074: MFA er påkrevd).
   *  - mfaEnabled  → sesjonen venter på verifyMfa (mfaRequired: true)
   *  - !mfaEnabled → sesjonen er «ferdig», men kontoen må sette opp MFA nå
   *                  (mfaSetupRequired: true → beginMfaSetup/completeMfaSetup)
   */
  login: publicQuery
    .input(z.object({ email: z.string().email(), password: z.string().min(1).max(128) }))
    .mutation(async ({ input, ctx }) => {
      const ip = clientIp(ctx.req);
      assertRateLimit("staff-login", ip, 8, 5 * 60_000);
      const db = getDb();
      const email = input.email.toLowerCase().trim();
      assertRateLimit("staff-login-email", sha256Hex(email).slice(0, 32), 10, 15 * 60_000);
      const rows = await db.select().from(staffUsers).where(eq(staffUsers.email, email)).limit(1);
      const user = rows[0];

      const ok = user?.passwordHash ? await verifyPassword(user.passwordHash, input.password) : false;
      if (!user || !ok) {
        await logAudit({
          actorType: "staff", actorId: email, action: "auth.login_failed",
          targetType: "staff_user", targetId: user?.id ?? null, ip,
        });
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Feil e-post eller passord." });
      }
      if (user.status !== "active") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kontoen er ikke aktivert ennå." });
      }

      const token = await createSession(user.id, ctx.req, !user.mfaEnabled);
      setSessionCookie(ctx.resHeaders, token);
      await db.update(staffUsers).set({ lastLoginAt: new Date() }).where(eq(staffUsers.id, user.id));
      await logAudit({
        actorType: "staff", actorId: user.id, actorLabel: user.name, action: "auth.login",
        targetType: "staff_user", targetId: user.id, ip, metadata: { mfaRequired: user.mfaEnabled },
      });
      return {
        mfaRequired: user.mfaEnabled,
        mfaSetupRequired: !user.mfaEnabled,
        name: user.name,
        role: user.role,
      };
    }),

  /** Innlogging steg 2: TOTP eller gjenopprettingskode. */
  verifyMfa: preMfaStaffProcedure
    .input(z.object({ code: z.string().min(6).max(12) }))
    .mutation(async ({ input, ctx }) => {
      const ip = clientIp(ctx.req);
      assertRateLimit("staff-mfa", ip, 10, 5 * 60_000);
      assertRateLimit("staff-mfa-user", String(ctx.staff.userId), 6, 5 * 60_000);
      const db = getDb();
      const rows = await db.select().from(staffUsers).where(eq(staffUsers.id, ctx.staff.userId)).limit(1);
      const user = rows[0];
      if (!user?.totpSecret || !user.mfaEnabled) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "MFA er ikke satt opp. Fullfør oppsettet først." });
      }

      let verified = await verifyTotp(user.totpSecret, input.code);
      if (!verified) verified = await consumeRecoveryCode(user.id, input.code);
      if (!verified) {
        await logAudit({
          actorType: "staff", actorId: user.id, actorLabel: user.name,
          action: "auth.mfa_failed", targetType: "staff_user", targetId: user.id, ip,
        });
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Feil kode. Prøv igjen." });
      }
      await markMfaVerified(ctx.staff.sessionId);
      await rotateSession(ctx.staff.sessionId, ctx.resHeaders);
      await logAudit({
        actorType: "staff", actorId: user.id, actorLabel: user.name,
        action: "auth.mfa_verified", targetType: "staff_user", targetId: user.id, ip,
      });
      return { ok: true };
    }),

  /**
   * MFA-oppsett for eksisterende konto uten TOTP (OTA-074). Krever innlogget
   * sesjon (passord bekreftet), men ikke MFA — det er nettopp det som settes opp.
   */
  beginMfaSetup: preMfaStaffProcedure.mutation(async ({ ctx }) => {
    assertRateLimit("staff-mfa-setup", String(ctx.staff.userId), 5, 10 * 60_000);
    const db = getDb();
    const [user] = await db.select().from(staffUsers).where(eq(staffUsers.id, ctx.staff.userId)).limit(1);
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke kontoen." });
    if (user.mfaEnabled) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "MFA er allerede aktivert på kontoen." });
    }
    const secret = newTotpSecret();
    await db.update(staffUsers).set({ totpSecret: secret }).where(eq(staffUsers.id, user.id));
    const uri = totpUri(user.email, secret);
    return { otpauthUri: uri, qrDataUrl: await qrDataUrl(uri), email: user.email };
  }),

  completeMfaSetup: preMfaStaffProcedure
    .input(z.object({ code: z.string().min(6).max(8) }))
    .mutation(async ({ input, ctx }) => {
      const ip = clientIp(ctx.req);
      assertRateLimit("staff-mfa-setup-verify", String(ctx.staff.userId), 8, 10 * 60_000);
      const db = getDb();
      const [user] = await db.select().from(staffUsers).where(eq(staffUsers.id, ctx.staff.userId)).limit(1);
      if (!user?.totpSecret) throw new TRPCError({ code: "BAD_REQUEST", message: "Start MFA-oppsettet på nytt." });
      if (user.mfaEnabled) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "MFA er allerede aktivert." });
      if (!(await verifyTotp(user.totpSecret, input.code))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Feil kode fra autentikator-appen." });
      }
      const recovery = await issueRecoveryCodes();
      await db
        .update(staffUsers)
        .set({ mfaEnabled: true, recoveryCodesJson: recovery.hashedJson })
        .where(eq(staffUsers.id, user.id));
      await markMfaVerified(ctx.staff.sessionId);
      await rotateSession(ctx.staff.sessionId, ctx.resHeaders);
      // Andre sesjoner ble opprettet uten MFA-krav — logg dem ut, behold denne.
      await revokeOtherUserSessions(user.id, ctx.staff.sessionId);
      await logAudit({
        actorType: "staff", actorId: user.id, actorLabel: user.name,
        action: "auth.mfa_enabled", targetType: "staff_user", targetId: user.id, ip,
      });
      return { ok: true, recoveryCodes: recovery.plain };
    }),

  logout: publicQuery.mutation(async ({ ctx }) => {
    if (ctx.staff) {
      await revokeSession(ctx.staff.sessionId);
      await logAudit({
        actorType: "staff", actorId: ctx.staff.userId, actorLabel: ctx.staff.name,
        action: "auth.logout", targetType: "staff_user", targetId: ctx.staff.userId,
      });
    }
    clearSessionCookie(ctx.resHeaders);
    return { ok: true };
  }),

  me: publicQuery.query(({ ctx }) => {
    if (!ctx.staff) return { authenticated: false as const };
    return {
      authenticated: true as const,
      userId: ctx.staff.userId,
      email: ctx.staff.email,
      name: ctx.staff.name,
      role: ctx.staff.role,
      avatarUrl: ctx.staff.avatarUrl,
      mfaEnabled: ctx.staff.mfaEnabled,
      mfaVerified: ctx.staff.mfaVerified,
      mfaSetupRequired: !ctx.staff.mfaEnabled,
      sessionFresh: sessionIsFresh(ctx.staff),
      environment: env.APP_ENV,
    };
  }),

  /**
   * Aktivering steg 1: valider invitasjon, sett passord og opprett TOTP-hemmelighet.
   * Kontoen blir IKKE aktiv før completeActivation har bekreftet koden.
   */
  beginActivation: publicQuery
    .input(z.object({ token: z.string().min(20), password: z.string().min(1).max(128) }))
    .mutation(async ({ input, ctx }) => {
      assertRateLimit("staff-activate", clientIp(ctx.req), 8, 60 * 60_000);
      const issues = passwordIssues(input.password);
      if (issues.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: issues.join(" ") });
      }
      const db = getDb();
      const invites = await db
        .select()
        .from(staffInvites)
        .where(eq(staffInvites.tokenHash, sha256Hex(input.token)))
        .limit(1);
      const invite = invites[0];
      if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Lenken er utløpt eller allerede brukt." });
      }
      const users = await db.select().from(staffUsers).where(eq(staffUsers.email, invite.email)).limit(1);
      const user = users[0];
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke kontoen." });
      if (user.status === "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Kontoen er allerede aktivert. Logg inn." });
      }

      const secret = newTotpSecret();
      await db
        .update(staffUsers)
        .set({ passwordHash: await hashPassword(input.password), totpSecret: secret, mfaEnabled: false })
        .where(eq(staffUsers.id, user.id));
      const uri = totpUri(user.email, secret);
      return { ok: true, email: user.email, otpauthUri: uri, qrDataUrl: await qrDataUrl(uri) };
    }),

  /** Aktivering steg 2: bekreft TOTP → kontoen aktiveres, recovery-koder vises én gang. */
  completeActivation: publicQuery
    .input(z.object({ token: z.string().min(20), totpCode: z.string().min(6).max(8) }))
    .mutation(async ({ input, ctx }) => {
      assertRateLimit("staff-activate-verify", clientIp(ctx.req), 10, 10 * 60_000);
      const db = getDb();
      const invites = await db
        .select()
        .from(staffInvites)
        .where(eq(staffInvites.tokenHash, sha256Hex(input.token)))
        .limit(1);
      const invite = invites[0];
      if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Lenken er utløpt eller allerede brukt." });
      }
      const users = await db.select().from(staffUsers).where(eq(staffUsers.email, invite.email)).limit(1);
      const user = users[0];
      if (!user?.totpSecret || !user.passwordHash) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Start aktiveringen på nytt." });
      }

      if (!(await verifyTotp(user.totpSecret, input.totpCode))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Feil kode fra autentikator-appen." });
      }

      const recovery = await issueRecoveryCodes();
      await db
        .update(staffUsers)
        .set({ status: "active", mfaEnabled: true, recoveryCodesJson: recovery.hashedJson })
        .where(eq(staffUsers.id, user.id));
      await db.update(staffInvites).set({ usedAt: new Date() }).where(eq(staffInvites.id, invite.id));
      await logAudit({
        actorType: "staff", actorId: user.id, actorLabel: user.name,
        action: "auth.account_activated", targetType: "staff_user", targetId: user.id,
        metadata: { role: user.role }, ip: clientIp(ctx.req),
      });
      return { ok: true, recoveryCodes: recovery.plain };
    }),

  // ─── Førstegangsoppsett (kun utenfor produksjon) ─────────────────────────
  // Selvdeaktiverende: så snart én konto er aktivert svares needsSetup=false.
  // I produksjon (APP_ENV=production) er flyten helt avslått — bruk
  // `npm run bootstrap:admins` med BOOTSTRAP_*-variabler (OTA-080).

  setupStatus: publicQuery.query(async () => {
    if (env.isProdEnv) return { needsSetup: false };
    assertRateLimit("staff-setup-status", "global", 30, 60_000);
    const rows = await getDb().select({ id: staffUsers.id }).from(staffUsers)
      .where(ne(staffUsers.status, "invited")).limit(1);
    return { needsSetup: rows.length === 0 };
  }),

  claimFirstOwner: publicQuery
    .input(z.object({
      email: z.string().email(),
      name: z.string().trim().min(1).max(100),
    }))
    .mutation(async ({ input, ctx }) => {
      if (env.isProdEnv) {
        throw new AppError("FORBIDDEN", { message: "Førstegangsoppsett via nett er avslått i produksjon. Bruk bootstrap-skriptet." });
      }
      assertRateLimit("staff-claim-owner", clientIp(ctx.req), 5, 60 * 60_000);
      const db = getDb();
      const existing = await db.select({ id: staffUsers.id }).from(staffUsers)
        .where(ne(staffUsers.status, "invited")).limit(1);
      if (existing.length > 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Oppsett er allerede fullført. Be en eier om en invitasjon.",
        });
      }
      // Rydd bort halvferdige oppsett: inviterte-men-aldri-aktiverte kontoer
      // og ubrukte invitasjoner, slik at en avbrutt aktivering ikke låser alt.
      await db.delete(staffUsers).where(eq(staffUsers.status, "invited"));
      await db.delete(staffInvites).where(isNull(staffInvites.usedAt));
      const email = input.email.toLowerCase().trim();
      await db.insert(staffUsers).values({ email, name: input.name, role: "OWNER", status: "invited" });
      const token = randomToken(32);
      await db.insert(staffInvites).values({
        email, role: "OWNER", tokenHash: sha256Hex(token),
        createdById: null, expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      });
      await logAudit({
        actorType: "staff", actorId: email, action: "staff.first_owner_claimed",
        targetType: "staff_user", targetId: email, ip: clientIp(ctx.req),
      });
      // Relativ sti — virker på alle verter (preview, staging).
      return { setupPath: `/admin/aktiver?token=${token}`, expiresInHours: 48 };
    }),

  // ─── Staff-administrasjon (krever staff:manage — kun OWNER) ──────────────

  listStaff: permittedProcedure("staff:read").query(async () => {
    const rows = await getDb().select().from(staffUsers);
    return rows.map((u) => ({
      id: u.id, email: u.email, name: u.name, role: u.role, status: u.status,
      avatarUrl: u.avatarUrl, mfaEnabled: u.mfaEnabled, lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    }));
  }),

  createInvite: freshSessionProcedure("staff:manage")
    .input(z.object({
      email: z.string().email(),
      name: z.string().trim().min(1).max(100),
      role: z.enum(VALID_ROLES as [string, ...string[]]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const email = input.email.toLowerCase().trim();
      const existing = await db.select().from(staffUsers).where(eq(staffUsers.email, email)).limit(1);
      if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "E-posten er allerede registrert." });

      await db.insert(staffUsers).values({ email, name: input.name, role: input.role, status: "invited" });
      const token = randomToken(32);
      await db.insert(staffInvites).values({
        email, role: input.role, tokenHash: sha256Hex(token),
        createdById: ctx.staff.userId, expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      });
      await logAudit({
        actorType: "staff", actorId: ctx.staff.userId, actorLabel: ctx.staff.name,
        action: "staff.invited", targetType: "staff_user", targetId: email,
        metadata: { role: input.role }, ip: clientIp(ctx.req),
      });
      return { setupUrl: `${env.baseUrl}/admin/aktiver?token=${token}`, expiresInHours: 48 };
    }),

  updateRole: freshSessionProcedure("staff:manage")
    .input(z.object({
      userId: z.number().int(),
      role: z.enum(VALID_ROLES as [string, ...string[]]),
      confirmFreshSession: z.literal(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      if (input.userId === ctx.staff.userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Du kan ikke endre din egen rolle." });
      }
      await db.update(staffUsers).set({ role: input.role }).where(eq(staffUsers.id, input.userId));
      await revokeAllUserSessions(input.userId); // tving ny innlogging med nye privilegier
      await logAudit({
        actorType: "staff", actorId: ctx.staff.userId, actorLabel: ctx.staff.name,
        action: "staff.role_changed", targetType: "staff_user", targetId: input.userId,
        metadata: { newRole: input.role }, ip: clientIp(ctx.req),
      });
      return { ok: true };
    }),

  setStatus: freshSessionProcedure("staff:manage")
    .input(z.object({
      userId: z.number().int(),
      status: z.enum(["active", "disabled"]),
      confirmFreshSession: z.literal(true),
    }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.staff.userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Du kan ikke deaktivere deg selv." });
      }
      const db = getDb();
      await db.update(staffUsers).set({ status: input.status }).where(eq(staffUsers.id, input.userId));
      if (input.status === "disabled") await revokeAllUserSessions(input.userId);
      await logAudit({
        actorType: "staff", actorId: ctx.staff.userId, actorLabel: ctx.staff.name,
        action: `staff.${input.status === "disabled" ? "disabled" : "enabled"}`,
        targetType: "staff_user", targetId: input.userId, ip: clientIp(ctx.req),
      });
      return { ok: true };
    }),

  /** Nullstill MFA for en ansatt som har mistet autentikatoren (eier-handling, fersk sesjon). */
  resetMfa: freshSessionProcedure("staff:manage")
    .input(z.object({ userId: z.number().int(), confirmFreshSession: z.literal(true) }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.staff.userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Du kan ikke nullstille din egen MFA her." });
      }
      await getDb()
        .update(staffUsers)
        .set({ totpSecret: null, mfaEnabled: false, recoveryCodesJson: null })
        .where(eq(staffUsers.id, input.userId));
      await revokeAllUserSessions(input.userId);
      await logAudit({
        actorType: "staff", actorId: ctx.staff.userId, actorLabel: ctx.staff.name,
        action: "staff.mfa_reset", targetType: "staff_user", targetId: input.userId, ip: clientIp(ctx.req),
      });
      return { ok: true };
    }),

  myPermissions: staffProcedure.query(({ ctx }) => {
    const role = ctx.staff.role as StaffRole;
    return {
      role,
      permissions: [...(ROLE_PERMISSIONS[role] ?? [])],
    };
  }),
});
