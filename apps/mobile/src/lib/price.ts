import type { MobileOfferPrice, MobileSearchResult, NokRateInfo, NokUnavailableReason } from "@contracts/mobileSearch";
import { formatForeign, formatNok, formatNumericDate } from "./format";

/**
 * Hvordan en pris vises. Reglene fra serverkontrakten, i én funksjon:
 *  - exact: leverandørens egen kronepris, uten «ca.».
 *  - converted: alltid «ca.», med beløpet det er regnet om fra og Norges Banks kursdato.
 *  - unavailable: ingen kronepris i det hele tatt. Leverandørens beløp vises
 *    bare med sin egen valutakode, aldri med «kr».
 */
export type PriceDisplay = {
  /** Hovedlinjen: «1 234 kr», «ca. 1 234 kr» eller «Ingen pris i kroner». */
  primary: string;
  /** Tilleggslinje (kilde, originalbeløp eller grunn), eller null. */
  secondary: string | null;
  approx: boolean;
  available: boolean;
  /** Setning for skjermleser. */
  accessibilityLabel: string;
};

const REASONS: Record<NokUnavailableReason, (currency: string) => string> = {
  rate_unavailable: () => "Valutakursen er ikke tilgjengelig akkurat nå",
  rate_stale: () => "Valutakursen er for gammel til å brukes",
  unsupported_currency: (cur) => `Vi har ingen kurs for ${cur}`,
  invalid_amount: () => "Leverandøren oppga et beløp vi ikke kan regne med",
};

export function priceDisplay(price: MobileOfferPrice): PriceDisplay {
  const nok = price.nok;
  if (nok.kind === "exact") {
    const primary = formatNok(nok.amountMinor);
    return { primary, secondary: null, approx: false, available: true, accessibilityLabel: `Pris ${primary}` };
  }
  if (nok.kind === "converted") {
    const primary = `ca. ${formatNok(nok.amountMinor)}`;
    const from = formatForeign(price.total.amount, price.total.currency);
    const secondary = `Omregnet fra ${from} · Norges Bank ${formatNumericDate(nok.rate.rateDate)}`;
    return {
      primary,
      secondary,
      approx: true,
      available: true,
      accessibilityLabel: `Omtrent ${formatNok(nok.amountMinor)}, omregnet fra ${from} med Norges Banks kurs ${formatNumericDate(nok.rate.rateDate)}`,
    };
  }
  const reason = REASONS[nok.reason](price.total.currency.toUpperCase());
  const supplier = nok.reason === "invalid_amount" ? null : `Leverandørens pris: ${formatForeign(price.total.amount, price.total.currency)}`;
  const secondary = supplier ? `${reason}. ${supplier}` : reason;
  return { primary: "Ingen pris i kroner", secondary, approx: false, available: false, accessibilityLabel: `Ingen pris i kroner. ${secondary}` };
}

/** Meldingen over resultatlisten om valuta. null når alt er i kroner. */
export function fxNotice(result: Pick<MobileSearchResult, "fx">): { tone: "info" | "warning"; text: string } | null {
  const { status, rateDate, unconvertedCount } = result.fx;
  const dated = rateDate ? ` ${formatNumericDate(rateDate)}` : "";
  const converted = `Priser merket «ca.» er omregnet fra annen valuta med Norges Banks midtkurs${dated}. Leverandøren tar betalt i sin egen valuta, så endelig pris kan avvike litt.`;
  switch (status) {
    case "not_needed":
      return null;
    case "ok":
      return { tone: "info", text: converted };
    case "partial":
      return {
        tone: "warning",
        text: `${converted} ${unconvertedCount === 1 ? "Ett tilbud" : `${unconvertedCount} tilbud`} kunne ikke regnes om til kroner og står nederst.`,
      };
    case "stale":
      return { tone: "warning", text: "Valutakursene er for gamle til å brukes. Tilbud i annen valuta vises uten kronepris, nederst i listen." };
    case "unavailable":
    default:
      return { tone: "warning", text: "Tilbud i annen valuta kunne ikke regnes om til kroner akkurat nå. De vises uten kronepris, nederst i listen." };
  }
}

/** Kursen slik Norges Bank publiserte den: «1 EUR = 11,6420 kr», «100 SEK = 96,10 kr». */
export function rateDescription(rate: NokRateInfo): string {
  return `${rate.quotedPerUnits} ${rate.baseCurrency} = ${rate.publishedRate.replace(".", ",")} kr`;
}
