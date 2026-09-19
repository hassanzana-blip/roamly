import { useEffect, useState } from "react";

/**
 * true når viewporten er minst `px` bred. Brukes til å la være å montere
 * skrivebordsinnhold på telefon: `hidden lg:block` skjuler bare visuelt, og
 * et kart på 1 MB lastes like fullt.
 */
export function useMinWidth(px: number): boolean {
  const [ok, setOk] = useState(() => (typeof window === "undefined" ? false : window.matchMedia(`(min-width: ${px}px)`).matches));
  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${px}px)`);
    const onChange = () => setOk(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, [px]);
  return ok;
}
