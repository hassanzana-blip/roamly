// Stabile feilkoder fra serveren (api/lib/errors.ts) → norske meldinger og
// UX-handlinger. Klienten skal ALDRI vise rå `error.message` fra ukjente kilder.

export type AppCode =
  | "OFFER_EXPIRED"
  | "OFFER_NOT_FOUND"
  | "PRICE_CHANGED"
  | "SUPPLIER_UNAVAILABLE"
  | "SUPPLIER_REJECTED"
  | "SUPPLIER_TIMEOUT"
  | "PAYMENT_REQUIRED"
  | "PAYMENT_FAILED"
  | "PAYMENT_NOT_CONFIGURED"
  | "BOOKING_CLOSED"
  | "BOOKING_IN_PROGRESS"
  | "INVALID_PASSENGER"
  | "INFANT_LINK"
  | "IDENTITY_DOCUMENT_REQUIRED"
  | "NOT_REFUNDABLE"
  | "REFUND_EXCEEDS_CAPTURED"
  | "REFUND_INVALID_STATE"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "EMAIL_NOT_VERIFIED"
  | "VALIDATION"
  | "CONFLICT"
  | "INTERNAL";

const KNOWN: ReadonlySet<string> = new Set<AppCode>([
  "OFFER_EXPIRED", "OFFER_NOT_FOUND", "PRICE_CHANGED", "SUPPLIER_UNAVAILABLE", "SUPPLIER_REJECTED",
  "SUPPLIER_TIMEOUT", "PAYMENT_REQUIRED", "PAYMENT_FAILED", "PAYMENT_NOT_CONFIGURED", "BOOKING_CLOSED",
  "BOOKING_IN_PROGRESS", "INVALID_PASSENGER", "INFANT_LINK", "IDENTITY_DOCUMENT_REQUIRED", "NOT_REFUNDABLE",
  "REFUND_EXCEEDS_CAPTURED", "REFUND_INVALID_STATE", "RATE_LIMITED", "NOT_FOUND", "FORBIDDEN", "UNAUTHORIZED",
  "EMAIL_NOT_VERIFIED", "VALIDATION", "CONFLICT", "INTERNAL",
]);

const MESSAGES: Record<AppCode, string> = {
  OFFER_EXPIRED: "Tilbudet er utløpt. Søk på nytt for å se oppdaterte priser.",
  OFFER_NOT_FOUND: "Vi finner ikke dette tilbudet lenger. Søk på nytt.",
  PRICE_CHANGED: "Prisen har endret seg siden du valgte reisen. Se ny pris før du fortsetter.",
  SUPPLIER_UNAVAILABLE: "Flyselskapets system svarer ikke akkurat nå. Prøv igjen om et øyeblikk.",
  SUPPLIER_REJECTED: "Flyselskapet kunne ikke fullføre bestillingen med disse opplysningene.",
  SUPPLIER_TIMEOUT: "Det tok for lang tid å få svar fra flyselskapet. Vi sjekker status og gir deg beskjed.",
  PAYMENT_REQUIRED: "Betalingen må fullføres før billetten kan bestilles.",
  PAYMENT_FAILED: "Betalingen ble avvist. Prøv et annet kort eller en annen betalingsmåte.",
  PAYMENT_NOT_CONFIGURED: "Betaling er ikke tilgjengelig akkurat nå.",
  BOOKING_CLOSED: "Direktebooking er midlertidig stengt. Kontakt oss, så hjelper vi deg.",
  BOOKING_IN_PROGRESS: "Denne bestillingen behandles allerede.",
  INVALID_PASSENGER: "Passasjeropplysningene er ikke gyldige.",
  INFANT_LINK: "Hver baby må knyttes til nøyaktig én voksen reisende.",
  IDENTITY_DOCUMENT_REQUIRED: "Denne reisen krever passopplysninger for alle reisende.",
  NOT_REFUNDABLE: "Denne billetten kan ikke refunderes.",
  REFUND_EXCEEDS_CAPTURED: "Refusjonsbeløpet overstiger det som er betalt.",
  REFUND_INVALID_STATE: "Refusjonen kan ikke behandles i nåværende tilstand.",
  RATE_LIMITED: "For mange forespørsler på kort tid. Vent litt og prøv igjen.",
  NOT_FOUND: "Fant ikke det du lette etter.",
  FORBIDDEN: "Du har ikke tilgang til dette.",
  UNAUTHORIZED: "Du må være logget inn.",
  EMAIL_NOT_VERIFIED: "Bekreft e-postadressen din for å se dette.",
  VALIDATION: "Noen av opplysningene er ugyldige.",
  CONFLICT: "Handlingen kolliderer med en annen endring. Prøv igjen.",
  INTERNAL: "Noe gikk galt hos oss. Prøv igjen, eller kontakt oss hvis det fortsetter.",
};

type ErrorLike = {
  message?: unknown;
  data?: { appCode?: unknown; retryable?: unknown; details?: Record<string, unknown> } | null;
  shape?: { data?: { appCode?: unknown; details?: Record<string, unknown> } };
};

function dataOf(err: unknown): { appCode?: unknown; retryable?: unknown; details?: Record<string, unknown> } | null {
  if (!err || typeof err !== "object") return null;
  const e = err as ErrorLike;
  if (e.data && typeof e.data === "object") return e.data;
  if (e.shape?.data && typeof e.shape.data === "object") return e.shape.data;
  return null;
}

/** Stabil feilkode fra tRPC-feil (error.data.appCode) — null når ukjent. */
export function appCodeOf(err: unknown): AppCode | null {
  const code = dataOf(err)?.appCode;
  return typeof code === "string" && KNOWN.has(code) ? (code as AppCode) : null;
}

/** Ekstra detaljer serveren la ved (f.eks. retryAfterSec, field). */
export function detailsOf(err: unknown): Record<string, unknown> {
  const d = dataOf(err)?.details;
  return d && typeof d === "object" ? d : {};
}

/** Feltnavn serveren peker på (data.details.field), f.eks. "passengers.0.bornOn". */
export function fieldOf(err: unknown): string | null {
  const f = detailsOf(err).field;
  return typeof f === "string" ? f : null;
}

export function retryAfterSecOf(err: unknown): number | null {
  const s = detailsOf(err).retryAfterSec;
  return typeof s === "number" && Number.isFinite(s) ? s : null;
}

export function isRetryable(err: unknown): boolean {
  return dataOf(err)?.retryable === true;
}

/** Norsk melding for en kode. `fallback` brukes når koden er ukjent. */
export function messageFor(code: AppCode | null | undefined, fallback = MESSAGES.INTERNAL): string {
  return code ? MESSAGES[code] : fallback;
}

/**
 * Brukervennlig melding for en vilkårlig feil. Serverens melding brukes bare
 * når den kommer med en kjent appCode (da er den kuratert på serveren);
 * ellers vises standardteksten for koden, eller INTERNAL.
 */
export function humanMessage(err: unknown, fallback?: string): string {
  const code = appCodeOf(err);
  if (code === "RATE_LIMITED") {
    const s = retryAfterSecOf(err);
    return s ? `For mange forsøk. Vent ${s} sekunder og prøv igjen.` : MESSAGES.RATE_LIMITED;
  }
  if (code) {
    const msg = (err as ErrorLike).message;
    // Kuraterte server-meldinger (VALIDATION/INVALID_PASSENGER/CONFLICT …) er trygge å vise.
    if (typeof msg === "string" && msg.trim() && ["VALIDATION", "INVALID_PASSENGER", "INFANT_LINK", "CONFLICT", "NOT_FOUND", "NOT_REFUNDABLE", "UNAUTHORIZED", "PRICE_CHANGED", "BOOKING_CLOSED"].includes(code)) {
      return msg;
    }
    return MESSAGES[code];
  }
  return fallback ?? MESSAGES.INTERNAL;
}
