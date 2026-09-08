/**
 * «Fortsett som Zyar.»
 *
 * Adminportalen har to faste brukere som logger inn fra sine egne maskiner
 * hver dag. Å skrive e-postadressen sin hver gang er arbeid uten hensikt.
 * Etter en vellykket innlogging husker nettleseren hvem som var her sist, og
 * neste gang står ansiktet og navnet der – som brukervelgeren på en Mac.
 *
 * Dette ligger kun i denne nettleseren, aldri på serveren, og forteller ingen
 * ting til en fremmed som åpner siden på sin egen maskin. Passordet huskes
 * selvsagt ikke.
 */

const KEY = "hellosky:admin:recent";
const MAX = 2;

export type RecentStaff = { name: string; email: string };

export function readRecentStaff(): RecentStaff[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is RecentStaff => !!x && typeof x === "object" && typeof (x as RecentStaff).email === "string" && typeof (x as RecentStaff).name === "string")
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function rememberStaff(entry: RecentStaff): void {
  try {
    const rest = readRecentStaff().filter((r) => r.email.toLowerCase() !== entry.email.toLowerCase());
    localStorage.setItem(KEY, JSON.stringify([entry, ...rest].slice(0, MAX)));
  } catch {
    /* privat vindu eller blokkert lagring – da er dette bare ikke tilgjengelig */
  }
}

export function forgetStaff(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignorert */
  }
}
