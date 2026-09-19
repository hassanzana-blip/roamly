import type { ComponentType } from "react";
import { trpc } from "@/providers/trpc";
import { Mail } from "lucide-react";
import { AppleMark, FacebookMark, GoogleMark, XMark } from "@/components/account/ProviderIcons";

/**
 * Innloggingsmetoder – ett register, én sannhet.
 *
 * /logg-inn leser herfra: metoder serveren sier er satt opp rendres, resten
 * nevnes i én rolig linje («Kommer: Apple, Google og Facebook»). Aldri en død
 * eller deaktivert knapp. Sosiale innlogginger kjøres av Clerk når serveren
 * sender en publiserbar nøkkel; da starter knappen Clerk-flyten i stedet for
 * å peke på `startPath`.
 */
export type AuthProviderId = "email" | "apple" | "google" | "facebook" | "x";

export type AuthProvider = {
  id: AuthProviderId;
  /** Visningsnavn slik det står i knapper og i «Kommer:»-linjen. */
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** `form`: håndteres av selve siden (e-post/telefon + passord). `oauth`: sosial innlogging. */
  kind: "form" | "oauth";
  /** Startadresse for en egen OAuth-flyt på serveren (ikke i bruk når Clerk kjører). */
  startPath?: string;
  /** Clerks strateginavn for leverandøren. */
  clerkStrategy?: `oauth_${string}`;
};

export type ClerkClientConfig = { publishableKey: string; providers: string[] };

export const AUTH_PROVIDERS: readonly AuthProvider[] = [
  { id: "email", label: "E-post", icon: Mail, kind: "form" },
  { id: "apple", label: "Apple", icon: AppleMark, kind: "oauth", startPath: "/api/auth/apple/start", clerkStrategy: "oauth_apple" },
  { id: "google", label: "Google", icon: GoogleMark, kind: "oauth", startPath: "/api/auth/google/start", clerkStrategy: "oauth_google" },
  { id: "facebook", label: "Facebook", icon: FacebookMark, kind: "oauth", startPath: "/api/auth/facebook/start", clerkStrategy: "oauth_facebook" },
  { id: "x", label: "X", icon: XMark, kind: "oauth", startPath: "/api/auth/x/start", clerkStrategy: "oauth_x" },
];

/**
 * Innloggingsmetodene slik de faktisk står i dette miljøet.
 *
 * E-post er alltid på. Sosiale leverandører er på når serveren sier det. Er
 * svaret ikke kommet ennå, viser vi ingen knapper – heller ingen knapp enn en
 * som ikke virker.
 */
export function useAuthProviders(): { oauth: AuthProvider[]; upcoming: AuthProvider[]; clerk: ClerkClientConfig | null; passkeys: boolean; isLoading: boolean } {
  const q = trpc.customerAuth.authProviders.useQuery(undefined, { staleTime: 600_000, retry: false });
  const on = new Set<string>(q.data?.oauth ?? []);
  const oauth = AUTH_PROVIDERS.filter((p) => p.kind === "oauth" && on.has(p.id));
  const upcoming = AUTH_PROVIDERS.filter((p) => p.kind === "oauth" && !on.has(p.id));
  return { oauth, upcoming, clerk: q.data?.clerk ?? null, passkeys: q.data?.passkeys ?? false, isLoading: q.isLoading };
}
