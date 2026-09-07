import { useId, useState } from "react";
import { ArrowLeftRight, Briefcase, ChevronDown, Leaf, Luggage, Moon, Share2 } from "lucide-react";
import type { Offer, OfferSlice, Segment } from "@contracts/types";
import {
  cabinLabel,
  crossesMidnight,
  fareConditionLabel,
  formatClock,
  formatDuration,
  formatMinor,
  layoverInfo,
  previewTotalMinor,
  toMinor,
} from "@/lib/format";
import Icon from "@/components/app/Icon";
import { useFeeConfig } from "@/lib/useFeeConfig";
import { useT } from "@/lib/i18n";
import { sliceBaggage, sliceLabel } from "./offerUtils";

export function SliceViz({ slice }: { slice: OfferSlice }) {
  const t = useT();
  const dayShift = crossesMidnight(slice.departingAt, slice.arrivingAt);
  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <p className="text-lg font-bold leading-none sm:text-xl">{formatClock(slice.departingAt)}</p>
        <p className="mt-1 text-xs font-semibold tracking-wider text-muted-foreground">{slice.origin.iata}</p>
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
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        </div>
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
          {formatDuration(slice.durationMinutes)}
          {" · "}
          {slice.stops === 0 ? (
            <span className="font-medium text-foreground">{t("oc.direct")}</span>
          ) : (
            `${t("oc.stops", { count: slice.stops })} ${slice.segments
              .slice(0, -1)
              .map((s) => s.destination.iata)
              .join(", ")}`
          )}
        </p>
      </div>
      <div>
        <p className="text-lg font-bold leading-none sm:text-xl">
          {formatClock(slice.arrivingAt)}
          {dayShift > 0 && (
            <sup className="ml-0.5 text-[10px] font-semibold text-foreground" aria-label={dayShift === 1 ? t("oc.arrival.next") : t("oc.arrival.days", { count: dayShift })}>
              +{dayShift}
            </sup>
          )}
        </p>
        <p className="mt-1 text-xs font-semibold tracking-wider text-muted-foreground">{slice.destination.iata}</p>
      </div>
    </div>
  );
}

function SegmentDetail({ seg }: { seg: Segment }) {
  const t = useT();
  const operatedBy = seg.operatingCarrier && seg.operatingCarrier.iata !== seg.carrier.iata ? seg.operatingCarrier : null;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 flex flex-col items-center" aria-hidden="true">
        <span className="h-2 w-2 rounded-full bg-skyline" />
        <span className="h-8 w-px bg-skyline/30" />
        <span className="h-2 w-2 rounded-full bg-primary" />
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">
          {formatClock(seg.departingAt)} {seg.origin.city} <span className="text-muted-foreground">({seg.origin.iata})</span>
          {" → "}
          {formatClock(seg.arrivingAt)} {seg.destination.city} <span className="text-muted-foreground">({seg.destination.iata})</span>
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
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">{label}</p>
        <p className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Briefcase className="h-3.5 w-3.5" aria-hidden="true" /> {t("oc.carryon", { count: bag.carryOnBags })}
          </span>
          <span className="flex items-center gap-1">
            <Luggage className="h-3.5 w-3.5" aria-hidden="true" /> {t("oc.checked", { count: bag.checkedBags })}
          </span>
        </p>
      </div>
      <div className="space-y-4">
        {slice.segments.map((seg, i) => {
          const next = slice.segments[i + 1];
          const lay = next ? layoverInfo(seg.arrivingAt, next.departingAt, seg.destination.timeZone) : null;
          return (
            <div key={seg.id}>
              <SegmentDetail seg={seg} />
              {lay && (
                <p
                  className={`ml-5 mt-1.5 rounded-lg px-3 py-1.5 text-xs ${
                    lay.overnight || lay.long ? "bg-primary/10 font-medium text-primary" : "bg-card text-muted-foreground"
                  }`}
                >
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
  /** Sammenlign-valg (maks 3) — håndteres av forelderen */
  comparing?: boolean;
  compareDisabled?: boolean;
  onToggleCompare?: (offer: Offer) => void;
  /** Del tilbudet på WhatsApp */
  shareText?: string;
}

export default function OfferCard({ offer, onSelect, selected, comparing, compareDisabled, onToggleCompare, shareText }: Props) {
  const t = useT();
  const feeConfig = useFeeConfig();
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const currency = offer.totalCurrency;
  const supplierMinor = toMinor(offer.totalAmount, currency);
  const totalMinor = previewTotalMinor(offer.totalAmount, currency, feeConfig);
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

  return (
    <article
      className={`overflow-hidden rounded-3xl border bg-card transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-night/5 ${
        selected ? "border-primary" : "border-border"
      }`}
      aria-label={t("oc.aria", { airline: offer.owner.name, price: formatMinor(totalMinor, currency) })}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b hairline px-5 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-xs font-black tracking-wider text-foreground" aria-hidden="true">
            {offer.owner.iata}
          </span>
          <span className="text-sm font-medium">{offer.owner.name}</span>
          {operatedBy.length > 0 && <span className="text-[11px] text-muted-foreground">{t("od.operatedby", { name: operatedBy.join(", ") })}</span>}
          {offer.slices.every((s) => s.stops === 0) && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">{t("oc.direct")}</span>
          )}
          {offer.slices.some((s) => crossesMidnight(s.departingAt, s.arrivingAt) > 0) && (
            <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-foreground">
              <Moon className="h-3 w-3" aria-hidden="true" /> {t("oc.arrivalnextday")}
            </span>
          )}
          {hasOvernight && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">{t("oc.overnight")}</span>}
          {!hasOvernight && hasLong && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">{t("oc.longlayover")}</span>}
        </div>
        <span className="hidden items-center gap-1 text-[11px] text-muted-foreground md:flex" title={t("oc.co2")}>
          <Leaf className="h-3.5 w-3.5" aria-hidden="true" /> {offer.emissionsKg} kg CO₂
        </span>
      </div>

      <div className="space-y-5 px-5 py-5">
        {offer.slices.map((slice, i) => {
          const bag = sliceBaggage(slice, offer.baggage);
          return (
            <div key={slice.id}>
              {offer.slices.length > 1 && (
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{sliceLabel(offer.slices.length, i)}</p>
              )}
              <SliceViz slice={slice} />
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" aria-hidden="true" /> {t("oc.carryon", { count: bag.carryOnBags })}
                </span>
                <span className="flex items-center gap-1">
                  <Luggage className="h-3.5 w-3.5" aria-hidden="true" /> {bag.checkedBags === 0 ? t("oc.checked.none") : t("oc.checked", { count: bag.checkedBags })}
                </span>
              </p>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-controls={detailsId}
        className="flex min-h-11 w-full items-center justify-center gap-1.5 border-t hairline py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {expanded ? t("oc.hide") : t("oc.show")}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <div id={detailsId} hidden={!expanded} className="space-y-6 border-t hairline bg-muted/40 px-5 py-5">
        {offer.slices.map((slice, i) => (
          <SliceDetails key={slice.id} slice={slice} label={sliceLabel(offer.slices.length, i)} fallbackBaggage={offer.baggage} />
        ))}
        <div className="rounded-2xl bg-card p-4 text-xs">
          <p className="mb-1 font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t("oc.conditions")}</p>
          <ul className="space-y-1 text-foreground">
            <li>{refundLabel}</li>
            <li>{changeLabel}</li>
            <li className="text-muted-foreground">{t("oc.conditions.note")}</li>
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t hairline px-5 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{refundLabel}</p>
          <p className="text-2xl font-extrabold leading-none tracking-tight text-night sm:text-3xl">{formatMinor(totalMinor, currency)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("oc.totalfor", { count: offer.passengers.length })} · {t("oc.approx")}
          </p>
          <p className="text-[11px] text-muted-foreground">{t("oc.supplierprice", { price: formatMinor(supplierMinor, currency) })}</p>
          <div className="mt-2.5 flex items-center gap-2">
            {onToggleCompare && (
              <button
                type="button"
                onClick={() => onToggleCompare(offer)}
                disabled={!comparing && compareDisabled}
                aria-pressed={comparing}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-colors ${
                  comparing ? "border-foreground/30 bg-night text-white" : "hairline text-muted-foreground hover:text-foreground disabled:opacity-40"
                }`}
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
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border hairline px-3 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icon icon={Share2} size={16} />
                {t("oc.share.short")}
              </a>
            )}
          </div>
        </div>
        <button
          onClick={() => onSelect(offer)}
          className="min-h-12 rounded-full bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:brightness-[0.94] active:scale-[0.98] sm:px-9"
        >
          {t("oc.select")}
        </button>
      </div>
    </article>
  );
}
