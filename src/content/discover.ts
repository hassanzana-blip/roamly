/**
 * Roamly destination discovery data — separated from rendering.
 *
 * Photography: all images are local, optimised assets in /public/destinations.
 * Sources are licence-safe (Unsplash Licence / Pexels Licence) and every
 * photograph was manually verified to show the actual destination.
 * No ratings, review counts, discounts or scarcity claims — a card shows
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
};

export function departDate(daysAhead: number): string {
  return new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10);
}

/** Prefilled live search from Oslo for one adult in economy. */
export function searchHref(iata: string, daysAhead = 35): string {
  return `/sok?from=OSL&to=${iata}&depart=${departDate(daysAhead)}&adults=1&children=0&infants=0&cabin=economy`;
}

const img = (name: string) => `/destinations/${name}.jpg`;

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
