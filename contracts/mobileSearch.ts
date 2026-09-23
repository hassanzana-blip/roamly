// ─── Appens flysøk: sammenligningspris i NOK ─────────────────────────────────
// Svaret fra mobile flights.search (/api/mobile/trpc). Leverandørens eget
// tilbud (`offer`) er urørt: totalAmount/totalCurrency og booking.url er
// nøyaktig det leverandøren sendte. Ved siden av ligger en egen, separat
// typet NOK-pris som appen viser og sorterer på. Et utenlandsk beløp merkes
// aldri om til NOK: enten er det et ekte NOK-tilbud, en tydelig merket
// omregning med kilde og dato, eller «ikke tilgjengelig».

import type { CabinClass, FlightSource, Offer, SearchPassengerInput, SearchSliceInput } from "./types";

export const NORGES_BANK_SOURCE = "norges-bank" as const;

/** Kursen en omregning bygger på – Norges Banks indikative midtkurs. */
export interface NokRateInfo {
  source: typeof NORGES_BANK_SOURCE;
  /** Valutaen det ble regnet om fra (ISO 4217). */
  baseCurrency: string;
  /** Kursdatoen Norges Bank oppga (YYYY-MM-DD). Kan være forrige virkedag. */
  rateDate: string;
  /** Kursen slik Norges Bank publiserte den, f.eks. «68.12» for 100 SEK. */
  publishedRate: string;
  /** Hvor mange enheter den publiserte kursen gjelder for (1 eller 100 – fra UNIT_MULT). */
  quotedPerUnits: number;
  /** Midtkurser er veiledende, ikke en pris noen handler til. */
  indicative: true;
}

export type NokUnavailableReason =
  /** Norges Bank publiserer ingen kurs for valutaen. */
  | "unsupported_currency"
  /** Kursene kunne ikke hentes (og ingen brukbar kurs lå i minnet). */
  | "rate_unavailable"
  /** Nyeste kurs er for gammel til å brukes (se MAX_RATE_AGE_DAYS på serveren). */
  | "rate_stale"
  /** Leverandørbeløpet kunne ikke tolkes. */
  | "invalid_amount";

export type NokPrice =
  /** Leverandøren priset selv i NOK. Beløpet er leverandørens, i øre. */
  | { kind: "exact"; currency: "NOK"; amountMinor: number; estimate: false }
  /** Omregnet på serveren. Avrundet til hele kroner (amountMinor er et multiplum av 100). Vis som «ca.». */
  | { kind: "converted"; currency: "NOK"; amountMinor: number; estimate: true; roundedTo: "krone"; rate: NokRateInfo }
  /** Ingen NOK-pris. Appen skal ikke vise et beløp som om det var NOK. */
  | { kind: "unavailable"; reason: NokUnavailableReason };

export interface SupplierAmount {
  /** Desimalstreng slik leverandøren oppga den. */
  amount: string;
  currency: string;
}

export interface MobileOfferPrice {
  /** Leverandørens totalpris, urørt (= offer.totalAmount / offer.totalCurrency). */
  original: SupplierAmount;
  /** HelloSkys servicegebyr i leverandørens valuta når HelloSky selger billetten; null for eksterne tilbud (KAYAK). */
  serviceFee: SupplierAmount | null;
  /** Det kunden betaler i leverandørens valuta: original + serviceFee (samme regel som nettet viser). */
  total: SupplierAmount;
  /** Sammenligningsprisen i NOK for `total`. */
  nok: NokPrice;
}

export interface MobileOffer {
  /** Leverandørens tilbud, urørt – også booking.url. */
  offer: Offer;
  price: MobileOfferPrice;
  /** true når tilbudet har en NOK-pris og er med i prissorteringen. */
  comparable: boolean;
}

export type MobileFxStatus =
  /** Alle tilbud var i NOK; ingen kurs trengtes. */
  | "not_needed"
  /** Kurser hentet og ferske nok. */
  | "ok"
  /** Nyeste kurs er for gammel; utenlandske tilbud har ingen NOK-pris. */
  | "stale"
  /** Kursene kunne ikke hentes; utenlandske tilbud har ingen NOK-pris. */
  | "unavailable";

export interface MobileSearchResult {
  offerRequestId: string;
  provider?: FlightSource;
  sandbox?: boolean;
  bookingMode?: "hellosky" | "external";
  liveMode: boolean;
  demoMode: boolean;
  partial?: boolean;
  cabinClass: CabinClass;
  slices: SearchSliceInput[];
  passengers: SearchPassengerInput[];
  /** Sammenlignbare tilbud først, stigende NOK-pris; deretter tilbud uten NOK-pris i leverandørens rekkefølge. */
  offers: MobileOffer[];
  fx: {
    status: MobileFxStatus;
    source: typeof NORGES_BANK_SOURCE;
    /** Nyeste kursdato som ble brukt, eller null. */
    rateDate: string | null;
    indicative: true;
  };
}
