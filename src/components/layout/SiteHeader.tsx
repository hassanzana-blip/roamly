import { NavLink, useLocation } from "react-router";
import { useEffect, useState } from "react";
import Wordmark from "@/components/brand/Wordmark";
import UserMenu from "@/components/account/UserMenu";
import { SkipLink } from "@/components/app/AppShell";
import Icon from "@/components/app/Icon";
import { isNavActive, PRIMARY_NAV } from "@/components/app/nav";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { LocaleChip } from "./LocaleChip";

/** The HelloSky logo, kept as a named export for older call sites. */
export function Logo({ compact = false, inverted = false, className }: { compact?: boolean; inverted?: boolean; className?: string }) {
  return <Wordmark tone={inverted ? "light" : "dark"} size={compact ? "sm" : "md"} className={className} />;
}

/**
 * SiteHeader (HelloSky 4.0, desktop ≥ lg): the wordmark on the left, the four
 * destinations in the middle (the same ones as the phone tab bar), market and
 * account on the right. White, one hairline when scrolled.
 */
export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const t = useT();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("fixed inset-x-0 top-0 z-50 border-b bg-white/95 backdrop-blur-md transition-[border-color] duration-base", scrolled ? "border-border" : "border-transparent")}>
      <SkipLink />
      <div className="container-x flex h-16 items-center justify-between gap-6">
        <Wordmark />
        <nav aria-label={t("nav.main")} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {PRIMARY_NAV.map((item) => {
              const active = isNavActive(item, pathname);
              return (
                <li key={item.id}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-[15px] outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "bg-mint font-semibold text-petrol" : "font-medium text-petrol/75 hover:bg-secondary hover:text-petrol",
                    )}
                  >
                    <Icon icon={item.icon} size={20} />
                    {t(item.label)}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <LocaleChip className="hidden sm:block" />
          <UserMenu tone="light" />
        </div>
      </div>
    </header>
  );
}
