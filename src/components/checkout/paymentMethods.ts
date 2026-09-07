// Betalingsmåter backend godtar (checkout.createSession / quotesPublic.startPayment).
export type CheckoutPaymentMethod = "card" | "klarna";

const KLARNA_CURRENCIES = ["NOK", "SEK", "DKK", "EUR"];

export function klarnaAvailable(currency: string): boolean {
  return KLARNA_CURRENCIES.includes(currency.toUpperCase());
}
