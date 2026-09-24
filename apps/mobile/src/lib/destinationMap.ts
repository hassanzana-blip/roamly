import { DESTINATIONS, type Destination } from "./destinations";
import { MAX_PIN_SCALE, fitRegion, pinBox, project, fitAspect, type Cluster, type Region, type Size } from "./mapGeometry";

/**
 * Hvor hvert reisemål står på kartet: flyplassen søket faktisk bruker
 * (`Destination.iata`), ikke et omtrentlig bysentrum. Punktet er et
 * reisemål – ingen pris, ingen ledige plasser.
 *
 * Kilde: OurAirports (https://ourairports.com/data/), offentlig eiendom
 * (public domain). Tallene er kopiert fra nettets flyplassregister
 * api/data/airports-meta.json (bygd av scripts/build-airport-meta.mjs), og
 * en test sjekker at de stemmer med det registeret.
 *
 * Kartet selv er Apple Maps (MapKit) via react-native-maps (MIT) på iOS –
 * ingen API-nøkkel, ingen kartfliser fra andre, ingen posisjon.
 */
export const AIRPORT_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  BCN: { latitude: 41.2971, longitude: 2.0785 },
  LHR: { latitude: 51.4707, longitude: -0.4599 },
  FCO: { latitude: 41.8045, longitude: 12.252 },
  CDG: { latitude: 49.009, longitude: 2.5541 },
  LIS: { latitude: 38.7813, longitude: -9.1359 },
  ATH: { latitude: 37.9364, longitude: 23.9445 },
  AGP: { latitude: 36.6749, longitude: -4.4991 },
  WAW: { latitude: 52.1657, longitude: 20.9671 },
  TOS: { latitude: 69.6833, longitude: 18.9189 },
  IST: { latitude: 41.2749, longitude: 28.7321 },
  DXB: { latitude: 25.2498, longitude: 55.371 },
  BEY: { latitude: 33.8198, longitude: 35.4874 },
  EBL: { latitude: 36.236, longitude: 43.9466 },
  ISU: { latitude: 35.5605, longitude: 45.3151 },
  JED: { latitude: 21.6802, longitude: 39.1574 },
  RAK: { latitude: 31.6048, longitude: -8.0358 },
  BKK: { latitude: 13.6811, longitude: 100.747 },
  HND: { latitude: 35.5497, longitude: 139.787 },
  CMB: { latitude: 7.1808, longitude: 79.8841 },
  DEL: { latitude: 28.5556, longitude: 77.0952 },
  DAC: { latitude: 23.8433, longitude: 90.3978 },
  ISB: { latitude: 33.549, longitude: 72.8257 },
  KBL: { latitude: 34.5659, longitude: 69.2123 },
  JFK: { latitude: 40.6394, longitude: -73.7793 },
};

export type MapPoint = { destination: Destination; latitude: number; longitude: number };

/** Reisemålene med kjent plassering. Et reisemål uten koordinater vises bare i listen – aldri gjettet. */
export const MAP_POINTS: MapPoint[] = DESTINATIONS.flatMap((destination) => {
  const c = AIRPORT_COORDINATES[destination.iata];
  return c ? [{ destination, ...c }] : [];
});

/** Kartets områder – knapper over kartet. «world» viser alle reisemålene. */
export const MAP_AREAS = ["europe", "middleEast", "asia", "americas", "world"] as const;
export type MapArea = (typeof MAP_AREAS)[number];

/** Hvilket område hver flyplass hører til (geografisk; ingen priser eller rangering). */
export const AREA_OF_AIRPORT: Record<string, Exclude<MapArea, "world">> = {
  // Marrakech ligger i Europa-utsnittet (rett sør for Málaga); med i Midtøsten ville det gjort det utsnittet dobbelt så bredt.
  BCN: "europe", LHR: "europe", FCO: "europe", CDG: "europe", LIS: "europe", ATH: "europe", AGP: "europe", WAW: "europe", TOS: "europe", IST: "europe", RAK: "europe",
  DXB: "middleEast", BEY: "middleEast", EBL: "middleEast", ISU: "middleEast", JED: "middleEast",
  BKK: "asia", HND: "asia", CMB: "asia", DEL: "asia", DAC: "asia", ISB: "asia", KBL: "asia",
  JFK: "americas",
};

export const pointsIn = (area: MapArea): MapPoint[] => (area === "world" ? MAP_POINTS : MAP_POINTS.filter((p) => AREA_OF_AIRPORT[p.destination.iata] === area));
export const areaOfDestination = (id: string): Exclude<MapArea, "world"> | null => {
  const p = MAP_POINTS.find((x) => x.destination.id === id);
  return p ? (AREA_OF_AIRPORT[p.destination.iata] ?? null) : null;
};

/**
 * Flyplasser langt fra resten av sitt område. Tatt med i utsnittet ville de
 * gjort alt det andre smått: Tromsø strekker Europa-utsnittet 1,5× i høyden
 * (et tomt midtfelt, resten presset ned), Tokyo Asia-utsnittet 2,2× i bredden.
 * De skjules ikke: når de er utenfor kartet, har de en egen knapp med navn
 * øverst på kartet («↑ Tromsø (TOS)»), og de er i «Hele verden» og i listen.
 */
export const EDGE_AIRPORTS: Partial<Record<MapArea, string[]>> = { europe: ["TOS"], asia: ["HND"] };
const isEdge = (area: MapArea, p: MapPoint) => (EDGE_AIRPORTS[area] ?? []).includes(p.destination.iata);
/** Plass øverst i kartet til knappene for flyplasser utenfor kartet. */
export const EDGE_BAND = 60;

/**
 * Utsnittet for et område i et kart på `size`: områdets flyplasser (uten de
 * fjerne, se EDGE_AIRPORTS) med luft rundt – minst 12° bredt, ett reisemål gir
 * ikke gatenivå – og plass øverst til knappene for dem som er utenfor.
 */
export const areaRegion = (area: MapArea, size: Size): Region => {
  const core = pointsIn(area).filter((p) => !isEdge(area, p));
  return fitRegion(core, size, EDGE_AIRPORTS[area] ? { top: EDGE_BAND } : {});
};

export type OffMapAirport = { point: MapPoint; arrow: string; side: "left" | "right" };
/**
 * Områdets fjerne flyplasser som ikke er på kartet nå, med en pil som peker
 * dit de er. Vises som knapper med navn; et trykk velger reisemålet.
 */
export function offMapAirports(area: MapArea | null, r: Region, size: Size): OffMapAirport[] {
  if (!area) return [];
  const shown = fitAspect(r, size);
  return pointsIn(area)
    .filter((p) => isEdge(area, p))
    .flatMap((point) => {
      const { x, y } = project(point, shown, size);
      if (x >= 0 && x <= size.width && y >= 0 && y <= size.height) return [];
      const dx = x < 0 ? -1 : x > size.width ? 1 : 0;
      const dy = y < 0 ? -1 : y > size.height ? 1 : 0;
      const arrows: Record<string, string> = { "0,-1": "↑", "0,1": "↓", "-1,0": "←", "1,0": "→", "-1,-1": "↖", "1,-1": "↗", "-1,1": "↙", "1,1": "↘" };
      const arrow = arrows[`${dx},${dy}`]!;
      return [{ point, arrow, side: x > size.width / 2 ? ("right" as const) : ("left" as const) }];
    });
}

/** Området kartet åpner i: området til det valgte reisemålet, ellers Europa (der HelloSkys avreiseflyplasser er). */
export const initialArea = (selectedId: string | null): MapArea => (selectedId ? areaOfDestination(selectedId) : null) ?? "europe";

/** Omtrent hvor stor en knapp for en flyplass utenfor kartet er (pt): «↑ Tromsø (TOS)». */
export function offMapButtonSize(text: string, fontScale = 1) {
  const k = Math.min(Math.max(fontScale, 1), MAX_PIN_SCALE);
  return { width: (text.length * 9 + 30) * k, height: 44 * k };
}

/**
 * Hvor knappene for flyplasser utenfor kartet står: øverst, på siden flyplassen
 * er, men aldri over en nål (eller under kortet). Er plassen tatt, prøves den
 * andre siden og midten, og så litt lenger ned.
 */
export function placeOffMapButtons(items: { side: "left" | "right"; text: string }[], clusters: Cluster[], r: Region, size: Size, coveredBottom: number, fontScale = 1): { left: number; top: number; width: number; height: number }[] {
  const shown = fitAspect(r, size);
  const taken = clusters.map((c) => {
    const at = project(c.lead, shown, size);
    const b = pinBox(c.members.length, fontScale, c.selected);
    return { x: at.x - b.width / 2, y: at.y - b.height / 2, r: at.x + b.width / 2, b: at.y + b.height / 2 };
  });
  const placed: { left: number; top: number; width: number; height: number }[] = [];
  const free = (x: number, y: number, w: number, h: number) =>
    [...taken, ...placed.map((p) => ({ x: p.left, y: p.top, r: p.left + p.width, b: p.top + p.height }))].every((t) => x + w <= t.x || t.r <= x || y + h <= t.y || t.b <= y);
  for (const it of items) {
    const { width, height } = offMapButtonSize(it.text, fontScale);
    const pad = 12;
    // Først helt til siden flyplassen er, så den andre siden og midten, så hver 8. pt bortover.
    const across = Array.from({ length: Math.max(0, Math.floor((size.width - 2 * pad - width) / 8)) + 1 }, (_, i) => pad + i * 8);
    const xs = [...(it.side === "right" ? [size.width - pad - width, pad] : [pad, size.width - pad - width]), (size.width - width) / 2, ...(it.side === "right" ? across.reverse() : across)];
    let spot: { left: number; top: number } | null = null;
    for (let top = 8; !spot && top + height <= size.height - coveredBottom - 8; top += 8)
      for (const left of xs)
        if (free(left, top, width, height)) {
          spot = { left, top };
          break;
        }
    placed.push({ ...(spot ?? { left: xs[0]!, top: 8 }), width, height });
  }
  return placed;
}
