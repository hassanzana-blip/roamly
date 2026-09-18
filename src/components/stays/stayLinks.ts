/** Lenker til hotell- og leiebilsøket (delt mellom forsiden og sidene). */

export interface HotelSearchValues {
  dest: string;
  place: string;
  checkin: string;
  checkout: string;
  adults: number;
  rooms: number;
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
