import { deserialize, serialize } from "superjson";
import type { Airport } from "@contracts/airports";
import type { CabinClass, SearchPassengerInput, SearchSliceInput } from "@contracts/types";
import type { MobileSearchResult } from "@contracts/mobileSearch";
import type { CustomerProfile, MobileAuthResult } from "@contracts/mobileAuth";

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

export type RegisterRequest = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

/** Feil fra serveren eller nettet, med en melding som kan vises på norsk. */
export class ApiError extends Error {
  constructor(
    message: string,
    /** Serverens stabile appCode (VALIDATION, UNAUTHORIZED, RATE_LIMITED …) eller NETWORK/TIMEOUT/BAD_RESPONSE. */
    public readonly code: string,
    public readonly status: number,
    public readonly retryable: boolean,
    /** Feltet feilen gjelder, når serveren oppga det. */
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const NETWORK_MESSAGE = "Fikk ikke kontakt med HelloSky. Sjekk nettforbindelsen og prøv igjen.";
const TIMEOUT_MESSAGE = "Det tok for lang tid å få svar. Prøv igjen.";
const GENERIC_MESSAGE = "Noe gikk galt hos oss. Prøv igjen om litt.";

type ClientOptions = {
  baseUrl: string;
  /** Leser kundens token (fra minnet, lastet fra SecureStore). */
  getToken: () => string | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type CallOptions = { auth?: boolean; timeoutMs?: number };

type ErrorEnvelope = {
  error?: {
    json?: { message?: unknown; data?: { appCode?: unknown; retryable?: unknown; httpStatus?: unknown; details?: { field?: unknown } } };
  };
};

function toApiError(status: number, body: unknown): ApiError {
  const json = (body as ErrorEnvelope | null)?.error?.json;
  const data = json?.data;
  const code = typeof data?.appCode === "string" ? data.appCode : status >= 500 ? "INTERNAL" : "BAD_RESPONSE";
  const message = typeof json?.message === "string" && json.message.trim() && code !== "INTERNAL" ? json.message : GENERIC_MESSAGE;
  const field = typeof data?.details?.field === "string" ? data.details.field : undefined;
  return new ApiError(message, code, status, data?.retryable === true, field);
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

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl(url, { ...init, signal: controller.signal });
    } catch {
      if (controller.signal.aborted) throw new ApiError(TIMEOUT_MESSAGE, "TIMEOUT", 0, true);
      throw new ApiError(NETWORK_MESSAGE, "NETWORK", 0, true);
    } finally {
      clearTimeout(timer);
    }

    // Tekst + JSON.parse i stedet for res.json(): objektene lages da alltid i
    // appens eget JS-miljø, som superjson forutsetter.
    let body: unknown = null;
    try {
      body = JSON.parse(await res.text());
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
    search: (input: SearchRequest) => call<MobileSearchResult>("mutation", "flights.search", input, { timeoutMs: 45_000 }),
    login: (email: string, password: string) => call<MobileAuthResult>("mutation", "mobileAuth.login", { identifier: email.trim(), password }),
    register: (r: RegisterRequest) =>
      call<MobileAuthResult>("mutation", "mobileAuth.register", { identifier: r.email.trim(), password: r.password, firstName: r.firstName.trim(), lastName: r.lastName.trim(), locale: "nb" }),
    me: () => call<CustomerProfile | null>("query", "mobileAuth.me", undefined, { auth: true }),
    logout: () => call<{ ok: true }>("mutation", "mobileAuth.logout", undefined, { auth: true }),
    /**
     * Nettets klikkmåling (flights.trackProviderClick) før kunden sendes til
     * leverandøren: bare tilbuds-id og den anonyme søkeøkten, uten token.
     */
    trackProviderClick: (offerId: string, sessionId?: string) =>
      call<{ clickRef: string | null }>("mutation", "flights.trackProviderClick", { offerId, ...(sessionId ? { sessionId } : {}) }, { timeoutMs: 8_000 }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
