import { Link, useLocation } from "react-router";
import { useEffect, useState } from "react";
import SkyMark from "@/components/brand/SkyMark";
import UserMenu from "@/components/account/UserMenu";
import { SkipLink } from "@/components/app/AppShell";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { LocaleChip } from "./LocaleChip";

/**
 * The HelloSky logo: lowercase wordmark with the coral mark after it.
 * `inverted` on burgundy or photo surfaces.
 */
export function Logo({ compact = false, inverted = false, className }: { compact?: boolean; inverted?: boolean; className?: string }) {
  const t = useT();
  return (
    <Link to="/" className={cn("group flex min-h-11 items-center gap-1 rounded-md", className)} aria-label={t("nav.tofront")}>
      {!compact && (
        <span className={cn("text-[24px] font-medium lowercase leading-none tracking-tight", inverted ? "text-white" : "text-foreground")}>hellosky</span>
      )}
      <SkyMark className={cn("h-6 w-6 transition-transform duration-base group-hover:-rotate-6", inverted ? "text-white" : "text-foreground")} />
    </Link>
  );
}

/**
 * SiteHeader (HelloSky 3.0): the quiet top row — brand on the left, market
 * and account on the right. Navigation itself lives in the burgundy rail
 * (desktop) and the floating tab bar (phone), so this row never competes
 * with it. Fixed, and offset by the rail on large screens.
 */
export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const home = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-[box-shadow,border-color,background-color] duration-base lg:left-[var(--rail-w)]",
        scrolled ? "border-border/70 bg-background/92 shadow-xs backdrop-blur-md" : "border-transparent",
        !scrolled && !home && "bg-background/92 backdrop-blur-md",
      )}
    >
      <SkipLink />
      <div className="container-x flex h-16 items-center justify-between gap-3">
        <Logo />
        <div className="flex items-center gap-2 sm:gap-3">
          <LocaleChip className="hidden sm:block" />
          <UserMenu tone="light" />
        </div>
      </div>
    </header>
  );
}
