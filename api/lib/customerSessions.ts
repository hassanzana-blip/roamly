import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { customerAccounts, customerSessions } from "../../db/schema";
import { randomToken, sha256Hex } from "./tokens";
import { clientIp } from "./ratelimit";
import { env } from "./env";

// Kundesesjoner er langlivede (30 dager) — dette er en kundesone, ikke admin.
const ABSOLUTE_MS = 30 * 24 * 60 * 60_000;

export const CUSTOMER_COOKIE = "hellosky_customer";

export type CustomerIdentity = {
  customerId: number;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  /** Kreves for å se reiser/saker knyttet til e-post (OTA-060). */
  emailVerified: boolean;
  locale: string;
  currency: string;
  sessionId: number;
  sessionCreatedAt: Date;
};

function cookieAttributes(maxAgeSec: number): string {
  const parts = [
    `${CUSTOMER_COOKIE}=`,
    `Path=/`,
    `HttpOnly`,
    // Lax (ikke Strict) fordi kunder lander via e-postlenker (bekreftelse,
    // kvittering) og skal være innlogget ved ankomst. Mutasjoner beskyttes i
    // tillegg av Origin-sjekken i boot.ts.
    `SameSite=Lax`,
    `Max-Age=${maxAgeSec}`,
  ];
  if (env.isProduction) parts.push("Secure");
  return parts.join("; ");
}

export function setCustomerCookie(resHeaders: Headers, token: string): void {
  resHeaders.append(
    "Set-Cookie",
    cookieAttributes(Math.floor(ABSOLUTE_MS / 1000)).replace(
      `${CUSTOMER_COOKIE}=`,
      `${CUSTOMER_COOKIE}=${token}`,
    ),
  );
}

export function clearCustomerCookie(resHeaders: Headers): void {
  resHeaders.append("Set-Cookie", cookieAttributes(0));
}

export function readCustomerToken(req: Request): string | null {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === CUSTOMER_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function createCustomerSession(customerId: number, req: Request): Promise<string> {
  const token = randomToken(32);
  await getDb().insert(customerSessions).values({
    tokenHash: sha256Hex(token),
    customerId,
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent")?.slice(0, 255) ?? null,
    expiresAt: new Date(Date.now() + ABSOLUTE_MS),
  });
  return token;
}

export async function resolveCustomerSession(req: Request): Promise<CustomerIdentity | null> {
  const token = readCustomerToken(req);
  if (!token) return null;
  const db = getDb();
  const rows = await db
    .select({ session: customerSessions, account: customerAccounts })
    .from(customerSessions)
    .innerJoin(customerAccounts, eq(customerAccounts.id, customerSessions.customerId))
    .where(
      and(
        eq(customerSessions.tokenHash, sha256Hex(token)),
        isNull(customerSessions.revokedAt),
        gt(customerSessions.expiresAt, new Date()),
        isNull(customerAccounts.deletedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  // Forny lastSeen maks én gang per minutt (best effort, ikke i kritisk sti)
  if (Date.now() - row.session.lastSeenAt.getTime() > 60_000) {
    db.update(customerSessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(customerSessions.id, row.session.id))
      .catch(() => {});
  }

  return {
    customerId: row.account.id,
    email: row.account.email,
    phone: row.account.phone,
    firstName: row.account.firstName,
    lastName: row.account.lastName,
    emailVerified: row.account.emailVerified,
    locale: row.account.locale,
    currency: row.account.currency,
    sessionId: row.session.id,
    sessionCreatedAt: row.session.createdAt,
  };
}

export async function revokeCustomerSession(sessionId: number): Promise<void> {
  await getDb()
    .update(customerSessions)
    .set({ revokedAt: new Date() })
    .where(eq(customerSessions.id, sessionId));
}

export async function revokeAllCustomerSessions(customerId: number): Promise<void> {
  await getDb()
    .update(customerSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(customerSessions.customerId, customerId), isNull(customerSessions.revokedAt)));
}

/** De siste N sesjonene (for innloggingsvarsel: bare varsle ved ny enhet/IP). */
export async function recentCustomerSessions(
  customerId: number,
  limit = 3,
): Promise<Array<{ ip: string | null; userAgent: string | null; createdAt: Date }>> {
  return getDb()
    .select({ ip: customerSessions.ip, userAgent: customerSessions.userAgent, createdAt: customerSessions.createdAt })
    .from(customerSessions)
    .where(eq(customerSessions.customerId, customerId))
    .orderBy(desc(customerSessions.id))
    .limit(limit);
}

/** Rydd bort utløpte/tilbakekalte kundesesjoner eldre enn 30 dager (worker). */
export async function cleanupExpiredSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000);
  const result = await getDb()
    .delete(customerSessions)
    .where(or(lt(customerSessions.expiresAt, cutoff), lt(customerSessions.revokedAt, cutoff)));
  return Number(result[0].affectedRows ?? 0);
}
