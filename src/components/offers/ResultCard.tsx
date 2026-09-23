import { useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import type { Offer, OfferSlice } from "@contracts/types";
import AirlineLogo from "@/components/brand/AirlineLogo";
import { Button } from "@/components/ui/button";
import { formatClock, formatDateShort, formatDuration, formatMinor } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Seller } from "@/lib/itineraryGroups";
import { baggageStatus, dayShift, marketingCarriers, offerWarnings, operatingCarriers } from "./offerFacts";
import { partyLabel, providerName, sliceLabel } from "./offerUtils";

/**
 * Ett tilbud, én rad i sammenligningen (HelloSky 5.0).
 *
 * Kortet er bygget for å sammenlignes, ikke for å imponere: hver strekning
 * bruker nøyaktig samme rutenett, slik at øyet kan lese nedover en liste og se
 * forskjellen. Derfor ingen store overskrifter, ingen dekorative fly, ingen
 * rader med merkelapper – bare tidene, reiselengden, stoppene, bagasjen når vi
 * vet den, prisen og hvem som selger.
 *
 * Alt her kommer fra leverandørens svar. Det som ikke er oppgitt, står som
 * «ikke oppgitt».
 */

/** Én strekning: avgang, reiselengde med stopp, ankomst – alltid samme tre kolonner. */
function LegRow({ slice, label }: { slice: OfferSlice; label: string }) {
  const t = useT();
  const shift = dayShift(slice);
  const direct = slice.stops === 0;
  const via = slice.segments
    .slice(0, -1)
    .map((s) => s.destination.iata)
    .join(", ");
  return (
    <div>
      <p className="flex items-baseline gap-2 text-[12px] leading-none text-muted-foreground">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="truncate">{formatDateShort(slice.departingAt)}</span>
      </p>
      {/* Reiselinjen får ikke strekke seg over hele skjermen: på 1440 px ble
          den ~700 px lang og kortet føltes tomt. Den har en øvre bredde og
          resten av raden er luft. */}
      <div className="mt-1 flex items-start gap-2.5 sm:gap-3">
        <div className="w-[52px] shrink-0 sm:w-[58px]">
          <p className="t-num text-[18px] font-bold leading-none tracking-tight sm:text-[19px]">{formatClock(slice.departingAt)}</p>
          <p className="mt-0.5 text-[12px] leading-none text-muted-foreground">{slice.origin.iata}</p>
        </div>

        <div className="min-w-0 max-w-[340px] flex-1 pt-0.5">
          <p className="truncate text-center text-[12px] leading-none text-muted-foreground">{formatDuration(slice.durationMinutes)}</p>
          <div className="mt-1 h-px w-full bg-border" aria-hidden="true" />
          <p className="mt-1 text-center leading-none">
            <span
              className={cn(
                "inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[11.5px] font-semibold",
                direct ? "bg-mint text-petrol" : "bg-secondary text-muted-foreground",
              )}
            >
              {direct ? t("oc.direct") : via ? `${t("oc.stops", { count: slice.stops })} · ${via}` : t("oc.stops", { count: slice.stops })}
            </span>
          </p>
        </div>

        <div className="w-[52px] shrink-0 text-right sm:w-[58px]">
          <p className="t-num text-[18px] font-bold leading-none tracking-tight sm:text-[19px]">
            {formatClock(slice.arrivingAt)}
            {shift > 0 && (
              <sup className="ml-0.5 align-super text-[11px] font-semibold text-azure-ink" aria-label={shift === 1 ? t("oc.arrival.next") : t("oc.arrival.days", { count: shift })}>
                +{shift}
              </sup>
            )}
          </p>
          <p className="mt-0.5 text-[12px] leading-none text-muted-foreground">{slice.destination.iata}</p>
        </div>
      </div>
    </div>
  );
}

export interface ResultCardProps {
  offer: Offer;
  /** Fullstendig totalpris i minste enhet, regnet av siden (gebyr der det gjelder). */
  totalMinor: number;
  /** Åpner detaljarket. */
  onDetails: (offer: Offer) => void;
  /** Går videre: ekstern lenke håndteres av kortet, egen kasse av siden. */
  onSelect: (offer: Offer) => void;
  /** Én anbefaling per kort, aldri flere. */
  badge?: string;
  /**
   * Alle selgere av denne reisen, billigst først. Med mer enn én vises de
   * inne i kortet i stedet for som egne kort, fordi reisen er den samme.
   */
  sellers?: Seller[];
  className?: string;
}

export default function ResultCard({ offer, totalMinor, onDetails, onSelect, badge, sellers, className }: ResultCardProps) {
  const t = useT();
  const [sellersOpen, setSellersOpen] = useState(false);
  const others = (sellers ?? []).filter((s) => s.offer.id !== offer.id);
  const currency = offer.totalCurrency;
  const external = offer.booking?.kind === "external";
  const seller = providerName(offer);
  const bag = baggageStatus(offer);
  const warnings = offerWarnings(offer);
  const carriers = marketingCarriers(offer);
  const operated = operatingCarriers(offer);
  const multiAirline = carriers.length > 1;
  const airlineLabel = multiAirline ? carriers.map((c) => c.name).join(" + ") : offer.owner.name;
  const price = formatMinor(totalMinor, currency);

  return (
    <article
      className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}
      aria-label={t("oc.aria", { airline: airlineLabel, price })}
    >
      {/* På brede skjermer står reisen til venstre og prisen i en fast kolonne
          til høyre, slik at prisen ligger på samme x nedover hele listen og
          kan sammenlignes med øyet. På telefon er det den samme stablede
          raden som før. */}
      <div className="lg:flex lg:items-stretch">
      <div className="min-w-0 flex-1 px-4 pb-2.5 pt-3 sm:px-5">
        {/* Hvem flyr. Logoen er liten med vilje: den skal kjennes igjen, ikke dominere. */}
        <div className="flex items-center gap-2.5">
          <span className="flex shrink-0 items-center gap-1">
            {carriers.slice(0, 2).map((c) => (
              <AirlineLogo key={c.iata} airline={{ iata: c.iata, name: c.name, logoSymbolUrl: c.logoUrl }} size={24} className="rounded-md" />
            ))}
          </span>
          {/* Merkelappen skal stå ved selskapet, ikke drive til høyre kant og
              lande over ankomsttiden når kortet er bredt. */}
          <p className="min-w-0 flex-1 truncate text-[14.5px] font-semibold leading-tight lg:flex-none">{airlineLabel}</p>
          {badge && (
            <span className="shrink-0 rounded-md bg-sky-soft px-2 py-0.5 text-[11.5px] font-bold uppercase tracking-[0.04em] text-azure-ink">{badge}</span>
          )}
        </div>

        <div className="mt-2.5 space-y-2.5">
          {offer.slices.map((slice, i) => (
            <LegRow key={slice.id} slice={slice} label={sliceLabel(offer.slices.length, i)} />
          ))}
        </div>

        {/* Bagasje og advarsler: én rad, kort, og bare det leverandøren har sagt. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] leading-tight">
          <span className={cn(bag.tone === "ok" ? "text-foreground" : "text-muted-foreground")}>
            {t(bag.key)}
            {bag.fee ? ` (${bag.fee})` : ""}
          </span>
          {operated.length > 0 && <span className="min-w-0 truncate text-muted-foreground">{t("od.operatedby", { name: operated.join(", ") })}</span>}
          {warnings.map((w) => (
            <span key={w.key} className="font-semibold text-warning">
              {t(w.key)}
            </span>
          ))}
        </div>
      </div>

      {/* Pris og handling */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 sm:gap-4 sm:px-5 lg:w-[250px] lg:shrink-0 lg:flex-col lg:items-stretch lg:justify-center lg:gap-3 lg:border-l lg:border-t-0 lg:py-4">
        <button
          type="button"
          onClick={() => onDetails(offer)}
          className="inline-flex min-h-10 shrink-0 items-center gap-1 text-[14px] font-semibold text-azure-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:order-3 lg:justify-center"
        >
          {t("oc.details")}
          <ChevronDown className="size-4" aria-hidden="true" />
        </button>

        <div className="flex min-w-0 items-center gap-2.5 sm:gap-4 lg:flex-col lg:items-stretch lg:gap-3">
          <div className="min-w-0 text-right lg:text-center">
            <p className="t-num text-[24px] font-bold leading-none tracking-tight sm:text-[26px]">{price}</p>
            {/* Hvem som selger er en del av prisen. Den skal aldri kuttes bort – heller
              en linje til enn et halvt selskapsnavn. */}
            <p className="mt-0.5 text-[11.5px] leading-tight text-muted-foreground">{t("oc.at", { name: seller })}</p>
          </div>
          {external ? (
            <Button asChild size="md" className="h-10 shrink-0 rounded-xl px-3.5 text-[15px] font-bold sm:px-5 lg:h-11 lg:w-full">
              <a
                href={offer.booking!.url}
                target="_blank"
                rel="noopener noreferrer nofollow sponsored"
                onClick={() => onSelect(offer)}
                aria-label={t("oc.view.at", { name: seller })}
              >
                {t("oc.view")} <ArrowUpRight className="size-4" aria-hidden="true" />
              </a>
            </Button>
          ) : (
            <Button size="md" onClick={() => onSelect(offer)} className="h-11 shrink-0 rounded-xl px-3.5 text-[15px] font-bold sm:px-5 lg:w-full">
              {t("oc.select")}
            </Button>
          )}
        </div>
        {offer.passengers.length > 0 && (
          <p className="basis-full text-right text-[12px] leading-snug text-muted-foreground lg:order-1 lg:basis-auto lg:text-center">
            {t("oc.total.party", { party: partyLabel(offer.passengers, t) })}
          </p>
        )}
      </div>
      </div>

      {/* Samme reise, flere salgskanaler. Prisen og bagasjen kan skille, så
          begge står her – men reisen skal ikke telles flere ganger i listen. */}
      {others.length > 0 && (
        <div className="border-t border-border">
          <button
            type="button"
            aria-expanded={sellersOpen}
            onClick={() => setSellersOpen((v) => !v)}
            className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left text-[13px] font-semibold text-azure-ink hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-5"
          >
            <span>{t("oc.sellers", { count: (sellers ?? []).length })}</span>
            <ChevronDown className={cn("size-4 shrink-0 transition-transform", sellersOpen && "rotate-180")} aria-hidden="true" />
          </button>
          {sellersOpen && (
            <ul className="border-t border-border">
              {(sellers ?? []).map((s) => {
                const sName = providerName(s.offer);
                const sBag = baggageStatus(s.offer);
                const sPrice = formatMinor(s.totalMinor, s.offer.totalCurrency);
                const sExternal = s.offer.booking?.kind === "external";
                return (
                  <li key={s.offer.id} className="flex items-center justify-between gap-3 px-4 py-2 text-[13px] sm:px-5">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{sName}</span>
                      <span className="block truncate text-muted-foreground">
                        {t(sBag.key)}
                        {sBag.fee ? ` (${sBag.fee})` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="t-num font-bold">{sPrice}</span>
                      {sExternal ? (
                        <a
                          href={s.offer.booking!.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow sponsored"
                          onClick={() => onSelect(s.offer)}
                          aria-label={t("oc.view.at", { name: sName })}
                          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-2.5 font-bold text-azure-ink hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          {t("oc.view")} <ArrowUpRight className="size-3.5" aria-hidden="true" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelect(s.offer)}
                          className="inline-flex min-h-9 items-center rounded-lg border border-border px-2.5 font-bold text-azure-ink hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          {t("oc.select")}
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}
