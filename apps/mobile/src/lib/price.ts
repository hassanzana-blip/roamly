import type { MobileOfferPrice, MobileSearchResult } from "@contracts/mobileSearch";
import type { I18n } from "../i18n";

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

export function priceDisplay(price: MobileOfferPrice, { t, f }: Pick<I18n, "t" | "f">): PriceDisplay {
  const nok = price.nok;
  if (nok.kind === "exact") {
    return { primary: f.nok(nok.amountMinor), secondary: null, approx: false, available: true, accessibilityLabel: t.price.spokenExact(f.spokenNok(nok.amountMinor)) };
  }
  if (nok.kind === "converted") {
    const date = f.numericDate(nok.rate.rateDate);
    return {
      primary: t.price.approx(f.nok(nok.amountMinor)),
      secondary: t.price.convertedWith(date),
      approx: true,
      available: true,
      accessibilityLabel: t.price.spokenApprox(f.spokenNok(nok.amountMinor), date),
    };
  }
  const reason = t.price.reasons[nok.reason];
  return { primary: t.price.noNok, secondary: reason, approx: false, available: false, accessibilityLabel: `${t.price.noNok}. ${reason}` };
}

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

/**
 * Meldingen over resultatlisten om valuta. null når alt er i kroner. `short`
 * er den korte linjen over listen; `text` er hele forklaringen.
 */
export function fxNotice(result: Pick<MobileSearchResult, "fx">, { t, f }: Pick<I18n, "t" | "f">): { tone: "info" | "warning"; short: string; text: string } | null {
  const { status, rateDate, unconvertedCount } = result.fx;
  const date = rateDate ? f.numericDate(rateDate) : null;
  switch (status) {
    case "not_needed":
      return null;
    case "ok":
      return { tone: "info", short: t.price.fx.shortConverted(date), text: t.price.fx.converted(date) };
    case "partial": {
      const missing = t.price.fx.missing(unconvertedCount);
      return { tone: "warning", short: `${t.price.fx.shortConverted(date)} ${missing}`, text: `${t.price.fx.converted(date)} ${missing}` };
    }
    case "stale":
      return { tone: "warning", short: t.price.fx.stale, text: t.price.fx.stale };
    case "unavailable":
    default:
      return { tone: "warning", short: t.price.fx.unavailable, text: t.price.fx.unavailable };
  }
}
