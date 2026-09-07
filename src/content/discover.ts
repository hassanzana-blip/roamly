/**
 * HelloSky destination discovery data – separated from rendering.
 *
 * Photography: all images are local, optimised assets in /public/destinations.
 * Sources are licence-safe (Unsplash Licence / Pexels Licence) and every
 * photograph was manually verified to show the actual destination.
 * No ratings, review counts, discounts or scarcity claims – a card shows
 * “Se flyreiser”, never invented commercial pressure.
 */

export type DiscoverDestination = {
  id: string;
  city: string;
  country: string;
  /** Airport used as search target */
  iata: string;
  /** Local asset path, undefined renders the branded route illustration */
  image?: string;
  imageAlt: string;
  tagline: string;
  /** Editorial score (HelloSky-kuratert, 1–5) – shown as a rating chip */
  rating?: number;
};

/**
 * Visumnotiser per reisemål – generell veiledning for norske pass.
 * Ikke juridisk råd: regler endres, og reisende må alltid sjekke
 * ambassaden/UDI før avreise. Vises i reisemålskortet.
 */
export const VISA_NOTES: Record<string, string> = {
  istanbul: "Nordmenn trenger ikke visum til Tyrkia for opphold inntil 90 dager. Passet må være gyldig minst 150 dager fra innreise.",
  erbil: "Visum påkrevd for Irak. Kurdistan-regionen tilbyr e-visum – søk i god tid før avreise.",
  sulaymaniyah: "Visum påkrevd for Irak. Kurdistan-regionen tilbyr e-visum – søk i god tid før avreise.",
  beirut: "Nordmenn får som regel visum ved ankomst for kortere opphold. Sjekk gjeldende regler før avreise.",
  marrakech: "Nordmenn trenger ikke visum til Marokko for opphold inntil 90 dager.",
  asmara: "Visum påkrevd – må søkes ved Eritreas ambassade i god tid før avreise.",
  kabul: "Visum påkrevd. Norske myndigheter fraråder alle reiser til Afghanistan.",
  islamabad: "Visum påkrevd for Pakistan – e-visum kan søkes på nett før avreise.",
  delhi: "Visum påkrevd. Indias e-turistvisum søkes på nett minst 4 dager før avreise.",
  dhaka: "Visum påkrevd for Bangladesh – kan ordnes på forhånd eller ved ankomst.",
  colombo: "ETA (elektronisk reisetillatelse) påkrevd for Sri Lanka – søkes på nett før avreise.",
  nyc: "Nordmenn må ha godkjent ESTA før avreise til USA – også ved transitt. Søk i god tid.",
  london: "Nordmenn må ha godkjent ETA (elektronisk reisetillatelse) før avreise til Storbritannia.",
  dubai: "Nordmenn får visum ved ankomst i Emiratene for opphold inntil 90 dager.",
  bangkok: "Nordmenn trenger ikke visum til Thailand for opphold inntil 60 dager.",
  tokyo: "Nordmenn trenger ikke visum til Japan for opphold inntil 90 dager.",
  jeddah: "Visum påkrevd for Saudi-Arabia – turistvisum (e-visum) søkes på nett.",
};

export function departDate(daysAhead: number): string {
  return new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10);
}

/** Prefilled live search from Oslo for one adult in economy. */
export function searchHref(iata: string, daysAhead = 35): string {
  return `/sok?from=OSL&to=${iata}&depart=${departDate(daysAhead)}&adults=1&children=0&infants=0&cabin=economy`;
}

const img = (name: string) => `/destinations/${name}.jpg`;

/** srcset-par: liten 640px-variant + original (1024px) for raske kort på mobil. */
export function imageSrcSet(image: string): string | undefined {
  if (!image.startsWith("/destinations/") || !image.endsWith(".jpg")) return undefined;
  return `${image.replace(/\.jpg$/, "-640.jpg")} 640w, ${image} 1024w`;
}

export const POPULAR_DESTINATIONS: DiscoverDestination[] = [
  { id: "paris", city: "Paris", country: "Frankrike", iata: "CDG", image: img("paris"), imageAlt: "Eiffeltårnet og Seinen i kveldslys, Paris", tagline: "Byen over alle byer" },
  { id: "london", city: "London", country: "Storbritannia", iata: "LHR", image: img("london"), imageAlt: "Tower Bridge over Themsen, London", tagline: "Helgeklassikeren" },
  { id: "barcelona", city: "Barcelona", country: "Spania", iata: "BCN", image: img("barcelona"), imageAlt: "Barcelona sett ovenfra med Sagrada Família", tagline: "By, strand og tapas" },
  { id: "lisboa", city: "Lisboa", country: "Portugal", iata: "LIS", image: img("lisboa"), imageAlt: "Gul trikk, linje 28, i Lisboas gater", tagline: "Trikker og utsiktspunkter" },
  { id: "rome", city: "Roma", country: "Italia", iata: "FCO", image: img("rome"), imageAlt: "Colosseum i Roma", tagline: "Den evige stad" },
  { id: "athens", city: "Athen", country: "Hellas", iata: "ATH", image: img("athens"), imageAlt: "Parthenon på Akropolis, Athen", tagline: "Antikk storby" },
  { id: "malaga", city: "Málaga", country: "Spania", iata: "AGP", image: img("malaga"), imageAlt: "Plass med palmer i Málaga", tagline: "Costa del Sols hjerte" },
  { id: "nyc", city: "New York", country: "USA", iata: "JFK", image: img("nyc"), imageAlt: "Times Square i New York", tagline: "Storbyliv" },
  { id: "dubai", city: "Dubai", country: "Emiratene", iata: "DXB", image: img("dubai"), imageAlt: "Dubai Marina med Burj Khalifa i horisonten", tagline: "Vinterens solgaranti" },
  { id: "bangkok", city: "Bangkok", country: "Thailand", iata: "BKK", image: img("bangkok"), imageAlt: "Neonlys og tuk-tuk i Bangkoks Chinatown", tagline: "Gatekjøkken og templer" },
  { id: "tokyo", city: "Tokyo", country: "Japan", iata: "HND", image: img("tokyo"), imageAlt: "Shibuya-krysset i Tokyo om kvelden", tagline: "Fremtid og tradisjon" },
  { id: "tromso", city: "Tromsø", country: "Norge", iata: "TOS", image: img("tromso"), imageAlt: "Nordlys over snødekt landskap ved Tromsø", tagline: "Nordlysbyen" },
];

export const FAMILY_DESTINATIONS: DiscoverDestination[] = [
  { id: "istanbul", city: "Istanbul", country: "Tyrkia", iata: "IST", image: img("istanbul"), imageAlt: "Galatatårnet over Istanbuls tak", tagline: "To kontinenter, én by" },
  { id: "erbil", city: "Erbil", country: "Kurdistan (Irak)", iata: "EBL", image: img("erbil"), imageAlt: "Citadellet i Erbil", tagline: "Hjem til Kurdistan" },
  { id: "beirut", city: "Beirut", country: "Libanon", iata: "BEY", image: img("beirut"), imageAlt: "Dueklippene i Raouché ved solnedgang, Beirut", tagline: "Middelhavets perle" },
  { id: "marrakech", city: "Marrakech", country: "Marokko", iata: "RAK", image: img("marrakech"), imageAlt: "Koutoubia-moskeen i Marrakech", tagline: "Medinaens magi" },
  { id: "asmara", city: "Asmara", country: "Eritrea", iata: "ASM", imageAlt: "Illustrert flyrute til Asmara", tagline: "Høylandets hovedstad" },
  { id: "kabul", city: "Kabul", country: "Afghanistan", iata: "KBL", image: img("kabul"), imageAlt: "Kabul by i solnedgang med fjell i bakgrunnen", tagline: "Byen mellom fjellene" },
  { id: "islamabad", city: "Islamabad", country: "Pakistan", iata: "ISB", image: img("islamabad"), imageAlt: "Faisal-moskeen i Islamabad i skumringen", tagline: "Ved Margalla-fjellene" },
  { id: "delhi", city: "New Delhi", country: "India", iata: "DEL", image: img("delhi"), imageAlt: "India Gate i New Delhi", tagline: "Hovedstadspuls" },
  { id: "dhaka", city: "Dhaka", country: "Bangladesh", iata: "DAC", image: img("dhaka"), imageAlt: "Fargerike rickshawer i Dhakas gater", tagline: "Rickshawenes by" },
  { id: "colombo", city: "Colombo", country: "Sri Lanka", iata: "CMB", image: img("srilanka"), imageAlt: "Tog over Nine Arches-broen i Ella, Sri Lanka", tagline: "Teåser og kyst" },
  { id: "warszawa", city: "Warszawa", country: "Polen", iata: "WAW", image: img("warsaw"), imageAlt: "Kulturpalasset i Warszawa om kvelden", tagline: "Nær og kjær" },
];

/**
 * «Anbefalt for deg» – HelloSky-kuratering for den nye app-forsiden.
 * rating er vår egen redaksjonelle score (ikke brukeranmeldelser).
 */
export const RECOMMENDED_DESTINATIONS: DiscoverDestination[] = [
  { id: "erbil", city: "Erbil", country: "Kurdistan", iata: "EBL", image: img("erbil"), imageAlt: "Citadellet i Erbil", tagline: "Kurdistan-regionen", rating: 4.8 },
  { id: "sulaymaniyah", city: "Sulaymaniyah", country: "Kurdistan", iata: "ISU", image: img("sulaymaniyah"), imageAlt: "Sulaymaniyah by med snødekte fjell i bakgrunnen", tagline: "Kurdistan-regionen", rating: 4.7 },
  { id: "istanbul", city: "Istanbul", country: "Türkiye", iata: "IST", image: img("istanbul"), imageAlt: "Galatatårnet over Istanbuls tak", tagline: "To kontinenter, én by", rating: 4.9 },
  { id: "dubai", city: "Dubai", country: "UAE", iata: "DXB", image: img("dubai"), imageAlt: "Dubai Marina med Burj Khalifa i horisonten", tagline: "Vinterens solgaranti", rating: 4.8 },
  { id: "beirut", city: "Beirut", country: "Libanon", iata: "BEY", image: img("beirut"), imageAlt: "Dueklippene i Raouché ved solnedgang, Beirut", tagline: "Middelhavets perle", rating: 4.7 },
  { id: "jeddah", city: "Jeddah", country: "Saudi-Arabia", iata: "JED", image: img("jeddah"), imageAlt: "King Fahd-fontenen ved Jeddah-cornichen i blåtimen", tagline: "Porten til Rødehavet", rating: 4.6 },
];

/**
 * «Gode tilbud» – ruter der vi henter veiledende pris fra pris-API-et.
 * Ingen rabatter eller tidsfrister er oppgitt her; kortet viser kun
 * reell «fra»-pris slik den returneres av søket (tydelig merket som
 * veiledende). Aldri fabrikkert pågang.
 */
export type DealRoute = {
  id: string;
  destination: DiscoverDestination;
  /** Avreiseflyplass for prisestimatet */
  originIata: string;
  originCity: string;
};

const byId = (id: string): DiscoverDestination =>
  RECOMMENDED_DESTINATIONS.find((d) => d.id === id)!;

export const DEAL_ROUTES: DealRoute[] = [
  { id: "deal-erbil", destination: byId("erbil"), originIata: "OSL", originCity: "Oslo" },
  { id: "deal-istanbul", destination: byId("istanbul"), originIata: "OSL", originCity: "Oslo" },
  { id: "deal-beirut", destination: byId("beirut"), originIata: "OSL", originCity: "Oslo" },
  { id: "deal-sulaymaniyah", destination: byId("sulaymaniyah"), originIata: "OSL", originCity: "Oslo" },
  { id: "deal-dubai", destination: byId("dubai"), originIata: "OSL", originCity: "Oslo" },
  { id: "deal-jeddah", destination: byId("jeddah"), originIata: "OSL", originCity: "Oslo" },
];

/** Every destination, deduped by id – for resolving saved favourites. */
export const ALL_DESTINATIONS: DiscoverDestination[] = (() => {
  const map = new Map<string, DiscoverDestination>();
  for (const d of [...RECOMMENDED_DESTINATIONS, ...POPULAR_DESTINATIONS, ...FAMILY_DESTINATIONS]) {
    if (!map.has(d.id)) map.set(d.id, d);
  }
  return [...map.values()];
})();

export function destinationById(id: string): DiscoverDestination | undefined {
  return ALL_DESTINATIONS.find((d) => d.id === id);
}
