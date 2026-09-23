import { bookingHandoff, handoffLabel, offerExpired } from "../booking";
import { resolveApiBase } from "../config";
import { formatDay, formatDuration, formatStops, formatTime } from "../format";
import { OSLO, initialForm, toSearchRequest, validateForm, type SearchForm } from "../searchForm";
import { EUR_HS_OFFER, KAYAK_URL, NOK_OFFER, SEK_OFFER, UNSAFE_LINK_OFFER } from "../../test/fixtures";

describe("videresending til leverandøren", () => {
  it("eksterne tilbud: nøyaktig samme https-lenke, urørt", () => {
    const h = bookingHandoff(SEK_OFFER.offer);
    expect(h).toMatchObject({ kind: "external", providerName: "SAS", sellerKind: "airline" });
    if (h.kind !== "external") throw new Error();
    expect(h.url).toBe(KAYAK_URL);
    expect(handoffLabel(h)).toBe("Bestill hos SAS");
    const agency = bookingHandoff(NOK_OFFER.offer);
    if (agency.kind !== "external") throw new Error();
    expect(handoffLabel(agency)).toBe("Se tilbudet hos Kiwi.com");
  });

  it("tilbud HelloSky selger kan ikke bestilles i appen", () => {
    expect(bookingHandoff(EUR_HS_OFFER.offer)).toEqual({ kind: "not_in_app" });
  });

  it("utrygge lenker åpnes ikke", () => {
    expect(bookingHandoff(UNSAFE_LINK_OFFER.offer)).toEqual({ kind: "invalid_link" });
    for (const url of ["javascript:alert(1)", "https://ok.example/a b", "https://ok.example/\u0000x", "HTTPS://", "ftp://x.example", "https://user@evil.example/"]) {
      const offer = { ...SEK_OFFER.offer, booking: { ...SEK_OFFER.offer.booking!, url } };
      expect(bookingHandoff(offer)).toEqual({ kind: "invalid_link" });
    }
  });

  it("utløpte tilbud gjenkjennes", () => {
    expect(offerExpired({ ...SEK_OFFER.offer, expiresAt: "2020-01-01T00:00:00Z" })).toBe(true);
    expect(offerExpired(SEK_OFFER.offer)).toBe(false);
  });
});

describe("søkeskjemaet", () => {
  const today = new Date(2026, 8, 23);
  const complete: SearchForm = { ...initialForm(today), destination: { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spania" } };

  it("starter med Oslo, tur-retur om to uker, én voksen, økonomi", () => {
    const f = initialForm(today);
    expect(f).toMatchObject({ tripType: "roundtrip", origin: OSLO, destination: null, departDate: "2026-10-07", returnDate: "2026-10-14", adults: 1, cabinClass: "economy" });
  });

  it("tur-retur blir to strekninger; barn og spedbarn sendes med alder; ingen valuta", () => {
    const req = toSearchRequest({ ...complete, adults: 2, childAges: [4, 11], infantAges: [0], cabinClass: "business", directOnly: true }, "sess-1");
    expect(req).toEqual({
      slices: [
        { origin: "OSL", destination: "BCN", departureDate: "2026-10-07" },
        { origin: "BCN", destination: "OSL", departureDate: "2026-10-14" },
      ],
      passengers: [{ type: "adult" }, { type: "adult" }, { type: "child", age: 4 }, { type: "child", age: 11 }, { type: "infant_without_seat", age: 0 }],
      cabinClass: "business",
      directOnly: true,
      sessionId: "sess-1",
    });
    expect(toSearchRequest({ ...complete, tripType: "oneway" }).slices).toHaveLength(1);
  });

  it("validering på norsk", () => {
    expect(validateForm({ ...complete, destination: null }, "2026-09-23")).toBe("Velg hvor du skal.");
    expect(validateForm({ ...complete, destination: OSLO }, "2026-09-23")).toContain("samme flyplass");
    expect(validateForm({ ...complete, departDate: "2026-09-01" }, "2026-09-23")).toContain("passert");
    expect(validateForm({ ...complete, returnDate: "2026-10-01" }, "2026-09-23")).toContain("Hjemreisen");
    expect(validateForm({ ...complete, adults: 1, infantAges: [0, 1] }, "2026-09-23")).toContain("spedbarn");
    expect(validateForm({ ...complete, adults: 5, childAges: [3, 4, 5, 6, 7] }, "2026-09-23")).toContain("Maks 9");
    expect(validateForm(complete, "2026-09-23")).toBeNull();
  });
});

describe("serveradresse (EXPO_PUBLIC_API_BASE_URL)", () => {
  it("https kreves; http bare mot lokal server i utvikling", () => {
    expect(resolveApiBase("https://hellosky.test/", false)).toEqual({ ok: true, url: "https://hellosky.test" });
    expect(resolveApiBase("http://hellosky.test", false).ok).toBe(false);
    expect(resolveApiBase("http://localhost:3000", false).ok).toBe(false);
    expect(resolveApiBase("http://localhost:3000", true)).toEqual({ ok: true, url: "http://localhost:3000" });
    expect(resolveApiBase("https://hellosky.test/api?x=1", false).ok).toBe(false);
    expect(resolveApiBase(undefined, true).ok).toBe(false);
  });
});

describe("norske datoer og tider", () => {
  it("formaterer uten å stole på enhetens Intl", () => {
    expect(formatDay("2026-10-23")).toBe("fre. 23. okt.");
    expect(formatTime("2026-10-23T07:05:00")).toBe("07:05");
    expect(formatDuration(275)).toBe("4 t 35 min");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatStops(0)).toBe("Direkte");
    expect(formatStops(2)).toBe("2 stopp");
  });
});
