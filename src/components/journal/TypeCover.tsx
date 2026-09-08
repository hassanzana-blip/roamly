import type { ReactNode } from "react";
import type { JournalTag } from "@/content/journal";
import { StoryDrawing } from "@/components/journal/storyGlyph";
import { cn } from "@/lib/utils";

/**
 * Typografisk omslag for artikler og steder uten et verifisert foto.
 *
 * Flaten kommer fra paletten (blekk, lime, papir), tegningen fra
 * historietypen. Tre flater ganger ti glyfer gjør at to naboer i et
 * rutenett aldri ser like ut – og at omslaget faktisk sier noe om saken i
 * stedet for å være den samme vignetten om og om igjen. Aldri et tomt grått
 * felt, aldri et lånt bilde.
 */
export type CoverVariant = "ink" | "lime" | "paper";

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

/**
 * Tegningens farge, styrke og plassering. Hver flate har sin egen komposisjon.
 * Styrken settes med opacity, ikke med farge: glyfene bærer én lime-strek
 * satt direkte i SVG-en, og bare opacity demper den sammen med resten.
 * Tegningen holder seg i øvre del, så tittelen aldri står oppå en strek.
 */
const DRAWING: Record<CoverVariant, { tone: string; place: string }> = {
  ink: { tone: "text-white opacity-[0.16]", place: "-right-[8%] -top-[6%] w-[46%]" },
  lime: { tone: "text-night opacity-[0.18]", place: "-right-[6%] top-[5%] w-[42%]" },
  paper: { tone: "text-foreground opacity-[0.13]", place: "left-[6%] top-[7%] w-[34%]" },
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
  tag,
  size = "md",
  className,
}: {
  variant?: CoverVariant;
  /** Stor serif-linje nederst, som regel tittelen. Utelat for en liten miniatyr. */
  title?: ReactNode;
  /** Liten linje over tittelen, f.eks. kategorien. */
  label?: string;
  /** Historietypen som bestemmer tegningen. */
  tag?: JournalTag;
  size?: keyof typeof PAD;
  className?: string;
}) {
  const d = DRAWING[variant];
  return (
    <span className={cn("relative flex h-full w-full flex-col justify-end overflow-hidden", SURFACE[variant], PAD[size], className)} aria-hidden="true">
      {/* Glyfen er tegnet på 24-rutenettet; her skaleres den opp og beskjæres,
          så det er streken som er flatens tekstur, ikke et ikon i et hjørne. */}
      <span className={cn("pointer-events-none absolute aspect-square", d.place, d.tone)}>
        <StoryDrawing tag={tag} />
      </span>
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
