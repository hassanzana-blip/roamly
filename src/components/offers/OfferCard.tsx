import { useId, useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ArrowLeftRight, Briefcase, ChevronDown, Leaf, Luggage, Moon, Share2 } from "lucide-react";
import type { Offer, OfferPassenger, OfferSlice, Segment } from "@contracts/types";
import { cabinLabel, crossesMidnight, fareConditionLabel, formatClock, formatDuration, formatMinor, layoverInfo, previewTotalMinor, toMinor } from "@/lib/format";
import Icon from "@/components/app/Icon";
import { Button } from "@/components/ui/button";
import { useFeeConfig } from "@/lib/useFeeConfig";
import { useT } from "@/lib/i18n";
import { PREFERENCES, hasAirportChange, highlights, payingPassengers, type Preference } from "@/lib/offers";
import { cn } from "@/lib/utils";
import { sliceBaggage, sliceLabel } from "./offerUtils";
import { AirportChangeDiagram, BaggageVisual, FamilyGlyph, RouteDiagram, AMENITY_ICONS } from "@/components/graphics";

/** "2 voksne · 1 barn" from the offer's passenger list; infants only when present. */
function useParty(passengers: Pick<OfferPassenger, "type">[]) {
  const t = useT();
  const n = (type: OfferPassenger["type"]) => passengers.filter((p) => p.type === type).length;
  const parts: string[] = [];
  if (n("adult")) parts.push(t("pax.adults", { count: n("adult") }));
  if (n("child")) parts.push(t("pax.children", { count: n("child") }));
  if (n("infant_without_seat")) parts.push(t("pax.infants", { count: n("infant_without_seat") }));
  return parts.join(" · ");
}

export function SliceViz({ slice }: { slice: OfferSlice }) {
  const t = useT();
  const dayShift = crossesMidnight(slice.departingAt, slice.arrivingAt);
  return (
    <div className="flex items-center gap-3">
      <div className="w-14 shrink-0 text-right sm:w-16">
        <p className="t-num text-xl font-semibold leading-none sm:text-[22px]">{formatClock(slice.departingAt)}</p>
        <p className="t-code mt-1 text-muted-foreground">{slice.origin.iata}</p>
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
        <p className="mt-1.5 truncate text-center text-xs text-muted-foreground">
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
        <p className="t-num text-xl font-semibold leading-none sm:text-[22px]">
          {formatClock(slice.arrivingAt)}
          {dayShift > 0 && (
            <sup className="ml-0.5 text-[10px] font-semibold text-muted-foreground" aria-label={dayShift === 1 ? t("oc.arrival.next") : t("oc.arrival.days", { count: dayShift })}>
              +{dayShift}
            </sup>
          )}
        </p>
        <p className="t-code mt-1 text-muted-foreground">{slice.destination.iata}</p>
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
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="flex items-center gap-3 text-xs text-muted-foreground">
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

/**
 * One offer. Anatomy, top to bottom: why it ranks first (only the top card),
 * who flies + the total, the route lines, the baggage strip, the details
 * disclosure, and the actions. The price sits in the header so a list of
 * cards can be scanned by price without reaching the bottom of each card.
 */
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
  const allHighlights = highlights(offer, offer.passengers);
  const family = allHighlights.includes("oc.tag.family");
  const flexible = allHighlights.find((k) => k === "oc.tag.refundable" || k === "oc.tag.changeable");
  const airportChange = hasAirportChange(offer);
  const recommendedLabel = recommended ? PREFERENCES.find((p) => p.key === recommended)?.label : undefined;
  // Why this one ranks first: the strongest facts, never a score.
  const reasons = recommended ? allHighlights.slice(0, 3).map((k) => t(k)) : [];
  const party = useParty(offer.passengers);
  // The trip-wide baggage promise: the weakest slice decides, exactly like the details view.
  const bags = offer.slices.map((s) => sliceBaggage(s, offer.baggage));
  const carryOn = Math.min(...bags.map((b) => b.carryOnBags));
  const checked = Math.min(...bags.map((b) => b.checkedBags));
  const carryOnUnknown = bags.some((b) => b.carryOnUnknown);
  const checkedUnknown = bags.some((b) => b.checkedUnknown);
  const nextDay = offer.slices.some((s) => crossesMidnight(s.departingAt, s.arrivingAt) > 0);

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-card transition-[border-color,box-shadow] duration-base ease-out",
        selected ? "border-primary" : recommended ? "border-foreground" : "border-border hover:border-foreground/40",
      )}
      aria-label={t("oc.aria", { airline: offer.owner.name, price: formatMinor(totalMinor, currency) })}
    >
      {recommendedLabel && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-primary-soft px-4 py-2.5 text-sm text-accent-foreground sm:px-5">
          <span className="font-semibold text-foreground">{t("oc.ourpick")} · {t(recommendedLabel)}</span>
          {reasons.length > 0 && <span className="text-accent-foreground">{reasons.join(" · ")}</span>}
        </div>
      )}

      {/* Who flies + what it costs, on one line */}
      <div className="flex items-start justify-between gap-4 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="t-code grid size-8 shrink-0 place-items-center rounded-md bg-muted text-foreground" aria-hidden="true">
              {offer.owner.iata}
            </span>
            <span className="truncate text-[15px] font-semibold">{offer.owner.name}</span>
          </div>
          {operatedBy.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{t("od.operatedby", { name: operatedBy.join(", ") })}</p>}
          {(family || flexible || airportChange || nextDay || hasOvernight || hasLong) && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t("oc.details")}>
              {family && (
                <li className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                  <FamilyGlyph size={14} /> {t("oc.tag.family")}
                </li>
              )}
              {flexible && <li className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{t(flexible)}</li>}
              {nextDay && (
                <li className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                  <Moon className="size-3" aria-hidden="true" /> {t("oc.arrivalnextday")}
                </li>
              )}
              {airportChange && <li className="rounded-md bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">{t("oc.tag.airportchange")}</li>}
              {hasOvernight && <li className="rounded-md bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">{t("oc.overnight")}</li>}
              {!hasOvernight && hasLong && <li className="rounded-md bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">{t("oc.longlayover")}</li>}
            </ul>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="t-price text-foreground">{formatMinor(totalMinor, currency)}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">{offer.passengers.length > 1 ? t("oc.totalfor.party", { party }) : t("oc.forpax", { count: 1 })}</p>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
        {offer.slices.map((slice, i) => (
          <div key={slice.id}>
            {offer.slices.length > 1 && <p className="mb-2 text-xs font-semibold text-muted-foreground">{sliceLabel(offer.slices.length, i)}</p>}
            <SliceViz slice={slice} />
          </div>
        ))}

        {/* Baggage strip: the question every family asks first, answered per ticket. */}
        <div className="grid gap-2 rounded-lg bg-muted/60 p-3 sm:grid-cols-2 sm:gap-4 sm:px-4">
          <div className="flex items-center gap-2.5">
            <BaggageVisual kind="cabin" count={carryOn} unknown={carryOnUnknown} size={22} label={carryOnUnknown ? t("bg.carryon.unknown") : t("bg.carryon", { count: carryOn })} />
            <span className="text-sm" aria-hidden="true">{carryOnUnknown ? t("oc.carryon.unknown") : t("oc.carryon.included", { count: carryOn })}</span>
          </div>
          <div className={cn("flex items-center gap-2.5", !checkedUnknown && checked > 0 ? "text-foreground" : "text-muted-foreground")}>
            <BaggageVisual kind="checked" count={checked} unknown={checkedUnknown} size={22} label={checkedUnknown ? t("bg.checked.unknown") : checked === 0 ? t("bg.checked.none") : t("bg.checked", { count: checked })} />
            <span className="text-sm" aria-hidden="true">
              {checkedUnknown ? t("oc.checked.unknown") : checked === 0 ? t("oc.checked.addable") : t("oc.checked.included", { count: checked })}
            </span>
          </div>
        </div>
      </div>

      <Collapsible.Root open={expanded} onOpenChange={setExpanded}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
          <Collapsible.Trigger asChild>
            <button type="button" aria-controls={detailsId} className="inline-flex min-h-10 items-center gap-1.5 rounded-md text-sm font-medium text-foreground underline-offset-4 hover:underline">
              {expanded ? t("oc.hide") : t("oc.show")}
              <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-base ease-out", expanded && "rotate-180")} aria-hidden="true" />
            </button>
          </Collapsible.Trigger>
          <span className="hidden items-center gap-1 text-xs text-muted-foreground md:flex" title={t("oc.co2")}>
            <Leaf className="size-3.5" aria-hidden="true" /> {offer.emissionsKg} kg CO₂
          </span>
        </div>
        <Collapsible.Content id={detailsId} className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          <div className="space-y-6 border-t border-border bg-muted/40 px-4 py-5 sm:px-5">
            {offer.slices.map((slice, i) => (
              <SliceDetails key={slice.id} slice={slice} label={sliceLabel(offer.slices.length, i)} fallbackBaggage={offer.baggage} />
            ))}
            <div className="rounded-lg bg-card p-4 text-xs">
              <p className="mb-1.5 text-sm font-semibold text-foreground">{t("oc.conditions")}</p>
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

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-border px-4 py-3.5 sm:px-5">
        <p className="min-w-0 text-xs text-muted-foreground">
          {paying > 1 && <span className="t-num">{t("sr.perperson", { price: formatMinor(Math.round(totalMinor / paying / 100) * 100, currency) })} · </span>}
          {t("oc.incl")}
        </p>
        <div className="flex items-center gap-2">
          {onToggleCompare && (
            <Button
              type="button"
              variant={comparing ? "dark" : "outline"}
              size="icon"
              onClick={() => onToggleCompare(offer)}
              disabled={!comparing && compareDisabled}
              aria-pressed={comparing}
              aria-label={comparing ? t("oc.selected") : t("oc.compare")}
              title={comparing ? t("oc.selected") : t("oc.compare")}
            >
              <Icon icon={ArrowLeftRight} size={18} />
            </Button>
          )}
          {shareText && (
            <Button asChild variant="outline" size="icon">
              <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" aria-label={t("oc.share")} title={t("oc.share")}>
                <Icon icon={Share2} size={18} />
              </a>
            </Button>
          )}
          <Button size="lg" onClick={() => onSelect(offer)} className="px-8">
            {t("oc.select")}
          </Button>
        </div>
      </div>
    </article>
  );
}
