import { Check } from "lucide-react";
import { useT, type I18nKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * BookingTimeline: BOOKED → PAYMENT → TICKET → CHECK-IN → DEPARTURE,
 * derived from the order state machine. Cancelled / refunded / failed states
 * render as a terminal branch instead of a step.
 */
type StepKey = "booked" | "payment" | "ticket" | "checkin" | "departure";
const STEPS: { key: StepKey; label: I18nKey }[] = [
  { key: "booked", label: "tl.booked" },
  { key: "payment", label: "tl.payment" },
  { key: "ticket", label: "tl.ticket" },
  { key: "checkin", label: "tl.checkin" },
  { key: "departure", label: "tl.departure" },
];

import type { TimelineState } from "./timeline";

export function BookingTimeline({ state, className }: { state: TimelineState; className?: string }) {
  const t = useT();
  return (
    <ol className={cn("grid grid-cols-5 gap-1", className)} aria-label={t("tl.aria")}>
      {STEPS.map((s, i) => {
        const idx = i + 1;
        const done = idx < state.done || (idx === state.done && state.current > state.done) || (idx <= state.done && idx < state.current);
        const complete = idx <= state.done && (idx < state.current || state.done === 5);
        const current = idx === state.current && !state.terminal && state.done < 5;
        const off = idx > state.current;
        const terminalHere = state.terminal && idx === state.current;
        return (
          <li key={s.key} className="min-w-0" aria-current={current ? "step" : undefined}>
            <div className="flex items-center">
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border text-2xs font-semibold",
                  terminalHere
                    ? "border-border bg-muted text-muted-foreground"
                    : complete || done
                      ? "border-success bg-success text-success-foreground"
                      : current
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground",
                )}
                aria-hidden="true"
              >
                {complete || done ? <Check className="size-3.5" strokeWidth={3} /> : idx}
              </span>
              {i < STEPS.length - 1 && <span className={cn("ml-1 h-px flex-1", complete || done ? "bg-success" : "bg-border")} aria-hidden="true" />}
            </div>
            <p className={cn("mt-1.5 pr-1 text-2xs leading-tight", off && !terminalHere ? "text-muted-foreground" : "font-medium text-foreground")}>
              {terminalHere ? t(`tl.${state.terminal}` as I18nKey) : t(s.label)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
