import { useEffect } from "react";
import { NavLink, useLocation } from "react-router";
import Icon from "./Icon";
import { isNavActive, PRIMARY_NAV, TABBAR_HIDDEN } from "./nav";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

/**
 * BottomNav (HelloSky 4.0): a white bar, edge to edge, with four tabs —
 * Utforsk · Lagret · Reiser · Profil. Petrol icons (24 px) over 13 px
 * labels; the active tab is filled petrol, the rest are quiet. It respects
 * the safe area, and the body reserves room for it (has-tabbar, see
 * index.css) so content and the keyboard never end up underneath.
 * A11y: ≥48 px targets, aria-current="page", visible focus ring.
 */
export default function BottomNav() {
  const { pathname } = useLocation();
  const hidden = TABBAR_HIDDEN.some((re) => re.test(pathname));
  const t = useT();

  useEffect(() => {
    document.body.classList.toggle("has-tabbar", !hidden);
    return () => document.body.classList.remove("has-tabbar");
  }, [hidden]);

  if (hidden) return null;

  return (
    <nav
      aria-label={t("nav.main")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white text-petrol lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4" style={{ height: "var(--tabbar-h)" }}>
        {PRIMARY_NAV.map((tab) => {
          const active = isNavActive(tab, pathname);
          return (
            <li key={tab.id} className="min-w-0">
              <NavLink
                to={tab.to}
                end={tab.to === "/"}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full min-h-12 flex-col items-center justify-center gap-1 outline-none transition-colors duration-fast",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  active ? "text-petrol" : "text-petrol/75 hover:text-petrol",
                )}
              >
                <Icon icon={tab.icon} size={24} className={active && tab.id !== "explore" && tab.id !== "profile" ? "fill-current" : undefined} strokeWidth={active ? 2.25 : 2} />
                <span className={cn("truncate text-[13px] leading-none", active ? "font-semibold" : "font-medium")}>{t(tab.label)}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
