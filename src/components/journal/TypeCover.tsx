import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Typografisk omslag for artikler og steder uten et verifisert foto.
 * Tre varianter på paletten, så to naboer i et rutenett aldri ser like ut:
 * blekk med lime-vinger, lys lime med blekk-vinger, og hvitt papir med stor
 * serif-tittel. Aldri et tomt grått felt, aldri et lånt bilde.
 */
export type CoverVariant = "ink" | "lime" | "paper";

export const COVER_VARIANTS: CoverVariant[] = ["ink", "lime", "paper"];

/** Variant for kort nr. i i et rutenett: naboer til venstre/høyre og over/under (tre kolonner) får alltid ulik variant. */
export function coverVariantAt(i: number): CoverVariant {
  return COVER_VARIANTS[(i + Math.floor(i / 3)) % 3];
}

/** Vingene fra merket, i én farge, så flaten bestemmer paletten. */
function Wings({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <path d="M8 26c5.5-1.5 11-2.6 15.4-5.2 4.1-2.4 6.6-6.1 10.5-9.4C37 9 40.6 8.2 45 8.2c-1.6 4.6-4.4 9.4-8.7 12.2-4.6 3-10.6 4.2-16.4 5-4 .6-8 .8-11.9.6Z" fill="currentColor" />
      <path d="M4 40c5.3-1.6 10.6-2.8 15-5.5 4.2-2.5 6.9-6.2 10.9-9.4 3.4-2.7 7.3-3.5 11.7-3.6-1.7 4.6-4.6 9.3-9 12.1-4.6 3-10.7 4.2-16.5 5-4 .6-8 1-12.1 1.4Z" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

const SURFACE: Record<CoverVariant, string> = {
  ink: "bg-night text-white",
  lime: "bg-primary-soft text-foreground",
  paper: "border border-border bg-card text-foreground",
};

const LABEL: Record<CoverVariant, string> = {
  ink: "text-white/70",
  lime: "text-accent-foreground",
  paper: "text-muted-foreground",
};

const PAD = { sm: "p-3", md: "p-5", lg: "p-6 sm:p-8" } as const;
const TITLE = {
  sm: "font-display text-[15px] leading-[1.2]",
  md: "font-display text-[22px] leading-[1.15] sm:text-[24px]",
  lg: "t-h2",
} as const;

export function TypeCover({
  variant = "ink",
  title,
  label,
  size = "md",
  className,
}: {
  variant?: CoverVariant;
  /** Stor serif-linje nederst, som regel tittelen. Utelat for en liten miniatyr. */
  title?: ReactNode;
  /** Liten linje over tittelen, f.eks. kategorien. */
  label?: string;
  size?: keyof typeof PAD;
  className?: string;
}) {
  return (
    <span className={cn("relative flex h-full w-full flex-col justify-end overflow-hidden", SURFACE[variant], PAD[size], className)} aria-hidden="true">
      {variant === "ink" && <Wings className="absolute right-0 top-0 h-[88%] w-auto -translate-y-[30%] translate-x-[24%] text-[hsl(var(--primary))]" />}
      {variant === "lime" && <Wings className="absolute right-0 top-0 h-[88%] w-auto -translate-y-[30%] translate-x-[24%] text-night" />}
      {variant === "paper" && <span className={cn("absolute left-0 top-0 h-2.5 w-2.5 rounded-full bg-primary", size === "sm" ? "m-3" : size === "lg" ? "m-6 sm:m-8" : "m-5")} />}
      {(label || title) && (
        <span className="relative block">
          {/* Ikke t-label her: den utilityen setter sin egen dempede farge og ville overstyrt kontrasten på mørkt omslag. */}
          {label && <span className={cn("mb-2 block text-xs font-semibold leading-tight tracking-[0.01em]", LABEL[variant])}>{label}</span>}
          {title && <span className={cn("block text-balance", TITLE[size], size === "sm" ? "line-clamp-2" : "line-clamp-4")}>{title}</span>}
        </span>
      )}
    </span>
  );
}
