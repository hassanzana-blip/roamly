import { deserialize, serialize } from "superjson";
import type { Airport } from "@contracts/airports";
import type { CabinClass, SearchPassengerInput, SearchSliceInput } from "@contracts/types";
import type { MobileSearchResult } from "@contracts/mobileSearch";
import type { HotelDetailResult, HotelPlace, HotelSearchResult, HotelsStatus } from "@contracts/hotels";
import type { CustomerProfile, MobileAuthProviders, MobileAuthResult, MobileSocialAuthResult, MobileDeleteAccountInput, MobileLocale, MobileOkResult, MobileUpdateProfileInput } from "@contracts/mobileAuth";

/**
 * Klient for appens API (/api/mobile/trpc).
 *
 * Snakker tRPC over vanlig HTTP (én prosedyre per kall, superjson som
 * serveren), uten serverens kode eller typer utover de delte kontraktene.
 * Filen har ingen React Native-avhengigheter, så den samme koden testes både
 * i appen og mot den ekte serveren (api/test/mobileClient.it.ts).
 *
 * Tokenet sendes bare på kall som trenger kunden (auth: true). Flysøk er
 * anonymt og sendes aldri med token.
 */

export const MOBILE_TRPC_PATH = "/api/mobile/trpc";

export type SearchRequest = {
  slices: SearchSliceInput[];
  passengers: SearchPassengerInput[];
  cabinClass: CabinClass;
  directOnly?: boolean;
  /** Anonym UUID per app-økt (KAYAKs userTrackId). Aldri knyttet til konto. */
  sessionId?: string;
};

/** Hotellsøk: valuta velges ikke – serveren ber alltid om NOK. */
export type HotelSearchRequest = {
  destination: string;
  checkin: string;
  checkout: string;
  rooms: { adults: number; childAges?: number[] }[];
  language: "nb" | "en";
  sessionId?: string;
};

export type HotelDetailRequest = Omit<HotelSearchRequest, "destination"> & { hotelKey: string };

export type RegisterRequest = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  /** Kontoens språk (e-poster fra HelloSky); appens valgte språk, aldri hardkodet. */
  locale: "en" | "nb";
};

/**
 * Feil fra serveren eller nettet. `code` er det stabile som oversettes i
 * appen (errorText.ts); `message` er serverens norske kundetekst når serveren
 * sendte en, ellers en intern engelsk beskrivelse som aldri vises.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    /** Serverens stabile appCode (VALIDATION, UNAUTHORIZED, RATE_LIMITED …) eller NETWORK/TIMEOUT/BAD_RESPONSE. */
    public readonly code: string,
    public readonly status: number,
    public readonly retryable: boolean,
    /** Feltet feilen gjelder, når serveren oppga det. */
    public readonly field?: string,
    /** Serverens maskinlesbare grunn (f.eks. «reauth_required»), når den ble oppgitt. */
    public readonly reason?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Koder appen setter selv (ingen servermelding å vise). */
export const CLIENT_ERROR_CODES = ["NETWORK", "TIMEOUT", "BAD_RESPONSE", "CANCELLED"] as const;

const NETWORK_MESSAGE = "network error";
const TIMEOUT_MESSAGE = "request timed out";
const GENERIC_MESSAGE = "unexpected response";

type ClientOptions = {
  baseUrl: string;
  /** Leser kundens token (fra minnet, lastet fra SecureStore). */
  getToken: () => string | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/** `signal`: brukeren kan avbryte (f.eks. et tregt søk); gir ApiError med kode CANCELLED. */
type CallOptions = { auth?: boolean; timeoutMs?: number; signal?: AbortSignal };

type ErrorEnvelope = {
  error?: {
    json?: { message?: unknown; data?: { appCode?: unknown; retryable?: unknown; httpStatus?: unknown; details?: { field?: unknown; reason?: unknown } } };
  };
};

function toApiError(status: number, body: unknown): ApiError {
  const json = (body as ErrorEnvelope | null)?.error?.json;
  const data = json?.data;
  const code = typeof data?.appCode === "string" ? data.appCode : status >= 500 ? "INTERNAL" : "BAD_RESPONSE";
  const message = typeof json?.message === "string" && json.message.trim() && code !== "INTERNAL" ? json.message : GENERIC_MESSAGE;
  const field = typeof data?.details?.field === "string" ? data.details.field : undefined;
  const reason = typeof data?.details?.reason === "string" ? data.details.reason : undefined;
  return new ApiError(message, code, status, data?.retryable === true, field, reason);
}

export function createApiClient({ baseUrl, getToken, fetchImpl = fetch, timeoutMs = 15_000 }: ClientOptions) {
  const root = baseUrl.replace(/\/+$/, "") + MOBILE_TRPC_PATH;

  async function call<T>(kind: "query" | "mutation", path: string, input: unknown, opts: CallOptions = {}): Promise<T> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (opts.auth) {
      const token = getToken();
      if (token) headers.authorization = `Bearer ${token}`;
    }
    let url = `${root}/${path}`;
    const init: RequestInit = { method: kind === "query" ? "GET" : "POST", headers };
    const serialized = input === undefined ? undefined : serialize(input);
    if (kind === "query") {
      if (serialized) url += `?input=${encodeURIComponent(JSON.stringify(serialized))}`;
    } else {
      headers["content-type"] = "application/json";
      init.body = serialized ? JSON.stringify(serialized) : "{}";
    }

    // Tidsfristen og brukerens avbrudd gjelder hele kallet – også mens svaret
    // leses. Et svar som stopper opp etter headerne skal ikke henge i evig tid.
    const controller = new AbortController();
    let cancelled = false;
    const onCancel = () => {
      cancelled = true;
      controller.abort();
    };
    if (opts.signal?.aborted) throw new ApiError("cancelled", "CANCELLED", 0, true);
    opts.signal?.addEventListener("abort", onCancel);
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? timeoutMs);
    // Avvises når kallet avbrytes, selv om fetch eller body-lesingen ikke selv reagerer på signalet.
    const abortRace = new Promise<never>((_, reject) => {
      controller.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
    abortRace.catch(() => undefined);
    let res: Response | null = null;
    let text: string;
    try {
      res = await Promise.race([fetchImpl(url, { ...init, signal: controller.signal }), abortRace]);
      text = await Promise.race([res.text(), abortRace]);
    } catch {
      if (cancelled) throw new ApiError("cancelled", "CANCELLED", 0, true);
      if (controller.signal.aborted) throw new ApiError(TIMEOUT_MESSAGE, "TIMEOUT", 0, true);
      // Ingen svar, eller forbindelsen brøt mens svaret ble lest.
      throw new ApiError(NETWORK_MESSAGE, "NETWORK", res?.status ?? 0, true);
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onCancel);
    }

    // Tekst + JSON.parse i stedet for res.json(): objektene lages da alltid i
    // appens eget JS-miljø, som superjson forutsetter.
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    if (!res.ok) throw toApiError(res.status, body);
    const data = (body as { result?: { data?: unknown } } | null)?.result?.data;
    if (data === undefined || data === null || typeof data !== "object") throw new ApiError(GENERIC_MESSAGE, "BAD_RESPONSE", res.status, true);
    return deserialize(data as Parameters<typeof deserialize>[0]) as T;
  }

  return {
    airports: (query: string, limit = 10) => call<Airport[]>("query", "flights.airports", { query, limit }),
    /** KAYAK kan bruke opptil ~22 s; gi søket god tid. */
    search: (input: SearchRequest, signal?: AbortSignal) => call<MobileSearchResult>("mutation", "flights.search", input, { timeoutMs: 45_000, signal }),
    login: (email: string, password: string) => call<MobileAuthResult>("mutation", "mobileAuth.login", { identifier: email.trim(), password }),
    register: (r: RegisterRequest) =>
      call<MobileAuthResult>("mutation", "mobileAuth.register", { identifier: r.email.trim(), password: r.password, firstName: r.firstName.trim(), lastName: r.lastName.trim(), locale: r.locale }),
    /** Hvilke innloggingsmåter appen kan vise (offentlig; uten token). */
    authProviders: () => call<MobileAuthProviders>("query", "mobileAuth.providers", undefined, { timeoutMs: 10_000 }),
    /** Et verifisert Clerk-sesjonstoken fra appens native innlogging → HelloSky-sesjon. Clerk-tokenet lagres aldri. */
    exchangeSocialToken: (token: string, locale: MobileLocale) => call<MobileSocialAuthResult>("mutation", "mobileAuth.exchangeSocialToken", { token, locale }),
    me: () => call<CustomerProfile | null>("query", "mobileAuth.me", undefined, { auth: true }),
    /** Alltid samme nøytrale svar – sier ingenting om kontoen finnes. Lenken fullføres på nettet. */
    requestPasswordReset: (identifier: string, locale: MobileLocale) => call<MobileOkResult>("mutation", "mobileAuth.requestPasswordReset", { identifier: identifier.trim(), locale }),
    updateProfile: (input: MobileUpdateProfileInput) => call<CustomerProfile>("mutation", "mobileAuth.updateProfile", input, { auth: true }),
    /** Bekreftes med passordet (eller «DELETE»/«SLETT» for kontoer uten passord). */
    deleteAccount: (input: MobileDeleteAccountInput) => call<MobileOkResult>("mutation", "mobileAuth.deleteAccount", input, { auth: true }),
    logout: () => call<{ ok: true }>("mutation", "mobileAuth.logout", undefined, { auth: true }),
    hotelsStatus: () => call<HotelsStatus>("query", "hotels.status", undefined, { timeoutMs: 10_000 }),
    hotelPlaces: (query: string) => call<HotelPlace[]>("query", "hotels.places", { query }),
    /** KAYAK Hotels kan bruke opptil ~20 s. */
    hotelSearch: (input: HotelSearchRequest, signal?: AbortSignal) => call<HotelSearchResult>("query", "hotels.search", input, { timeoutMs: 45_000, signal }),
    hotelDetail: (input: HotelDetailRequest, signal?: AbortSignal) => call<HotelDetailResult>("query", "hotels.detail", input, { timeoutMs: 45_000, signal }),
    /**
     * Nettets klikkmåling (flights.trackProviderClick) før kunden sendes til
     * leverandøren: bare tilbuds-id og den anonyme søkeøkten, uten token.
     */
    trackProviderClick: (offerId: string, sessionId?: string) =>
      call<{ clickRef: string | null }>("mutation", "flights.trackProviderClick", { offerId, ...(sessionId ? { sessionId } : {}) }, { timeoutMs: 8_000 }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
