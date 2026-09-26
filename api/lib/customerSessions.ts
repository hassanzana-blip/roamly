import { and, desc, eq, gt, isNull, lt, ne, or } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { customerAccounts, customerSessions } from "../../db/schema";
import { randomToken, sha256Hex } from "./tokens";
import { clientIp } from "./ratelimit";
import { env } from "./env";
import { AppError } from "./errors";
import { isStaffEmail } from "./staffBoundary";

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

/**
 * Appens sesjon: samme opake token som i cookien, sendt som
 * `Authorization: Bearer <token>`. Nettleseren sender aldri denne headeren av
 * seg selv, så den åpner ingen CSRF-vei. Formen er randomToken(32) (base64url).
 */
const BEARER_RE = /^Bearer[ ]+([A-Za-z0-9_-]{20,128})$/i;

export function readBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  return BEARER_RE.exec(header.trim())?.[1] ?? null;
}

/**
 * Kundesesjonens token: Bearer (app) når Authorization-headeren bruker
 * Bearer-skjemaet, ellers cookien (nett). Et Bearer-token med feil form gir
 * ingen sesjon – det faller ikke stille tilbake til cookien. Andre skjemaer
 * (f.eks. Basic foran et passordbeskyttet testmiljø) rører ikke cookie-veien.
 */
export function readCustomerToken(req: Request): string | null {
  if (/^\s*bearer\b/i.test(req.headers.get("authorization") ?? "")) return readBearerToken(req);
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === CUSTOMER_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/**
 * Opprett en kundesesjon og gi tilbake råtokenet (kun hashen lagres) og
 * utløpstidspunktet. Siste vern for skillet mellom ansatte og kunder: en konto
 * med en ansatts e-post får aldri en sesjon, uansett hvilken vei den kom inn.
 */
export async function issueCustomerSession(customerId: number, req: Request): Promise<{ token: string; expiresAt: Date }> {
  const db = getDb();
  const [account] = await db.select({ email: customerAccounts.email }).from(customerAccounts).where(eq(customerAccounts.id, customerId)).limit(1);
  if (await isStaffEmail(account?.email)) {
    throw new AppError("FORBIDDEN", { message: "Denne kontoen kan ikke brukes til kundeinnlogging." });
  }
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + ABSOLUTE_MS);
  await db.insert(customerSessions).values({
    tokenHash: sha256Hex(token),
    customerId,
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent")?.slice(0, 255) ?? null,
    expiresAt,
  });
  return { token, expiresAt };
}

export async function createCustomerSession(customerId: number, req: Request): Promise<string> {
  return (await issueCustomerSession(customerId, req)).token;
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
  // En ansatts e-post bærer aldri en kundesesjon – heller ikke en som ble
  // opprettet før adressen ble lagt inn som ansatt.
  if (await isStaffEmail(row.account.email)) return null;

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

/** Tilbakekall alle andre sesjoner (nett og app) enn den som gjør endringen. */
export async function revokeOtherCustomerSessions(customerId: number, keepSessionId: number): Promise<void> {
  await getDb()
    .update(customerSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(customerSessions.customerId, customerId), isNull(customerSessions.revokedAt), ne(customerSessions.id, keepSessionId)));
}

/**
 * Hvor lenge en innlogging regnes som fersk. Brukes der en konto uten passord
 * (Apple/Google) må bevise at det er eieren – ikke bare noen med et gammelt
 * token – før et uopprettelig valg: kunden logger inn på nytt rett før.
 */
export const RECENT_AUTH_MS = 10 * 60_000;

export function sessionIsFresh(sessionCreatedAt: Date, now = Date.now()): boolean {
  return now - sessionCreatedAt.getTime() <= RECENT_AUTH_MS;
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
