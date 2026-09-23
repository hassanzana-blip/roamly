import { createRouter, publicQuery } from "./middleware";
import type { TrpcContext } from "./context";
import { airportsProcedure, runFlightSearch, searchSchema } from "./flights";
import { toTRPCError } from "./lib/errors";
import { computeServiceFeeMinor, loadPricingOverrides, type PricingOverrides } from "./lib/pricing";
import { fromMinor, toMinor } from "./lib/money";
import { convertToNok, getNokRates, type FxTable } from "./lib/fxRates";
import type { Offer } from "../contracts/types";
import { NORGES_BANK_SOURCE, type MobileFxStatus, type MobileOffer, type MobileOfferPrice, type MobileSearchResult } from "../contracts/mobileSearch";

// ─── Appens flysøk: NOK-sammenligning ────────────────────────────────────────
// Samme søk som nettet (runFlightSearch: validering, rategrense, leverandørvalg,
// cache), men appen kan ikke velge valuta: metasøk (KAYAK) bes alltid om NOK,
// så vi får ekte NOK-priser der leverandøren kan gi dem. Tilbud i annen valuta
// får en separat, tydelig merket omregnet NOK-pris (Norges Bank), eller ingen.
// Leverandørens tilbud og beløp endres aldri.

/** Appen sender ikke valuta – den er alltid NOK. */
export const mobileSearchSchema = searchSchema.omit({ currency: true });

function offerPrice(offer: Offer, overrides: PricingOverrides, table: FxTable | null, now: Date): MobileOfferPrice {
  const currency = offer.totalCurrency.toUpperCase();
  const original = { amount: offer.totalAmount, currency: offer.totalCurrency };
  let supplierMinor: number;
  try {
    supplierMinor = toMinor(offer.totalAmount, currency);
  } catch {
    return { original, serviceFee: null, total: original, nok: { kind: "unavailable", reason: "invalid_amount" } };
  }
  // Samme regel som nettets resultatliste: servicegebyr kun når HelloSky selger billetten.
  const external = offer.booking?.kind === "external";
  try {
    if (supplierMinor < 0) throw new RangeError("negativt beløp");
    const feeMinor = external ? 0 : computeServiceFeeMinor(supplierMinor, currency, overrides);
    const totalMinor = supplierMinor + feeMinor;
    if (!Number.isSafeInteger(totalMinor)) throw new RangeError("beløpet er for stort");
    const serviceFee = external ? null : { amount: fromMinor(feeMinor, currency), currency: offer.totalCurrency };
    const total = { amount: fromMinor(totalMinor, currency), currency: offer.totalCurrency };
    return { original, serviceFee, total, nok: convertToNok(total.amount, currency, table, now) };
  } catch {
    // Et beløp vi ikke kan regne trygt med, velter ikke søket – tilbudet får bare ingen NOK-pris.
    return { original, serviceFee: null, total: original, nok: { kind: "unavailable", reason: "invalid_amount" } };
  }
}

/**
 * Samlet valutastatus for svaret. «ok» betyr at ALLE utenlandske tilbud fikk en
 * NOK-pris; er noen omregnet og noen ikke, er statusen «partial».
 */
export function fxStatusFor(offers: MobileOffer[], table: FxTable | null): { status: MobileFxStatus; unconvertedCount: number } {
  const foreign = offers.filter((o) => o.offer.totalCurrency.trim().toUpperCase() !== "NOK");
  const converted = foreign.filter((o) => o.price.nok.kind === "converted").length;
  const unconvertedCount = foreign.length - converted;
  if (foreign.length === 0) return { status: "not_needed", unconvertedCount: 0 };
  if (unconvertedCount === 0) return { status: "ok", unconvertedCount };
  if (converted > 0) return { status: "partial", unconvertedCount };
  const stale = table && foreign.some((o) => o.price.nok.kind === "unavailable" && o.price.nok.reason === "rate_stale");
  return { status: stale ? "stale" : "unavailable", unconvertedCount };
}

/** Sammenlignbare tilbud først, stigende NOK; like priser og ikke-sammenlignbare beholder leverandørens rekkefølge. */
export function sortByNok(offers: MobileOffer[]): MobileOffer[] {
  const indexed = offers.map((o, i) => ({ o, i }));
  indexed.sort((a, b) => {
    const an = a.o.price.nok.kind === "unavailable" ? null : a.o.price.nok.amountMinor;
    const bn = b.o.price.nok.kind === "unavailable" ? null : b.o.price.nok.amountMinor;
    if (an !== null && bn !== null && an !== bn) return an - bn;
    if (an === null && bn !== null) return 1;
    if (an !== null && bn === null) return -1;
    return a.i - b.i;
  });
  return indexed.map((x) => x.o);
}

export async function mobileFlightSearch(input: (typeof mobileSearchSchema)["_output"], ctx: TrpcContext, now: Date = new Date()): Promise<MobileSearchResult> {
  const result = await runFlightSearch({ ...input, currency: "NOK" }, ctx);
  const needsFx = result.offers.some((o) => o.totalCurrency.trim().toUpperCase() !== "NOK");
  const [overrides, table] = await Promise.all([loadPricingOverrides(), needsFx ? getNokRates(now) : Promise.resolve(null)]);

  const offers = sortByNok(
    result.offers.map((offer) => {
      const price = offerPrice(offer, overrides, table, now);
      return { offer, price, comparable: price.nok.kind !== "unavailable" };
    }),
  );

  const { status, unconvertedCount } = fxStatusFor(offers, table);
  const usedDates = offers.flatMap((o) => (o.price.nok.kind === "converted" ? [o.price.nok.rate.rateDate] : []));

  return {
    offerRequestId: result.offerRequestId,
    provider: result.provider,
    sandbox: result.sandbox,
    bookingMode: result.bookingMode,
    liveMode: result.liveMode,
    demoMode: result.demoMode,
    partial: result.partial,
    cabinClass: result.cabinClass,
    slices: result.slices,
    passengers: result.passengers,
    offers,
    fx: { status, unconvertedCount, source: NORGES_BANK_SOURCE, rateDate: usedDates.length ? usedDates.sort().at(-1)! : null, indicative: true },
  };
}

/**
 * Appens flights-ruter: flyplassøk og NOK-søket. Nettets flights.search (med
 * leverandørens valuta) finnes ikke her, så appen har ingen vei til et
 * utenlandsk beløp uten NOK-merking ved siden av.
 */
export const mobileFlightsRouter = createRouter({
  airports: airportsProcedure,
  search: publicQuery.input(mobileSearchSchema).mutation(async ({ input, ctx }): Promise<MobileSearchResult> => {
    try {
      return await mobileFlightSearch(input, ctx);
    } catch (err) {
      throw toTRPCError(err);
    }
  }),
});
