import type { MobileAuthProviders, MobileSocialProvider } from "../../contracts/mobileAuth";

const APP_PROVIDERS: readonly MobileSocialProvider[] = ["google", "apple"];

/**
 * Hvilke sosiale innlogginger appen kan vise. En leverandør er tilgjengelig
 * bare når HelloSky har den i Clerk OG en operatør har bekreftet at appens
 * native flyt virker (MOBILE_CLERK_NATIVE_PROVIDERS). Ellers skjules knappen
 * – en leverandør blir aldri en død knapp. Den hemmelige nøkkelen er aldri med.
 */
export function mobileAuthProviders(clerk: { enabled: boolean; publishableKey: string | null; providers: readonly string[] }, nativeReady: readonly string[]): MobileAuthProviders {
  const social = APP_PROVIDERS.map((provider) => {
    const configured = clerk.enabled && clerk.providers.includes(provider);
    if (!configured) return { provider, available: false, reason: "not_configured" as const };
    if (!nativeReady.includes(provider)) return { provider, available: false, reason: "native_not_ready" as const };
    return { provider, available: true, reason: null };
  });
  const anyAvailable = social.some((s) => s.available);
  return { password: true, social, clerkPublishableKey: anyAvailable ? clerk.publishableKey : null };
}
