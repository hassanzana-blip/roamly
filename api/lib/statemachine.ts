// Kanonisk livssyklus for bestillinger — validerte overganger på serveren.
// Betalingstilstand og leverandørtilstand modelleres separat (payments-tabellen)
// og summeres til denne operative tilstanden.

export const BOOKING_STATES = [
  "DRAFT",
  "QUOTE_SENT",
  "AWAITING_PAYMENT",
  "PAYMENT_AUTHORIZED",
  "BOOKING_PROCESSING",
  "AWAITING_RECONCILIATION",
  "CONFIRMED",
  "BOOKING_FAILED",
  "CHANGE_REQUESTED",
  "CANCELLATION_REQUESTED",
  "REFUND_PENDING",
  "CANCELLED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const;

export type BookingState = (typeof BOOKING_STATES)[number];

/** Tillatte overganger. Nøkkel = fra-tilstand, verdi = mulige til-tilstander. */
export const TRANSITIONS: Record<BookingState, readonly BookingState[]> = {
  DRAFT: ["QUOTE_SENT", "AWAITING_PAYMENT", "CANCELLED"],
  QUOTE_SENT: ["AWAITING_PAYMENT", "CANCELLED", "BOOKING_FAILED"],
  AWAITING_PAYMENT: ["PAYMENT_AUTHORIZED", "CANCELLED", "BOOKING_FAILED"],
  PAYMENT_AUTHORIZED: ["BOOKING_PROCESSING", "BOOKING_FAILED", "CANCELLED"],
  BOOKING_PROCESSING: ["CONFIRMED", "AWAITING_RECONCILIATION", "BOOKING_FAILED"],
  AWAITING_RECONCILIATION: ["CONFIRMED", "BOOKING_FAILED", "AWAITING_RECONCILIATION"],
  CONFIRMED: ["CHANGE_REQUESTED", "CANCELLATION_REQUESTED", "REFUND_PENDING", "CANCELLED"],
  BOOKING_FAILED: ["BOOKING_PROCESSING", "CANCELLED", "REFUND_PENDING"],
  CHANGE_REQUESTED: ["CONFIRMED", "CANCELLATION_REQUESTED"],
  CANCELLATION_REQUESTED: ["CANCELLED", "REFUND_PENDING", "CONFIRMED"],
  REFUND_PENDING: ["PARTIALLY_REFUNDED", "REFUNDED", "CANCELLED"],
  CANCELLED: ["REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED"],
  PARTIALLY_REFUNDED: ["REFUNDED", "REFUND_PENDING"],
  REFUNDED: [],
};

export function canTransition(from: BookingState, to: BookingState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: string, to: BookingState): asserts from is BookingState {
  if (!canTransition(from as BookingState, to)) {
    throw new Error(`Ugyldig statusovergang: ${from} → ${to}`);
  }
}

/** Tilstander der systemet fortsatt venter på ekstern bekreftelse. */
export const ACTIVE_STATES: BookingState[] = [
  "AWAITING_PAYMENT",
  "PAYMENT_AUTHORIZED",
  "BOOKING_PROCESSING",
  "AWAITING_RECONCILIATION",
  "CHANGE_REQUESTED",
  "CANCELLATION_REQUESTED",
  "REFUND_PENDING",
];

/** Norske etiketter for admin-UI. */
export const STATE_LABELS: Record<BookingState, string> = {
  DRAFT: "Utkast",
  QUOTE_SENT: "Tilbud sendt",
  AWAITING_PAYMENT: "Venter på betaling",
  PAYMENT_AUTHORIZED: "Betaling autorisert",
  BOOKING_PROCESSING: "Bookes hos leverandør",
  AWAITING_RECONCILIATION: "Avventer avstemming",
  CONFIRMED: "Bekreftet",
  BOOKING_FAILED: "Booking feilet",
  CHANGE_REQUESTED: "Endring forespurt",
  CANCELLATION_REQUESTED: "Kansellering forespurt",
  REFUND_PENDING: "Refusjon pågår",
  CANCELLED: "Kansellert",
  PARTIALLY_REFUNDED: "Delvis refundert",
  REFUNDED: "Refundert",
};
