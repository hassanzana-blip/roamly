import { Link } from "react-router";
import { CreditCard, Facebook, Mail, Phone, ShieldCheck } from "lucide-react";
import SkyMark from "@/components/brand/SkyMark";
import { WhatsAppIcon, WHATSAPP_LINK, WHATSAPP_DISPLAY } from "@/components/WhatsAppFab";
import { useT, type I18nKey } from "@/lib/i18n";
import { COMPANY } from "@/pages/content/company";

export const FACEBOOK_LINK = "https://www.facebook.com/share/1Etw1nFpKH/?mibextid=wwXIfr";

const SHORTCUTS: { to: string; label: I18nKey }[] = [
  { to: "/", label: "footer.searchtickets" },
  { to: "/reisemal", label: "footer.destinations" },
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
];

const linkCls = "nav-underline inline-flex min-h-8 items-center text-muted-foreground transition-colors hover:text-foreground";

export default function SiteFooter() {
  const t = useT();
  return (
    <footer className="relative border-t border-border bg-card">
      <div className="container-x grid gap-10 pt-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <SkyMark className="h-8 w-8 text-foreground" />
            <span className="text-[22px] font-extrabold lowercase tracking-tight">hellosky</span>
          </div>
          <p className="font-display mt-4 text-2xl text-foreground">{t("footer.tagline")}</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{t("footer.blurb")}</p>
          <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
            {t("footer.trust")}
          </div>
          {/* Payment methods via Stripe: card and Klarna */}
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <span className="eyebrow w-full">{t("footer.paywith")}</span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold">
              <CreditCard className="size-4" aria-hidden="true" /> {t("footer.card")}
            </span>
            <img src="/brand/klarna.jpg" alt="Klarna" className="h-7 rounded-md" loading="lazy" width="70" height="28" />
            <span className="rounded-md bg-night px-2.5 py-1 text-xs font-semibold text-white">Stripe</span>
          </div>
          <a
            href={FACEBOOK_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3.5 text-sm font-medium transition-colors hover:border-foreground/30"
          >
            <Facebook className="size-4" aria-hidden="true" /> {t("footer.facebook")}
          </a>
        </div>
        <nav aria-label={t("footer.shortcuts")}>
          <h2 className="eyebrow mb-4">{t("footer.shortcuts")}</h2>
          <ul className="space-y-1.5 text-sm">
            {SHORTCUTS.map((s) => (
              <li key={s.to}>
                <Link className={linkCls} to={s.to}>
                  {t(s.label)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
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
          <h2 className="eyebrow mb-3 mt-6">{t("footer.legal")}</h2>
          <ul className="space-y-1.5 text-sm">
            {LEGAL.map((l) => (
              <li key={l.to}>
                <Link className={linkCls} to={l.to}>
                  {t(l.label)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="container-x mt-10 border-t border-border py-5 text-center text-xs leading-relaxed text-muted-foreground">
        © {new Date().getFullYear()} {COMPANY.legalName} · {COMPANY.orgNumberLabel} · {COMPANY.address} · {t("footer.copy")}
        <span className="mx-2 text-muted-foreground/60">·</span>
        {t("footer.photo")}
      </div>
    </footer>
  );
}
