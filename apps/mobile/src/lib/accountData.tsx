import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { MobileAccountHub, MobileSaveTravellerInput, MobileTraveller } from "@contracts/mobileAccount";
import { ApiError, type ApiClient } from "./api";

/**
 * Kontoens egne data på Min side (mobileAccount.* i mobil-API-et), for innloggede kunder:
 * - `hub`: nærmeste bestilling på hellosky.no og tall fra kontoen (aktive prisvarsler, uleste varsler …).
 * - `travellers`: de lagrede reisende på kontoen (samme som «Reisende» på nettet).
 *
 * `status`:
 * - `off`: ikke innlogget – appen viser bare det som ligger på telefonen.
 * - `loading`: henter.
 * - `ready`: serveren svarte; tallene og listene er kontoens.
 * - `unsupported`: serveren har ikke disse rutene ennå (404). Min side viser da det som ligger på telefonen og
 *   lenkene til hellosky.no – aldri tall den ikke har.
 * - `error`: nett eller server feilet; det forrige svaret (om noe) står, og «Prøv igjen» henter på nytt.
 */
export type AccountStatus = "off" | "loading" | "ready" | "unsupported" | "error";

type AccountData = {
  status: AccountStatus;
  hub: MobileAccountHub | null;
  travellers: MobileTraveller[] | null;
  refresh: () => void;
  /** Lagrer (ny eller endret) på kontoen og oppdaterer listen. Kaster ApiError ved feil. */
  saveTraveller: (input: MobileSaveTravellerInput) => Promise<MobileTraveller>;
  removeTraveller: (id: number) => Promise<void>;
};

const AccountContext = createContext<AccountData | null>(null);

/** Ingen rute med det navnet på serveren (eldre server): tRPC svarer 404. */
export function isUnsupported(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

export function AccountDataProvider({ api, signedIn, onSessionEnded, children }: { api: ApiClient; signedIn: boolean; onSessionEnded: () => void; children: ReactNode }) {
  const [status, setStatus] = useState<AccountStatus>(signedIn ? "loading" : "off");
  const [hub, setHub] = useState<MobileAccountHub | null>(null);
  const [travellers, setTravellers] = useState<MobileTraveller[] | null>(null);
  const seq = useRef(0);

  const load = useCallback(() => {
    // Bare det siste svaret gjelder (et eldre som kommer sent, eller et svar etter utlogging, forkastes).
    const my = ++seq.current;
    let live = true;
    Promise.all([api.accountHub(), api.travellers()])
      .then(([h, t]) => {
        if (!live || my !== seq.current) return;
        setHub(h);
        setTravellers(t);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (!live || my !== seq.current) return;
        if (err instanceof ApiError && err.code === "UNAUTHORIZED") {
          onSessionEnded();
          return;
        }
        setStatus(isUnsupported(err) ? "unsupported" : "error");
      });
    // Avbryter svaret (utlogging, ny konto).
    return () => {
      live = false;
    };
  }, [api, onSessionEnded]);

  // Ved innlogging hentes alt; ved utlogging glemmes det med én gang (ingenting fra forrige konto blir stående).
  const [was, setWas] = useState(signedIn);
  if (was !== signedIn) {
    setWas(signedIn);
    setHub(null);
    setTravellers(null);
    setStatus(signedIn ? "loading" : "off");
  }
  useEffect(() => {
    if (!signedIn) return;
    return load();
  }, [signedIn, load]);

  const refresh = useCallback(() => {
    if (signedIn) void load();
  }, [signedIn, load]);

  const saveTraveller = useCallback(
    async (input: MobileSaveTravellerInput) => {
      const saved = await api.saveTraveller(input);
      setTravellers((l) => {
        const list = l ?? [];
        return list.some((t) => t.id === saved.id) ? list.map((t) => (t.id === saved.id ? saved : t)) : [...list, saved];
      });
      setHub((h) => (h && !input.id ? { ...h, travellers: h.travellers + 1 } : h));
      return saved;
    },
    [api],
  );
  const removeTraveller = useCallback(
    async (id: number) => {
      await api.removeTraveller(id);
      setTravellers((l) => (l ?? []).filter((t) => t.id !== id));
      setHub((h) => (h ? { ...h, travellers: Math.max(0, h.travellers - 1) } : h));
    },
    [api],
  );

  const value = useMemo(() => ({ status, hub, travellers, refresh, saveTraveller, removeTraveller }), [status, hub, travellers, refresh, saveTraveller, removeTraveller]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccountData(): AccountData {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccountData må brukes inne i AppProvider");
  return ctx;
}
