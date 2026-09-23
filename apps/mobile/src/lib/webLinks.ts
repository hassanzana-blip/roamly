import type { Offer, OfferPassenger } from "@contracts/types";
import { WEB_BASE } from "./config";

const IATA = /^[A-Z]{3}$/;
const DAY = /^(\d{4}-\d{2}-\d{2})/;

function ages(list: OfferPassenger[]): number[] | null {
  const out = list.map((p) => p.age);
  return out.every((a): a is number => typeof a === "number" && Number.isInteger(a) && a >= 0 && a <= 17) ? out : null;
}

/**
 * Det samme søket på hellosky.no (/sok), laget av tilbudet selv: strekning,
 * datoer, antall reisende (med alder når leverandøren oppga den) og
 * reiseklasse – nøyaktig parameterne nettets søkeside leser. Ingen konto,
 * token, økt eller leverandørlenke er med, så lenken kan deles trygt.
 * null når reisen ikke er én vei eller tur-retur mellom samme to flyplasser.
 */
export function webSearchUrl(offer: Offer): string | null {
  const slices = offer.slices;
  const first = slices[0];
  const last = slices[slices.length - 1];
  if (!first || !last) return null;
  const from = first.origin.iata;
  const to = first.destination.iata;
  const depart = DAY.exec(first.departingAt)?.[1];
  if (!IATA.test(from) || !IATA.test(to) || !depart) return null;
  const roundtrip = slices.length === 2 && last.origin.iata === to && last.destination.iata === from;
  if (slices.length > 1 && !roundtrip) return null;
  const ret = roundtrip ? DAY.exec(last.departingAt)?.[1] : undefined;
  if (roundtrip && !ret) return null;

  const adults = offer.passengers.filter((p) => p.type === "adult").length || 1;
  const children = offer.passengers.filter((p) => p.type === "child");
  const infants = offer.passengers.filter((p) => p.type === "infant_without_seat");
  const params: [string, string][] = [
    ["adults", String(adults)],
    ["children", String(children.length)],
    ["infants", String(infants.length)],
    ["cabin", offer.cabinClass],
  ];
  const childAges = ages(children);
  if (children.length && childAges) params.push(["childAges", childAges.join(",")]);
  const infantAges = ages(infants);
  if (infants.length && infantAges) params.push(["infantAges", infantAges.join(",")]);
  params.push(["from", from], ["to", to], ["depart", depart]);
  if (ret) params.push(["ret", ret]);
  // Bygget for hånd: React Natives URLSearchParams mangler set().
  return `${WEB_BASE}/sok?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}
