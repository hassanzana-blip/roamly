import { useParams } from "react-router";
import { Printer } from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import Icon from "@/components/app/Icon";
import SkyMark from "@/components/brand/SkyMark";
import InvoiceSummaryBlock from "@/components/travel/InvoiceSummary";
import { invoiceOf, useOrder } from "@/components/travel/orderUtils";
import { humanMessage } from "@/lib/apiError";
import {
  cabinLabel,
  formatClock,
  formatDateLong,
  formatMinor,
  paxLabel,
  toMinor,
} from "@/lib/format";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";

const SELLER = {
  name: "HelloSky AS",
  orgNumber: import.meta.env.VITE_ORG_NUMBER ?? "—",
  address: import.meta.env.VITE_COMPANY_ADDRESS ?? "Oslo, Norge",
  email: "hei@hellosky.no",
  phone: import.meta.env.VITE_SUPPORT_PHONE ?? "+47 22 41 00 00",
};
/** MVA-sats på servicegebyret (prosent). Flybilletter faktureres av flyselskapet med sin egen sats. */
const FEE_VAT_PERCENT = Number(
  import.meta.env.VITE_SERVICE_FEE_VAT_PERCENT ?? "0"
);

const PAYMENT_LABELS: Record<string, string> = {
  card: "Bankkort",
  klarna: "Klarna",
  vipps: "Mobilbetaling",
  demo: "Demo (ingen betaling)",
  stripe: "Kort via Stripe",
};

/** /kvittering/:orderId?t= — salgsdokument, utskriftsvennlig. */
export default function Receipt() {
  usePageMeta(PAGE_META.receipt);
  const t = useT();
  const { orderId = "" } = useParams();
  const order = useOrder(orderId);
  const data = order.data;
  const o = data?.order;
  const { invoice, pspReference } = invoiceOf(data);

  const currency = data?.payment?.currency ?? o?.totalCurrency ?? "NOK";
  const supplierMinor = o?.supplierAmount
    ? toMinor(o.supplierAmount, currency)
    : 0;
  const servicesMinor = o?.servicesAmount
    ? toMinor(o.servicesAmount, currency)
    : 0;
  const feeMinor = o?.serviceFeeAmount
    ? toMinor(o.serviceFeeAmount, currency)
    : 0;
  const bonusMinor = o?.bonusUsedKr ? o.bonusUsedKr * 100 : 0;
  const totalMinor =
    data?.payment?.amountMinor ?? (o ? toMinor(o.totalAmount, currency) : 0);
  const feeVatMinor = Math.round(
    (feeMinor * FEE_VAT_PERCENT) / (100 + FEE_VAT_PERCENT)
  );
  const paid =
    data?.payment?.status === "captured" ||
    data?.payment?.status === "succeeded";

  const lines = o
    ? [
        {
          label: `Flybilletter — ${o.slices.map(s => `${s.origin.iata}–${s.destination.iata}`).join(", ")} (${cabinLabel(o.cabinClass)})`,
          qty: o.passengers.length,
          net: supplierMinor,
          vat: 0,
          vatLabel: "inkl.*",
          gross: supplierMinor,
        },
        ...(servicesMinor > 0
          ? [
              {
                label: `Ekstra bagasje (${o.services?.extraBags ?? 0} kolli)`,
                qty: o.services?.extraBags ?? 1,
                net: servicesMinor,
                vat: 0,
                vatLabel: "inkl.*",
                gross: servicesMinor,
              },
            ]
          : []),
        ...(feeMinor > 0
          ? [
              {
                label: "HelloSky servicegebyr",
                qty: 1,
                net: feeMinor - feeVatMinor,
                vat: feeVatMinor,
                vatLabel: `${FEE_VAT_PERCENT} %`,
                gross: feeMinor,
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden">
        <SiteHeader />
      </div>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-2xl px-4 pb-16 pt-28 outline-none print:max-w-none print:px-0 print:pt-0"
      >
        {order.isLoading && (
          <div className="shimmer h-96 rounded-xl" aria-busy="true" />
        )}
        {order.isError && (
          <div
            role="alert"
            className="rounded-xl border border-border bg-card p-8 text-center"
          >
            <p className="font-display text-2xl">Fant ikke kvitteringen</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {humanMessage(order.error)}
            </p>
          </div>
        )}

        {data && o && (
          <>
            <div className="mb-4 flex justify-end print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-night px-5 text-[13px] font-semibold text-white transition-colors hover:opacity-90"
              >
                <Icon icon={Printer} size={16} /> Skriv ut / lagre som PDF
              </button>
            </div>

            <article
              className="overflow-hidden rounded-xl border border-border bg-card shadow-soft print:rounded-none print:border-0 print:shadow-none"
              aria-label={t("rc.plain")}
            >
              <header className="flex items-start justify-between gap-4 bg-night p-6 text-white print:bg-card print:text-foreground">
                <div className="flex items-center gap-2.5">
                  <SkyMark className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-display text-xl leading-none">
                      HelloSky
                    </p>
                    <p className="mt-1 text-[11px] opacity-70">
                      {invoice
                        ? t("rc.title", { n: String(invoice.invoiceNumber) })
                        : t("rc.plain")}
                    </p>
                  </div>
                </div>
                <div className="text-right text-[12px]">
                  <p className="font-mono text-lg font-semibold tracking-widest">
                    {o.bookingReference || "—"}
                  </p>
                  <p className="opacity-70">Ordre {o.id}</p>
                  <p className="opacity-70">
                    {invoice
                      ? t("rc.issued", {
                          date: formatDateLong(invoice.issuedAt),
                        })
                      : `Dato ${formatDateLong(data.createdAt)}`}
                  </p>
                </div>
              </header>

              <div className="space-y-6 p-6">
                {/* Selger / kjøper */}
                <section className="grid gap-4 text-[13px] sm:grid-cols-2">
                  <div>
                    <h2 className="mb-1 eyebrow">
                      Selger
                    </h2>
                    <p className="font-semibold">{SELLER.name}</p>
                    <p>Org.nr. {SELLER.orgNumber}</p>
                    <p>{SELLER.address}</p>
                    <p>
                      {SELLER.email} · {SELLER.phone}
                    </p>
                  </div>
                  <div>
                    <h2 className="mb-1 eyebrow">
                      Kjøper
                    </h2>
                    <p className="font-semibold">
                      {o.passengers[0]?.givenName} {o.passengers[0]?.familyName}
                    </p>
                    <p>{o.contactEmail}</p>
                    <p>{o.contactPhone}</p>
                  </div>
                </section>

                {/* Reiserute */}
                <section>
                  <h2 className="mb-3 eyebrow">
                    Reiserute
                  </h2>
                  <div className="space-y-2">
                    {o.slices.map(s => (
                      <div
                        key={s.id}
                        className="rounded-lg border border-border p-3 text-[13px]"
                      >
                        <p className="font-semibold">
                          {s.origin.iata} {formatClock(s.departingAt)} →{" "}
                          {s.destination.iata} {formatClock(s.arrivingAt)} ·{" "}
                          {formatDateLong(s.departingAt)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {s.segments
                            .map(
                              g =>
                                `${g.carrier.name} ${g.carrier.iata} ${g.flightNumber}`
                            )
                            .join(" · ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Reisende */}
                <section>
                  <h2 className="mb-2 eyebrow">
                    Reisende
                  </h2>
                  <ul className="space-y-1 text-[13px]">
                    {o.passengers.map(p => {
                      const tickets = (o.tickets ?? []).filter(
                        t => t.passengerId === p.id
                      );
                      return (
                        <li
                          key={p.id}
                          className="flex flex-wrap justify-between gap-2"
                        >
                          <span>
                            {p.givenName} {p.familyName}{" "}
                            <span className="text-muted-foreground">
                              ({paxLabel(p.type)})
                            </span>
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {tickets.map(t => t.uniqueIdentifier).join(", ")}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                {/* Linjer — serverens kvittering (OTA-172) når den finnes, ellers klientens spesifikasjon */}
                {invoice ? (
                  <section>
                    <InvoiceSummaryBlock
                      invoice={invoice}
                      pspReference={pspReference}
                    />
                    {data.payment && data.payment.refundedMinor > 0 && (
                      <p className="mt-2 text-right text-[13px] text-success">
                        Herav refundert{" "}
                        <span className="font-semibold">
                          {formatMinor(data.payment.refundedMinor, currency)}
                        </span>
                      </p>
                    )}
                  </section>
                ) : (
                  <section className="border-t border-border pt-4">
                    <h2 className="mb-3 eyebrow">
                      Spesifikasjon
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[480px] text-[13px]">
                        <thead>
                          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                            <th
                              scope="col"
                              className="py-1.5 pr-2 font-semibold"
                            >
                              Beskrivelse
                            </th>
                            <th
                              scope="col"
                              className="py-1.5 pr-2 text-right font-semibold"
                            >
                              Ant.
                            </th>
                            <th
                              scope="col"
                              className="py-1.5 pr-2 text-right font-semibold"
                            >
                              Eks. mva
                            </th>
                            <th
                              scope="col"
                              className="py-1.5 pr-2 text-right font-semibold"
                            >
                              Mva
                            </th>
                            <th
                              scope="col"
                              className="py-1.5 text-right font-semibold"
                            >
                              Beløp
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map(l => (
                            <tr
                              key={l.label}
                              className="border-b border-border/60"
                            >
                              <td className="py-2 pr-2">{l.label}</td>
                              <td className="py-2 pr-2 text-right">{l.qty}</td>
                              <td className="py-2 pr-2 text-right">
                                {formatMinor(l.net, currency)}
                              </td>
                              <td className="py-2 pr-2 text-right">
                                {l.vat > 0
                                  ? `${formatMinor(l.vat, currency)} (${l.vatLabel})`
                                  : l.vatLabel}
                              </td>
                              <td className="py-2 text-right font-semibold">
                                {formatMinor(l.gross, currency)}
                              </td>
                            </tr>
                          ))}
                          {bonusMinor > 0 && (
                            <tr className="border-b border-border/60 text-success">
                              <td className="py-2 pr-2">Bonus brukt</td>
                              <td className="py-2 pr-2 text-right">1</td>
                              <td className="py-2 pr-2 text-right">
                                −{formatMinor(bonusMinor, currency)}
                              </td>
                              <td className="py-2 pr-2 text-right">—</td>
                              <td className="py-2 text-right font-semibold">
                                −{formatMinor(bonusMinor, currency)}
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td
                              colSpan={4}
                              className="pt-3 text-right font-semibold"
                            >
                              {paid ? "Totalt betalt" : "Totalt"}
                            </td>
                            <td className="pt-3 text-right font-display text-xl font-semibold">
                              {formatMinor(totalMinor, currency)}
                            </td>
                          </tr>
                          {data.payment && data.payment.refundedMinor > 0 && (
                            <tr className="text-success">
                              <td colSpan={4} className="pt-1 text-right">
                                Herav refundert
                              </td>
                              <td className="pt-1 text-right font-semibold">
                                {formatMinor(
                                  data.payment.refundedMinor,
                                  currency
                                )}
                              </td>
                            </tr>
                          )}
                        </tfoot>
                      </table>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      * Flybilletter og bagasje faktureres av flyselskapet;
                      skatter, avgifter og eventuell mva er inkludert i beløpet
                      og spesifiseres på flyselskapets billett.
                    </p>
                  </section>
                )}

                {/* Betaling */}
                <section className="border-t border-border pt-4 text-[13px]">
                  <h2 className="mb-2 eyebrow">
                    Betaling
                  </h2>
                  <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                    <div className="flex justify-between sm:block">
                      <dt className="text-muted-foreground">Betalingsmåte</dt>
                      <dd>
                        {PAYMENT_LABELS[o.paymentMethod ?? ""] ??
                          PAYMENT_LABELS[data.payment?.provider ?? ""] ??
                          "Kort"}
                      </dd>
                    </div>
                    <div className="flex justify-between sm:block">
                      <dt className="text-muted-foreground">Status</dt>
                      <dd>
                        {paid
                          ? "Betalt"
                          : (data.payment?.status ?? o.paymentStatus)}
                      </dd>
                    </div>
                    {pspReference && (
                      <div className="flex justify-between sm:block">
                        <dt className="text-muted-foreground">{t("rc.psp")}</dt>
                        <dd className="font-mono">{pspReference}</dd>
                      </div>
                    )}
                    <div className="flex justify-between sm:block">
                      <dt className="text-muted-foreground">Valuta</dt>
                      <dd>{currency}</dd>
                    </div>
                  </dl>
                </section>

                <p className="border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
                  Dette dokumentet er kvittering for kjøp av flyreise formidlet
                  av {SELLER.name}. Spørsmål? Ring {SELLER.phone} eller skriv
                  til {SELLER.email}.
                  {o.demoMode
                    ? " Demobestilling — ingen betaling er gjennomført."
                    : ""}
                </p>
              </div>
            </article>
          </>
        )}
      </main>

      <style>{`@media print { body { background: #fff; } .print\\:hidden { display: none !important; } @page { margin: 14mm; } }`}</style>
    </div>
  );
}
