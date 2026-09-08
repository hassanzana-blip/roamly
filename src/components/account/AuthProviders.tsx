import { Button } from "@/components/ui/button";
import { oauthAuthProviders, upcomingAuthProviders } from "@/lib/authProviders";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** «Apple, Google og Facebook» – bindeordet mellom de to siste følger språket. */
function joinNames(names: string[], and: string): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}`;
}

/**
 * Innloggingsmetoder fra registeret i src/lib/authProviders.ts. Bare aktive
 * OAuth-leverandører blir knapper – e-post er skjemaet over. De som kommer,
 * nevnes i én rolig linje. Ingen døde eller deaktiverte knapper.
 */
export function AuthProviderButtons({ className }: { className?: string }) {
  const t = useT();
  const buttons = oauthAuthProviders();
  const upcoming = upcomingAuthProviders();
  if (buttons.length === 0 && upcoming.length === 0) return null;
  return (
    <div className={className}>
      {buttons.length > 0 && (
        <>
          <p className="t-caption mb-3 text-center">{t("au.providers.or")}</p>
          <div className="flex flex-col gap-2">
            {buttons.map((p) => {
              const ProviderMark = p.icon;
              return (
                <Button key={p.id} asChild variant="outline" size="lg" className="w-full">
                  <a href={p.startPath}>
                    <ProviderMark className="size-[18px]" />
                    {t("au.providers.continue", { name: p.label })}
                  </a>
                </Button>
              );
            })}
          </div>
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
