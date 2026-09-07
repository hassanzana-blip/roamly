import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import SiteHeader from "@/components/layout/SiteHeader";

/**
 * AppShell: the single page container. Mobile 390px-first; desktop is
 * derived from the mobile column (same rhythm, wider track, more columns).
 * Every screen fades in once, quickly (≤220ms), no scroll trapping.
 * A11y: renders the skip link + `<main id="main">` target; honours
 * prefers-reduced-motion (opacity only).
 */

export function SkipLink({ className }: { className?: string }) {
  const t = useT();
  return (
    <a
      href="#main"
      className={cn(
        "sr-only z-[100] rounded-lg bg-night px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:outline-2 focus:outline-offset-2 focus:outline-ring",
        className,
      )}
    >
      {t("nav.skip")}
    </a>
  );
}

/** `bleed`: the page manages its own containers (full-width photo sections). */
export default function AppShell({ children, className, bleed = false }: { children: ReactNode; className?: string; bleed?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <>
      <SkipLink />
      {/* Desktop (≥ lg): full site header. Phone/tablet: app top bar + bottom nav. */}
      <div className="hidden lg:block">
        <SiteHeader />
        <div className="h-16" aria-hidden="true" />
      </div>
      <motion.main
        id="main"
        tabIndex={-1}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0.12 : 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        className={cn(bleed ? "outline-none" : "container-x outline-none", className)}
      >
        {children}
      </motion.main>
    </>
  );
}

/** Section header row: editorial title + quiet "See all" action. */
export function SectionHeader({ title, action, className }: { title: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4", className)}>
      <h2 className="font-display text-[24px] leading-tight sm:text-[28px]">{title}</h2>
      {action}
    </div>
  );
}
