import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { customerNotifications, customerTravelProfiles } from "../../db/schema";
import { isDuplicateKeyError } from "./jobs";
import type { DbOrTx } from "./ledger";

/**
 * Varslingsinnboks for kunder.
 *
 * Alt som havner her er en faktisk hendelse på kontoen (et pristreff, en
 * bestilling som ble utstedt, en henvisning som ga bonus). Ingen «velkommen»-
 * støy, ingen fabrikkert aktivitet. Én rad per hendelse via dedupeKey.
 */

export type NotificationType =
  | "price_watch"
  | "flight_update"
  | "booking"
  | "payment"
  | "reminder"
  | "deal"
  | "match"
  | "referral"
  | "rewards"
  | "system";

export type NotificationPrefs = {
  /** E-post per varslingstype. Transaksjonelle typer kan ikke slås av her (de styres av bestillingen). */
  email: Partial<Record<NotificationType, boolean>>;
  /** Innboks i appen per type. */
  inApp: Partial<Record<NotificationType, boolean>>;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  email: { price_watch: true, flight_update: true, booking: true, payment: true, reminder: true, deal: false, match: true, referral: true, rewards: true, system: true },
  inApp: { price_watch: true, flight_update: true, booking: true, payment: true, reminder: true, deal: true, match: true, referral: true, rewards: true, system: true },
};

const TYPES: NotificationType[] = ["price_watch", "flight_update", "booking", "payment", "reminder", "deal", "match", "referral", "rewards", "system"];

export function cleanNotificationPrefs(raw: unknown): NotificationPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<NotificationPrefs>;
  const pick = (src: unknown, defaults: Partial<Record<NotificationType, boolean>>) => {
    const out: Partial<Record<NotificationType, boolean>> = { ...defaults };
    if (src && typeof src === "object") {
      for (const t of TYPES) {
        const v = (src as Record<string, unknown>)[t];
        if (typeof v === "boolean") out[t] = v;
      }
    }
    return out;
  };
  return { email: pick(r.email, DEFAULT_NOTIFICATION_PREFS.email), inApp: pick(r.inApp, DEFAULT_NOTIFICATION_PREFS.inApp) };
}

export async function notificationPrefsFor(customerId: number, tx?: DbOrTx): Promise<NotificationPrefs> {
  const [row] = await (tx ?? getDb())
    .select({ json: customerTravelProfiles.notificationPrefsJson })
    .from(customerTravelProfiles)
    .where(eq(customerTravelProfiles.customerId, customerId))
    .limit(1);
  if (!row?.json) return DEFAULT_NOTIFICATION_PREFS;
  try {
    return cleanNotificationPrefs(JSON.parse(row.json));
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

export type NotifyInput = {
  customerId: number;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
  /** Samme nøkkel to ganger = ett varsel. */
  dedupeKey?: string;
};

/**
 * Legg et varsel i innboksen. Respekterer kundens innboks-valg; returnerer
 * false om det ble hoppet over.
 *
 * `tx` er ikke valgfritt av bekvemmelighet. Kalles dette uten transaksjonen
 * mens kalleren står midt i en, går innsettingen på en annen tilkobling og
 * venter på låser den åpne transaksjonen holder – som ikke kan commite før
 * innsettingen er ferdig. Da står bestillingen i femti sekunder til
 * `innodb_lock_wait_timeout` løser det opp. Varselet hører til den samme
 * hendelsen; det skal skrives i den samme transaksjonen.
 */
export async function notify(input: NotifyInput, tx?: DbOrTx): Promise<boolean> {
  const db = tx ?? getDb();
  const prefs = await notificationPrefsFor(input.customerId, tx);
  if (prefs.inApp[input.type] === false) return false;
  try {
    await db.insert(customerNotifications).values({
      customerId: input.customerId,
      type: input.type,
      title: input.title.slice(0, 160),
      body: input.body?.slice(0, 2000) ?? null,
      href: input.href?.slice(0, 255) ?? null,
      dedupeKey: input.dedupeKey?.slice(0, 120) ?? null,
    });
    return true;
  } catch (err) {
    if (isDuplicateKeyError(err)) return false;
    throw err;
  }
}

export async function unreadCount(customerId: number): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)` })
    .from(customerNotifications)
    .where(and(eq(customerNotifications.customerId, customerId), isNull(customerNotifications.readAt)));
  return Number(row?.n ?? 0);
}

export async function listNotifications(customerId: number, limit = 50) {
  const rows = await getDb()
    .select()
    .from(customerNotifications)
    .where(eq(customerNotifications.customerId, customerId))
    .orderBy(desc(customerNotifications.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    type: r.type as NotificationType,
    title: r.title,
    body: r.body,
    href: r.href,
    readAt: r.readAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}
