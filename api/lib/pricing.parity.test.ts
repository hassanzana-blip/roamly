import { describe, expect, it } from "vitest";
import { computeServiceFeeMinor } from "./pricing";
import { previewServiceFeeMinor, previewTotalMinor } from "../../src/lib/format";
import { DEFAULT_FEE_CONFIG } from "../../src/lib/format";

/**
 * Prisen kunden ser i søkeresultatet og prisen serveren låser i kassen må være
 * det samme tallet. De regnes ut to steder – klienten viser et estimat før
 * økten finnes – og to implementasjoner av samme regel er en invitasjon til at
 * de sklir fra hverandre på avrunding. Denne testen holder dem sammen.
 */
describe("servicegebyr: klientens estimat mot serverens fasit", () => {
  const currencies = ["NOK", "SEK", "DKK", "EUR", "GBP", "USD"];

  it("gir nøyaktig samme beløp for hele beløpsspennet", () => {
    for (const currency of currencies) {
      for (const supplierMinor of [0, 1, 99, 100, 12_345, 99_999, 456_700, 1_000_000, 9_999_999]) {
        expect(previewServiceFeeMinor(supplierMinor, currency, DEFAULT_FEE_CONFIG)).toBe(computeServiceFeeMinor(supplierMinor, currency));
      }
    }
  });

  it("ukjent valuta faller tilbake på samme sats begge steder", () => {
    expect(previewServiceFeeMinor(500_000, "JPY", DEFAULT_FEE_CONFIG)).toBe(computeServiceFeeMinor(500_000, "JPY"));
  });

  it("totalen er leverandørprisen pluss gebyret, uten skjult påslag", () => {
    const supplier = 456_700;
    expect(previewTotalMinor("4567.00", "NOK", DEFAULT_FEE_CONFIG)).toBe(supplier + computeServiceFeeMinor(supplier, "NOK"));
  });
});
