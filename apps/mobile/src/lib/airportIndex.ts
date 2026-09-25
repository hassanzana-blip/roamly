import type { Locale } from "../i18n/types";
import { REGISTRY, type RegistryAirport } from "./airportRegistry";
import type { AirportChoice } from "./searchForm";
import { covers, searchTokens, searchWords } from "./textMatch";

/**
 * Flyplassvelgerens umiddelbare treff: det kuraterte registeret (appens kopi – det samme settet nettet viser
 * før serveren svarer) – nå også på engelsk. Serverens verdensregister fyller på under når svaret kommer.
 *
 * Registeret har norske navn («København», «Wien», «Roma»). Kunder skriver også «Copenhagen», «Vienna» og
 * «Helsinki»; uten de engelske navnene fant søket ingenting (serveren heller ikke, se MANIFEST). Her søkes
 * begge språk, og raden vises på appens språk. Hver rad er fortsatt én flyplass med én kode – det er den
 * søket bruker.
 */

type Names = { city?: string; name?: string; country?: string };

/** Engelske navn der de skiller seg fra registerets. Norske flyplassnavn er egennavn og beholdes. */
const EN: Readonly<Record<string, Names>> = {
  CPH: { city: "Copenhagen", name: "Copenhagen Kastrup" },
  ARN: { name: "Stockholm Arlanda" },
  GOT: { city: "Gothenburg", name: "Gothenburg Landvetter" },
  HEL: { city: "Helsinki", name: "Helsinki-Vantaa" },
  KEF: { name: "Keflavík International" },
  MUC: { city: "Munich", name: "Munich" },
  GVA: { city: "Geneva", name: "Geneva" },
  VIE: { city: "Vienna", name: "Vienna" },
  TFS: { name: "Tenerife South" },
  FCO: { city: "Rome", name: "Rome Fiumicino" },
  MXP: { city: "Milan", name: "Milan Malpensa" },
  VCE: { city: "Venice", name: "Venice Marco Polo" },
  ATH: { city: "Athens", name: "Athens" },
  LIS: { city: "Lisbon", name: "Lisbon Humberto Delgado" },
  PRG: { city: "Prague", name: "Prague Václav Havel" },
  WAW: { city: "Warsaw", name: "Warsaw Chopin" },
  EBL: { name: "Erbil International Airport", country: "Kurdistan Region (Iraq)" },
  ISU: { name: "Sulaymaniyah International Airport", country: "Kurdistan Region (Iraq)" },
  JED: { name: "King Abdulaziz International Airport" },
  BGW: { city: "Baghdad", name: "Baghdad International Airport" },
  DAM: { city: "Damascus", name: "Damascus International Airport" },
  ASM: { name: "Asmara International Airport" },
  ADD: { city: "Addis Ababa", name: "Addis Ababa Bole" },
  KBL: { name: "Kabul International Airport" },
  ISB: { name: "Islamabad International Airport" },
};

/** Landnavn på engelsk etter landkode – de samme landene som registerets norske navn dekker, pluss ER og HK. */
const COUNTRY_EN: Readonly<Record<string, string>> = {
  NO: "Norway", SE: "Sweden", DK: "Denmark", FI: "Finland", IS: "Iceland", AF: "Afghanistan", AL: "Albania", DZ: "Algeria",
  AR: "Argentina", AM: "Armenia", AU: "Australia", AT: "Austria", AZ: "Azerbaijan", BH: "Bahrain", BD: "Bangladesh",
  BE: "Belgium", BA: "Bosnia and Herzegovina", BR: "Brazil", BG: "Bulgaria", CA: "Canada", CL: "Chile", CN: "China",
  CO: "Colombia", HR: "Croatia", CY: "Cyprus", CZ: "Czechia", EG: "Egypt", EE: "Estonia", ER: "Eritrea", ET: "Ethiopia",
  FR: "France", GE: "Georgia", DE: "Germany", GH: "Ghana", GR: "Greece", HK: "Hong Kong", HU: "Hungary", IN: "India",
  ID: "Indonesia", IR: "Iran", IQ: "Iraq", IE: "Ireland", IL: "Israel", IT: "Italy", JP: "Japan", JO: "Jordan",
  KZ: "Kazakhstan", KE: "Kenya", KR: "South Korea", KW: "Kuwait", LV: "Latvia", LB: "Lebanon", LT: "Lithuania",
  LU: "Luxembourg", MY: "Malaysia", MT: "Malta", MX: "Mexico", MD: "Moldova", ME: "Montenegro", MA: "Morocco",
  NL: "Netherlands", NZ: "New Zealand", NG: "Nigeria", MK: "North Macedonia", PK: "Pakistan", PE: "Peru",
  PH: "Philippines", PL: "Poland", PT: "Portugal", QA: "Qatar", RO: "Romania", RU: "Russia", SA: "Saudi Arabia",
  RS: "Serbia", SG: "Singapore", SK: "Slovakia", SI: "Slovenia", SO: "Somalia", ZA: "South Africa", ES: "Spain",
  LK: "Sri Lanka", SY: "Syria", CH: "Switzerland", TW: "Taiwan", TH: "Thailand", TN: "Tunisia", TR: "Türkiye",
  UA: "Ukraine", AE: "United Arab Emirates", GB: "United Kingdom", US: "United States", VN: "Vietnam",
};

/**
 * Flyplasser som betjener en by uten å ha byens navn i registeret. Torp er «den andre inngangen til
 * Oslo-området» (registeret) og markedsføres som Oslo Torp av flyselskapene, men heter Sandefjord – et søk
 * på «Oslo» fant den aldri. Den vises som egen rad rett under, med egen kode; aldri slått sammen med OSL.
 */
const ALSO_SERVES: Readonly<Record<string, readonly string[]>> = { OSL: ["TRF"] };

export type AirportNames = { city: string; name: string; country: string };

/** Det en rad trenger av en flyplass – både registerets og serverens (`Airport`) passer. */
export type PickerAirport = RegistryAirport;

/** Navnene en rad viser, på appens språk. Serverens flyplasser utenfor registeret vises som serveren sendte dem. */
export function airportNames(a: PickerAirport, locale: Locale): AirportNames {
  if (locale !== "en") return { city: a.city, name: a.name, country: a.country };
  const en = EN[a.iata];
  return { city: en?.city ?? a.city, name: en?.name ?? a.name, country: en?.country ?? COUNTRY_EN[a.countryCode] ?? a.country };
}

type Entry = { airport: PickerAirport; iata: string; city: string[]; name: string[]; country: string[]; i: number; cityKey: string };

/** Vanlige skrivemåter uten æ/ø/å og omlyd: «aalesund», «tromsoe», «goeteborg», «zuerich». */
const spelled = (s: string) => s.replace(/[øØöÖ]/g, "oe").replace(/[åÅ]/g, "aa").replace(/[äÄ]/g, "ae").replace(/[üÜ]/g, "ue");
/** Ordene i tekstene, på begge måter å skrive dem. */
const wordsOf = (...texts: string[]) => [...new Set([...searchWords(...texts), ...searchWords(...texts.map(spelled))])];

const INDEX: readonly Entry[] = REGISTRY.map((airport, i) => {
  const en = airportNames(airport, "en");
  return {
    airport,
    iata: airport.iata.toLowerCase(),
    city: wordsOf(airport.city, en.city),
    name: wordsOf(airport.name, en.name),
    country: wordsOf(airport.country, en.country),
    i,
    cityKey: `${airport.countryCode}:${airport.city}`,
  };
});
const ENTRY = new Map(INDEX.map((e) => [e.airport.iata, e]));
/** Per by: første plass i registeret, og om noen av byens flyplasser er merket populær. */
const CITIES = new Map<string, { first: number; popular: boolean }>();
for (const e of INDEX) {
  const c = CITIES.get(e.cityKey);
  if (c) c.popular ||= !!e.airport.popular;
  else CITIES.set(e.cityKey, { first: e.i, popular: !!e.airport.popular });
}
const BY_IATA = new Map(INDEX.map((e) => [e.airport.iata, e.airport]));

export type MatchField = "iata" | "city" | "airport" | "country";
export type AirportRow = {
  airport: PickerAirport;
  /** Hva søket traff: koden, byen, flyplassnavnet eller landet (null for serverens egne treff). */
  field: MatchField | null;
  /** Byens flyplass når raden er en annen flyplass for den byen (Torp under Oslo); ellers null. */
  near: PickerAirport | null;
};

const RANK: Record<MatchField, number> = { iata: 0, city: 1, airport: 2, country: 3 };

/**
 * Registerets treff for søket, beste først: hel kode, så by, flyplassnavn (også starten av koden) og land.
 * Hvert ord kunden skriver må være starten på et ord, på norsk eller engelsk. Likt treff: byer registeret
 * merker som populære først («lon» gir London før Longyearbyen), byens flyplasser samlet, ellers registerets
 * rekkefølge (Norge først).
 */
export function searchLocalAirports(query: string, limit = 8): AirportRow[] {
  const tokens = searchTokens(query);
  if (!tokens.length) return [];
  const q = tokens.join(" ");
  const hits: { e: Entry; field: MatchField }[] = [];
  for (const e of INDEX) {
    if (!covers(tokens, [e.iata, ...e.city, ...e.name, ...e.country])) continue;
    const field: MatchField = q === e.iata ? "iata" : covers(tokens, e.city) ? "city" : covers(tokens, [e.iata, ...e.name]) ? "airport" : "country";
    hits.push({ e, field });
  }
  const city = (e: Entry) => CITIES.get(e.cityKey)!;
  hits.sort((a, b) => RANK[a.field] - RANK[b.field] || Number(city(b.e).popular) - Number(city(a.e).popular) || city(a.e).first - city(b.e).first || a.e.i - b.e.i);
  return hits.slice(0, limit).map(({ e, field }) => ({ airport: e.airport, field, near: null }));
}

/**
 * Gjelder søket byen (eller begynnelsen av den – «os», «osl», «oslo»), eventuelt sammen med ord fra den andre
 * flyplassen («oslo torp»)? Den som skriver «Gardermoen» eller «Oslo Gardermoen», har valgt flyplass.
 */
function asksForCity(tokens: readonly string[], city: Entry, other: Entry): boolean {
  return tokens.some((t) => city.city.some((w) => w.startsWith(t))) && covers(tokens, [...city.city, other.iata, ...other.city, ...other.name]);
}

/** Samlet liste: registerets treff med byens andre flyplass rett under, så serverens treff som mangler. */
export function airportRows(query: string, server: readonly PickerAirport[] | null, limit = 16): AirportRow[] {
  const rows: AirportRow[] = [];
  const seen = new Set<string>();
  const add = (row: AirportRow) => {
    if (seen.has(row.airport.iata) || rows.length >= limit) return;
    seen.add(row.airport.iata);
    rows.push(row);
  };
  const tokens = searchTokens(query);
  const local = searchLocalAirports(query);
  const listed = new Set(local.map((r) => r.airport.iata));
  // Byens andre flyplasser som søket gjelder og som ikke alt står i listen – samme svar for «os», «osl» og «oslo»,
  // så raden ikke kommer og går mens kunden skriver.
  const extra = new Map<string, PickerAirport[]>();
  for (const [hub, codes] of Object.entries(ALSO_SERVES)) {
    for (const code of codes) {
      const city = ENTRY.get(hub);
      const other = ENTRY.get(code);
      if (city && other && !listed.has(code) && asksForCity(tokens, city, other)) extra.set(hub, [...(extra.get(hub) ?? []), other.airport]);
    }
  }
  for (const row of local) {
    add(row);
    for (const other of extra.get(row.airport.iata) ?? []) add({ airport: other, field: null, near: row.airport });
    extra.delete(row.airport.iata);
  }
  // Byens egen flyplass traff ikke («oslo torp»): den andre står likevel, merket med byen.
  for (const [hub, others] of extra) for (const other of others) add({ airport: other, field: null, near: BY_IATA.get(hub) ?? null });
  // Serverens rekkefølge for resten. En flyplass i registeret vises med registerets navn (samme som over).
  for (const a of server ?? []) add({ airport: BY_IATA.get(a.iata) ?? a, field: null, near: null });
  return rows;
}

/**
 * Et lagret valg (nylige søk, forslag, skjemaet) med navnene på appens språk når flyplassen er i registeret – så
 * «København» blir «Copenhagen» på engelsk, uansett hvilket språk valget ble gjort på. Ellers som lagret.
 */
export function localizedChoice(a: AirportChoice, locale: Locale): AirportChoice {
  const reg = BY_IATA.get(a.iata);
  return reg ? { iata: a.iata, ...airportNames(reg, locale) } : a;
}

/**
 * Bynavnet på det andre språket når søket bare passer det: «copenhagen» på bokmål gir «Copenhagen», så raden
 * kan vise «København (Copenhagen)» og kunden ser hvorfor den traff. Ellers null.
 */
export function cityAlias(a: PickerAirport, query: string, locale: Locale): string | null {
  const tokens = searchTokens(query);
  if (!tokens.length) return null;
  const shown = airportNames(a, locale).city;
  const other = airportNames(a, locale === "en" ? "nb" : "en").city;
  if (other === shown || covers(tokens, searchWords(shown)) || !covers(tokens, searchWords(other))) return null;
  return other;
}
