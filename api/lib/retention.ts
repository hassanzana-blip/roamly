import { and, eq, lt, notInArray, or, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import {
  bookingAccessTokens,
  bookingHolds,
  bookings,
  customerEmailTokens,
  customerOtpCodes,
  customerPasswordResets,
  customers,
  staffInvites,
  webhookEvents,
} from "../../db/schema";
import { log } from "./logger";
import { logAudit } from "./audit";

// ─── Dataminimering / oppbevaring (OTA-141/109) ─────────────────────────────
// Kjøres fra sweep (hvert 10. min). Alle steg er idempotente og trygge å
// kjøre ofte; hvert steg feiler isolert. Se RUNBOOK → «Retention».
//
//  • Utløpte/brukte engangstokens, OTP-koder, passordtilbakestillinger,
//    booking-holds og booking-tilgangstokens slettes etter 24 t.
//  • Staff-/kundesesjoner: eksisterende cleanupExpiredSessions (7/30 dager).
//  • webhook_events eldre enn 90 dager: payload tømmes og status = "archived"
//    (raden beholdes for dedupe på (provider, event_id) og statistikk).
//  • customers uten bestilling siste 5 år anonymiseres (e-post/navn/telefon).

const DAY = 24 * 60 * 60_000;
export const TOKEN_GRACE_MS = DAY;
export const WEBHOOK_PAYLOAD_RETENTION_MS = 90 * DAY;
export const CUSTOMER_RETENTION_MS = 5 * 365 * DAY;

export type RetentionReport = {
  emailTokens: number;
  otpCodes: number;
  passwordResets: number;
  bookingHolds: number;
  accessTokens: number;
  staffInvites: number;
  staffSessions: number;
  customerSessions: number;
  webhookEventsArchived: number;
  customersAnonymised: number;
};

function affected(res: unknown): number {
  const r = res as Array<{ affectedRows?: number }> | undefined;
  return Number(r?.[0]?.affectedRows ?? 0);
}

async function step(name: string, fn: () => Promise<number>): Promise<number> {
  try {
    return await fn();
  } catch (err) {
    log.warn({ err, step: name }, "retention: steg feilet");
    return 0;
  }
}

export async function runRetention(now = Date.now()): Promise<RetentionReport> {
  const db = getDb();
  const tokenCutoff = new Date(now - TOKEN_GRACE_MS);
  const usedCutoff = tokenCutoff;

  const report: RetentionReport = {
    emailTokens: await step("emailTokens", async () =>
      affected(await db.delete(customerEmailTokens).where(or(lt(customerEmailTokens.expiresAt, tokenCutoff), lt(customerEmailTokens.usedAt, usedCutoff)))),
    ),
    otpCodes: await step("otpCodes", async () =>
      affected(await db.delete(customerOtpCodes).where(or(lt(customerOtpCodes.expiresAt, tokenCutoff), lt(customerOtpCodes.usedAt, usedCutoff)))),
    ),
    passwordResets: await step("passwordResets", async () =>
      affected(await db.delete(customerPasswordResets).where(or(lt(customerPasswordResets.expiresAt, tokenCutoff), lt(customerPasswordResets.usedAt, usedCutoff)))),
    ),
    bookingHolds: await step("bookingHolds", async () =>
      affected(await db.delete(bookingHolds).where(or(lt(bookingHolds.expiresAt, tokenCutoff), lt(bookingHolds.usedAt, usedCutoff)))),
    ),
    accessTokens: await step("accessTokens", async () => affected(await db.delete(bookingAccessTokens).where(lt(bookingAccessTokens.expiresAt, tokenCutoff)))),
    staffInvites: await step("staffInvites", async () =>
      affected(await db.delete(staffInvites).where(or(lt(staffInvites.expiresAt, new Date(now - 30 * DAY)), lt(staffInvites.usedAt, new Date(now - 30 * DAY))))),
    ),
    staffSessions: await step("staffSessions", async () => (await import("./sessions")).cleanupExpiredSessions()),
    customerSessions: await step("customerSessions", async () => (await import("./customerSessions")).cleanupExpiredSessions()),
    webhookEventsArchived: await step("webhookEvents", async () =>
      affected(
        await db
          .update(webhookEvents)
          .set({ payload: "", status: "archived", error: null })
          .where(and(lt(webhookEvents.createdAt, new Date(now - WEBHOOK_PAYLOAD_RETENTION_MS)), notInArray(webhookEvents.status, ["archived"]))),
      ),
    ),
    customersAnonymised: await step("customers", () => anonymiseInactiveCustomers(now)),
  };

  const total = Object.values(report).reduce((s, n) => s + n, 0);
  if (total > 0) log.info(report, "retention: opprydding utført");
  return report;
}

/**
 * Anonymiser `customers` som ikke har hatt bestilling siste 5 år (og selv er
 * eldre enn 5 år). E-posten erstattes med en unik, ugyldig adresse slik at
 * unik-indeksen holder. Hopper over hvis ingen kandidater.
 */
export async function anonymiseInactiveCustomers(now = Date.now()): Promise<number> {
  const db = getDb();
  const cutoff = new Date(now - CUSTOMER_RETENTION_MS);
  const recent = db.select({ id: bookings.customerId }).from(bookings).where(and(sql`${bookings.customerId} IS NOT NULL`, sql`${bookings.createdAt} >= ${cutoff}`));
  const candidates = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(lt(customers.createdAt, cutoff), notInArray(customers.id, recent), sql`${customers.email} NOT LIKE 'anon-%@anonymised.invalid'`))
    .limit(500);
  if (candidates.length === 0) return 0;
  let n = 0;
  for (const c of candidates) {
    const res = await db
      .update(customers)
      .set({ email: `anon-${c.id}@anonymised.invalid`, name: null, phone: null })
      .where(eq(customers.id, c.id));
    n += affected(res);
  }
  await logAudit({ actorType: "worker", action: "customers.anonymised", targetType: "customers", metadata: { count: n, cutoff: cutoff.toISOString() } });
  return n;
}
