import { z } from "zod";
import { eq, isNull, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, freshSessionProcedure, permittedProcedure, publicQuery, staffProcedure } from "./middleware";
import { getDb } from "./queries/connection";
import { staffInvites, staffUsers } from "../db/schema";
import { hashPassword, passwordIssues, verifyPassword } from "./lib/passwords";
import { randomToken, sha256Hex } from "./lib/tokens";
import {
  clearSessionCookie,
  createSession,
  revokeAllUserSessions,
  revokeSession,
  sessionIsFresh,
  setSessionCookie,
} from "./lib/sessions";
import { assertRateLimit, clientIp } from "./lib/ratelimit";
import { logAudit } from "./lib/audit";
import { env } from "./lib/env";
import { AppError } from "./lib/errors";
import { ROLE_PERMISSIONS, VALID_ROLES, type StaffRole } from "./lib/rbac";

const INVITE_TTL_MS = 48 * 60 * 60_000;

export const staffAuthRouter = createRouter({
  /** Innlogging: e-post + passord → ferdig sesjon. */
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

      const token = await createSession(user.id, ctx.req, true);
      setSessionCookie(ctx.resHeaders, token);
      await db.update(staffUsers).set({ lastLoginAt: new Date() }).where(eq(staffUsers.id, user.id));
      await logAudit({
        actorType: "staff", actorId: user.id, actorLabel: user.name, action: "auth.login",
        targetType: "staff_user", targetId: user.id, ip,
      });
      return { ok: true as const, name: user.name, role: user.role };
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
      sessionFresh: sessionIsFresh(ctx.staff),
      environment: env.APP_ENV,
    };
  }),

  /** Aktivering: valider invitasjonen og sett passord — så er kontoen aktiv. */
  activateAccount: publicQuery
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

      await db
        .update(staffUsers)
        .set({ passwordHash: await hashPassword(input.password), status: "active" })
        .where(eq(staffUsers.id, user.id));
      await db.update(staffInvites).set({ usedAt: new Date() }).where(eq(staffInvites.id, invite.id));
      await logAudit({
        actorType: "staff", actorId: user.id, actorLabel: user.name,
        action: "auth.account_activated", targetType: "staff_user", targetId: user.id,
        metadata: { role: user.role }, ip: clientIp(ctx.req),
      });
      return { ok: true as const, email: user.email };
    }),

  // ─── Førstegangsoppsett (kun utenfor produksjon) ─────────────────────────
  // Selvdeaktiverende: så snart én konto er aktivert svares needsSetup=false.
  // I produksjon (APP_ENV=production) er flyten helt avslått — bruk
  // `npm run bootstrap:admins` med BOOTSTRAP_*-variabler (OTA-080).

  setupStatus: publicQuery.query(async () => {
    if (env.isProdEnv || env.STAFF_BOOTSTRAP_ENABLED !== "true") return { needsSetup: false };
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
      // To låser: aldri i produksjon, og ellers kun når oppsettet er slått på
      // bevisst. Uten den andre låsen står skjemaet åpent for hvem som helst
      // hver gang det ikke finnes en aktiv ansattkonto.
      if (env.isProdEnv || env.STAFF_BOOTSTRAP_ENABLED !== "true") {
        throw new AppError("FORBIDDEN", { message: "Førstegangsoppsett via nett er avslått. Bruk bootstrap-skriptet." });
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
      avatarUrl: u.avatarUrl, lastLoginAt: u.lastLoginAt,
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

  myPermissions: staffProcedure.query(({ ctx }) => {
    const role = ctx.staff.role as StaffRole;
    return {
      role,
      permissions: [...(ROLE_PERMISSIONS[role] ?? [])],
    };
  }),
});
