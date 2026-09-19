import { useEffect } from "react";
import { NavLink, useLocation } from "react-router";
import Icon from "./Icon";
import { isNavActive, NAV_HIDDEN, PRIMARY_NAV } from "./nav";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

/**
 * BottomNav (HelloSky 3.0): a floating burgundy pill with four tabs —
 * Utforsk · Lagret · Reiser · Profil. The active tab is coral, the rest
 * white. It floats 16 px above the safe area so it never touches the edge,
 * and the body reserves room for it (has-tabbar, see index.css) so content
 * and the keyboard never end up underneath.
 * A11y: ≥44 px targets, aria-current="page", visible focus ring.
 */
export default function BottomNav() {
  const { pathname } = useLocation();
  const hidden = NAV_HIDDEN.some((re) => re.test(pathname));
  const t = useT();

  useEffect(() => {
    document.body.classList.toggle("has-tabbar", !hidden);
    return () => document.body.classList.remove("has-tabbar");
  }, [hidden]);

  if (hidden) return null;

  return (
    <nav
      aria-label={t("nav.main")}
      className="fixed inset-x-4 z-50 rounded-[28px] bg-burgundy text-white shadow-lift lg:hidden"
      style={{ bottom: "calc(16px + env(safe-area-inset-bottom))", height: "var(--tabbar-h)" }}
    >
      <ul className="mx-auto grid h-full max-w-lg grid-cols-4 px-2">
        {PRIMARY_NAV.map((tab) => {
          const active = isNavActive(tab, pathname);
          return (
            <li key={tab.id} className="min-w-0">
              <NavLink
                to={tab.to}
                end={tab.to === "/"}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 rounded-[22px] outline-none transition-colors duration-fast",
                  "focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-inset",
                  active ? "text-coral-on-dark" : "text-white/92 hover:text-white",
                )}
              >
                <Icon icon={tab.icon} size={24} />
                <span className="truncate text-[13px] font-medium leading-none">{t(tab.label)}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
