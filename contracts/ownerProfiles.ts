/**
 * Eierprofiler: Zana og Zyar.
 *
 * Én innlogging, to identiteter. Det er bevisst ikke to kontoer: eierne deler
 * tilgangen, og to kontoer ville betydd to sett passord, to MFA-oppsett og to
 * steder å glemme å fjerne tilgang. Det de trenger er å vite hvem som gjorde
 * hva – og det løses av en profil på økten, ikke av en ny bruker.
 *
 * Profilen er ikke et sikkerhetslag. Den gir ingen ekstra tilgang og tar
 * ingen bort; rollen på kontoen bestemmer fortsatt alt. Den svarer bare på
 * spørsmålet «hvem av oss?» i revisjonsloggen.
 */

export const OWNER_PROFILES = [
  { id: "zana", name: "Zana", title: "Eier" },
  { id: "zyar", name: "Zyar", title: "Eier" },
] as const;

export type OwnerProfileId = (typeof OWNER_PROFILES)[number]["id"];
export type OwnerProfile = (typeof OWNER_PROFILES)[number];

const BY_ID = new Map(OWNER_PROFILES.map((p) => [p.id, p]));

export function isOwnerProfileId(value: unknown): value is OwnerProfileId {
  return typeof value === "string" && BY_ID.has(value as OwnerProfileId);
}

export function ownerProfile(id: string | null | undefined): OwnerProfile | null {
  return id && BY_ID.has(id as OwnerProfileId) ? BY_ID.get(id as OwnerProfileId)! : null;
}

/** «Zana» – navnet vi skriver i revisjonsloggen. Null når ingen profil er valgt. */
export function profileLabel(id: string | null | undefined): string | null {
  return ownerProfile(id)?.name ?? null;
}
