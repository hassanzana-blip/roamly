import { createContext, useContext } from "react";
import type { ResolvedMeta } from "@/lib/seo";

/**
 * Register/avregistrer sidemetadata. `priority` lar en layout (f.eks. AdminLayout)
 * sette et fallback (0) som enkeltsider (1) overstyrer uavhengig av monteringsrekkefølge.
 */
export type HelmetRegistry = {
  register: (id: number, meta: ResolvedMeta, priority: number) => void;
  unregister: (id: number) => void;
};

export const HelmetContext = createContext<HelmetRegistry>({ register: () => {}, unregister: () => {} });

export function useHelmet(): HelmetRegistry {
  return useContext(HelmetContext);
}
