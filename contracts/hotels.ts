/**
 * Hotellsøk (metasøk via KAYAK Hotels API).
 *
 * Alt her er lest fra leverandørens svar. Bilder er hotellets egne bilder
 * (KAYAK `images[]`), vurderinger er KAYAKs `guestRating`/`numberOfReviews`,
 * og hver pris peker til leverandørens egen bestillingsside (`bookUri`).
 * HelloSky finner aldri opp bilder, omtaler, fasiliteter eller priser.
 */

export interface HotelPlace {
  /** KAYAK-nøkkel, f.eks. `kplace:58075`. */
  key: string;
  name: string;
  fullName?: string;
  countryCode?: string;
  type?: string;
}

export interface HotelImage {
  large: string;
  small?: string;
}

export interface HotelProviderInfo {
  code: string;
  name: string;
  /** Leverandørens logo (KAYAK-levert URL). */
  logoUrl?: string;
  /** Hotellkjeden selv (direkte), ikke et reisebyrå. */
  isDirect: boolean;
}

export interface HotelRateOffer {
  roomName: string;
  /** Totalpris for hele oppholdet i `currency`. */
  totalAmount: number;
  currency: string;
  /** Per natt (avledet: total / netter). */
  perNightAmount: number;
  freeCancellation: boolean;
  payLater: boolean;
  /** 0 frokost, 1 lunsj, 2 middag, 3 måltider, 4 all inclusive (KAYAK InclusionType). */
  inclusions: number[];
  availableRooms: number;
  isCheapest: boolean;
  provider: HotelProviderInfo;
  /** Leverandørens bestillingslenke (KAYAK deeplink). Åpnes hos leverandøren. */
  bookUrl: string;
}

export interface HotelSummary {
  id: number;
  /** `khotel:[id]` */
  key: string;
  name: string;
  address: string;
  countryCode: string;
  lat: number;
  lng: number;
  starRating: number;
  selfRated: boolean;
  /** 0–10 fra KAYAK. `null` når hotellet ikke er vurdert. */
  guestRating: number | null;
  numberOfReviews: number;
  /** Kort setning fra KAYAK (f.eks. «Fabulous, 8.5»). */
  ratingSentiment?: string;
  distanceKm: number | null;
  /** Hotellets egne bilder. Tom liste = vi viser en nøytral plassholder, aldri et tilfeldig foto. */
  images: HotelImage[];
  lowestTotal: number | null;
  currency: string;
  nights: number;
  numberOfProviders: number;
  rates: HotelRateOffer[];
  greatValue: boolean;
}

export interface HotelSearchResult {
  provider: "kayak";
  sandbox: boolean;
  complete: boolean;
  destination: HotelPlace | null;
  checkin: string;
  checkout: string;
  nights: number;
  rooms: string;
  currency: string;
  totalResults: number;
  results: HotelSummary[];
  /** Laveste/høyeste totalpris i søket (for filter). */
  priceRange: { min: number; max: number } | null;
}

export interface HotelDetailResult {
  provider: "kayak";
  sandbox: boolean;
  complete: boolean;
  hotel: HotelSummary & {
    description?: string;
    policies: { code: string; name: string; description: string }[];
    featureSummary: { name: string; description: string }[];
    reviewQuotes: string[];
  };
}

export interface HotelsStatus {
  enabled: boolean;
  mode: "sandbox" | "production";
  /** Alltid ekstern bestilling – HelloSky selger ikke hotellrom. */
  externalBooking: true;
}
