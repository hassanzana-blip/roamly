import type { PassengerDetails, PassengerType, Title, Gender } from "@contracts/types";
import { paxLabel } from "@/lib/format";
import type { useT } from "@/lib/i18n";

/**
 * Passasjer-hjelpere delt mellom Checkout (/bestill) og tilbudslenken (/tilbud).
 * Validering speiler api/lib/validation.ts. Passnummer lagres aldri i utkast.
 */

export type PaxForm = {
  title?: Title;
  gender?: Gender;
  givenName: string;
  familyName: string;
  bornOn: string;
  infantPassengerId?: string;
  passportNumber: string;
  passportCountry: string;
  passportExpiry: string;
};

export type PaxSlot = { id: string; type: PassengerType; age?: number | null };

export type T = ReturnType<typeof useT>;

export const emptyPax = (): PaxForm => ({ givenName: "", familyName: "", bornOn: "", passportNumber: "", passportCountry: "NO", passportExpiry: "" });

// ─── Hjelpere (speiler api/lib/validation.ts) ───────────────────────────────

export const NAME_RE = /^[A-Za-zÀ-ÿ' -]{1,60}$/;
export const normalizeName = (raw: string) => raw.normalize("NFKD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim();

export function normalizePhone(raw: string): string | null {
  let s = String(raw ?? "").replace(/[\s\-().]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (/^\d{8}$/.test(s)) s = `+47${s}`;
  if (!/^\+[1-9]\d{6,14}$/.test(s)) return null;
  return s;
}

export function ageOn(bornOn: string, atIso: string): number {
  const born = new Date(`${bornOn}T00:00:00Z`);
  const at = new Date(atIso);
  if (Number.isNaN(born.getTime()) || Number.isNaN(at.getTime())) return NaN;
  let age = at.getUTCFullYear() - born.getUTCFullYear();
  const m = at.getUTCMonth() - born.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < born.getUTCDate())) age -= 1;
  return age;
}

export const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());

export type PassengerContext = {
  passengers: PaxSlot[];
  /** ISO for siste avgang (aldersgrenser). */
  lastDeparture: string;
  /** YYYY-MM-DD for siste ankomst (passgyldighet). */
  lastArrival: string;
  identityDocumentsRequired: boolean;
};

/** Feil per felt, nøkkel `passengers.<i>.<felt>` (samme som serveren). */
export function validatePassengers(ctx: PassengerContext, pax: Record<string, PaxForm>, t: T): Record<string, string> {
  const e: Record<string, string> = {};
  const adults = ctx.passengers.filter((p) => p.type === "adult");
  const usedAdults = new Set<string>();
  ctx.passengers.forEach((p, i) => {
    const d = pax[p.id] ?? emptyPax();
    const k = (f: string) => `passengers.${i}.${f}`;
    if (!NAME_RE.test(normalizeName(d.givenName))) e[k("givenName")] = t("co.v.given");
    if (!NAME_RE.test(normalizeName(d.familyName))) e[k("familyName")] = t("co.v.family");
    if (!d.bornOn || !isValidDate(d.bornOn)) e[k("bornOn")] = t("co.v.born");
    else {
      const age = ageOn(d.bornOn, ctx.lastDeparture);
      if (!Number.isFinite(age) || age < 0 || age > 120) e[k("bornOn")] = t("co.v.bornbad");
      else if (p.type === "adult" && age < 12) e[k("bornOn")] = t("co.v.adultage");
      else if (p.type === "child" && (age < 2 || age > 11)) e[k("bornOn")] = t("co.v.childage");
      else if (p.type === "infant_without_seat" && age >= 2) e[k("bornOn")] = t("co.v.infantage");
      else if (p.age != null && p.type !== "adult" && Math.abs(p.age - age) > 1) e[k("bornOn")] = t("co.v.agemismatch");
    }
    if (p.type !== "infant_without_seat") {
      if (!d.title) e[k("title")] = t("co.v.title");
      if (!d.gender) e[k("gender")] = t("co.v.gender");
    } else {
      if (!d.infantPassengerId || !adults.some((a) => a.id === d.infantPassengerId)) e[k("infantPassengerId")] = t("co.v.guardian");
      else if (usedAdults.has(d.infantPassengerId)) e[k("infantPassengerId")] = t("co.v.guardiandup");
      else usedAdults.add(d.infantPassengerId);
    }
    if (ctx.identityDocumentsRequired) {
      const num = d.passportNumber.replace(/\s/g, "").toUpperCase();
      if (!/^[A-Z0-9]{5,20}$/.test(num)) e[k("identityDocument.uniqueIdentifier")] = t("co.v.passport");
      if (!/^[A-Z]{2}$/.test(d.passportCountry)) e[k("identityDocument.issuingCountryCode")] = t("co.v.country");
      if (!isValidDate(d.passportExpiry)) e[k("identityDocument.expiresOn")] = t("co.v.expiry");
      else if (d.passportExpiry < ctx.lastArrival) e[k("identityDocument.expiresOn")] = t("co.v.expiryshort");
    }
  });
  if (adults.length === 0) e.passengers = t("co.v.noadult");
  return e;
}

/** Skjema → PassengerDetails slik serveren forventer dem. */
export function buildPassengerDetails(ctx: PassengerContext, pax: Record<string, PaxForm>): PassengerDetails[] {
  return ctx.passengers.map((p) => {
    const d = pax[p.id] ?? emptyPax();
    const base: PassengerDetails = {
      id: p.id,
      type: p.type,
      givenName: normalizeName(d.givenName),
      familyName: normalizeName(d.familyName),
      bornOn: d.bornOn,
    };
    if (p.type !== "infant_without_seat") {
      base.title = d.title;
      base.gender = d.gender;
    } else base.infantPassengerId = d.infantPassengerId;
    if (ctx.identityDocumentsRequired) {
      base.identityDocument = {
        type: "passport",
        uniqueIdentifier: d.passportNumber.replace(/\s/g, "").toUpperCase(),
        issuingCountryCode: d.passportCountry.toUpperCase(),
        expiresOn: d.passportExpiry,
      };
    }
    return base;
  });
}

/** «Voksen 1», «Barn 2», «Baby 1 (reiser i fanget)» */
export function passengerLabel(p: PaxSlot, all: PaxSlot[], t: T): string {
  const n = all.filter((x) => x.type === p.type).indexOf(p) + 1;
  return `${paxLabel(p.type)} ${n}${p.type === "infant_without_seat" ? ` ${t("co.pax.infantlap")}` : ""}`;
}


// ─── Felles klassenavn for feltene ──────────────────────────────────────────

export const inputCls =
  "flex min-h-11 w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-base outline-none transition-[border-color,box-shadow] hover:border-foreground/40 focus:border-primary focus:ring-2 focus:ring-primary/25 placeholder:text-muted-foreground/70 aria-[invalid=true]:border-destructive";
export const selectCls = inputCls + " appearance-none";
