import { DESTINATIONS, type Destination } from "./destinations";

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
