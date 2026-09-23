import type { MobileSearchResult } from "@contracts/mobileSearch";

/**
 * Hva slags resultater dette er, slik serveren faktisk oppgir det:
 *  - demo: HelloSkys demomotor (ingen leverandør) – ikke ekte fly.
 *  - sandbox: en ekte leverandørs testmiljø (KAYAK sandbox, Duffel test …).
 *  - live: ekte priser fra leverandøren.
 * `demoMode` fra serveren betyr bare at Duffel ikke er satt opp, og brukes
 * derfor bare når serveren ikke oppgir leverandør og sandkasse.
 */
export type ResultKind = "demo" | "sandbox" | "live";

export function resultKind(r: Pick<MobileSearchResult, "provider" | "sandbox" | "demoMode">): ResultKind {
  if (r.provider === "demo") return "demo";
  if (r.sandbox === true) return "sandbox";
  if (r.sandbox === false) return "live";
  return r.demoMode ? "demo" : "live";
}

const PROVIDER_NAMES: Record<string, string> = { kayak: "KAYAK", duffel: "Duffel", travelport: "Travelport" };

export function providerDisplayName(provider: string | undefined): string {
  return (provider && PROVIDER_NAMES[provider]) || provider || "";
}

/** Etter så lang tid sier appen at prisene kan ha endret seg (serveren hurtigbufrer søk i 5 min). */
export const STALE_AFTER_MS = 15 * 60_000;

export function pricesStale(at: number, now: number = Date.now()): boolean {
  return now - at > STALE_AFTER_MS;
}
