import type { MobileAuthProviders, MobileSocialProvider } from "@contracts/mobileAuth";

/**
 * Sosial innlogging (Google/Apple) i appen.
 *
 * Flyten er: leverandørens native innlogging via Clerk → et Clerk-
 * sesjonstoken → mobileAuth.exchangeSocialToken (serveren verifiserer tokenet
 * og bruker nettets koblingsregler) → HelloSkys egen sesjon i nøkkelringen.
 * Appen lagrer aldri Clerk-tokenet og har ingen hemmelig nøkkel.
 *
 * Den native delen er et adapter (NativeSocialSignIn). Denne builden har
 * ingen Clerk-SDK: Clerks Expo-SDK krever at «Native API» er slått på i Clerk
 * og at appens retur-URL er tillatt – sikkerhetsinnstillinger som ikke er
 * endret. Se lib/nativeSocial.ts.
 */

export type NativeSocialResult = { kind: "token"; token: string } | { kind: "cancelled" };

export interface NativeSocialSignIn {
  /** Kan denne builden faktisk kjøre leverandørens native flyt? */
  supports(provider: MobileSocialProvider): boolean;
  /** Kjører flyten og gir et Clerk-sesjonstoken, eller «avbrutt». Kaster ved feil. */
  signIn(provider: MobileSocialProvider, publishableKey: string): Promise<NativeSocialResult>;
}

/** Leverandørene Profil viser: tilgjengelig på serveren, med nøkkel, OG støttet av denne builden. */
export function visibleSocialProviders(caps: MobileAuthProviders | null, native: NativeSocialSignIn): MobileSocialProvider[] {
  if (!caps?.clerkPublishableKey) return [];
  return caps.social.filter((s) => s.available && native.supports(s.provider)).map((s) => s.provider);
}
