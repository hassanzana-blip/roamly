import type { ComponentType } from "react";
import type { MobileSocialProvider } from "@contracts/mobileAuth";
import type { NativeSocialSignIn } from "./socialAuth";
import { waitForSsoRunner } from "./clerkBridge";
import { appleBuildReady } from "./appleSupport";

/**
 * Sosial innlogging på iPhone via Clerks Expo-SDK (@clerk/expo).
 *
 * Google: Clerks nettleserbaserte flyt (useSSO, «oauth_google») i
 * ASWebAuthenticationSession, med retur til SSO_REDIRECT_URL.
 *
 * Apple: Clerks useSignInWithApple (@clerk/expo/apple) – Apples egen
 * innlogging via expo-apple-authentication, identitetstokenet byttes hos Clerk
 * («oauth_token_apple»). Bruker ingen native Clerk-modul, så den virker med
 * @clerk/expo utelatt fra autolinking og iOS 16.4. Støttes bare når builden
 * faktisk kan (lib/appleSupport.ts); med dagens app.json kan den det, og knappen vises når serveren sier at Apple er klar.
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

/** For tester: samme adapter med en annen sjekk av Apple-støtten. */
export function createNativeSocial(appleReady: () => boolean = appleBuildReady): NativeSocialSignIn {
  const supports = (provider: MobileSocialProvider) => provider === "google" || (provider === "apple" && appleReady());
  return {
    supports,
    signIn: async (provider) => {
      if (!supports(provider)) throw new Error(`social provider ${provider} is not supported in this build`);
      const run = await waitForSsoRunner();
      return run(provider);
    },
    Host,
  };
}

export const nativeSocialSignIn: NativeSocialSignIn = createNativeSocial();
