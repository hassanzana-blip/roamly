import type { DiscoverDestination } from "./discover";

/**
 * Filtre for Utforsk og fakta på reisemålssidene. Region og flytid er
 * grove kategorier, ikke påstander om minutter: «kort» betyr en reise du
 * gjør på en formiddag, «lang» betyr en du sover på. Regnet fra Oslo.
 */

export type Region = "europa" | "kurdistan" | "midtosten" | "afrika" | "asia" | "amerika" | "norge";

export const REGION_LABELS: Record<Region, string> = {
  europa: "Europa",
  kurdistan: "Kurdistan",
  midtosten: "Tyrkia og Midtøsten",
  afrika: "Afrika",
  asia: "Asia",
  amerika: "Amerika",
  norge: "Norge",
};

export const REGION_ORDER: Region[] = ["kurdistan", "midtosten", "europa", "asia", "afrika", "amerika", "norge"];

export const REGION_OF: Record<string, Region> = {
  paris: "europa", london: "europa", barcelona: "europa", lisboa: "europa", rome: "europa", athens: "europa", malaga: "europa", warszawa: "europa",
  nyc: "amerika",
  istanbul: "midtosten", beirut: "midtosten", dubai: "midtosten", jeddah: "midtosten",
  erbil: "kurdistan", sulaymaniyah: "kurdistan",
  marrakech: "afrika", asmara: "afrika",
  kabul: "asia", islamabad: "asia", delhi: "asia", dhaka: "asia", colombo: "asia", bangkok: "asia", tokyo: "asia",
  tromso: "norge",
};

export type FlightBucket = "short" | "medium" | "long";

export const FLIGHT_LABELS: Record<FlightBucket, string> = {
  short: "Kort reise",
  medium: "Middels reise",
  long: "Lang reise",
};

/** Forklaring vist ved filteret — ærlig om at det er kategorier, ikke rutetider. */
export const FLIGHT_HINT: Record<FlightBucket, string> = {
  short: "Direkte fra Oslo på en formiddag",
  medium: "En halv dag, direkte eller med ett bytte",
  long: "En hel dag eller natt, som regel med ett bytte",
};

export const FLIGHT_OF: Record<string, FlightBucket> = {
  london: "short", paris: "short", warszawa: "short", tromso: "short", barcelona: "short", rome: "short",
  lisboa: "medium", athens: "medium", malaga: "medium", istanbul: "medium", erbil: "medium", sulaymaniyah: "medium", beirut: "medium", marrakech: "medium",
  dubai: "long", jeddah: "long", nyc: "long", asmara: "long", kabul: "long", islamabad: "long", delhi: "long", dhaka: "long", colombo: "long", bangkok: "long", tokyo: "long",
};

export type Mood = { id: string; label: string; ids?: string[] };

export const MOODS: Mood[] = [
  { id: "alle", label: "Alle" },
  { id: "hjem", label: "Hjem til familien", ids: ["istanbul", "erbil", "sulaymaniyah", "beirut", "marrakech", "asmara", "kabul", "islamabad", "delhi", "dhaka", "colombo", "warszawa"] },
  { id: "fotball", label: "Fotball", ids: ["london", "barcelona", "istanbul", "dubai"] },
  { id: "romantisk", label: "Romantisk", ids: ["paris", "rome", "lisboa", "beirut"] },
  { id: "familie", label: "Familie", ids: ["istanbul", "erbil", "sulaymaniyah", "beirut", "marrakech", "colombo"] },
  { id: "helg", label: "Helgetur", ids: ["london", "paris", "warszawa", "lisboa", "barcelona"] },
  { id: "sol", label: "Sol og varme", ids: ["dubai", "malaga", "marrakech", "bangkok", "colombo", "jeddah"] },
  { id: "kultur", label: "Kultur", ids: ["istanbul", "erbil", "sulaymaniyah", "rome", "athens", "delhi", "beirut"] },
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
