import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Confirmation mark: the circle and check draw once, then a short lime route
 * settles underneath. One moment, under 900 ms, no confetti.
 */
export function ConfirmationMark({ className, title }: { className?: string; title?: string }) {
  const reduce = useReducedMotion();
  const draw = !reduce;
  const ease = [0.2, 0.8, 0.2, 1] as const;
  return (
    <svg viewBox="0 0 96 96" className={cn("h-24 w-24 text-foreground", className)} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={title}>
      <motion.circle cx="48" cy="40" r="28" initial={draw ? { pathLength: 0, opacity: 0.4 } : false} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.5, ease }} />
      <motion.path d="M35 41l9 9 17-18" stroke="hsl(var(--primary))" strokeWidth="4" initial={draw ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: draw ? 0.35 : 0, ease }} />
      <motion.path d="M14 84c12-10 30-14 50-10s22 6 18-2" strokeWidth="2" strokeDasharray="4 6" className="text-border" stroke="currentColor" initial={draw ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: draw ? 0.55 : 0, ease }} />
      <motion.circle cx="14" cy="84" r="3" fill="currentColor" stroke="none" initial={draw ? { scale: 0.6, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} transition={{ delay: draw ? 0.55 : 0, duration: 0.2 }} style={{ transformOrigin: "14px 84px" }} />
      <motion.circle cx="82" cy="72" r="3.5" fill="hsl(var(--primary))" stroke="none" initial={draw ? { scale: 0.6, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} transition={{ delay: draw ? 0.95 : 0, duration: 0.2 }} style={{ transformOrigin: "82px 72px" }} />
    </svg>
  );
}
