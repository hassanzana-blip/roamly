import type { HotelSummary } from "@contracts/hotels";
import type { I18n } from "../i18n";
import { hotelTotalNok, type HotelStay } from "./hotels";

export type HotelSort = "recommended" | "price" | "rating";

/** «23. okt. – 26. okt. · 3 netter · 2 voksne · 1 rom». */
export function stayLine(stay: HotelStay, { t, f }: Pick<I18n, "t" | "f">, nights: number): string {
  const h = t.hotels;
  const guests = [h.adultsCount(stay.adults), stay.childAges.length ? h.childrenCount(stay.childAges.length) : null, h.roomsCount(stay.rooms)].filter(Boolean).join(" · ");
  return h.stay(`${f.shortDay(stay.checkin)} – ${f.shortDay(stay.checkout)}`, h.nights(nights), guests);
}

/** Hotell uten sammenlignbar NOK-pris havner sist ved prissortering. */
export function sortHotels(list: readonly HotelSummary[], sort: HotelSort): HotelSummary[] {
  if (sort === "recommended") return [...list];
  const indexed = list.map((hotel, i) => ({ hotel, i }));
  indexed.sort((a, b) => {
    if (sort === "price") {
      const an = hotelTotalNok(a.hotel);
      const bn = hotelTotalNok(b.hotel);
      if (an !== null && bn !== null && an !== bn) return an - bn;
      if (an === null && bn !== null) return 1;
      if (an !== null && bn === null) return -1;
      return a.i - b.i;
    }
    const ar = a.hotel.guestRating ?? -1;
    const br = b.hotel.guestRating ?? -1;
    return br - ar || b.hotel.numberOfReviews - a.hotel.numberOfReviews || a.i - b.i;
  });
  return indexed.map((x) => x.hotel);
}

