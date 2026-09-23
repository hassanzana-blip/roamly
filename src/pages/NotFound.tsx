import { Link } from "react-router";
import { ArrowRight, Compass } from "lucide-react";
import Icon from "@/components/app/Icon";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";

export default function NotFound() {
  const t = useT();
  usePageMeta(PAGE_META.notFound);
  return (
    <main id="main" className="grid min-h-[100dvh] place-items-center bg-background p-6 text-center">
      <div>
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon icon={Compass} size={28} />
        </span>
        <p className="mt-6 font-display text-6xl tracking-tight" aria-hidden="true">404</p>
        <h1 className="mt-2 font-display text-2xl">
          <span className="sr-only">404 – </span>
          {t("notfound.sub")}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{t("notfound.body")}</p>
        <Link
          to="/"
          className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary px-7 text-[15px] font-semibold text-primary-foreground transition-colors hover:opacity-90"
        >
          {t("notfound.cta")} <Icon icon={ArrowRight} size={16} />
        </Link>

        {/* En 404 er et feilspor, ikke en blindvei. Lenkene under er de fire
            stedene folk som lander her faktisk skulle. De er også det eneste
            stedet en crawler kan gå videre fra en død lenke. */}
        <nav aria-label={t("notfound.links")} className="mx-auto mt-10 max-w-md border-t border-border pt-6">
          <p className="text-[14px] font-semibold">{t("notfound.links")}</p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {[
              { to: "/", label: t("notfound.link.search") },
              { to: "/fly", label: t("notfound.link.routes") },
              { to: "/reisemal", label: t("notfound.link.destinations") },
              { to: "/journal", label: t("notfound.link.journal") },
            ].map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="press inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-4 text-[15px] font-semibold text-azure-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
