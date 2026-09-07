import { useMemo } from "react";
import { trpc } from "@/providers/trpc";
import type { FeeConfig } from "@contracts/types";
import { DEFAULT_FEE_CONFIG } from "@/lib/format";

/**
 * Gjeldende servicegebyr-satser til FORHÅNDSVISNING (søk, tilbudskort, før
 * checkout-økt). Hentes én gang fra `flights.status().feeConfig` og caches
 * i 5 min; faller tilbake til konstantene i format.ts til backend svarer
 * (eller om feltet mangler). Serveren er alltid eneste kilde til endelig pris.
 */
export function useFeeConfig(): FeeConfig {
  const status = trpc.flights.status.useQuery(undefined, { staleTime: 300_000, retry: false });
  const cfg = status.data?.feeConfig;
  return useMemo<FeeConfig>(() => {
    if (!cfg || typeof cfg.percent !== "number" || !(cfg.percent >= 0 && cfg.percent <= 1)) return DEFAULT_FEE_CONFIG;
    return {
      percent: cfg.percent,
      flatMinorByCurrency: { ...DEFAULT_FEE_CONFIG.flatMinorByCurrency, ...(cfg.flatMinorByCurrency ?? {}) },
    };
  }, [cfg]);
}
