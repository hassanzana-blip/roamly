import type { Offer, SearchSliceInput } from "../../contracts/types";
import type { MobileExclusionReason } from "../../contracts/mobileSearch";

// ─── Gjelder tilbudet søket? ────────────────────────────────────────────────
// Appen søker med eksakte flyplasskoder og eksakte datoer (KAYAK: airports +
// flex "exact"). Et tilbud som likevel starter på en annen flyplass (TRF i
// stedet for OSL), lander et annet sted, går en annen dag eller mangler
// returen, gjelder ikke det kunden spurte om, og vises ikke.
//
// Bare reisens endepunkter og avreisedato sjekkes. Et flyplassbytte underveis
// (lander LGW, flyr videre fra LHR) er en ekte del av reisen og er i orden.

const code = (s: string | undefined) => (s ?? "").trim().toUpperCase();

/** Lokal dato (YYYY-MM-DD) fra leverandørens lokale tidspunkt, f.eks. «2026-10-28T07:05:00». */
const localDate = (iso: string | undefined) => (iso ?? "").slice(0, 10);

/**
 * null når tilbudet gjelder søket; ellers den første grunnen til at det ikke gjør det.
 * Rekkefølge: antall strekninger, tomme strekninger, avreiseflyplass, ankomstflyplass, dato.
 */
export function requestMismatch(offer: Offer, requested: readonly SearchSliceInput[]): MobileExclusionReason | null {
  if (offer.slices.length < requested.length) return "missing_leg";
  if (offer.slices.length > requested.length) return "extra_leg";
  for (let i = 0; i < requested.length; i++) {
    const want = requested[i]!;
    const slice = offer.slices[i]!;
    const first = slice.segments[0];
    const last = slice.segments[slice.segments.length - 1];
    if (!first || !last) return "incomplete";
    // Både oppsummeringen og selve flyvningene må starte og slutte der kunden søkte.
    if (code(first.origin.iata) !== code(want.origin) || code(slice.origin.iata) !== code(want.origin)) return "origin";
    if (code(last.destination.iata) !== code(want.destination) || code(slice.destination.iata) !== code(want.destination)) return "destination";
    if (localDate(first.departingAt) !== want.departureDate) return "date";
  }
  return null;
}
