import type { ImageSourcePropType } from "react-native";

/**
 * Reisemålene appen viser, med HelloSkys godkjente foto.
 *
 * Kopi av nettets register (src/content/discover.ts): samme by, samme
 * flyplass og samme bilde. Bildene er kopiert inn i appen av
 * scripts/make-photos.mjs, så de vises uten nett og uten et nytt bildesøk.
 *
 * `iata` er flyplassen et søk fra reisemålskortet bruker – nøyaktig den ene,
 * aldri «alle flyplasser i byen». `airports` brukes bare til å finne riktig
 * bybilde for en reise som lander på en annen flyplass i samme by.
 */

export type PhotoCredit = {
  /** Hva bildet viser (alternativ tekst). */
  caption: string;
  /** Opphav og lisens, som i nettets kredittregister (/fotokreditering). */
  source: "Unsplash";
  /** Fotografens navn når det er registrert – registeret har det ikke ennå, og vi dikter det ikke opp. */
  photographer?: string;
};

export type Photo = { id: string; image: ImageSourcePropType; credit: PhotoCredit };

export type Destination = {
  id: string;
  city: string;
  country: string;
  iata: string;
  /** Navnet på flyplassen `iata` (fra det delte flyplassregisteret). */
  airportName: string;
  airports: string[];
  photo: Photo;
};

const photo = (id: string, image: ImageSourcePropType, caption: string): Photo => ({ id, image, credit: { caption, source: "Unsplash" } });

/** Toppbildet på forsiden: ekte utsikt fra flyvinduet. */
export const HEADER_PHOTO: Photo = photo("hero-wing", require("../../assets/photos/hero-wing.jpg"), "Vinge over skylaget i solnedgang");

export const DESTINATIONS: Destination[] = [
  { id: "barcelona", city: "Barcelona", country: "Spania", iata: "BCN", airportName: "Barcelona-El Prat", airports: ["BCN"], photo: photo("barcelona", require("../../assets/photos/barcelona.jpg"), "Barcelona sett ovenfra med Sagrada Família") },
  { id: "london", city: "London", country: "Storbritannia", iata: "LHR", airportName: "London Heathrow Airport", airports: ["LHR", "LGW", "STN", "LTN", "LCY"], photo: photo("london", require("../../assets/photos/london.jpg"), "Tower Bridge over Themsen, London") },
  { id: "rome", city: "Roma", country: "Italia", iata: "FCO", airportName: "Roma Fiumicino", airports: ["FCO", "CIA"], photo: photo("rome", require("../../assets/photos/rome.jpg"), "Colosseum i Roma") },
  { id: "paris", city: "Paris", country: "Frankrike", iata: "CDG", airportName: "Paris Charles de Gaulle", airports: ["CDG", "ORY"], photo: photo("paris", require("../../assets/photos/paris.jpg"), "Eiffeltårnet og Seinen i kveldslys, Paris") },
  { id: "lisboa", city: "Lisboa", country: "Portugal", iata: "LIS", airportName: "Lisboa Humberto Delgado", airports: ["LIS"], photo: photo("lisboa", require("../../assets/photos/lisboa.jpg"), "Gul trikk, linje 28, i Lisboas gater") },
  { id: "athens", city: "Athen", country: "Hellas", iata: "ATH", airportName: "Athen", airports: ["ATH"], photo: photo("athens", require("../../assets/photos/athens.jpg"), "Parthenon på Akropolis, Athen") },
  { id: "malaga", city: "Málaga", country: "Spania", iata: "AGP", airportName: "Málaga-Costa del Sol", airports: ["AGP"], photo: photo("malaga", require("../../assets/photos/malaga.jpg"), "Plass med palmer i Málaga") },
  { id: "warszawa", city: "Warszawa", country: "Polen", iata: "WAW", airportName: "Warszawa Chopin", airports: ["WAW"], photo: photo("warszawa", require("../../assets/photos/warszawa.jpg"), "Kulturpalasset i Warszawa om kvelden") },
  { id: "tromso", city: "Tromsø", country: "Norge", iata: "TOS", airportName: "Tromsø lufthavn", airports: ["TOS"], photo: photo("tromso", require("../../assets/photos/tromso.jpg"), "Nordlys over snødekt landskap ved Tromsø") },
  { id: "istanbul", city: "Istanbul", country: "Türkiye", iata: "IST", airportName: "Istanbul", airports: ["IST", "SAW"], photo: photo("istanbul", require("../../assets/photos/istanbul.jpg"), "Galatatårnet over Istanbuls tak") },
  { id: "dubai", city: "Dubai", country: "Emiratene", iata: "DXB", airportName: "Dubai", airports: ["DXB", "DWC"], photo: photo("dubai", require("../../assets/photos/dubai.jpg"), "Dubai Marina med Burj Khalifa i horisonten") },
  { id: "beirut", city: "Beirut", country: "Libanon", iata: "BEY", airportName: "Beirut Rafic Hariri", airports: ["BEY"], photo: photo("beirut", require("../../assets/photos/beirut.jpg"), "Dueklippene i Raouché ved solnedgang, Beirut") },
  { id: "erbil", city: "Erbil", country: "Kurdistan (Irak)", iata: "EBL", airportName: "Erbil internasjonale lufthavn", airports: ["EBL"], photo: photo("erbil", require("../../assets/photos/erbil.jpg"), "Citadellet i Erbil") },
  { id: "sulaymaniyah", city: "Sulaymaniyah", country: "Kurdistan (Irak)", iata: "ISU", airportName: "Sulaymaniyah internasjonale lufthavn", airports: ["ISU"], photo: photo("sulaymaniyah", require("../../assets/photos/sulaymaniyah.jpg"), "Sulaymaniyah by med snødekte fjell i bakgrunnen") },
  { id: "jeddah", city: "Jeddah", country: "Saudi-Arabia", iata: "JED", airportName: "King Abdulaziz internasjonale lufthavn", airports: ["JED"], photo: photo("jeddah", require("../../assets/photos/jeddah.jpg"), "King Fahd-fontenen ved Jeddah-cornichen i blåtimen") },
  { id: "marrakech", city: "Marrakech", country: "Marokko", iata: "RAK", airportName: "Marrakech Menara", airports: ["RAK"], photo: photo("marrakech", require("../../assets/photos/marrakech.jpg"), "Koutoubia-moskeen i Marrakech") },
  { id: "bangkok", city: "Bangkok", country: "Thailand", iata: "BKK", airportName: "Bangkok Suvarnabhumi", airports: ["BKK", "DMK"], photo: photo("bangkok", require("../../assets/photos/bangkok.jpg"), "Neonlys og tuk-tuk i Bangkoks Chinatown") },
  { id: "tokyo", city: "Tokyo", country: "Japan", iata: "HND", airportName: "Tokyo Haneda", airports: ["HND", "NRT"], photo: photo("tokyo", require("../../assets/photos/tokyo.jpg"), "Shibuya-krysset i Tokyo om kvelden") },
  { id: "colombo", city: "Colombo", country: "Sri Lanka", iata: "CMB", airportName: "Colombo Bandaranaike", airports: ["CMB"], photo: photo("colombo", require("../../assets/photos/colombo.jpg"), "Tog over Nine Arches-broen i Ella, Sri Lanka") },
  { id: "delhi", city: "New Delhi", country: "India", iata: "DEL", airportName: "New Delhi", airports: ["DEL"], photo: photo("delhi", require("../../assets/photos/delhi.jpg"), "India Gate i New Delhi") },
  { id: "dhaka", city: "Dhaka", country: "Bangladesh", iata: "DAC", airportName: "Dhaka Hazrat Shahjalal", airports: ["DAC"], photo: photo("dhaka", require("../../assets/photos/dhaka.jpg"), "Fargerike rickshawer i Dhakas gater") },
  { id: "islamabad", city: "Islamabad", country: "Pakistan", iata: "ISB", airportName: "Islamabad internasjonale lufthavn", airports: ["ISB"], photo: photo("islamabad", require("../../assets/photos/islamabad.jpg"), "Faisal-moskeen i Islamabad i skumringen") },
  { id: "kabul", city: "Kabul", country: "Afghanistan", iata: "KBL", airportName: "Kabul internasjonale lufthavn", airports: ["KBL"], photo: photo("kabul", require("../../assets/photos/kabul.jpg"), "Kabul by i solnedgang med fjell i bakgrunnen") },
  { id: "nyc", city: "New York", country: "USA", iata: "JFK", airportName: "New York JFK", airports: ["JFK", "EWR", "LGA"], photo: photo("nyc", require("../../assets/photos/nyc.jpg"), "Times Square i New York") },
];

/** De tre på forsiden, som i referansen. */
export const FEATURED = ["barcelona", "london", "rome"].map((id) => DESTINATIONS.find((d) => d.id === id)!);

/** Bybildet for en flyplass, eller null (da vises en nøytral mørk flate). */
export function photoForAirport(iata: string | undefined): Photo | null {
  if (!iata) return null;
  const code = iata.toUpperCase();
  return DESTINATIONS.find((d) => d.airports.includes(code))?.photo ?? null;
}

/** Alle bildene appen har med seg, for kreditering i profilen. */
export const ALL_PHOTOS: Photo[] = [HEADER_PHOTO, ...DESTINATIONS.map((d) => d.photo)];
