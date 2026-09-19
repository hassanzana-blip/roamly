import { currentLang } from "@/lib/format";

export function toDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function localeTag(): string {
  const l = currentLang();
  return l === "nb" ? "nb-NO" : l === "en" ? "en-GB" : l;
}

export function dateLabel(iso: string, withYear = true): string {
  const d = toDate(iso);
  if (!d) return "";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat(localeTag(), {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withYear && !sameYear ? { year: "numeric" } : {}),
  }).format(d);
}

/** «16.–20. oktober» inside one month, «28. okt. – 2. nov.» across months. */
export function rangeLabel(fromIso: string, toIso: string): string {
  const a = toDate(fromIso);
  const b = toDate(toIso);
  if (!a || !b) return "";
  const tag = localeTag();
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    const month = new Intl.DateTimeFormat(tag, { month: "long" }).format(a);
    // Ordinal full stops belong to Norwegian, Danish and German; English has none.
    const dot = tag.startsWith("en") || tag.startsWith("sv") ? "" : ".";
    return `${a.getDate()}${dot}–${b.getDate()}${dot} ${month}`;
  }
  const f = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short" });
  return `${f.format(a)} – ${f.format(b)}`;
}
