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
