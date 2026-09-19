import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { AuthenticateWithRedirectCallback, ClerkProvider, useAuth, useClerk } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { humanMessage } from "@/lib/apiError";
import { useLocale, useT } from "@/lib/i18n";
import type { AuthProvider, ClerkClientConfig } from "@/lib/authProviders";
import { safeNextPath } from "@/lib/nextPath";

/**
 * Sosial innlogging via Clerk – hele modulen lastes lat, og bare når serveren
 * har sendt en publiserbar nøkkel. Clerk kjører OAuth-flyten (state, nonce,
 * PKCE og leverandørens callback); vi bytter Clerks token mot HelloSkys egen
 * sesjon på serveren (customerAuth.exchangeSocialToken). Nøkler: kun den
 * publiserbare finnes i nettleseren – den er laget for det.
 */

const CALLBACK_PATH = "/logg-inn/sso-callback";
const COMPLETE_PATH = "/logg-inn/sso-fullfor";

function completeUrl(next: string): string {
  return `${window.location.origin}${COMPLETE_PATH}?next=${encodeURIComponent(next)}`;
}

/** Clerk med react-routers navigasjon, så Clerks egne redirects ikke laster hele siden. */
export function ClerkRoot({ config, children }: { config: ClerkClientConfig; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <ClerkProvider
      publishableKey={config.publishableKey}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      afterSignOutUrl="/"
      signInUrl="/logg-inn"
      signUpUrl="/logg-inn?modus=registrer"
    >
      {children}
    </ClerkProvider>
  );
}

function StartButtons({ providers, next }: { providers: AuthProvider[]; next: string }) {
  const t = useT();
  const clerk = useClerk();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (p: AuthProvider) => {
    if (!p.clerkStrategy) return;
    setBusy(p.id);
    setError(null);
    try {
      // En gammel Clerk-sesjon i denne nettleseren skal ikke bestemme hvem som
      // logges inn nå – HelloSky-sesjonen er sannheten, Clerk er bare megleren.
      if (clerk.session) await clerk.signOut({ redirectUrl: window.location.href });
      const signIn = clerk.client?.signIn;
      if (!signIn) throw new Error("Clerk er ikke klar");
      await signIn.authenticateWithRedirect({
        strategy: p.clerkStrategy as "oauth_google",
        redirectUrl: `${window.location.origin}${CALLBACK_PATH}`,
        redirectUrlComplete: completeUrl(next),
      });
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error && e.message ? e.message : t("au.sso.error"));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {providers.map((p) => {
        const ProviderMark = p.icon;
        return (
          <Button key={p.id} type="button" variant="outline" size="lg" className="w-full" disabled={busy !== null} loading={busy === p.id} onClick={() => void start(p)}>
            <ProviderMark className="size-[18px]" />
            {t("au.providers.continue", { name: p.label })}
          </Button>
        );
      })}
      {error && <p role="alert" className="text-center text-[13px] text-destructive">{error}</p>}
    </div>
  );
}

/** Knappene på /logg-inn og i Sikkerhet. `next` er stien kunden skal tilbake til. */
export default function ClerkSocialButtons({ config, providers, next }: { config: ClerkClientConfig; providers: AuthProvider[]; next: string }) {
  return (
    <ClerkRoot config={config}>
      <StartButtons providers={providers} next={next} />
    </ClerkRoot>
  );
}

/** Steg 1 etter leverandøren: Clerk fullfører sin del og sender videre til steg 2. */
export function ClerkSsoCallback({ config, next }: { config: ClerkClientConfig; next: string }) {
  const t = useT();
  const complete = `${COMPLETE_PATH}?next=${encodeURIComponent(next)}`;
  return (
    <ClerkRoot config={config}>
      <AuthenticateWithRedirectCallback signInFallbackRedirectUrl={complete} signUpFallbackRedirectUrl={complete} continueSignUpUrl={complete} />
      <p role="status" className="mt-8 text-center text-[15px] text-muted-foreground">{t("au.sso.completing")}</p>
    </ClerkRoot>
  );
}

function Complete({ next }: { next: string }) {
  const t = useT();
  const navigate = useNavigate();
  const { lang } = useLocale();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const utils = trpc.useUtils();
  const started = useRef(false);
  const [state, setState] = useState<"working" | "cancelled" | "error">("working");
  const [message, setMessage] = useState<string | null>(null);
  const exchange = trpc.customerAuth.exchangeSocialToken.useMutation();

  useEffect(() => {
    if (!isLoaded || started.current) return;
    if (!isSignedIn) {
      // Leverandøren avbrøt, eller Clerk-instansen krever felt vi ikke samler inn. Ingen sesjon, ingen innlogging.
      const timer = setTimeout(() => setState("cancelled"), 1500);
      return () => clearTimeout(timer);
    }
    started.current = true;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error(t("au.sso.error"));
        const res = await exchange.mutateAsync({ token, locale: lang });
        await utils.customerAuth.me.invalidate();
        navigate(res.created ? "/velkommen" : next, { replace: true });
      } catch (e) {
        setState("error");
        setMessage(humanMessage(e));
      }
    })();
  }, [isLoaded, isSignedIn, getToken, exchange, utils, navigate, next, lang, t]);

  if (state === "working") return <p role="status" className="mt-8 text-center text-[15px] text-muted-foreground">{t("au.sso.completing")}</p>;
  return (
    <div className="mt-8 text-center" role="alert">
      <p className="text-[17px] font-semibold">{state === "cancelled" ? t("au.sso.cancelled") : t("au.sso.failed")}</p>
      {message && <p className="mt-2 text-[14px] text-muted-foreground">{message}</p>}
      <Button asChild variant="outline" size="lg" className="mt-6">
        <Link to={`/logg-inn?next=${encodeURIComponent(next)}`}>{t("au.sso.retry")}</Link>
      </Button>
    </div>
  );
}

/** Steg 2: bytt Clerk-tokenet mot en HelloSky-sesjon og send kunden dit hen skulle. */
export function ClerkSsoComplete({ config, next }: { config: ClerkClientConfig; next: string }) {
  return (
    <ClerkRoot config={config}>
      <Complete next={safeNextPath(next)} />
    </ClerkRoot>
  );
}
