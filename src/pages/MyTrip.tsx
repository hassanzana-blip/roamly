import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronRight, KeyRound, Luggage, MailWarning, Plane, Search } from "lucide-react";
import { trpc } from "@/providers/trpc";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { CancelFlow, Itinerary, OrderActions, RefundTimeline, ScheduleChanges, StateBadge, TicketList } from "@/components/travel/OrderDetails";
import { useOrder } from "@/components/travel/orderUtils";
import { useCustomer } from "@/lib/useCustomer";
import { appCodeOf, humanMessage } from "@/lib/apiError";
import { bookingStateLabel, cabinLabel, formatDateLong, formatDateShort, formatMinor, formatPrice, toMinor } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";

/** Full ordrevisning via orders.get (token fra oppslaget ligger i sessionStorage). */
function OrderPanel({ orderId }: { orderId: string }) {
  const t = useT();
  const order = useOrder(orderId, { refetchWhileProcessing: true });
  if (order.isLoading) return <div className="shimmer h-64 rounded-xl" aria-busy="true" />;
  if (order.isError || !order.data) {
    return (
      <p role="alert" className="rounded-xl border border-destructive/30 bg-card p-6 text-sm text-destructive">
        {order.error ? humanMessage(order.error) : t("mt.fetchfail")}
      </p>
    );
  }
  const data = order.data;
  const o = data.order;
  const currency = data.payment?.currency ?? o.totalCurrency;
  return (
    <div className="fade-up space-y-6">
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{t("common.pnr")}</p>
            <p className="mt-1 font-display text-4xl tracking-[0.1em] text-foreground">{o.bookingReference || "—"}</p>
          </div>
          <StateBadge state={data.state} />
        </div>
        <div className="mt-5 grid gap-2 border-t border-border pt-5 text-sm sm:grid-cols-2">
          <p className="text-muted-foreground">
            {t("common.class")}: <span className="font-medium text-foreground">{cabinLabel(o.cabinClass)}</span>
          </p>
          <p className="text-muted-foreground">
            {t("common.booked")}: <span className="font-medium text-foreground">{formatDateLong(data.createdAt)}</span>
          </p>
          <p className="text-muted-foreground">
            {t("common.paid")}: <span className="font-medium text-foreground">{data.payment?.amountMinor != null ? formatMinor(data.payment.amountMinor, currency) : formatMinor(toMinor(o.totalAmount, o.totalCurrency), o.totalCurrency)}</span>
          </p>
          {o.services && o.services.extraBags > 0 && (
            <p className="text-muted-foreground">
              {t("common.extrabags")}: <span className="font-medium text-foreground">{t("common.bags", { count: o.services.extraBags })}</span>
            </p>
          )}
        </div>
        <div className="mt-5">
          <OrderActions orderId={orderId} accessToken={order.accessToken} data={data} />
        </div>
      </section>

      <ScheduleChanges changes={data.scheduleChanges} />

      <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <h2 className="mb-5 font-display text-2xl">{t("common.itinerary")}</h2>
        <Itinerary order={o} />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <h2 className="mb-4 font-display text-2xl">{t("common.tickets")}</h2>
        <TicketList order={o} />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <h2 className="font-display text-2xl">{t("mt.change.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("mt.change.sub")}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <CancelFlow orderId={orderId} accessToken={order.accessToken} data={data} onDone={() => order.refetch()} />
          <Link to={`/hjelp?ref=${o.bookingReference}&topic=change`} className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground">
            {t("mt.requestchange")}
          </Link>
        </div>
        {data.refundCases.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t("common.refund")}</h3>
            <RefundTimeline orderId={orderId} accessToken={order.accessToken} />
          </div>
        )}
      </section>
    </div>
  );
}

export default function MyTrip() {
  usePageMeta(PAGE_META.myTrip);
  const t = useT();
  const [ref, setRef] = useState("");
  const [email, setEmail] = useState("");
  const [foundOrderId, setFoundOrderId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { customer } = useCustomer();
  const utils = trpc.useUtils();
  const trips = trpc.customerAuth.myTrips.useQuery(undefined, { enabled: Boolean(customer), retry: 0 });
  const resend = trpc.customerAuth.resendVerification.useMutation();
  const tripsErrCode = trips.error ? appCodeOf(trips.error) : null;

  const find = trpc.flights.findBooking.useMutation({
    onSuccess: (r) => {
      try {
        sessionStorage.setItem(`hellosky:access:${r.orderId}`, r.accessToken);
      } catch {
        /* ignore */
      }
      utils.orders.get.invalidate();
      setFoundOrderId(r.orderId);
    },
  });

  const inputCls =
    "min-h-11 w-full rounded-xl border hairline bg-card px-4 py-3.5 text-base outline-none transition-colors focus:border-accent placeholder:text-muted-foreground/60";

  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl px-4 pb-20 pt-28 outline-none sm:px-6">
        <div className="-mx-4 -mt-28 mb-8 border-b border-border bg-muted/40 px-4 pb-10 pt-32 sm:-mx-6 sm:px-6">
          <p className="flex items-center gap-2 font-mono-label text-[11px] text-foreground">
            <Luggage className="h-4 w-4 text-foreground" aria-hidden="true" /> {t("mt.kicker")}
          </p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">{t("mt.title")}</h1>
          <p className="mt-3 max-w-lg text-muted-foreground">{t("mt.sub")}</p>
        </div>

        {/* Innlogget: e-post må være bekreftet */}
        {customer && tripsErrCode === "EMAIL_NOT_VERIFIED" && (
          <section className="mb-8 flex items-start gap-3 rounded-xl border border-amber-300/60 bg-warning/10 p-5">
            <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p className="font-semibold text-warning">{t("mt.verify.title")}</p>
              <p className="mt-1 text-sm text-warning/80">{t("mt.verify.body", { email: customer.email ?? "" })}</p>
              <button
                type="button"
                onClick={() => resend.mutate()}
                disabled={resend.isPending || resend.isSuccess}
                className="mt-2 min-h-11 rounded-lg bg-night px-5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {resend.isSuccess ? t("common.sent") : resend.isPending ? t("common.sending") : t("common.resendlink")}
              </button>
              {resend.isError && (
                <p role="alert" className="mt-2 text-xs text-primary">
                  {humanMessage(resend.error)}
                </p>
              )}
            </div>
          </section>
        )}

        {customer && (trips.data?.length ?? 0) > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 font-display text-2xl">{t("mt.yourbookings", { name: customer.firstName })}</h2>
            <ul className="space-y-2">
              {trips.data!.map((trip) => (
                <li key={trip.orderId}>
                  <button
                    type="button"
                    onClick={() => navigate(`/bekreftelse/${encodeURIComponent(trip.orderId)}`)}
                    className="flex min-h-11 w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-foreground/40"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted">
                      <Plane className="h-5 w-5 text-foreground" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">
                        {trip.originCity || trip.originIata} → {trip.destinationCity || trip.destinationIata}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {trip.departingAt ? formatDateShort(trip.departingAt) : ""} · {t("common.pax", { count: trip.passengerCount })} · {t("mt.trip.ref", { ref: trip.bookingReference || "—" })}
                        {trip.demoMode ? ` · ${t("mt.demo")}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold">{formatPrice(trip.totalAmount || "0", trip.totalCurrency)}</span>
                      <span className="text-[11px] text-muted-foreground">{bookingStateLabel(trip.state)}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {customer && trips.data && trips.data.length === 0 && (
          <p className="mb-8 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">{t("mt.nobookings")}</p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFoundOrderId(null);
            find.mutate({ bookingReference: ref.trim().toUpperCase(), email: email.trim() });
          }}
          className="rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6"
          aria-labelledby="lookup-heading"
        >
          <h2 id="lookup-heading" className="mb-4 font-display text-xl">
            {t("mt.lookup")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block eyebrow">{t("mt.ref")}</span>
              <input placeholder={t("mt.refph")} value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} maxLength={8} autoComplete="off" className={inputCls + " font-mono tracking-[0.2em]"} />
            </label>
            <label className="block">
              <span className="mb-1.5 block eyebrow">{t("mt.email")}</span>
              <input type="email" placeholder={t("common.emailph")} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={inputCls} />
            </label>
          </div>
          {find.isError && (
            <p role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {humanMessage(find.error)}
            </p>
          )}
          <button
            type="submit"
            disabled={ref.trim().length < 4 || !email.includes("@") || find.isPending}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 text-base font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-40"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            {find.isPending ? t("mt.looking") : t("mt.show")}
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <KeyRound className="h-3 w-3" aria-hidden="true" /> {t("mt.privacy")}
          </p>
        </form>

        {/* Luft i bunnen så WhatsApp-boblen ikke dekker hjelpeteksten under skjemaet på mobil */}
        <div className={foundOrderId ? "mt-8" : "mt-8 pb-16 lg:pb-0"}>{foundOrderId && <OrderPanel orderId={foundOrderId} />}</div>
      </main>

      <SiteFooter />
    </div>
  );
}
