import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { bookingAccessTokens, bookings } from "../../db/schema";
import { randomToken, sha256Hex } from "./tokens";
import { AppError } from "./errors";

const ACCESS_TTL_MS = 30 * 24 * 60 * 60_000;

/** Utsted et engangs-tilgangstoken til én booking (brukes i bekreftelses-/kvitteringslenker). */
export async function issueBookingAccessToken(bookingId: number): Promise<string> {
  const token = randomToken(32);
  await getDb().insert(bookingAccessTokens).values({
    bookingId,
    tokenHash: sha256Hex(token),
    expiresAt: new Date(Date.now() + ACCESS_TTL_MS),
  });
  return token;
}

export type BookingRow = typeof bookings.$inferSelect;

/**
 * Løs opp tilgang til en booking. Tillatt når:
 *  - gyldig accessToken for bookingen, eller
 *  - innlogget kunde eier bookingen (customerAccountId), eller
 *  - innlogget kunde har verifisert e-post som matcher contactEmail.
 * Kaster FORBIDDEN ellers (uten å avsløre om bookingen finnes).
 */
export async function resolveBookingAccess(input: {
  orderId?: string;
  bookingId?: number;
  accessToken?: string | null;
  customer?: { customerId: number; email: string | null; emailVerified?: boolean } | null;
}): Promise<BookingRow> {
  const db = getDb();
  const where = input.bookingId != null ? eq(bookings.id, input.bookingId) : eq(bookings.orderId, input.orderId ?? "");
  const [booking] = await db.select().from(bookings).where(where).limit(1);
  if (!booking) throw new AppError("FORBIDDEN");

  if (input.accessToken) {
    const rows = await db
      .select({ id: bookingAccessTokens.id })
      .from(bookingAccessTokens)
      .where(and(
        eq(bookingAccessTokens.tokenHash, sha256Hex(input.accessToken)),
        eq(bookingAccessTokens.bookingId, booking.id),
        gt(bookingAccessTokens.expiresAt, new Date()),
      ))
      .limit(1);
    if (rows[0]) return booking;
  }
  const c = input.customer;
  if (c) {
    if (booking.customerAccountId === c.customerId) return booking;
    if (c.emailVerified && c.email && booking.contactEmail === c.email.toLowerCase()) return booking;
  }
  throw new AppError("FORBIDDEN");
}
