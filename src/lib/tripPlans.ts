import type { RouterOutputs } from "@/providers/trpc";

export type TripPlanSummary = RouterOutputs["tripPlans"]["list"][number];

/** Neste reiseidé: den nærmeste kommende med datoer, ellers den sist endrede. */
export function pickNextPlan(plans: TripPlanSummary[], today: string): TripPlanSummary | null {
  const open = plans.filter((p) => p.status !== "done");
  if (!open.length) return null;
  const dated = open.filter((p) => p.dateFrom && (p.dateTo ?? p.dateFrom)! >= today).sort((a, b) => a.dateFrom!.localeCompare(b.dateFrom!));
  return dated[0] ?? open[0]!;
}
