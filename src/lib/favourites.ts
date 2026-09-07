import { useCallback, useEffect, useState } from "react";

const KEY = "hellosky:favourites";

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

/**
 * Favourite destinations stored locally in the browser.
 * Deliberately local state + localStorage – no global state library
 * is needed for this simple interaction.
 */
export function useFavourites(): [Set<string>, (id: string) => void] {
  const [favs, setFavs] = useState<Set<string>>(read);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setFavs(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((id: string) => {
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(KEY, JSON.stringify([...next]));
      } catch {
        /* private mode – keep in-memory state */
      }
      return next;
    });
  }, []);

  return [favs, toggle];
}
