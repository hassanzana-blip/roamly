/**
 * HelloSky reisemål – ett register, mange visninger.
 *
 * HelloSky selger hele verden fra Norge. Registeret er derfor én liste med
 * temaer og regioner, ikke tre håndplukkede lister der én del av verden
 * tilfeldigvis havnet øverst overalt. Forsiden, utforsk-siden og
 * flyplassvelgeren leser fra det samme registeret og filtrerer selv.
 *
 * Foto: alle bilder er lokale, optimaliserte filer i /public/destinations.
 * Kildene er lisenstrygge (Unsplash- og Pexels-lisens) og hvert bilde er
 * kontrollert av et menneske for å vise det faktiske stedet. Ingen
 * AI-genererte reisebilder. Ingen anmeldelser, terningkast, rabatter eller
 * knapphetspåstander – et kort sier «Se flyreiser», aldri oppdiktet press.
 */

/** Verdensdel/område – brukes til å spre utvalget, ikke til å rangere det. */
export type Region = "norden" | "europa" | "midtosten" | "afrika" | "asia" | "amerika";

/**
 * Reisetema. Et reisemål kan høre til flere: Barcelona er både storby,
 * strand og mat. Temaene er redaksjonelle vurderinger av stedet, ikke
 * påstander om priser eller tilgjengelighet.
 */
export type ThemeId = "sol" | "storby" | "familie" | "mat" | "natur" | "langtur" | "hjem";

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
  region: Region;
  themes: ThemeId[];
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

/** srcset: 256 for miniatyrer, 640 for kort, 1024 for scener. */
export function imageSrcSet(image: string): string | undefined {
  if (!image.startsWith("/destinations/") || !image.endsWith(".jpg")) return undefined;
  const base = image.replace(/\.jpg$/, "");
  return `${base}-256.jpg 256w, ${base}-640.jpg 640w, ${image} 1024w`;
}

const img = (name: string) => `/destinations/${name}.jpg`;

/**
 * Registeret. Rekkefølgen her er ikke en rangering – visningene sorterer
 * og filtrerer selv, og forsiden sprer bevisst over regioner.
 */
export const DESTINATIONS: DiscoverDestination[] = [
  // ── Europa ───────────────────────────────────────────────────────────
  { id: "paris", city: "Paris", country: "Frankrike", iata: "CDG", image: img("paris"), imageAlt: "Eiffeltårnet og Seinen i kveldslys, Paris", tagline: "Byen over alle byer", region: "europa", themes: ["storby", "mat", "familie"] },
  { id: "london", city: "London", country: "Storbritannia", iata: "LHR", image: img("london"), imageAlt: "Tower Bridge over Themsen, London", tagline: "Helgeklassikeren", region: "europa", themes: ["storby", "familie"] },
  { id: "barcelona", city: "Barcelona", country: "Spania", iata: "BCN", image: img("barcelona"), imageAlt: "Barcelona sett ovenfra med Sagrada Família", tagline: "By, strand og tapas", region: "europa", themes: ["storby", "sol", "mat", "familie"] },
  { id: "lisboa", city: "Lisboa", country: "Portugal", iata: "LIS", image: img("lisboa"), imageAlt: "Gul trikk, linje 28, i Lisboas gater", tagline: "Trikker og utsiktspunkter", region: "europa", themes: ["storby", "mat", "sol"] },
  { id: "rome", city: "Roma", country: "Italia", iata: "FCO", image: img("rome"), imageAlt: "Colosseum i Roma", tagline: "Den evige stad", region: "europa", themes: ["storby", "mat"] },
  { id: "athens", city: "Athen", country: "Hellas", iata: "ATH", image: img("athens"), imageAlt: "Parthenon på Akropolis, Athen", tagline: "Antikk storby ved havet", region: "europa", themes: ["storby", "sol", "mat"] },
  { id: "malaga", city: "Málaga", country: "Spania", iata: "AGP", image: img("malaga"), imageAlt: "Plass med palmer i Málaga", tagline: "Costa del Sols hjerte", region: "europa", themes: ["sol", "familie"] },
  { id: "warszawa", city: "Warszawa", country: "Polen", iata: "WAW", image: img("warsaw"), imageAlt: "Kulturpalasset i Warszawa om kvelden", tagline: "Nær, rimelig og undervurdert", region: "europa", themes: ["storby", "hjem", "familie"] },
  { id: "tromso", city: "Tromsø", country: "Norge", iata: "TOS", image: img("tromso"), imageAlt: "Nordlys over snødekt landskap ved Tromsø", tagline: "Nordlys og vidde", region: "norden", themes: ["natur", "familie"] },

  // ── Midtøsten og Nord-Afrika ─────────────────────────────────────────
  { id: "istanbul", city: "Istanbul", country: "Türkiye", iata: "IST", image: img("istanbul"), imageAlt: "Galatatårnet over Istanbuls tak", tagline: "To kontinenter, én by", region: "midtosten", themes: ["storby", "mat", "hjem"] },
  { id: "dubai", city: "Dubai", country: "Emiratene", iata: "DXB", image: img("dubai"), imageAlt: "Dubai Marina med Burj Khalifa i horisonten", tagline: "Sol når Norge er mørkt", region: "midtosten", themes: ["sol", "familie", "storby"] },
  { id: "beirut", city: "Beirut", country: "Libanon", iata: "BEY", image: img("beirut"), imageAlt: "Dueklippene i Raouché ved solnedgang, Beirut", tagline: "Middelhavets perle", region: "midtosten", themes: ["mat", "hjem", "storby"] },
  { id: "erbil", city: "Erbil", country: "Kurdistan (Irak)", iata: "EBL", image: img("erbil"), imageAlt: "Citadellet i Erbil", tagline: "Kurdistan-regionen", region: "midtosten", themes: ["hjem"] },
  { id: "sulaymaniyah", city: "Sulaymaniyah", country: "Kurdistan (Irak)", iata: "ISU", image: img("sulaymaniyah"), imageAlt: "Sulaymaniyah by med snødekte fjell i bakgrunnen", tagline: "Fjellene og byen", region: "midtosten", themes: ["hjem"] },
  { id: "jeddah", city: "Jeddah", country: "Saudi-Arabia", iata: "JED", image: img("jeddah"), imageAlt: "King Fahd-fontenen ved Jeddah-cornichen i blåtimen", tagline: "Porten til Rødehavet", region: "midtosten", themes: ["hjem", "sol"] },
  { id: "marrakech", city: "Marrakech", country: "Marokko", iata: "RAK", image: img("marrakech"), imageAlt: "Koutoubia-moskeen i Marrakech", tagline: "Medina, souk og ørken", region: "afrika", themes: ["mat", "sol", "hjem"] },
  { id: "asmara", city: "Asmara", country: "Eritrea", iata: "ASM", imageAlt: "Illustrert flyrute til Asmara", tagline: "Høylandets hovedstad", region: "afrika", themes: ["hjem"] },

  // ── Asia ─────────────────────────────────────────────────────────────
  { id: "bangkok", city: "Bangkok", country: "Thailand", iata: "BKK", image: img("bangkok"), imageAlt: "Neonlys og tuk-tuk i Bangkoks Chinatown", tagline: "Gatekjøkken og templer", region: "asia", themes: ["langtur", "mat", "sol"] },
  { id: "tokyo", city: "Tokyo", country: "Japan", iata: "HND", image: img("tokyo"), imageAlt: "Shibuya-krysset i Tokyo om kvelden", tagline: "Fremtid og tradisjon", region: "asia", themes: ["langtur", "storby", "mat"] },
  { id: "colombo", city: "Colombo", country: "Sri Lanka", iata: "CMB", image: img("srilanka"), imageAlt: "Tog over Nine Arches-broen i Ella, Sri Lanka", tagline: "Teåser, tog og kyst", region: "asia", themes: ["langtur", "natur", "sol"] },
  { id: "delhi", city: "New Delhi", country: "India", iata: "DEL", image: img("delhi"), imageAlt: "India Gate i New Delhi", tagline: "Hovedstadspuls", region: "asia", themes: ["langtur", "hjem", "mat"] },
  { id: "dhaka", city: "Dhaka", country: "Bangladesh", iata: "DAC", image: img("dhaka"), imageAlt: "Fargerike rickshawer i Dhakas gater", tagline: "Rickshawenes by", region: "asia", themes: ["hjem"] },
  { id: "islamabad", city: "Islamabad", country: "Pakistan", iata: "ISB", image: img("islamabad"), imageAlt: "Faisal-moskeen i Islamabad i skumringen", tagline: "Ved Margalla-fjellene", region: "asia", themes: ["hjem"] },
  { id: "kabul", city: "Kabul", country: "Afghanistan", iata: "KBL", image: img("kabul"), imageAlt: "Kabul by i solnedgang med fjell i bakgrunnen", tagline: "Byen mellom fjellene", region: "asia", themes: ["hjem"] },

  // ── Amerika ──────────────────────────────────────────────────────────
  { id: "nyc", city: "New York", country: "USA", iata: "JFK", image: img("nyc"), imageAlt: "Times Square i New York", tagline: "Storbyen alle kjenner", region: "amerika", themes: ["langtur", "storby", "familie"] },
];

/** Alle reisemål, av og til under det gamle navnet. */
export const ALL_DESTINATIONS: DiscoverDestination[] = DESTINATIONS;

export function destinationById(id: string): DiscoverDestination | undefined {
  return DESTINATIONS.find((d) => d.id === id);
}

export function destinationsByTheme(theme: ThemeId): DiscoverDestination[] {
  return DESTINATIONS.filter((d) => d.themes.includes(theme));
}

/**
 * Et utvalg som sprer seg over verden i stedet for å samle seg i én region.
 * Vi går rundt regionene og tar ett reisemål av gangen, så seks kort aldri
 * blir seks naboland.
 */
export function spreadAcrossRegions(pool: DiscoverDestination[], count: number): DiscoverDestination[] {
  const byRegion = new Map<Region, DiscoverDestination[]>();
  for (const d of pool) {
    if (!byRegion.has(d.region)) byRegion.set(d.region, []);
    byRegion.get(d.region)!.push(d);
  }
  const queues = [...byRegion.values()];
  const out: DiscoverDestination[] = [];
  let i = 0;
  while (out.length < count && queues.some((q) => q.length)) {
    const q = queues[i % queues.length];
    const next = q.shift();
    if (next) out.push(next);
    i += 1;
  }
  return out;
}

export type DealRoute = {
  id: string;
  destination: DiscoverDestination;
  /** Avreiseflyplass for prisestimatet */
  originIata: string;
  originCity: string;
};

/**
 * Rutene forsiden henter veiledende fra-priser for.
 *
 * Utvalget er spredt over verden med vilje. Da listen bare inneholdt
 * Midtøsten, leste forsiden som om HelloSky flyr ett sted – og det er ikke
 * det vi selger. Ingen rabatter, ingen tidsfrister: kortet viser kun den
 * reelle «fra»-prisen søket returnerer, tydelig merket som veiledende.
 */
const ROUTE_IDS = ["barcelona", "istanbul", "london", "bangkok", "dubai", "nyc"] as const;

export const POPULAR_ROUTES: DealRoute[] = ROUTE_IDS.map((id) => {
  const destination = destinationById(id)!;
  return { id: `route-${id}`, destination, originIata: "OSL", originCity: "Oslo" };
});

/** Rutene hjem – vår spesialkunnskap, som én historie blant flere. */
export const HOMECOMING_ROUTES: DealRoute[] = ["istanbul", "erbil", "beirut", "islamabad"].map((id) => {
  const destination = destinationById(id)!;
  return { id: `home-${id}`, destination, originIata: "OSL", originCity: "Oslo" };
});
