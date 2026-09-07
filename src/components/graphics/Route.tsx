import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, CarFront, Moon } from "lucide-react";
import type { OfferSlice } from "@contracts/types";
import { formatDuration, layoverInfo } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * RouteDiagram: the itinerary as a line with real stops.
 * OSL ●────────● IST ────● EBL
 * Every dot and label comes from segment data. Long or overnight layovers and
 * airport changes are marked on the stop itself, not as a paragraph elsewhere.
 * The line draws in gently the first time it is shown (Motion, reduced-motion safe).
 */
export function RouteDiagram({ slice, animate = true, className }: { slice: OfferSlice; animate?: boolean; className?: string }) {
  const t = useT();
  const reduce = useReducedMotion();
  const segs = slice.segments;
  const points = [segs[0].origin, ...segs.map((s) => s.destination)];
  const n = points.length;
  const stops = segs.slice(0, -1).map((seg, i) => {
    const next = segs[i + 1];
    const lay = layoverInfo(seg.arrivingAt, next.departingAt, seg.destination.timeZone);
    return { ...lay, airportChange: seg.destination.iata !== next.origin.iata, nextIata: next.origin.iata };
  });
  const draw = animate && !reduce;
  const ease = [0.2, 0.8, 0.2, 1] as const;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center" aria-hidden="true">
        {points.map((pt, i) => {
          const stop = i > 0 && i < n - 1 ? stops[i - 1] : null;
          const warn = Boolean(stop && (stop.airportChange || stop.overnight || stop.long));
          return (
            <div key={`${pt.iata}-${i}`} className="contents">
              {i > 0 && (
                <motion.span
                  className="h-px flex-1 origin-left bg-border"
                  initial={draw ? { scaleX: 0 } : false}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.45, delay: (i - 1) * 0.12, ease }}
                />
              )}
              <motion.span
                className={cn(
                  "size-3 shrink-0 rounded-full border-2",
                  i === n - 1 ? "border-primary bg-primary" : i === 0 ? "border-foreground bg-foreground" : warn ? "border-warning bg-card" : "border-foreground bg-card",
                )}
                initial={draw ? { scale: 0.5, opacity: 0 } : false}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.25, delay: draw ? 0.05 + i * 0.12 : 0, ease }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-xs">
        {points.map((pt, i) => {
          const stop = i > 0 && i < n - 1 ? stops[i - 1] : null;
          return (
            <div key={`${pt.iata}-${i}`} className={cn("min-w-0", i === 0 ? "text-left" : i === n - 1 ? "text-right" : "text-center")}>
              <p className="font-semibold tracking-wide text-foreground">{pt.iata}</p>
              {stop && (
                <p className={cn("mt-0.5 flex items-center justify-center gap-1 whitespace-nowrap text-2xs", stop.airportChange || stop.overnight || stop.long ? "text-warning" : "text-muted-foreground")}>
                  {stop.overnight ? <Moon className="size-3" aria-hidden="true" /> : stop.airportChange ? <CarFront className="size-3" aria-hidden="true" /> : null}
                  {formatDuration(stop.minutes)}
                  {stop.airportChange ? ` → ${stop.nextIata}` : ""}
                </p>
              )}
              {i === 0 && <p className="mt-0.5 text-2xs text-muted-foreground">{t("rt.depart")}</p>}
              {i === n - 1 && <p className="mt-0.5 text-2xs text-muted-foreground">{t("rt.arrive")}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Airport-change diagram: the smallest possible explanation of a self-transfer.
 *   IST  ──car──  SAW
 * Only rendered when consecutive segments land and depart from different airports.
 */
export function AirportChangeDiagram({ fromIata, fromName, toIata, toName, minutes, className }: { fromIata: string; fromName: string; toIata: string; toName: string; minutes: number; className?: string }) {
  const t = useT();
  return (
    <div role="note" className={cn("rounded-lg border border-warning/30 bg-warning/10 p-3 text-warning", className)}>
      <p className="flex items-center gap-1.5 text-xs font-semibold">
        <AlertTriangle className="size-3.5" aria-hidden="true" /> {t("rt.airportchange")}
      </p>
      <div className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-2 text-foreground">
        <div className="text-center">
          <p className="text-sm font-semibold tabular">{fromIata}</p>
          <p className="max-w-24 truncate text-2xs text-muted-foreground">{fromName}</p>
        </div>
        <div className="flex flex-col items-center">
          <span className="flex w-full items-center gap-1">
            <span className="h-px flex-1 bg-warning/50" />
            <CarFront className="size-4 text-warning" aria-hidden="true" />
            <span className="h-px flex-1 bg-warning/50" />
          </span>
          <span className="mt-0.5 text-2xs text-muted-foreground">{t("rt.transferwindow", { duration: formatDuration(minutes) })}</span>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold tabular">{toIata}</p>
          <p className="max-w-24 truncate text-2xs text-muted-foreground">{toName}</p>
        </div>
      </div>
      <p className="mt-2 text-2xs text-foreground/80">{t("rt.airportchange.body")}</p>
    </div>
  );
}
