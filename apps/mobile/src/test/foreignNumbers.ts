import type { MobileOfferPrice } from "@contracts/mobileSearch";

const NBSP = " ";

/**
 * Tallene fra leverandørens side av et tilbud (beløp, gebyr, publisert kurs),
 * i alle former de kunne ha blitt skrevet ut: «1500.00», «1500,00», «1 500»,
 * «1 500,00». Brukes til å bevise at ingen av dem finnes i grensesnittet.
 */
export function foreignNumbers(o: { price: MobileOfferPrice }): string[] {
  const out: string[] = [];
  const add = (raw: string) => {
    const [int, frac] = raw.split(".");
    const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
    out.push(raw, raw.replace(".", ","), grouped, frac ? `${grouped},${frac}` : grouped, int!, frac ? `${int},${frac}` : int!);
  };
  add(o.price.total.amount);
  add(o.price.original.amount);
  if (o.price.serviceFee) add(o.price.serviceFee.amount);
  if (o.price.nok.kind === "converted") out.push(o.price.nok.rate.publishedRate, o.price.nok.rate.publishedRate.replace(".", ","));
  return [...new Set(out)].filter((n) => n.length >= 3);
}
