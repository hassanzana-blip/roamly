import { addDays, fromIsoDate, toIsoDate } from "./format";

/**
 * Kalenderen for avreise og retur i ett ark: rene datoer (YYYY-MM-DD, lokal kalender), ingen React.
 *
 * Uken starter på mandag (norsk og britisk skikk). Dager før i dag kan ikke velges. Hvor langt fram en
 * leverandør selger, vet vi ikke – kalenderen viser inneværende måned og tolv til (typisk horisont for
 * flybilletter er rundt elleve måneder); søket selv er det som eventuelt sier nei.
 */

export type Month = { year: number; month0: number };
export const MONTHS_SHOWN = 13;

/** Månedene kalenderen viser, fra måneden `today` ligger i. */
export function monthsFrom(today: string, count = MONTHS_SHOWN): Month[] {
  const t = fromIsoDate(today);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(t.getFullYear(), t.getMonth() + i, 1);
    return { year: d.getFullYear(), month0: d.getMonth() };
  });
}

/** Indeksen til måneden en dato ligger i (0 når den er før første måned, siste når den er etter). */
export function monthIndexOf(months: Month[], iso: string): number {
  const d = fromIsoDate(iso);
  const i = months.findIndex((m) => m.year === d.getFullYear() && m.month0 === d.getMonth());
  if (i >= 0) return i;
  const first = months[0]!;
  return d.getFullYear() * 12 + d.getMonth() < first.year * 12 + first.month0 ? 0 : months.length - 1;
}

/** Ukene i en måned, mandag først: hver uke har sju plasser med en dato eller null (dager utenfor måneden). */
export function monthGrid({ year, month0 }: Month): (string | null)[][] {
  const first = new Date(year, month0, 1);
  const days = new Date(year, month0 + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // søndag = 0 i JS; mandag først
  const cells: (string | null)[] = [...Array<null>(lead).fill(null)];
  for (let d = 1; d <= days; d++) cells.push(toIsoDate(new Date(year, month0, d)));
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export type PickMode = "depart" | "return";
export type DatePick = { departDate: string; returnDate: string; next: PickMode };

/** Hele netter mellom to datoer. */
export function nightsBetween(from: string, to: string): number {
  return Math.round((fromIsoDate(to).getTime() - fromIsoDate(from).getTime()) / 86_400_000);
}

/**
 * Et trykk i kalenderen. Tur-retur: først avreise, så retur. Skjemaet er gyldig etter hvert eneste trykk:
 * - avreise valgt: returen beholdes hvis den fortsatt er etter, ellers flyttes den med samme reiselengde (minst en
 *   natt, ellers en uke) – så søket aldri står med retur før avreise; neste trykk velger retur.
 * - retur valgt før avreise: tolkes som en ny avreise (vanlig i reiseapper), og neste trykk velger fortsatt retur.
 * - retur valgt samme dag eller senere: ferdig, neste trykk begynner på nytt med avreise.
 * Én vei: bare avreise.
 */
export function applyPick(current: { departDate: string; returnDate: string }, iso: string, mode: PickMode, roundTrip: boolean): DatePick {
  if (!roundTrip) return { departDate: iso, returnDate: current.returnDate < iso ? addDays(iso, 7) : current.returnDate, next: "depart" };
  if (mode === "return" && iso >= current.departDate) return { departDate: current.departDate, returnDate: iso, next: "depart" };
  const length = nightsBetween(current.departDate, current.returnDate);
  const returnDate = current.returnDate > iso ? current.returnDate : addDays(iso, length > 0 ? length : 7);
  return { departDate: iso, returnDate, next: "return" };
}

/** Rollen en dag har i valget – til utseende og VoiceOver. */
export type DayRole = "depart" | "return" | "same" | "inside" | null;

export function dayRole(iso: string, departDate: string, returnDate: string | null): DayRole {
  if (returnDate && iso === departDate && iso === returnDate) return "same";
  if (iso === departDate) return "depart";
  if (returnDate && iso === returnDate) return "return";
  if (returnDate && iso > departDate && iso < returnDate) return "inside";
  return null;
}

/** Dagen i dag som YYYY-MM-DD (enhetens kalender). */
export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}
