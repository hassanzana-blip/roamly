import { AppError } from "./errors";
import { env } from "./env";
import { duffelConfig, duffelSearch } from "./duffel";
import { travelportConfig, travelportSearch } from "./travelport";
import { kayakConfig, kayakSearch } from "./kayak";
import { demoSearch } from "./demo";
import type { CabinClass, FlightProvidersStatus, FlightSource, SearchPassengerInput, SearchResult, SearchSliceInput } from "@contracts/types";

/**
 * Én dør inn til flysøk, uansett leverandør.
 *
 *  - Duffel: HelloSky selger billetten (checkout, Stripe, orkestrator).
 *  - Travelport: kun søk; bestilling går via Duffel/kontakt.
 *  - KAYAK: metasøk – kunden bestiller hos leverandøren via KAYAKs klikklenke.
 *  - Demo: lokale testdata, forbudt i APP_ENV=production.
 *
 * Hvilken leverandør et vanlig søk går til styres av FLIGHT_PROVIDER. «auto»
 * er den gamle rekkefølgen (Travelport når slått på, ellers Duffel, ellers
 * demo), så en deploy uten nye variabler oppfører seg nøyaktig som før.
 * Sandkasse-KAYAK slipper aldri inn som standard i produksjon uten
 * KAYAK_ALLOW_SANDBOX_IN_PRODUCTION=true; med KAYAK_PREVIEW=true kan et søk
 * likevel be om `provider=kayak` eksplisitt (tydelig merket som testdata).
 */

export type FlightProviderId = FlightSource;

export type FlightSearchRequest = {
  slices: SearchSliceInput[];
  passengers: SearchPassengerInput[];
  cabinClass: CabinClass;
  currency?: string;
  directOnly?: boolean;
  /** UUID per sluttbruker per økt (brukes av KAYAK som userTrackId). */
  userTrackId?: string;
  userAgent?: string;
  clientIp?: string;
};

export interface FlightProvider {
  id: FlightProviderId;
  /** false = testdata (Duffel test, Travelport pp, KAYAK sandbox, demo). */
  liveMode: boolean;
  sandbox: boolean;
  bookingMode: "hellosky" | "external";
  /** Skal svaret caches per normalisert input? Demo svarer alltid ferskt. */
  cacheable: boolean;
  search(req: FlightSearchRequest): Promise<SearchResult>;
}

export type ProviderResolutionConfig = {
  flightProvider: "auto" | "duffel" | "travelport" | "kayak";
  isProdEnv: boolean;
  duffelConfigured: boolean;
  travelportEnabled: boolean;
  kayakEnabled: boolean;
  kayakSandbox: boolean;
  kayakPreview: boolean;
  allowSandboxInProduction: boolean;
};

/** Ren og testbar: hvilken leverandør er standard, og hvilke kan bes om eksplisitt. */
export function resolveProviders(cfg: ProviderResolutionConfig): { active: FlightProviderId; selectable: FlightProviderId[] } {
  const kayakAsDefaultOk = cfg.kayakEnabled && (!cfg.kayakSandbox || !cfg.isProdEnv || cfg.allowSandboxInProduction);
  const autoChain = (): FlightProviderId => (cfg.travelportEnabled ? "travelport" : cfg.duffelConfigured ? "duffel" : "demo");

  let active: FlightProviderId;
  switch (cfg.flightProvider) {
    case "kayak":
      active = kayakAsDefaultOk ? "kayak" : autoChain();
      break;
    case "travelport":
      active = cfg.travelportEnabled ? "travelport" : autoChain();
      break;
    case "duffel":
      active = cfg.duffelConfigured ? "duffel" : autoChain();
      break;
    default:
      active = autoChain();
  }

  const selectable = new Set<FlightProviderId>([active]);
  if (cfg.kayakEnabled && (cfg.kayakPreview || active === "kayak")) selectable.add("kayak");
  if (cfg.duffelConfigured) selectable.add("duffel");
  if (cfg.travelportEnabled) selectable.add("travelport");
  return { active, selectable: [...selectable] };
}

function currentConfig(): ProviderResolutionConfig {
  return {
    flightProvider: env.FLIGHT_PROVIDER,
    isProdEnv: env.isProdEnv,
    duffelConfigured: duffelConfig.configured,
    travelportEnabled: travelportConfig.searchEnabled,
    kayakEnabled: kayakConfig.enabled,
    kayakSandbox: kayakConfig.sandbox,
    kayakPreview: env.kayakPreview,
    allowSandboxInProduction: env.KAYAK_ALLOW_SANDBOX_IN_PRODUCTION === "true",
  };
}

const withMeta = (result: SearchResult, p: Pick<FlightProvider, "id" | "sandbox" | "bookingMode">): SearchResult => ({
  ...result,
  provider: p.id,
  sandbox: p.sandbox,
  bookingMode: p.bookingMode,
});

function build(id: FlightProviderId): FlightProvider {
  switch (id) {
    case "kayak": {
      const p: FlightProvider = {
        id,
        liveMode: kayakConfig.liveMode,
        sandbox: kayakConfig.sandbox,
        bookingMode: "external",
        cacheable: true,
        search: async (req) => withMeta(await kayakSearch(req), p),
      };
      return p;
    }
    case "travelport": {
      const p: FlightProvider = {
        id,
        liveMode: travelportConfig.liveMode,
        sandbox: !travelportConfig.liveMode,
        bookingMode: "hellosky",
        cacheable: true,
        search: async (req) => withMeta(await travelportSearch(req), p),
      };
      return p;
    }
    case "duffel": {
      const p: FlightProvider = {
        id,
        liveMode: duffelConfig.liveMode,
        sandbox: !duffelConfig.liveMode,
        bookingMode: "hellosky",
        cacheable: true,
        search: async (req) => withMeta(await duffelSearch(req), p),
      };
      return p;
    }
    default: {
      const p: FlightProvider = {
        id: "demo",
        liveMode: false,
        sandbox: true,
        bookingMode: "hellosky",
        cacheable: false,
        search: async (req) => {
          await new Promise((r) => setTimeout(r, 600)); // realistisk leverandørlatens i demo
          return withMeta(demoSearch(req), p);
        },
      };
      return p;
    }
  }
}

/** Leverandøren for dette søket. `requested` må være en av de valgbare, ellers VALIDATION. */
export function getFlightProvider(requested?: FlightProviderId): FlightProvider {
  const { active, selectable } = resolveProviders(currentConfig());
  if (requested && requested !== active && !selectable.includes(requested)) {
    throw new AppError("VALIDATION", { message: "Denne søkeleverandøren er ikke tilgjengelig.", data: { field: "provider" } });
  }
  return build(requested ?? active);
}

export function flightProvidersStatus(): FlightProvidersStatus {
  const { active, selectable } = resolveProviders(currentConfig());
  return {
    active,
    selectable,
    kayak: {
      enabled: kayakConfig.enabled,
      mode: kayakConfig.mode,
      externalBooking: true,
      airlineDirect: kayakConfig.airlineDirectMode,
    },
  };
}
