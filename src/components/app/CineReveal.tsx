import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Kinereveal: bildet rulles opp nedenfra med clip-path når seksjonen
 * kommer inn i bildet – som en lysbildeframviser. Maskinvareakselerert
 * (clip-path på GPU), én gang, og helt av ved redusert bevegelse.
 */
export default function CineReveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial={{ clipPath: "inset(0 0 100% 0)" }}
      whileInView={{ clipPath: "inset(0 0 0% 0)" }}
      viewport={{ once: true, margin: "-72px" }}
      transition={{ duration: 0.85, delay, ease: [0.77, 0, 0.175, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
