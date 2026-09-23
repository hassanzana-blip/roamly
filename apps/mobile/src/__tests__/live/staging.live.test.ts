import { createApiClient } from "../../lib/api";
import { toSearchRequest, initialForm } from "../../lib/searchForm";
import { addDays, toIsoDate } from "../../lib/format";

/**
 * Appens egen API-klient mot en ekte, deployet server (staging) – ikke mot
 * testdata. Kjøres bare når HELLOSKY_LIVE_API_BASE er satt:
 *
 *   HELLOSKY_LIVE_API_BASE=https://roamly-staging.up.railway.app npx jest src/__tests__/live
 *
 * Bare lesende kall: ping, flyplassøk, ett flysøk og «hvem er jeg» uten token.
 * Ingen innlogging, ingen konto, ingen klikkmåling. Skriver aldri adressen i
 * koden (den kommer fra miljøet).
 */
const BASE = process.env.HELLOSKY_LIVE_API_BASE;
const live = BASE ? describe : describe.skip;

live(`live API (${BASE ?? "ikke satt"})`, () => {
  jest.setTimeout(60_000);
  const api = createApiClient({ baseUrl: BASE ?? "https://example.invalid", getToken: () => null, fetchImpl: fetch });

  it("flyplassøk: «osl» gir Oslo lufthavn (OSL)", async () => {
    const airports = await api.airports("osl", 5);
    expect(airports.map((a) => a.iata)).toContain("OSL");
  });

  it("uten token er ingen innlogget (me = null)", async () => {
    await expect(api.me()).resolves.toBeNull();
  });

  it("flysøk OSL → BCN om 30 dager: gyldig svar med kroneprisregler og ærlig kilde", async () => {
    const depart = addDays(toIsoDate(new Date()), 30);
    const form = { ...initialForm(), destination: { iata: "BCN", name: "Barcelona", city: "Barcelona", country: "Spain" }, departDate: depart, returnDate: addDays(depart, 7) };
    const result = await api.search(toSearchRequest(form));
    expect(Array.isArray(result.offers)).toBe(true);
    expect(["not_needed", "ok", "partial", "stale", "unavailable"]).toContain(result.fx.status);
    expect(typeof result.sandbox === "boolean" || result.sandbox === undefined).toBe(true);
    for (const o of result.offers) {
      expect(["exact", "converted", "unavailable"]).toContain(o.price.nok.kind);
      if (o.offer.booking?.kind === "external") expect(o.offer.booking.url).toMatch(/^https:\/\//);
    }
    // Skriv ut en kort oppsummering (ingen lenker, ingen persondata) til rapporten.
    process.stdout.write(`\nlive search: provider=${result.provider} sandbox=${result.sandbox} offers=${result.offers.length} fx=${result.fx.status}\n`);
  });
});
