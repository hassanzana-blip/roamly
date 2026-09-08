import type { ComponentType } from "react";
import { Mail } from "lucide-react";
import { AppleMark, FacebookMark, GoogleMark } from "@/components/account/ProviderIcons";

/**
 * Innloggingsmetoder – ett register, én sannhet.
 *
 * /logg-inn leser herfra: metoder med `enabled: true` rendres, resten nevnes i
 * én rolig linje («Snart: Apple, Google og Facebook»). Aldri en død eller
 * deaktivert knapp. Når en OAuth-leverandør skrus på i backend, settes
 * `enabled: true` her – knappen kommer av seg selv og peker på `startPath`.
 */
export type AuthProviderId = "email" | "apple" | "google" | "facebook";

export type AuthProvider = {
  id: AuthProviderId;
  /** Visningsnavn slik det står i knapper og i «Snart:»-linjen. */
  label: string;
  icon: ComponentType<{ className?: string }>;
  enabled: boolean;
  /** `form`: håndteres av selve siden (e-post/telefon + passord). `oauth`: send til `startPath`. */
  kind: "form" | "oauth";
  /** Startadresse for OAuth-flyten – brukes først når leverandøren er skrudd på. */
  startPath?: string;
};

export const AUTH_PROVIDERS: readonly AuthProvider[] = [
  { id: "email", label: "E-post", icon: Mail, enabled: true, kind: "form" },
  { id: "apple", label: "Apple", icon: AppleMark, enabled: false, kind: "oauth", startPath: "/api/auth/apple/start" },
  { id: "google", label: "Google", icon: GoogleMark, enabled: false, kind: "oauth", startPath: "/api/auth/google/start" },
  { id: "facebook", label: "Facebook", icon: FacebookMark, enabled: false, kind: "oauth", startPath: "/api/auth/facebook/start" },
];

/** Alle aktive metoder, i rekkefølgen de skal vises. */
export function enabledAuthProviders(): AuthProvider[] {
  return AUTH_PROVIDERS.filter((p) => p.enabled);
}

/** Aktive metoder som skal være knapper (OAuth). E-post er skjemaet på siden. */
export function oauthAuthProviders(): AuthProvider[] {
  return AUTH_PROVIDERS.filter((p) => p.enabled && p.kind === "oauth");
}

/** Metoder som ikke er skrudd på ennå – nevnes, aldri som knapp. */
export function upcomingAuthProviders(): AuthProvider[] {
  return AUTH_PROVIDERS.filter((p) => !p.enabled);
}

export function isAuthProviderEnabled(id: AuthProviderId): boolean {
  return AUTH_PROVIDERS.some((p) => p.id === id && p.enabled);
}
