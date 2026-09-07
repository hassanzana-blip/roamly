import { TRPCError } from "@trpc/server";

// ─── Feiltaksonomi ────────────────────────────────────────────────────────────
// Alle forventede feil får en stabil `code` som klienten oversetter. Aldri send
// leverandørens råtekst til kunden. `retryable` styrer jobb-retry og klient-UX.

export type ErrorCode =
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

const TRPC_CODE: Record<ErrorCode, TRPCError["code"]> = {
  OFFER_EXPIRED: "PRECONDITION_FAILED",
  OFFER_NOT_FOUND: "NOT_FOUND",
  PRICE_CHANGED: "PRECONDITION_FAILED",
  SUPPLIER_UNAVAILABLE: "BAD_GATEWAY",
  SUPPLIER_REJECTED: "BAD_REQUEST",
  SUPPLIER_TIMEOUT: "TIMEOUT",
  PAYMENT_REQUIRED: "PRECONDITION_FAILED",
  PAYMENT_FAILED: "BAD_REQUEST",
  PAYMENT_NOT_CONFIGURED: "PRECONDITION_FAILED",
  BOOKING_CLOSED: "PRECONDITION_FAILED",
  BOOKING_IN_PROGRESS: "CONFLICT",
  INVALID_PASSENGER: "BAD_REQUEST",
  INFANT_LINK: "BAD_REQUEST",
  IDENTITY_DOCUMENT_REQUIRED: "BAD_REQUEST",
  NOT_REFUNDABLE: "PRECONDITION_FAILED",
  REFUND_EXCEEDS_CAPTURED: "BAD_REQUEST",
  REFUND_INVALID_STATE: "CONFLICT",
  RATE_LIMITED: "TOO_MANY_REQUESTS",
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  UNAUTHORIZED: "UNAUTHORIZED",
  EMAIL_NOT_VERIFIED: "FORBIDDEN",
  VALIDATION: "BAD_REQUEST",
  CONFLICT: "CONFLICT",
  INTERNAL: "INTERNAL_SERVER_ERROR",
};

/** Norske standardmeldinger (klienten kan overstyre via i18n på `code`). */
const MESSAGES: Record<ErrorCode, string> = {
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

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly data?: Record<string, unknown>;
  constructor(code: ErrorCode, opts: { message?: string; retryable?: boolean; data?: Record<string, unknown>; cause?: unknown } = {}) {
    super(opts.message ?? MESSAGES[code], { cause: opts.cause });
    this.name = "AppError";
    this.code = code;
    this.retryable = opts.retryable ?? false;
    this.data = opts.data;
  }
  toTRPC(): TRPCError {
    return new TRPCError({
      code: TRPC_CODE[this.code],
      message: this.message,
      cause: { appCode: this.code, retryable: this.retryable, ...(this.data ?? {}) },
    });
  }
}

export const isRetryable = (err: unknown): boolean => err instanceof AppError && err.retryable;

/** Konverterer alt til TRPCError med stabil `appCode` i `cause`/`data`. */
export function toTRPCError(err: unknown): TRPCError {
  if (err instanceof TRPCError) return err;
  if (err instanceof AppError) return err.toTRPC();
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: MESSAGES.INTERNAL, cause: err });
}

export function appCodeOf(err: unknown): ErrorCode | null {
  if (err instanceof AppError) return err.code;
  if (err instanceof TRPCError && err.cause && typeof err.cause === "object" && "appCode" in err.cause) {
    return (err.cause as { appCode: ErrorCode }).appCode;
  }
  return null;
}
