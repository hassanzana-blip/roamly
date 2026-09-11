import type { DiscoverDestination } from "./discover";

/**
 * Filtre for Utforsk og fakta på reisemålssidene. Region og flytid er
 * grove kategorier, ikke påstander om minutter: «kort» betyr en reise du
 * gjør på en formiddag, «lang» betyr en du sover på. Regnet fra Oslo.
 */

export type Region = "europa" | "midtosten" | "afrika" | "asia" | "amerika" | "norge";

export const REGION_LABELS: Record<Region, string> = {
  europa: "Europa",
  midtosten: "Tyrkia og Midtøsten",
  afrika: "Afrika",
  asia: "Asia",
  amerika: "Amerika",
  norge: "Norge",
};

export const REGION_ORDER: Region[] = ["europa", "norge", "midtosten", "asia", "afrika", "amerika"];

export const REGION_OF: Record<string, Region> = {
  paris: "europa", london: "europa", barcelona: "europa", lisboa: "europa", rome: "europa", athens: "europa", malaga: "europa", warszawa: "europa",
  mallorca: "europa", alicante: "europa", grancanaria: "europa", tenerife: "europa", algarve: "europa", madeira: "europa", venezia: "europa",
  santorini: "europa", kreta: "europa", rhodos: "europa", dubrovnik: "europa", split: "europa", nice: "europa", amsterdam: "europa", praha: "europa",
  island: "europa", antalya: "europa", kobenhavn: "europa",
  nyc: "amerika",
  istanbul: "midtosten", beirut: "midtosten", dubai: "midtosten", jeddah: "midtosten", erbil: "midtosten", sulaymaniyah: "midtosten",
  marrakech: "afrika", asmara: "afrika",
  kabul: "asia", islamabad: "asia", delhi: "asia", dhaka: "asia", colombo: "asia", bangkok: "asia", tokyo: "asia", bali: "asia", maldivene: "asia",
  tromso: "norge", lofoten: "norge", bergen: "norge", rovaniemi: "norge",
};

export type FlightBucket = "short" | "medium" | "long";

export const FLIGHT_LABELS: Record<FlightBucket, string> = {
  short: "Kort reise",
  medium: "Middels reise",
  long: "Lang reise",
};

/** Forklaring vist ved filteret – ærlig om at det er kategorier, ikke rutetider. */
export const FLIGHT_HINT: Record<FlightBucket, string> = {
  short: "Direkte fra Oslo på en formiddag",
  medium: "En halv dag, direkte eller med ett bytte",
  long: "En hel dag eller natt, som regel med ett bytte",
};

export const FLIGHT_OF: Record<string, FlightBucket> = {
  london: "short", paris: "short", warszawa: "short", tromso: "short", bergen: "short", barcelona: "short", rome: "short",
  kobenhavn: "short", amsterdam: "short", praha: "short", island: "short", venezia: "short", nice: "short", alicante: "short", malaga: "medium",
  lisboa: "medium", athens: "medium", istanbul: "medium", erbil: "medium", sulaymaniyah: "medium", beirut: "medium", marrakech: "medium",
  mallorca: "medium", grancanaria: "medium", tenerife: "medium", algarve: "medium", madeira: "medium", santorini: "medium", kreta: "medium",
  rhodos: "medium", dubrovnik: "medium", split: "medium", antalya: "medium", lofoten: "medium", rovaniemi: "medium",
  dubai: "long", jeddah: "long", nyc: "long", asmara: "long", kabul: "long", islamabad: "long", delhi: "long", dhaka: "long",
  colombo: "long", bangkok: "long", tokyo: "long", bali: "long", maldivene: "long",
};

export type Mood = { id: string; label: string; ids?: string[] };

export const MOODS: Mood[] = [
  { id: "alle", label: "Alle" },
  { id: "vintersol", label: "Vintersol", ids: ["tenerife", "grancanaria", "madeira", "dubai", "maldivene", "bangkok"] },
  { id: "fotball", label: "Fotball", ids: ["london", "barcelona", "istanbul", "dubai"] },
  { id: "romantisk", label: "Romantisk", ids: ["paris", "venezia", "santorini", "lisboa", "nice", "marrakech"] },
  { id: "familie", label: "Familie", ids: ["tenerife", "grancanaria", "mallorca", "kreta", "rhodos", "algarve", "rovaniemi", "london"] },
  { id: "helg", label: "Helgetur", ids: ["london", "paris", "amsterdam", "praha", "kobenhavn", "nice", "barcelona", "bergen"] },
  { id: "sol", label: "Sol og varme", ids: ["mallorca", "alicante", "tenerife", "grancanaria", "algarve", "antalya", "kreta", "rhodos", "santorini", "dubai", "marrakech", "maldivene"] },
  { id: "kultur", label: "Kultur", ids: ["rome", "athens", "praha", "istanbul", "venezia", "paris", "tokyo", "delhi", "marrakech"] },
  { id: "natur", label: "Natur og eventyr", ids: ["island", "lofoten", "tromso", "rovaniemi", "madeira", "bali", "colombo", "dubrovnik"] },
];

export function moodsFor(id: string): Mood[] {
  return MOODS.filter((m) => m.ids?.includes(id));
}

export function matches(d: DiscoverDestination, f: { mood: string; region: Region | "alle"; flight: FlightBucket | "alle" }): boolean {
  const mood = MOODS.find((m) => m.id === f.mood);
  if (mood?.ids && !mood.ids.includes(d.id)) return false;
  if (f.region !== "alle" && REGION_OF[d.id] !== f.region) return false;
  if (f.flight !== "alle" && FLIGHT_OF[d.id] !== f.flight) return false;
  return true;
}
