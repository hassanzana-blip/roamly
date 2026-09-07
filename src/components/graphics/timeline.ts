export type TimelineState = { done: number; current: number; terminal?: "cancelled" | "refunded" | "failed" | "changed" };

/** Map the order state to timeline progress. `departed` = last slice arrived. */
export function timelineFor(state: string, departed = false): TimelineState {
  switch (state) {
    case "AWAITING_PAYMENT":
    case "QUOTE_SENT":
    case "DRAFT":
      return { done: 1, current: 1 };
    case "PAYMENT_AUTHORIZED":
    case "BOOKING_PROCESSING":
    case "AWAITING_RECONCILIATION":
    case "REVIEW":
      return { done: 2, current: 2 };
    case "CONFIRMED":
      return departed ? { done: 5, current: 5 } : { done: 3, current: 3 };
    case "TRAVELLED":
      return { done: 5, current: 5 };
    case "CHANGE_REQUESTED":
      return { done: 3, current: 3, terminal: "changed" };
    case "BOOKING_FAILED":
    case "EXPIRED":
      return { done: 1, current: 1, terminal: "failed" };
    case "CANCELLATION_REQUESTED":
    case "CANCELLED":
      return { done: 3, current: 3, terminal: "cancelled" };
    case "REFUND_PENDING":
    case "PARTIALLY_REFUNDED":
    case "REFUNDED":
      return { done: 3, current: 3, terminal: "refunded" };
    default:
      return { done: 1, current: 1 };
  }
}
