import type { Offer, OfferPassenger } from "@contracts/types";
import { WEB_BASE } from "./config";
import type { SearchForm } from "./searchForm";

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

/**
 * Et søk fra appens skjema som lenke til hellosky.no (/sok): samme parametere som webSearchUrl – strekning, datoer,
 * reisende (antall og alder) og klasse. Brukes for å dele et lagret fly eller en lagret rute; en rute har ingen datoer,
 * så den deles med skjemaets datoer, som nettets egne rutelenker gjør. Ingen konto, token, økt eller pris er med.
 * null når skjemaet mangler en flyplass.
 */
export function webSearchUrlForForm(f: SearchForm): string | null {
  if (!f.origin || !f.destination || !IATA.test(f.origin.iata) || !IATA.test(f.destination.iata)) return null;
  const params: [string, string][] = [
    ["adults", String(f.adults)],
    ["children", String(f.childAges.length)],
    ["infants", String(f.infantAges.length)],
    ["cabin", f.cabinClass],
  ];
  if (f.childAges.length) params.push(["childAges", f.childAges.join(",")]);
  if (f.infantAges.length) params.push(["infantAges", f.infantAges.join(",")]);
  params.push(["from", f.origin.iata], ["to", f.destination.iata], ["depart", f.departDate]);
  if (f.tripType === "roundtrip") params.push(["ret", f.returnDate]);
  if (f.directOnly) params.push(["direct", "1"]);
  return `${WEB_BASE}/sok?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}
