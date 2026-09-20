/**
 * Datoene prisfinneren faktisk søker på.
 *
 * Vi har ingen leverandør som gir «fleksible datoer» uten et søk per dato, så
 * valgene her gir konkrete datoer den reisende kan se før hun trykker. «Neste
 * helg» er førstkommende fredag – også når man står på en fredag, for da mener
 * folk helgen som kommer, ikke den som begynner om noen timer.
 */
export type WhenKey = "weekend" | "month" | "quarter";

function nextFriday(from: Date): Date {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
  return d;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function datesFor(when: WhenKey, nights: number, today = new Date()): { depart: string; ret: string } {
  const start = when === "weekend" ? nextFriday(today) : new Date(today.getTime() + (when === "month" ? 30 : 90) * 86_400_000);
  start.setHours(12, 0, 0, 0);
  return { depart: iso(start), ret: iso(new Date(start.getTime() + nights * 86_400_000)) };
}
