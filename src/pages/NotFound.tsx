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
      </div>
    </main>
  );
}
