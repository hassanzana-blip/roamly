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
/** Apples egen avbruddskode (expo-apple-authentication), slik den kommer når kunden lukker arket. */
function isAppleCancel(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "ERR_REQUEST_CANCELED";
}

type Created = { createdSessionId: string | null; setActive?: (p: { session: string }) => Promise<void> };

function Bridge() {
  const { startSSOFlow } = useSSO();
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const clerk = useClerk();
  useEffect(() => {
    /** Aktiver Clerk-økten og hent tokenet serveren skal verifisere. */
    const activate = async (res: Created): Promise<NativeSocialResult> => {
      const release = async () => {
        await clerk.signOut().catch(() => undefined);
      };
      await res.setActive!({ session: res.createdSessionId! });
      // Clerk-økten er nå aktiv. Feiler tokenet, avsluttes økten før feilen går videre –
      // ellers ville en halvferdig Clerk-innlogging bli liggende i minnet.
      let token: string | null | undefined;
      try {
        token = await clerk.session?.getToken();
      } catch (err) {
        await release();
        throw err;
      }
      if (!token) {
        await release();
        throw new Error("clerk_token_missing");
      }
      return { kind: "token", token, release };
    };
    return registerSsoRunner(async (provider) => {
      if (provider === "apple") {
        // Clerks hook gir også «ingen økt» når Clerk ikke er lastet – det er ikke et avbrudd.
        if (!clerk.loaded) throw new Error("clerk_not_ready");
        let res: Awaited<ReturnType<typeof startAppleAuthenticationFlow>>;
        try {
          res = await startAppleAuthenticationFlow();
        } catch (err) {
          // Kunden trykket Avbryt i Apple-arket: Apple avviser med ERR_REQUEST_CANCELED (som i Clerks
          // eget Expo-eksempel). Bare akkurat den koden er et avbrudd; alt annet er en feil.
          if (isAppleCancel(err)) return { kind: "cancelled" };
          throw err;
        }
        if (!res.createdSessionId || !res.setActive) {
          // Clerks hook (4.6.9) fanger selv ERR_REQUEST_CANCELED og svarer tomt → avbrutt. En ufullstendig registrering hos Clerk er en feil.
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
