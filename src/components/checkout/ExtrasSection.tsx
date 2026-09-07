import { Luggage, Minus, Plus } from "lucide-react";
import type { Offer } from "@contracts/types";
import { formatMinor, formatPrice, paxLabel, toMinor } from "@/lib/format";
import { useT } from "@/lib/i18n";

/**
 * Tilvalg — kun ekstra innsjekket bagasje (det eneste leverandøren faktisk
 * leverer). Pris per kolli kommer fra tilbudet (`offer.services.extraBagPrice`)
 * i tilbudets valuta. Endelig sum bekreftes av serveren i checkout-økten.
 */

interface Props {
  offer: Offer;
  step: number;
  /** passengerId → antall ekstra kolli (maks 3 per reisende) */
  bagsByPax: Record<string, number>;
  onBagsByPax: (v: Record<string, number>) => void;
  /** passengerId → fornavn, vises ved valgene */
  names?: Record<string, string>;
  disabled?: boolean;
}

const MAX_PER_PAX = 3;

export default function ExtrasSection({ offer, step, bagsByPax, onBagsByPax, names, disabled }: Props) {
  const t = useT();
  const svc = offer.services;
  const seatHolders = offer.passengers.filter((p) => p.type !== "infant_without_seat");
  const maxTotal = (svc?.maxExtraBags ?? 0) * seatHolders.length;
  const bagPriceMinor = svc?.extraBagPrice ? toMinor(svc.extraBagPrice, offer.totalCurrency) : 0;
  const totalBags = Object.values(bagsByPax).reduce((a, b) => a + b, 0);

  const setBags = (paxId: string, n: number) => {
    const next = { ...bagsByPax };
    if (n <= 0) delete next[paxId];
    else next[paxId] = Math.min(MAX_PER_PAX, n);
    onBagsByPax(next);
  };

  const available = Boolean(svc && svc.maxExtraBags > 0 && seatHolders.length > 0);

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6" aria-labelledby="tilvalg-heading">
      <h2 id="tilvalg-heading" className="mb-1 flex items-center gap-2.5 font-display text-2xl">
        <span className="grid size-7 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-accent-foreground" aria-hidden="true">
          {step}
        </span>
        {t("co.step.bags")}
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">
        {offer.baggage.checkedBags > 0 ? t("ex.included", { count: offer.baggage.checkedBags }) : t("ex.handonly")}
      </p>

      {!available ? (
        <p className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          {t("ex.unavailable")}
        </p>
      ) : (
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <div className="mb-3 flex items-center gap-3">
            <Luggage className="h-5 w-5 shrink-0 text-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">{t("ex.title")}</p>
              <p className="text-xs text-muted-foreground">
                {bagPriceMinor > 0 ? t("ex.perbag", { price: formatMinor(bagPriceMinor, offer.totalCurrency) }) : t("ex.priceatpay")}
                {` · ${t("ex.maxper", { count: svc!.maxExtraBags })}`}
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {seatHolders.map((p, i) => {
              const n = bagsByPax[p.id] ?? 0;
              const label = names?.[p.id] || `${paxLabel(p.type)} ${i + 1}`;
              const perPaxMax = Math.min(MAX_PER_PAX, svc!.maxExtraBags);
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-card px-3.5 py-2">
                  <span className="min-w-0 truncate text-sm font-medium">{label}</span>
                  <span className="flex shrink-0 items-center gap-2" role="group" aria-label={t("ex.group", { name: label })}>
                    <button
                      type="button"
                      onClick={() => setBags(p.id, n - 1)}
                      disabled={disabled || n === 0}
                      className="grid h-11 w-11 place-items-center rounded-full border border-border transition-colors hover:border-foreground/40 disabled:opacity-30"
                      aria-label={t("ex.fewer", { name: label })}
                    >
                      <Minus className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span className="w-5 text-center text-sm font-semibold tabular" aria-live="polite">{n}</span>
                    <button
                      type="button"
                      onClick={() => setBags(p.id, n + 1)}
                      disabled={disabled || n >= perPaxMax || totalBags >= maxTotal}
                      className="grid h-11 w-11 place-items-center rounded-full border border-border transition-colors hover:border-foreground/40 disabled:opacity-30"
                      aria-label={t("ex.more", { name: label })}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          {totalBags > 0 && (
            <p className="mt-3 text-right text-xs font-semibold text-muted-foreground">
              {t("common.bags", { count: totalBags })} ·{" "}
              {bagPriceMinor > 0 ? formatMinor(totalBags * bagPriceMinor, offer.totalCurrency) : formatPrice(0, offer.totalCurrency)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
