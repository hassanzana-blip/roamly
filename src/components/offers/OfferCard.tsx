import { useId, useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ArrowLeftRight, ArrowRight, ArrowUpRight, Backpack, Bookmark, Briefcase, Check, ChevronDown, Leaf, Luggage, Moon, Plane, Share2 } from "lucide-react";
import type { Offer, OfferSlice, Segment } from "@contracts/types";
import { cabinLabel, crossesMidnight, fareConditionLabel, formatClock, formatDuration, formatMinor, layoverInfo, previewTotalMinor, toMinor } from "@/lib/format";
import Icon from "@/components/app/Icon";
import { Button } from "@/components/ui/button";
import { useFeeConfig } from "@/lib/useFeeConfig";
import { useT, type I18nKey } from "@/lib/i18n";
import { PREFERENCES, hasAirportChange, highlights, payingPassengers, type Preference } from "@/lib/offers";
import { cn } from "@/lib/utils";
import { partyLabel, providerName, sliceBaggage, sliceLabel } from "./offerUtils";
import { AirportChangeDiagram, FamilyGlyph, RouteDiagram, AMENITY_ICONS } from "@/components/graphics";
import AirlineLogo from "@/components/brand/AirlineLogo";

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
        {/* Hvem som faktisk flyr strekningen, med selskapets eget merke. */}
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          <AirlineLogo airline={{ iata: seg.carrier.iata, name: seg.carrier.name }} size={16} className="rounded" />
          <span className="font-medium text-foreground">{seg.carrier.name}</span>
          <span className="t-code">{seg.carrier.iata} {seg.flightNumber}</span>
          <span>· {seg.aircraft} · {cabinLabel(seg.cabinClass)} · {formatDuration(seg.durationMinutes)}</span>
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
  /** Saved in a collection («Lagret»); the parent owns the storage. */
  saved?: boolean;
  onToggleSave?: (offer: Offer) => void;
}

/** Bagasjeløftet for hele reisen: den svakeste strekningen bestemmer. */
function tripBaggage(offer: Offer) {
  const bags = offer.slices.map((s) => sliceBaggage(s, offer.baggage));
  return {
    carryOn: Math.min(...bags.map((b) => b.carryOnBags)),
    checked: Math.min(...bags.map((b) => b.checkedBags)),
    carryOnUnknown: bags.some((b) => b.carryOnUnknown),
    checkedUnknown: bags.some((b) => b.checkedUnknown),
  };
}

/**
 * Bagasje som to linjer ved én ryggsekk: hva som er med, og hva som ikke er
 * det. Bare det leverandøren faktisk har oppgitt: ukjent er «ikke oppgitt»,
 * aldri «inkludert».
 */
function BaggageLines({ offer }: { offer: Offer }) {
  const t = useT();
  const { carryOn, checked, carryOnUnknown, checkedUnknown } = tripBaggage(offer);
  const fees = offer.baggageFees;
  const first = carryOnUnknown ? t("oc.bag.carry.unknown") : carryOn > 0 ? t("oc.bag.carry.incl") : fees?.carryOn ? `${t("oc.bag.carry.fee")} (${fees.carryOn})` : t("oc.bag.carry.none");
  const second = checkedUnknown ? t("oc.bag.checked.unknown") : checked > 0 ? t("oc.bag.checked.incl", { count: checked }) : fees?.checked ? `${t("oc.bag.checked.fee")} (${fees.checked})` : t("oc.bag.checked.none");
  return (
    <div className="flex items-start gap-3">
      <Backpack className="mt-0.5 size-7 shrink-0 text-petrol" aria-hidden="true" />
      <div className="min-w-0 text-[16px] leading-snug">
        <p className={cn("font-semibold", carryOnUnknown && "text-muted-foreground")}>{first}</p>
        <p className="text-muted-foreground">{second}</p>
      </div>
    </div>
  );
}

/** Alt som er verdt en advarsel eller et løfte, som merkelapper. */
function OfferTags({ keys }: { keys: ReturnType<typeof offerFlags> }) {
  const t = useT();
  const base = "bg-secondary text-foreground";
  const warn = "bg-warning/10 text-warning";
  const { family, flexible, airportChange, nextDay, hasOvernight, hasLong } = keys;
  if (!(family || flexible || airportChange || nextDay || hasOvernight || hasLong)) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t("oc.details")}>
      {family && (
        <li className={cn("inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[13px] font-medium", base)}>
          <FamilyGlyph size={14} /> {t("oc.tag.family")}
        </li>
      )}
      {flexible && <li className={cn("rounded-lg px-2.5 py-1 text-[13px] font-medium", base)}>{t(flexible)}</li>}
      {nextDay && (
        <li className={cn("inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[13px] font-medium", base)}>
          <Moon className="size-3" aria-hidden="true" /> {t("oc.arrivalnextday")}
        </li>
      )}
      {airportChange && <li className={cn("rounded-lg px-2.5 py-1 text-[13px] font-semibold", warn)}>{t("oc.tag.airportchange")}</li>}
      {hasOvernight && <li className={cn("rounded-lg px-2.5 py-1 text-[13px] font-semibold", warn)}>{t("oc.overnight")}</li>}
      {!hasOvernight && hasLong && <li className={cn("rounded-lg px-2.5 py-1 text-[13px] font-semibold", warn)}>{t("oc.longlayover")}</li>}
    </ul>
  );
}

/** Fakta som avgjør hvilke merkelapper tilbudet fortjener. */
function offerFlags(offer: Offer) {
  const layovers = offer.slices.flatMap((s) =>
    s.segments.map((seg, i) => {
      const next = s.segments[i + 1];
      return next ? layoverInfo(seg.arrivingAt, next.departingAt, seg.destination.timeZone) : null;
    }),
  );
  const all = highlights(offer, offer.passengers);
  return {
    family: all.includes("oc.tag.family"),
    flexible: all.find((k) => k === "oc.tag.refundable" || k === "oc.tag.changeable"),
    airportChange: hasAirportChange(offer),
    nextDay: offer.slices.some((s) => crossesMidnight(s.departingAt, s.arrivingAt) > 0),
    hasOvernight: layovers.some((l) => l?.overnight),
    hasLong: layovers.some((l) => l?.long),
    all,
  };
}

/** Hvem som flyr det, når leverandøren og den som setter navnet er ulike. */
function operatorsOf(offer: Offer) {
  return Array.from(
    new Map(
      offer.slices
        .flatMap((s) => s.segments)
        .filter((seg) => seg.operatingCarrier && seg.operatingCarrier.iata !== seg.carrier.iata)
        .map((seg) => [seg.operatingCarrier!.iata, seg.operatingCarrier!.name] as const),
    ).values(),
  );
}

/**
 * Det utfoldede innholdet: rutene i detalj og vilkårene. Likt for begge
 * formene, slik at et tilbud aldri sier én ting i listen og en annen når
 * det åpnes.
 */
function OfferDetails({ offer, supplierMinor, currency }: { offer: Offer; supplierMinor: number; currency: string }) {
  const t = useT();
  const refundLabel = fareConditionLabel("refund", offer.conditions?.refundBeforeDeparture, offer.refundable);
  const changeLabel = fareConditionLabel("change", offer.conditions?.changeBeforeDeparture, offer.changeable);
  return (
    <div className="space-y-6 border-t border-border bg-secondary/60 px-4 py-5 sm:px-5">
      {offer.slices.map((slice, i) => (
        <SliceDetails key={slice.id} slice={slice} label={sliceLabel(offer.slices.length, i)} fallbackBaggage={offer.baggage} />
      ))}
      <div className="rounded-xl bg-card p-4 text-xs">
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
          {offer.baggageFees?.checked && <li>{t("oc.bagfee.checked", { price: offer.baggageFees.checked })}</li>}
          {offer.baggageFees?.carryOn && <li>{t("oc.bagfee.carryon", { price: offer.baggageFees.carryOn })}</li>}
          <li>{offer.booking ? t("oc.price.external", { price: formatMinor(supplierMinor, currency) }) : t("oc.supplierprice", { price: formatMinor(supplierMinor, currency) })}</li>
          {typeof offer.emissionsKg === "number" && (
            <li className="flex items-center gap-2 text-muted-foreground">
              <Leaf className="size-3.5" aria-hidden="true" /> {offer.emissionsKg} kg CO₂
            </li>
          )}
          {offer.booking?.disclosure && <li className="text-muted-foreground">{offer.booking.disclosure}</li>}
          <li className="text-muted-foreground">{offer.booking ? t("oc.price.external.note") : t("oc.conditions.note")}</li>
        </ul>
      </div>
    </div>
  );
}

const BADGE_KEYS: Record<string, I18nKey> = {
  freeCancellation: "oc.badge.freeCancellation",
  instantBook: "oc.badge.instantBook",
  selfTransferProtection: "oc.badge.selfTransferProtection",
  virtualInterline: "oc.badge.virtualInterline",
};

/**
 * Hvem som selger når bestillingen skjer utenfor HelloSky: leverandørens
 * navn, om det er flyselskapet selv, og leverandørens egne merkelapper. Alt
 * er lest fra svaret – vi hevder ikke mer enn leverandøren har sagt.
 */
function SellerLine({ offer }: { offer: Offer }) {
  const t = useT();
  const b = offer.booking;
  if (!b) return null;
  const badges = (b.badges ?? []).filter((code) => code !== "direct" && BADGE_KEYS[code]);
  if (b.sellerKind === "unknown" && badges.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
      {b.sellerKind === "airline" && <span className="rounded-lg bg-mint px-2.5 py-0.5 font-medium text-petrol">{t("oc.seller.airline")}</span>}
      {b.sellerKind === "agency" && <span className="rounded-lg bg-secondary px-2.5 py-0.5 font-medium text-foreground">{t("oc.seller.agency")}</span>}
      {badges.map((code) => (
        <span key={code} className="rounded-lg bg-secondary px-2.5 py-0.5 font-medium text-foreground">
          {t(BADGE_KEYS[code])}
        </span>
      ))}
    </div>
  );
}

/** «Se tilbud» when the provider is named beside the price; «Velg» for our own checkout. */
function ctaLabel(offer: Offer, t: ReturnType<typeof useT>): string {
  return offer.booking ? t("oc.view") : t("oc.select");
}

/**
 * Ett tilbud, ett kort (HelloSky 4.0).
 *
 * Flyselskapets eget merke og «Direkte» øverst, tidene store i midten med
 * varigheten over streken, bagasjen som to linjer, så prisen med «Hos
 * Norwegian» under og den blå «Se tilbud». Bare leverandørens egne tall og
 * merker; detaljer og vilkår ligger bak én lenke.
 */
export default function OfferCard({ offer, onSelect, selected, comparing, compareDisabled, onToggleCompare, shareText, recommended, saved, onToggleSave }: Props) {
  const t = useT();
  const feeConfig = useFeeConfig();
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const currency = offer.totalCurrency;
  const supplierMinor = toMinor(offer.totalAmount, currency);
  // Ekstern bestilling: leverandørens pris er prisen. Gebyret er HelloSkys og gjelder bare egne bestillinger.
  const external = offer.booking?.kind === "external";
  const totalMinor = external ? supplierMinor : previewTotalMinor(offer.totalAmount, currency, feeConfig);
  const paying = payingPassengers(offer.passengers);
  const party = partyLabel(offer.passengers, t);
  const flags = offerFlags(offer);
  const operatedBy = operatorsOf(offer);
  const recommendedLabel = recommended ? PREFERENCES.find((p) => p.key === recommended)?.label : undefined;
  const airline = { iata: offer.owner.iata, name: offer.owner.name, logoSymbolUrl: offer.owner.logoUrl };
  const seller = providerName(offer);
  const cta = ctaLabel(offer, t);
  const ctaProps = external ? ({ asChild: true } as const) : ({ onClick: () => onSelect(offer) } as const);
  const ctaInner = external ? (
    <a href={offer.booking!.url} target="_blank" rel="noopener noreferrer nofollow sponsored" title={t("oc.external.hint")} aria-label={t("oc.view.at", { name: seller })} onClick={() => onSelect(offer)}>
      <span className="truncate">{cta}</span> <ArrowUpRight className="size-5 shrink-0" aria-hidden="true" />
    </a>
  ) : (
    <>
      {cta} <ArrowRight className="size-5" aria-hidden="true" />
    </>
  );
  const priceLabel = offer.passengers.length > 1 ? t("oc.total.party", { party }) : t("oc.total.perperson");
  const perPerson = paying > 1 ? t("sr.perperson", { price: formatMinor(Math.round(totalMinor / paying / 100) * 100, currency) }) : null;
  const maxStops = Math.max(...offer.slices.map((s) => s.stops));

  return (
    <article
      className={cn("card-soft overflow-hidden transition-shadow duration-base", selected && "ring-2 ring-primary", recommended && "border-petrol/30")}
      aria-label={t("oc.aria", { airline: offer.owner.name, price: formatMinor(totalMinor, currency) })}
    >
      <div className="space-y-4 p-4 sm:p-5">
        {recommendedLabel && <p className="-mb-1 text-[13px] font-bold uppercase tracking-[0.08em] text-azure-ink">{t("oc.recommended")} · {t(recommendedLabel)}</p>}
        {/* Hvem flyr, og er det direkte */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <AirlineLogo airline={airline} size={32} className="rounded-lg" />
            <span className="min-w-0">
              <span className="block text-[17px] font-bold leading-tight">{offer.owner.name}</span>
              {operatedBy.length > 0 && <span className="block text-[13px] text-muted-foreground">{t("od.operatedby", { name: operatedBy.join(", ") })}</span>}
            </span>
          </div>
          <span className={cn("shrink-0 rounded-lg px-3 py-1.5 text-[14px] font-medium", maxStops === 0 ? "bg-mint text-petrol" : "bg-lavender text-petrol")}>
            {maxStops === 0 ? t("oc.direct") : t("oc.stops", { count: maxStops })}
          </span>
        </div>

        {offer.slices.map((slice, i) => (
          <div key={slice.id}>
            {offer.slices.length > 1 && <p className="mb-2 text-[13px] font-semibold text-muted-foreground">{sliceLabel(offer.slices.length, i)}</p>}
            <SliceViz slice={slice} />
          </div>
        ))}

        <BaggageLines offer={offer} />
        <OfferTags keys={flags} />
        <SellerLine offer={offer} />
      </div>

      {/* Pris og handling */}
      <div className="mx-4 border-t border-border sm:mx-5" aria-hidden="true" />
      <div className="flex items-end justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="t-num text-[30px] font-bold leading-none tracking-tight sm:text-[32px]">{formatMinor(totalMinor, currency)}</p>
          <p className="mt-1.5 truncate text-[15px] text-muted-foreground">{t("oc.at", { name: seller })}</p>
          <p className="sr-only">
            {priceLabel}
            {perPerson ? ` · ${perPerson}` : ""}
          </p>
        </div>
        <Button size="lg" {...ctaProps} className={cn("h-12 max-w-full shrink-0 rounded-xl px-5 text-[17px] font-bold sm:px-6", external && "[&>a]:flex [&>a]:min-w-0 [&>a]:items-center [&>a]:gap-2")}>
          {ctaInner}
        </Button>
      </div>

      <Collapsible.Root open={expanded} onOpenChange={setExpanded}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 pb-3 sm:px-5 sm:pb-4">
          <Collapsible.Trigger asChild>
            <button type="button" aria-controls={detailsId} className="inline-flex min-h-11 items-center gap-1 text-[15px] font-semibold text-azure-ink underline-offset-4 hover:underline">
              {expanded ? t("oc.hide") : t("oc.details")}
              <ChevronDown className={cn("size-4 transition-transform duration-base ease-out", expanded && "rotate-180")} aria-hidden="true" />
            </button>
          </Collapsible.Trigger>
          {onToggleSave && (
            <button
              type="button"
              onClick={() => onToggleSave(offer)}
              aria-pressed={saved}
              aria-label={saved ? t("oc.unsave.aria", { name: offer.owner.name }) : t("oc.save.aria", { name: offer.owner.name })}
              className={cn("inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold underline-offset-4 hover:underline", saved ? "text-petrol" : "text-foreground")}
            >
              <Icon icon={Bookmark} size={16} className={saved ? "fill-current" : undefined} /> {saved ? t("oc.saved") : t("oc.save")}
            </button>
          )}
          {onToggleCompare && (
            <button
              type="button"
              onClick={() => onToggleCompare(offer)}
              disabled={!comparing && compareDisabled}
              aria-pressed={comparing}
              className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-foreground underline-offset-4 hover:underline disabled:opacity-40"
            >
              <Icon icon={ArrowLeftRight} size={16} /> {comparing ? t("oc.selected") : t("oc.compare")}
            </button>
          )}
          {shareText && (
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-foreground underline-offset-4 hover:underline">
              <Icon icon={Share2} size={16} /> {t("oc.share.short")}
            </a>
          )}
          {recommended && flags.all.length > 0 && (
            <ul className="ml-auto hidden flex-wrap gap-x-3 text-[13px] text-muted-foreground sm:flex">
              {flags.all.slice(0, 2).map((k) => (
                <li key={k} className="flex items-center gap-1"><Check className="size-3.5 text-success" aria-hidden="true" /> {t(k)}</li>
              ))}
            </ul>
          )}
        </div>
        <Collapsible.Content id={detailsId} className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          <OfferDetails offer={offer} supplierMinor={supplierMinor} currency={currency} />
        </Collapsible.Content>
      </Collapsible.Root>
    </article>
  );
}
