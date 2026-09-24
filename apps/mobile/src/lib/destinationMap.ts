import { DESTINATIONS, type Destination } from "./destinations";
import { fitRegion, type Region, type Size } from "./mapGeometry";

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

/** Utsnittet for et område i et kart på `size`: alle områdets flyplasser med luft rundt (minst 12° bredt – ett reisemål gir ikke gatenivå). */
export const areaRegion = (area: MapArea, size: Size): Region => fitRegion(pointsIn(area), size);

/** Området kartet åpner i: området til det valgte reisemålet, ellers Europa (der HelloSkys avreiseflyplasser er). */
export const initialArea = (selectedId: string | null): MapArea => (selectedId ? areaOfDestination(selectedId) : null) ?? "europe";
