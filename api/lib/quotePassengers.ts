import type { Offer, PassengerDetails } from "../../contracts/types";
import { AppError } from "./errors";
import { decryptField, encryptField, last4 } from "./crypto";
import { validatePassengers, type ContactForValidation } from "./validation";
import type { DbOrTx } from "./ledger";
import { passengerDocuments } from "../../db/schema";

// ─── Passasjerer på tilbud (assisted booking, B2) ───────────────────────────
// `quotes.passengersJson` lagrer passasjerene som skal sendes til leverandøren
// når tilbudet betales/bookes. Det finnes ingen checkout-sesjon på det
// tidspunktet, så passnummeret lagres kryptert I JSON-en, merket
// `{ encrypted: true }`, og dekrypteres først når sesjonen bygges — da flyttes
// dokumentet inn i passenger_documents som ved vanlig checkout.

export const MISSING_PASSENGERS_MESSAGE = "Passasjeropplysninger mangler";

export type StoredIdentityDocument = {
  type: "passport";
  encrypted: true;
  /** encryptField(uniqueIdentifier) */
  uniqueIdentifier: string;
  last4: string;
  issuingCountryCode: string;
  expiresOn: string;
};

export type StoredQuotePassenger = Omit<PassengerDetails, "identityDocument"> & { identityDocument?: StoredIdentityDocument };

/** Valider mot tilbudet og krypter passnummer for lagring i quotes.passengers_json. */
export function prepareQuotePassengers(
  passengers: PassengerDetails[],
  offer: Offer,
  contact?: ContactForValidation,
): { stored: StoredQuotePassenger[]; contact: { email?: string; phone?: string } } {
  const validated = validatePassengers(passengers, offer, contact);
  const stored: StoredQuotePassenger[] = validated.passengers.map((p) => {
    const { identityDocument, ...rest } = p;
    if (!identityDocument) return rest;
    return {
      ...rest,
      identityDocument: {
        type: "passport",
        encrypted: true,
        uniqueIdentifier: encryptField(identityDocument.uniqueIdentifier),
        last4: last4(identityDocument.uniqueIdentifier),
        issuingCountryCode: identityDocument.issuingCountryCode,
        expiresOn: identityDocument.expiresOn,
      },
    };
  });
  return { stored, contact: validated.contact };
}

export function parseStoredQuotePassengers(json: string | null | undefined): StoredQuotePassenger[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredQuotePassenger[]) : [];
  } catch {
    return [];
  }
}

/** Dekrypter til PassengerDetails (kun i minnet — brukes når sesjonen bygges). */
export function decryptQuotePassengers(stored: StoredQuotePassenger[]): PassengerDetails[] {
  return stored.map((p) => {
    const doc = p.identityDocument;
    if (!doc) return { ...p, identityDocument: undefined };
    const raw = doc as unknown as { encrypted?: boolean; uniqueIdentifier: string };
    const uniqueIdentifier = raw.encrypted ? decryptField(doc.uniqueIdentifier) : doc.uniqueIdentifier;
    return {
      ...p,
      identityDocument: { type: "passport", uniqueIdentifier, issuingCountryCode: doc.issuingCountryCode, expiresOn: doc.expiresOn },
    };
  });
}

/** Kaster INVALID_PASSENGER («Passasjeropplysninger mangler») når antall ikke matcher tilbudet. */
export function assertQuotePassengersComplete(stored: StoredQuotePassenger[], offer: Pick<Offer, "passengers">): void {
  if (stored.length === 0 || stored.length !== offer.passengers.length) {
    throw new AppError("INVALID_PASSENGER", {
      message: MISSING_PASSENGERS_MESSAGE,
      data: { field: "passengers", expected: offer.passengers.length, got: stored.length },
    });
  }
}

/** Lagre dekrypterte pass i passenger_documents for en ny checkout-sesjon (samme form som checkout.createSession). */
export async function insertSessionDocuments(tx: DbOrTx, sessionId: number, passengers: PassengerDetails[]): Promise<number> {
  const docs = passengers
    .filter((p) => p.identityDocument)
    .map((p) => ({
      checkoutSessionId: sessionId,
      passengerId: p.id,
      type: "passport",
      identifierCiphertext: encryptField(p.identityDocument!.uniqueIdentifier),
      identifierLast4: last4(p.identityDocument!.uniqueIdentifier),
      issuingCountryCode: p.identityDocument!.issuingCountryCode,
      expiresOn: p.identityDocument!.expiresOn,
    }));
  if (docs.length) await tx.insert(passengerDocuments).values(docs);
  return docs.length;
}

/** Passasjerer uten dokumenter — det som legges i checkout_sessions.passengers_json. */
export function stripDocuments(passengers: PassengerDetails[]): PassengerDetails[] {
  return passengers.map((p) => ({ ...p, identityDocument: undefined }));
}

/** Offentlig visning: slots fra tilbudet + evt. innsendte navn (aldri passnummer). */
export function publicQuotePassengers(stored: StoredQuotePassenger[]) {
  return stored.map((p) => ({
    id: p.id,
    type: p.type,
    givenName: p.givenName,
    familyName: p.familyName,
    bornOn: p.bornOn,
    hasIdentityDocument: Boolean(p.identityDocument),
    identityDocumentLast4: p.identityDocument?.last4 ?? null,
  }));
}
