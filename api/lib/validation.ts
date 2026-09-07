import { AppError } from "./errors";
import type { PassengerDetails, PassengerType } from "../../contracts/types";

// ─── Delt passasjer-/kontaktvalidering (OTA-030..035) ───────────────────────
// Brukes av checkout, assisted booking (quotes) og admin før noe sendes til
// leverandør. Kaster AppError med `data.field` slik at klienten kan markere
// riktig felt. Meldinger er norske og trygge å vise til kunden.

export type OfferForValidation = {
  slices: Array<{ departingAt: string; arrivingAt?: string }>;
  passengers: Array<{ id: string; type: PassengerType; age?: number }>;
  identityDocumentsRequired?: boolean;
};

export type ContactForValidation = { email?: string; phone?: string };

/** Etter NFKD + fjerning av kombinerende tegn: latinske bokstaver, apostrof, bindestrek, mellomrom. */
const NAME_RE = /^[A-Za-zÀ-ÿ' -]{1,60}$/;

export function normalizeName(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * E.164-normalisering. Godtar «+47 912 34 567», «0047…», «00 47 …», «912 34 567»
 * (norsk 8-sifret → +47). Returnerer null ved ugyldig nummer.
 */
export function normalizePhone(raw: string): string | null {
  let s = String(raw ?? "").replace(/[\s\-().]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (/^\d{8}$/.test(s)) s = `+47${s}`; // norsk nummer uten landskode
  if (!/^\+[1-9]\d{6,14}$/.test(s)) return null; // E.164: maks 15 siffer, ingen ledende 0
  return s;
}

function daysBetween(fromIso: string, toIso: string): number {
  return (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000;
}

/** Hele år mellom fødselsdato og referansedato (kalenderbasert, ikke 365-dagers). */
export function ageOn(bornOn: string, atIso: string): number {
  const born = new Date(`${bornOn}T00:00:00Z`);
  const at = new Date(atIso);
  if (Number.isNaN(born.getTime()) || Number.isNaN(at.getTime())) return NaN;
  let age = at.getUTCFullYear() - born.getUTCFullYear();
  const m = at.getUTCMonth() - born.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < born.getUTCDate())) age -= 1;
  return age;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function invalid(field: string, message: string, extra: Record<string, unknown> = {}): AppError {
  return new AppError("INVALID_PASSENGER", { message, data: { field, ...extra } });
}

/**
 * Validerer passasjerer mot tilbudet. Kaster ved første feil.
 * Returnerer normaliserte passasjerer (trimmede navn, E.164-telefon) og
 * normalisert kontaktinfo — bruk RETURVERDIEN videre, ikke input.
 */
export function validatePassengers(
  passengers: PassengerDetails[],
  offer: OfferForValidation,
  contact?: ContactForValidation,
): { passengers: PassengerDetails[]; contact: { email?: string; phone?: string } } {
  if (!offer.slices?.length) throw new AppError("OFFER_NOT_FOUND");
  const lastSlice = offer.slices[offer.slices.length - 1];
  const lastDeparture = lastSlice.departingAt;
  const lastArrival = lastSlice.arrivingAt ?? lastSlice.departingAt;

  // ── Antall og ID-er må matche tilbudet nøyaktig ──
  const offerById = new Map(offer.passengers.map((p) => [p.id, p]));
  if (passengers.length !== offer.passengers.length) {
    throw invalid("passengers", "Antall reisende stemmer ikke med tilbudet. Søk på nytt.");
  }
  const seen = new Set<string>();
  for (const p of passengers) {
    if (!offerById.has(p.id)) throw invalid(`passengers.${p.id}.id`, "Reisende matcher ikke tilbudet. Søk på nytt.");
    if (seen.has(p.id)) throw invalid(`passengers.${p.id}.id`, "Samme reisende er oppgitt to ganger.");
    seen.add(p.id);
  }

  const normalized: PassengerDetails[] = [];
  const adults: string[] = [];

  for (let i = 0; i < passengers.length; i++) {
    const p = passengers[i];
    const offerPax = offerById.get(p.id)!;
    const f = (name: string) => `passengers.${i}.${name}`;

    // Type må stemme med tilbudet (prisen er beregnet for denne typen)
    if (p.type !== offerPax.type) {
      throw invalid(f("type"), "Reisendetype stemmer ikke med tilbudet. Søk på nytt.");
    }

    // ── Navn ──
    const given = normalizeName(p.givenName ?? "");
    const family = normalizeName(p.familyName ?? "");
    if (!NAME_RE.test(given)) {
      throw invalid(f("givenName"), "Fornavn må skrives med latinske bokstaver (1–60 tegn), som i passet.");
    }
    if (!NAME_RE.test(family)) {
      throw invalid(f("familyName"), "Etternavn må skrives med latinske bokstaver (1–60 tegn), som i passet.");
    }

    // ── Fødselsdato og alder ved SISTE avreise ──
    if (!p.bornOn || !isValidDate(p.bornOn)) {
      throw invalid(f("bornOn"), "Fødselsdato må oppgis som ÅÅÅÅ-MM-DD.");
    }
    const age = ageOn(p.bornOn, lastDeparture);
    if (!Number.isFinite(age) || age < 0 || age > 120) {
      throw invalid(f("bornOn"), "Fødselsdatoen ser ikke riktig ut.");
    }
    if (p.type === "adult" && age < 12) {
      throw invalid(f("bornOn"), "Voksne må være minst 12 år ved avreise. Velg «barn» eller «baby» i søket.", { age });
    }
    if (p.type === "child" && (age < 2 || age > 11)) {
      throw invalid(f("bornOn"), "Barn må være 2–11 år ved siste avreise. Søk på nytt med riktig alder.", { age });
    }
    if (p.type === "infant_without_seat" && age >= 2) {
      throw invalid(f("bornOn"), "Babyer uten eget sete må være under 2 år ved siste avreise.", { age });
    }
    // Duffel krever samsvar mellom oppgitt alder i søket og fødselsdato for mindreårige
    if (offerPax.age != null && p.type !== "adult" && Math.abs(offerPax.age - age) > 1) {
      throw invalid(f("bornOn"), "Alder ved avreise stemmer ikke med søket. Søk på nytt med riktig alder.", { age, searchedAge: offerPax.age });
    }

    // ── Tittel og kjønn (kreves av flyselskapene for voksne/barn) ──
    if (p.type !== "infant_without_seat") {
      if (!p.title || !["mr", "ms", "mrs"].includes(p.title)) {
        throw invalid(f("title"), "Velg tittel (Mr/Ms/Mrs) for reisende.");
      }
      if (!p.gender || !["m", "f"].includes(p.gender)) {
        throw invalid(f("gender"), "Velg kjønn slik det står i passet.");
      }
    }

    // ── Kontakt per reisende (valgfritt, men må være gyldig hvis satt) ──
    let phone: string | undefined;
    if (p.phoneNumber) {
      const n = normalizePhone(p.phoneNumber);
      if (!n) throw invalid(f("phoneNumber"), "Telefonnummer må ha landskode, f.eks. +47 912 34 567.");
      phone = n;
    }
    let email: string | undefined;
    if (p.email) {
      email = p.email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 255) {
        throw invalid(f("email"), "E-postadressen er ugyldig.");
      }
    }

    // ── Identitetsdokument ──
    let identityDocument = p.identityDocument;
    if (offer.identityDocumentsRequired) {
      if (!identityDocument) {
        throw new AppError("IDENTITY_DOCUMENT_REQUIRED", { data: { field: f("identityDocument") } });
      }
    }
    if (identityDocument) {
      const doc = identityDocument;
      const id = String(doc.uniqueIdentifier ?? "").replace(/\s/g, "").toUpperCase();
      if (!/^[A-Z0-9]{5,20}$/.test(id)) {
        throw invalid(f("identityDocument.uniqueIdentifier"), "Passnummeret ser ikke riktig ut (5–20 bokstaver/siffer).");
      }
      const country = String(doc.issuingCountryCode ?? "").toUpperCase();
      if (!/^[A-Z]{2}$/.test(country)) {
        throw invalid(f("identityDocument.issuingCountryCode"), "Utstederland må være en tobokstavs landkode (f.eks. NO).");
      }
      if (!doc.expiresOn || !isValidDate(doc.expiresOn)) {
        throw invalid(f("identityDocument.expiresOn"), "Utløpsdato for passet må oppgis som ÅÅÅÅ-MM-DD.");
      }
      if (daysBetween(lastArrival.slice(0, 10), doc.expiresOn) < 0) {
        throw invalid(f("identityDocument.expiresOn"), "Passet må være gyldig til og med siste ankomstdato.");
      }
      identityDocument = { type: "passport", uniqueIdentifier: id, issuingCountryCode: country, expiresOn: doc.expiresOn };
    }

    if (p.type === "adult") adults.push(p.id);

    normalized.push({
      ...p,
      givenName: given,
      familyName: family,
      email,
      phoneNumber: phone,
      identityDocument,
    });
  }

  // ── Baby ↔ voksen-kobling: hver baby til nøyaktig én DISTINKT voksen ──
  const usedAdults = new Set<string>();
  for (let i = 0; i < normalized.length; i++) {
    const p = normalized[i];
    if (p.type !== "infant_without_seat") continue;
    const f = `passengers.${i}.infantPassengerId`;
    if (!p.infantPassengerId) {
      throw new AppError("INFANT_LINK", { data: { field: f } });
    }
    if (!adults.includes(p.infantPassengerId)) {
      throw new AppError("INFANT_LINK", { message: "Babyen må knyttes til en voksen reisende i samme bestilling.", data: { field: f } });
    }
    if (usedAdults.has(p.infantPassengerId)) {
      throw new AppError("INFANT_LINK", { message: "Hver voksen kan reise med maks én baby på fanget.", data: { field: f } });
    }
    usedAdults.add(p.infantPassengerId);
  }
  // Voksne/barn skal ikke ha infantPassengerId satt
  for (let i = 0; i < normalized.length; i++) {
    if (normalized[i].type !== "infant_without_seat" && normalized[i].infantPassengerId) {
      throw new AppError("INFANT_LINK", { message: "Kun babyer kan knyttes til en voksen.", data: { field: `passengers.${i}.infantPassengerId` } });
    }
  }
  if (adults.length === 0) {
    throw invalid("passengers", "Minst én voksen må være med på reisen.");
  }

  // ── Kontaktinfo for bestillingen ──
  const outContact: { email?: string; phone?: string } = {};
  if (contact?.email !== undefined) {
    const email = contact.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 255) {
      throw invalid("contact.email", "E-postadressen er ugyldig.");
    }
    outContact.email = email;
  }
  if (contact?.phone !== undefined) {
    const n = normalizePhone(contact.phone);
    if (!n) throw invalid("contact.phone", "Telefonnummer må ha landskode, f.eks. +47 912 34 567.");
    outContact.phone = n;
  }

  return { passengers: normalized, contact: outContact };
}
