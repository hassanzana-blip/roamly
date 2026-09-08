import type { ComponentType } from "react";
import { trpc } from "@/providers/trpc";
import { Mail } from "lucide-react";
import { AppleMark, FacebookMark, GoogleMark, XMark } from "@/components/account/ProviderIcons";

/**
 * Innloggingsmetoder – ett register, én sannhet.
 *
 * /logg-inn leser herfra: metoder med `enabled: true` rendres, resten nevnes i
 * én rolig linje («Snart: Apple, Google og Facebook»). Aldri en død eller
 * deaktivert knapp. Når en OAuth-leverandør skrus på i backend, settes
 * `enabled: true` her – knappen kommer av seg selv og peker på `startPath`.
 */
export type AuthProviderId = "email" | "apple" | "google" | "facebook" | "x";

export type AuthProvider = {
  id: AuthProviderId;
  /** Visningsnavn slik det står i knapper og i «Snart:»-linjen. */
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** `form`: håndteres av selve siden (e-post/telefon + passord). `oauth`: send til `startPath`. */
  kind: "form" | "oauth";
  /** Startadresse for OAuth-flyten – brukes først når leverandøren er skrudd på. */
  startPath?: string;
};

/**
 * Registeret holder navn, merke og startadresse. Om en leverandør faktisk er
 * skrudd på, vet bare serveren – den leser miljøet. Derfor er `enabled` borte
 * herfra: `useAuthProviders()` slår sammen dette registeret med svaret fra
 * `customerAuth.authProviders`.
 */
export const AUTH_PROVIDERS: readonly AuthProvider[] = [
  { id: "email", label: "E-post", icon: Mail, kind: "form" },
  { id: "apple", label: "Apple", icon: AppleMark, kind: "oauth", startPath: "/api/auth/apple/start" },
  { id: "google", label: "Google", icon: GoogleMark, kind: "oauth", startPath: "/api/auth/google/start" },
  { id: "facebook", label: "Facebook", icon: FacebookMark, kind: "oauth", startPath: "/api/auth/facebook/start" },
  { id: "x", label: "X", icon: XMark, kind: "oauth", startPath: "/api/auth/x/start" },
];

/**
 * Innloggingsmetodene slik de faktisk står i dette miljøet.
 *
 * E-post er alltid på. OAuth-leverandører er på når serveren sier at både
 * klient-id og hemmelighet er satt. Er svaret ikke kommet ennå, viser vi
 * ingen OAuth-knapper – heller ingen knapp enn en som ikke virker.
 */
export function useAuthProviders(): { oauth: AuthProvider[]; upcoming: AuthProvider[]; passkeys: boolean } {
  const q = trpc.customerAuth.authProviders.useQuery(undefined, { staleTime: 600_000, retry: false });
  const on = new Set<string>(q.data?.oauth ?? []);
  const oauth = AUTH_PROVIDERS.filter((p) => p.kind === "oauth" && on.has(p.id));
  const upcoming = AUTH_PROVIDERS.filter((p) => p.kind === "oauth" && !on.has(p.id));
  return { oauth, upcoming, passkeys: q.data?.passkeys ?? false };
}
