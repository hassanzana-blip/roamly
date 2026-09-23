import { baggageFacts, conditionFacts, handoffLabel, offerExpired, priceBasis, providerHandoff, sellerName, tripKind } from "../offer";
import { resolveApiBase } from "../config";
import { formatDay, formatDuration, formatStops, formatTime, stopsSummary } from "../format";
import { OSLO, formErrorText, initialForm, toSearchRequest, validateForm, type SearchForm } from "../searchForm";
import { i18nFor } from "../../i18n";
import { EUR_HS_OFFER, KAYAK_URL, NOK_OFFER, SAME_TRIP_OTHER_SELLER, SEK_OFFER, UNSAFE_LINK_OFFER } from "../../test/fixtures";

const NB = i18nFor("nb");
const EN = i18nFor("en");

describe("tilbudsfakta (ingen bestilling i appen)", () => {
  it("selgerens navn vises bare når leverandøren oppgir det", () => {
    expect(sellerName(SEK_OFFER.offer)).toBe("SAS");
    expect(sellerName(NOK_OFFER.offer)).toBe("Kiwi.com");
    expect(sellerName(EUR_HS_OFFER.offer)).toBeNull();
    expect(sellerName({ ...SEK_OFFER.offer, booking: { ...SEK_OFFER.offer.booking!, provider: { code: "X", name: "  " } } })).toBeNull();
  });

  it("videre til leverandøren: nøyaktig samme https-lenke, urørt; alt annet åpnes ikke", () => {
    const h = providerHandoff(SEK_OFFER.offer);
    expect(h).toMatchObject({ kind: "external", url: KAYAK_URL, providerName: "SAS", sellerKind: "airline", disclosure: "Billetten kan ikke refunderes." });
    if (h.kind !== "external") throw new Error();
    expect(handoffLabel(h, NB)).toBe("Se tilbud hos SAS");
    expect(providerHandoff(EUR_HS_OFFER.offer)).toEqual({ kind: "not_in_app" });
    expect(providerHandoff(UNSAFE_LINK_OFFER.offer)).toEqual({ kind: "invalid_link" });
    for (const url of ["javascript:alert(1)", "https://ok.example/a b", "https://ok.example/\u0000x", "HTTPS://", "ftp://x.example", "https://user@evil.example/"]) {
      expect(providerHandoff({ ...SEK_OFFER.offer, booking: { ...SEK_OFFER.offer.booking!, url } })).toEqual({ kind: "invalid_link" });
    }
  });

  it("vilkår bare fra `conditions`; «refundable: false» alene er ingen påstand", () => {
    expect(SEK_OFFER.offer.refundable).toBe(false);
    expect(conditionFacts(SEK_OFFER.offer, NB)).toEqual([]);
    expect(conditionFacts(SAME_TRIP_OTHER_SELLER.offer, NB)).toEqual([
      { key: "refund", label: "Refusjon før avreise", value: "Ikke tillatt", state: "not_allowed" },
      { key: "change", label: "Endring før avreise", value: "Tillatt ifølge tilbyderen", state: "allowed" },
    ]);
    // Et gebyr er aldri «bare tillatt». Beløpet vises ikke (kan være i annen valuta).
    const withFee = conditionFacts({ ...SEK_OFFER.offer, conditions: { changeBeforeDeparture: { allowed: true, penaltyAmount: "50.00", penaltyCurrency: "EUR", feeApplies: true } } }, NB);
    expect(withFee).toEqual([{ key: "change", label: "Endring før avreise", value: "Tillatt mot gebyr ifølge tilbyderen", state: "fee" }]);
    // KAYAK «fee»: gebyr uten oppgitt beløp.
    const kayakFee = conditionFacts({ ...SEK_OFFER.offer, conditions: { refundBeforeDeparture: { allowed: true, feeApplies: true } } }, EN);
    expect(kayakFee).toEqual([{ key: "refund", label: "Refund before departure", value: "Allowed for a fee, according to the provider", state: "fee" }]);
    // Uten gebyrflagg fra serveren: bare «tillatt».
    expect(conditionFacts({ ...SEK_OFFER.offer, conditions: { changeBeforeDeparture: { allowed: true } } }, EN)[0]!.state).toBe("allowed");
  });

  it("bagasje: «ikke oppgitt» er ikke «ikke inkludert»", () => {
    expect(baggageFacts(SEK_OFFER.offer, NB).map((f) => [f.key, f.state, f.value])).toEqual([
      ["carryOn", "included", "Inkludert"],
      ["checked", "unknown", "Ikke oppgitt"],
    ]);
    const none = { ...SEK_OFFER.offer, baggage: { carryOnBags: 0, checkedBags: 0 } };
    expect(baggageFacts(none, NB).map((f) => f.value)).toEqual(["Ikke inkludert", "Ikke inkludert"]);
  });

  it("prisen gjelder alle reisende og hele reisen", () => {
    expect(priceBasis(SEK_OFFER.offer, NB)).toBe("Totalt for 1 voksen · Tur-retur");
    const family = { ...SEK_OFFER.offer, passengers: [{ id: "a", type: "adult" as const }, { id: "b", type: "adult" as const }, { id: "c", type: "child" as const, age: 8 }, { id: "d", type: "infant_without_seat" as const, age: 1 }] };
    expect(priceBasis(family, NB)).toBe("Totalt for 2 voksne, 1 barn, 1 spedbarn · Tur-retur");
    expect(tripKind({ ...SEK_OFFER.offer, slices: SEK_OFFER.offer.slices.slice(0, 1) })).toBe("oneway");
    expect(priceBasis({ ...SEK_OFFER.offer, slices: SEK_OFFER.offer.slices.slice(0, 1) }, NB)).toBe("Totalt for 1 voksen · Én vei");
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
    expect(formErrorText(validateForm({ ...complete, destination: null }, "2026-09-23")!, NB)).toBe("Velg hvor du skal.");
    expect(formErrorText(validateForm({ ...complete, destination: OSLO }, "2026-09-23")!, NB)).toContain("samme flyplass");
    expect(formErrorText(validateForm({ ...complete, departDate: "2026-09-01" }, "2026-09-23")!, NB)).toContain("passert");
    expect(formErrorText(validateForm({ ...complete, returnDate: "2026-10-01" }, "2026-09-23")!, NB)).toContain("Hjemreisen");
    expect(formErrorText(validateForm({ ...complete, adults: 1, infantAges: [0, 1] }, "2026-09-23")!, NB)).toContain("spedbarn");
    expect(formErrorText(validateForm({ ...complete, adults: 5, childAges: [3, 4, 5, 6, 7] }, "2026-09-23")!, NB)).toContain("Maks 9");
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
    expect(formatDay("2026-10-23", "nb")).toBe("fre. 23. okt.");
    expect(formatTime("2026-10-23T07:05:00")).toBe("07:05");
    expect(formatDuration(275, "nb")).toBe("4 t 35 min");
    expect(formatDuration(45, "nb")).toBe("45 min");
    expect(formatStops(0, "nb")).toBe("Direkte");
    expect(formatStops(1, "nb")).toBe("1 mellomlanding");
    expect(formatStops(2, "nb")).toBe("2 mellomlandinger");
    // Hele reisen: «Opptil» bare når ut- og hjemreise har ulikt antall.
    expect(stopsSummary([{ stops: 0 }, { stops: 0 }], "nb")).toBe("Direkte");
    expect(stopsSummary([{ stops: 1 }], "nb")).toBe("1 mellomlanding");
    expect(stopsSummary([{ stops: 1 }, { stops: 1 }], "nb")).toBe("1 mellomlanding hver vei");
    expect(stopsSummary([{ stops: 0 }, { stops: 2 }], "nb")).toBe("Opptil 2 mellomlandinger");
  });
});

describe("på engelsk (standardspråket)", () => {
  it("tilbudsfakta, prisgrunnlag og videre-knapp", () => {
    const h = providerHandoff(SEK_OFFER.offer);
    if (h.kind !== "external") throw new Error();
    expect(handoffLabel(h, EN)).toBe("View offer at SAS");
    expect(priceBasis(SEK_OFFER.offer, EN)).toBe("Total for 1 adult · Return");
    const family = { ...SEK_OFFER.offer, passengers: [{ id: "a", type: "adult" as const }, { id: "b", type: "adult" as const }, { id: "c", type: "child" as const, age: 8 }, { id: "d", type: "infant_without_seat" as const, age: 1 }] };
    expect(priceBasis(family, EN)).toBe("Total for 2 adults, 1 child, 1 infant · Return");
    expect(priceBasis({ ...SEK_OFFER.offer, slices: SEK_OFFER.offer.slices.slice(0, 1) }, EN)).toBe("Total for 1 adult · One way");
    expect(baggageFacts(SEK_OFFER.offer, EN).map((f) => [f.label, f.value])).toEqual([
      ["Cabin bag", "Included"],
      ["Checked bag", "Not stated"],
    ]);
    expect(conditionFacts(SAME_TRIP_OTHER_SELLER.offer, EN).map((c) => [c.label, c.value])).toEqual([
      ["Refund before departure", "Not allowed"],
      ["Change before departure", "Allowed according to the provider"],
    ]);
  });

  it("skjemafeil, datoer, varighet og mellomlandinger", () => {
    const complete = { ...initialForm(new Date(2026, 8, 23)), destination: { iata: "BCN", name: "Barcelona", city: "Barcelona", country: "Spain" } };
    expect(formErrorText(validateForm({ ...complete, destination: null }, "2026-09-23")!, EN)).toBe("Choose where you are going.");
    expect(formErrorText(validateForm({ ...complete, adults: 5, childAges: [3, 4, 5, 6, 7] }, "2026-09-23")!, EN)).toBe("Up to 9 travellers per search.");
    expect(formatDay("2026-10-23", "en")).toBe("Fri 23 Oct");
    expect(formatDuration(275, "en")).toBe("4h 35m");
    expect(formatDuration(45, "en")).toBe("45m");
    expect(formatDuration(120, "en")).toBe("2h");
    expect([0, 1, 2].map((n) => formatStops(n, "en"))).toEqual(["Direct", "1 stop", "2 stops"]);
    expect(stopsSummary([{ stops: 1 }, { stops: 1 }], "en")).toBe("1 stop each way");
    expect(stopsSummary([{ stops: 0 }, { stops: 2 }], "en")).toBe("Up to 2 stops");
  });
});
