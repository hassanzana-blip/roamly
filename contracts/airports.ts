import type { AirportPoint } from "./types";

export interface Airport extends AirportPoint {
  /**
   * IANA-tidssone. Satt for det kuraterte settet under, som er flyplassene
   * HelloSky kjenner godt. Flyplasser som kommer fra det utvidede
   * OurAirports-registeret har den ikke – der er leverandørens `time_zone`
   * per strekning fasit, og `zoneFor()` faller tilbake på den.
   */
  timeZone?: string;
  countryCode: string;
  popular?: boolean;
  /** Fra det utvidede verdensregisteret, ikke det kuraterte settet. */
  world?: boolean;
}

// Nordic-first airport directory with world hubs.
// Coordinates power the 3D globe arcs on the homepage.
export const AIRPORTS: Airport[] = [
  // ── Norge ──
  { iata: "OSL", name: "Oslo lufthavn Gardermoen", city: "Oslo", country: "Norge", countryCode: "NO", lat: 60.1939, lng: 11.1004, timeZone: "Europe/Oslo", popular: true },
  { iata: "BGO", name: "Bergen lufthavn Flesland", city: "Bergen", country: "Norge", countryCode: "NO", lat: 60.2934, lng: 5.2181, timeZone: "Europe/Oslo", popular: true },
  { iata: "TRD", name: "Trondheim lufthavn Værnes", city: "Trondheim", country: "Norge", countryCode: "NO", lat: 63.4578, lng: 10.924, timeZone: "Europe/Oslo", popular: true },
  { iata: "SVG", name: "Stavanger lufthavn Sola", city: "Stavanger", country: "Norge", countryCode: "NO", lat: 58.8768, lng: 5.6378, timeZone: "Europe/Oslo", popular: true },
  { iata: "TOS", name: "Tromsø lufthavn", city: "Tromsø", country: "Norge", countryCode: "NO", lat: 69.6833, lng: 18.9189, timeZone: "Europe/Oslo", popular: true },
  { iata: "BOO", name: "Bodø lufthavn", city: "Bodø", country: "Norge", countryCode: "NO", lat: 67.2692, lng: 14.3653, timeZone: "Europe/Oslo" },
  { iata: "AES", name: "Ålesund lufthavn Vigra", city: "Ålesund", country: "Norge", countryCode: "NO", lat: 62.5625, lng: 6.1197, timeZone: "Europe/Oslo" },
  { iata: "KRS", name: "Kristiansand lufthavn Kjevik", city: "Kristiansand", country: "Norge", countryCode: "NO", lat: 58.2042, lng: 8.0854, timeZone: "Europe/Oslo" },
  { iata: "HAU", name: "Haugesund lufthavn Karmøy", city: "Haugesund", country: "Norge", countryCode: "NO", lat: 59.3453, lng: 5.2084, timeZone: "Europe/Oslo" },
  { iata: "MOL", name: "Molde lufthavn Årø", city: "Molde", country: "Norge", countryCode: "NO", lat: 62.7447, lng: 7.2625, timeZone: "Europe/Oslo" },
  { iata: "EVE", name: "Harstad/Narvik lufthavn Evenes", city: "Evenes", country: "Norge", countryCode: "NO", lat: 68.4913, lng: 16.6781, timeZone: "Europe/Oslo" },
  { iata: "LYR", name: "Svalbard lufthavn Longyear", city: "Longyearbyen", country: "Norge", countryCode: "NO", lat: 78.2461, lng: 15.4656, timeZone: "Arctic/Longyearbyen" },

  // ── Norden ──
  { iata: "CPH", name: "København lufthavn Kastrup", city: "København", country: "Danmark", countryCode: "DK", lat: 55.6179, lng: 12.656, timeZone: "Europe/Copenhagen", popular: true },
  { iata: "ARN", name: "Stockholm Arlanda flyplass", city: "Stockholm", country: "Sverige", countryCode: "SE", lat: 59.6519, lng: 17.9186, timeZone: "Europe/Stockholm", popular: true },
  { iata: "GOT", name: "Göteborg Landvetter flygplats", city: "Göteborg", country: "Sverige", countryCode: "SE", lat: 57.6628, lng: 12.2798, timeZone: "Europe/Stockholm" },
  { iata: "HEL", name: "Helsingfors-Vanda flygplats", city: "Helsingfors", country: "Finland", countryCode: "FI", lat: 60.3172, lng: 24.9633, timeZone: "Europe/Helsinki" },
  { iata: "KEF", name: "Keflavík alþjóðaflugvöllur", city: "Reykjavík", country: "Island", countryCode: "IS", lat: 63.985, lng: -22.6056, timeZone: "Atlantic/Reykjavik", popular: true },

  // ── Europa ──
  { iata: "LHR", name: "London Heathrow Airport", city: "London", country: "Storbritannia", countryCode: "GB", lat: 51.47, lng: -0.4543, timeZone: "Europe/London", popular: true },
  { iata: "LGW", name: "London Gatwick Airport", city: "London", country: "Storbritannia", countryCode: "GB", lat: 51.1537, lng: -0.1821, timeZone: "Europe/London" },
  { iata: "STN", name: "London Stansted Airport", city: "London", country: "Storbritannia", countryCode: "GB", lat: 51.886, lng: 0.2389, timeZone: "Europe/London" },
  { iata: "MAN", name: "Manchester Airport", city: "Manchester", country: "Storbritannia", countryCode: "GB", lat: 53.3537, lng: -2.275, timeZone: "Europe/London" },
  { iata: "EDI", name: "Edinburgh Airport", city: "Edinburgh", country: "Storbritannia", countryCode: "GB", lat: 55.95, lng: -3.3725, timeZone: "Europe/London" },
  { iata: "CDG", name: "Paris Charles de Gaulle", city: "Paris", country: "Frankrike", countryCode: "FR", lat: 49.0097, lng: 2.5479, timeZone: "Europe/Paris", popular: true },
  { iata: "ORY", name: "Paris Orly", city: "Paris", country: "Frankrike", countryCode: "FR", lat: 48.7233, lng: 2.3794, timeZone: "Europe/Paris" },
  { iata: "NCE", name: "Nice Côte d'Azur", city: "Nice", country: "Frankrike", countryCode: "FR", lat: 43.6584, lng: 7.2159, timeZone: "Europe/Paris" },
  { iata: "AMS", name: "Amsterdam Schiphol", city: "Amsterdam", country: "Nederland", countryCode: "NL", lat: 52.3105, lng: 4.7683, timeZone: "Europe/Amsterdam", popular: true },
  { iata: "FRA", name: "Frankfurt am Main", city: "Frankfurt", country: "Tyskland", countryCode: "DE", lat: 50.0379, lng: 8.5622, timeZone: "Europe/Berlin", popular: true },
  { iata: "MUC", name: "München", city: "München", country: "Tyskland", countryCode: "DE", lat: 48.3538, lng: 11.7861, timeZone: "Europe/Berlin" },
  { iata: "BER", name: "Berlin Brandenburg", city: "Berlin", country: "Tyskland", countryCode: "DE", lat: 52.3667, lng: 13.5033, timeZone: "Europe/Berlin" },
  { iata: "HAM", name: "Hamburg", city: "Hamburg", country: "Tyskland", countryCode: "DE", lat: 53.6304, lng: 9.9882, timeZone: "Europe/Berlin" },
  { iata: "ZRH", name: "Zürich", city: "Zürich", country: "Sveits", countryCode: "CH", lat: 47.4647, lng: 8.5492, timeZone: "Europe/Zurich" },
  { iata: "GVA", name: "Genève", city: "Genève", country: "Sveits", countryCode: "CH", lat: 46.237, lng: 6.1092, timeZone: "Europe/Zurich" },
  { iata: "VIE", name: "Wien", city: "Wien", country: "Østerrike", countryCode: "AT", lat: 48.1103, lng: 16.5697, timeZone: "Europe/Vienna" },
  { iata: "MAD", name: "Madrid-Barajas", city: "Madrid", country: "Spania", countryCode: "ES", lat: 40.4983, lng: -3.5676, timeZone: "Europe/Madrid", popular: true },
  { iata: "BCN", name: "Barcelona-El Prat", city: "Barcelona", country: "Spania", countryCode: "ES", lat: 41.2974, lng: 2.0833, timeZone: "Europe/Madrid", popular: true },
  { iata: "AGP", name: "Málaga-Costa del Sol", city: "Málaga", country: "Spania", countryCode: "ES", lat: 36.6749, lng: -4.4991, timeZone: "Europe/Madrid", popular: true },
  { iata: "ALC", name: "Alicante-Elche", city: "Alicante", country: "Spania", countryCode: "ES", lat: 38.2822, lng: -0.5582, timeZone: "Europe/Madrid" },
  { iata: "PMI", name: "Palma de Mallorca", city: "Palma", country: "Spania", countryCode: "ES", lat: 39.5517, lng: 2.7388, timeZone: "Europe/Madrid" },
  { iata: "TFS", name: "Tenerife Sør", city: "Tenerife", country: "Spania", countryCode: "ES", lat: 28.0445, lng: -16.5725, timeZone: "Atlantic/Canary" },
  { iata: "LPA", name: "Gran Canaria", city: "Las Palmas", country: "Spania", countryCode: "ES", lat: 27.9319, lng: -15.3866, timeZone: "Atlantic/Canary" },
  { iata: "FCO", name: "Roma Fiumicino", city: "Roma", country: "Italia", countryCode: "IT", lat: 41.8003, lng: 12.2389, timeZone: "Europe/Rome", popular: true },
  { iata: "MXP", name: "Milano Malpensa", city: "Milano", country: "Italia", countryCode: "IT", lat: 45.6306, lng: 8.7231, timeZone: "Europe/Rome" },
  { iata: "VCE", name: "Venezia Marco Polo", city: "Venezia", country: "Italia", countryCode: "IT", lat: 45.5053, lng: 12.3519, timeZone: "Europe/Rome" },
  { iata: "ATH", name: "Athen", city: "Athen", country: "Hellas", countryCode: "GR", lat: 37.9364, lng: 23.9445, timeZone: "Europe/Athens" },
  { iata: "LIS", name: "Lisboa Humberto Delgado", city: "Lisboa", country: "Portugal", countryCode: "PT", lat: 38.7742, lng: -9.1342, timeZone: "Europe/Lisbon" },
  { iata: "OPO", name: "Porto Francisco Sá Carneiro", city: "Porto", country: "Portugal", countryCode: "PT", lat: 41.2481, lng: -8.6814, timeZone: "Europe/Lisbon" },
  { iata: "FAO", name: "Faro", city: "Faro", country: "Portugal", countryCode: "PT", lat: 37.0144, lng: -7.9659, timeZone: "Europe/Lisbon" },
  { iata: "DUB", name: "Dublin", city: "Dublin", country: "Irland", countryCode: "IE", lat: 53.4213, lng: -6.2701, timeZone: "Europe/Dublin" },
  { iata: "PRG", name: "Praha Václav Havel", city: "Praha", country: "Tsjekkia", countryCode: "CZ", lat: 50.1008, lng: 14.2632, timeZone: "Europe/Prague" },
  { iata: "WAW", name: "Warszawa Chopin", city: "Warszawa", country: "Polen", countryCode: "PL", lat: 52.1657, lng: 20.9671, timeZone: "Europe/Warsaw" },
  { iata: "KRK", name: "Kraków", city: "Kraków", country: "Polen", countryCode: "PL", lat: 50.0777, lng: 19.7848, timeZone: "Europe/Warsaw" },
  { iata: "BUD", name: "Budapest", city: "Budapest", country: "Ungarn", countryCode: "HU", lat: 47.4369, lng: 19.2556, timeZone: "Europe/Budapest" },
  { iata: "IST", name: "Istanbul", city: "Istanbul", country: "Tyrkia", countryCode: "TR", lat: 41.2753, lng: 28.7519, timeZone: "Europe/Istanbul", popular: true },
  { iata: "AYT", name: "Antalya", city: "Antalya", country: "Tyrkia", countryCode: "TR", lat: 36.8987, lng: 30.8005, timeZone: "Europe/Istanbul", popular: true },
  { iata: "EBL", name: "Erbil internasjonale lufthavn", city: "Erbil", country: "Irak (Kurdistan-regionen)", countryCode: "IQ", lat: 36.2376, lng: 43.9632, timeZone: "Asia/Baghdad", popular: true },
  { iata: "ISU", name: "Sulaymaniyah internasjonale lufthavn", city: "Sulaymaniyah", country: "Irak (Kurdistan-regionen)", countryCode: "IQ", lat: 35.5617, lng: 45.3167, timeZone: "Asia/Baghdad", popular: true },
  { iata: "JED", name: "King Abdulaziz internasjonale lufthavn", city: "Jeddah", country: "Saudi-Arabia", countryCode: "SA", lat: 21.6796, lng: 39.1565, timeZone: "Asia/Riyadh", popular: true },
  { iata: "BGW", name: "Bagdad internasjonale lufthavn", city: "Bagdad", country: "Irak", countryCode: "IQ", lat: 33.2625, lng: 44.2346, timeZone: "Asia/Baghdad" },
  { iata: "DAM", name: "Damaskus internasjonale lufthavn", city: "Damaskus", country: "Syria", countryCode: "SY", lat: 33.4115, lng: 36.5156, timeZone: "Asia/Damascus" },
  { iata: "BEY", name: "Beirut Rafic Hariri", city: "Beirut", country: "Libanon", countryCode: "LB", lat: 33.8209, lng: 35.4884, timeZone: "Asia/Beirut", popular: true },
  { iata: "CMN", name: "Casablanca Mohammed V", city: "Casablanca", country: "Marokko", countryCode: "MA", lat: 33.3675, lng: -7.5898, timeZone: "Africa/Casablanca", popular: true },
  { iata: "RAK", name: "Marrakech Menara", city: "Marrakech", country: "Marokko", countryCode: "MA", lat: 31.6069, lng: -8.0363, timeZone: "Africa/Casablanca" },
  { iata: "ASM", name: "Asmara internasjonale lufthavn", city: "Asmara", country: "Eritrea", countryCode: "ER", lat: 15.2919, lng: 38.9107, timeZone: "Africa/Asmara", popular: true },
  { iata: "ADD", name: "Addis Abeba Bole", city: "Addis Abeba", country: "Etiopia", countryCode: "ET", lat: 8.9779, lng: 38.7993, timeZone: "Africa/Addis_Ababa" },
  { iata: "MGQ", name: "Mogadishu Aden Adde", city: "Mogadishu", country: "Somalia", countryCode: "SO", lat: 2.0144, lng: 45.3048, timeZone: "Africa/Mogadishu" },
  { iata: "KBL", name: "Kabul internasjonale lufthavn", city: "Kabul", country: "Afghanistan", countryCode: "AF", lat: 34.5659, lng: 69.2123, timeZone: "Asia/Kabul", popular: true },
  { iata: "ISB", name: "Islamabad internasjonale lufthavn", city: "Islamabad", country: "Pakistan", countryCode: "PK", lat: 33.549, lng: 72.8257, timeZone: "Asia/Karachi", popular: true },
  { iata: "LHE", name: "Lahore Allama Iqbal", city: "Lahore", country: "Pakistan", countryCode: "PK", lat: 31.5216, lng: 74.4036, timeZone: "Asia/Karachi" },
  { iata: "KHI", name: "Karachi Jinnah", city: "Karachi", country: "Pakistan", countryCode: "PK", lat: 24.9065, lng: 67.1608, timeZone: "Asia/Karachi" },
  { iata: "DAC", name: "Dhaka Hazrat Shahjalal", city: "Dhaka", country: "Bangladesh", countryCode: "BD", lat: 23.8433, lng: 90.3978, timeZone: "Asia/Dhaka", popular: true },
  { iata: "CMB", name: "Colombo Bandaranaike", city: "Colombo", country: "Sri Lanka", countryCode: "LK", lat: 7.1808, lng: 79.8841, timeZone: "Asia/Colombo", popular: true },
  { iata: "GDN", name: "Gdańsk Lech Wałęsa", city: "Gdańsk", country: "Polen", countryCode: "PL", lat: 54.3776, lng: 18.4662, timeZone: "Europe/Warsaw" },
  { iata: "RIX", name: "Riga", city: "Riga", country: "Latvia", countryCode: "LV", lat: 56.9236, lng: 23.9711, timeZone: "Europe/Riga" },
  { iata: "TLL", name: "Tallinn", city: "Tallinn", country: "Estland", countryCode: "EE", lat: 59.4133, lng: 24.8328, timeZone: "Europe/Tallinn" },
  { iata: "VNO", name: "Vilnius", city: "Vilnius", country: "Litauen", countryCode: "LT", lat: 54.6341, lng: 25.2858, timeZone: "Europe/Vilnius" },

  // ── Verden ──
  { iata: "JFK", name: "New York JFK", city: "New York", country: "USA", countryCode: "US", lat: 40.6413, lng: -73.7781, timeZone: "America/New_York", popular: true },
  { iata: "EWR", name: "Newark Liberty", city: "New York", country: "USA", countryCode: "US", lat: 40.6895, lng: -74.1745, timeZone: "America/New_York" },
  { iata: "LAX", name: "Los Angeles", city: "Los Angeles", country: "USA", countryCode: "US", lat: 33.9416, lng: -118.4085, timeZone: "America/Los_Angeles", popular: true },
  { iata: "SFO", name: "San Francisco", city: "San Francisco", country: "USA", countryCode: "US", lat: 37.6213, lng: -122.379, timeZone: "America/Los_Angeles" },
  { iata: "MIA", name: "Miami", city: "Miami", country: "USA", countryCode: "US", lat: 25.7959, lng: -80.287, timeZone: "America/New_York" },
  { iata: "ORD", name: "Chicago O'Hare", city: "Chicago", country: "USA", countryCode: "US", lat: 41.9742, lng: -87.9073, timeZone: "America/Chicago" },
  { iata: "BOS", name: "Boston Logan", city: "Boston", country: "USA", countryCode: "US", lat: 42.3656, lng: -71.0096, timeZone: "America/New_York" },
  { iata: "SEA", name: "Seattle-Tacoma", city: "Seattle", country: "USA", countryCode: "US", lat: 47.4502, lng: -122.3088, timeZone: "America/Los_Angeles" },
  { iata: "YYZ", name: "Toronto Pearson", city: "Toronto", country: "Canada", countryCode: "CA", lat: 43.6777, lng: -79.6248, timeZone: "America/Toronto" },
  { iata: "YVR", name: "Vancouver", city: "Vancouver", country: "Canada", countryCode: "CA", lat: 49.1967, lng: -123.1815, timeZone: "America/Vancouver" },
  { iata: "CUN", name: "Cancún", city: "Cancún", country: "Mexico", countryCode: "MX", lat: 21.0365, lng: -86.8771, timeZone: "America/Cancun" },
  { iata: "DXB", name: "Dubai", city: "Dubai", country: "Emiratene", countryCode: "AE", lat: 25.2532, lng: 55.3657, timeZone: "Asia/Dubai", popular: true },
  { iata: "DOH", name: "Doha Hamad", city: "Doha", country: "Qatar", countryCode: "QA", lat: 25.2731, lng: 51.6081, timeZone: "Asia/Qatar" },
  { iata: "SIN", name: "Singapore Changi", city: "Singapore", country: "Singapore", countryCode: "SG", lat: 1.3644, lng: 103.9915, timeZone: "Asia/Singapore", popular: true },
  { iata: "BKK", name: "Bangkok Suvarnabhumi", city: "Bangkok", country: "Thailand", countryCode: "TH", lat: 13.69, lng: 100.7501, timeZone: "Asia/Bangkok", popular: true },
  { iata: "HKT", name: "Phuket", city: "Phuket", country: "Thailand", countryCode: "TH", lat: 8.1132, lng: 98.3169, timeZone: "Asia/Bangkok" },
  { iata: "HKG", name: "Hong Kong", city: "Hong Kong", country: "Hong Kong", countryCode: "HK", lat: 22.308, lng: 113.9185, timeZone: "Asia/Hong_Kong" },
  { iata: "NRT", name: "Tokyo Narita", city: "Tokyo", country: "Japan", countryCode: "JP", lat: 35.772, lng: 140.3929, timeZone: "Asia/Tokyo", popular: true },
  { iata: "HND", name: "Tokyo Haneda", city: "Tokyo", country: "Japan", countryCode: "JP", lat: 35.5494, lng: 139.7798, timeZone: "Asia/Tokyo" },
  { iata: "ICN", name: "Seoul Incheon", city: "Seoul", country: "Sør-Korea", countryCode: "KR", lat: 37.4602, lng: 126.4407, timeZone: "Asia/Seoul" },
  { iata: "DEL", name: "New Delhi", city: "New Delhi", country: "India", countryCode: "IN", lat: 28.5562, lng: 77.1, timeZone: "Asia/Kolkata", popular: true },
  { iata: "BOM", name: "Mumbai Chhatrapati Shivaji", city: "Mumbai", country: "India", countryCode: "IN", lat: 19.0896, lng: 72.8656, timeZone: "Asia/Kolkata" },
  { iata: "SYD", name: "Sydney Kingsford Smith", city: "Sydney", country: "Australia", countryCode: "AU", lat: -33.9399, lng: 151.1753, timeZone: "Australia/Sydney" },
  { iata: "CPT", name: "Cape Town", city: "Cape Town", country: "Sør-Afrika", countryCode: "ZA", lat: -33.9715, lng: 18.6021, timeZone: "Africa/Johannesburg" },
  { iata: "JNB", name: "Johannesburg OR Tambo", city: "Johannesburg", country: "Sør-Afrika", countryCode: "ZA", lat: -26.1367, lng: 28.2411, timeZone: "Africa/Johannesburg" },
  { iata: "GRU", name: "São Paulo Guarulhos", city: "São Paulo", country: "Brasil", countryCode: "BR", lat: -23.4356, lng: -46.4731, timeZone: "America/Sao_Paulo" },
  { iata: "EZE", name: "Buenos Aires Ezeiza", city: "Buenos Aires", country: "Argentina", countryCode: "AR", lat: -34.8222, lng: -58.5358, timeZone: "America/Argentina/Buenos_Aires" },
];

const BY_IATA = new Map(AIRPORTS.map((a) => [a.iata, a]));


/**
 * Normaliserer tekst for søk.
 *
 * En kunde som skriver «Malaga» skal finne Málaga, «Kobenhavn» skal finne
 * København og «Zurich» skal finne Zürich. NFKD tar hånd om aksenter, men
 * ikke om ø, æ og ß – de må mappes eksplisitt.
 */
export function foldForSearch(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/ß/g, "ss")
    .replace(/ð/g, "d")
    .replace(/þ/g, "th")
    .replace(/ł/g, "l");
}

export function airportByIata(iata: string): Airport | undefined {
  return BY_IATA.get(iata.toUpperCase());
}

export function searchAirports(query: string, limit = 8): Airport[] {
  const q = foldForSearch(query.trim());
  if (!q) return AIRPORTS.filter((a) => a.popular).slice(0, limit);
  const scored = AIRPORTS.map((a) => {
    const iata = a.iata.toLowerCase();
    const city = foldForSearch(a.city);
    const name = foldForSearch(a.name);
    let score = -1;
    if (iata === q) score = 100;
    else if (iata.startsWith(q)) score = 80;
    else if (city === q) score = 70;
    else if (city.startsWith(q)) score = 60;
    else if (name.toLowerCase().includes(q)) score = 40;
    else if (city.includes(q)) score = 30;
    else if (a.country.toLowerCase().includes(q)) score = 10;
    return { a, score };
  }).filter((s) => s.score >= 0);
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, limit).map((s) => s.a);
}
