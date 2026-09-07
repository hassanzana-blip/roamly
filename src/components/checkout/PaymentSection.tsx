import type { ReactNode } from "react";
import { klarnaAvailable, type CheckoutPaymentMethod } from "./paymentMethods";
import { CreditCard, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT, type I18nKey } from "@/lib/i18n";

/**
 * Betalingsmåte (kort eller Klarna) + ærlig forklaring av hva som skjer med
 * pengene. Selve kortfeltet (Stripe PaymentElement) rendres av forelderen
 * via `children` når checkout-økten er opprettet. Backend godtar "card" | "klarna".
 */

const METHODS: { id: CheckoutPaymentMethod; label: I18nKey | null; sub: I18nKey; logo?: string }[] = [
  { id: "card", label: "pay.card", sub: "pay.card.sub" },
  { id: "klarna", label: null, sub: "pay.klarna.sub", logo: "/brand/klarna.jpg" },
];

export default function PaymentSection({
  step,
  value,
  onChange,
  currency,
  locked,
  children,
}: {
  step: number;
  value: CheckoutPaymentMethod;
  onChange: (m: CheckoutPaymentMethod) => void;
  currency: string;
  /** Betalingsøkt er opprettet — metoden kan ikke byttes uten ny økt. */
  locked?: boolean;
  children?: ReactNode;
}) {
  const t = useT();
  const methods = METHODS.filter((m) => m.id !== "klarna" || klarnaAvailable(currency));
  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-6" aria-labelledby="betaling-heading">
      <h2 id="betaling-heading" className="mb-1 flex items-center gap-2.5 font-display text-2xl">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">
          {step}
        </span>
        {t("co.step.payment")}
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">{t("pay.sub")}</p>

      <div role="radiogroup" aria-label={t("pay.method")} className="space-y-2">
        {methods.map((m) => {
          const active = value === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={locked && !active}
              onClick={() => onChange(m.id)}
              className={cn(
                "flex min-h-[44px] w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition-colors disabled:opacity-50",
                active ? "border-foreground/40 bg-muted" : "border-border hover:border-foreground/20",
              )}
            >
              <span className={cn("grid h-11 w-14 shrink-0 place-items-center overflow-hidden rounded-lg", m.logo ? "bg-white" : "bg-secondary")}>
                {m.logo ? (
                  <img src={m.logo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <CreditCard className="h-5 w-5 text-foreground" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{m.label ? t(m.label) : "Klarna"}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{t(m.sub)}</span>
              </span>
              <span
                className={cn("h-4 w-4 shrink-0 rounded-full border-2 transition-colors", active ? "border-night bg-night" : "border-border")}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>

      {children && <div className="mt-5">{children}</div>}

      <div className="mt-4 flex items-start gap-3 rounded-2xl bg-secondary/60 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-foreground" aria-hidden="true" />
        <div className="text-sm leading-relaxed">
          <p className="font-semibold text-foreground">{t("pay.how")}</p>
          <p className="mt-1 text-muted-foreground">{t("pay.how.1")}</p>
          <p className="mt-1 text-muted-foreground">{t("pay.how.2")}</p>
        </div>
      </div>
    </section>
  );
}
