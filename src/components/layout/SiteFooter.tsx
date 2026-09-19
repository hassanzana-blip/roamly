import { Link } from "react-router";
import { Facebook, Globe, Mail, Phone, ShieldCheck } from "lucide-react";
import SkyMark from "@/components/brand/SkyMark";
import { WhatsAppIcon, WHATSAPP_LINK, WHATSAPP_DISPLAY } from "@/components/WhatsAppFab";
import { useLocale, useT, LANG_LABELS, type I18nKey } from "@/lib/i18n";
import { COMPANY } from "@/pages/content/company";

export const FACEBOOK_LINK = "https://www.facebook.com/share/1Etw1nFpKH/?mibextid=wwXIfr";

type FooterLink = { to: string; label: I18nKey };

const SEARCH: FooterLink[] = [
  { to: "/", label: "footer.flights" },
  { to: "/hotell", label: "footer.hotels" },
  { to: "/leiebil", label: "footer.cars" },
  { to: "/reisemal", label: "footer.destinations" },
  { to: "/flystatus", label: "footer.track" },
];

const COMPANY_LINKS: FooterLink[] = [
  { to: "/om-oss", label: "footer.about" },
  { to: "/om-oss#slik", label: "footer.how" },
  { to: "/journal", label: "footer.journal" },
  { to: "/samfunn", label: "footer.community" },
  { to: "/reise", label: "footer.findbooking" },
];

const HELP: FooterLink[] = [
  { to: "/hjelp", label: "nav.support" },
  { to: "/bagasje", label: "footer.baggage" },
  { to: "/visum", label: "footer.visa" },
  { to: "/vilkar", label: "footer.terms" },
  { to: "/personvern", label: "footer.privacy" },
  { to: "/fotokreditering", label: "footer.photocredits" },
];

const linkCls = "inline-flex min-h-10 items-center text-sm text-white/70 transition-colors hover:text-white";

function Column({ title, links }: { title: string; links: FooterLink[] }) {
  const t = useT();
  return (
    <nav aria-label={title}>
      <h2 className="mb-3 text-[13px] font-semibold text-white">{title}</h2>
      <ul className="space-y-1">
        {links.map((l) => (
          <li key={l.to}>
            <Link className={linkCls} to={l.to}>
              {t(l.label)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * HelloSky 2.0 footer: warm near-black surface, the brand with the
 * metasearch disclosure first, three link columns, contact, then the
 * legal line with locale. On phones the bottom padding clears BottomNav.
 */
export default function SiteFooter() {
  const t = useT();
  const { lang, currency } = useLocale();

  return (
    <footer className="relative bg-night text-white">
      <div className="container-x pt-12 sm:pt-14">
        <div className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr_1fr] md:gap-8 lg:gap-12">
          <div>
            <Link to="/" className="inline-flex items-center gap-2 rounded-md" aria-label={t("nav.tofront")}>
              <SkyMark className="h-8 w-8 text-white" />
              <span className="flex flex-col justify-center">
                <span className="text-[22px] font-extrabold lowercase leading-none tracking-tight">hellosky</span>
                <span className="mt-1 text-[8.5px] font-semibold uppercase leading-none tracking-[0.3em] text-white/60">{t("brand.tagline")}</span>
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/70">{t("footer.meta.blurb")}</p>
            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-white/60">
              <ShieldCheck className="mt-px size-4 shrink-0 text-white/70" aria-hidden="true" />
              {t("footer.meta.trust")}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <a href={FACEBOOK_LINK} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/20 px-3.5 text-sm font-medium text-white transition-colors hover:border-white/50">
                <Facebook className="size-4" aria-hidden="true" /> {t("footer.facebook")}
              </a>
              <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/20 px-3.5 text-sm font-medium text-white transition-colors hover:border-white/50">
                <WhatsAppIcon className="size-4" /> WhatsApp {WHATSAPP_DISPLAY}
              </a>
            </div>
          </div>

          <Column title={t("footer.search")} links={SEARCH} />
          <Column title={t("footer.company")} links={COMPANY_LINKS} />
          <div className="space-y-8">
            <Column title={t("footer.help")} links={HELP} />
            <div>
              <h2 className="mb-3 text-[13px] font-semibold text-white">{t("footer.contact")}</h2>
              <ul className="space-y-1 text-sm">
                <li>
                  <a href={`mailto:${COMPANY.supportEmail}`} className={`${linkCls} gap-2`}>
                    <Mail className="size-4" aria-hidden="true" /> {COMPANY.supportEmail}
                  </a>
                </li>
                <li>
                  <a href={`tel:${COMPANY.supportPhoneTel}`} className={`${linkCls} gap-2`}>
                    <Phone className="size-4" aria-hidden="true" /> {COMPANY.supportPhone}
                  </a>
                </li>
                <li className="pt-1 text-xs leading-relaxed text-white/55">{t("footer.hours")}</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/12 py-5 text-xs leading-relaxed text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {COMPANY.identityLine} · {t("footer.meta.copy")} · {t("footer.meta.sources")}
            <span className="mx-2 text-white/30">·</span>
            {t("footer.photo")}
          </p>
          <p className="inline-flex items-center gap-1.5 text-white/75">
            <Globe className="size-3.5" aria-hidden="true" /> {LANG_LABELS[lang]} · {currency}
          </p>
        </div>
      </div>
      {/* Plass til bunnavigasjonen på telefon (den ligger over innholdet). */}
      <div className="h-2 lg:hidden" aria-hidden="true" />
    </footer>
  );
}
