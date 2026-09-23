import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/stripe", () => import("./stripeMock"));
vi.mock("../lib/flightProviders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/flightProviders")>()),
  getFlightProvider: vi.fn(),
}));

import { closeDb, TOMORROW_PLUS, truncateAll } from "./setup";
import app from "../boot";
import { getFlightProvider, type FlightProvider } from "../lib/flightProviders";
import { demoSearch } from "../lib/demo";
import { osloDate, resetFxCache, setFxFetcher } from "../lib/fxRates";
import { norgesBankFixture, TEST_RATES } from "./fxFixture";
import type { Offer, SearchResult } from "../../contracts/types";
// Appens egen klient (apps/mobile) – samme kode som kjører på telefonen.
import { ApiError, createApiClient } from "../../apps/mobile/src/lib/api";

// ─── Kontrakttest: iOS-appens klient mot den ekte serveren ───────────────────
// Kjører appens createApiClient mot Hono-appen over HTTP (ingen nettverk), så
// sti, metode, superjson, Bearer og svarformer bekreftes fra begge sider.

const INPUT = { slices: [{ origin: "OSL", destination: "BCN", departureDate: TOMORROW_PLUS(30) }], passengers: [{ type: "adult" as const }], cabinClass: "economy" as const };

function useProvider(offers: Offer[]) {
  const result: SearchResult = { offerRequestId: "orq_c", liveMode: false, demoMode: false, cabinClass: "economy", slices: INPUT.slices, passengers: INPUT.passengers, provider: "kayak", sandbox: true, bookingMode: "external", offers };
  const p: FlightProvider = { id: "kayak", liveMode: false, sandbox: true, bookingMode: "external", cacheable: false, search: async () => structuredClone(result) };
  vi.mocked(getFlightProvider).mockReturnValue(p);
}

let ipSeq = 0;
function client(getToken: () => string | null = () => null) {
  ipSeq += 1;
  const ip = `10.66.0.${ipSeq}`;
  const fetchImpl = ((url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.set("x-forwarded-for", ip);
    return app.request(url, { ...init, headers });
  }) as unknown as typeof fetch;
  return createApiClient({ baseUrl: "http://localhost:3000", getToken, fetchImpl });
}

const ext = (id: string, amount: string, currency: string): Offer => ({
  ...demoSearch(INPUT).offers[0],
  id,
  totalAmount: amount,
  totalCurrency: currency,
  source: "kayak",
  booking: { kind: "external", url: `https://www.kayak.no/book/${id}?q=1`, provider: { code: "SK", name: "SAS" }, sellerKind: "airline" },
});

describe("iOS-klienten mot /api/mobile/trpc", () => {
  beforeEach(async () => {
    await truncateAll();
    resetFxCache();
    setFxFetcher(async () => norgesBankFixture(TEST_RATES, osloDate(new Date())));
  });
  afterAll(async () => {
    setFxFetcher(null);
    await closeDb();
  });

  it("søk og flyplassøk: appens klient leser serverens svar", async () => {
    useProvider([ext("eur", "100.00", "EUR"), ext("nok", "900.00", "NOK"), ext("thb", "3000.00", "THB")]);
    const res = await client().search({ ...INPUT, sessionId: "11111111-2222-4333-8444-555555555555" });
    expect(res.offers.map((o) => o.offer.id)).toEqual(["nok", "eur", "thb"]);
    expect(res.offers[1]!.price.nok).toMatchObject({ kind: "converted", amountMinor: 116400, rate: { baseCurrency: "EUR", quotedPerUnits: 1 } });
    expect(res.offers[1]!.offer.booking?.url).toBe("https://www.kayak.no/book/eur?q=1");
    expect(res.fx).toMatchObject({ status: "partial", unconvertedCount: 1 });

    const airports = await client().airports("Barcelona", 5);
    expect(airports.some((a) => a.iata === "BCN")).toBe(true);
  });

  it("registrering, Bearer på me, utlogging som tilbakekaller", async () => {
    const reg = await client().register({ email: "app@hellosky.test", password: "kundepassord-2026", firstName: "App", lastName: "Kunde", locale: "nb" });
    expect(reg.session.tokenType).toBe("Bearer");
    expect(reg.profile).toMatchObject({ email: "app@hellosky.test", firstName: "App", locale: "nb" });

    let token: string | null = reg.session.token;
    const api = client(() => token);
    expect(await api.me()).toMatchObject({ email: "app@hellosky.test" });
    expect(await api.logout()).toEqual({ ok: true });
    expect(await api.me()).toBeNull();

    const login = await client().login("app@hellosky.test", "kundepassord-2026");
    token = login.session.token;
    expect(await api.me()).toMatchObject({ id: reg.profile.id });
  });

  it("feil kommer fram som ApiError med serverens kode og norske melding", async () => {
    const err = await client()
      .login("ingen@hellosky.test", "feil-passord-1")
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: "UNAUTHORIZED", status: 401, message: "Feil e-post/telefon eller passord." });

    const bad = await client()
      .search({ ...INPUT, slices: [{ origin: "OSL", destination: "OSL", departureDate: TOMORROW_PLUS(30) }] })
      .catch((e: unknown) => e);
    expect(bad).toMatchObject({ code: "VALIDATION", message: "Avreise og destinasjon kan ikke være samme flyplass." });
  });
});
