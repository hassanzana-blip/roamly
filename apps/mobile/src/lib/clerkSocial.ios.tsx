import { useEffect } from "react";
import { ClerkProvider, useClerk, useSSO } from "@clerk/expo";
import { useSignInWithApple } from "@clerk/expo/apple";
import type { NativeSocialResult } from "./socialAuth";
import { registerSsoRunner } from "./clerkBridge";
import { SSO_REDIRECT_URL } from "./socialAuth";

/**
 * Clerk-verten: ClerkProvider med den publiserbare nøkkelen fra
 * mobileAuth.providers, og en usynlig bro som kjører Google- eller Apple-flyten.
 *
 * - Ingen tokenCache: Clerks klient-JWT holdes bare i minnet og lagres aldri.
 * - Ingen native Clerk-komponenter; synkronisering med Clerks native klient er av.
 * - Etter flyten hentes et kortlivet sesjonstoken (getToken) som serveren
 *   verifiserer i exchangeSocialToken; deretter logges Clerk-økten ut (release).
 */
type Created = { createdSessionId: string | null; setActive?: (p: { session: string }) => Promise<void> };

function Bridge() {
  const { startSSOFlow } = useSSO();
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const clerk = useClerk();
  useEffect(() => {
    /** Aktiver Clerk-økten og hent tokenet serveren skal verifisere. */
    const activate = async (res: Created): Promise<NativeSocialResult> => {
      await res.setActive!({ session: res.createdSessionId! });
      const token = await clerk.session?.getToken();
      if (!token) throw new Error("clerk_token_missing");
      return {
        kind: "token",
        token,
        release: async () => {
          await clerk.signOut().catch(() => undefined);
        },
      };
    };
    return registerSsoRunner(async (provider) => {
      if (provider === "apple") {
        // Clerks hook gir også «ingen økt» når Clerk ikke er lastet – det er ikke et avbrudd.
        if (!clerk.loaded) throw new Error("clerk_not_ready");
        const res = await startAppleAuthenticationFlow();
        if (!res.createdSessionId || !res.setActive) {
          // Apple-arket lukket (ERR_REQUEST_CANCELED) → avbrutt. En ufullstendig registrering hos Clerk er en feil.
          if (res.signUp?.status === "missing_requirements") throw new Error("apple_incomplete");
          return { kind: "cancelled" };
        }
        return activate(res as Created);
      }
      const res = await startSSOFlow({ strategy: "oauth_google", redirectUrl: SSO_REDIRECT_URL });
      const type = res.authSessionResult?.type;
      if (!res.createdSessionId || !res.setActive) {
        // Kunden lukket nettleservinduet eller avbrøt: ingenting er laget.
        if (!type || type === "cancel" || type === "dismiss") return { kind: "cancelled" };
        // Clerk ville ha mer (f.eks. en ufullstendig registrering) – ikke noe appen kan fullføre her.
        throw new Error(`sso_incomplete:${type}`);
      }
      return activate(res as Created);
    });
  }, [startSSOFlow, startAppleAuthenticationFlow, clerk]);
  return null;
}

export function ClerkSocialHost({ publishableKey }: { publishableKey: string }) {
  return (
    <ClerkProvider publishableKey={publishableKey} __experimental_disableNativeClientSync>
      <Bridge />
    </ClerkProvider>
  );
}
