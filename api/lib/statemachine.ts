// Kanonisk livssyklus for bestillinger — validerte overganger på serveren.
// Betalingstilstand og leverandørtilstand modelleres separat (payments,
// booking_attempts, refund_cases) og summeres til denne operative tilstanden.

import { BOOKING_ATTEMPT_STATES, REFUND_STATES } from "../../db/schema";

export const BOOKING_STATES = [
  "DRAFT",
  "QUOTE_SENT",
  "AWAITING_PAYMENT",
  "PAYMENT_AUTHORIZED",
  "BOOKING_PROCESSING",
  "AWAITING_RECONCILIATION",
  "CONFIRMED",
  "REVIEW",
  "BOOKING_FAILED",
  "CHANGE_REQUESTED",
  "CANCELLATION_REQUESTED",
  "REFUND_PENDING",
  "CANCELLED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "TRAVELLED",
  "EXPIRED",
] as const;

export type BookingState = (typeof BOOKING_STATES)[number];

/** Tillatte overganger. Nøkkel = fra-tilstand, verdi = mulige til-tilstander. */
export const TRANSITIONS: Record<BookingState, readonly BookingState[]> = {
  DRAFT: ["QUOTE_SENT", "AWAITING_PAYMENT", "CANCELLED", "EXPIRED"],
  QUOTE_SENT: ["AWAITING_PAYMENT", "CANCELLED", "BOOKING_FAILED", "EXPIRED"],
  AWAITING_PAYMENT: ["PAYMENT_AUTHORIZED", "CANCELLED", "BOOKING_FAILED", "EXPIRED"],
  PAYMENT_AUTHORIZED: ["BOOKING_PROCESSING", "BOOKING_FAILED", "CANCELLED"],
  BOOKING_PROCESSING: ["CONFIRMED", "AWAITING_RECONCILIATION", "BOOKING_FAILED", "REVIEW", "CANCELLED"],
  AWAITING_RECONCILIATION: ["CONFIRMED", "BOOKING_FAILED", "AWAITING_RECONCILIATION", "REVIEW", "CANCELLED"],
  CONFIRMED: ["CHANGE_REQUESTED", "CANCELLATION_REQUESTED", "REFUND_PENDING", "CANCELLED", "REVIEW", "TRAVELLED"],
  REVIEW: ["CONFIRMED", "CANCELLED", "REFUND_PENDING", "BOOKING_FAILED"],
  BOOKING_FAILED: ["BOOKING_PROCESSING", "CANCELLED", "REFUND_PENDING"],
  CHANGE_REQUESTED: ["CONFIRMED", "CANCELLATION_REQUESTED", "CANCELLED", "TRAVELLED"],
  CANCELLATION_REQUESTED: ["CANCELLED", "REFUND_PENDING", "CONFIRMED"],
  REFUND_PENDING: ["PARTIALLY_REFUNDED", "REFUNDED", "CANCELLED", "CONFIRMED"],
  CANCELLED: ["REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED"],
  PARTIALLY_REFUNDED: ["REFUNDED", "REFUND_PENDING", "TRAVELLED", "CANCELLATION_REQUESTED", "CHANGE_REQUESTED", "CANCELLED"],
  REFUNDED: [],
  TRAVELLED: ["REFUND_PENDING"],
  EXPIRED: [],
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
  "REVIEW",
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
  REVIEW: "Til manuell gjennomgang",
  BOOKING_FAILED: "Booking feilet",
  CHANGE_REQUESTED: "Endring forespurt",
  CANCELLATION_REQUESTED: "Kansellering forespurt",
  REFUND_PENDING: "Refusjon pågår",
  CANCELLED: "Kansellert",
  PARTIALLY_REFUNDED: "Delvis refundert",
  REFUNDED: "Refundert",
  TRAVELLED: "Reist",
  EXPIRED: "Utløpt",
};

// ─── Booking-forsøk (betaling ↔ leverandørordre) ───────────────────────────

export type AttemptState = (typeof BOOKING_ATTEMPT_STATES)[number];

export const ATTEMPT_TRANSITIONS: Record<AttemptState, readonly AttemptState[]> = {
  CREATED: ["PAYMENT_AUTHORIZED", "FAILED"],
  PAYMENT_AUTHORIZED: ["SUPPLIER_ORDERING", "FAILED_VOIDED", "FAILED"],
  SUPPLIER_ORDERING: ["SUPPLIER_CONFIRMED", "SUPPLIER_UNKNOWN", "FAILED_VOIDED"],
  SUPPLIER_UNKNOWN: ["SUPPLIER_CONFIRMED", "FAILED_VOIDED"],
  SUPPLIER_CONFIRMED: ["CAPTURED", "CONFIRMED"],
  CAPTURED: ["CONFIRMED"],
  CONFIRMED: [],
  FAILED_VOIDED: [],
  FAILED: [],
};

export function canAttemptTransition(from: AttemptState, to: AttemptState): boolean {
  return ATTEMPT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertAttemptTransition(from: string, to: AttemptState): asserts from is AttemptState {
  if (!canAttemptTransition(from as AttemptState, to)) {
    throw new Error(`Ugyldig overgang for booking-forsøk: ${from} → ${to}`);
  }
}

export const ATTEMPT_TERMINAL: readonly AttemptState[] = ["CONFIRMED", "FAILED_VOIDED", "FAILED"];

// ─── Refusjonssaker ────────────────────────────────────────────────────────

export type RefundState = (typeof REFUND_STATES)[number];

export const REFUND_TRANSITIONS: Record<RefundState, readonly RefundState[]> = {
  requested: ["eligibility_checked", "rejected"],
  eligibility_checked: ["supplier_requested", "amount_confirmed", "rejected"],
  supplier_requested: ["supplier_pending", "supplier_confirmed", "supplier_rejected"],
  supplier_pending: ["supplier_confirmed", "supplier_rejected"],
  supplier_confirmed: ["amount_confirmed"],
  supplier_rejected: ["rejected"],
  amount_confirmed: ["psp_refund_created"],
  psp_refund_created: ["psp_refund_pending", "psp_refund_succeeded", "psp_refund_failed"],
  psp_refund_pending: ["psp_refund_succeeded", "psp_refund_failed"],
  psp_refund_succeeded: ["customer_notified"],
  psp_refund_failed: ["psp_refund_created"],
  customer_notified: ["closed"],
  closed: [],
  rejected: [],
};

export function canRefundTransition(from: RefundState, to: RefundState): boolean {
  return REFUND_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertRefundTransition(from: string, to: RefundState): asserts from is RefundState {
  if (!canRefundTransition(from as RefundState, to)) {
    throw new Error(`Ugyldig overgang for refusjonssak: ${from} → ${to}`);
  }
}

export const REFUND_TERMINAL: readonly RefundState[] = ["closed", "rejected"];

export const REFUND_STATE_LABELS: Record<RefundState, string> = {
  requested: "Forespurt",
  eligibility_checked: "Vilkår sjekket",
  supplier_requested: "Sendt til leverandør",
  supplier_pending: "Venter på leverandør",
  supplier_confirmed: "Bekreftet av leverandør",
  supplier_rejected: "Avvist av leverandør",
  amount_confirmed: "Beløp bekreftet",
  psp_refund_created: "Refusjon opprettet hos betalingsleverandør",
  psp_refund_pending: "Refusjon under behandling",
  psp_refund_succeeded: "Refusjon utbetalt",
  psp_refund_failed: "Refusjon feilet",
  customer_notified: "Kunde varslet",
  closed: "Avsluttet",
  rejected: "Avvist",
};
