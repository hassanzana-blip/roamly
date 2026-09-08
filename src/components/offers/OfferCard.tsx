import { useId, useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ArrowLeftRight, Briefcase, Check, ChevronDown, Leaf, Luggage, Moon, Share2 } from "lucide-react";
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

export function SliceViz({ slice, tone = "light" }: { slice: OfferSlice; tone?: "light" | "dark" }) {
  const t = useT();
  const dayShift = crossesMidnight(slice.departingAt, slice.arrivingAt);
  const dark = tone === "dark";
  const muted = dark ? "text-white/65" : "text-muted-foreground";
  return (
    <div className="flex items-center gap-3">
      <div className="w-14 shrink-0 text-right sm:w-16">
        <p className="t-num text-xl font-semibold leading-none sm:text-[22px]">{formatClock(slice.departingAt)}</p>
        <p className={cn("t-code mt-1", muted)}>{slice.origin.iata}</p>
      </div>
      <div className="relative min-w-0 flex-1 px-1">
        <div className="flex items-center">
          <span className={cn("size-1.5 rounded-full", dark ? "bg-white/70" : "bg-foreground/70")} />
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
          <span className="size-1.5 rounded-full bg-primary" />
        </div>
        <p className={cn("mt-1.5 truncate text-center text-xs", muted)}>
          {formatDuration(slice.durationMinutes)}
          {" · "}
          {slice.stops === 0 ? (
            <span className={cn("font-medium", dark ? "text-lime-dark" : "text-success")}>{t("oc.direct")}</span>
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
            <sup className={cn("ml-0.5 text-[10px] font-semibold", muted)} aria-label={dayShift === 1 ? t("oc.arrival.next") : t("oc.arrival.days", { count: dayShift })}>
              +{dayShift}
            </sup>
          )}
        </p>
        <p className={cn("t-code mt-1", muted)}>{slice.destination.iata}</p>
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
function BaggageLine({ offer, tone = "light" }: { offer: Offer; tone?: "light" | "dark" }) {
  const t = useT();
  const { carryOn, checked, carryOnUnknown, checkedUnknown } = useTripBaggage(offer);
  const dark = tone === "dark";
  const muted = dark ? "text-white/65" : "text-muted-foreground";
  // På mørk flate må glyfen lyse; ellers arver den forgrunnsfargen som vanlig.
  const glyph = dark ? "text-white" : undefined;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
      <span className="flex items-center gap-1.5">
        <BaggageVisual kind="cabin" count={carryOn} unknown={carryOnUnknown} size={20} className={glyph} label={carryOnUnknown ? t("bg.carryon.unknown") : t("bg.carryon", { count: carryOn })} />
        <span aria-hidden="true">{carryOnUnknown ? t("oc.carryon.unknown") : t("oc.carryon.included", { count: carryOn })}</span>
      </span>
      <span className={cn("flex items-center gap-1.5", checkedUnknown || checked === 0 ? muted : undefined)}>
        <BaggageVisual kind="checked" count={checked} unknown={checkedUnknown} size={20} className={checkedUnknown || checked === 0 ? undefined : glyph} label={checkedUnknown ? t("bg.checked.unknown") : checked === 0 ? t("bg.checked.none") : t("bg.checked", { count: checked })} />
        <span aria-hidden="true">{checkedUnknown ? t("oc.checked.unknown") : checked === 0 ? t("oc.checked.addable") : t("oc.checked.included", { count: checked })}</span>
      </span>
    </div>
  );
}

/** Alt som er verdt en advarsel eller et løfte, som merkelapper. */
function OfferTags({ keys, tone = "light" }: { keys: ReturnType<typeof offerFlags>; tone?: "light" | "dark" }) {
  const t = useT();
  const base = tone === "dark" ? "bg-white/15 text-white" : "bg-muted text-foreground";
  const warn = tone === "dark" ? "bg-amber-300/20 text-amber-100" : "bg-warning/10 text-warning";
  const { family, flexible, airportChange, nextDay, hasOvernight, hasLong } = keys;
  if (!(family || flexible || airportChange || nextDay || hasOvernight || hasLong)) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t("oc.details")}>
      {family && (
        <li className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", base)}>
          <FamilyGlyph size={14} /> {t("oc.tag.family")}
        </li>
      )}
      {flexible && <li className={cn("rounded-md px-2 py-0.5 text-xs font-medium", base)}>{t(flexible)}</li>}
      {nextDay && (
        <li className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", base)}>
          <Moon className="size-3" aria-hidden="true" /> {t("oc.arrivalnextday")}
        </li>
      )}
      {airportChange && <li className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", warn)}>{t("oc.tag.airportchange")}</li>}
      {hasOvernight && <li className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", warn)}>{t("oc.overnight")}</li>}
      {!hasOvernight && hasLong && <li className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", warn)}>{t("oc.longlayover")}</li>}
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
          <li className="flex items-center gap-2 text-muted-foreground">
            <Leaf className="size-3.5" aria-hidden="true" /> {offer.emissionsKg} kg CO₂
          </li>
          <li className="text-muted-foreground">{t("oc.conditions.note")}</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Ett tilbud, i to former.
 *
 * «Vårt valg» er en scene: mørk flate, begrunnelsen først, prisen stor. Den
 * skal kunne leses på to sekunder og være tydelig forskjellig fra resten.
 * De øvrige er rolige rader: flyselskap og pris på én linje, rutene under,
 * bagasje og valg nederst. Detaljene ligger bak én knapp, ikke i et eget
 * bånd på hvert kort – femten like rektangler er ikke en liste, det er støy.
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
  const party = useParty(offer.passengers);
  const flags = offerFlags(offer);
  const operatedBy = operatorsOf(offer);
  const recommendedLabel = recommended ? PREFERENCES.find((p) => p.key === recommended)?.label : undefined;
  // Hvorfor akkurat denne: de sterkeste faktaene, aldri en poengsum.
  const reasons = recommended ? flags.all.slice(0, 3).map((k) => t(k)) : [];
  const airline = { iata: offer.owner.iata, name: offer.owner.name };
  const priceLabel = offer.passengers.length > 1 ? t("oc.totalfor.party", { party }) : t("oc.forpax", { count: 1 });
  const perPerson = paying > 1 ? t("sr.perperson", { price: formatMinor(Math.round(totalMinor / paying / 100) * 100, currency) }) : null;

  const secondary = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {onToggleCompare && (
        <button
          type="button"
          onClick={() => onToggleCompare(offer)}
          disabled={!comparing && compareDisabled}
          aria-pressed={comparing}
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline disabled:opacity-40"
        >
          <Icon icon={ArrowLeftRight} size={16} /> {comparing ? t("oc.selected") : t("oc.compare")}
        </button>
      )}
      {shareText && (
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
        >
          <Icon icon={Share2} size={16} /> {t("oc.share")}
        </a>
      )}
    </div>
  );

  /* ── «Vårt valg»: scenen ──────────────────────────────────────────── */
  if (recommendedLabel) {
    return (
      <article
        className="overflow-hidden rounded-2xl bg-night text-white"
        aria-label={t("oc.aria", { airline: offer.owner.name, price: formatMinor(totalMinor, currency) })}
      >
        <div className="px-4 pb-5 pt-4 sm:px-6 sm:pt-5">
          <p className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-[12px] font-bold text-primary-foreground">
            {t("oc.ourpick")} · {t(recommendedLabel)}
          </p>

          {/* Begrunnelsen står først, som verifiserte fakta – ikke en påstand. */}
          {reasons.length > 0 && (
            <ul className="mt-3.5 flex flex-wrap gap-x-5 gap-y-1.5 text-[15px] font-semibold">
              {reasons.map((r) => (
                <li key={r} className="flex items-center gap-1.5">
                  <Check className="size-4 shrink-0 text-lime-dark" aria-hidden="true" /> {r}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div className="flex min-w-0 items-center gap-2.5">
              {/* Flyselskapets merke står på hvit plate, slik selskapene selv
                  krever det på mørk bakgrunn – og slik monogrammet forblir lesbart. */}
              <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white p-1">
                <AirlineLogo airline={airline} size={22} className="bg-transparent" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold">{offer.owner.name}</span>
                {operatedBy.length > 0 && <span className="block text-xs text-white/60">{t("od.operatedby", { name: operatedBy.join(", ") })}</span>}
              </span>
            </div>
            <div className="text-right">
              <p className="t-price leading-none text-white">{formatMinor(totalMinor, currency)}</p>
              <p className="mt-1.5 text-[13px] font-medium text-white/75">{priceLabel}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 bg-white/[0.06] px-4 py-5 sm:px-6">
          {offer.slices.map((slice, i) => (
            <div key={slice.id}>
              {offer.slices.length > 1 && <p className="mb-1.5 text-xs font-semibold text-white/60">{sliceLabel(offer.slices.length, i)}</p>}
              <SliceViz slice={slice} tone="dark" />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
            <BaggageLine offer={offer} tone="dark" />
            <OfferTags keys={flags} tone="dark" />
          </div>
        </div>

        <Collapsible.Root open={expanded} onOpenChange={setExpanded}>
          <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-center gap-4 text-white/80">
              <Collapsible.Trigger asChild>
                <button type="button" aria-controls={detailsId} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 text-sm font-medium text-white underline-offset-4 hover:underline">
                  {expanded ? t("oc.hide") : t("oc.show")}
                  <ChevronDown className={cn("size-4 transition-transform duration-base ease-out", expanded && "rotate-180")} aria-hidden="true" />
                </button>
              </Collapsible.Trigger>
              {perPerson && <span className="t-num truncate text-xs text-white/60">{perPerson}</span>}
            </div>
            <Button size="lg" onClick={() => onSelect(offer)} className="w-full sm:w-auto sm:px-8">
              {t("oc.select")}
            </Button>
          </div>
          <Collapsible.Content id={detailsId} className="overflow-hidden bg-background text-foreground data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
            <OfferDetails offer={offer} supplierMinor={supplierMinor} currency={currency} />
            <div className="border-t border-border px-4 py-3 sm:px-5">{secondary}</div>
          </Collapsible.Content>
        </Collapsible.Root>
      </article>
    );
  }

  /* ── De øvrige: rolige rader ──────────────────────────────────────── */
  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border bg-card transition-[border-color] duration-base ease-out",
        selected ? "border-primary" : "border-border hover:border-foreground/40",
      )}
      aria-label={t("oc.aria", { airline: offer.owner.name, price: formatMinor(totalMinor, currency) })}
    >
      <div className="space-y-3.5 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <AirlineLogo airline={airline} size={28} />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{offer.owner.name}</span>
              {operatedBy.length > 0 && <span className="block truncate text-xs text-muted-foreground">{t("od.operatedby", { name: operatedBy.join(", ") })}</span>}
            </span>
          </div>
          <div className="shrink-0 text-right">
            <p className="t-num text-[22px] font-bold leading-none tracking-tight sm:text-[26px]">{formatMinor(totalMinor, currency)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{priceLabel}</p>
          </div>
        </div>

        {offer.slices.map((slice, i) => (
          <div key={slice.id}>
            {offer.slices.length > 1 && <p className="mb-1 text-xs font-semibold text-muted-foreground">{sliceLabel(offer.slices.length, i)}</p>}
            <SliceViz slice={slice} />
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <BaggageLine offer={offer} />
          <OfferTags keys={flags} />
        </div>
      </div>

      <Collapsible.Root open={expanded} onOpenChange={setExpanded}>
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-4">
            <Collapsible.Trigger asChild>
              <button type="button" aria-controls={detailsId} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline">
                {expanded ? t("oc.hide") : t("oc.show")}
                <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-base ease-out", expanded && "rotate-180")} aria-hidden="true" />
              </button>
            </Collapsible.Trigger>
            {perPerson && <span className="t-num hidden truncate text-xs text-muted-foreground sm:inline">{perPerson}</span>}
          </div>
          <Button size="md" onClick={() => onSelect(offer)} className="shrink-0 px-6">
            {t("oc.select")}
          </Button>
        </div>
        <Collapsible.Content id={detailsId} className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          <OfferDetails offer={offer} supplierMinor={supplierMinor} currency={currency} />
          <div className="border-t border-border px-4 py-3 sm:px-5">{secondary}</div>
        </Collapsible.Content>
      </Collapsible.Root>
    </article>
  );
}
