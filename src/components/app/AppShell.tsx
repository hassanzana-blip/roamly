import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import SiteHeader from "@/components/layout/SiteHeader";

/**
 * AppShell — the single page container. Mobile 390px-first; desktop is
 * derived from the mobile column (same rhythm, wider track, more columns).
 * Every screen fades in once — native, quick (≤240ms), no scroll trapping.
 * A11y: renders the skip link + `<main id="main">` target; honours
 * prefers-reduced-motion (no translate, opacity only).
 */

export function SkipLink({ className }: { className?: string }) {
  const t = useT();
  return (
    <a
      href="#main"
      className={cn(
        "sr-only z-[100] rounded-full bg-night px-4 py-2 text-sm font-bold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:outline-2 focus:outline-offset-2 focus:outline-ring",
        className,
      )}
    >
      {t("nav.skip")}
    </a>
  );
}

export default function AppShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <>
      <SkipLink />
      {/* Desktop (≥ lg): full nettstedsmeny. Mobil/nettbrett: app-topplinje + bunnnav. */}
      <div className="hidden lg:block">
        <SiteHeader />
        <div className="h-20" aria-hidden="true" />
      </div>
      <motion.main
        id="main"
        tabIndex={-1}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0.12 : 0.22, ease: "easeOut" }}
        className={cn("mx-auto w-full max-w-6xl px-5 outline-none sm:px-8", className)}
      >
        {children}
      </motion.main>
    </>
  );
}

/** Section header row: oversized title + quiet "Se alle" action. */
export function SectionHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4", className)}>
      <h2 className="font-display text-[22px] leading-tight tracking-tight sm:text-2xl">{title}</h2>
      {action}
    </div>
  );
}
