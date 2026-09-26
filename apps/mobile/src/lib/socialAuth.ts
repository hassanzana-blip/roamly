import type { ComponentType } from "react";
import type { MobileAuthProviders, MobileSocialProvider } from "@contracts/mobileAuth";

/**
 * Sosial innlogging (Google/Apple) i appen.
 *
 * Flyten er: leverandørens innlogging via Clerk → et Clerk-sesjonstoken →
 * mobileAuth.exchangeSocialToken (serveren verifiserer tokenet og bruker
 * nettets koblingsregler) → HelloSkys egen sesjon i nøkkelringen. Appen
 * lagrer aldri Clerk-tokenet og har ingen hemmelig nøkkel; Clerk-økten
 * avsluttes (release) etter byttet.
 *
 * Den native delen er et adapter (NativeSocialSignIn): lib/nativeSocial.ios.tsx
 * på iPhone (Google via Clerk, Apple ikke ennå), lib/nativeSocial.ts ellers.
 */

/**
 * Den ene retur-URL-en Clerk sender kunden tilbake til etter Google-
 * innloggingen: appens eget skjema («hellosky» i app.json) + «sso-callback».
 * Nøyaktig denne verdien må stå i Clerks «Allowlist for mobile SSO redirect».
 */
export const SSO_REDIRECT_URL = "hellosky://sso-callback";

export type NativeSocialResult =
  /** `release`: avslutter Clerk-økten når HelloSky-sesjonen er laget (eller byttet feilet). */
  | { kind: "token"; token: string; release?: () => Promise<void> }
  | { kind: "cancelled" };

export interface NativeSocialSignIn {
  /** Kan denne builden faktisk kjøre leverandørens native flyt? */
  supports(provider: MobileSocialProvider): boolean;
  /** Kjører flyten og gir et Clerk-sesjonstoken, eller «avbrutt». Kaster ved feil. */
  signIn(provider: MobileSocialProvider, publishableKey: string): Promise<NativeSocialResult>;
  /**
   * Usynlig komponent som må være montert for at signIn skal virke (Clerks
   * provider og hooks). Monteres bare når serveren har gitt en publiserbar
   * nøkkel – ellers lastes og kontaktes Clerk aldri.
   */
  Host?: ComponentType<{ publishableKey: string }>;
}

/** Leverandørene Profil viser: tilgjengelig på serveren, med nøkkel, OG støttet av denne builden. */
export function visibleSocialProviders(caps: MobileAuthProviders | null, native: NativeSocialSignIn): MobileSocialProvider[] {
  if (!caps?.clerkPublishableKey) return [];
  return caps.social.filter((s) => s.available && native.supports(s.provider)).map((s) => s.provider);
}
