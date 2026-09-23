import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as Crypto from "expo-crypto";
import type { CustomerProfile } from "@contracts/mobileAuth";
import type { MobileSearchResult } from "@contracts/mobileSearch";
import { ApiError, createApiClient, type ApiClient, type RegisterRequest } from "./api";
import { API_BASE } from "./config";
import { clearSession, loadSession, saveSession } from "./tokenStore";
import { initialForm, toSearchRequest, validateForm, type SearchForm } from "./searchForm";

// ─── Tjenester for hele appen: API-klient, kundesesjon og søk ───────────────

type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  /** profile er null når vi har en gyldig lagret sesjon, men ikke fikk hentet kontoen (f.eks. uten nett). */
  | { status: "signedIn"; profile: CustomerProfile | null };

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; result: MobileSearchResult }
  | { status: "error"; message: string };

type AppContextValue = {
  api: ApiClient;
  auth: AuthState;
  login: (email: string, password: string) => Promise<void>;
  register: (r: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  form: SearchForm;
  setForm: (update: (f: SearchForm) => SearchForm) => void;
  search: SearchState;
  /** Starter søket for skjemaet. Returnerer feilmelding hvis skjemaet ikke er gyldig. */
  runSearch: () => string | null;
};

const AppContext = createContext<AppContextValue | null>(null);

export type ApiFactory = (getToken: () => string | null) => ApiClient;

/** Tokenet i minnet. Et eget objekt (ikke React-state), så det aldri havner i render eller i devtools. */
function createTokenHolder() {
  let token: string | null = null;
  return {
    get: () => token,
    set: (t: string | null) => {
      token = t;
    },
  };
}

const defaultFactory: ApiFactory = (getToken) => {
  if (!API_BASE.ok) throw new Error(API_BASE.message);
  return createApiClient({ baseUrl: API_BASE.url, getToken });
};

export function AppProvider({ children, apiFactory = defaultFactory, initial }: { children: ReactNode; apiFactory?: ApiFactory; initial?: Partial<SearchForm> }) {
  // Tokenet ligger i minnet (for kall) og i nøkkelringen (mellom oppstarter). Ingen andre steder.
  const [tokens] = useState(createTokenHolder);
  const api = useMemo(() => apiFactory(tokens.get), [apiFactory, tokens]);
  // Anonym søke-økt per oppstart (KAYAK krever unik userTrackId per sluttbruker og økt).
  const [sessionId] = useState(() => Crypto.randomUUID());

  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [form, setFormState] = useState<SearchForm>(() => ({ ...initialForm(), ...initial }));
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const searchSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadSession();
      if (!stored) {
        if (!cancelled) setAuth({ status: "signedOut" });
        return;
      }
      tokens.set(stored.token);
      try {
        const me = await api.me();
        if (cancelled) return;
        if (me) {
          setAuth({ status: "signedIn", profile: me });
        } else {
          // Utløpt eller tilbakekalt på serveren (f.eks. «logg ut alle enheter»).
          tokens.set(null);
          await clearSession();
          setAuth({ status: "signedOut" });
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === "UNAUTHORIZED") {
          tokens.set(null);
          await clearSession();
          setAuth({ status: "signedOut" });
        } else {
          setAuth({ status: "signedIn", profile: null });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, tokens]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.login(email, password);
      await saveSession(res.session);
      tokens.set(res.session.token);
      setAuth({ status: "signedIn", profile: res.profile });
    },
    [api, tokens],
  );

  const register = useCallback(
    async (r: RegisterRequest) => {
      const res = await api.register(r);
      await saveSession(res.session);
      tokens.set(res.session.token);
      setAuth({ status: "signedIn", profile: res.profile });
    },
    [api, tokens],
  );

  const logout = useCallback(async () => {
    try {
      // Tilbakekall sesjonen på serveren mens tokenet ennå sendes med.
      await api.logout();
    } catch {
      // Uten nett: tokenet slettes likevel lokalt, og utløper på serveren.
    } finally {
      tokens.set(null);
      await clearSession();
      setAuth({ status: "signedOut" });
    }
  }, [api, tokens]);

  const setForm = useCallback((update: (f: SearchForm) => SearchForm) => setFormState((f) => update(f)), []);

  const runSearch = useCallback((): string | null => {
    const problem = validateForm(form);
    if (problem) return problem;
    const seq = ++searchSeq.current;
    setSearch({ status: "loading" });
    api
      .search(toSearchRequest(form, sessionId))
      .then((result) => {
        if (seq === searchSeq.current) setSearch({ status: "done", result });
      })
      .catch((err: unknown) => {
        if (seq !== searchSeq.current) return;
        const message = err instanceof ApiError ? err.message : "Noe gikk galt. Prøv igjen.";
        setSearch({ status: "error", message });
      });
    return null;
  }, [api, form, sessionId]);

  const value = useMemo<AppContextValue>(
    () => ({ api, auth, login, register, logout, form, setForm, search, runSearch }),
    [api, auth, login, register, logout, form, setForm, search, runSearch],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp må brukes inne i AppProvider");
  return ctx;
}
