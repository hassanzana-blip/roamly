import { useEffect } from "react";
import { NavLink, useLocation } from "react-router";
import { Compass, Heart, Home, Luggage, User } from "lucide-react";
import Icon from "./Icon";
import { cn } from "@/lib/utils";
import { useT, type I18nKey } from "@/lib/i18n";

/**
 * BottomNav: floating ink capsule above the safe area.
 * The active item sits on a lime thumb. Never blocks content:
 * body gets has-tabbar padding (see index.css).
 * Hidden on checkout (own sticky pay bar), the whole admin tree, and on
 * large screens (≥ lg) where SiteHeader carries the navigation.
 * A11y: 44px targets, aria-current="page" on the active tab, visible focus ring.
 */

const TABS: { to: string; label: I18nKey; icon: typeof Home; end?: boolean }[] = [
  { to: "/", label: "nav.home", icon: Home, end: true },
  { to: "/utforsk", label: "nav.explore", icon: Compass },
  { to: "/reiser", label: "nav.trips", icon: Luggage },
  { to: "/lagret", label: "nav.saved", icon: Heart },
  { to: "/profil", label: "nav.profile", icon: User },
];

const HIDDEN = [/^\/admin/, /^\/bestill/, /^\/bekreftelse/, /^\/tilbud/, /^\/velkommen/];

export default function BottomNav() {
  const { pathname } = useLocation();
  const hidden = HIDDEN.some((re) => re.test(pathname));
  const t = useT();

  useEffect(() => {
    document.body.classList.toggle("has-tabbar", !hidden);
    return () => document.body.classList.remove("has-tabbar");
  }, [hidden]);

  if (hidden) return null;

  return (
    <nav aria-label={t("nav.main")} className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 lg:hidden" style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}>
      <div className="flex items-center gap-0.5 rounded-full bg-night p-1 shadow-lift">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            aria-current={pathname === tab.to || (!tab.end && pathname.startsWith(tab.to)) ? "page" : undefined}
            className="relative flex min-h-11 min-w-[54px] flex-col items-center justify-center gap-0.5 rounded-full px-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:flex-row sm:gap-1.5 sm:px-4"
          >
            {({ isActive }) => (
              <>
                {/* Den aktive flaten er ren CSS. Den lå i motions delte
                    layout-animasjon, og dro dermed 136 kB inn i den kritiske
                    stien på hver eneste mobilside – for et merke som skifter
                    når man bytter side uansett. */}
                {isActive && <span className="tab-pill absolute inset-0 rounded-full bg-primary" aria-hidden="true" />}
                <span className={cn("relative z-10 flex flex-col items-center gap-0.5 transition-colors duration-fast sm:flex-row sm:gap-1.5", isActive ? "text-primary-foreground" : "text-white/75 hover:text-white")}>
                  <Icon icon={tab.icon} size={16} />
                  <span className="text-[11px] font-semibold leading-none sm:text-xs">{t(tab.label)}</span>
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
