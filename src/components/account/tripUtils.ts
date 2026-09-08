import type { RouterOutputs } from "@/providers/trpc";

/** Reiser gruppert som kunden tenker på dem: kommende, tidligere, kansellerte. */
export type TripSummary = RouterOutputs["customerAuth"]["myTrips"][number];
export type TripBucket = "upcoming" | "past" | "cancelled";

/** En reise regnes som «tidligere» seks timer etter avgang – da er man framme. */
const DEPARTED_GRACE_MS = 6 * 3_600_000;

/** Tilstander der reisen ikke blir noe av – hører hjemme under «Kansellerte». */
const NOT_TRAVELLING = new Set(["CANCELLED", "CANCELLATION_REQUESTED", "REFUND_PENDING", "REFUNDED", "BOOKING_FAILED", "EXPIRED"]);

export function bucketOf(trip: TripSummary, now: number): TripBucket {
  if (trip.cancelledAt || NOT_TRAVELLING.has(trip.state)) return "cancelled";
  return trip.departingAt && Date.parse(trip.departingAt) >= now - DEPARTED_GRACE_MS ? "upcoming" : "past";
}

/** Kommende først (nærmeste øverst), tidligere og kansellerte nyeste øverst. */
export function groupTrips(trips: TripSummary[], now: number): Record<TripBucket, TripSummary[]> {
  const out: Record<TripBucket, TripSummary[]> = { upcoming: [], past: [], cancelled: [] };
  for (const trip of trips) out[bucketOf(trip, now)].push(trip);
  out.upcoming.sort((a, b) => (a.departingAt ?? "").localeCompare(b.departingAt ?? ""));
  out.past.sort((a, b) => (b.departingAt ?? "").localeCompare(a.departingAt ?? ""));
  out.cancelled.sort((a, b) => (b.departingAt ?? "").localeCompare(a.departingAt ?? ""));
  return out;
}

export const confirmationHref = (orderId: string) => `/bekreftelse/${encodeURIComponent(orderId)}`;
export const receiptHref = (orderId: string) => `/kvittering/${encodeURIComponent(orderId)}`;
