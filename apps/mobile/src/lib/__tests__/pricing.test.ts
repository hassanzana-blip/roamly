import fs from "node:fs";
import path from "node:path";
import { fxNotice, priceDisplay, serviceFeeNokMinor } from "../price";
import { i18nFor } from "../../i18n";
import { formatNok, minutesBetween } from "../format";
import { EUR_HS_OFFER, NOK_OFFER, SEARCH_RESULT, SEK_OFFER, THB_OFFER } from "../../test/fixtures";
import { foreignNumbers } from "../../test/foreignNumbers";
import type { MobileOfferPrice, NokUnavailableReason } from "@contracts/mobileSearch";

const NB = i18nFor("nb");
const EN = i18nFor("en");
const CONVERTED_NOTICE = NB.t.price.convertedNotice;

const NBSP = " ";

describe("kroneformatering", () => {
  it("heltall og øre, med norske skilletegn", () => {
    expect(formatNok(123400, "nb")).toBe(`1${NBSP}234${NBSP}kr`);
    expect(formatNok(210050, "nb")).toBe(`2${NBSP}100,50${NBSP}kr`);
    expect(formatNok(5, "nb")).toBe(`0,05${NBSP}kr`);
    expect(formatNok(1_234_567_800, "nb")).toBe(`12${NBSP}345${NBSP}678${NBSP}kr`);
  });

  it("det finnes ingen formaterer for andre valutaer", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(Object.keys(require("../format"))).not.toContain("formatForeign");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(Object.keys(require("../price"))).not.toContain("rateDescription");
  });
});

describe("prisvisning etter kontrakten", () => {
  it("ekte NOK: kronebeløpet, uten «ca.»", () => {
    const d = priceDisplay(NOK_OFFER.price, NB);
    expect(d).toMatchObject({ primary: `2${NBSP}100,50${NBSP}kr`, secondary: null, approx: false, available: true });
  });

  it("omregnet: «ca. X kr» og Norges Banks dato – verken utenlandsk beløp eller kurs", () => {
    const d = priceDisplay(EUR_HS_OFFER.price, NB);
    expect(d.primary).toBe(`ca. 1${NBSP}525${NBSP}kr`);
    expect(d.secondary).toBe("Omregnet med Norges Banks kurs 22.09.2026");
    expect(d.approx).toBe(true);
    expect(d.accessibilityLabel).toBe("Omtrent 1\u00A0525 kroner, omregnet med Norges Banks kurs 22.09.2026");
    // Kurs per 100 (SEK) påvirker bare kronebeløpet, som serveren har regnet ut.
    expect(priceDisplay(SEK_OFFER.price, NB).primary).toBe(`ca. 1${NBSP}442${NBSP}kr`);
  });

  it("uten kronepris: «Ingen pris i kroner» + grunn, uten noe beløp", () => {
    const reasons: NokUnavailableReason[] = ["unsupported_currency", "rate_unavailable", "rate_stale", "invalid_amount"];
    for (const reason of reasons) {
      const price: MobileOfferPrice = { ...THB_OFFER.price, nok: { kind: "unavailable", reason } };
      const d = priceDisplay(price, NB);
      expect(d.primary).toBe("Ingen pris i kroner");
      expect(d.available).toBe(false);
      for (const text of [d.primary, d.secondary ?? "", d.accessibilityLabel]) expect(text).not.toMatch(/\d/);
    }
  });

  it("invariant: ingen tekst for et utenlandsk tilbud inneholder leverandørens tall, kurs eller valutakode", () => {
    for (const o of SEARCH_RESULT.offers) {
      if (o.price.total.currency.toUpperCase() === "NOK") continue;
      const d = priceDisplay(o.price, NB);
      const all = [d.primary, d.secondary ?? "", d.accessibilityLabel].join(" | ");
      expect(all).not.toContain(o.price.total.currency.toUpperCase());
      for (const n of foreignNumbers(o)) expect(all).not.toContain(n);
      if (d.available) expect(d.primary.startsWith("ca. ")).toBe(true);
    }
  });

  it("servicegebyr vises som beløp bare når det er i kroner", () => {
    expect(serviceFeeNokMinor(EUR_HS_OFFER.price)).toBeNull();
    expect(serviceFeeNokMinor({ ...NOK_OFFER.price, serviceFee: { amount: "250.00", currency: "NOK" } })).toBe(25000);
    expect(serviceFeeNokMinor({ ...NOK_OFFER.price, serviceFee: null })).toBeNull();
  });

  it("merknaden ved omregnede priser sier at leverandøren kan ta betalt i annen valuta", () => {
    expect(CONVERTED_NOTICE).toMatch(/annen valuta/);
    expect(CONVERTED_NOTICE).toMatch(/endelig beløp kan avvike/);
    expect(CONVERTED_NOTICE).not.toMatch(/\d/);
  });
});

describe("melding om valuta over resultatlisten", () => {
  it("partial nevner hvor mange som ikke kunne regnes om", () => {
    const n = fxNotice(SEARCH_RESULT, NB);
    expect(n?.tone).toBe("warning");
    expect(n?.text).toContain("Norges Banks midtkurs 22.09.2026");
    expect(n?.text).toContain("Leverandøren kan ta betalt i en annen valuta, og endelig beløp kan avvike.");
    expect(n?.text).toContain("Ett tilbud kunne ikke regnes om til kroner og står nederst.");
    expect(fxNotice({ fx: { ...SEARCH_RESULT.fx, unconvertedCount: 3 } }, NB)?.text).toContain("3 tilbud kunne ikke");
    // Den korte linjen over listen sier fortsatt at beløpet kan avvike, og hvor mange som mangler.
    expect(n?.short).toBe("Priser merket «ca.» er omregnet med Norges Banks kurs 22.09.2026 og kan avvike. Ett tilbud kunne ikke regnes om til kroner og står nederst.");
  });

  it("ok, stale, unavailable og not_needed", () => {
    expect(fxNotice({ fx: { ...SEARCH_RESULT.fx, status: "ok", unconvertedCount: 0 } }, NB)).toMatchObject({ tone: "info" });
    expect(fxNotice({ fx: { ...SEARCH_RESULT.fx, status: "stale", rateDate: null } }, NB)?.text).toContain("for gamle");
    expect(fxNotice({ fx: { ...SEARCH_RESULT.fx, status: "unavailable", rateDate: null } }, NB)?.text).toContain("kunne ikke regnes om");
    expect(fxNotice({ fx: { ...SEARCH_RESULT.fx, status: "not_needed", unconvertedCount: 0, rateDate: null } }, NB)).toBeNull();
  });
});

describe("byttetid mellom fly", () => {
  it("regner eksakt med tidssone, også over sommertidsskifte", () => {
    // Natt til 25. okt. 2026: klokken stilles fra 03:00 CEST til 02:00 CET.
    // Å kutte bort tidssonene ville gitt 45 minutter; riktig svar er 105.
    expect(minutesBetween("2026-10-25T01:30:00+02:00", "2026-10-25T02:15:00+01:00")).toBe(105);
    expect(minutesBetween("2026-03-29T01:30:00+01:00", "2026-03-29T03:15:00+02:00")).toBe(45);
    expect(minutesBetween("2026-10-23T08:15:00Z", "2026-10-23T09:10:00Z")).toBe(55);
  });

  it("uten tidssone på begge: lokal klokkeforskjell på samme flyplass", () => {
    expect(minutesBetween("2026-10-23T08:15:00", "2026-10-23T10:10:00")).toBe(115);
    expect(minutesBetween("2026-10-23T08:15", "2026-10-23T10:10")).toBe(115);
  });

  it("blandet, ugyldig eller baklengs: ingen varighet", () => {
    expect(minutesBetween("2026-10-23T08:15:00+02:00", "2026-10-23T10:10:00")).toBeNull();
    expect(minutesBetween("tull", "2026-10-23T10:10:00")).toBeNull();
    expect(minutesBetween("2026-10-23T10:10:00Z", "2026-10-23T08:15:00Z")).toBeNull();
  });
});

describe("kildekoden viser aldri leverandørens beløp", () => {
  // Strukturell sperre: ingen appkode utenfor tester leser feltene med
  // utenlandske beløp eller kurser. Da kan de heller ikke havne i grensesnittet.
  const root = path.resolve(__dirname, "../..");
  const files = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e: fs.Dirent) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === "__tests__" || e.name === "test" ? [] : files(full);
      return /\.(ts|tsx)$/.test(e.name) ? [full] : [];
    });

  it("ingen bruk av totalAmount, totalCurrency, price.total, price.original, publishedRate eller baseCurrency", () => {
    const forbidden = /\b(totalAmount|totalCurrency|baseAmount|taxAmount|publishedRate|baseCurrency|quotedPerUnits|penaltyAmount|extraBagPrice|baggageFees)\b|price\.(total|original)\b/;
    // Ett unntak: hotellbeløpene leses bare i lib/hotels.ts, som gir dem ut som kroner (øre) eller null.
    const HOTEL_AMOUNTS = path.join("lib", "hotels.ts");
    const offenders = files(root).filter((f) => forbidden.test(fs.readFileSync(f, "utf8")) && path.relative(root, f) !== HOTEL_AMOUNTS);
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
    // … og der bare ett sted, rett inn i NOK-sjekken.
    const hotels = fs.readFileSync(path.join(root, HOTEL_AMOUNTS), "utf8");
    expect(hotels.match(/\btotalAmount\b/g)).toHaveLength(1);
    expect(hotels).toContain("return nokMinor(rate.totalAmount, rate.currency);");
  });
});

describe("på engelsk: samme kronebeløp, engelsk skrivemåte", () => {
  it("NOK forblir valutaen; bare ord og skilletegn følger språket", () => {
    expect(formatNok(123400, "en")).toBe(`NOK${NBSP}1,234`);
    expect(formatNok(210050, "en")).toBe(`NOK${NBSP}2,100.50`);
    const d = priceDisplay(SEK_OFFER.price, EN);
    expect(d.primary).toBe(`approx. NOK${NBSP}1,442`);
    expect(d.secondary).toBe("Converted at Norges Bank's rate of 22 Sep 2026");
    expect(d.accessibilityLabel).toBe("Approximately 1,442 Norwegian kroner, converted at Norges Bank's rate of 22 Sep 2026");
    expect(priceDisplay(THB_OFFER.price, EN).primary).toBe("No price in NOK");
    expect(fxNotice(SEARCH_RESULT, EN)?.short).toBe('Prices marked "approx." are converted with Norges Bank\'s rate of 22 Sep 2026 and may differ. One offer could not be converted to NOK and is listed last.');
  });

  it("aldri et beløp i annen valuta, heller ikke på engelsk", () => {
    for (const o of [SEK_OFFER, EUR_HS_OFFER, THB_OFFER]) {
      const d = priceDisplay(o.price, EN);
      const all = [d.primary, d.secondary ?? "", d.accessibilityLabel].join(" | ");
      expect(all).not.toContain(o.price.total.currency.toUpperCase());
      for (const n of foreignNumbers(o)) expect(all).not.toContain(n);
    }
  });
});
