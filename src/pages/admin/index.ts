/**
 * Admin-chunk: alt under /admin eksporteres herfra slik at App.tsx kan
 * lazy-laste hele admin-treet som ÉN chunk (OTA-192).
 */
export { default as AdminLogin } from "./AdminLogin";
export { default as AdminActivate } from "./AdminActivate";
export { AdminLayout } from "./AdminLayout";
export { AdminOverview } from "./AdminOverview";
export { AdminBookings } from "./AdminBookings";
export { AdminBookingDetail } from "./AdminBookingDetail";
export { AdminQuotes } from "./sections/Quotes";
export { AdminCustomers, AdminPayments } from "./sections/Customers";
export { AdminRefunds } from "./sections/Refunds";
export { AdminCases } from "./sections/Cases";
export { AdminReports, AdminAudit } from "./sections/Reports";
export { AdminSettings } from "./sections/Settings";
export { AdminReviewQueue, AdminScheduleChanges, AdminFraudFlags, AdminCheckoutSessions, AdminCommunity } from "./sections/Ops";
export { AdminMessages, AdminNotes, AdminProblems } from "./AdminTeam";
export { AdminPayroll } from "./AdminPayroll";
export { AdminPartners } from "./AdminPartners";
export { AdminManualBooking } from "./AdminManualBooking";
export { AdminReceipt } from "./AdminReceipt";
