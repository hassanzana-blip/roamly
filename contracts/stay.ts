/**
 * Hotell- og leiebilkatalog (demomodus).
 * Deterministisk generering fra sted+dato — samme søk gir alltid samme
 * resultater og priser. Priser er veiledende demopriser, aldri fabrikkert
 * som «sanntidspriser» fra en leverandør.
 */

// ─── Typer ──────────────────────────────────────────────────────────────────

export interface HotelResult {
  id: string;
  name: string;
  stars: number; // 3–5
  rating: number; // 7.5–9.6
  reviews: number;
  area: string;
  distanceKm: number;
  image: string;
  amenities: string[];
  pricePerNight: number; // NOK
  nights: number;
  totalPrice: number; // hele oppholdet
  breakfastIncluded: boolean;
  freeCancellation: boolean;
}

export interface CarResult {
  id: string;
  partner: string;
  model: string;
  className: string;
  seats: number;
  doors: number;
  bags: number;
  transmission: "Manuell" | "Automat";
  pricePerDay: number; // NOK
  days: number;
  totalPrice: number;
  freeCancellation: boolean;
  unlimitedKm: boolean;
}

// ─── Deterministisk hashing (samme mønster som demo-flights) ───────────────

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.floor(seed * arr.length) % arr.length];
}

// ─── Hotelldata ─────────────────────────────────────────────────────────────

const HOTEL_STYLES = [
  { pre: ["Grand Hotel", "Hotel", "Scandic-lignende", "Boutique"], suf: ["Palace", "Central", "Plaza", "Royal", "Nordic", "Riverside", "Old Town", "Garden", "Harbour", "Opera"] },
];
const AREAS = ["Sentrum", "Gamlebyen", "Ved havnen", "Nær sentralstasjonen", "Teaterkvartalet", "Ved parken", "Strandpromenaden", "Flyplassområdet"];
const AMENITIES = [
  "Frokostbuffé", "Gratis Wi-Fi", "Treningsrom", "Bar", "Takterrasse",
  "Basseng", "Spa", "Kjæledyr tillatt", "Romservice", "Parkering",
];
// Tilgjengelige destinasjonsbilder (må finnes i public/destinations)
const HOTEL_IMAGES = [
  "barcelona", "rome", "paris", "london", "dubai", "istanbul",
  "lisboa", "malaga", "athens", "nyc", "bangkok", "tokyo",
  "marrakech", "tromso", "warsaw", "beirut",
];

const COUNT = 10;

export function searchHotels(place: string, checkin: string, checkout: string, guests: number): HotelResult[] {
  const nights = Math.max(1, Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86_400_000));
  const key = place.trim().toLowerCase();
  const out: HotelResult[] = [];
  for (let i = 0; i < COUNT; i++) {
    const seed = hash(`${key}:${checkin}:${i}`);
    const name = `${pick(HOTEL_STYLES[0].pre, seed)} ${key.charAt(0).toUpperCase() + key.slice(1)} ${pick(HOTEL_STYLES[0].suf, hash(key + i + "s"))}`;
    const stars = 3 + Math.floor(hash(key + i + "star") * 3); // 3–5
    const rating = Math.round((7.5 + hash(key + i + "rat") * 2.1) * 10) / 10;
    const reviews = 180 + Math.floor(hash(key + i + "rev") * 2400);
    const guestFactor = 1 + Math.max(0, guests - 1) * 0.22;
    const base = (780 + hash(key + i + "pris") * 2100) * guestFactor * (1 + (stars - 3) * 0.3);
    const pricePerNight = Math.round(base / 10) * 10;
    const am = [...AMENITIES].sort((a, b2) => hash(key + i + a) - hash(key + i + b2)).slice(0, 4);
    out.push({
      id: `hot_${hash(key + checkin + checkout + i).toString(36).slice(2, 10)}`,
      name,
      stars,
      rating,
      reviews,
      area: pick(AREAS, hash(key + i + "omr")),
      distanceKm: Math.round(hash(key + i + "dist") * 48) / 10 + 0.3,
      image: `/destinations/${HOTEL_IMAGES[Math.floor(hash(key + i + "img") * HOTEL_IMAGES.length)]}.jpg`,
      amenities: am,
      pricePerNight,
      nights,
      totalPrice: pricePerNight * nights,
      breakfastIncluded: am.includes("Frokostbuffé"),
      freeCancellation: hash(key + i + "avb") > 0.3,
    });
  }
  return out.sort((a, b) => a.totalPrice - b.totalPrice);
}

// ─── Bildata ────────────────────────────────────────────────────────────────

const CAR_MODELS: Record<string, { models: string[]; seats: number; doors: number; bags: number; base: number }> = {
  "Liten og smart": { models: ["Toyota Aygo", "VW Up!", "Hyundai i10", "Fiat 500"], seats: 4, doors: 5, bags: 2, base: 420 },
  "Kompakt": { models: ["VW Golf", "Toyota Corolla", "Ford Focus", "Mazda 3"], seats: 5, doors: 5, bags: 3, base: 560 },
  "Familiebil / SUV": { models: ["Volvo XC60", "Skoda Kodiaq", "Toyota RAV4", "VW Tiguan"], seats: 5, doors: 5, bags: 4, base: 790 },
  "Premium": { models: ["BMW 5-serie", "Mercedes E-klasse", "Audi A6", "Volvo V90"], seats: 5, doors: 4, bags: 4, base: 1150 },
  "Elbil": { models: ["Tesla Model 3", "Polestar 2", "VW ID.4", "Hyundai Ioniq 5"], seats: 5, doors: 5, bags: 3, base: 690 },
};
const CAR_PARTNERS_LIST = ["Europcar", "Hertz", "Avis", "Sixt"];

export function searchCars(place: string, pickupDate: string, returnDate: string): CarResult[] {
  const days = Math.max(1, Math.round((Date.parse(returnDate) - Date.parse(pickupDate)) / 86_400_000));
  const key = place.trim().toLowerCase();
  const out: CarResult[] = [];
  const classes = Object.keys(CAR_MODELS);
  for (const cls of classes) {
    const spec = CAR_MODELS[cls];
    for (const partner of CAR_PARTNERS_LIST) {
      const seed = hash(`${key}:${pickupDate}:${cls}:${partner}`);
      const model = pick(spec.models, seed);
      const pricePerDay = Math.round((spec.base * (0.88 + hash(key + cls + partner) * 0.42)) / 10) * 10;
      out.push({
        id: `car_${hash(key + pickupDate + cls + partner).toString(36).slice(2, 10)}`,
        partner,
        model,
        className: cls,
        seats: spec.seats,
        doors: spec.doors,
        bags: spec.bags,
        transmission: hash(key + cls + partner + "gir") > 0.5 ? "Automat" : "Manuell",
        pricePerDay,
        days,
        totalPrice: pricePerDay * days,
        freeCancellation: hash(key + cls + partner + "avb") > 0.25,
        unlimitedKm: hash(key + cls + partner + "km") > 0.35,
      });
    }
  }
  return out.sort((a, b) => a.totalPrice - b.totalPrice);
}
