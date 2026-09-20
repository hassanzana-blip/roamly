import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeftRight, ArrowUpRight, Bookmark, Luggage, PlaneTakeoff, Share2, TriangleAlert } from "lucide-react";
import type { Offer, Segment } from "@contracts/types";
import AirlineLogo from "@/components/brand/AirlineLogo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMinWidth } from "@/hooks/use-min-width";
import { cabinLabel, crossesMidnight, fareConditionLabel, formatClock, formatDateLong, formatDuration, formatMinor, formatSupplierMoney, layoverInfo } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { baggageStatus, tripBaggage } from "./offerFacts";
import { partyLabel, providerName, sliceLabel } from "./offerUtils";

/**
 * Reisedetaljer.
 *
 * Alt en reisende trenger for å ta valget, på ett sted og i full lengde:
 * hvert flyvende ledd, hvem som faktisk flyr det, hvor lenge man venter og
 * hvor, om man må bytte flyplass eller hente bagasjen selv, hva bagasjen
 * faktisk er, og hva prisen omfatter.
 *
 * Bunnen holder prisen og veien videre synlig hele tiden, slik at man aldri
 * må lete seg tilbake for å kunne bestille. På telefon er det et ark fra
 * bunnen, på skrivebordet en dialog – samme innhold, samme rekkefølge.
 */

/** Ett flyvende ledd. */
function SegmentBlock({ seg, showDuration }: { seg: Segment; showDuration: boolean }) {
  const t = useT();
  const operatedBy = seg.operatingCarrier && seg.operatingCarrier.iata !== seg.carrier.iata ? seg.operatingCarrier : null;
  // Lander man dagen etter, må det stå ved klokkeslettet – ikke bare på kortet.
  const shift = crossesMidnight(seg.departingAt, seg.arrivingAt);
  return (
    <div className="flex gap-3.5">
      <AirlineLogo airline={{ iata: seg.carrier.iata, name: seg.carrier.name, logoSymbolUrl: seg.carrier.logoUrl }} size={28} className="mt-0.5 rounded-md" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-[13px] text-muted-foreground">
          <span className="font-semibold text-foreground">{seg.carrier.name}</span>
          <span className="t-code">
            {seg.carrier.iata} {seg.flightNumber}
          </span>
          <span>
            {seg.aircraft} · {cabinLabel(seg.cabinClass)}
          </span>
        </p>
        {operatedBy && <p className="mt-0.5 text-[13px] text-muted-foreground">{t("od.operatedby", { name: operatedBy.name })}</p>}

        {/* Fra og til, med hele flyplassnavnet – koden alene er ikke nok når man skal finne fram. */}
        <div className="mt-2 flex gap-3">
          <div className="flex flex-col items-center pt-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full border-2 border-foreground" />
            <span className="my-0.5 w-px flex-1 bg-border" />
            <span className="size-2.5 rounded-full border-2 border-primary bg-primary" />
          </div>
          <div className="min-w-0 flex-1 space-y-2.5">
            <p className="flex gap-2.5 text-[15px] leading-tight">
              <span className="t-num w-[46px] shrink-0 font-bold">{formatClock(seg.departingAt)}</span>
              <span className="min-w-0">
                {seg.origin.city} <span className="text-muted-foreground">({seg.origin.iata})</span>
                {seg.origin.terminal ? <span className="text-muted-foreground"> · {t("fd.terminal", { id: seg.origin.terminal })}</span> : null}
              </span>
            </p>
            <p className="flex gap-2.5 text-[15px] leading-tight">
              <span className="t-num w-[46px] shrink-0 font-bold">
                {formatClock(seg.arrivingAt)}
                {shift > 0 && (
                  <sup className="ml-0.5 text-[10px] font-semibold text-azure-ink" aria-label={shift === 1 ? t("oc.arrival.next") : t("oc.arrival.days", { count: shift })}>
                    +{shift}
                  </sup>
                )}
              </span>
              <span className="min-w-0">
                {seg.destination.city} <span className="text-muted-foreground">({seg.destination.iata})</span>
                {seg.destination.terminal ? <span className="text-muted-foreground"> · {t("fd.terminal", { id: seg.destination.terminal })}</span> : null}
              </span>
            </p>
          </div>
        </div>
        {showDuration && <p className="mt-2 text-[13px] text-muted-foreground">{formatDuration(seg.durationMinutes)}</p>}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-[14px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

function Details({ offer, totalMinor }: { offer: Offer; totalMinor: number }) {
  const t = useT();
  const currency = offer.totalCurrency;
  const bags = tripBaggage(offer);
  const bag = baggageStatus(offer);
  const refundLabel = fareConditionLabel("refund", offer.conditions?.refundBeforeDeparture, offer.refundable);
  const changeLabel = fareConditionLabel("change", offer.conditions?.changeBeforeDeparture, offer.changeable);
  const selfTransfer = offer.booking?.badges?.includes("virtualInterline");
  const carryOnFee = formatSupplierMoney(offer.baggageFees?.carryOn);
  const checkedFee = formatSupplierMoney(offer.baggageFees?.checked);
  /** «1 kolli» sier noe. «Håndbagasje 1» ved siden av etiketten «Håndbagasje» sier det samme to ganger. */
  const bagCount = (unknown: boolean, n: number) => (unknown ? t("fd.notgiven") : n > 0 ? t("fd.bags.count", { count: n }) : t("fd.bag.notincluded"));

  return (
    <div className="space-y-6 pb-2">
      {offer.slices.map((slice, si) => {
        const changes = slice.segments.slice(0, -1).filter((seg, i) => seg.destination.iata !== slice.segments[i + 1].origin.iata);
        return (
          <section key={slice.id} aria-labelledby={`leg-${slice.id}`}>
            <h3 id={`leg-${slice.id}`} className="text-[17px] font-bold">
              {sliceLabel(offer.slices.length, si)} <span className="font-medium text-muted-foreground">· {formatDateLong(slice.departingAt)}</span>
            </h3>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {slice.stops === 0 ? t("oc.direct") : t("oc.stops", { count: slice.stops })} · {formatDuration(slice.durationMinutes)}
            </p>

            <div className="mt-3 space-y-3">
              {slice.segments.map((seg, i) => {
                const next = slice.segments[i + 1];
                const lay = next ? layoverInfo(seg.arrivingAt, next.departingAt, seg.destination.timeZone) : null;
                const airportChange = next ? seg.destination.iata !== next.origin.iata : false;
                return (
                  <div key={seg.id} className="space-y-3">
                    <SegmentBlock seg={seg} showDuration={slice.segments.length > 1} />
                    {lay && next && (
                      <div
                        className={cn(
                          "rounded-xl px-3.5 py-2.5 text-[13.5px] leading-snug",
                          airportChange || lay.overnight || lay.long ? "bg-warning/10 text-warning" : "bg-secondary text-muted-foreground",
                        )}
                      >
                        <p className="font-semibold">
                          {t("fd.layover", { duration: formatDuration(lay.minutes), city: seg.destination.city, iata: seg.destination.iata })}
                          {lay.overnight ? ` · ${t("oc.overnight")}` : lay.long ? ` · ${t("oc.longlayover")}` : ""}
                        </p>
                        {airportChange && (
                          <p className="mt-1 flex items-start gap-1.5">
                            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            {t("fd.airportchange", { from: seg.destination.name, to: next.origin.name })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {changes.length > 0 && <p className="sr-only">{t("oc.tag.airportchange")}</p>}
          </section>
        );
      })}

      {selfTransfer && (
        <section className="flex items-start gap-3 rounded-xl bg-warning/10 px-3.5 py-3 text-[13.5px] leading-snug text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">{t("oc.warn.selftransfer")}.</span> {t("fd.selftransfer.body")}
          </p>
        </section>
      )}

      {/* Bagasje: tallene leverandøren faktisk oppga, og gebyret når det er kjent. */}
      <section aria-labelledby="det-bag">
        <h3 id="det-bag" className="flex items-center gap-2 text-[17px] font-bold">
          <Luggage className="size-[18px]" aria-hidden="true" /> {t("fd.baggage")}
        </h3>
        <dl className="mt-1 divide-y divide-border">
          <Row label={t("fd.bag.carryon")} value={bagCount(bags.carryOnUnknown, bags.carryOn)} />
          <Row label={t("fd.bag.checked")} value={bagCount(bags.checkedUnknown, bags.checked)} />
          {carryOnFee && <Row label={t("fd.bag.carryonfee")} value={carryOnFee} />}
          {checkedFee && <Row label={t("fd.bag.checkedfee")} value={checkedFee} />}
        </dl>
        {bag.tone === "unknown" && <p className="mt-2 text-[13px] text-muted-foreground">{t("fd.bag.unknownnote")}</p>}
      </section>

      {/* Vilkår og pris: hva som gjelder hvis planen endrer seg, og hva tallet er. */}
      <section aria-labelledby="det-terms">
        <h3 id="det-terms" className="flex items-center gap-2 text-[17px] font-bold">
          <PlaneTakeoff className="size-[18px]" aria-hidden="true" /> {t("fd.terms")}
        </h3>
        <dl className="mt-1 divide-y divide-border">
          <Row label={t("fd.refund")} value={refundLabel} />
          <Row label={t("fd.change")} value={changeLabel} />
          <Row label={t("fd.cabin")} value={cabinLabel(offer.cabinClass)} />
          <Row label={t("fd.travellers")} value={partyLabel(offer.passengers, t)} />
          <Row label={t("fd.seller")} value={providerName(offer)} />
          <Row label={t("fd.pricebasis")} value={offer.booking ? t("fd.pricebasis.external") : t("fd.pricebasis.own", { price: formatMinor(totalMinor, currency) })} />
          {typeof offer.emissionsKg === "number" && <Row label={t("fd.emissions")} value={`${offer.emissionsKg} kg CO₂`} />}
        </dl>
        {offer.booking?.disclosure && <p className="mt-2 text-[13px] text-muted-foreground">{offer.booking.disclosure}</p>}
        <p className="mt-2 text-[13px] text-muted-foreground">{offer.booking ? t("oc.price.external.note") : t("oc.conditions.note")}</p>
      </section>
    </div>
  );
}

/**
 * Fokus skal hjem igjen.
 *
 * Arket åpnes fra en knapp langt nede i en lang liste. Lukker man det uten
 * mus, må fokus tilbake til nettopp den knappen – ellers står man plutselig
 * øverst på siden og må tabbe seg ned gjennom alle tilbudene på nytt. Radix
 * kan ikke gjøre det for oss her, fordi arket ikke er montert under knappen,
 * så vi husker den selv.
 */
function useFocusReturn(open: boolean) {
  const returnTo = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      const el = returnTo.current;
      if (el && document.contains(el)) requestAnimationFrame(() => el.focus());
    };
  }, [open]);
}

/** Nettleserens tilbakeknapp lukker arket i stedet for å forlate resultatene. */
function useBackCloses(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    window.history.pushState({ hsOfferSheet: true }, "");
    const onPop = () => onClose();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Lukket med kryss eller Escape: fjern vår egen historikkoppføring igjen.
      // Er den allerede borte (tilbakeknappen, eller en navigasjon), gjør vi ingenting.
      if (window.history.state?.hsOfferSheet) window.history.back();
    };
  }, [open, onClose]);
}

export type OfferActions = {
  saved?: boolean;
  onToggleSave?: (offer: Offer) => void;
  comparing?: boolean;
  compareDisabled?: boolean;
  onToggleCompare?: (offer: Offer) => void;
  shareUrl?: string;
};

/** «Lagre», «Sammenlign» og «Del» – ute av listen, der de stjal plass fra tallene. */
function Actions({ offer, actions }: { offer: Offer; actions: OfferActions }) {
  const t = useT();
  const { saved, onToggleSave, comparing, compareDisabled, onToggleCompare, shareUrl } = actions;
  if (!onToggleSave && !onToggleCompare && !shareUrl) return null;
  const item = "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-[14px] font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-40";
  return (
    <div className="-mx-2 mb-1 flex flex-wrap items-center gap-1 border-b border-border pb-3">
      {onToggleSave && (
        <button type="button" onClick={() => onToggleSave(offer)} aria-pressed={saved} className={cn(item, saved && "text-petrol")}>
          <Bookmark className={cn("size-4", saved && "fill-current")} aria-hidden="true" /> {saved ? t("oc.saved") : t("oc.save")}
        </button>
      )}
      {onToggleCompare && (
        <button type="button" onClick={() => onToggleCompare(offer)} disabled={!comparing && compareDisabled} aria-pressed={comparing} className={item}>
          <ArrowLeftRight className="size-4" aria-hidden="true" /> {comparing ? t("oc.selected") : t("oc.compare")}
        </button>
      )}
      {shareUrl && (
        <a href={shareUrl} target="_blank" rel="noopener noreferrer" className={item}>
          <Share2 className="size-4" aria-hidden="true" /> {t("oc.share.short")}
        </a>
      )}
    </div>
  );
}

export default function OfferDetailsSheet({
  offer,
  totalMinor,
  onClose,
  onSelect,
  actions,
}: {
  offer: Offer | null;
  totalMinor: number;
  onClose: () => void;
  onSelect: (offer: Offer) => void;
  actions?: OfferActions;
}) {
  const t = useT();
  const desktop = useMinWidth(1024);
  const open = Boolean(offer);
  useBackCloses(open, onClose);
  useFocusReturn(open);

  if (!offer) return null;
  const currency = offer.totalCurrency;
  const external = offer.booking?.kind === "external";
  const seller = providerName(offer);
  const trip = offer.slices.length > 1 ? t("fd.roundtrip") : t("sr.oneway.cap");

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <div className="shrink-0">
        <p className="t-num text-[22px] font-bold leading-none tracking-tight">{formatMinor(totalMinor, currency)}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {trip} · {partyLabel(offer.passengers, t)}
        </p>
      </div>
      {external ? (
        <Button asChild size="lg" className="h-12 min-w-0 shrink rounded-xl px-3.5 text-[14.5px] font-bold sm:px-5 sm:text-[16px]">
          <a href={offer.booking!.url} target="_blank" rel="noopener noreferrer nofollow sponsored" onClick={() => onSelect(offer)}>
            <span className="truncate">{t("fd.cta.at", { name: seller })}</span> <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
          </a>
        </Button>
      ) : (
        <Button size="lg" onClick={() => onSelect(offer)} className="h-12 shrink-0 rounded-xl px-5 text-[16px] font-bold">
          {t("oc.select")}
        </Button>
      )}
    </div>
  );

  const body = (
    <>
      {actions && <Actions offer={offer} actions={actions} />}
      <Details offer={offer} totalMinor={totalMinor} />
    </>
  );

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="flex max-h-[88vh] flex-col gap-0 rounded-2xl p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-14">
            <DialogTitle className="text-[20px] font-bold">{t("fd.title")}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{body}</div>
          <div className="shrink-0 border-t border-border px-6 py-3">{footer}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[92dvh]">
        <SheetHeader className="border-b border-border pb-3">
          <SheetTitle className="text-[20px] font-bold">{t("fd.title")}</SheetTitle>
        </SheetHeader>
        <SheetBody className="pt-4">{body}</SheetBody>
        <SheetFooter className="pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
