import { useEffect } from "react";
import { NavLink, useLocation } from "react-router";
import Icon from "./Icon";
import { isNavActive, NAV_HIDDEN, PRIMARY_NAV } from "./nav";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

/**
 * NavRail (desktop, ≥ lg): the burgundy column on the left of every customer
 * page with the same four destinations as the phone tab bar. The body gets
 * `has-rail` so content, fixed headers and the footer start after it.
 */
export default function NavRail() {
  const { pathname } = useLocation();
  const hidden = NAV_HIDDEN.some((re) => re.test(pathname));
  const t = useT();

  useEffect(() => {
    document.body.classList.toggle("has-rail", !hidden);
    return () => document.body.classList.remove("has-rail");
  }, [hidden]);

  if (hidden) return null;

  return (
    <nav
      aria-label={t("nav.main")}
      className="fixed inset-y-0 left-0 z-40 hidden w-[var(--rail-w)] flex-col items-center bg-burgundy pt-7 text-white lg:flex"
    >
      <ul className="flex w-full flex-col items-center gap-1">
        {PRIMARY_NAV.map((item) => {
          const active = isNavActive(item, pathname);
          return (
            <li key={item.id} className="w-full px-3">
              <NavLink
                to={item.to}
                end={item.to === "/"}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[84px] w-full flex-col items-center justify-center gap-2 rounded-2xl outline-none transition-colors duration-fast",
                  "focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-inset",
                  active ? "text-coral-on-dark" : "text-white/92 hover:bg-white/8 hover:text-white",
                )}
              >
                <Icon icon={item.icon} size={28} />
                <span className="text-[15px] font-medium leading-none">{t(item.label)}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
