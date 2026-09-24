import type { NativeSocialSignIn } from "./socialAuth";

/**
 * Denne buildens native sosiale innlogging: INGEN.
 *
 * BLOKKERT: Clerks Expo-SDK krever at «Native API» slås på under Native
 * applications i Clerk Dashboard, og at appens retur-URL legges i «Allowlist
 * for mobile SSO redirect». Det er sikkerhetsinnstillinger som ikke er endret.
 * Til da skjuler Profil Google/Apple, uansett hva serveren sier.
 *
 * Når det er gjort (se overleveringen i BACKLOG/rapporten), erstattes dette
 * med et adapter som bruker Clerks Expo-SDK (useSSO for Google, Apple-
 * innlogging for Apple) og returnerer Clerk-sesjonstokenet (getToken()).
 */
export const nativeSocialSignIn: NativeSocialSignIn = {
  supports: () => false,
  signIn: async () => {
    throw new Error("native social sign-in is not available in this build");
  },
};
