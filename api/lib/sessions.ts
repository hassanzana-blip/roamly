import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { staffSessions, staffUsers } from "../../db/schema";
import { randomToken, sha256Hex } from "./tokens";

// Absolutt levetid 12t + idle-grense 2t for admin (kortere enn kunde-soner).
const ABSOLUTE_MS = 12 * 60 * 60_000;
const IDLE_MS = 2 * 60 * 60_000;

export const STAFF_COOKIE = "roamly_staff";

export type StaffIdentity = {
  userId: number;
  email: string;
  name: string;
  role: string;
  status: string;
  mfaEnabled: boolean;
  avatarUrl: string | null;
  sessionId: number;
  sessionCreatedAt: Date;
  mfaVerified: boolean;
};

function cookieAttributes(maxAgeSec: number): string {
  const parts = [
    `${STAFF_COOKIE}=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAgeSec}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function setSessionCookie(resHeaders: Headers, token: string): void {
  resHeaders.append(
    "Set-Cookie",
    cookieAttributes(Math.floor(ABSOLUTE_MS / 1000)).replace(`${STAFF_COOKIE}=`, `${STAFF_COOKIE}=${token}`),
  );
}

export function clearSessionCookie(resHeaders: Headers): void {
  resHeaders.append(
    "Set-Cookie",
    cookieAttributes(0).replace(`${STAFF_COOKIE}=`, `${STAFF_COOKIE}=`),
  );
}

export function readSessionToken(req: Request): string | null {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === STAFF_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** Opprett sesjon. mfaVerified=false frem til TOTP er bekreftet. */
export async function createSession(
  userId: number,
  req: Request,
  mfaVerified: boolean,
): Promise<string> {
  const token = randomToken(32);
  await getDb().insert(staffSessions).values({
    tokenHash: sha256Hex(token),
    userId,
    mfaVerified,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent")?.slice(0, 255) ?? null,
    expiresAt: new Date(Date.now() + ABSOLUTE_MS),
  });
  return token;
}

/** Roter sesjonstoken (ved innlogging og privilegieendring). */
export async function rotateSession(sessionId: number, resHeaders: Headers): Promise<void> {
  const token = randomToken(32);
  await getDb()
    .update(staffSessions)
    .set({ tokenHash: sha256Hex(token), createdAt: new Date(), expiresAt: new Date(Date.now() + ABSOLUTE_MS) })
    .where(eq(staffSessions.id, sessionId));
  setSessionCookie(resHeaders, token);
}

/** Løs opp sesjon fra cookie — returnerer null ved utløpt/idle/tilbakekalt. */
export async function resolveSession(req: Request): Promise<StaffIdentity | null> {
  const token = readSessionToken(req);
  if (!token) return null;
  const db = getDb();
  const rows = await db
    .select({ session: staffSessions, user: staffUsers })
    .from(staffSessions)
    .innerJoin(staffUsers, eq(staffUsers.id, staffSessions.userId))
    .where(
      and(
        eq(staffSessions.tokenHash, sha256Hex(token)),
        isNull(staffSessions.revokedAt),
        gt(staffSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  // Idle-grense
  if (Date.now() - row.session.lastSeenAt.getTime() > IDLE_MS) return null;
  if (row.user.status !== "active") return null;

  // Forny lastSeen (best effort, ikke i kritisk sti)
  db.update(staffSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(staffSessions.id, row.session.id))
    .catch(() => {});

  return {
    userId: row.user.id,
    email: row.user.email,
    name: row.user.name,
    role: row.user.role,
    status: row.user.status,
    mfaEnabled: row.user.mfaEnabled,
    avatarUrl: row.user.avatarUrl,
    sessionId: row.session.id,
    sessionCreatedAt: row.session.createdAt,
    mfaVerified: row.session.mfaVerified,
  };
}

export async function markMfaVerified(sessionId: number): Promise<void> {
  await getDb()
    .update(staffSessions)
    .set({ mfaVerified: true })
    .where(eq(staffSessions.id, sessionId));
}

export async function revokeSession(sessionId: number): Promise<void> {
  await getDb()
    .update(staffSessions)
    .set({ revokedAt: new Date() })
    .where(eq(staffSessions.id, sessionId));
}

export async function revokeAllUserSessions(userId: number): Promise<void> {
  await getDb()
    .update(staffSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(staffSessions.userId, userId), isNull(staffSessions.revokedAt)));
}

/** Re-autentisering: sesjonen må være fersk (< 15 min) for kritiske handlinger. */
export function sessionIsFresh(identity: StaffIdentity): boolean {
  return Date.now() - identity.sessionCreatedAt.getTime() < 15 * 60_000;
}
