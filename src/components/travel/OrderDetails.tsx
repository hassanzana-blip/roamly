import { useEffect, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, CalendarPlus, Loader2, Mail, ReceiptText, RefreshCw, Ticket, Undo2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { SliceViz } from "@/components/offers/OfferCard";
import { sliceLabel } from "@/components/offers/offerUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { humanMessage } from "@/lib/apiError";
import { bookingStateLabel, formatClock, formatDateLong, formatDateTime, formatMinor } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Order, Segment } from "@contracts/types";
import { cn } from "@/lib/utils";

import { icsDataUrl, type OrderGetResult } from "./orderUtils";

// ─── Status ─────────────────────────────────────────────────────────────────

const STATE_TONE: Record<string, string> = {
  CONFIRMED: "border-success/30 bg-success/5 text-success",
  TRAVELLED: "border-success/30 bg-success/5 text-success",
  BOOKING_PROCESSING: "border-warning/30 bg-warning/10 text-warning",
  AWAITING_RECONCILIATION: "border-warning/30 bg-warning/10 text-warning",
  PAYMENT_AUTHORIZED: "border-warning/30 bg-warning/10 text-warning",
  REVIEW: "border-warning/30 bg-warning/10 text-warning",
  BOOKING_FAILED: "border-destructive/30 bg-destructive/5 text-destructive",
  CANCELLED: "border-border bg-muted text-foreground",
  REFUNDED: "border-border bg-muted text-foreground",
  PARTIALLY_REFUNDED: "border-border bg-muted text-foreground",
  REFUND_PENDING: "border-border bg-muted text-foreground",
  CANCELLATION_REQUESTED: "border-border bg-muted text-foreground",
};

export function StateBadge({ state }: { state: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-3.5 py-1.5 text-sm font-semibold", STATE_TONE[state] ?? "border-border bg-muted text-foreground")}>
      {["BOOKING_PROCESSING", "AWAITING_RECONCILIATION", "PAYMENT_AUTHORIZED", "CANCELLATION_REQUESTED"].includes(state) && (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      )}
      {bookingStateLabel(state)}
    </span>
  );
}

// ─── Reiserute ──────────────────────────────────────────────────────────────

export function SegmentRow({ seg }: { seg: Segment }) {
  const t = useT();
  const operated = seg.operatingCarrier && seg.operatingCarrier.iata !== seg.carrier.iata ? seg.operatingCarrier.name : null;
  return (
    <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm">
      <p>
        <span className="font-semibold">
          {seg.carrier.iata} {seg.flightNumber}
        </span>{" "}
        <span className="text-muted-foreground">
          · {seg.origin.iata} {formatClock(seg.departingAt)} → {seg.destination.iata} {formatClock(seg.arrivingAt)} · {seg.aircraft}
        </span>
      </p>
      {operated && <p className="text-xs text-muted-foreground">{t("od.operatedby", { name: operated })}</p>}
    </div>
  );
}

export function Itinerary({ order }: { order: Order }) {
  return (
    <div className="space-y-6">
      {order.slices.map((s, i) => (
        <div key={s.id}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
            {sliceLabel(order.slices.length, i)} · {formatDateLong(s.departingAt)}
          </p>
          <SliceViz slice={s} />
          <div className="mt-3 space-y-1.5">
            {s.segments.map((seg) => (
              <SegmentRow key={seg.id} seg={seg} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Billetter per reisende ─────────────────────────────────────────────────

export function TicketList({ order }: { order: Order }) {
  const t = useT();
  const tickets = order.tickets ?? [];
  return (
    <ul className="space-y-2">
      {order.passengers.map((p) => {
        const mine = tickets.filter((t) => t.passengerId === p.id || (!t.passengerId && t.passengerName === `${p.givenName} ${p.familyName}`));
        return (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-4 py-3 text-sm">
            <span className="font-semibold">
              {p.givenName} {p.familyName}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
              <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
              {mine.length ? mine.map((tk) => tk.uniqueIdentifier).join(", ") : t("od.eticketpending")}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Ruteendringer ──────────────────────────────────────────────────────────

type SegLike = { carrier?: { iata?: string }; flightNumber?: string; origin?: { iata?: string }; destination?: { iata?: string }; departingAt?: string; arrivingAt?: string };

function segLine(s: SegLike) {
  const dep = s.departingAt ? formatDateTime(s.departingAt) : "";
  const arr = s.arrivingAt ? formatClock(s.arrivingAt) : "";
  return `${s.carrier?.iata ?? ""} ${s.flightNumber ?? ""} · ${s.origin?.iata ?? "?"} ${dep} → ${s.destination?.iata ?? "?"} ${arr}`;
}

export function ScheduleChanges({ changes }: { changes: OrderGetResult["scheduleChanges"] }) {
  const t = useT();
  if (!changes.length) return null;
  return (
    <section role="alert" className="rounded-xl border border-warning/30 bg-warning/10 p-6 sm:p-8">
      <h2 className="flex items-center gap-2 font-display text-2xl text-warning">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" /> {t("od.schedule.title")}
      </h2>
      <p className="mt-1 text-sm text-warning/80">{t("od.schedule.body")}</p>
      <div className="mt-4 space-y-4">
        {changes.map((c) => {
          const oldSegs = Array.isArray(c.oldSegments) ? (c.oldSegments as SegLike[]) : [];
          const newSegs = Array.isArray(c.newSegments) ? (c.newSegments as SegLike[]) : [];
          return (
            <div key={c.id} className="grid gap-3 rounded-lg bg-card p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("od.schedule.old")}</p>
                {oldSegs.map((s, i) => (
                  <p key={i} className="mt-1 line-through decoration-muted-foreground/60">
                    {segLine(s)}
                  </p>
                ))}
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-warning">{t("od.schedule.new", { date: formatDateTime(c.createdAt) })}</p>
                {newSegs.map((s, i) => (
                  <p key={i} className="mt-1 font-semibold">
                    {segLine(s)}
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Refusjon ───────────────────────────────────────────────────────────────

export function RefundTimeline({ orderId, accessToken }: { orderId: string; accessToken?: string }) {
  const t = useT();
  const q = trpc.orders.refundStatus.useQuery({ orderId, accessToken }, { retry: 1 });
  if (q.isLoading) return <div className="shimmer h-24 rounded-lg" />;
  if (q.isError) return <p className="text-sm text-muted-foreground">{humanMessage(q.error)}</p>;
  if (!q.data?.length) return null;
  return (
    <div className="space-y-4">
      {q.data.map((c) => (
        <div key={c.id} className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">
              {t("od.refund.case", { ref: c.reference })} · <span className="font-normal text-muted-foreground">{c.stateLabel}</span>
            </p>
            <p className="font-semibold">{t("od.refund.toyou", { amount: formatMinor(c.customerRefundAmountMinor ?? 0, c.currency) })}</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("od.refund.split", { supplier: formatMinor(c.supplierRefundAmountMinor ?? 0, c.currency), fee: formatMinor(c.serviceFeeRefundMinor ?? 0, c.currency) })}
          </p>
          {c.timeline.length > 0 && (
            <ol className="mt-3 space-y-1.5 border-l-2 border-border pl-3 text-xs">
              {c.timeline.map((ev, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>{ev.label}</span>
                  <span className="text-muted-foreground">{formatDateTime(ev.at)}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{t("od.refund.payout")}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Selvbetjent avbestilling ───────────────────────────────────────────────

export function CancelFlow({ orderId, accessToken, data, onDone }: { orderId: string; accessToken?: string; data: OrderGetResult; onDone: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const quote = trpc.orders.cancellationQuote.useMutation();
  const confirm = trpc.orders.confirmCancellation.useMutation({ onSuccess: onDone });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const i = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(i);
  }, [open]);

  const q = quote.data;
  const expired = q?.expiresAt ? Date.parse(q.expiresAt) < now : false;

  const start = () => {
    setOpen(true);
    quote.mutate({ orderId, accessToken });
  };

  if (confirm.isSuccess) {
    return (
      <div role="status" className="rounded-xl border border-success/30 bg-success/5 p-6">
        <p className="font-display text-xl text-success">{t("od.cancel.done")}</p>
        <p className="mt-1 text-sm text-success/80">{t("od.cancel.donebody", { ref: confirm.data.refundReference })}</p>
      </div>
    );
  }

  if (!data.actions.canCancel) {
    return (
      <p className="text-sm text-muted-foreground">
        {data.actions.hasOpenRefund ? t("od.cancel.openrefund") : data.actions.cancelReason ?? t("od.cancel.nothere")}{" "}
        <Link to={`/hjelp?ref=${data.order.bookingReference}&topic=refund`} className="font-semibold underline underline-offset-2">
          {t("common.contactus")}
        </Link>{" "}
        {t("od.cancel.help")}
      </p>
    );
  }

  return (
    <>
      <button type="button" onClick={start} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-5 text-sm font-semibold transition-colors hover:border-foreground/40">
        <Undo2 className="h-4 w-4" aria-hidden="true" /> {t("od.cancel.see")}
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl">{t("od.cancel.title")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground">
                {quote.isPending && (
                  <p className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t("od.cancel.fetching")}
                  </p>
                )}
                {quote.isError && <p className="text-primary">{humanMessage(quote.error)}</p>}
                {q && (
                  <div className="space-y-3">
                    <dl className="space-y-1.5 rounded-lg bg-muted/60 p-4 text-foreground">
                      <div className="flex justify-between">
                        <dt>{t("od.cancel.supplier")}</dt>
                        <dd className="font-semibold">{formatMinor(q.supplierRefundMinor, q.currency)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>{t("od.cancel.fee")}</dt>
                        <dd className="font-semibold">{formatMinor(q.serviceFeeRefundMinor, q.currency)}</dd>
                      </div>
                      <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                        <dt>{t("od.cancel.total")}</dt>
                        <dd>{formatMinor(q.totalToCustomerMinor, q.currency)}</dd>
                      </div>
                    </dl>
                    <p>{q.feePolicyText}</p>
                    {q.expiresAt && (
                      <p className={expired ? "font-semibold text-primary" : ""}>
                        {expired ? t("od.cancel.expired") : t("od.cancel.validuntil", { date: formatDateTime(q.expiresAt) })}
                      </p>
                    )}
                    <p>{t("od.cancel.noundo")}</p>
                  </div>
                )}
                {confirm.isError && (
                  <p role="alert" className="mt-2 text-primary">
                    {humanMessage(confirm.error)}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11 rounded-full">{t("od.cancel.keep")}</AlertDialogCancel>
            {q && expired ? (
              <AlertDialogAction
                className="min-h-11 rounded-full"
                onClick={(e) => {
                  e.preventDefault();
                  quote.mutate({ orderId, accessToken });
                }}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> {t("od.cancel.refetch")}
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                className="min-h-11 rounded-full bg-primary text-primary-foreground hover:opacity-90"
                disabled={!q || confirm.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  if (q) confirm.mutate({ orderId, accessToken, cancellationId: q.cancellationId });
                }}
              >
                {confirm.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {t("od.cancel.confirm")}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Handlinger ─────────────────────────────────────────────────────────────

export function OrderActions({ orderId, accessToken, data }: { orderId: string; accessToken?: string; data: OrderGetResult }) {
  const t = useT();
  const resend = trpc.orders.resendConfirmation.useMutation();
  const tokenQs = accessToken ? `?t=${encodeURIComponent(accessToken)}` : "";
  return (
    <div className="flex flex-wrap gap-2">
      <a href={icsDataUrl(data.order)} download={`hellosky-${data.order.bookingReference}.ics`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-5 text-sm font-semibold transition-colors hover:border-foreground/40">
        <CalendarPlus className="h-4 w-4" aria-hidden="true" /> {t("od.calendar")}
      </a>
      <Link to={`/kvittering/${encodeURIComponent(orderId)}${tokenQs}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-5 text-sm font-semibold transition-colors hover:border-foreground/40">
        <ReceiptText className="h-4 w-4" aria-hidden="true" /> {t("od.receipt")}
      </Link>
      {data.actions.canResendConfirmation && (
        <button
          type="button"
          onClick={() => resend.mutate({ orderId, accessToken })}
          disabled={resend.isPending || resend.isSuccess}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-5 text-sm font-semibold transition-colors hover:border-foreground/40 disabled:opacity-60"
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          {resend.isSuccess ? t("od.resend.done") : resend.isPending ? t("common.sending") : t("od.resend")}
        </button>
      )}
      {resend.isError && (
        <p role="alert" className="w-full text-xs text-primary">
          {humanMessage(resend.error)}
        </p>
      )}
    </div>
  );
}
