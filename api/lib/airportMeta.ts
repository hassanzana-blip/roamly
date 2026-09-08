import { AIRPORTS, foldForSearch, searchAirports as searchCurated, type Airport } from "../../contracts/airports";
import { countryName } from "../../contracts/countries";
import meta from "../data/airports-meta.json" with { type: "json" };

/**
 * Verdensregisteret over flyplasser – OurAirports (public domain).
 *
 * OurAirports har rundt 80 000 oppføringer og CSV-en er 12 MB. Ingenting av
 * det skal til nettleseren. `scripts/build-airport-meta.mjs` filtrerer ned
 * til flyplasser med rutetrafikk og IATA-kode, og resultatet leses bare her,
 * på serveren.
 *
 * Registeret er metadata, ikke inventar: det avgjør hva en kunde kan søke
 * etter, aldri hva som er ledig eller hva noe koster. Tilgjengelighet, pris
 * og billettutstedelse kommer fortsatt utelukkende fra leverandørene.
 */

type Row = {
  i: string;
  k?: string;
  n: string;
  c: string;
  y: string;
  cc: string;
  r: string;
  la: number;
  lo: number;
  b: number;
};

const ROWS = meta as Row[];
const CURATED = new Set(AIRPORTS.map((a) => a.iata));

function toAirport(r: Row): Airport {
  return {
    iata: r.i,
    name: r.n,
    city: r.c,
    country: countryName(r.cc, r.y),
    countryCode: r.cc,
    lat: r.la,
    lng: r.lo,
    world: true,
  };
}

const INDEX = ROWS.map((r) => ({
  r,
  iata: r.i.toLowerCase(),
  icao: (r.k ?? "").toLowerCase(),
  city: foldForSearch(r.c),
  name: foldForSearch(r.n),
  country: foldForSearch(r.y),
}));

/**
 * Søk i hele verden.
 *
 * Det kuraterte settet kommer først: det er flyplassene vi kjenner best, har
 * tidssone for og har flagget som populære. Verdensregisteret fyller på, så
 * en kunde som skriver «Kraków» eller «Tbilisi» faktisk finner noe.
 */
export function searchAirportsWorldwide(query: string, limit = 12): Airport[] {
  const curated = searchCurated(query, limit);
  const q = foldForSearch(query.trim());
  if (!q) return curated;
  if (curated.length >= limit) return curated;

  const seen = new Set(curated.map((a) => a.iata));
  const scored: { a: Airport; score: number }[] = [];
  for (const e of INDEX) {
    if (seen.has(e.r.i) || CURATED.has(e.r.i)) continue;
    let score = -1;
    if (e.iata === q) score = 100;
    else if (e.city === q) score = 90;
    else if (e.city.startsWith(q)) score = 80;
    else if (e.name.startsWith(q)) score = 70;
    else if (e.icao === q) score = 65;
    else if (e.city.includes(q)) score = 55;
    else if (e.name.includes(q)) score = 45;
    else if (e.country.startsWith(q)) score = 35;
    if (score < 0) continue;
    // Store flyplasser først når treffet ellers er like godt.
    scored.push({ a: toAirport(e.r), score: score + e.r.b * 4 });
  }
  scored.sort((x, y) => y.score - x.score || x.a.city.localeCompare(y.a.city));
  return [...curated, ...scored.slice(0, limit - curated.length).map((s) => s.a)];
}

/** Metadata for én flyplass, kuratert først, ellers fra verdensregisteret. */
export function airportMetaByIata(iata: string): Airport | undefined {
  const code = iata.toUpperCase();
  const curated = AIRPORTS.find((a) => a.iata === code);
  if (curated) return curated;
  const row = ROWS.find((r) => r.i === code);
  return row ? toAirport(row) : undefined;
}

/** Antall flyplasser i verdensregisteret – vises i utviklerverktøy og tester. */
export const WORLD_AIRPORT_COUNT = ROWS.length;
