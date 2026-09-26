import { useCallback, useEffect, useState } from "react";
import type { HotelsStatus } from "@contracts/hotels";
import { useApp } from "./appState";

export type HotelsStatusState = { kind: "loading" } | { kind: "ok"; status: HotelsStatus } | { kind: "error"; error: unknown };

/**
 * Serverens svar på om hotellsøk er slått på (hotels.status). Appen gjetter
 * aldri: til svaret er kommet vises verken skjema, priser eller bestillingsknapper.
 */
export function useHotelsStatus(): { state: HotelsStatusState; retry: () => void } {
  const { api } = useApp();
  const [state, setState] = useState<HotelsStatusState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .hotelsStatus()
      .then((status) => {
        if (!cancelled) setState({ kind: "ok", status });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ kind: "error", error: error ?? new Error("hotels.status") });
      });
    return () => {
      cancelled = true;
    };
  }, [api, attempt]);

  const retry = useCallback(() => {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
