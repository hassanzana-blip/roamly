import type { MobileSearchResult } from "@contracts/mobileSearch";
import type { I18n } from "../i18n";

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

/**
 * Tilbud serveren holdt utenfor fordi de ikke gjaldt søket (se MobileSearchResult.excluded): antall og en kort,
 * sann grunn på kundens språk. null når ingenting ble holdt utenfor (eller serveren er eldre og ikke sier det).
 */
export function exclusionSummary(r: Pick<MobileSearchResult, "excluded" | "slices">, { t }: Pick<I18n, "t">): { count: number; why: string } | null {
  const ex = r.excluded;
  if (!ex || ex.count <= 0) return null;
  const w = t.results.screen.status.excludedWhy;
  const why: string[] = [];
  if (ex.reasons.origin || ex.reasons.destination) why.push(w.airport);
  if (ex.reasons.date) why.push(w.date);
  // Feil antall strekninger: ved tur-retur mangler hjemreisen; ved en vei har tilbudet en strekning for mye.
  if (ex.reasons.slices) why.push(r.slices.length > 1 ? w.noReturn : w.extraLeg);
  return { count: ex.count, why: why.join(", ") };
}

