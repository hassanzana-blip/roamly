import type { CustomerProfile } from "@contracts/mobileAuth";

/**
 * Fornavnet serveren gir en konto som opprettes med Google eller Apple når leverandøren ikke oppga noe navn
 * (api/customerAuth.ts, mobileAuth.exchangeSocialToken: `firstName: … || "Reisende"`). Det er en plassholder, ikke
 * kundens navn – på engelsk ville appen ellers sagt «Hi, Reisende». Appen hilser aldri med den og lager ingen
 * initialer av den.
 */
export const NAMELESS_FIRST_NAME = "Reisende";

/**
 * Fornavnet appen kan hilse med, eller null når kontoen ikke har et ekte fornavn: tomt, bare mellomrom eller
 * serverens plassholder. Da sier appen «Du er logget inn» (Min side) eller stiller spørsmålet (Hjem) i stedet.
 */
export function greetingName(profile: Pick<CustomerProfile, "firstName"> | null | undefined): string | null {
  const name = (profile?.firstName ?? "").trim();
  return name && name !== NAMELESS_FIRST_NAME ? name : null;
}
