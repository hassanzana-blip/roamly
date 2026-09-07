import { useMemo, useState, type ReactNode } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Appearance, type Stripe } from "@stripe/stripe-js";
import { Loader2, Lock } from "lucide-react";

/**
 * Felles Stripe-betalingsflyt for checkout og tilbudslenker.
 * - Kortdata går rett til Stripe (PaymentElement) — aldri via vår server.
 * - `redirect: "if_required"`: 3DS håndteres i modal når mulig; ellers
 *   sendes kunden til `returnUrl` med `payment_intent_client_secret` i URL,
 *   og siden som eier flyten gjenopptar polling derfra.
 */

const stripeCache = new Map<string, Promise<Stripe | null>>();
function stripePromiseFor(publishableKey: string): Promise<Stripe | null> {
  let p = stripeCache.get(publishableKey);
  if (!p) {
    p = loadStripe(publishableKey);
    stripeCache.set(publishableKey, p);
  }
  return p;
}

const BRAND_APPEARANCE: Appearance = {
  theme: "stripe",
  labels: "floating",
  variables: {
    colorPrimary: "#5F7A05",
    colorText: "#131316",
    colorDanger: "#d0433b",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "10px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { borderColor: "rgba(15,27,45,0.16)", boxShadow: "none" },
    ".Input:focus": { borderColor: "#5F7A05", boxShadow: "0 0 0 2px rgba(205,245,39,0.45)" },
  },
};

export type StripeFlowProps = {
  publishableKey: string;
  clientSecret: string;
  /** Hvor Stripe sender kunden tilbake etter en ekstern 3DS/Klarna-side. */
  returnUrl: string;
  /** Tekst på betal-knappen, f.eks. «Betal 1 234 kr». */
  payLabel: string;
  disabled?: boolean;
  /** Kalles når betalingen er autorisert uten redirect. */
  onSucceeded: () => void | Promise<void>;
  onError?: (message: string) => void;
  /** Ekstra innhold under knappen (vilkår etc.). */
  children?: ReactNode;
};

function PayForm({ returnUrl, payLabel, disabled, onSucceeded, onError, children }: Omit<StripeFlowProps, "publishableKey" | "clientSecret">) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const pay = async () => {
    if (!stripe || !elements || pending) return;
    setPending(true);
    setLocalError(null);
    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        const msg = submitError.message ?? "Sjekk betalingsopplysningene og prøv igjen.";
        setLocalError(msg);
        onError?.(msg);
        return;
      }
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        confirmParams: { return_url: returnUrl },
      });
      if (error) {
        const msg =
          error.type === "card_error" || error.type === "validation_error"
            ? error.message ?? "Betalingen ble avvist. Prøv et annet kort."
            : "Betalingen kunne ikke fullføres akkurat nå. Prøv igjen om et øyeblikk.";
        setLocalError(msg);
        onError?.(msg);
        return;
      }
      if (paymentIntent && (paymentIntent.status === "requires_capture" || paymentIntent.status === "succeeded" || paymentIntent.status === "processing")) {
        await onSucceeded();
        return;
      }
      const msg = "Betalingen er ikke bekreftet ennå. Prøv igjen.";
      setLocalError(msg);
      onError?.(msg);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <PaymentElement
        onReady={() => setReady(true)}
        options={{ layout: "tabs", terms: { card: "never", klarna: "auto" } }}
      />
      {localError && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {localError}
        </p>
      )}
      {children}
      <button
        type="button"
        onClick={pay}
        disabled={disabled || pending || !ready || !stripe}
        aria-busy={pending}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 text-base font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-[hsl(var(--primary)/0.9)] active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Behandler betaling …
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" aria-hidden="true" /> {payLabel}
          </>
        )}
      </button>
    </div>
  );
}

export default function StripePaymentFlow(props: StripeFlowProps) {
  const { publishableKey, clientSecret, ...rest } = props;
  const stripePromise = useMemo(() => stripePromiseFor(publishableKey), [publishableKey]);
  const options = useMemo(() => ({ clientSecret, locale: "nb" as const, appearance: BRAND_APPEARANCE }), [clientSecret]);
  if (!publishableKey || !clientSecret) {
    return (
      <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        Betaling er ikke tilgjengelig akkurat nå. Kontakt oss, så hjelper vi deg.
      </p>
    );
  }
  return (
    <Elements key={clientSecret} stripe={stripePromise} options={options}>
      <PayForm {...rest} />
    </Elements>
  );
}
