/**
 * Familien din – utledet fra fødselsdatoene som allerede er lagret på
 * reisende. Ingen nye felter i databasen: voksen/barn/baby regnes ut her,
 * etter flyselskapenes inndeling (baby under 2, barn 2–11, voksen fra 12).
 */
export type TravellerKind = "adult" | "child" | "infant";

/** Fylte år på en dato, fra «YYYY-MM-DD». null når datoen mangler eller er ugyldig. */
export function ageOn(bornOn: string | null | undefined, at: Date = new Date()): number | null {
  if (!bornOn) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(bornOn);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  let age = at.getFullYear() - year;
  if (at.getMonth() < month || (at.getMonth() === month && at.getDate() < day)) age -= 1;
  return age < 0 || age > 130 ? null : age;
}

export function travellerKind(bornOn: string | null | undefined, at: Date = new Date()): TravellerKind | null {
  const age = ageOn(bornOn, at);
  if (age === null) return null;
  if (age < 2) return "infant";
  if (age < 12) return "child";
  return "adult";
}

/** Antall per type – reisende uten fødselsdato telles ikke med. */
export function countKinds(travellers: { bornOn?: string | null }[], at: Date = new Date()): Record<TravellerKind, number> {
  const n: Record<TravellerKind, number> = { adult: 0, child: 0, infant: 0 };
  for (const p of travellers) {
    const kind = travellerKind(p.bornOn, at);
    if (kind) n[kind] += 1;
  }
  return n;
}

export function initialsOf(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
