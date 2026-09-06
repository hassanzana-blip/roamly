import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ── Formatters ─────────────────────────────────────────────────────────── */

export function formatMoney(amount: string | number | null | undefined, currency = "NOK"): string {
  const n = typeof amount === "string" ? Number(amount) : (amount ?? 0);
  if (!Number.isFinite(n)) return "–";
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "–";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "–";
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "–";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "–";
  return new Intl.DateTimeFormat("nb-NO", { day: "2-digit", month: "short", year: "numeric" }).format(d);
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
  BOOKING_FAILED: "Booking feilet",
  CHANGE_REQUESTED: "Endring forespurt",
  CANCELLATION_REQUESTED: "Kansellering forespurt",
  REFUND_PENDING: "Refusjon pågår",
  CANCELLED: "Kansellert",
  PARTIALLY_REFUNDED: "Delvis refundert",
  REFUNDED: "Refundert",
};

/** Speiler TRANSITIONS i api/lib/statemachine.ts (kun personal-styrbare måltilstander). */
export const STAFF_TRANSITION_TARGETS: Record<string, string[]> = {
  DRAFT: ["CANCELLED"],
  QUOTE_SENT: ["CANCELLED"],
  AWAITING_PAYMENT: ["CANCELLED"],
  PAYMENT_AUTHORIZED: ["CANCELLED"],
  BOOKING_PROCESSING: ["CONFIRMED"],
  AWAITING_RECONCILIATION: ["CONFIRMED"],
  CONFIRMED: ["CHANGE_REQUESTED", "CANCELLATION_REQUESTED", "REFUND_PENDING", "CANCELLED"],
  BOOKING_FAILED: ["CANCELLED", "REFUND_PENDING"],
  CHANGE_REQUESTED: ["CONFIRMED", "CANCELLATION_REQUESTED"],
  CANCELLATION_REQUESTED: ["CANCELLED", "REFUND_PENDING", "CONFIRMED"],
  REFUND_PENDING: ["CANCELLED"],
  CANCELLED: ["REFUND_PENDING"],
  PARTIALLY_REFUNDED: ["REFUND_PENDING"],
  REFUNDED: [],
};

export type PillTone = "neutral" | "info" | "success" | "warning" | "danger";

const STATE_TONES: Record<string, PillTone> = {
  DRAFT: "neutral",
  QUOTE_SENT: "info",
  AWAITING_PAYMENT: "warning",
  PAYMENT_AUTHORIZED: "info",
  BOOKING_PROCESSING: "info",
  AWAITING_RECONCILIATION: "warning",
  CONFIRMED: "success",
  BOOKING_FAILED: "danger",
  CHANGE_REQUESTED: "warning",
  CANCELLATION_REQUESTED: "warning",
  REFUND_PENDING: "warning",
  CANCELLED: "neutral",
  PARTIALLY_REFUNDED: "info",
  REFUNDED: "neutral",
};

const TONE_CLASSES: Record<PillTone, string> = {
  neutral: "bg-night/5 text-night/70",
  info: "bg-primary/10 text-primary",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-rose-100 text-rose-700",
};

export function Pill({ tone = "neutral", children, className }: { tone?: PillTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function BookingStatePill({ state }: { state: string }) {
  return <Pill tone={STATE_TONES[state] ?? "neutral"}>{BOOKING_STATE_LABELS[state] ?? state}</Pill>;
}

/* ── Layout pieces ──────────────────────────────────────────────────────── */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-night sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-white p-5 shadow-sm", className)}>{children}</div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white/60 px-6 py-12 text-center">
      <p className="font-semibold text-night">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-8 text-center">
      <p className="font-semibold text-rose-700">Noe gikk galt</p>
      <p className="mt-1 text-sm text-rose-600/80">{message ?? "Kunne ikke laste data. Prøv å laste siden på nytt."}</p>
    </div>
  );
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-label="Laster">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-night/5" />
      ))}
    </div>
  );
}
