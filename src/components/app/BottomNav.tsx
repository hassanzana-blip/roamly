import { useEffect } from "react";
import { NavLink, useLocation } from "react-router";
import { BedDouble, CarFront, Compass, Plane, Ticket } from "lucide-react";
import Icon from "./Icon";
import { cn } from "@/lib/utils";
import { useT, type I18nKey } from "@/lib/i18n";

/**
 * BottomNav (HelloSky 2.0): five product-first tabs on a white bar with a
 * hairline. The active tab sits on a soft red pill with red icon and label.
 * Never blocks content: body gets has-tabbar padding (see index.css).
 * Hidden on checkout (own sticky pay bar), the whole admin tree, and on
 * large screens (≥ lg) where SiteHeader carries the navigation.
 * A11y: ≥44px targets, aria-current="page" on the active tab, visible focus ring.
 */

const TABS: { to: string; label: I18nKey; icon: typeof Plane; end?: boolean; match?: RegExp }[] = [
  { to: "/", label: "nav.flights", icon: Plane, end: true, match: /^\/(sok)?$/ },
  { to: "/hotell", label: "nav.hotels", icon: BedDouble },
  { to: "/leiebil", label: "nav.cars", icon: CarFront },
  { to: "/utforsk", label: "nav.explore", icon: Compass, match: /^\/(utforsk|reisemal|journal|quiz)/ },
  { to: "/reiser", label: "nav.trips", icon: Ticket, match: /^\/(reiser|reise|profil|lagret)/ },
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

  const isActive = (tab: (typeof TABS)[number]) => (tab.match ? tab.match.test(pathname) : pathname === tab.to || pathname.startsWith(tab.to + "/"));

  return (
    <nav
      aria-label={t("nav.main")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 px-1 pt-1.5 pb-1.5">
        {TABS.map((tab) => {
          const active = isActive(tab);
          return (
            <li key={tab.to} className="min-w-0">
              <NavLink
                to={tab.to}
                end={tab.end}
                aria-current={active ? "page" : undefined}
                className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-colors duration-fast",
                    active ? "tab-pill bg-primary-soft text-accent-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon icon={tab.icon} size={20} />
                </span>
                <span className={cn("truncate text-[11px] font-semibold leading-none", active ? "text-accent-foreground" : "text-muted-foreground")}>
                  {t(tab.label)}
                </span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
