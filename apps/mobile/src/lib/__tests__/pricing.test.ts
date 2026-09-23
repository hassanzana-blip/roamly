import { fxNotice, priceDisplay, rateDescription } from "../price";
import { formatForeign, formatNok } from "../format";
import { EUR_HS_OFFER, NOK_OFFER, SEARCH_RESULT, SEK_OFFER, THB_OFFER } from "../../test/fixtures";
import type { MobileOfferPrice, NokUnavailableReason } from "@contracts/mobileSearch";

const NBSP = " ";

describe("kroneformatering", () => {
  it("heltall og øre, med norske skilletegn", () => {
    expect(formatNok(123400)).toBe(`1${NBSP}234${NBSP}kr`);
    expect(formatNok(210050)).toBe(`2${NBSP}100,50${NBSP}kr`);
    expect(formatNok(5)).toBe(`0,05${NBSP}kr`);
    expect(formatNok(1_234_567_800)).toBe(`12${NBSP}345${NBSP}678${NBSP}kr`);
  });

  it("utenlandske beløp får alltid valutakoden, aldri «kr»", () => {
    expect(formatForeign("1500.00", "sek")).toBe(`1${NBSP}500,00${NBSP}SEK`);
    expect(formatForeign("25000", "JPY")).toBe(`25${NBSP}000${NBSP}JPY`);
    expect(formatForeign("131.00", "EUR")).not.toMatch(/kr/);
  });
});

describe("prisvisning etter kontrakten", () => {
  it("ekte NOK: kronebeløpet, uten «ca.»", () => {
    const d = priceDisplay(NOK_OFFER.price);
    expect(d).toMatchObject({ primary: `2${NBSP}100,50${NBSP}kr`, secondary: null, approx: false, available: true });
  });

  it("omregnet: alltid «ca.», originalbeløp i sin valuta og Norges Banks dato", () => {
    const d = priceDisplay(EUR_HS_OFFER.price);
    expect(d.primary).toBe(`ca. 1${NBSP}525${NBSP}kr`);
    expect(d.secondary).toBe(`Omregnet fra 131,00${NBSP}EUR · Norges Bank 22.09.2026`);
    expect(d.approx).toBe(true);
    expect(d.accessibilityLabel).toContain("Omtrent");
  });

  it("kurs per 100 enheter beskrives slik Norges Bank publiserer den", () => {
    if (SEK_OFFER.price.nok.kind !== "converted") throw new Error("fixture");
    expect(rateDescription(SEK_OFFER.price.nok.rate)).toBe(`100 SEK = 96,10${NBSP}kr`);
    expect(priceDisplay(SEK_OFFER.price).primary).toBe(`ca. 1${NBSP}442${NBSP}kr`);
  });

  it("uten kronepris: ingen «kr» i hovedlinjen, og leverandørbeløpet bare med valutakode", () => {
    const reasons: NokUnavailableReason[] = ["unsupported_currency", "rate_unavailable", "rate_stale", "invalid_amount"];
    for (const reason of reasons) {
      const price: MobileOfferPrice = { ...THB_OFFER.price, nok: { kind: "unavailable", reason } };
      const d = priceDisplay(price);
      expect(d.primary).toBe("Ingen pris i kroner");
      expect(d.available).toBe(false);
      expect(d.secondary).not.toMatch(/\d\s?kr\b/);
      if (reason !== "invalid_amount") expect(d.secondary).toContain(`3${NBSP}000,00${NBSP}THB`);
      else expect(d.secondary).not.toContain("THB");
    }
    expect(priceDisplay(THB_OFFER.price).secondary).toContain("Vi har ingen kurs for THB");
  });

  it("invariant: et utenlandsk beløp vises aldri som kroner uten «ca.»", () => {
    for (const o of SEARCH_RESULT.offers) {
      const d = priceDisplay(o.price);
      const foreign = o.price.total.currency.toUpperCase() !== "NOK";
      if (foreign && /kr$/.test(d.primary)) expect(d.primary.startsWith("ca. ")).toBe(true);
      if (foreign) expect(d.primary).not.toContain(o.price.total.amount);
    }
  });
});

describe("melding om valuta over resultatlisten", () => {
  it("partial nevner hvor mange som ikke kunne regnes om", () => {
    const n = fxNotice(SEARCH_RESULT);
    expect(n?.tone).toBe("warning");
    expect(n?.text).toContain("Norges Banks midtkurs 22.09.2026");
    expect(n?.text).toContain("Ett tilbud kunne ikke regnes om til kroner og står nederst.");
    expect(fxNotice({ fx: { ...SEARCH_RESULT.fx, unconvertedCount: 3 } })?.text).toContain("3 tilbud kunne ikke");
  });

  it("ok, stale, unavailable og not_needed", () => {
    expect(fxNotice({ fx: { ...SEARCH_RESULT.fx, status: "ok", unconvertedCount: 0 } })).toMatchObject({ tone: "info" });
    expect(fxNotice({ fx: { ...SEARCH_RESULT.fx, status: "stale", rateDate: null } })?.text).toContain("for gamle");
    expect(fxNotice({ fx: { ...SEARCH_RESULT.fx, status: "unavailable", rateDate: null } })?.text).toContain("kunne ikke regnes om");
    expect(fxNotice({ fx: { ...SEARCH_RESULT.fx, status: "not_needed", unconvertedCount: 0, rateDate: null } })).toBeNull();
  });
});
