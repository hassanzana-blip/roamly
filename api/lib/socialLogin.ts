import { createClerkClient, verifyToken } from "@clerk/backend";
import { clerkConfig, type ClerkSocial } from "./env";
import { AppError } from "./errors";
import { log } from "./logger";

/**
 * Sosial innlogging: Clerk kjører OAuth mot Apple/Google/Facebook og gir
 * nettleseren et kortlevd sesjonstoken. Her verifiseres tokenet (signatur mot
 * Clerks JWKS, utløp, utsteder) og brukeren slås opp hos Clerk – vi stoler
 * aldri på e-post eller navn fra klienten.
 */

export interface SocialIdentity {
  /** Stabil Clerk-bruker-id (`user_…`). */
  subject: string;
  /** Primær e-post hos Clerk – null når leverandøren ikke ga noen (Facebook uten e-post). */
  email: string | null;
  /** Om Clerk/leverandøren har verifisert e-posten. Apple «Hide my email»-adresser er verifiserte. */
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  /** Leverandøren bak innloggingen, f.eks. «google» – til visning i Sikkerhet. */
  social: ClerkSocial | null;
}

function socialOf(provider: string | undefined): ClerkSocial | null {
  const p = (provider ?? "").replace(/^oauth_/, "").toLowerCase();
  return p === "apple" || p === "google" || p === "facebook" || p === "x" ? p : null;
}

export async function verifySocialToken(token: string): Promise<SocialIdentity> {
  const cfg = clerkConfig();
  if (!cfg.enabled || !cfg.secretKey) throw new AppError("VALIDATION", { message: "Sosial innlogging er ikke satt opp." });
  // Formen er dokumentert i @clerk/backend/dist/jwt/types.d.ts ({data} | {errors}); typene løses ikke opp under vår moduleResolution.
  const verified = (await verifyToken(token, { secretKey: cfg.secretKey, clockSkewInMs: 30_000 })) as unknown as
    | { data?: { sub?: string }; errors?: { reason?: string; message?: string }[]; sub?: string };
  if (verified.errors?.length) {
    log.warn({ reason: verified.errors[0]?.reason }, "sosial innlogging: token avvist");
    throw new AppError("UNAUTHORIZED", { message: "Innloggingen kunne ikke bekreftes. Prøv igjen." });
  }
  const subject = verified.data?.sub ?? verified.sub;
  if (!subject) throw new AppError("UNAUTHORIZED", { message: "Innloggingen kunne ikke bekreftes. Prøv igjen." });
  const clerk = createClerkClient({ secretKey: cfg.secretKey });
  const user = await clerk.users.getUser(subject);
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ?? user.emailAddresses[0] ?? null;
  const external = user.externalAccounts.find((a) => a.verification?.status === "verified") ?? user.externalAccounts[0];
  return {
    subject: user.id,
    email: primary ? primary.emailAddress.toLowerCase().trim() : null,
    emailVerified: primary?.verification?.status === "verified",
    firstName: user.firstName,
    lastName: user.lastName,
    social: socialOf(external?.provider),
  };
}

/** Kontoer opprettet via sosial innlogging har ikke noe passord. Verdien kan aldri verifiseres av Argon2. */
export const NO_PASSWORD_HASH = "!social";

export function hasPassword(passwordHash: string): boolean {
  return !passwordHash.startsWith("!");
}

export type LinkDecision =
  | { action: "login"; customerId: number }
  | { action: "link"; customerId: number }
  | { action: "create" }
  | { action: "conflict"; reason: "other_account" | "unverified_email" };

/**
 * Hvem tilhører denne identiteten?
 *
 * 1. Kjent identitet → logg inn på kontoen den peker på. Er kunden allerede
 *    innlogget på en *annen* konto, er det en konflikt – vi flytter aldri en
 *    identitet stille.
 * 2. Innlogget kunde uten kjent identitet → koble til den innloggede kontoen
 *    (kunden har bevist eierskap med HelloSky-sesjonen sin).
 * 3. Ukjent identitet med *verifisert* e-post som matcher en konto → koble.
 *    Matcher e-posten en konto men er ikke verifisert hos leverandøren, nekter
 *    vi: en uverifisert e-post er ikke bevis på eierskap.
 * 4. Ellers: ny konto.
 */
export function decideLink(input: {
  existingIdentityCustomerId: number | null;
  currentCustomerId: number | null;
  emailMatchCustomerId: number | null;
  emailVerified: boolean;
}): LinkDecision {
  const { existingIdentityCustomerId, currentCustomerId, emailMatchCustomerId, emailVerified } = input;
  if (existingIdentityCustomerId != null) {
    if (currentCustomerId != null && currentCustomerId !== existingIdentityCustomerId) return { action: "conflict", reason: "other_account" };
    return { action: "login", customerId: existingIdentityCustomerId };
  }
  if (currentCustomerId != null) return { action: "link", customerId: currentCustomerId };
  if (emailMatchCustomerId != null) {
    return emailVerified ? { action: "link", customerId: emailMatchCustomerId } : { action: "conflict", reason: "unverified_email" };
  }
  return { action: "create" };
}
