import { Link, useParams } from "react-router";
import { Clock, Copy, LifeBuoy, Mail, Radar } from "lucide-react";
import { BookingFailedSpot, BookingTimeline, ConfirmationMark, timelineFor } from "@/components/graphics";
import { useState } from "react";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { CancelFlow, Itinerary, OrderActions, RefundTimeline, ScheduleChanges, StateBadge, TicketList } from "@/components/travel/OrderDetails";
import InvoiceSummaryBlock from "@/components/travel/InvoiceSummary";
import { invoiceOf, useOrder } from "@/components/travel/orderUtils";
import { appCodeOf, humanMessage } from "@/lib/apiError";
import { cabinLabel, formatDateLong, formatMinor, formatPrice, toMinor } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";

const PROCESSING = ["PAYMENT_AUTHORIZED", "BOOKING_PROCESSING", "AWAITING_RECONCILIATION"];

export default function Confirmation() {
  usePageMeta(PAGE_META.confirmation);
  const t = useT();
  const { orderId = "" } = useParams();
  const order = useOrder(orderId, { refetchWhileProcessing: true });
  const [copied, setCopied] = useState(false);

  const copyRef = (ref: string) => {
    navigator.clipboard.writeText(ref).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const data = order.data;
  const o = data?.order;
  const state = data?.state ?? "";
  const processing = PROCESSING.includes(state);
  const failed = state === "BOOKING_FAILED";
  const firstSeg = o?.slices[0]?.segments[0];
  const currency = data?.payment?.currency ?? o?.totalCurrency ?? "NOK";
  const errCode = order.error ? appCodeOf(order.error) : null;
  const { invoice, pspReference } = invoiceOf(data);
  const authErr = errCode === "FORBIDDEN" || errCode === "UNAUTHORIZED";

  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl px-4 pb-20 pt-28 outline-none sm:px-6">
        {order.isLoading && (
          <div className="space-y-4" aria-busy="true">
            <div className="shimmer h-24 rounded-xl" />
            <div className="shimmer h-56 rounded-xl" />
          </div>
        )}

        {order.isError && (
          <div role="alert" className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="font-display text-2xl">{authErr ? t("cf.err.auth") : t("cf.err.notfound")}</p>
            <p className="mt-2 text-sm text-muted-foreground">{authErr ? t("cf.err.authbody") : humanMessage(order.error)}</p>
            <Link to="/reise" className="mt-6 inline-block min-h-11 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
              {t("cf.find")}
            </Link>
          </div>
        )}

        {data && o && (
          <div className="space-y-6">
            {/* hero */}
            <section className="fade-up rounded-xl border border-border bg-card p-8 text-center" aria-live="polite">
              {processing ? (
                <Clock className="mx-auto h-14 w-14 text-warning" strokeWidth={1.6} aria-hidden="true" />
              ) : failed ? (
                <BookingFailedSpot className="mx-auto" />
              ) : (
                <ConfirmationMark className="mx-auto" />
              )}
              <h1 className="mt-4 font-display text-4xl sm:text-5xl">
                {failed ? t("cf.failed") : processing ? t("cf.almost") : t("cf.bonvoyage", { name: o.passengers[0] ? `, ${o.passengers[0].givenName}` : "" })}
              </h1>
              <div className="mt-3">
                <StateBadge state={state} />
              </div>
              <BookingTimeline state={timelineFor(state)} className="mx-auto mt-6 max-w-xl text-left" />
              <p className="mt-3 text-muted-foreground">
                {failed
                  ? t("cf.failedbody")
                  : processing
                    ? t("cf.processing", { carrier: firstSeg?.carrier.name ?? t("cf.airline"), email: o.contactEmail })
                    : state === "CANCELLED" || state === "REFUNDED" || state === "PARTIALLY_REFUNDED"
                      ? t("cf.cancelled")
                      : t("cf.sentto")}{" "}
                {!failed && !processing && !["CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(state) && <span className="font-medium text-foreground">{o.contactEmail}</span>}
              </p>
              {o.bookingReference && (
                <button
                  type="button"
                  onClick={() => copyRef(o.bookingReference)}
                  className="group mx-auto mt-6 flex min-h-11 items-center gap-3 rounded-lg border border-border bg-muted px-6 py-3 transition-colors hover:bg-primary/20"
                  aria-label={t("cf.copyref", { ref: o.bookingReference })}
                >
                  <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{t("common.pnr")}</span>
                  <span className="font-display text-3xl tracking-[0.12em] text-foreground">{o.bookingReference}</span>
                  <Copy className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden="true" />
                </button>
              )}
              {copied && (
                <p className="mt-2 text-xs font-medium text-foreground" role="status">
                  {t("cf.copied")}
                </p>
              )}
              {o.demoMode && (
                <p className="mt-4 inline-block rounded-md border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground">{t("cf.demo")}</p>
              )}
            </section>

            <ScheduleChanges changes={data.scheduleChanges} />

            {/* itinerary */}
            <section className="fade-up fade-up-1 rounded-xl border border-border bg-card p-6 sm:p-8">
              <h2 className="mb-6 font-display text-2xl">{t("common.itinerary")}</h2>
              <Itinerary order={o} />
              <div className="mt-6 grid gap-2 border-t border-border pt-5 text-sm sm:grid-cols-2">
                <p className="text-muted-foreground">
                  {t("common.class")}: <span className="font-medium text-foreground">{cabinLabel(o.cabinClass)}</span>
                </p>
                <p className="text-muted-foreground">
                  {t("common.booked")}: <span className="font-medium text-foreground">{formatDateLong(data.createdAt)}</span>
                </p>
                {o.services && o.services.extraBags > 0 && (
                  <p className="text-muted-foreground sm:col-span-2">
                    {t("cf.extras")}: <span className="font-medium text-foreground">{t("cf.extrabags", { count: o.services.extraBags })}</span>
                  </p>
                )}
              </div>
            </section>

            {/* tickets */}
            <section className="fade-up fade-up-1 rounded-xl border border-border bg-card p-6 sm:p-8">
              <h2 className="mb-4 font-display text-2xl">{t("common.tickets")}</h2>
              <TicketList order={o} />
              {processing && <p className="mt-3 text-xs text-muted-foreground">{t("cf.ticketspending")}</p>}
            </section>

            {/* price */}
            <section className="fade-up fade-up-2 rounded-xl border border-border bg-card p-6 sm:p-8">
              <h2 className="mb-4 font-display text-2xl">{t("common.price")}</h2>
              <dl className="space-y-1.5 text-sm">
                {o.supplierAmount && (
                  <div className="flex justify-between text-muted-foreground">
                    <dt>{t("common.flights")}</dt>
                    <dd>{formatPrice(o.supplierAmount, o.totalCurrency)}</dd>
                  </div>
                )}
                {o.servicesAmount && Number(o.servicesAmount) > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <dt>{t("common.extrabags")}</dt>
                    <dd>{formatPrice(o.servicesAmount, o.totalCurrency)}</dd>
                  </div>
                )}
                {o.serviceFeeAmount && (
                  <div className="flex justify-between text-muted-foreground">
                    <dt>{t("common.fee")}</dt>
                    <dd>{formatPrice(o.serviceFeeAmount, o.totalCurrency)}</dd>
                  </div>
                )}
                {o.bonusUsedKr ? (
                  <div className="flex justify-between font-semibold text-success">
                    <dt>{t("common.bonusused")}</dt>
                    <dd>−{formatPrice(o.bonusUsedKr, o.totalCurrency)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-border pt-2.5 text-base font-semibold">
                  <dt>{data.payment?.status === "captured" || data.payment?.status === "succeeded" ? t("common.paid") : t("common.total")}</dt>
                  <dd className="font-display text-xl">{data.payment?.amountMinor != null ? formatMinor(data.payment.amountMinor, currency) : formatMinor(toMinor(o.totalAmount, o.totalCurrency), o.totalCurrency)}</dd>
                </div>
                {data.payment && data.payment.refundedMinor > 0 && (
                  <div className="flex justify-between text-success">
                    <dt>{t("common.refunded")}</dt>
                    <dd>{formatMinor(data.payment.refundedMinor, currency)}</dd>
                  </div>
                )}
              </dl>
              {invoice && (
                <div className="mt-5 rounded-lg border border-border bg-muted/40 p-4">
                  <InvoiceSummaryBlock invoice={invoice} pspReference={pspReference} compact />
                  <Link to={`/kvittering/${encodeURIComponent(orderId)}${order.accessToken ? `?t=${encodeURIComponent(order.accessToken)}` : ""}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-2">
                    {t("rc.view")}
                  </Link>
                </div>
              )}
              <div className="mt-5">
                <OrderActions orderId={orderId} accessToken={order.accessToken} data={data} />
              </div>
            </section>

            {/* cancel + refund */}
            {(data.actions.canCancel || data.refundCases.length > 0 || data.actions.cancelReason) && !processing && (
              <section className="fade-up fade-up-2 rounded-xl border border-border bg-card p-6 sm:p-8">
                <h2 className="mb-2 font-display text-2xl">{t("cf.cancel.title")}</h2>
                <div className="mt-3">
                  <CancelFlow orderId={orderId} accessToken={order.accessToken} data={data} onDone={() => order.refetch()} />
                </div>
                {data.refundCases.length > 0 && (
                  <div className="mt-5">
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t("common.refund")}</h3>
                    <RefundTimeline orderId={orderId} accessToken={order.accessToken} />
                  </div>
                )}
              </section>
            )}

            {/* next steps */}
            <section className="fade-up fade-up-2 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-5">
                <Mail className="h-5 w-5 text-foreground" aria-hidden="true" />
                <h3 className="mt-3 text-sm font-semibold">{t("cf.inbox")}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{t("cf.inboxbody")}</p>
              </div>
              <Link
                to={`/flystatus?carrier=${firstSeg?.carrier.iata ?? ""}&flight=${firstSeg?.flightNumber ?? ""}&date=${o.slices[0]?.departingAt.slice(0, 10) ?? ""}`}
                className="card-lift rounded-xl border border-border bg-card p-5"
              >
                <Radar className="h-5 w-5 text-foreground" aria-hidden="true" />
                <h3 className="mt-3 text-sm font-semibold">{t("cf.flightstatus")}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{t("cf.checkflight", { flight: `${firstSeg?.carrier.iata ?? ""} ${firstSeg?.flightNumber ?? ""}`.trim() })}</p>
              </Link>
              <Link to={`/hjelp?ref=${o.bookingReference}`} className="card-lift rounded-xl border border-border bg-card p-5">
                <LifeBuoy className="h-5 w-5 text-foreground" aria-hidden="true" />
                <h3 className="mt-3 text-sm font-semibold">{t("cf.help")}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{t("cf.helpbody")}</p>
              </Link>
            </section>

            <div className="text-center">
              <Link to="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-8 py-4 text-sm font-semibold transition-colors hover:border-foreground/40 hover:text-foreground">
                {t("cf.next")}
              </Link>
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
