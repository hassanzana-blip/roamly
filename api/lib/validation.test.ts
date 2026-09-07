import { describe, expect, it } from "vitest";
import { ageOn, normalizeName, normalizePhone, validatePassengers } from "./validation";
import { AppError } from "./errors";
import type { PassengerDetails } from "../../contracts/types";

const offer = {
  slices: [
    { departingAt: "2026-12-01T08:00:00Z", arrivingAt: "2026-12-01T12:00:00Z" },
    { departingAt: "2026-12-10T08:00:00Z", arrivingAt: "2026-12-10T12:00:00Z" },
  ],
  passengers: [
    { id: "pas_1", type: "adult" as const },
    { id: "pas_2", type: "child" as const, age: 6 },
    { id: "pas_3", type: "infant_without_seat" as const, age: 1 },
  ],
};

const adult: PassengerDetails = {
  id: "pas_1", type: "adult", title: "mr", gender: "m",
  givenName: "Ola", familyName: "Nordmann", bornOn: "1990-05-05",
};
const child: PassengerDetails = {
  id: "pas_2", type: "child", title: "ms", gender: "f",
  givenName: "Kari", familyName: "Nordmann", bornOn: "2020-06-01",
};
const infant: PassengerDetails = {
  id: "pas_3", type: "infant_without_seat",
  givenName: "Per", familyName: "Nordmann", bornOn: "2025-08-01", infantPassengerId: "pas_1",
};

function codeOf(fn: () => unknown): { code: string; field?: string } {
  try {
    fn();
  } catch (err) {
    if (err instanceof AppError) return { code: err.code, field: err.data?.field as string | undefined };
    throw err;
  }
  throw new Error("expected throw");
}

describe("normalizePhone (E.164)", () => {
  it("normaliserer norske og internasjonale nummer", () => {
    expect(normalizePhone("+47 912 34 567")).toBe("+4791234567");
    expect(normalizePhone("912 34 567")).toBe("+4791234567");
    expect(normalizePhone("0047 91234567")).toBe("+4791234567");
    expect(normalizePhone("+44 (0)20-7946-0958".replace("(0)", ""))).toBe("+442079460958");
    expect(normalizePhone("+1-202-555-0143")).toBe("+12025550143");
  });
  it("avviser ugyldige nummer", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("+0123456789")).toBeNull();
    expect(normalizePhone("+12345678901234567")).toBeNull(); // > 15 siffer
    expect(normalizePhone("abc")).toBeNull();
  });
});

describe("normalizeName", () => {
  it("fjerner aksenter via NFKD og komprimerer mellomrom", () => {
    expect(normalizeName("  José   Ångström ")).toBe("Jose Angstrom");
    expect(normalizeName("Ærlig Øst")).toBe("Ærlig Øst");
  });
});

describe("ageOn", () => {
  it("regner kalenderalder korrekt rundt bursdag", () => {
    expect(ageOn("2014-12-01", "2026-12-01T08:00:00Z")).toBe(12);
    expect(ageOn("2014-12-02", "2026-12-01T08:00:00Z")).toBe(11);
  });
});

describe("validatePassengers", () => {
  it("godtar et gyldig sett og returnerer normaliserte data", () => {
    const out = validatePassengers([adult, child, infant], offer, { email: "Ola@Example.com", phone: "912 34 567" });
    expect(out.passengers).toHaveLength(3);
    expect(out.contact).toEqual({ email: "ola@example.com", phone: "+4791234567" });
  });

  it("avviser feil antall / ukjent id", () => {
    expect(codeOf(() => validatePassengers([adult], offer))).toMatchObject({ code: "INVALID_PASSENGER", field: "passengers" });
    expect(codeOf(() => validatePassengers([adult, child, { ...infant, id: "pas_9" }], offer)).code).toBe("INVALID_PASSENGER");
  });

  it("aldersregler ved SISTE avreise: voksen ≥ 12, barn 2–11, baby < 2", () => {
    // 11 år ved siste avreise (fyller 12 dagen etter) → ikke voksen
    expect(codeOf(() => validatePassengers([{ ...adult, bornOn: "2014-12-11" }, child, infant], offer))).toMatchObject({ field: "passengers.0.bornOn" });
    // barn på 12 → ikke barn
    expect(codeOf(() => validatePassengers([adult, { ...child, bornOn: "2014-01-01" }, infant], offer)).field).toBe("passengers.1.bornOn");
    // baby som fyller 2 før siste avreise → ikke baby
    expect(codeOf(() => validatePassengers([adult, child, { ...infant, bornOn: "2024-12-05" }], offer)).field).toBe("passengers.2.bornOn");
  });

  it("navn må være latinske bokstaver (etter NFKD)", () => {
    expect(codeOf(() => validatePassengers([{ ...adult, givenName: "Ola123" }, child, infant], offer)).field).toBe("passengers.0.givenName");
    expect(codeOf(() => validatePassengers([{ ...adult, familyName: "<script>" }, child, infant], offer)).field).toBe("passengers.0.familyName");
    // Aksenter er ok
    expect(() => validatePassengers([{ ...adult, givenName: "Zoë-Ann" }, child, infant], offer)).not.toThrow();
  });

  it("tittel og kjønn kreves for voksne/barn, ikke baby", () => {
    expect(codeOf(() => validatePassengers([{ ...adult, title: undefined }, child, infant], offer)).field).toBe("passengers.0.title");
    expect(codeOf(() => validatePassengers([adult, { ...child, gender: undefined }, infant], offer)).field).toBe("passengers.1.gender");
  });

  it("baby må knyttes til nøyaktig én distinkt voksen", () => {
    expect(codeOf(() => validatePassengers([adult, child, { ...infant, infantPassengerId: undefined }], offer)).code).toBe("INFANT_LINK");
    expect(codeOf(() => validatePassengers([adult, child, { ...infant, infantPassengerId: "pas_2" }], offer)).code).toBe("INFANT_LINK");
    const twoInfants = {
      ...offer,
      passengers: [...offer.passengers, { id: "pas_4", type: "infant_without_seat" as const, age: 1 }],
    };
    expect(
      codeOf(() => validatePassengers([adult, child, infant, { ...infant, id: "pas_4", givenName: "Lise" }], twoInfants)).code,
    ).toBe("INFANT_LINK");
  });

  it("krever pass når tilbudet krever ID, og passet må gjelde til siste ankomst", () => {
    const strict = { ...offer, identityDocumentsRequired: true };
    expect(codeOf(() => validatePassengers([adult, child, infant], strict)).code).toBe("IDENTITY_DOCUMENT_REQUIRED");
    const withDoc = (expiresOn: string, country = "NO"): PassengerDetails[] =>
      [adult, child, infant].map((p) => ({
        ...p,
        identityDocument: { type: "passport", uniqueIdentifier: "ab 123456", issuingCountryCode: country, expiresOn },
      }));
    expect(codeOf(() => validatePassengers(withDoc("2026-12-09"), strict)).field).toBe("passengers.0.identityDocument.expiresOn");
    expect(codeOf(() => validatePassengers(withDoc("2030-01-01", "NOR"), strict)).field).toBe("passengers.0.identityDocument.issuingCountryCode");
    const ok = validatePassengers(withDoc("2026-12-10"), strict);
    expect(ok.passengers[0].identityDocument?.uniqueIdentifier).toBe("AB123456");
  });

  it("kontakttelefon må være E.164", () => {
    expect(codeOf(() => validatePassengers([adult, child, infant], offer, { phone: "123" })).field).toBe("contact.phone");
  });
});
