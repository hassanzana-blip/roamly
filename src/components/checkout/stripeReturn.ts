/** Leser tilbake-parametrene Stripe legger på `return_url` etter ekstern 3DS/Klarna. */
export function readStripeReturn(search: string): { clientSecret: string; redirectStatus: string | null } | null {
  const p = new URLSearchParams(search);
  const cs = p.get("payment_intent_client_secret");
  if (!cs) return null;
  return { clientSecret: cs, redirectStatus: p.get("redirect_status") };
}
