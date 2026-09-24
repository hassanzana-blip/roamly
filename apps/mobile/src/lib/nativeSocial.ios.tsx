import type { ComponentType } from "react";
import type { NativeSocialSignIn } from "./socialAuth";
import { waitForSsoRunner } from "./clerkBridge";

/**
 * Sosial innlogging på iPhone via Clerks Expo-SDK (@clerk/expo).
 *
 * Google: Clerks nettleserbaserte flyt (useSSO, «oauth_google») i
 * ASWebAuthenticationSession, med retur til SSO_REDIRECT_URL.
 *
 * Apple: IKKE i denne builden. Clerks Apple-flyt på iOS bruker Apples native
 * innlogging (expo-apple-authentication), som krever «Sign in with Apple»-
 * rettigheten i app.json (ios.usesAppleSignIn) og i Apple Developer, og Apple
 * satt opp som leverandør i Clerk. Ingen av delene finnes; app.json eies ikke
 * av denne endringen. supports("apple") er derfor false.
 *
 * Clerk-koden (lib/clerkSocial.ios.tsx) lastes først når Host monteres – det
 * skjer bare når mobileAuth.providers har gitt en publiserbar nøkkel. Et
 * gjestesøk laster eller kontakter aldri Clerk.
 */
function Host({ publishableKey }: { publishableKey: string }) {
  // Lat innlasting: Clerk-modulen evalueres først her (Metro kjører modulen ved første require).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ClerkSocialHost } = require("./clerkSocial.ios") as { ClerkSocialHost: ComponentType<{ publishableKey: string }> };
  return <ClerkSocialHost publishableKey={publishableKey} />;
}

export const nativeSocialSignIn: NativeSocialSignIn = {
  supports: (provider) => provider === "google",
  signIn: async (provider) => {
    if (provider !== "google") throw new Error(`social provider ${provider} is not supported in this build`);
    const run = await waitForSsoRunner();
    return run(provider);
  },
  Host,
};
