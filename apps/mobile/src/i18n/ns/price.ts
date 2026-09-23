import type { NokUnavailableReason } from "@contracts/mobileSearch";

/** Hvordan priser og omregning forklares. Beløpet er alltid i kroner (NOK). */
const en = {
  approx: (amount: string) => `approx. ${amount}`,
  approxLabel: "approx.",
  convertedWith: (date: string) => `Converted at Norges Bank's rate of ${date}`,
  convertedShort: (date: string) => `Norges Bank rate ${date}`,
  spokenExact: (amount: string) => `Price ${amount}`,
  spokenApprox: (amount: string, date: string) => `Approximately ${amount}, converted at Norges Bank's rate of ${date}`,
  noNok: "No price in NOK",
  reasons: {
    rate_unavailable: "The exchange rate is not available right now",
    rate_stale: "The exchange rate is too old to use",
    unsupported_currency: "We have no rate for the provider's currency",
    invalid_amount: "The provider gave an amount we can't use",
  } satisfies Record<NokUnavailableReason, string>,
  convertedNotice:
    "The provider may charge in a currency other than Norwegian kroner. The NOK amount is an estimate using Norges Bank's indicative mid rate, and the final amount may differ.",
  fx: {
    shortConverted: (date: string | null) => `Prices marked "approx." are converted with Norges Bank's rate${date ? ` of ${date}` : ""} and may differ.`,
    converted: (date: string | null) =>
      `Prices marked "approx." are converted to NOK with Norges Bank's mid rate${date ? ` of ${date}` : ""}. The provider may charge in another currency, and the final amount may differ.`,
    missing: (n: number) => `${n === 1 ? "One offer" : `${n} offers`} could not be converted to NOK and ${n === 1 ? "is" : "are"} listed last.`,
    stale: "The exchange rates are too old to use. Offers priced in another currency are shown without a price, at the end of the list.",
    unavailable: "Offers priced in another currency could not be converted to NOK right now. They are shown without a price, at the end of the list.",
  },
  serviceFee: (amount: string) => `Includes HelloSky's service fee: ${amount}`,
  serviceFeeIncluded: "The price includes HelloSky's service fee.",
};

const nb: typeof en = {
  approx: (amount) => `ca. ${amount}`,
  approxLabel: "ca.",
  convertedWith: (date) => `Omregnet med Norges Banks kurs ${date}`,
  convertedShort: (date) => `Norges Banks kurs ${date}`,
  spokenExact: (amount) => `Pris ${amount}`,
  spokenApprox: (amount, date) => `Omtrent ${amount}, omregnet med Norges Banks kurs ${date}`,
  noNok: "Ingen pris i kroner",
  reasons: {
    rate_unavailable: "Valutakursen er ikke tilgjengelig akkurat nå",
    rate_stale: "Valutakursen er for gammel til å brukes",
    unsupported_currency: "Vi har ingen kurs for valutaen leverandøren priser i",
    invalid_amount: "Leverandøren oppga et beløp vi ikke kan regne med",
  },
  convertedNotice:
    "Leverandøren kan ta betalt i en annen valuta enn norske kroner. Kronebeløpet er et anslag med Norges Banks veiledende midtkurs, og endelig beløp kan avvike.",
  fx: {
    shortConverted: (date) => `Priser merket «ca.» er omregnet med Norges Banks kurs${date ? ` ${date}` : ""} og kan avvike.`,
    converted: (date) =>
      `Priser merket «ca.» er omregnet til kroner med Norges Banks midtkurs${date ? ` ${date}` : ""}. Leverandøren kan ta betalt i en annen valuta, og endelig beløp kan avvike.`,
    missing: (n) => `${n === 1 ? "Ett tilbud" : `${n} tilbud`} kunne ikke regnes om til kroner og står nederst.`,
    stale: "Valutakursene er for gamle til å brukes. Tilbud priset i annen valuta vises uten pris, nederst i listen.",
    unavailable: "Tilbud priset i annen valuta kunne ikke regnes om til kroner akkurat nå. De vises uten pris, nederst i listen.",
  },
  serviceFee: (amount) => `Herav HelloSkys servicegebyr: ${amount}`,
  serviceFeeIncluded: "Prisen inkluderer HelloSkys servicegebyr.",
};

export const price = { en, nb };
