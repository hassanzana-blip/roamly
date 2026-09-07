import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { trpc } from "@/providers/trpc";
import type { CabinClass } from "@contracts/types";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Priskalender — hele månedens veiledende priser fra vårt eget prissøk.
 * Velg en dato for å søke på nytt. Kun reelle data fra priceHints-APIet.
 */

const MONTHS_NB = [
  "januar", "februar", "mars", "april", "mai", "juni",
  "juli", "august", "september", "oktober", "november", "desember",
];
const WD_NB = ["ma", "ti", "on", "to", "fr", "lø", "sø"];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function PriceCalendar({
  origin,
  destination,
  depart,
  returnDays = 0,
  cabinClass,
  passengerTypes,
  onPick,
}: {
  origin: string;
  destination: string;
  /** Valgt utreisedato (YYYY-MM-DD) */
  depart: string;
  /** Antall dager til hjemreise (0 = én vei) */
  returnDays?: number;
  cabinClass: CabinClass;
  passengerTypes: ("adult" | "child" | "infant_without_seat")[];
  onPick: (date: string) => void;
}) {
  const baseMonth = depart.slice(0, 7); // YYYY-MM
  const [offset, setOffset] = useState(0);

  const month = useMemo(() => {
    const [y, m] = baseMonth.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1 + offset, 1));
  }, [baseMonth, offset]);

  const today = iso(new Date());

  // Alle dager i måneden fra og med i dag (maks 31 — priceHints-grensen)
  const dates = useMemo(() => {
    const y = month.getUTCFullYear();
    const m = month.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const out: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const s = iso(new Date(Date.UTC(y, m, d)));
      if (s >= today) out.push(s);
    }
    return out.slice(0, 31);
  }, [month, today]);

  const hints = trpc.flights.priceHints.useQuery(
    {
      origin,
      destination,
      cabinClass,
      dates,
      returnDates:
        returnDays > 0 && dates.length
          ? dates.map((d) => iso(new Date(new Date(`${d}T12:00Z`).getTime() + returnDays * 86_400_000)))
          : undefined,
      passengers: passengerTypes,
    },
    { enabled: dates.length > 0, staleTime: 300_000, placeholderData: (prev) => prev },
  );

  // amount er en desimal-streng (eller null) — sammenlign som tall, aldri som streng
  const byDate = useMemo(
    () => new Map((hints.data ?? []).map((h) => [h.date, h.amount ? Number(h.amount) : null])),
    [hints.data],
  );
  const cheapest = useMemo(() => {
    const nums = (hints.data ?? []).map((h) => (h.amount ? Number(h.amount) : NaN)).filter((n) => Number.isFinite(n) && n > 0);
    return nums.length ? Math.min(...nums) : Infinity;
  }, [hints.data]);

  // Første ukedag (ma=0 … sø=6) for månedens 1.
  const firstWeekday = (month.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const canGoBack = offset > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-base font-semibold capitalize">
          {MONTHS_NB[month.getUTCMonth()]} {month.getUTCFullYear()}
        </p>
        <div className="flex gap-1">
          <button
            onClick={() => setOffset((o) => Math.max(0, o - 1))}
            disabled={!canGoBack}
            aria-label="Forrige måned"
            className="grid h-11 w-11 place-items-center rounded-full border border-border transition-colors hover:bg-muted disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setOffset((o) => Math.min(5, o + 1))}
            aria-label="Neste måned"
            className="grid h-11 w-11 place-items-center rounded-full border border-border transition-colors hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WD_NB.map((d) => (
          <span key={d} className="pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {d}
          </span>
        ))}
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const s = iso(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day)));
          const past = s < today;
          const amount = byDate.get(s) ?? null;
          const active = s === depart;
          const isCheapest = amount !== null && amount === cheapest;
          if (past) {
            return <span key={s} className="rounded-xl py-1.5 text-[12px] text-muted-foreground/40">{day}</span>;
          }
          return (
            <button
              key={s}
              onClick={() => onPick(s)}
              aria-pressed={active}
              aria-label={`${day}. ${MONTHS_NB[month.getUTCMonth()]}${amount ? `, fra ${formatPrice(amount, "NOK")}` : ""}${isCheapest ? " (billigst)" : ""}`}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center rounded-xl border py-1.5 transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : isCheapest
                    ? "border-primary/50 bg-accent hover:border-primary"
                    : "border-transparent hover:border-border hover:bg-muted",
              )}
            >
              <span className="text-[12px] font-semibold leading-none">{day}</span>
              <span
                className={cn(
                  "mt-0.5 text-[9px] font-medium leading-none",
                  active ? "text-primary-foreground/80" : isCheapest ? "font-bold text-accent-foreground" : "text-muted-foreground",
                )}
              >
                {amount
                  ? formatPrice(amount, "NOK").replace(/\s?kr$/, "")
                  : hints.isLoading
                    ? "·"
                    : "–"}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Veiledende priser fra vårt prissøk. Velg en dato for å se nøyaktige tilbud.
        {cheapest < Infinity && " Billigste dag er markert."}
      </p>
    </div>
  );
}
