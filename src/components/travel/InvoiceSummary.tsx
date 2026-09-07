import type { InvoiceSummary as Invoice } from "@contracts/types";
import { formatDateLong, formatMinor } from "@/lib/format";
import { useT } from "@/lib/i18n";

/**
 * Kvitteringsblokk (OTA-172): nummer, utstedelsesdato, linjer med mva-kolonner,
 * mva-oppsummering og PSP-referanse. Brukes på /kvittering og /bekreftelse.
 * Data kommer fra `orders.get().invoice` + `payment.pspReference`.
 */

export default function InvoiceSummaryBlock({
  invoice,
  pspReference,
  compact = false,
}: {
  invoice: Invoice;
  pspReference?: string | null;
  /** Kortere variant (bekreftelsessiden). */
  compact?: boolean;
}) {
  const t = useT();
  const cur = invoice.currency;
  // vatRate er brøk (0.25) fra api/lib/invoices.ts; tåler også prosent (25) defensivt.
  const rate = (r: number) => {
    const pct = r > 1 ? r : r * 100;
    return `${Number.isInteger(pct) ? pct : pct.toFixed(1)} %`;
  };
  return (
    <div className={compact ? "" : "border-t border-border pt-4"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className={compact ? "text-sm font-bold" : "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"}>
          {t("rc.title", { n: String(invoice.invoiceNumber) })}
        </h3>
        <p className="text-xs text-muted-foreground">{t("rc.issued", { date: formatDateLong(invoice.issuedAt) })}</p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[420px] text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th scope="col" className="py-1.5 pr-2 font-semibold">
                {t("rc.desc")}
              </th>
              <th scope="col" className="py-1.5 pr-2 text-right font-semibold">
                {t("rc.vatrate")}
              </th>
              <th scope="col" className="py-1.5 pr-2 text-right font-semibold">
                {t("rc.vat")}
              </th>
              <th scope="col" className="py-1.5 text-right font-semibold">
                {t("rc.amount")}
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l, i) => (
              <tr key={`${l.description}-${i}`} className="border-b border-border/60">
                <td className="py-2 pr-2">{l.description}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{rate(l.vatRate)}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{formatMinor(l.vatMinor, cur)}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{formatMinor(l.amountMinor, cur)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-muted-foreground">
              <td colSpan={3} className="pt-2 text-right">
                {t("rc.vatsummary")}
              </td>
              <td className="pt-2 text-right tabular-nums">{formatMinor(invoice.vatMinor, cur)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="pt-1 text-right font-bold">
                {t("common.total")}
              </td>
              <td className="pt-1 text-right font-display text-lg font-bold tabular-nums">{formatMinor(invoice.totalMinor, cur)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {pspReference && (
        <p className="mt-2 text-[12px] text-muted-foreground">
          {t("rc.psp")}: <span className="font-mono">{pspReference}</span>
        </p>
      )}
    </div>
  );
}
