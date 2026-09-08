import { useCallback } from "react";
import { useSearchParams } from "react-router";

/**
 * Valgt rad, speilet i adressen.
 *
 * Kommandopaletten og delte lenker peker rett på én post. Ligger valget bare i
 * komponentens state, må mottakeren lete seg fram i lista selv – og en lenke
 * fra en kollega blir en lenke til «en liste et sted».
 *
 * Vi bytter ut historikkoppføringen i stedet for å legge på en ny: å klikke
 * seg gjennom ti kunder skal ikke koste ti trykk på tilbake for å komme ut av
 * lista igjen.
 */
export function useRecordParam(key: string): [number | null, (id: number | null) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get(key);
  const id = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;

  const select = useCallback(
    (next: number | null) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === null) p.delete(key);
          else p.set(key, String(next));
          return p;
        },
        { replace: true },
      );
    },
    [key, setParams],
  );

  return [id, select];
}
