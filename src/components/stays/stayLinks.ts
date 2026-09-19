/** Lenker til hotell- og leiebilsøket (delt mellom forsiden og sidene). */

export interface HotelSearchValues {
  dest: string;
  place: string;
  checkin: string;
  checkout: string;
  adults: number;
  rooms: number;
  /** Alder på hvert barn (0–17). Leverandøren priser rommet etter alderen. */
  childAges?: number[];
}

export const MAX_CHILDREN = 6;

/** `kids=7,12` i URL-en → [7, 12]; alt utenfor 0–17 forkastes. */
export function parseChildAges(param: string | null | undefined): number[] {
  if (!param) return [];
  return param
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 17)
    .slice(0, MAX_CHILDREN);
}

/**
 * Fordeler gjester på rom slik leverandøren vil ha dem: voksne jevnt (5 på 2
 * rom = 3 + 2, ikke 3 + 3), minst én voksen per rom, barna etter tur fra
 * første rom. Rekkefølgen på barnas aldre beholdes.
 */
export function splitRooms(adults: number, childAges: number[], rooms: number): { adults: number; childAges?: number[] }[] {
  const n = Math.max(1, Math.min(8, Math.round(rooms)));
  const a = Math.max(n, Math.min(8 * n, Math.round(adults)));
  const list = Array.from({ length: n }, (_, i) => ({ adults: Math.floor(a / n) + (i < a % n ? 1 : 0), kids: [] as number[] }));
  childAges.forEach((age, i) => list[i % n]!.kids.push(age));
  return list.map((r) => (r.kids.length ? { adults: r.adults, childAges: r.kids } : { adults: r.adults }));
}

export interface CarSearchValues {
  type: "airport" | "city" | "";
  value: string;
  place: string;
  pickup: string;
  dropoff: string;
}

export function hotelSearchHref(v: HotelSearchValues): string {
  const q = new URLSearchParams({ place: v.place, checkin: v.checkin, checkout: v.checkout, adults: String(v.adults), rooms: String(v.rooms) });
  if (v.dest) q.set("dest", v.dest);
  if (v.childAges?.length) q.set("kids", v.childAges.join(","));
  return `/hotell?${q.toString()}`;
}

export function carSearchHref(v: CarSearchValues): string {
  const q = new URLSearchParams({ place: v.place, pickup: v.pickup, dropoff: v.dropoff });
  if (v.type && v.value) {
    q.set("type", v.type);
    q.set("value", v.value);
  }
  return `/leiebil?${q.toString()}`;
}
