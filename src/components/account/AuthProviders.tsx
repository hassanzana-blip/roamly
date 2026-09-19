import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { useAuthProviders } from "@/lib/authProviders";
import { useT } from "@/lib/i18n";
import { safeNextPath } from "@/lib/nextPath";
import { cn } from "@/lib/utils";

const ClerkSocialButtons = lazy(() => import("./ClerkSocial"));

/** «Apple, Google og Facebook» – bindeordet mellom de to siste følger språket. */
function joinNames(names: string[], and: string): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}`;
}

/**
 * Innloggingsmetoder fra registeret i src/lib/authProviders.ts. Bare
 * leverandører serveren sier er satt opp blir knapper – e-post er skjemaet
 * over. De som kommer, nevnes i én rolig linje. Ingen døde knapper.
 */
export function AuthProviderButtons({ className }: { className?: string }) {
  const t = useT();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const { oauth: buttons, upcoming, clerk } = useAuthProviders();
  if (buttons.length === 0 && upcoming.length === 0) return null;
  return (
    <div className={className}>
      {buttons.length > 0 && (
        <>
          <p className="t-caption mb-3 text-center">{t("au.providers.or")}</p>
          {clerk ? (
            <Suspense fallback={<div className="flex flex-col gap-2">{buttons.map((p) => <div key={p.id} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div>}>
              <ClerkSocialButtons config={clerk} providers={buttons.filter((p) => clerk.providers.includes(p.id))} next={next} />
            </Suspense>
          ) : (
            <div className="flex flex-col gap-2">
              {buttons.map((p) => {
                const ProviderMark = p.icon;
                return (
                  <Button key={p.id} asChild variant="outline" size="lg" className="w-full">
                    <a href={`${p.startPath}?next=${encodeURIComponent(next)}`}>
                      <ProviderMark className="size-[18px]" />
                      {t("au.providers.continue", { name: p.label })}
                    </a>
                  </Button>
                );
              })}
            </div>
          )}
        </>
      )}
      {upcoming.length > 0 && (
        <p className={cn("t-caption text-center", buttons.length > 0 && "mt-4")}>
          {t("au.providers.soon", { list: joinNames(upcoming.map((p) => p.label), t("au.providers.and")) })}
        </p>
      )}
    </div>
  );
}
