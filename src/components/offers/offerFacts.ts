import type { Offer, OfferSlice } from "@contracts/types";
import { crossesMidnight, formatSupplierMoney, layoverInfo } from "@/lib/format";
import { hasAirportChange } from "@/lib/offers";
import { sliceBaggage } from "./offerUtils";
import type { I18nKey } from "@/lib/i18n";

/**
 * Fakta et tilbud faktisk bærer – lest ut av leverandørens svar, aldri gjettet.
 *
 * Kortet i resultatlisten og detaljarket leser herfra, slik at listen og
 * detaljene aldri kan si to forskjellige ting om samme reise. Alt som ikke er
 * oppgitt blir «ikke oppgitt», aldri «inkludert» og aldri «ikke inkludert».
 */

/** Bagasjeløftet for hele reisen: den svakeste strekningen bestemmer. */
export function tripBaggage(offer: Offer) {
  const bags = offer.slices.map((s) => sliceBaggage(s, offer.baggage));
  return {
    carryOn: Math.min(...bags.map((b) => b.carryOnBags)),
    checked: Math.min(...bags.map((b) => b.checkedBags)),
    carryOnUnknown: bags.some((b) => b.carryOnUnknown),
    checkedUnknown: bags.some((b) => b.checkedUnknown),
  };
}

export type BaggageStatus = {
  /** Kort linje til kortet i listen. */
  key: I18nKey;
  /** «ok» = noe er inkludert, «none» = ikke inkludert, «unknown» = ikke oppgitt. */
  tone: "ok" | "none" | "unknown";
  /** Gebyret leverandøren oppga for første innsjekkede kolli, når det finnes. */
  fee?: string;
};

/**
 * Ett kort bagasjesvar til listen.
 *
 * Rekkefølgen er bevisst: innsjekket bagasje er det folk leter etter, så
 * håndbagasje. Er tallet ukjent på ett eneste segment, sier vi «ikke oppgitt»
 * – det er forskjellen mellom å informere og å love.
 */
export function baggageStatus(offer: Offer): BaggageStatus {
  const { carryOn, checked, carryOnUnknown, checkedUnknown } = tripBaggage(offer);
  // Gebyret hører til påstanden «mot gebyr». Henger det på «inkludert», leser
  // folk det som prisen på det inkluderte – og da har vi villedet dem.
  const fee = formatSupplierMoney(offer.baggageFees?.checked);
  if (!checkedUnknown && checked > 0) return { key: "bag.checked.short", tone: "ok" };
  if (!carryOnUnknown && carryOn > 0) return { key: "bag.carry.short", tone: "ok" };
  if (checkedUnknown || carryOnUnknown) return { key: "bag.unknown.short", tone: "unknown" };
  return fee ? { key: "bag.fee.short", tone: "none", fee } : { key: "bag.none.short", tone: "none" };
}

export type OfferWarning = { key: I18nKey; vars?: Record<string, string | number> };

/**
 * Advarsler som må være synlige i listen, ikke bare i detaljene: bytte av
 * flyplass, selvtransfer (separate billetter), og opphold som er så lange
 * eller så nattlige at de endrer hva reisen er.
 */
export function offerWarnings(offer: Offer): OfferWarning[] {
  const out: OfferWarning[] = [];
  if (hasAirportChange(offer)) out.push({ key: "oc.tag.airportchange" });
  // «virtualInterline» er leverandørens eget ord for reiser satt sammen av
  // separate billetter: den reisende henter bagasjen og sjekker inn på nytt.
  if (offer.booking?.badges?.includes("virtualInterline")) out.push({ key: "oc.warn.selftransfer" });
  const lays = offer.slices.flatMap((s) =>
    s.segments.map((seg, i) => {
      const next = s.segments[i + 1];
      return next ? layoverInfo(seg.arrivingAt, next.departingAt, seg.destination.timeZone) : null;
    }),
  );
  if (lays.some((l) => l?.overnight)) out.push({ key: "oc.overnight" });
  else if (lays.some((l) => l?.long)) out.push({ key: "oc.longlayover" });
  return out;
}

/** Hvor mange døgn arrival ligger etter avreise (0 = samme dag). */
export function dayShift(slice: OfferSlice): number {
  return crossesMidnight(slice.departingAt, slice.arrivingAt);
}

/** Selskapene som faktisk flyr, når de er andre enn det som står på billetten. */
export function operatingCarriers(offer: Offer): string[] {
  return Array.from(
    new Map(
      offer.slices
        .flatMap((s) => s.segments)
        .filter((seg) => seg.operatingCarrier && seg.operatingCarrier.iata !== seg.carrier.iata)
        .map((seg) => [seg.operatingCarrier!.iata, seg.operatingCarrier!.name] as const),
    ).values(),
  );
}

/** Alle selskapene på reisen – «mixed airline» skal være synlig i listen. */
export function marketingCarriers(offer: Offer): { iata: string; name: string; logoUrl?: string }[] {
  return Array.from(
    new Map(offer.slices.flatMap((s) => s.segments).map((seg) => [seg.carrier.iata, seg.carrier] as const)).values(),
  ).map((c) => ({ iata: c.iata, name: c.name, ...(c.logoUrl ? { logoUrl: c.logoUrl } : {}) }));
}
