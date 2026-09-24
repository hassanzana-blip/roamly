import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import * as Crypto from "expo-crypto";
import type { CustomerProfile, MobileDeleteAccountInput, MobileUpdateProfileInput } from "@contracts/mobileAuth";
import type { MobileSearchResult } from "@contracts/mobileSearch";
import { ApiError, createApiClient, type ApiClient, type RegisterRequest } from "./api";
import { API_BASE } from "./config";
import { clearSession, loadSession, saveSession } from "./tokenStore";
import { initialForm, toSearchRequest, validateForm, type AirportChoice, type SearchForm } from "./searchForm";
import { DEFAULT_VIEW, type ResultsView } from "./resultsView";
import { parseDraft } from "./draft";
import { readPref, writePref } from "./localStore";
import { addRecent, parseHomeAirport, parseRecent, recentKey, type RecentSearch } from "./recent";
import { I18nProvider } from "../i18n";
import type { Locale } from "../i18n/types";
import type { FormErrorCode } from "../i18n/ns/search";

// ─── Tjenester for hele appen: API-klient, kundesesjon og søk ───────────────

type AuthState =
  | { status: "loading" }
  /** `notice`: hvorfor brukeren ble logget ut – utløpt økt eller slettet konto (vises én gang i profilen). */
  | { status: "signedOut"; notice?: "expired" | "deleted" }
  /** profile er null når vi har en gyldig lagret sesjon, men ikke fikk hentet kontoen (f.eks. uten nett). */
  | { status: "signedIn"; profile: CustomerProfile | null };

/** `query`: skjemaet søket faktisk ble kjørt med – overskriften viser dette, ikke et skjema som er endret etterpå. */
type SearchState =
  | { status: "idle" }
  | { status: "loading"; query: SearchForm }
  /** `at`: da svaret kom (telefonens klokke) – for «sjekket kl. …» og utdaterte priser. */
  | { status: "done"; result: MobileSearchResult; at: number; query: SearchForm }
  /** Feilen selv (ikke tekst), så meldingen alltid vises på gjeldende språk. */
  | { status: "error"; error: unknown; query: SearchForm };

type AppContextValue = {
  api: ApiClient;
  auth: AuthState;
  login: (email: string, password: string) => Promise<void>;
  register: (r: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  /** Lagrer profilen (samme konto som nettet) og viser den nye med én gang. */
  updateProfile: (input: MobileUpdateProfileInput) => Promise<void>;
  /**
   * Sletter kontoen på serveren. Feil passord gir ApiError UNAUTHORIZED og
   * brukeren forblir innlogget; utløpt økt logger ut. Etter sletting er tokenet borte.
   */
  deleteAccount: (input: MobileDeleteAccountInput) => Promise<void>;
  form: SearchForm;
  setForm: (update: (f: SearchForm) => SearchForm) => void;
  search: SearchState;
  /**
   * Starter søket for skjemaet (med ev. endringer, f.eks. et reisemål valgt fra
   * et kort). Returnerer feilmelding hvis skjemaet ikke er gyldig.
   */
  runSearch: (patch?: Partial<SearchForm>) => FormErrorCode | null;
  /** Avbryter et pågående søk (forespørselen avbrytes, svaret ignoreres). Skjemaet beholdes. */
  cancelSearch: () => void;
  /** Sortering og filtre på resultatlisten. Nullstilles ved hvert nytt søk. */
  view: ResultsView;
  setView: (update: (v: ResultsView) => ResultsView) => void;
  /** Måler klikket ut (nettets flights.trackProviderClick). Venter aldri, feiler aldri synlig. */
  trackClick: (offerId: string) => void;
  /** Nylige søk på denne telefonen (nyeste først). Lagres når et gyldig søk kjøres. */
  recent: RecentSearch[];
  removeRecent: (key: string) => void;
  clearRecent: () => void;
  /** Foretrukket avreiseflyplass – bare når kunden selv har valgt det. Brukes som «Fra» i et nytt skjema. */
  homeAirport: AirportChoice | null;
  setHomeAirport: (a: AirportChoice | null) => void;
  /** Anonym UUID for denne app-økten (KAYAKs userTrackId), delt av fly- og hotellsøk. Aldri knyttet til konto. */
  sessionId: string;
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

/**
 * Hele appens tilstand, pakket i språkvalget. `initialLocale` er for tester og
 * forhåndsvisninger; ellers leses det lagrede valget (norsk bokmål ved ny installasjon).
 */
export function AppProvider({ children, initialLocale, ...rest }: { children: ReactNode; apiFactory?: ApiFactory; initial?: Partial<SearchForm>; initialLocale?: Locale }) {
  return (
    <I18nProvider initialLocale={initialLocale}>
      <AppStateProvider {...rest}>{children}</AppStateProvider>
    </I18nProvider>
  );
}

function AppStateProvider({ children, apiFactory = defaultFactory, initial }: { children: ReactNode; apiFactory?: ApiFactory; initial?: Partial<SearchForm> }) {
  // Tokenet ligger i minnet (for kall) og i nøkkelringen (mellom oppstarter). Ingen andre steder.
  const [tokens] = useState(createTokenHolder);
  const api = useMemo(() => apiFactory(tokens.get), [apiFactory, tokens]);
  // Anonym søke-økt per oppstart (KAYAK krever unik userTrackId per sluttbruker og økt).
  const [sessionId] = useState(() => Crypto.randomUUID());

  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  // Søkeutkastet fra forrige gang (bare skjemaet), ellers standardskjemaet.
  const [homeAirport, setHomeAirportState] = useState<AirportChoice | null>(() => readPref("homeAirport", parseHomeAirport));
  const [form, setFormState] = useState<SearchForm>(() => {
    const draft = readPref("draft", (v) => parseDraft(v));
    const base = draft ?? { ...initialForm(), origin: homeAirport ?? initialForm().origin };
    return { ...base, ...initial };
  });
  const [recent, setRecent] = useState<RecentSearch[]>(() => readPref("recent", (v) => parseRecent(v)) ?? []);
  const saveRecent = useCallback((next: RecentSearch[]) => {
    setRecent(next);
    writePref("recent", next.length ? next : null);
  }, []);
  const removeRecent = useCallback((key: string) => saveRecent(recent.filter((r) => recentKey(r) !== key)), [recent, saveRecent]);
  const clearRecent = useCallback(() => saveRecent([]), [saveRecent]);
  const setHomeAirport = useCallback((a: AirportChoice | null) => {
    setHomeAirportState(a);
    writePref("homeAirport", a);
  }, []);
  useEffect(() => {
    const id = setTimeout(() => writePref("draft", form), 400);
    return () => clearTimeout(id);
  }, [form]);
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const searchSeq = useRef(0);
  const searchAbort = useRef<AbortController | null>(null);
  const lastSearchKey = useRef<string | null>(null);
  const [view, setViewState] = useState<ResultsView>(DEFAULT_VIEW);

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
          setAuth({ status: "signedOut", notice: "expired" });
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === "UNAUTHORIZED") {
          tokens.set(null);
          await clearSession();
          setAuth({ status: "signedOut", notice: "expired" });
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

  /** Økten er utløpt eller tilbakekalt: glem tokenet, behold skjema og søk. */
  const sessionEnded = useCallback(async () => {
    tokens.set(null);
    await clearSession();
    setAuth({ status: "signedOut", notice: "expired" });
  }, [tokens]);

  const updateProfile = useCallback(
    async (input: MobileUpdateProfileInput) => {
      try {
        const profile = await api.updateProfile(input);
        setAuth({ status: "signedIn", profile });
      } catch (err) {
        if (err instanceof ApiError && err.code === "UNAUTHORIZED") await sessionEnded();
        throw err;
      }
    },
    [api, sessionEnded],
  );

  const deleteAccount = useCallback(
    async (input: MobileDeleteAccountInput) => {
      try {
        await api.deleteAccount(input);
      } catch (err) {
        // Feil passord (field: password) lar økten leve; UNAUTHORIZED uten felt er et dødt token.
        if (err instanceof ApiError && err.code === "UNAUTHORIZED" && err.field !== "password") await sessionEnded();
        throw err;
      }
      tokens.set(null);
      await clearSession();
      setAuth({ status: "signedOut", notice: "deleted" });
    },
    [api, tokens, sessionEnded],
  );

  // Uten nett ved oppstart: prøv å hente kontoen igjen når appen kommer i forgrunnen.
  useEffect(() => {
    if (auth.status !== "signedIn" || auth.profile) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      api
        .me()
        .then((me) => (me ? setAuth({ status: "signedIn", profile: me }) : sessionEnded()))
        .catch(() => undefined);
    });
    return () => sub.remove();
  }, [api, auth, sessionEnded]);

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

  const runSearch = useCallback((patch?: Partial<SearchForm>): FormErrorCode | null => {
    const next = patch ? { ...form, ...patch } : form;
    if (patch) setFormState(next);
    const problem = validateForm(next);
    if (problem) return problem;
    saveRecent(addRecent(recent, next));
    const seq = ++searchSeq.current;
    searchAbort.current?.abort();
    const abort = new AbortController();
    searchAbort.current = abort;
    setSearch({ status: "loading", query: next });
    // Samme søk på nytt (oppdater priser, prøv igjen): filtrene står. Et annet søk: nullstilt.
    const key = recentKey(next);
    if (key !== lastSearchKey.current) setViewState(DEFAULT_VIEW);
    lastSearchKey.current = key;
    api
      .search(toSearchRequest(next, sessionId), abort.signal)
      .then((result) => {
        if (seq === searchSeq.current) setSearch({ status: "done", result, at: Date.now(), query: next });
      })
      .catch((err: unknown) => {
        if (seq !== searchSeq.current) return;
        setSearch({ status: "error", error: err, query: next });
      });
    return null;
  }, [api, form, sessionId, recent, saveRecent]);

  const cancelSearch = useCallback(() => {
    searchSeq.current++;
    searchAbort.current?.abort();
    searchAbort.current = null;
    setSearch({ status: "idle" });
  }, []);

  const setView = useCallback((update: (v: ResultsView) => ResultsView) => setViewState((v) => update(v)), []);

  const trackClick = useCallback(
    (offerId: string) => {
      // «Fire and forget», som på nettet: lenken åpnes uansett hva målingen svarer.
      api.trackProviderClick(offerId, sessionId).catch(() => undefined);
    },
    [api, sessionId],
  );

  const value = useMemo<AppContextValue>(
    () => ({ api, auth, login, register, logout, updateProfile, deleteAccount, form, setForm, search, runSearch, cancelSearch, view, setView, trackClick, recent, removeRecent, clearRecent, homeAirport, setHomeAirport, sessionId }),
    [api, auth, login, register, logout, updateProfile, deleteAccount, form, setForm, search, runSearch, cancelSearch, view, setView, trackClick, recent, removeRecent, clearRecent, homeAirport, setHomeAirport, sessionId],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp må brukes inne i AppProvider");
  return ctx;
}
