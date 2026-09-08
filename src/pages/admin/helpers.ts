/* Ikke-komponent-hjelpere for admin (formatering, etiketter, klasser, feil). */

/* ── Formatters (admin er alltid nb-NO) ─────────────────────────────────── */

export function formatMoney(amount: string | number | null | undefined, currency = "NOK"): string {
  const n = typeof amount === "string" ? Number(amount) : (amount ?? 0);
  if (!Number.isFinite(n)) return "–";
  try {
    return new Intl.NumberFormat("nb-NO", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

/** Beløp i minste enhet (øre/cent) → formatert. */
export function formatMinor(minor: number | string | null | undefined, currency = "NOK"): string {
  if (minor == null || minor === "") return "–";
  const n = Number(minor);
  if (!Number.isFinite(n)) return "–";
  return formatMoney(n / 100, currency);
}

/** Desimalstreng («123.45») → minste enhet (12345). Returnerer null ved ugyldig. */
export function parseMinor(value: string): number | null {
  const v = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  return Math.round(Number(v) * 100);
}

export function minorToDecimal(minor: number | null | undefined): string {
  if (minor == null) return "";
  return (minor / 100).toFixed(2);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "–";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "–";
  return new Intl.DateTimeFormat("nb-NO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "–";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "–";
  return new Intl.DateTimeFormat("nb-NO", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

/* ── Feilhåndtering (error.data?.appCode) ───────────────────────────────── */

export type TrpcErrorLike = { message: string; data?: { appCode?: string; code?: string; reason?: string } | null } | null | undefined;

const APP_CODE_MESSAGES: Record<string, string> = {
  FORBIDDEN: "Du har ikke tilgang til dette.",
  UNAUTHORIZED: "Sesjonen er utløpt. Logg inn på nytt.",
  NOT_FOUND: "Fant ikke det du lette etter.",
  RATE_LIMITED: "For mange forespørsler. Vent litt og prøv igjen.",
  CONFLICT: "Handlingen kolliderer med en annen endring. Last siden på nytt.",
  REFUND_EXCEEDS_CAPTURED: "Beløpet overstiger det som er fanget på betalingen.",
  REFUND_INVALID_STATE: "Refusjonssaken kan ikke behandles i nåværende tilstand.",
  NOT_REFUNDABLE: "Billetten kan ikke refunderes.",
  INTERNAL: "Noe gikk galt hos oss. Prøv igjen.",
};

/** Menneskelig feilmelding: serverens melding først, ellers per appCode. */
export function errorMessage(err: TrpcErrorLike, fallback = "Noe gikk galt."): string {
  if (!err) return fallback;
  const code = err.data?.appCode;
  if (err.message && !/^(INTERNAL_SERVER_ERROR|Unexpected)/.test(err.message)) return err.message;
  return (code && APP_CODE_MESSAGES[code]) ?? fallback;
}

/** Krever fersk innlogging (freshSessionProcedure / markQuotePaid). */
export function isReauthError(err: TrpcErrorLike): boolean {
  if (!err) return false;
  if (err.data?.reason === "reauth_required") return true;
  return err.data?.code === "FORBIDDEN" && /nylig innlogging/i.test(err.message ?? "");
}

/* ── Booking state labels (speiler api/lib/statemachine.ts) ─────────────── */

export const BOOKING_STATE_LABELS: Record<string, string> = {
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

/** Speiler TRANSITIONS i api/lib/statemachine.ts, begrenset til det bookingTransition tillater. */
export const STAFF_TRANSITION_TARGETS: Record<string, string[]> = {
  DRAFT: ["CANCELLED"],
  QUOTE_SENT: ["CANCELLED"],
  AWAITING_PAYMENT: ["CANCELLED"],
  PAYMENT_AUTHORIZED: ["CANCELLED"],
  BOOKING_PROCESSING: ["CONFIRMED", "REVIEW", "CANCELLED"],
  AWAITING_RECONCILIATION: ["CONFIRMED", "REVIEW", "CANCELLED"],
  CONFIRMED: ["CHANGE_REQUESTED", "CANCELLATION_REQUESTED", "REFUND_PENDING", "CANCELLED", "REVIEW", "TRAVELLED"],
  REVIEW: ["CONFIRMED", "CANCELLED", "REFUND_PENDING"],
  BOOKING_FAILED: ["CANCELLED", "REFUND_PENDING"],
  CHANGE_REQUESTED: ["CONFIRMED", "CANCELLATION_REQUESTED", "CANCELLED", "TRAVELLED"],
  CANCELLATION_REQUESTED: ["CANCELLED", "REFUND_PENDING", "CONFIRMED"],
  REFUND_PENDING: ["CANCELLED", "CONFIRMED"],
  CANCELLED: ["REFUND_PENDING"],
  PARTIALLY_REFUNDED: ["REFUND_PENDING", "TRAVELLED", "CANCELLATION_REQUESTED", "CHANGE_REQUESTED", "CANCELLED"],
  REFUNDED: [],
  TRAVELLED: ["REFUND_PENDING"],
  EXPIRED: [],
};

export const REFUND_STATE_LABELS: Record<string, string> = {
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

export const ATTEMPT_STATE_LABELS: Record<string, string> = {
  CREATED: "Opprettet",
  PAYMENT_AUTHORIZED: "Betaling autorisert",
  SUPPLIER_ORDERING: "Bestiller hos leverandør",
  SUPPLIER_UNKNOWN: "Ukjent hos leverandør",
  SUPPLIER_CONFIRMED: "Bekreftet av leverandør",
  CAPTURED: "Betaling fanget",
  CONFIRMED: "Fullført",
  FAILED_VOIDED: "Feilet (reservasjon frigitt)",
  FAILED: "Feilet",
};

export type PillTone = "neutral" | "info" | "success" | "warning" | "danger";

export const STATE_TONES: Record<string, PillTone> = {
  DRAFT: "neutral",
  QUOTE_SENT: "info",
  AWAITING_PAYMENT: "warning",
  PAYMENT_AUTHORIZED: "info",
  BOOKING_PROCESSING: "info",
  AWAITING_RECONCILIATION: "warning",
  CONFIRMED: "success",
  REVIEW: "warning",
  BOOKING_FAILED: "danger",
  CHANGE_REQUESTED: "warning",
  CANCELLATION_REQUESTED: "warning",
  REFUND_PENDING: "warning",
  CANCELLED: "neutral",
  PARTIALLY_REFUNDED: "info",
  REFUNDED: "neutral",
  TRAVELLED: "success",
  EXPIRED: "neutral",
};

export const REFUND_TONES: Record<string, PillTone> = {
  requested: "warning",
  eligibility_checked: "info",
  supplier_requested: "info",
  supplier_pending: "warning",
  supplier_confirmed: "info",
  supplier_rejected: "danger",
  amount_confirmed: "info",
  psp_refund_created: "info",
  psp_refund_pending: "warning",
  psp_refund_succeeded: "success",
  psp_refund_failed: "danger",
  customer_notified: "success",
  closed: "neutral",
  rejected: "danger",
};

export const ATTEMPT_TONES: Record<string, PillTone> = {
  CREATED: "neutral",
  PAYMENT_AUTHORIZED: "info",
  SUPPLIER_ORDERING: "info",
  SUPPLIER_UNKNOWN: "danger",
  SUPPLIER_CONFIRMED: "info",
  CAPTURED: "info",
  CONFIRMED: "success",
  FAILED_VOIDED: "neutral",
  FAILED: "danger",
};

export const TONE_CLASSES: Record<PillTone, string> = {
  neutral: "bg-muted text-foreground/80",
  info: "bg-primary-soft text-accent-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
};

/* ── Tabell ─────────────────────────────────────────────────────────────── */

/**
 * Radhøyden følger tetthetsvalget.
 *
 * Den som lever i listene vil ha flest mulig rader på skjermen; den som er
 * innom av og til har mer nytte av luft. Verdiene kommer fra `--admin-row-y`,
 * som settes på <html> ut fra valget – da slipper hver eneste tabell å vite om
 * innstillingen.
 */
export const thCls = "px-4 py-[var(--admin-row-y)] text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:px-5";
export const tdCls = "px-4 py-[var(--admin-row-y)] align-middle sm:px-5";

/* ── Knapper og felter ──────────────────────────────────────────────────── */

export type BtnTone = "primary" | "night" | "ghost" | "danger" | "success";

export const BTN_CLASSES: Record<BtnTone, string> = {
  primary: "bg-primary text-primary-foreground shadow-xs hover:bg-[hsl(var(--primary)/0.9)]",
  night: "bg-night text-white shadow-xs hover:bg-night/90",
  ghost: "border border-input bg-card text-foreground hover:border-foreground/40 hover:bg-muted/60",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  success: "bg-success text-success-foreground hover:bg-success/90",
};

export const inputCls =
  "w-full min-h-11 rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 hover:border-foreground/40 focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:opacity-60";

export const selectCls =
  "min-h-11 rounded-lg border border-input bg-card px-3 py-2.5 text-sm font-medium text-foreground outline-none hover:border-foreground/40 focus:border-primary focus:ring-2 focus:ring-primary/25";

export const labelCls = "mb-1.5 block text-sm font-medium text-foreground";


/* ── Kundeservice ───────────────────────────────────────────────────────── */

export const CASE_STATUS: Record<string, string> = {
  open: "Åpen",
  pending_customer: "Venter på kunde",
  resolved: "Løst",
  closed: "Lukket",
};
export const CASE_PRIORITY: Record<string, string> = {
  low: "Lav",
  normal: "Normal",
  high: "Høy",
  urgent: "Haster",
};
