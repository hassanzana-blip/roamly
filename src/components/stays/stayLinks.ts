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
  /** Hva som er viktig for gjesten (landingssiden): frokost, sentralt, familie, fleks. Styrer startfiltre i resultatet. */
  prefs?: HotelPref[];
}

export const HOTEL_PREFS = ["frokost", "sentralt", "familie", "fleks"] as const;
export type HotelPref = (typeof HOTEL_PREFS)[number];

export function parseHotelPrefs(raw: string | null): HotelPref[] {
  if (!raw) return [];
  return raw.split(",").filter((p): p is HotelPref => (HOTEL_PREFS as readonly string[]).includes(p));
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
  /** Hel time 0–23; leverandøren priser etter faktisk hente- og leveringstid. */
  pickupHour?: number;
  dropoffHour?: number;
  /** Annet leveringssted (enveisleie). Tomt = leveres der den hentes. */
  dropoffType?: "airport" | "city" | "";
  dropoffValue?: string;
  dropoffPlace?: string;
}

export const DEFAULT_CAR_HOUR = 10;

/** `ph=14` i URL-en → 14; alt utenfor 0–23 gir standardtimen. */
export function parseHour(param: string | null | undefined, fallback = DEFAULT_CAR_HOUR): number {
  const n = Number(param);
  return param != null && Number.isInteger(n) && n >= 0 && n <= 23 ? n : fallback;
}

export function hourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

export function hotelSearchHref(v: HotelSearchValues): string {
  const q = new URLSearchParams({ place: v.place, checkin: v.checkin, checkout: v.checkout, adults: String(v.adults), rooms: String(v.rooms) });
  if (v.dest) q.set("dest", v.dest);
  if (v.childAges?.length) q.set("kids", v.childAges.join(","));
  if (v.prefs?.length) q.set("pref", v.prefs.join(","));
  return `/hotell?${q.toString()}`;
}

export function carSearchHref(v: CarSearchValues): string {
  const q = new URLSearchParams({ place: v.place, pickup: v.pickup, dropoff: v.dropoff });
  if (v.type && v.value) {
    q.set("type", v.type);
    q.set("value", v.value);
  }
  if (v.pickupHour != null && v.pickupHour !== DEFAULT_CAR_HOUR) q.set("ph", String(v.pickupHour));
  if (v.dropoffHour != null && v.dropoffHour !== DEFAULT_CAR_HOUR) q.set("dh", String(v.dropoffHour));
  if (v.dropoffType && v.dropoffValue) {
    q.set("dtype", v.dropoffType);
    q.set("dvalue", v.dropoffValue);
    if (v.dropoffPlace) q.set("dplace", v.dropoffPlace);
  }
  return `/leiebil?${q.toString()}`;
}

/** Oversettelsesnøkkel for et hotellvalg. */
export function prefLabelKey(p: HotelPref) {
  return p === "frokost" ? ("hl.pref.breakfast" as const) : p === "sentralt" ? ("hl.pref.central" as const) : p === "familie" ? ("hl.pref.family" as const) : ("hl.pref.flex" as const);
}
