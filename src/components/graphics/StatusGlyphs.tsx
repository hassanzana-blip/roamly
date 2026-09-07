import type { GlyphProps } from "./Glyph";
import { HsStatusBooked, HsStatusCancelled, HsStatusChanged, HsStatusPending, HsStatusRefund, HsStatusTicketed } from "./pack";

/** Booking states from the official pack. */
export type StatusKind = "booked" | "ticket" | "processing" | "change" | "cancelled" | "refund";

const STATUS = {
  booked: HsStatusBooked,
  ticket: HsStatusTicketed,
  processing: HsStatusPending,
  change: HsStatusChanged,
  cancelled: HsStatusCancelled,
  refund: HsStatusRefund,
} as const;

export function StatusGlyph({ kind, ...p }: GlyphProps & { kind: StatusKind }) {
  const S = STATUS[kind];
  return <S {...p} />;
}
