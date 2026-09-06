import { useState } from "react";
import { Briefcase, ChevronDown, Leaf, Luggage, Moon } from "lucide-react";
import type { Offer, OfferSlice, Segment } from "@contracts/types";
import {
  CABIN_LABELS,
  crossesMidnight,
  formatClock,
  formatDuration,
  formatPrice,
} from "@/lib/format";

export function SliceViz({ slice }: { slice: OfferSlice }) {
  const dayShift = crossesMidnight(slice.departingAt, slice.arrivingAt);
  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <p className="text-lg font-bold leading-none sm:text-xl">{formatClock(slice.departingAt)}</p>
        <p className="mt-1 text-xs font-semibold tracking-wider text-muted-foreground">
          {slice.origin.iata}
        </p>
      </div>
      <div className="relative flex-1 px-1">
        <div className="flex items-center">
          <span className="h-1.5 w-1.5 rounded-full bg-skyline" />
          <span className="relative h-px flex-1 bg-skyline/40">
            {Array.from({ length: slice.stops }).map((_, i) => (
              <span
                key={i}
                className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border-2 border-primary bg-card"
                style={{ left: `${((i + 1) / (slice.stops + 1)) * 100}%` }}
                title={slice.segments[i]?.destination.city}
              />
            ))}
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
        </div>
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
          {formatDuration(slice.durationMinutes)}
          {" · "}
          {slice.stops === 0 ? (
            <span className="font-medium text-skyline">Direkte</span>
          ) : (
            `${slice.stops} stopp ${slice.segments
              .slice(0, -1)
              .map((s) => s.destination.iata)
              .join(", ")}`
          )}
        </p>
      </div>
      <div>
        <p className="text-lg font-bold leading-none sm:text-xl">
          {formatClock(slice.arrivingAt)}
          {dayShift > 0 && <sup className="ml-0.5 text-[10px] font-semibold text-gold">+{dayShift}</sup>}
        </p>
        <p className="mt-1 text-xs font-semibold tracking-wider text-muted-foreground">
          {slice.destination.iata}
        </p>
      </div>
    </div>
  );
}

function SegmentDetail({ seg }: { seg: Segment }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 flex flex-col items-center">
        <span className="h-2 w-2 rounded-full bg-skyline" />
        <span className="h-8 w-px bg-skyline/30" />
        <span className="h-2 w-2 rounded-full bg-gold" />
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">
          {formatClock(seg.departingAt)} {seg.origin.city}{" "}
          <span className="text-muted-foreground">({seg.origin.iata})</span>
          {" → "}
          {formatClock(seg.arrivingAt)} {seg.destination.city}{" "}
          <span className="text-muted-foreground">({seg.destination.iata})</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {seg.carrier.name} {seg.carrier.iata} {seg.flightNumber} · {seg.aircraft} ·{" "}
          {CABIN_LABELS[seg.cabinClass]} · {formatDuration(seg.durationMinutes)}
        </p>
      </div>
    </div>
  );
}

function SliceDetails({ slice, label }: { slice: OfferSlice; label: string }) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-skyline">
        {label}
      </p>
      <div className="space-y-4">
        {slice.segments.map((seg, i) => (
          <div key={seg.id}>
            <SegmentDetail seg={seg} />
            {i < slice.segments.length - 1 && (
              <p className="ml-5 mt-1.5 rounded-lg bg-card px-3 py-1.5 text-xs text-muted-foreground">
                Mellomlanding i {seg.destination.city} ·{" "}
                {formatDuration(
                  Math.round(
                    (new Date(slice.segments[i + 1].departingAt).getTime() -
                      new Date(seg.arrivingAt).getTime()) /
                      60_000,
                  ),
                )}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  offer: Offer;
  onSelect: (offer: Offer) => void;
  selected?: boolean;
}

export default function OfferCard({ offer, onSelect, selected }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      className={`card-lift overflow-hidden rounded-3xl border bg-card transition-colors ${
        selected ? "border-gold" : "hairline hover:border-accent/50"
      }`}
    >
      <div className="flex items-center justify-between border-b hairline px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-xs font-black tracking-wider text-skyline">
            {offer.owner.iata}
          </span>
          <span className="text-sm font-medium">{offer.owner.name}</span>
          {offer.slices.every((s) => s.stops === 0) && (
            <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold">
              Direkte
            </span>
          )}
          {crossesMidnight(offer.slices[0].departingAt, offer.slices[0].arrivingAt) > 0 && (
            <span className="hidden items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-skyline sm:flex">
              <Moon className="h-3 w-3" /> Ankomst neste dag
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="hidden items-center gap-1 sm:flex" title="Håndbagasje inkludert">
            <Briefcase className="h-3.5 w-3.5" /> {offer.baggage.carryOnBags}
          </span>
          <span className="hidden items-center gap-1 sm:flex" title="Innsjekket bagasje inkludert">
            <Luggage className="h-3.5 w-3.5" /> {offer.baggage.checkedBags}
          </span>
          <span className="hidden items-center gap-1 md:flex" title="Estimert CO₂-utslipp">
            <Leaf className="h-3.5 w-3.5" /> {offer.emissionsKg} kg
          </span>
        </div>
      </div>

      <div className="space-y-5 px-5 py-5">
        {offer.slices.map((slice) => (
          <SliceViz key={slice.id} slice={slice} />
        ))}
      </div>

      {/* expandable per-segment details */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-center gap-1.5 border-t hairline py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-gold"
      >
        {expanded ? "Skjul detaljer" : "Se flydetaljer"}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="space-y-6 border-t hairline bg-muted/40 px-5 py-5">
          {offer.slices.map((slice, i) => (
            <SliceDetails
              key={slice.id}
              slice={slice}
              label={
                offer.slices.length === 1
                  ? "Reisedetaljer"
                  : i === 0
                    ? "Utreise"
                    : i === offer.slices.length - 1 && offer.slices.length === 2
                      ? "Hjemreise"
                      : `Strekning ${i + 1}`
              }
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t hairline bg-muted/50 px-5 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {offer.refundable ? "Refunderbar" : offer.changeable ? "Kan endres" : "Billigste pris"}
          </p>
          <p className="font-display text-3xl leading-none text-gold">
            {formatPrice(offer.totalAmount, offer.totalCurrency)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {offer.passengers.length > 1 ? `totalt for ${offer.passengers.length} reisende` : "per person"} · inkl. skatter og avgifter
          </p>
        </div>
        <button
          onClick={() => onSelect(offer)}
          className="rounded-2xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:brightness-110 active:scale-[0.98] sm:px-8"
        >
          Velg
        </button>
      </div>
    </article>
  );
}
