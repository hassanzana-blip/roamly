import type { MobileOfferPrice, MobileSearchResult, NokUnavailableReason } from "@contracts/mobileSearch";
import { formatNok, formatNumericDate } from "./format";

/**
 * Hvordan en pris vises. Appen viser BARE kronebeløp:
 *  - exact: leverandørens egen kronepris, uten «ca.».
 *  - converted: «ca. X kr» + Norges Banks kursdato. Leverandørens beløp og
 *    valutakurs i annen valuta vises aldri – de finnes bare i serverkontrakten
 *    og hos leverandøren.
 *  - unavailable: «Ingen pris i kroner» + grunnen, uten noe beløp.
 */
export type PriceDisplay = {
  /** Hovedlinjen: «1 234 kr», «ca. 1 234 kr» eller «Ingen pris i kroner». */
  primary: string;
  /** Tilleggslinje (kilde eller grunn), eller null. */
  secondary: string | null;
  approx: boolean;
  available: boolean;
  /** Setning for skjermleser. */
  accessibilityLabel: string;
};

const REASONS: Record<NokUnavailableReason, string> = {
  rate_unavailable: "Valutakursen er ikke tilgjengelig akkurat nå",
  rate_stale: "Valutakursen er for gammel til å brukes",
  unsupported_currency: "Vi har ingen kurs for valutaen leverandøren priser i",
  invalid_amount: "Leverandøren oppga et beløp vi ikke kan regne med",
};

/** Skjermleser: «1 234 kr» leses som «1234 kroner». */
function spokenNok(amountMinor: number): string {
  return formatNok(amountMinor).replace(/ kr$/, " kroner");
}

export function priceDisplay(price: MobileOfferPrice): PriceDisplay {
  const nok = price.nok;
  if (nok.kind === "exact") {
    return { primary: formatNok(nok.amountMinor), secondary: null, approx: false, available: true, accessibilityLabel: `Pris ${spokenNok(nok.amountMinor)}` };
  }
  if (nok.kind === "converted") {
    const date = formatNumericDate(nok.rate.rateDate);
    return {
      primary: `ca. ${formatNok(nok.amountMinor)}`,
      secondary: `Omregnet med Norges Banks kurs ${date}`,
      approx: true,
      available: true,
      accessibilityLabel: `Omtrent ${spokenNok(nok.amountMinor)}, omregnet med Norges Banks kurs ${date}`,
    };
  }
  const reason = REASONS[nok.reason];
  return { primary: "Ingen pris i kroner", secondary: reason, approx: false, available: false, accessibilityLabel: `Ingen pris i kroner. ${reason}` };
}

/** Merknaden som alltid står ved en omregnet pris (resultatliste og tilbud). */
export const CONVERTED_NOTICE =
  "Leverandøren kan ta betalt i en annen valuta enn norske kroner. Kronebeløpet er et anslag med Norges Banks veiledende midtkurs, og endelig beløp kan avvike.";

/**
 * Servicegebyret i kroner når det er priset i kroner; ellers null (da sier
 * appen bare at prisen inkluderer gebyret – aldri et beløp i annen valuta).
 */
export function serviceFeeNokMinor(price: MobileOfferPrice): number | null {
  const fee = price.serviceFee;
  if (!fee || fee.currency.trim().toUpperCase() !== "NOK") return null;
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(fee.amount.trim());
  if (!m) return null;
  const minor = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Meldingen over resultatlisten om valuta. null når alt er i kroner. */
export function fxNotice(result: Pick<MobileSearchResult, "fx">): { tone: "info" | "warning"; text: string } | null {
  const { status, rateDate, unconvertedCount } = result.fx;
  const dated = rateDate ? ` ${formatNumericDate(rateDate)}` : "";
  const converted = `Priser merket «ca.» er omregnet til kroner med Norges Banks midtkurs${dated}. Leverandøren kan ta betalt i en annen valuta, og endelig beløp kan avvike.`;
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
      return { tone: "warning", text: "Valutakursene er for gamle til å brukes. Tilbud priset i annen valuta vises uten pris, nederst i listen." };
    case "unavailable":
    default:
      return { tone: "warning", text: "Tilbud priset i annen valuta kunne ikke regnes om til kroner akkurat nå. De vises uten pris, nederst i listen." };
  }
}
