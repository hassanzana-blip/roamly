/** Calendar dates stay in the user's local calendar, never UTC midnight. */
export function localDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseCalendarDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return localDateString(date) === value ? date : undefined;
}

export function calendarDayOffset(days: number, now = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

export type SearchDateIssue = "missing" | "invalid" | "past" | "order";

/** Same-day connections/returns are valid; departures must be chronological. */
export function searchDateIssue(dates: readonly string[], today = calendarDayOffset(0)): SearchDateIssue | null {
  if (!dates.length || dates.some((date) => !date)) return "missing";
  if (dates.some((date) => !parseCalendarDate(date))) return "invalid";
  if (dates.some((date) => date < today)) return "past";
  if (dates.some((date, i) => i > 0 && date < dates[i - 1])) return "order";
  return null;
}
