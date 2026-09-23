import { ApiError, createApiClient } from "../api";
import { fakeServer } from "../../test/fakeServer";
import { AUTH_RESULT, PROFILE, SEARCH_RESULT, TOKEN } from "../../test/fixtures";

const BASE = "https://api.hellosky.test";

describe("API-klienten mot /api/mobile/trpc", () => {
  it("flyplassøk er en GET med superjson-input, uten token", async () => {
    const server = fakeServer({ "flights.airports": () => ({ data: [{ iata: "BCN", name: "Barcelona", city: "Barcelona", country: "Spania", lat: 0, lng: 0 }] }) });
    const api = createApiClient({ baseUrl: `${BASE}/`, getToken: () => TOKEN, fetchImpl: server.fetchImpl });
    const res = await api.airports("barc", 5);
    expect(res[0]?.iata).toBe("BCN");
    const call = server.calls[0]!;
    expect(call.method).toBe("GET");
    expect(call.url.startsWith(`${BASE}/api/mobile/trpc/flights.airports?input=`)).toBe(true);
    expect(call.input).toEqual({ query: "barc", limit: 5 });
    expect(call.headers.authorization).toBeUndefined();
  });

  it("søket er en anonym POST: aldri Authorization, selv når kunden er innlogget", async () => {
    const server = fakeServer({ "flights.search": () => ({ data: SEARCH_RESULT }) });
    const api = createApiClient({ baseUrl: BASE, getToken: () => TOKEN, fetchImpl: server.fetchImpl });
    const req = { slices: [{ origin: "OSL", destination: "BCN", departureDate: "2026-10-23" }], passengers: [{ type: "adult" as const }], cabinClass: "economy" as const, sessionId: "11111111-2222-4333-8444-555555555555" };
    const res = await api.search(req);
    expect(res).toEqual(SEARCH_RESULT);
    const call = server.calls[0]!;
    expect(call.method).toBe("POST");
    expect(call.headers["content-type"]).toBe("application/json");
    expect(call.input).toEqual(req);
    expect(call.input).not.toHaveProperty("currency");
    expect(call.headers.authorization).toBeUndefined();
  });

  it("me og logout sender Bearer-tokenet; innlogging sender det aldri", async () => {
    const server = fakeServer({
      "mobileAuth.login": () => ({ data: AUTH_RESULT }),
      "mobileAuth.me": () => ({ data: PROFILE }),
      "mobileAuth.logout": () => ({ data: { ok: true } }),
    });
    let token: string | null = null;
    const api = createApiClient({ baseUrl: BASE, getToken: () => token, fetchImpl: server.fetchImpl });
    const login = await api.login("  kari@example.no ", "passord-123456");
    expect(login.session.token).toBe(TOKEN);
    expect(server.calls[0]!.input).toEqual({ identifier: "kari@example.no", password: "passord-123456" });
    expect(server.calls[0]!.headers.authorization).toBeUndefined();

    token = login.session.token;
    expect(await api.me()).toEqual(PROFILE);
    expect(server.calls[1]!.headers.authorization).toBe(`Bearer ${TOKEN}`);
    await api.logout();
    expect(server.calls[2]).toMatchObject({ method: "POST", path: "mobileAuth.logout", headers: { authorization: `Bearer ${TOKEN}` } });
  });

  it("registrering sender kundefelter og appens valgte språk (aldri hardkodet)", async () => {
    const server = fakeServer({ "mobileAuth.register": () => ({ data: AUTH_RESULT }) });
    const api = createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: server.fetchImpl });
    await api.register({ email: "kari@example.no", password: "passord-123456", firstName: " Kari ", lastName: "Nordmann", locale: "nb" });
    expect(server.calls[0]!.input).toEqual({ identifier: "kari@example.no", password: "passord-123456", firstName: "Kari", lastName: "Nordmann", locale: "nb" });
    await api.register({ email: "sam@example.com", password: "password-123456", firstName: "Sam", lastName: "Smith", locale: "en" });
    expect(server.calls[1]!.input).toMatchObject({ locale: "en" });
  });

  it("serverfeil blir ApiError med serverens norske melding, kode og felt", async () => {
    const server = fakeServer({
      "mobileAuth.login": () => ({ status: 401, error: { message: "Feil e-post/telefon eller passord.", appCode: "UNAUTHORIZED" } }),
      "mobileAuth.register": () => ({ status: 409, error: { message: "Det finnes allerede en konto med denne e-postadressen. Prøv å logge inn.", appCode: "CONFLICT", field: "identifier" } }),
    });
    const api = createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: server.fetchImpl });
    await expect(api.login("a@b.no", "x")).rejects.toMatchObject({ name: "ApiError", code: "UNAUTHORIZED", status: 401, message: "Feil e-post/telefon eller passord." });
    await expect(api.register({ email: "a@b.no", password: "x".repeat(12), firstName: "A", lastName: "B", locale: "nb" })).rejects.toMatchObject({ code: "CONFLICT", field: "identifier" });
  });

  it("interne feil vises aldri ordrett", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ error: { json: { message: "ER_DUP_ENTRY: stacktrace…", data: { httpStatus: 500 } } } }), { status: 500 })) as unknown as typeof fetch;
    const api = createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl });
    const err = await api.me().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("INTERNAL");
    expect((err as ApiError).message).not.toContain("ER_DUP");
  });

  it("nettverksfeil og tidsavbrudd gir egne koder", async () => {
    const offline = createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: (async () => Promise.reject(new TypeError("Network request failed"))) as unknown as typeof fetch });
    await expect(offline.airports("osl")).rejects.toMatchObject({ code: "NETWORK" });

    const hanging = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as unknown as typeof fetch;
    const slow = createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: hanging, timeoutMs: 20 });
    await expect(slow.airports("osl")).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("tidsfristen gjelder også mens svaret leses (headerne kom, kroppen stoppet opp)", async () => {
    const stalledBody = (async () => ({ ok: true, status: 200, text: () => new Promise<string>(() => undefined) })) as unknown as typeof fetch;
    const api = createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: stalledBody, timeoutMs: 20 });
    await expect(api.airports("osl")).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("fetch som ikke reagerer på signalet stoppes likevel av tidsfristen", async () => {
    const deaf = (() => new Promise(() => undefined)) as unknown as typeof fetch;
    const api = createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: deaf, timeoutMs: 20 });
    await expect(api.airports("osl")).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("brukerens avbrudd gjelder også mens svaret leses", async () => {
    let bodyStarted!: () => void;
    const started = new Promise<void>((r) => (bodyStarted = r));
    const stalledBody = (async () => ({
      ok: true,
      status: 200,
      text: () => {
        bodyStarted();
        return new Promise<string>(() => undefined);
      },
    })) as unknown as typeof fetch;
    const api = createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: stalledBody, timeoutMs: 60_000 });
    const abort = new AbortController();
    const pending = api.search({ slices: [{ origin: "OSL", destination: "BCN", departureDate: "2026-10-23" }], passengers: [{ type: "adult" }], cabinClass: "economy" }, abort.signal);
    await started;
    abort.abort();
    await expect(pending).rejects.toMatchObject({ code: "CANCELLED" });
  });

  it("brudd mens svaret leses er en nettverksfeil, ikke et ugyldig svar", async () => {
    const broken = (async () => ({ ok: true, status: 200, text: () => Promise.reject(new TypeError("connection reset")) })) as unknown as typeof fetch;
    const api = createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: broken });
    await expect(api.airports("osl")).rejects.toMatchObject({ code: "NETWORK", retryable: true });
  });

  it("superjson-typer (Date) kommer riktig tilbake", async () => {
    const when = new Date("2026-09-22T10:00:00Z");
    const server = fakeServer({ "mobileAuth.me": () => ({ data: { ...PROFILE, createdAt: when } }) });
    const api = createApiClient({ baseUrl: BASE, getToken: () => TOKEN, fetchImpl: server.fetchImpl });
    const me = (await api.me()) as unknown as { createdAt: Date };
    expect(me.createdAt).toBeInstanceOf(Date);
    expect(me.createdAt.toISOString()).toBe(when.toISOString());
  });
});
