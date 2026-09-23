import type { MobileSearchResult } from "@contracts/mobileSearch";

/**
 * Hva slags resultater dette er, slik serveren faktisk oppgir det:
 *  - demo: HelloSkys demomotor – ikke ekte fly.
 *  - sandbox: en ekte leverandørs testmiljø (KAYAK sandbox, Duffel test …).
 *  - live: bare når serveren sier begge deler uttrykkelig – en kjent, ekte
 *    leverandør og `sandbox: false`.
 *  - unverified: alt annet (manglende eller ukjent leverandør, manglende
 *    sandbox-flagg). `demoMode`/`liveMode` beviser ingenting her: de gjelder
 *    Duffel-oppsettet, ikke leverandøren som svarte.
 */
export type ResultKind = "demo" | "sandbox" | "live" | "unverified";

const LIVE_PROVIDERS = new Set(["kayak", "duffel", "travelport"]);

export function resultKind(r: Pick<MobileSearchResult, "provider" | "sandbox">): ResultKind {
  if (r.provider === "demo") return "demo";
  if (r.sandbox === true) return "sandbox";
  if (r.sandbox === false && r.provider && LIVE_PROVIDERS.has(r.provider)) return "live";
  return "unverified";
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
