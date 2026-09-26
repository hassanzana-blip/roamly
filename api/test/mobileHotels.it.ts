import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/stripe", () => import("./stripeMock"));
// KAYAK-hotelladapteren byttes ut, så testen styrer om hotellsøk er på og ser nøyaktig hva som sendes videre.
// Validering, rategrenser og rutene selv er ekte.
const state = vi.hoisted(() => ({ enabled: true }));
vi.mock("../lib/kayakHotels", async (importOriginal) => {
  const real = await importOriginal<typeof import("../lib/kayakHotels")>();
  return {
    ...real,
    kayakHotelsConfig: {
      get enabled() {
        return state.enabled;
      },
      get sandbox() {
        return true;
      },
    },
    kayakHotelSearch: vi.fn(),
    kayakHotelDetail: vi.fn(),
    kayakHotelPlaces: vi.fn(),
  };
});

import { expectAppCode, makeCtx, TOMORROW_PLUS } from "./setup";
import { createCallerFactory } from "../middleware";
import { appRouter } from "../router";
import { mobileAppRouter } from "../mobileRouter";
import { mobileHotelsRouter } from "../mobileHotels";
import { kayakHotelDetail, kayakHotelPlaces, kayakHotelSearch } from "../lib/kayakHotels";
import type { HotelDetailResult, HotelSearchResult } from "../../contracts/hotels";
import app from "../boot";
// Appens egen klient (apps/mobile) – samme kode som kjører på telefonen.
import { createApiClient } from "../../apps/mobile/src/lib/api";

const web = createCallerFactory(appRouter);
const mobile = createCallerFactory(mobileAppRouter);

function mobileCtx(ip?: string) {
  const ctx = makeCtx({ url: "http://localhost:3000/api/mobile/trpc/hotels.search", ip });
  ctx.req.headers.delete("origin");
  return ctx;
}

const CHECKIN = TOMORROW_PLUS(30);
const CHECKOUT = TOMORROW_PLUS(33);
const SEARCH = { destination: "kplace:58075", checkin: CHECKIN, checkout: CHECKOUT, rooms: [{ adults: 2 }] };

const RESULT: HotelSearchResult = {
  provider: "kayak",
  sandbox: true,
  complete: true,
  destination: { key: "kplace:58075", name: "London" },
  checkin: CHECKIN,
  checkout: CHECKOUT,
  nights: 3,
  rooms: "2",
  currency: "NOK",
  totalResults: 0,
  results: [],
  priceRange: null,
} as unknown as HotelSearchResult;

beforeEach(() => {
  state.enabled = true;
  vi.mocked(kayakHotelSearch).mockReset().mockResolvedValue(RESULT);
  vi.mocked(kayakHotelDetail).mockReset().mockResolvedValue({ provider: "kayak", sandbox: true, complete: true } as unknown as HotelDetailResult);
  vi.mocked(kayakHotelPlaces).mockReset().mockResolvedValue([{ key: "kplace:58075", name: "London" }]);
});

describe("appens hotellsøk (/api/mobile/trpc hotels.*)", () => {
  it("har bare status, stedsøk, søk og detaljer", () => {
    expect(Object.keys(mobileHotelsRouter._def.record).sort()).toEqual(["detail", "places", "search", "status"]);
  });

  it("status speiler om hotellsøk er slått på, og bestilling er alltid hos leverandøren", async () => {
    expect(await mobile(mobileCtx()).hotels.status()).toMatchObject({ enabled: true, externalBooking: true });
    state.enabled = false;
    expect(await mobile(mobileCtx()).hotels.status()).toMatchObject({ enabled: false, externalBooking: true });
  });

  it("søk ber alltid KAYAK om NOK – valuta fra appen ignoreres – og sender norsk/engelsk språk videre", async () => {
    const m = mobile(mobileCtx());
    const res = await m.hotels.search({ ...SEARCH, language: "nb", currency: "USD" } as typeof SEARCH & { language: "nb" });
    expect(res).toBe(RESULT);
    const [input, ctx] = vi.mocked(kayakHotelSearch).mock.calls[0]!;
    expect(input).toMatchObject({ destination: "kplace:58075", checkin: CHECKIN, checkout: CHECKOUT, rooms: [{ adults: 2 }], currency: "NOK", language: "nb" });
    expect(ctx).toMatchObject({ userAgent: "vitest-integration" });

    await m.hotels.detail({ hotelKey: "khotel:2589314", checkin: CHECKIN, checkout: CHECKOUT, rooms: [{ adults: 1, childAges: [4] }], language: "en" });
    expect(vi.mocked(kayakHotelDetail).mock.calls[0]![0]).toMatchObject({ hotelKey: "khotel:2589314", currency: "NOK", language: "en", rooms: [{ adults: 1, childAges: [4] }] });
  });

  it("nettets hotellsøk er uendret: nettet velger fortsatt valuta selv", async () => {
    await web(makeCtx()).hotels.search({ ...SEARCH, currency: "EUR", language: "de" });
    expect(vi.mocked(kayakHotelSearch).mock.calls[0]![0]).toMatchObject({ currency: "EUR", language: "de" });
  });

  it("samme validering som nettet: datoer, rom, gjester, reisemål og språk", async () => {
    const m = mobile(mobileCtx());
    await expectAppCode(m.hotels.search({ ...SEARCH, checkin: TOMORROW_PLUS(-3), checkout: TOMORROW_PLUS(-1) }), "VALIDATION");
    await expectAppCode(m.hotels.search({ ...SEARCH, checkout: CHECKIN }), "VALIDATION");
    await expectAppCode(m.hotels.search({ ...SEARCH, checkout: TOMORROW_PLUS(62) }), "VALIDATION");
    await expectAppCode(m.hotels.search({ ...SEARCH, rooms: [] }), "VALIDATION");
    await expectAppCode(m.hotels.search({ ...SEARCH, rooms: [1, 2, 3, 4, 5].map(() => ({ adults: 1 })) }), "VALIDATION");
    await expectAppCode(m.hotels.search({ ...SEARCH, rooms: [{ adults: 9 }] }), "VALIDATION");
    await expectAppCode(m.hotels.search({ ...SEARCH, rooms: [{ adults: 1, childAges: [18] }] }), "VALIDATION");
    await expectAppCode(m.hotels.search({ ...SEARCH, destination: "Oslo" }), "VALIDATION");
    await expectAppCode(m.hotels.search({ ...SEARCH, language: "de" as "nb" }), "VALIDATION");
    await expectAppCode(m.hotels.detail({ hotelKey: "kplace:1", checkin: CHECKIN, checkout: CHECKOUT, rooms: [{ adults: 1 }] }), "VALIDATION");
    await expectAppCode(m.hotels.places({ query: "O" }), "VALIDATION");
    expect(kayakHotelSearch).not.toHaveBeenCalled();
    expect(kayakHotelDetail).not.toHaveBeenCalled();
  });

  it("avslått hotellsøk gir ingen reservedata: søk og detaljer avvises, stedsøk er tomt", async () => {
    state.enabled = false;
    vi.mocked(kayakHotelPlaces).mockResolvedValue([]);
    // Adapteren selv avviser når den er avslått (api/lib/kayakHotels.ts); her er den byttet ut, så det gjør vi likt.
    const { KayakError } = await import("../lib/kayak");
    vi.mocked(kayakHotelSearch).mockRejectedValue(new KayakError("Hotellsøk er ikke slått på."));
    const m = mobile(mobileCtx());
    await expectAppCode(m.hotels.search(SEARCH), "SUPPLIER_REJECTED");
    expect(await m.hotels.places({ query: "Oslo" })).toEqual([]);
  });

  it("rategrensen for søk deles med nettet (samme klient-IP)", async () => {
    const ip = "10.201.7.9";
    for (let i = 0; i < 10; i++) await web(makeCtx({ ip })).hotels.search(SEARCH);
    for (let i = 0; i < 10; i++) await mobile(mobileCtx(ip)).hotels.search(SEARCH);
    await expectAppCode(mobile(mobileCtx(ip)).hotels.search(SEARCH), "RATE_LIMITED");
    expect(kayakHotelSearch).toHaveBeenCalledTimes(20);
  });

  it("appens egen klient: søk og detaljer over HTTP (GET, superjson), alltid NOK", async () => {
    const fetchImpl = ((url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      headers.set("x-forwarded-for", "10.201.9.1");
      return app.request(url, { ...init, headers });
    }) as unknown as typeof fetch;
    const c = createApiClient({ baseUrl: "http://localhost:3000", getToken: () => "ikke-sendt", fetchImpl });
    expect(await c.hotelsStatus()).toMatchObject({ enabled: true });
    expect(await c.hotelPlaces("Lon")).toEqual([{ key: "kplace:58075", name: "London" }]);
    expect(await c.hotelSearch({ ...SEARCH, rooms: [{ adults: 2, childAges: [5] }], language: "en", sessionId: "11111111-2222-4333-8444-555555555555" })).toEqual(RESULT);
    expect(vi.mocked(kayakHotelSearch).mock.calls[0]![0]).toMatchObject({ currency: "NOK", language: "en", rooms: [{ adults: 2, childAges: [5] }] });
    expect(vi.mocked(kayakHotelSearch).mock.calls[0]![1]).toMatchObject({ userTrackId: "11111111-2222-4333-8444-555555555555" });
    await c.hotelDetail({ hotelKey: "khotel:2589314", checkin: CHECKIN, checkout: CHECKOUT, rooms: [{ adults: 2 }], language: "nb" });
    expect(vi.mocked(kayakHotelDetail).mock.calls[0]![0]).toMatchObject({ currency: "NOK", language: "nb" });
  });

  it("over HTTP: GET /api/mobile/trpc/hotels.status svarer uten innlogging; nettets admin-ruter finnes ikke der", async () => {
    const res = await app.request("/api/mobile/trpc/hotels.status", { headers: { "x-forwarded-for": "10.201.8.1" } });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { result: { data: { json: { enabled: boolean; externalBooking: boolean } } } };
    expect(json.result.data.json).toMatchObject({ enabled: true, externalBooking: true });
    const admin = await app.request("/api/mobile/trpc/admin.hotels", { headers: { "x-forwarded-for": "10.201.8.2" } });
    expect(admin.status).toBe(404);
  });
});
