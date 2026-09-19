import { Link } from "react-router";
import { ArrowRight, Ship } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { GreetingBar } from "@/components/app/TopBar";
import ServiceTabs from "@/components/app/ServiceTabs";
import Icon from "@/components/app/Icon";
import SiteFooter from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { WHATSAPP_LINK, WhatsAppIcon } from "@/components/WhatsAppFab";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";

/**
 * Cruise has a tab because the product has four services, and it has this
 * page because HelloSky has no cruise provider yet. We say so, plainly, and
 * point at the people who can help — we never simulate a search.
 */
export default function Cruise() {
  usePageMeta(PAGE_META.cruise);
  const t = useT();
  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell>
        <div className="lg:hidden"><GreetingBar /></div>
        <h1 className="t-h1 lg:mt-2">{t("cruise.title")}</h1>
        <ServiceTabs active="cruise" className="mt-6" />
        <div className="card-soft mt-8 px-6 py-12 text-center sm:px-10">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-mint text-petrol"><Icon icon={Ship} size={28} /></span>
          <h2 className="t-h2 mt-5">{t("cruise.na.title")}</h2>
          <p className="t-body mx-auto mt-3 max-w-lg text-muted-foreground">{t("cruise.na.body")}</p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full px-7">
              <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="size-5" /> {t("cruise.na.cta")}</a>
            </Button>
            <Button asChild size="lg" variant="subtle" className="rounded-full px-7">
              <Link to="/">{t("cruise.na.alt")} <ArrowRight className="size-5" aria-hidden="true" /></Link>
            </Button>
          </div>
        </div>
      </AppShell>
      <div className="mt-16"><SiteFooter /></div>
    </div>
  );
}
