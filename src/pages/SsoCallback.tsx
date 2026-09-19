import { lazy, Suspense } from "react";
import { Link, useSearchParams } from "react-router";
import AppShell from "@/components/app/AppShell";
import SkyMark from "@/components/brand/SkyMark";
import { Button } from "@/components/ui/button";
import { useAuthProviders } from "@/lib/authProviders";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { safeNextPath } from "@/lib/nextPath";

const ClerkSsoCallback = lazy(() => import("@/components/account/ClerkSocial").then((m) => ({ default: m.ClerkSsoCallback })));
const ClerkSsoComplete = lazy(() => import("@/components/account/ClerkSocial").then((m) => ({ default: m.ClerkSsoComplete })));

/**
 * Landingssidene for sosial innlogging. `callback`: leverandøren har sendt
 * kunden tilbake, Clerk fullfører. `complete`: vi bytter Clerks token mot en
 * HelloSky-sesjon. Er sosial innlogging av (ingen nøkkel), sier siden det.
 */
export default function SsoCallback({ step }: { step: "callback" | "complete" }) {
  usePageMeta({ ...PAGE_META.login, canonicalPath: step === "callback" ? "/logg-inn/sso-callback" : "/logg-inn/sso-fullfor", noindex: true });
  const t = useT();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const { clerk, isLoading } = useAuthProviders();

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell bleed className="mx-auto w-full max-w-md px-5 sm:px-8">
        <div className="flex items-center justify-center pb-6" style={{ paddingTop: "max(24px, env(safe-area-inset-top))" }}>
          <Link to="/" aria-label={t("topbar.home")}><SkyMark className="h-7 w-auto" /></Link>
        </div>
        {isLoading ? (
          <p role="status" className="mt-8 text-center text-[15px] text-muted-foreground">{t("au.sso.completing")}</p>
        ) : !clerk ? (
          <div className="mt-8 text-center" role="alert">
            <p className="text-[17px] font-semibold">{t("au.sso.off")}</p>
            <Button asChild variant="outline" size="lg" className="mt-6"><Link to={`/logg-inn?next=${encodeURIComponent(next)}`}>{t("au.backtologin")}</Link></Button>
          </div>
        ) : (
          <Suspense fallback={<p role="status" className="mt-8 text-center text-[15px] text-muted-foreground">{t("au.sso.completing")}</p>}>
            {step === "callback" ? <ClerkSsoCallback config={clerk} next={next} /> : <ClerkSsoComplete config={clerk} next={next} />}
          </Suspense>
        )}
      </AppShell>
    </div>
  );
}
