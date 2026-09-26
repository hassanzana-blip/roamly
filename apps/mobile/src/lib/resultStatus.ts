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
export function exclusionSummary(r: Pick<MobileSearchResult, "excluded">, { t }: Pick<I18n, "t">): { count: number; why: string } | null {
  const ex = r.excluded;
  if (!ex || ex.count <= 0) return null;
  const w = t.results.screen.status.excludedWhy;
  const why: string[] = [];
  if (ex.reasons.origin || ex.reasons.destination) why.push(w.airport);
  if (ex.reasons.date) why.push(w.date);
  // Strekningene: vi sier bare det serveren vet (ikke hvilken strekning som mangler).
  if (ex.reasons.missing_leg) why.push(w.missingLeg);
  if (ex.reasons.extra_leg) why.push(w.extraLeg);
  if (ex.reasons.incomplete) why.push(w.incomplete);
  return { count: ex.count, why: why.join(", ") };
}

/**
 * Kan prisene kalles en total for alle reisende? Serveren sier det (priceBasis). En eldre server sier det ikke: da
 * gjelder det bare leverandører som oppgir totaler i sin egen kontrakt (Duffel, Travelport, demo) – aldri KAYAK.
 */
export function totalConfirmed(r: Pick<MobileSearchResult, "priceBasis" | "provider">): boolean {
  if (r.priceBasis) return r.priceBasis.kind === "total";
  return r.provider !== "kayak";
}

