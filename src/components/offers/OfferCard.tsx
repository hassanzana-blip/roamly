import { useId, useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ArrowLeftRight, Briefcase, ChevronDown, Leaf, Luggage, Moon, Share2 } from "lucide-react";
import type { Offer, OfferSlice, Segment } from "@contracts/types";
import { cabinLabel, crossesMidnight, fareConditionLabel, formatClock, formatDuration, formatMinor, layoverInfo, previewTotalMinor, toMinor } from "@/lib/format";
import Icon from "@/components/app/Icon";
import { Button } from "@/components/ui/button";
import { useFeeConfig } from "@/lib/useFeeConfig";
import { useT } from "@/lib/i18n";
import { PREFERENCES, highlights, payingPassengers, type Preference } from "@/lib/offers";
import { cn } from "@/lib/utils";
import { sliceBaggage, sliceLabel } from "./offerUtils";
import { AirportChangeDiagram, BaggageVisual, RouteDiagram, AMENITY_ICONS } from "@/components/graphics";

export function SliceViz({ slice }: { slice: OfferSlice }) {
  const t = useT();
  const dayShift = crossesMidnight(slice.departingAt, slice.arrivingAt);
  return (
    <div className="flex items-center gap-3">
      <div className="w-14 shrink-0 text-right sm:w-16">
        <p className="text-lg font-semibold leading-none tabular sm:text-xl">{formatClock(slice.departingAt)}</p>
        <p className="mt-1 text-xs font-medium tracking-wider text-muted-foreground">{slice.origin.iata}</p>
      </div>
      <div className="relative min-w-0 flex-1 px-1">
        <div className="flex items-center">
          <span className="size-1.5 rounded-full bg-foreground/70" />
          <span className="relative h-px flex-1 bg-border">
            {Array.from({ length: slice.stops }).map((_, i) => (
              <span
                key={i}
                className="absolute top-1/2 size-2 -translate-y-1/2 rounded-full border-2 border-muted-foreground bg-card"
                style={{ left: `${((i + 1) / (slice.stops + 1)) * 100}%` }}
                title={slice.segments[i]?.destination.city}
              />
            ))}
          </span>
          <span className="size-1.5 rounded-full bg-primary" />
        </div>
        <p className="mt-1.5 truncate text-center text-2xs text-muted-foreground">
          {formatDuration(slice.durationMinutes)}
          {" · "}
          {slice.stops === 0 ? (
            <span className="font-medium text-success">{t("oc.direct")}</span>
          ) : (
            `${t("oc.stops", { count: slice.stops })} ${slice.segments
              .slice(0, -1)
              .map((s) => s.destination.iata)
              .join(", ")}`
          )}
        </p>
      </div>
      <div className="w-14 shrink-0 sm:w-16">
        <p className="text-lg font-semibold leading-none tabular sm:text-xl">
          {formatClock(slice.arrivingAt)}
          {dayShift > 0 && (
            <sup className="ml-0.5 text-[10px] font-semibold text-muted-foreground" aria-label={dayShift === 1 ? t("oc.arrival.next") : t("oc.arrival.days", { count: dayShift })}>
              +{dayShift}
            </sup>
          )}
        </p>
        <p className="mt-1 text-xs font-medium tracking-wider text-muted-foreground">{slice.destination.iata}</p>
      </div>
    </div>
  );
}

function SegmentDetail({ seg }: { seg: Segment }) {
  const t = useT();
  const operatedBy = seg.operatingCarrier && seg.operatingCarrier.iata !== seg.carrier.iata ? seg.operatingCarrier : null;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1.5 flex flex-col items-center" aria-hidden="true">
        <span className="size-2 rounded-full bg-foreground/70" />
        <span className="h-8 w-px bg-border" />
        <span className="size-2 rounded-full bg-primary" />
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">
          <span className="tabular">{formatClock(seg.departingAt)}</span> {seg.origin.city} <span className="text-muted-foreground">({seg.origin.iata})</span>
          {" → "}
          <span className="tabular">{formatClock(seg.arrivingAt)}</span> {seg.destination.city} <span className="text-muted-foreground">({seg.destination.iata})</span>
          {crossesMidnight(seg.departingAt, seg.arrivingAt) > 0 && <span className="ml-1 text-xs text-muted-foreground">{t("oc.nextday")}</span>}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {seg.carrier.name} {seg.carrier.iata} {seg.flightNumber} · {seg.aircraft} · {cabinLabel(seg.cabinClass)} · {formatDuration(seg.durationMinutes)}
        </p>
        {operatedBy && <p className="mt-0.5 text-xs text-muted-foreground">{t("od.operatedby", { name: operatedBy.name })}</p>}
        {seg.baggage && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("oc.carryon", { count: seg.baggage.carryOnBags })} · {t("oc.checked", { count: seg.baggage.checkedBags })}
          </p>
        )}
      </div>
    </div>
  );
}

function SliceDetails({ slice, label, fallbackBaggage }: { slice: OfferSlice; label: string; fallbackBaggage: Offer["baggage"] }) {
  const t = useT();
  const bag = sliceBaggage(slice, fallbackBaggage);
  const airportChanges = slice.segments.slice(0, -1).flatMap((seg, i) => {
    const next = slice.segments[i + 1];
    if (seg.destination.iata === next.origin.iata) return [];
    return [{ seg, next, minutes: layoverInfo(seg.arrivingAt, next.departingAt, seg.destination.timeZone).minutes }];
  });
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow text-foreground">{label}</p>
        <p className="flex items-center gap-3 text-2xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Briefcase className="size-3.5" aria-hidden="true" /> {t("oc.carryon", { count: bag.carryOnBags })}
          </span>
          <span className="flex items-center gap-1">
            <Luggage className="size-3.5" aria-hidden="true" /> {t("oc.checked", { count: bag.checkedBags })}
          </span>
        </p>
      </div>
      <RouteDiagram slice={slice} className="mb-4" />
      {airportChanges.map(({ seg, next, minutes }) => (
        <AirportChangeDiagram key={seg.id} fromIata={seg.destination.iata} fromName={seg.destination.name} toIata={next.origin.iata} toName={next.origin.name} minutes={minutes} className="mb-4" />
      ))}
      <div className="space-y-4">
        {slice.segments.map((seg, i) => {
          const next = slice.segments[i + 1];
          const lay = next ? layoverInfo(seg.arrivingAt, next.departingAt, seg.destination.timeZone) : null;
          return (
            <div key={seg.id}>
              <SegmentDetail seg={seg} />
              {lay && (
                <p className={cn("ml-5 mt-1.5 rounded-md px-3 py-1.5 text-xs", lay.overnight || lay.long ? "bg-warning/10 font-medium text-warning" : "bg-muted text-muted-foreground")}>
                  {t("oc.layover", { city: seg.destination.city, duration: formatDuration(lay.minutes) })}
                  {lay.overnight ? t("oc.layover.overnight") : lay.long ? t("oc.layover.long") : ""}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface Props {
  offer: Offer;
  onSelect: (offer: Offer) => void;
  selected?: boolean;
  /** Compare selection (max 3), handled by the parent */
  comparing?: boolean;
  compareDisabled?: boolean;
  onToggleCompare?: (offer: Offer) => void;
  /** Share the offer on WhatsApp */
  shareText?: string;
  /** Marks the top result for the active preference */
  recommended?: Preference;
}

export default function OfferCard({ offer, onSelect, selected, comparing, compareDisabled, onToggleCompare, shareText, recommended }: Props) {
  const t = useT();
  const feeConfig = useFeeConfig();
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const currency = offer.totalCurrency;
  const supplierMinor = toMinor(offer.totalAmount, currency);
  const totalMinor = previewTotalMinor(offer.totalAmount, currency, feeConfig);
  const paying = payingPassengers(offer.passengers);
    const hasOvernight = offer.slices.some((s) =>
    s.segments.some((seg, i) => {
      const next = s.segments[i + 1];
      return next ? layoverInfo(seg.arrivingAt, next.departingAt, seg.destination.timeZone).overnight : false;
    }),
  );
  const hasLong = offer.slices.some((s) =>
    s.segments.some((seg, i) => {
      const next = s.segments[i + 1];
      return next ? layoverInfo(seg.arrivingAt, next.departingAt, seg.destination.timeZone).long : false;
    }),
  );
  const operatedBy = Array.from(
    new Map(
      offer.slices
        .flatMap((s) => s.segments)
        .filter((seg) => seg.operatingCarrier && seg.operatingCarrier.iata !== seg.carrier.iata)
        .map((seg) => [seg.operatingCarrier!.iata, seg.operatingCarrier!.name] as const),
    ).values(),
  );
  const refundLabel = fareConditionLabel("refund", offer.conditions?.refundBeforeDeparture, offer.refundable);
  const changeLabel = fareConditionLabel("change", offer.conditions?.changeBeforeDeparture, offer.changeable);
  const tags = highlights(offer, offer.passengers).filter((k) => k !== "oc.direct" && k !== "oc.tag.bags");
  const recommendedLabel = recommended ? PREFERENCES.find((p) => p.key === recommended)?.label : undefined;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow] duration-base ease-out hover:border-foreground/30",
        selected ? "border-primary" : recommended ? "border-primary/40 shadow-soft" : "border-border",
      )}
      aria-label={t("oc.aria", { airline: offer.owner.name, price: formatMinor(totalMinor, currency) })}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-2xs font-bold tracking-wider text-foreground" aria-hidden="true">
            {offer.owner.iata}
          </span>
          <span className="text-sm font-medium">{offer.owner.name}</span>
          {operatedBy.length > 0 && <span className="text-2xs text-muted-foreground">{t("od.operatedby", { name: operatedBy.join(", ") })}</span>}
          {recommendedLabel && <span className="rounded-md bg-primary-soft px-2 py-0.5 text-2xs font-semibold text-accent-foreground">{t(recommendedLabel)}</span>}
          {offer.slices.some((s) => crossesMidnight(s.departingAt, s.arrivingAt) > 0) && (
            <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-2xs font-medium text-foreground">
              <Moon className="size-3" aria-hidden="true" /> {t("oc.arrivalnextday")}
            </span>
          )}
          {hasOvernight && <span className="rounded-md bg-warning/10 px-2 py-0.5 text-2xs font-semibold text-warning">{t("oc.overnight")}</span>}
          {!hasOvernight && hasLong && <span className="rounded-md bg-warning/10 px-2 py-0.5 text-2xs font-semibold text-warning">{t("oc.longlayover")}</span>}
        </div>
        <span className="hidden items-center gap-1 text-2xs text-muted-foreground md:flex" title={t("oc.co2")}>
          <Leaf className="size-3.5" aria-hidden="true" /> {offer.emissionsKg} kg CO₂
        </span>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
        {offer.slices.map((slice, i) => {
          const bag = sliceBaggage(slice, offer.baggage);
          return (
            <div key={slice.id}>
              {offer.slices.length > 1 && <p className="eyebrow mb-2">{sliceLabel(offer.slices.length, i)}</p>}
              <SliceViz slice={slice} />
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <BaggageVisual kind="cabin" count={bag.carryOnBags} size={18} label={t("bg.carryon", { count: bag.carryOnBags })} />
                  <span aria-hidden="true">{t("oc.carryon", { count: bag.carryOnBags })}</span>
                </span>
                <span className={cn("flex items-center gap-1.5", bag.checkedBags > 0 && "text-foreground")}>
                  <BaggageVisual kind="checked" count={bag.checkedBags} size={18} label={bag.checkedBags === 0 ? t("bg.checked.none") : t("bg.checked", { count: bag.checkedBags })} />
                  <span aria-hidden="true">{bag.checkedBags === 0 ? t("oc.checked.none") : t("oc.checked", { count: bag.checkedBags })}</span>
                </span>
              </div>
            </div>
          );
        })}
        {tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label={t("oc.details")}>
            {tags.map((k) => (
              <li key={k} className="rounded-md border border-border px-2 py-0.5 text-2xs font-medium text-foreground">
                {t(k)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Collapsible.Root open={expanded} onOpenChange={setExpanded}>
        <Collapsible.Trigger asChild>
          <button
            type="button"
            aria-controls={detailsId}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 border-t border-border py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            {expanded ? t("oc.hide") : t("oc.show")}
            <ChevronDown className={cn("size-3.5 transition-transform duration-base", expanded && "rotate-180")} aria-hidden="true" />
          </button>
        </Collapsible.Trigger>
        <Collapsible.Content id={detailsId} className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          <div className="space-y-6 border-t border-border bg-muted/40 px-4 py-5 sm:px-5">
            {offer.slices.map((slice, i) => (
              <SliceDetails key={slice.id} slice={slice} label={sliceLabel(offer.slices.length, i)} fallbackBaggage={offer.baggage} />
            ))}
            <div className="rounded-lg bg-card p-4 text-xs">
              <p className="eyebrow mb-1">{t("oc.conditions")}</p>
              <ul className="space-y-1.5 text-foreground">
                <li className="flex items-center gap-2">
                  {(() => {
                    const I = offer.conditions?.refundBeforeDeparture?.allowed ?? offer.refundable ? AMENITY_ICONS.refundable : AMENITY_ICONS.non_refundable;
                    return <I size={16} className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />;
                  })()}
                  {refundLabel}
                </li>
                <li className="flex items-center gap-2">
                  {(() => {
                    const I = offer.conditions?.changeBeforeDeparture?.allowed ?? offer.changeable ? AMENITY_ICONS.changeable : AMENITY_ICONS.non_refundable;
                    return <I size={16} className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />;
                  })()}
                  {changeLabel}
                </li>
                <li>{t("oc.supplierprice", { price: formatMinor(supplierMinor, currency) })}</li>
                <li className="text-muted-foreground">{t("oc.conditions.note")}</li>
              </ul>
            </div>
          </div>
        </Collapsible.Content>
      </Collapsible.Root>

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-t border-border px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-[26px] font-semibold leading-none tracking-tight tabular text-foreground sm:text-[28px]">{formatMinor(totalMinor, currency)}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("oc.forpax", { count: offer.passengers.length })}
            {paying > 1 && <>, {t("sr.perperson", { price: formatMinor(Math.round(totalMinor / paying), currency) })}</>}
          </p>
          <p className="text-xs text-muted-foreground">{t("oc.approx")}</p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {onToggleCompare && (
            <button
              type="button"
              onClick={() => onToggleCompare(offer)}
              disabled={!comparing && compareDisabled}
              aria-pressed={comparing}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors",
                comparing ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40",
              )}
            >
              <Icon icon={ArrowLeftRight} size={16} />
              {comparing ? t("oc.selected") : t("oc.compare")}
            </button>
          )}
          {shareText && (
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("oc.share")}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon icon={Share2} size={16} />
              {t("oc.share.short")}
            </a>
          )}
          <Button size="lg" onClick={() => onSelect(offer)} className="ml-1 px-7">
            {t("oc.select")}
          </Button>
        </div>
      </div>
    </article>
  );
}
