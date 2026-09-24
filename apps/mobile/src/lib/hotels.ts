import type { HotelRateOffer, HotelSummary, HotelsStatus } from "@contracts/hotels";
import { addDays } from "./format";
import { WEB_BASE } from "./config";

/**
 * Hotellsøket i appen: ett opphold (sted, datoer, gjester og rom) som går
 * uendret fra skjemaet til resultatene og detaljene via ruteparametere.
 * Samme grenser som serveren (api/hotels.ts): 1–4 rom, 1–8 voksne per rom,
 * inntil 6 barn (0–17 år), innsjekk tidligst i dag og høyst 30 netter.
 */

export const HOTEL_LIMITS = { rooms: 4, adults: 8, children: 6, childAge: 17, nights: 30 } as const;

export type HotelStay = {
  /** KAYAK-stedets nøkkel (kplace:…, khotel:…); aldri fritekst. */
  placeKey: string;
  /** Stedets navn slik kunden valgte det. */
  placeName: string;
  checkin: string;
  checkout: string;
  adults: number;
  childAges: number[];
  rooms: number;
};

export type HotelRoom = { adults: number; childAges?: number[] };

export type HotelStayError = "place" | "checkin_past" | "checkout_order" | "too_long" | "rooms_adults";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const PLACE = /^(kplace|khotel|khotels|klatlon):[A-Za-z0-9.,;:_-]{1,200}$/;

export function nightsOf(checkin: string, checkout: string): number {
  return Math.round((Date.parse(`${checkout}T00:00:00Z`) - Date.parse(`${checkin}T00:00:00Z`)) / 86_400_000);
}

/** Standardopphold: innsjekk om to uker, to netter. */
export function defaultDates(today: string): { checkin: string; checkout: string } {
  const checkin = addDays(today, 14);
  return { checkin, checkout: addDays(checkin, 2) };
}

/** Første feil i oppholdet (samme regler som serveren), eller null. */
export function stayError(stay: HotelStay, today: string): HotelStayError | null {
  if (!PLACE.test(stay.placeKey) || stay.placeKey.length < 6) return "place";
  if (stay.checkin < today) return "checkin_past";
  if (stay.checkout <= stay.checkin) return "checkout_order";
  if (nightsOf(stay.checkin, stay.checkout) > HOTEL_LIMITS.nights) return "too_long";
  if (stay.rooms < 1 || stay.rooms > HOTEL_LIMITS.rooms || stay.adults < stay.rooms || stay.adults > HOTEL_LIMITS.adults) return "rooms_adults";
  return null;
}

/**
 * Gjestene fordelt på rom, slik nettet gjør: voksne så jevnt som mulig (minst
 * én per rom), barna etter tur. Forutsetter adults >= rooms.
 */
export function splitRooms(adults: number, childAges: readonly number[], rooms: number): HotelRoom[] {
  const n = Math.max(1, Math.min(rooms, adults));
  const out = Array.from({ length: n }, (_, i) => ({ adults: Math.floor(adults / n) + (i < adults % n ? 1 : 0), childAges: [] as number[] }));
  childAges.forEach((age, i) => out[i % n]!.childAges.push(age));
  return out.map((r) => (r.childAges.length ? r : { adults: r.adults }));
}

// ─── Ruteparametere ─────────────────────────────────────────────────────────

export type StayParams = { sted: string; navn: string; inn: string; ut: string; voksne: string; barn: string; rom: string };

export function stayParams(stay: HotelStay): StayParams {
  return { sted: stay.placeKey, navn: stay.placeName, inn: stay.checkin, ut: stay.checkout, voksne: String(stay.adults), barn: stay.childAges.join(","), rom: String(stay.rooms) };
}

const int = (v: unknown) => (typeof v === "string" && /^\d{1,2}$/.test(v) ? Number(v) : NaN);

/** Oppholdet fra ruteparametere; null når noe mangler eller er ugyldig (da søkes det ikke). */
export function stayFromParams(p: Partial<Record<keyof StayParams, string | string[]>>): HotelStay | null {
  const one = (k: keyof StayParams) => (Array.isArray(p[k]) ? p[k][0] : p[k]);
  const placeKey = one("sted") ?? "";
  const checkin = one("inn") ?? "";
  const checkout = one("ut") ?? "";
  const adults = int(one("voksne"));
  const rooms = int(one("rom"));
  const kids = one("barn") ?? "";
  const childAges = kids ? kids.split(",").map(int) : [];
  if (!PLACE.test(placeKey) || !DAY.test(checkin) || !DAY.test(checkout)) return null;
  if (!Number.isInteger(adults) || adults < 1 || adults > HOTEL_LIMITS.adults) return null;
  if (!Number.isInteger(rooms) || rooms < 1 || rooms > HOTEL_LIMITS.rooms || rooms > adults) return null;
  if (childAges.length > HOTEL_LIMITS.children || childAges.some((a) => !Number.isInteger(a) || a < 0 || a > HOTEL_LIMITS.childAge)) return null;
  return { placeKey, placeName: one("navn") ?? "", checkin, checkout, adults, childAges, rooms };
}

// ─── Priser og videresending ────────────────────────────────────────────────

/**
 * Leverandørens beløp i øre – bare når det er oppgitt i NOK. Appen formaterer
 * bare kroner og regner aldri om: et beløp i en annen valuta vises ikke som tall.
 */
export function nokMinor(amount: number | null | undefined, currency: string | null | undefined): number | null {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) return null;
  if ((currency ?? "").trim().toUpperCase() !== "NOK") return null;
  const minor = Math.round(amount * 100);
  return Number.isSafeInteger(minor) ? minor : null;
}

// Leverandørens hotellbeløp leses BARE her, og kommer bare ut som kroner (øre)
// eller null. Resten av appen ser aldri et beløp i en annen valuta
// (se «kildekoden viser aldri leverandørens beløp» i pricing.test.ts).

/** Totalpris for hele oppholdet i øre, når leverandøren oppga den i NOK. */
export function rateTotalNok(rate: HotelRateOffer): number | null {
  return nokMinor(rate.totalAmount, rate.currency);
}

/** Pris per natt (serverens total / netter) i øre, når den er i NOK. */
export function ratePerNightNok(rate: HotelRateOffer): number | null {
  return nokMinor(rate.perNightAmount, rate.currency);
}

/** Leverandørenes rom, billigste NOK-totalpris først; rom uten NOK-pris sist i leverandørens rekkefølge. */
export function ratesByTotal(rates: readonly HotelRateOffer[]): HotelRateOffer[] {
  const indexed = rates.map((rate, i) => ({ rate, i, nok: rateTotalNok(rate) }));
  indexed.sort((a, b) => {
    if (a.nok !== null && b.nok !== null && a.nok !== b.nok) return a.nok - b.nok;
    if (a.nok === null && b.nok !== null) return 1;
    if (a.nok !== null && b.nok === null) return -1;
    return a.i - b.i;
  });
  return indexed.map((x) => x.rate);
}

/** Rommet med laveste totalpris (vi stoler ikke på serverens rekkefølge), eller null. */
export function cheapestRate(hotel: Pick<HotelSummary, "rates">): HotelRateOffer | null {
  return ratesByTotal(hotel.rates)[0] ?? null;
}

/** Hotellets laveste totalpris i øre (NOK), eller null. */
export function hotelTotalNok(hotel: Pick<HotelSummary, "rates">): number | null {
  const best = cheapestRate(hotel);
  return best ? rateTotalNok(best) : null;
}

export type HandoffBlock = "unverified" | "sandbox" | "disabled" | "invalid_link" | null;

/**
 * Om kunden kan sendes videre til leverandøren for denne raten. Bare når
 * hotellsøk er slått på i produksjon, svaret ikke er testdata (sandbox), og
 * lenken er KAYAKs egen https-lenke. Ellers: hvorfor ikke. Uten statussvar
 * (null) er ingenting bekreftet – da sendes ingen videre.
 */
export function handoffBlock(status: HotelsStatus | null, sandbox: boolean, bookUrl: string): HandoffBlock {
  if (!status) return "unverified";
  if (!status.enabled) return "disabled";
  if (sandbox || status.mode !== "production") return "sandbox";
  try {
    if (new URL(bookUrl).protocol !== "https:") return "invalid_link";
  } catch {
    return "invalid_link";
  }
  return null;
}

/** Nettets hotellforespørsel (hellosky.no/hotell-bil), med stedet ferdig utfylt når kunden har valgt et. */
export function hotelInquiryUrl(placeName?: string): string {
  const sted = placeName?.trim();
  return `${WEB_BASE}/hotell-bil?fane=hotell${sted ? `&sted=${encodeURIComponent(sted)}` : ""}`;
}
