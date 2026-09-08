import { Link } from "react-router";
import { FileText, ReceiptText } from "lucide-react";
import Icon from "@/components/app/Icon";
import { bookingStateLabel, formatDateShort, formatPrice } from "@/lib/format";
import { confirmationHref, receiptHref, type TripBucket, type TripSummary } from "@/components/account/tripUtils";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import CountryFlag from "@/components/brand/CountryFlag";
import { airportByIata } from "@contracts/airports";

/**
 * Én bestilling som reisekort: rute, dato, reisefølge, PNR, status – og
 * dokumentene (billett/bekreftelse og kvittering) rett under. Brukes på
 * /reiser, /reise og i navet på /profil, så en reise ser lik ut overalt.
 */

/** Bekreftelsen er også e-billetten; kvitteringen er salgsdokumentet. Innlogget eier trenger ingen token. */

const POSITIVE = new Set(["CONFIRMED", "TRAVELLED"]);

/** Rolig statusmerke: lime-tonet når alt er i orden, ellers nøytralt. */
export function StatusPill({ state, className }: { state: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center whitespace-nowrap rounded-md px-2 text-[12px] font-semibold leading-none",
        POSITIVE.has(state) ? "bg-primary-soft text-accent-foreground" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {bookingStateLabel(state)}
    </span>
  );
}

/** Dokumentlenkene for én bestilling. 44 px høye, én rad. */
export function TripDocLinks({ orderId, className }: { orderId: string; className?: string }) {
  const t = useT();
  const link = "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold transition-colors duration-fast hover:bg-muted";
  return (
    <div className={cn("-ml-2 flex flex-wrap items-center gap-x-2", className)}>
      <Link to={confirmationHref(orderId)} className={link}>
        <Icon icon={FileText} size={16} /> {t("acct.docs.ticket")}
      </Link>
      <Link to={receiptHref(orderId)} className={link}>
        <Icon icon={ReceiptText} size={16} /> {t("acct.docs.receipt")}
      </Link>
    </div>
  );
}

export function TripCard({ trip, bucket, className }: { trip: TripSummary; bucket?: TripBucket; className?: string }) {
  const t = useT();
  const from = trip.originCity || trip.originIata;
  const to = trip.destinationCity || trip.destinationIata;
  const quiet = bucket === "cancelled";
  return (
    <article className={cn("surface overflow-hidden", className)}>
      <Link
        to={confirmationHref(trip.orderId)}
        className="press block px-4 pb-3 pt-4 transition-colors duration-fast hover:bg-muted/40 sm:px-5 sm:pt-5"
        aria-label={`${from} – ${to}${trip.bookingReference ? `, ${trip.bookingReference}` : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={cn("t-h3 truncate", quiet && "text-muted-foreground line-through decoration-border")}>
              {from} <span aria-hidden="true">→</span> {to}
            </p>
            {trip.originIata && trip.destinationIata ? (
              // Flagget svarer på «hvilket land» før man har lest bykoden.
              <p className="mt-1 flex items-center gap-2 text-muted-foreground">
                <CountryFlag code={airportByIata(trip.destinationIata)?.countryCode} size={11} />
                <span className="t-code">{trip.originIata} – {trip.destinationIata}</span>
              </p>
            ) : null}
          </div>
          <StatusPill state={trip.state} className="mt-0.5 shrink-0" />
        </div>
        <dl className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
          {trip.departingAt ? (
            <div>
              <dt className="sr-only">{t("tr.depart")}</dt>
              <dd className="t-num font-medium text-foreground">{formatDateShort(trip.departingAt)}</dd>
            </div>
          ) : null}
          <div>
            <dt className="sr-only">{t("pw.pax")}</dt>
            <dd>{t("common.pax", { count: trip.passengerCount })}</dd>
          </div>
          {trip.bookingReference ? (
            <div className="flex items-baseline gap-1.5">
              <dt>PNR</dt>
              <dd className="t-code text-foreground">{trip.bookingReference}</dd>
            </div>
          ) : null}
          {trip.demoMode ? (
            <div>
              <dt className="sr-only">{t("common.status")}</dt>
              <dd>{t("mt.demo")}</dd>
            </div>
          ) : null}
          {trip.totalAmount ? (
            <div className="ml-auto">
              <dt className="sr-only">{t("common.price")}</dt>
              <dd className="t-num font-semibold text-foreground">{formatPrice(trip.totalAmount, trip.totalCurrency)}</dd>
            </div>
          ) : null}
        </dl>
      </Link>
      <div className="border-t border-border px-4 py-1 sm:px-5">
        <TripDocLinks orderId={trip.orderId} />
      </div>
    </article>
  );
}

export type { TripBucket, TripSummary };
