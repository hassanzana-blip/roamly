import { useId, useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ArrowLeftRight, ArrowRight, Briefcase, Check, ChevronDown, Leaf, Luggage, Moon, Plane, Share2 } from "lucide-react";
import type { Offer, OfferPassenger, OfferSlice, Segment } from "@contracts/types";
import { cabinLabel, crossesMidnight, fareConditionLabel, formatClock, formatDuration, formatMinor, layoverInfo, previewTotalMinor, toMinor } from "@/lib/format";
import Icon from "@/components/app/Icon";
import { Button } from "@/components/ui/button";
import { useFeeConfig } from "@/lib/useFeeConfig";
import { useT, type I18nKey } from "@/lib/i18n";
import { PREFERENCES, hasAirportChange, highlights, payingPassengers, type Preference } from "@/lib/offers";
import { cn } from "@/lib/utils";
import { sliceBaggage, sliceLabel } from "./offerUtils";
import { AirportChangeDiagram, BaggageVisual, FamilyGlyph, RouteDiagram, AMENITY_ICONS } from "@/components/graphics";
import AirlineLogo from "@/components/brand/AirlineLogo";

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

/**
 * One leg as a line: big departure and arrival times, the airports under
 * them, the little plane on the seam and the duration under it.
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
        <p className={cn("t-num font-medium leading-none tracking-tight", big ? "text-[34px] sm:text-[40px]" : "text-[24px] sm:text-[28px]")}>{formatClock(slice.departingAt)}</p>
        <p className={cn("mt-1 text-[14px] font-medium", muted)}>{slice.origin.iata}</p>
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("relative h-px flex-1", dark ? "bg-white/25" : "bg-border")}>
            {Array.from({ length: slice.stops }).map((_, i) => (
              <span
                key={i}
                className={cn("absolute top-1/2 size-2 -translate-y-1/2 rounded-full border-2", dark ? "border-white/70 bg-night" : "border-muted-foreground bg-card")}
                style={{ left: `${((i + 1) / (slice.stops + 1)) * 100}%` }}
                title={slice.segments[i]?.destination.city}
              />
            ))}
          </span>
          <Plane className={cn("size-5 shrink-0", dark ? "text-white/80" : "text-foreground/70")} aria-hidden="true" />
          <span className={cn("h-px flex-1", dark ? "bg-white/25" : "bg-border")} />
        </div>
        <p className={cn("mt-2 truncate text-center text-[14px] sm:text-[15px]", muted)}>
          {formatDuration(slice.durationMinutes)}
          {slice.stops > 0 && (
            <>
              {" · "}
              {t("oc.stops", { count: slice.stops })} {slice.segments.slice(0, -1).map((s) => s.destination.iata).join(", ")}
            </>
          )}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("t-num font-medium leading-none tracking-tight", big ? "text-[34px] sm:text-[40px]" : "text-[24px] sm:text-[28px]")}>
          {formatClock(slice.arrivingAt)}
          {dayShift > 0 && (
            <sup className={cn("ml-0.5 text-[12px] font-medium", muted)} aria-label={dayShift === 1 ? t("oc.arrival.next") : t("oc.arrival.days", { count: dayShift })}>
              +{dayShift}
            </sup>
          )}
        </p>
        <p className={cn("mt-1 text-[14px] font-medium", muted)}>{slice.destination.iata}</p>
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
}

/** Bagasjeløftet for hele reisen: den svakeste strekningen bestemmer. */
function useTripBaggage(offer: Offer) {
  const bags = offer.slices.map((s) => sliceBaggage(s, offer.baggage));
  return {
    carryOn: Math.min(...bags.map((b) => b.carryOnBags)),
    checked: Math.min(...bags.map((b) => b.checkedBags)),
    carryOnUnknown: bags.some((b) => b.carryOnUnknown),
    checkedUnknown: bags.some((b) => b.checkedUnknown),
  };
}

/** Bagasje som to glyfer på én linje – samme svar, en brøkdel av plassen. */
function BaggageLine({ offer }: { offer: Offer }) {
  const t = useT();
  const { carryOn, checked, carryOnUnknown, checkedUnknown } = useTripBaggage(offer);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[14px]">
      <span className="flex items-center gap-2">
        <BaggageVisual kind="cabin" count={carryOn} unknown={carryOnUnknown} size={20} label={carryOnUnknown ? t("bg.carryon.unknown") : t("bg.carryon", { count: carryOn })} />
        <span aria-hidden="true">{carryOnUnknown ? t("oc.carryon.unknown") : t("oc.carryon.included", { count: carryOn })}</span>
      </span>
      <span className={cn("flex items-center gap-2", (checkedUnknown || checked === 0) && "text-muted-foreground")}>
        <BaggageVisual kind="checked" count={checked} unknown={checkedUnknown} size={20} label={checkedUnknown ? t("bg.checked.unknown") : checked === 0 ? t("bg.checked.none") : t("bg.checked", { count: checked })} />
        <span aria-hidden="true">{checkedUnknown ? t("oc.checked.unknown") : checked === 0 ? t("oc.checked.addable") : t("oc.checked.included", { count: checked })}</span>
      </span>
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
        <li className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium", base)}>
          <FamilyGlyph size={14} /> {t("oc.tag.family")}
        </li>
      )}
      {flexible && <li className={cn("rounded-full px-2.5 py-1 text-[13px] font-medium", base)}>{t(flexible)}</li>}
      {nextDay && (
        <li className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium", base)}>
          <Moon className="size-3" aria-hidden="true" /> {t("oc.arrivalnextday")}
        </li>
      )}
      {airportChange && <li className={cn("rounded-full px-2.5 py-1 text-[13px] font-semibold", warn)}>{t("oc.tag.airportchange")}</li>}
      {hasOvernight && <li className={cn("rounded-full px-2.5 py-1 text-[13px] font-semibold", warn)}>{t("oc.overnight")}</li>}
      {!hasOvernight && hasLong && <li className={cn("rounded-full px-2.5 py-1 text-[13px] font-semibold", warn)}>{t("oc.longlayover")}</li>}
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
    <div className="space-y-6 border-t border-border bg-secondary/50 px-5 py-5 sm:px-6">
      {offer.slices.map((slice, i) => (
        <SliceDetails key={slice.id} slice={slice} label={sliceLabel(offer.slices.length, i)} fallbackBaggage={offer.baggage} />
      ))}
      <div className="rounded-2xl bg-card p-4 text-xs">
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
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
      <span>{t("oc.seller.via", { name: b.provider.name })}</span>
      {b.sellerKind === "airline" && <span className="rounded-full bg-blush px-2.5 py-0.5 font-medium text-accent-foreground">{t("oc.seller.airline")}</span>}
      {b.sellerKind === "agency" && <span className="rounded-full bg-secondary px-2.5 py-0.5 font-medium text-foreground">{t("oc.seller.agency")}</span>}
      {badges.map((code) => (
        <span key={code} className="rounded-full bg-secondary px-2.5 py-0.5 font-medium text-foreground">
          {t(BADGE_KEYS[code])}
        </span>
      ))}
    </div>
  );
}

/** «Bestill hos Norwegian» / «Se tilbud hos Kiwi.com» / «Velg» – sier hvor kunden faktisk skal. */
function ctaLabel(offer: Offer, t: ReturnType<typeof useT>): string {
  const b = offer.booking;
  if (!b) return t("oc.select");
  const name = b.provider.name.trim();
  if (!name) return t("oc.view");
  return b.sellerKind === "airline" ? t("oc.book.at", { name }) : t("oc.view.at", { name });
}

/**
 * Ett tilbud, ett kort (HelloSky 3.0).
 *
 * Flyselskapets eget merke og «Direkte» øverst, tidene store i midten,
 * bagasjen som en rolig linje, så prisen og handlingen. Det anbefalte
 * tilbudet får korall-knapp og begrunnelsen som fakta; resten får den myke
 * blush-knappen. Detaljer og vilkår ligger bak én lenke, ikke i et eget bånd.
 */
export default function OfferCard({ offer, onSelect, selected, comparing, compareDisabled, onToggleCompare, shareText, recommended }: Props) {
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
  const party = useParty(offer.passengers);
  const flags = offerFlags(offer);
  const operatedBy = operatorsOf(offer);
  const recommendedLabel = recommended ? PREFERENCES.find((p) => p.key === recommended)?.label : undefined;
  // Hvorfor akkurat denne: de sterkeste faktaene, aldri en poengsum.
  const reasons = recommended ? flags.all.slice(0, 3).map((k) => t(k)) : [];
  const airline = { iata: offer.owner.iata, name: offer.owner.name, logoSymbolUrl: offer.owner.logoUrl };
  const cta = ctaLabel(offer, t);
  const ctaProps = external ? ({ asChild: true } as const) : ({ onClick: () => onSelect(offer) } as const);
  const ctaInner = external ? (
    <a href={offer.booking!.url} target="_blank" rel="noopener noreferrer nofollow sponsored" title={t("oc.external.hint")} onClick={() => onSelect(offer)}>
      <span className="truncate">{cta}</span> <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
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
      className={cn("card-soft overflow-hidden transition-shadow duration-base", selected && "ring-2 ring-primary", recommended && "shadow-lift")}
      aria-label={t("oc.aria", { airline: offer.owner.name, price: formatMinor(totalMinor, currency) })}
    >
      <div className="space-y-3.5 p-4 sm:space-y-4 sm:p-6">
        {recommendedLabel && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-[13px] font-semibold text-primary-foreground">
              {t("oc.recommended")} · {t(recommendedLabel)}
            </p>
            {offer.source === "kayak" && offer.booking && <span className="rounded-full bg-warning/10 px-2.5 py-1 text-[12px] font-semibold text-warning">{t("sr.sandbox.badge")}</span>}
            {reasons.length > 0 && (
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[14px] font-medium">
                {reasons.map((r) => (
                  <li key={r} className="flex items-center gap-1">
                    <Check className="size-4 shrink-0 text-success" aria-hidden="true" /> {r}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Hvem flyr, og er det direkte */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <AirlineLogo airline={airline} size={32} className="rounded-lg" />
            <span className="min-w-0">
              <span className="block truncate text-[17px] font-medium">{offer.owner.name}</span>
              {operatedBy.length > 0 && <span className="block truncate text-[13px] text-muted-foreground">{t("od.operatedby", { name: operatedBy.join(", ") })}</span>}
            </span>
          </div>
          <span className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-[14px] font-medium", maxStops === 0 ? "bg-blush text-foreground" : "bg-secondary text-foreground")}>
            {maxStops === 0 ? t("oc.direct") : t("oc.stops", { count: maxStops })}
          </span>
        </div>

        {offer.slices.map((slice, i) => (
          <div key={slice.id}>
            {offer.slices.length > 1 && <p className="mb-2 text-[13px] font-medium text-muted-foreground">{sliceLabel(offer.slices.length, i)}</p>}
            <SliceViz slice={slice} />
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
          <BaggageLine offer={offer} />
          <OfferTags keys={flags} />
        </div>
        <SellerLine offer={offer} />
      </div>

      {/* Pris og handling */}
      <div className="mx-4 border-t border-border sm:mx-6" aria-hidden="true" />
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 p-4 sm:p-6">
        <div className="min-w-0">
          <p className="t-num text-[28px] font-medium leading-none tracking-tight sm:text-[34px]">{formatMinor(totalMinor, currency)}</p>
          <p className="mt-1 text-[13px] text-muted-foreground sm:text-[14px]">
            {priceLabel}
            {perPerson ? ` · ${perPerson}` : ""}
          </p>
        </div>
        <Button size="lg" variant={recommended ? "primary" : "subtle"} {...ctaProps} className={cn("h-12 max-w-full rounded-full px-5 text-[15px] sm:h-13 sm:px-7 sm:text-[16px]", external && "[&>a]:flex [&>a]:min-w-0 [&>a]:items-center [&>a]:gap-2")}>
          {ctaInner}
        </Button>
      </div>

      <Collapsible.Root open={expanded} onOpenChange={setExpanded}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 pb-3 sm:px-6 sm:pb-4">
          <Collapsible.Trigger asChild>
            <button type="button" aria-controls={detailsId} className="inline-flex min-h-10 items-center gap-1 text-[14px] font-medium text-accent-foreground underline-offset-4 hover:underline">
              {expanded ? t("oc.hide") : t("oc.details")}
              <ChevronDown className={cn("size-4 transition-transform duration-base ease-out", expanded && "rotate-180")} aria-hidden="true" />
            </button>
          </Collapsible.Trigger>
          {onToggleCompare && (
            <button
              type="button"
              onClick={() => onToggleCompare(offer)}
              disabled={!comparing && compareDisabled}
              aria-pressed={comparing}
              className="inline-flex min-h-10 items-center gap-1.5 text-[14px] font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-40"
            >
              <Icon icon={ArrowLeftRight} size={16} /> {comparing ? t("oc.selected") : t("oc.compare")}
            </button>
          )}
          {shareText && (
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 text-[14px] font-medium text-foreground underline-offset-4 hover:underline">
              <Icon icon={Share2} size={16} /> {t("oc.share")}
            </a>
          )}
        </div>
        <Collapsible.Content id={detailsId} className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          <OfferDetails offer={offer} supplierMinor={supplierMinor} currency={currency} />
        </Collapsible.Content>
      </Collapsible.Root>
    </article>
  );
}
