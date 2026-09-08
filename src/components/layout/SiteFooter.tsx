import { useId, useState } from "react";
import { Link } from "react-router";
import { ChevronDown, CreditCard, Facebook, Mail, Phone, ShieldCheck } from "lucide-react";
import SkyMark from "@/components/brand/SkyMark";
import { WhatsAppIcon, WHATSAPP_LINK, WHATSAPP_DISPLAY } from "@/components/WhatsAppFab";
import { useIsMobile } from "@/hooks/use-mobile";
import { useT, type I18nKey } from "@/lib/i18n";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import { COMPANY } from "@/pages/content/company";

export const FACEBOOK_LINK = "https://www.facebook.com/share/1Etw1nFpKH/?mibextid=wwXIfr";

const SHORTCUTS: { to: string; label: I18nKey }[] = [
  { to: "/", label: "footer.searchtickets" },
  { to: "/reisemal", label: "footer.destinations" },
  { to: "/journal", label: "footer.journal" },
  { to: "/hotell-bil", label: "footer.hotelcar" },
  { to: "/quiz", label: "footer.quiz" },
  { to: "/reise", label: "footer.findbooking" },
  { to: "/flystatus", label: "footer.track" },
  { to: "/hjelp", label: "nav.support" },
  { to: "/samfunn", label: "footer.community" },
  { to: "/om-oss", label: "footer.about" },
];

const LEGAL: { to: string; label: I18nKey }[] = [
  { to: "/vilkar", label: "footer.terms" },
  { to: "/personvern", label: "footer.privacy" },
  { to: "/bagasje", label: "footer.baggage" },
  { to: "/visum", label: "footer.visa" },
  { to: "/fotokreditering", label: "footer.photocredits" },
];

const linkCls = "nav-underline inline-flex min-h-8 items-center text-muted-foreground transition-colors hover:text-foreground";

/**
 * En lenkegruppe i bunnteksten. På mobil er den et sammenslått trekkspill, slik
 * at identitet og kontaktinfo ligger øverst og ikke drukner i ni snarveier; fra
 * md og opp er den en helt vanlig liste med overskrift.
 *
 * Lukket gruppe er `inert`: lenkene er ikke i tabulatorrekkefølgen og ikke
 * synlige for skjermleser, slik at knappen forteller sannheten om hva som er der.
 */
function FooterGroup({ title, links, className }: { title: string; links: { to: string; label: I18nKey }[]; className?: string }) {
  const t = useT();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const expanded = !isMobile || open;

  return (
    <nav aria-label={title} className={className}>
      {isMobile ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-border text-left"
        >
          <span className="eyebrow">{title}</span>
          <ChevronDown
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      ) : (
        <h2 className="eyebrow mb-4">{title}</h2>
      )}
      <div
        id={panelId}
        inert={!expanded}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <ul className={cn("space-y-1.5 overflow-hidden text-sm", isMobile && "pt-2")}>
          {links.map((l) => (
            <li key={l.to}>
              <Link className={linkCls} to={l.to}>
                {t(l.label)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

export default function SiteFooter() {
  const t = useT();
  // Betalingsmerkene er en påstand om hvordan du betaler. Står Stripe ikke klart
  // i miljøet, kan ingen betale – da viser vi dem ikke.
  const status = trpc.flights.status.useQuery(undefined, { staleTime: 300_000, retry: false });
  const paymentsConfigured = status.data?.paymentsConfigured === true;

  return (
    <footer className="relative border-t border-border bg-card text-foreground">
      <div className="container-x grid gap-x-10 gap-y-8 pt-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="md:col-start-1 md:row-start-1">
          <div className="flex items-center gap-2">
            <SkyMark className="h-8 w-8 text-foreground" />
            <span className="text-[22px] font-extrabold lowercase tracking-tight text-foreground">hellosky</span>
          </div>
          <p className="font-display mt-4 text-2xl text-foreground">{t("footer.tagline")}</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{t("footer.blurb")}</p>
          <div className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-px size-4 shrink-0 text-success" aria-hidden="true" />
            {paymentsConfigured ? t("footer.trust") : t("footer.trust.nopay")}
          </div>
          {paymentsConfigured && (
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <span className="eyebrow w-full">{t("footer.paywith")}</span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold">
                <CreditCard className="size-4" aria-hidden="true" /> {t("footer.card")}
              </span>
              <img src="/brand/klarna.jpg" alt="Klarna" className="h-7 rounded-md" loading="lazy" width="70" height="28" />
              <span className="rounded-md bg-night px-2.5 py-1 text-xs font-semibold text-white">Stripe</span>
            </div>
          )}
          <a
            href={FACEBOOK_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3.5 text-sm font-medium text-foreground transition-colors hover:border-foreground/30"
          >
            <Facebook className="size-4" aria-hidden="true" /> {t("footer.facebook")}
          </a>
        </div>

        {/* Kontakt står alltid åpent – det er det folk leter etter i bunnteksten. */}
        <div className="md:col-start-3 md:row-start-1">
          <h2 className="eyebrow mb-4">{t("footer.contact")}</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <a href={`mailto:${COMPANY.supportEmail}`} className={`${linkCls} gap-2.5`}>
                <Mail className="size-4" aria-hidden="true" /> {COMPANY.supportEmail}
              </a>
            </li>
            <li>
              <a href={`tel:${COMPANY.supportPhoneTel}`} className={`${linkCls} gap-2.5`}>
                <Phone className="size-4" aria-hidden="true" /> {COMPANY.supportPhone}
              </a>
            </li>
            <li>
              <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className={`${linkCls} gap-2.5`}>
                <WhatsAppIcon className="size-4" /> WhatsApp {WHATSAPP_DISPLAY}
              </a>
            </li>
            <li className="text-xs leading-relaxed text-muted-foreground">{t("footer.hours")}</li>
          </ul>
        </div>

        <FooterGroup title={t("footer.shortcuts")} links={SHORTCUTS} className="md:col-start-2 md:row-start-1" />
        <FooterGroup title={t("footer.legal")} links={LEGAL} className="md:col-start-3 md:row-start-2" />
      </div>

      <div className="container-x mt-10 border-t border-border py-5 text-center text-xs leading-relaxed text-muted-foreground">
        © {new Date().getFullYear()} {COMPANY.identityLine} · {t("footer.copy")}
        <span className="mx-2 text-muted-foreground/60">·</span>
        {t("footer.photo")}
      </div>
    </footer>
  );
}
