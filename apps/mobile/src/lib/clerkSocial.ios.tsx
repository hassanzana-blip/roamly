import { useEffect } from "react";
import { ClerkProvider, useClerk, useSSO } from "@clerk/expo";
import { registerSsoRunner } from "./clerkBridge";
import { SSO_REDIRECT_URL } from "./socialAuth";

/**
 * Clerk-verten: ClerkProvider med den publiserbare nøkkelen fra
 * mobileAuth.providers, og en usynlig bro som kjører Google-flyten.
 *
 * - Ingen tokenCache: Clerks klient-JWT holdes bare i minnet og lagres aldri.
 * - Ingen native Clerk-komponenter; synkronisering med Clerks native klient er av.
 * - Etter flyten hentes et kortlivet sesjonstoken (getToken) som serveren
 *   verifiserer i exchangeSocialToken; deretter logges Clerk-økten ut (release).
 */
function Bridge() {
  const { startSSOFlow } = useSSO();
  const clerk = useClerk();
  useEffect(
    () =>
      registerSsoRunner(async () => {
        const res = await startSSOFlow({ strategy: "oauth_google", redirectUrl: SSO_REDIRECT_URL });
        const type = res.authSessionResult?.type;
        if (!res.createdSessionId || !res.setActive) {
          // Kunden lukket nettleservinduet eller avbrøt: ingenting er laget.
          if (!type || type === "cancel" || type === "dismiss") return { kind: "cancelled" };
          // Clerk ville ha mer (f.eks. en ufullstendig registrering) – ikke noe appen kan fullføre her.
          throw new Error(`sso_incomplete:${type}`);
        }
        await res.setActive({ session: res.createdSessionId });
        const token = await clerk.session?.getToken();
        if (!token) throw new Error("clerk_token_missing");
        return {
          kind: "token",
          token,
          release: async () => {
            await clerk.signOut().catch(() => undefined);
          },
        };
      }),
    [startSSOFlow, clerk],
  );
  return null;
}

export function ClerkSocialHost({ publishableKey }: { publishableKey: string }) {
  return (
    <ClerkProvider publishableKey={publishableKey} __experimental_disableNativeClientSync>
      <Bridge />
    </ClerkProvider>
  );
}
