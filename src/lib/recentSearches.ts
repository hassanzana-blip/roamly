/**
 * Recent flight searches — kept in localStorage so the homepage can offer
 * “Fortsett planleggingen” without any account or backend state.
 */

export type RecentSearch = {
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
  depart: string;
  ret?: string;
  adults: number;
  children: number;
  infants: number;
  cabin: string;
  at: number;
};

const KEY = "roamly:recent-searches";
const MAX = 4;

export function saveRecentSearch(entry: Omit<RecentSearch, "at">): void {
  try {
    const list = loadRecentSearches().filter(
      (s) => !(s.from === entry.from && s.to === entry.to && s.depart === entry.depart && s.ret === entry.ret),
    );
    list.unshift({ ...entry, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function loadRecentSearches(): RecentSearch[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s) => s && s.from && s.to && s.depart) : [];
  } catch {
    return [];
  }
}

export function recentSearchHref(s: RecentSearch): string {
  const p = new URLSearchParams({
    from: s.from,
    to: s.to,
    depart: s.depart,
    adults: String(s.adults),
    children: String(s.children),
    infants: String(s.infants),
    cabin: s.cabin,
  });
  if (s.ret) p.set("ret", s.ret);
  return `/sok?${p.toString()}`;
}
