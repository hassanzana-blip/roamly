import { isPreference, type Preference } from "@/lib/offers";

/**
 * Filtrene i lenken.
 *
 * Et filtrert resultat er et resultat. Kan det ikke deles, bokmerkes eller
 * tåle en oppdatering, er det ikke et resultat – det er en tilstand som bare
 * finnes i den ene fanen. Derfor er lenken fasit: alt som endrer hvilke
 * reiser som vises, står i den.
 *
 * Lenken har to deler, og skillet er viktig:
 *
 *  - **Søkeparametere** (fra, til, datoer, reisende, kabin) bestemmer hva vi
 *    spør leverandøren om. Endres de, kjøres et nytt søk.
 *  - **Filterparametere** (dette settet) bestemmer hva vi viser av svaret vi
 *    allerede har. Endres de, skjer det ingenting mot nettverket.
 *
 * `searchRequestKey` er det som holder de to fra hverandre: søket lytter på
 * den, ikke på hele query-strengen, så et klikk på «Direkte» ikke kjører et
 * nytt leverandørkall.
 *
 * Standardverdier står aldri i lenken. Et søk uten filtre skal ha en kort,
 * ren URL, og to like tilstander skal alltid gi nøyaktig samme streng.
 */

export type SortKey = Preference | "earliest";
export type StopsFilter = "all" | "direct" | "max1";
export type TimeBand = "all" | "night" | "morning" | "day" | "evening";

const TIME_BANDS: readonly TimeBand[] = ["all", "night", "morning", "day", "evening"];
const STOPS: readonly StopsFilter[] = ["all", "direct", "max1"];

/** Navnene i lenken. Norske, korte og stabile – de er en del av produktet. */
const KEY = {
  sort: "sort",
  stops: "stopp",
  airlines: "selskap",
  baggageOnly: "bagasje",
  airlineDirectOnly: "direktesalg",
  refundableOnly: "refunderbar",
  depTime: "avgangstid",
  arrTime: "ankomsttid",
  maxDurationH: "maksreisetid",
  maxLayoverH: "maksmellomlanding",
  priceMax: "maxpris",
  originAirports: "fraflyplass",
  destAirports: "tilflyplass",
} as const;

/** Alle filternøkler – brukt til å skille dem fra søkeparameterne. */
export const FILTER_KEYS: readonly string[] = Object.values(KEY);

export type SearchFilters = {
  sort: SortKey;
  stops: StopsFilter;
  /** IATA-koder, store bokstaver, sortert. Tom = alle. */
  airlines: string[];
  baggageOnly: boolean;
  airlineDirectOnly: boolean;
  refundableOnly: boolean;
  depTime: TimeBand;
  arrTime: TimeBand;
  /** Timer. 0 = ingen grense. */
  maxDurationH: number;
  /** Timer. 0 = ingen grense. */
  maxLayoverH: number;
  /** Minste enhet (øre). null = ingen grense. */
  priceMaxMinor: number | null;
  originAirports: string[];
  destAirports: string[];
};

export const DEFAULT_FILTERS: SearchFilters = {
  sort: "best",
  stops: "all",
  airlines: [],
  baggageOnly: false,
  airlineDirectOnly: false,
  refundableOnly: false,
  depTime: "all",
  arrTime: "all",
  maxDurationH: 0,
  maxLayoverH: 0,
  priceMaxMinor: null,
  originAirports: [],
  destAirports: [],
};

const isSort = (v: string | null): v is SortKey => v === "earliest" || isPreference(v);
const oneOf = <T extends string>(list: readonly T[], v: string | null, fallback: T): T => (v && (list as readonly string[]).includes(v) ? (v as T) : fallback);

/**
 * IATA-liste fra lenken. Vi normaliserer hardt – store bokstaver, bare
 * bokstaver og tall, ingen duplikater, sortert – slik at «DY,sk» og «SK,DY»
 * gir samme tilstand og samme URL igjen.
 */
function codeList(raw: string | null, max = 40): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const code = part.trim().toUpperCase();
    if (/^[A-Z0-9]{2,4}$/.test(code)) seen.add(code);
    if (seen.size >= max) break;
  }
  return [...seen].sort();
}

/** Heltall innenfor et område. Alt annet – tomt, tekst, negativt – blir 0. */
function boundedInt(raw: string | null, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.round(n), max);
}

/** Leser filtrene ut av lenken. Ugyldige verdier faller trygt til standard. */
export function filtersFromParams(params: URLSearchParams): SearchFilters {
  const kroner = Number(params.get(KEY.priceMax));
  return {
    sort: isSort(params.get(KEY.sort)) ? (params.get(KEY.sort) as SortKey) : DEFAULT_FILTERS.sort,
    stops: oneOf(STOPS, params.get(KEY.stops), "all"),
    airlines: codeList(params.get(KEY.airlines)),
    baggageOnly: params.get(KEY.baggageOnly) === "1",
    airlineDirectOnly: params.get(KEY.airlineDirectOnly) === "1",
    refundableOnly: params.get(KEY.refundableOnly) === "1",
    depTime: oneOf(TIME_BANDS, params.get(KEY.depTime), "all"),
    arrTime: oneOf(TIME_BANDS, params.get(KEY.arrTime), "all"),
    maxDurationH: boundedInt(params.get(KEY.maxDurationH), 72),
    maxLayoverH: boundedInt(params.get(KEY.maxLayoverH), 48),
    priceMaxMinor: Number.isFinite(kroner) && kroner > 0 ? Math.round(kroner) * 100 : null,
    originAirports: codeList(params.get(KEY.originAirports)),
    destAirports: codeList(params.get(KEY.destAirports)),
  };
}

/**
 * Skriver filtrene inn i en eksisterende lenke uten å røre søkeparameterne.
 * Standardverdier fjernes, så URL-en holder seg kort og deterministisk.
 */
export function applyFilters(params: URLSearchParams, filters: SearchFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  const set = (key: string, value: string | null) => {
    if (value === null) next.delete(key);
    else next.set(key, value);
  };
  const flag = (key: string, on: boolean) => set(key, on ? "1" : null);

  set(KEY.sort, filters.sort === DEFAULT_FILTERS.sort ? null : filters.sort);
  set(KEY.stops, filters.stops === "all" ? null : filters.stops);
  set(KEY.airlines, filters.airlines.length ? [...filters.airlines].sort().join(",") : null);
  flag(KEY.baggageOnly, filters.baggageOnly);
  flag(KEY.airlineDirectOnly, filters.airlineDirectOnly);
  flag(KEY.refundableOnly, filters.refundableOnly);
  set(KEY.depTime, filters.depTime === "all" ? null : filters.depTime);
  set(KEY.arrTime, filters.arrTime === "all" ? null : filters.arrTime);
  set(KEY.maxDurationH, filters.maxDurationH > 0 ? String(filters.maxDurationH) : null);
  set(KEY.maxLayoverH, filters.maxLayoverH > 0 ? String(filters.maxLayoverH) : null);
  set(KEY.priceMax, filters.priceMaxMinor && filters.priceMaxMinor > 0 ? String(Math.round(filters.priceMaxMinor / 100)) : null);
  set(KEY.originAirports, filters.originAirports.length ? [...filters.originAirports].sort().join(",") : null);
  set(KEY.destAirports, filters.destAirports.length ? [...filters.destAirports].sort().join(",") : null);
  return next;
}

/**
 * Tallet i filterknappen. Hvert valgte selskap og hver valgte flyplass
 * teller for seg – det er slik siden alltid har telt, og tallet skal ikke
 * endre betydning under føttene på noen.
 * Sortering er ikke et filter og telles ikke.
 */
export function activeFilterCount(f: SearchFilters): number {
  return (
    (f.stops !== "all" ? 1 : 0) +
    f.airlines.length +
    (f.baggageOnly ? 1 : 0) +
    (f.airlineDirectOnly ? 1 : 0) +
    (f.refundableOnly ? 1 : 0) +
    (f.depTime !== "all" ? 1 : 0) +
    (f.arrTime !== "all" ? 1 : 0) +
    (f.maxDurationH > 0 ? 1 : 0) +
    (f.maxLayoverH > 0 ? 1 : 0) +
    (f.priceMaxMinor !== null ? 1 : 0) +
    f.originAirports.length +
    f.destAirports.length
  );
}

/** Fjerner alle filtre, men beholder søket og sorteringen. */
export function clearFilters(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of FILTER_KEYS) if (key !== KEY.sort) next.delete(key);
  return next;
}

/**
 * Signaturen til selve søket – alt som bestemmer hva vi spør leverandøren om,
 * i fast rekkefølge. Filtre er ikke med, og det er hele poenget: et klikk på
 * «Direkte» endrer lenken, men ikke denne strengen, så ingen nye nettverkskall.
 *
 * Nøkkelen er også stabil mot rekkefølgen på parameterne i URL-en, slik at to
 * lenker som beskriver samme søk gir samme nøkkel.
 */
export const REQUEST_KEYS: readonly string[] = [
  "from",
  "to",
  "depart",
  "ret",
  "cabin",
  "adults",
  "children",
  "infants",
  "childAges",
  "infantAges",
  "direct",
  "provider",
  "legs",
  "trip",
];

export function searchRequestKey(params: URLSearchParams): string {
  return REQUEST_KEYS.map((k) => `${k}=${params.get(k) ?? ""}`).join("&");
}
