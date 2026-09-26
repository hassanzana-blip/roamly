import type { ImageSourcePropType } from "react-native";
import type { Locale } from "../i18n/types";

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
  /** Hva bildet viser (alternativ tekst), på begge språk. */
  caption: Record<Locale, string>;
  /** Opphav og lisens, som i nettets kredittregister (/fotokreditering). */
  source: "Unsplash";
  /** Fotografens navn når det er registrert – registeret har det ikke ennå, og vi dikter det ikke opp. */
  photographer?: string;
};

export type Photo = { id: string; image: ImageSourcePropType; credit: PhotoCredit };

export type PlaceNames = { city: string; country: string; /** Flyplassen `iata` (norsk navn som i det delte flyplassregisteret). */ airport: string };

export type Destination = {
  id: string;
  iata: string;
  airports: string[];
  /** By, land og flyplass på hvert språk. Søket bruker alltid `iata`. */
  names: Record<Locale, PlaceNames>;
  photo: Photo;
};

const photo = (id: string, image: ImageSourcePropType, caption: Record<Locale, string>): Photo => ({ id, image, credit: { caption, source: "Unsplash" } });

export const DESTINATIONS: Destination[] = [
  { id: "barcelona", iata: "BCN", airports: ["BCN"], names: { en: { city: "Barcelona", country: "Spain", airport: "Barcelona–El Prat" }, nb: { city: "Barcelona", country: "Spania", airport: "Barcelona-El Prat" } }, photo: photo("barcelona", require("../../assets/photos/barcelona.jpg"), { en: "Barcelona from above with the Sagrada Família", nb: "Barcelona sett ovenfra med Sagrada Família" }) },
  { id: "london", iata: "LHR", airports: ["LHR", "LGW", "STN", "LTN", "LCY"], names: { en: { city: "London", country: "United Kingdom", airport: "London Heathrow" }, nb: { city: "London", country: "Storbritannia", airport: "London Heathrow Airport" } }, photo: photo("london", require("../../assets/photos/london.jpg"), { en: "Tower Bridge over the Thames, London", nb: "Tower Bridge over Themsen, London" }) },
  { id: "rome", iata: "FCO", airports: ["FCO", "CIA"], names: { en: { city: "Rome", country: "Italy", airport: "Rome Fiumicino" }, nb: { city: "Roma", country: "Italia", airport: "Roma Fiumicino" } }, photo: photo("rome", require("../../assets/photos/rome.jpg"), { en: "The Colosseum in Rome", nb: "Colosseum i Roma" }) },
  { id: "paris", iata: "CDG", airports: ["CDG", "ORY"], names: { en: { city: "Paris", country: "France", airport: "Paris Charles de Gaulle" }, nb: { city: "Paris", country: "Frankrike", airport: "Paris Charles de Gaulle" } }, photo: photo("paris", require("../../assets/photos/paris.jpg"), { en: "The Eiffel Tower and the Seine at dusk, Paris", nb: "Eiffeltårnet og Seinen i kveldslys, Paris" }) },
  { id: "lisboa", iata: "LIS", airports: ["LIS"], names: { en: { city: "Lisbon", country: "Portugal", airport: "Lisbon Humberto Delgado" }, nb: { city: "Lisboa", country: "Portugal", airport: "Lisboa Humberto Delgado" } }, photo: photo("lisboa", require("../../assets/photos/lisboa.jpg"), { en: "Yellow tram, line 28, in the streets of Lisbon", nb: "Gul trikk, linje 28, i Lisboas gater" }) },
  { id: "athens", iata: "ATH", airports: ["ATH"], names: { en: { city: "Athens", country: "Greece", airport: "Athens" }, nb: { city: "Athen", country: "Hellas", airport: "Athen" } }, photo: photo("athens", require("../../assets/photos/athens.jpg"), { en: "The Parthenon on the Acropolis, Athens", nb: "Parthenon på Akropolis, Athen" }) },
  { id: "malaga", iata: "AGP", airports: ["AGP"], names: { en: { city: "Málaga", country: "Spain", airport: "Málaga–Costa del Sol" }, nb: { city: "Málaga", country: "Spania", airport: "Málaga-Costa del Sol" } }, photo: photo("malaga", require("../../assets/photos/malaga.jpg"), { en: "A square with palm trees in Málaga", nb: "Plass med palmer i Málaga" }) },
  { id: "warszawa", iata: "WAW", airports: ["WAW"], names: { en: { city: "Warsaw", country: "Poland", airport: "Warsaw Chopin" }, nb: { city: "Warszawa", country: "Polen", airport: "Warszawa Chopin" } }, photo: photo("warszawa", require("../../assets/photos/warszawa.jpg"), { en: "The Palace of Culture in Warsaw at night", nb: "Kulturpalasset i Warszawa om kvelden" }) },
  { id: "tromso", iata: "TOS", airports: ["TOS"], names: { en: { city: "Tromsø", country: "Norway", airport: "Tromsø Airport" }, nb: { city: "Tromsø", country: "Norge", airport: "Tromsø lufthavn" } }, photo: photo("tromso", require("../../assets/photos/tromso.jpg"), { en: "Northern lights over a snowy landscape near Tromsø", nb: "Nordlys over snødekt landskap ved Tromsø" }) },
  { id: "istanbul", iata: "IST", airports: ["IST", "SAW"], names: { en: { city: "Istanbul", country: "Türkiye", airport: "Istanbul" }, nb: { city: "Istanbul", country: "Türkiye", airport: "Istanbul" } }, photo: photo("istanbul", require("../../assets/photos/istanbul.jpg"), { en: "Galata Tower above the rooftops of Istanbul", nb: "Galatatårnet over Istanbuls tak" }) },
  { id: "dubai", iata: "DXB", airports: ["DXB", "DWC"], names: { en: { city: "Dubai", country: "United Arab Emirates", airport: "Dubai" }, nb: { city: "Dubai", country: "Emiratene", airport: "Dubai" } }, photo: photo("dubai", require("../../assets/photos/dubai.jpg"), { en: "Dubai Marina with the Burj Khalifa on the horizon", nb: "Dubai Marina med Burj Khalifa i horisonten" }) },
  { id: "beirut", iata: "BEY", airports: ["BEY"], names: { en: { city: "Beirut", country: "Lebanon", airport: "Beirut Rafic Hariri" }, nb: { city: "Beirut", country: "Libanon", airport: "Beirut Rafic Hariri" } }, photo: photo("beirut", require("../../assets/photos/beirut.jpg"), { en: "Pigeon Rocks at Raouché at sunset, Beirut", nb: "Dueklippene i Raouché ved solnedgang, Beirut" }) },
  { id: "erbil", iata: "EBL", airports: ["EBL"], names: { en: { city: "Erbil", country: "Kurdistan Region (Iraq)", airport: "Erbil International Airport" }, nb: { city: "Erbil", country: "Kurdistan (Irak)", airport: "Erbil internasjonale lufthavn" } }, photo: photo("erbil", require("../../assets/photos/erbil.jpg"), { en: "The Citadel of Erbil", nb: "Citadellet i Erbil" }) },
  { id: "sulaymaniyah", iata: "ISU", airports: ["ISU"], names: { en: { city: "Sulaymaniyah", country: "Kurdistan Region (Iraq)", airport: "Sulaymaniyah International Airport" }, nb: { city: "Sulaymaniyah", country: "Kurdistan (Irak)", airport: "Sulaymaniyah internasjonale lufthavn" } }, photo: photo("sulaymaniyah", require("../../assets/photos/sulaymaniyah.jpg"), { en: "Sulaymaniyah with snow-capped mountains behind", nb: "Sulaymaniyah by med snødekte fjell i bakgrunnen" }) },
  { id: "jeddah", iata: "JED", airports: ["JED"], names: { en: { city: "Jeddah", country: "Saudi Arabia", airport: "King Abdulaziz International Airport" }, nb: { city: "Jeddah", country: "Saudi-Arabia", airport: "King Abdulaziz internasjonale lufthavn" } }, photo: photo("jeddah", require("../../assets/photos/jeddah.jpg"), { en: "King Fahd's Fountain on the Jeddah Corniche at blue hour", nb: "King Fahd-fontenen ved Jeddah-cornichen i blåtimen" }) },
  { id: "marrakech", iata: "RAK", airports: ["RAK"], names: { en: { city: "Marrakech", country: "Morocco", airport: "Marrakech Menara" }, nb: { city: "Marrakech", country: "Marokko", airport: "Marrakech Menara" } }, photo: photo("marrakech", require("../../assets/photos/marrakech.jpg"), { en: "The Koutoubia Mosque in Marrakech", nb: "Koutoubia-moskeen i Marrakech" }) },
  { id: "bangkok", iata: "BKK", airports: ["BKK", "DMK"], names: { en: { city: "Bangkok", country: "Thailand", airport: "Bangkok Suvarnabhumi" }, nb: { city: "Bangkok", country: "Thailand", airport: "Bangkok Suvarnabhumi" } }, photo: photo("bangkok", require("../../assets/photos/bangkok.jpg"), { en: "Neon lights and tuk-tuks in Bangkok's Chinatown", nb: "Neonlys og tuk-tuk i Bangkoks Chinatown" }) },
  { id: "tokyo", iata: "HND", airports: ["HND", "NRT"], names: { en: { city: "Tokyo", country: "Japan", airport: "Tokyo Haneda" }, nb: { city: "Tokyo", country: "Japan", airport: "Tokyo Haneda" } }, photo: photo("tokyo", require("../../assets/photos/tokyo.jpg"), { en: "Shibuya Crossing in Tokyo at night", nb: "Shibuya-krysset i Tokyo om kvelden" }) },
  { id: "colombo", iata: "CMB", airports: ["CMB"], names: { en: { city: "Colombo", country: "Sri Lanka", airport: "Colombo Bandaranaike" }, nb: { city: "Colombo", country: "Sri Lanka", airport: "Colombo Bandaranaike" } }, photo: photo("colombo", require("../../assets/photos/colombo.jpg"), { en: "A train on the Nine Arches Bridge in Ella, Sri Lanka", nb: "Tog over Nine Arches-broen i Ella, Sri Lanka" }) },
  { id: "delhi", iata: "DEL", airports: ["DEL"], names: { en: { city: "New Delhi", country: "India", airport: "New Delhi" }, nb: { city: "New Delhi", country: "India", airport: "New Delhi" } }, photo: photo("delhi", require("../../assets/photos/delhi.jpg"), { en: "India Gate in New Delhi", nb: "India Gate i New Delhi" }) },
  { id: "dhaka", iata: "DAC", airports: ["DAC"], names: { en: { city: "Dhaka", country: "Bangladesh", airport: "Dhaka Hazrat Shahjalal" }, nb: { city: "Dhaka", country: "Bangladesh", airport: "Dhaka Hazrat Shahjalal" } }, photo: photo("dhaka", require("../../assets/photos/dhaka.jpg"), { en: "Colourful rickshaws in the streets of Dhaka", nb: "Fargerike rickshawer i Dhakas gater" }) },
  { id: "islamabad", iata: "ISB", airports: ["ISB"], names: { en: { city: "Islamabad", country: "Pakistan", airport: "Islamabad International Airport" }, nb: { city: "Islamabad", country: "Pakistan", airport: "Islamabad internasjonale lufthavn" } }, photo: photo("islamabad", require("../../assets/photos/islamabad.jpg"), { en: "Faisal Mosque in Islamabad at dusk", nb: "Faisal-moskeen i Islamabad i skumringen" }) },
  { id: "kabul", iata: "KBL", airports: ["KBL"], names: { en: { city: "Kabul", country: "Afghanistan", airport: "Kabul International Airport" }, nb: { city: "Kabul", country: "Afghanistan", airport: "Kabul internasjonale lufthavn" } }, photo: photo("kabul", require("../../assets/photos/kabul.jpg"), { en: "Kabul at sunset with mountains behind", nb: "Kabul by i solnedgang med fjell i bakgrunnen" }) },
  { id: "nyc", iata: "JFK", airports: ["JFK", "EWR", "LGA"], names: { en: { city: "New York", country: "United States", airport: "New York JFK" }, nb: { city: "New York", country: "USA", airport: "New York JFK" } }, photo: photo("nyc", require("../../assets/photos/nyc.jpg"), { en: "Times Square in New York", nb: "Times Square i New York" }) },
];

/** De tre på forsiden, som i referansen. */
export const FEATURED = ["barcelona", "london", "rome"].map((id) => DESTINATIONS.find((d) => d.id === id)!);

/** Bybildet for en flyplass, eller null (da vises en nøytral mørk flate). */
export function photoForAirport(iata: string | undefined): Photo | null {
  if (!iata) return null;
  const code = iata.toUpperCase();
  return DESTINATIONS.find((d) => d.airports.includes(code))?.photo ?? null;
}

/** Reisemålet som flyplassvalg i søkeskjemaet, på brukerens språk. */
export function destinationChoice(d: Destination, locale: Locale): { iata: string; name: string; city: string; country: string } {
  const n = d.names[locale];
  return { iata: d.iata, name: n.airport, city: n.city, country: n.country };
}

/** Alle bildene appen har med seg, for kreditering i profilen. */
export const ALL_PHOTOS: Photo[] = DESTINATIONS.map((d) => d.photo);
