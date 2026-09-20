import { Plane } from "lucide-react";
import type { OfferSlice } from "@contracts/types";
import { crossesMidnight, formatClock, formatDuration } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * One leg as a line: big departure and arrival times, the airports under
 * them, the duration over a line with the little plane on it.
 * `tone="dark"` is kept for the confirmation and checkout surfaces.
 */
export function SliceViz({ slice, tone = "light", size = "md" }: { slice: OfferSlice; tone?: "light" | "dark"; size?: "md" | "lg" }) {
  const t = useT();
  const dayShift = crossesMidnight(slice.departingAt, slice.arrivingAt);
  const dark = tone === "dark";
  const muted = dark ? "text-white/65" : "text-muted-foreground";
  const big = size === "lg";
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <div className="shrink-0 text-left">
        <p className={cn("t-num font-bold leading-none tracking-tight", big ? "text-[34px] sm:text-[40px]" : "text-[28px] sm:text-[30px]")}>{formatClock(slice.departingAt)}</p>
        <p className={cn("mt-1.5 text-[15px] font-medium", muted)}>{slice.origin.iata}</p>
      </div>
      <div className="relative min-w-0 flex-1">
        <p className={cn("mb-1.5 truncate text-center text-[15px]", muted)}>
          {formatDuration(slice.durationMinutes)}
          {slice.stops > 0 && (
            <>
              {" · "}
              {t("oc.stops", { count: slice.stops })} {slice.segments.slice(0, -1).map((s) => s.destination.iata).join(", ")}
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          <span className={cn("relative h-px flex-1", dark ? "bg-white/25" : "bg-petrol/30")}>
            {Array.from({ length: slice.stops }).map((_, i) => (
              <span
                key={i}
                className={cn("absolute top-1/2 size-2 -translate-y-1/2 rounded-full border-2", dark ? "border-white/70 bg-night" : "border-petrol bg-white")}
                style={{ left: `${((i + 1) / (slice.stops + 1)) * 100}%` }}
                title={slice.segments[i]?.destination.city}
              />
            ))}
          </span>
          <Plane className={cn("size-5 shrink-0", dark ? "text-white/80" : "text-petrol")} aria-hidden="true" />
          <span className={cn("h-px flex-1", dark ? "bg-white/25" : "bg-petrol/30")} />
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("t-num font-bold leading-none tracking-tight", big ? "text-[34px] sm:text-[40px]" : "text-[28px] sm:text-[30px]")}>
          {formatClock(slice.arrivingAt)}
          {dayShift > 0 && (
            <sup className={cn("ml-0.5 text-[12px] font-medium", muted)} aria-label={dayShift === 1 ? t("oc.arrival.next") : t("oc.arrival.days", { count: dayShift })}>
              +{dayShift}
            </sup>
          )}
        </p>
        <p className={cn("mt-1.5 text-[15px] font-medium", muted)}>{slice.destination.iata}</p>
      </div>
    </div>
  );
}
