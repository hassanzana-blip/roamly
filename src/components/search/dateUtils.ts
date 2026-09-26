import { currentLang } from "@/lib/format";
import { localDateString, parseCalendarDate } from "./searchDates";

export function toDate(iso: string): Date | undefined {
  return parseCalendarDate(iso);
}

export function toIso(date: Date): string {
  return localDateString(date);
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
