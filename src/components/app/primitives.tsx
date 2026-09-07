import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { Heart, Star, type LucideIcon } from "lucide-react";
import Icon from "./Icon";
import { cn } from "@/lib/utils";

/* ─── Buttons ─────────────────────────────────────────────────────────── */

// Omit event handlers whose signatures collide between React and motion.
type BtnProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration" | "onDrag" | "onDragStart" | "onDragEnd" | "onDragOver" | "onDragEnter" | "onDragLeave" | "onDragExit" | "onDrop"
> & {
  icon?: LucideIcon;
};
type MotionBtnRest = Omit<HTMLMotionProps<"button">, "ref">;

const baseBtn =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 text-[15px] font-semibold transition-colors duration-fast ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50";

/** The single action of a screen. ≥48px target. */
export const PrimaryButton = forwardRef<HTMLButtonElement, BtnProps>(function PrimaryButton({ icon, className, children, ...rest }, ref) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.985 }}
      className={cn(baseBtn, "bg-primary text-primary-foreground shadow-xs hover:bg-[hsl(var(--primary)/0.9)]", className)}
      {...(rest as MotionBtnRest)}
    >
      {icon ? <Icon icon={icon} size={20} /> : null}
      {children}
    </motion.button>
  );
});

/** Quiet secondary action: outlined on white. */
export const SecondaryButton = forwardRef<HTMLButtonElement, BtnProps>(function SecondaryButton({ icon, className, children, ...rest }, ref) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.985 }}
      className={cn(baseBtn, "border border-input bg-card text-foreground hover:border-foreground/40 hover:bg-muted/60", className)}
      {...(rest as MotionBtnRest)}
    >
      {icon ? <Icon icon={icon} size={20} /> : null}
      {children}
    </motion.button>
  );
});

/** Round outline icon button – 44px touch target. */
export const IconButton = forwardRef<HTMLButtonElement, BtnProps & { label: string }>(function IconButton({ icon, label, className, ...rest }, ref) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.92 }}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors duration-fast hover:border-foreground/40 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...(rest as MotionBtnRest)}
    >
      {icon ? <Icon icon={icon} size={20} /> : null}
    </motion.button>
  );
});

/* ─── Floating chips over imagery ─────────────────────────────────────── */

export function RatingChip({ value, className }: { value: number; className?: string }) {
  // Editorial score from HelloSky (not user reviews); labelled so it cannot be
  // mistaken for customer ratings (OTA-178).
  const label = `HelloSky-favoritt ${value.toFixed(1)} av 5 (redaksjonell vurdering)`;
  return (
    <span
      title={label}
      aria-label={label}
      className={cn("inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-[12px] font-semibold text-foreground shadow-soft backdrop-blur-sm", className)}
    >
      <Icon icon={Star} size={14} className="fill-[hsl(var(--primary))] text-[hsl(var(--primary))]" />
      <span aria-hidden="true">Vår favoritt</span>
    </span>
  );
}

/** Small floating label over photos (e.g. "Populær", IATA). */
export function ImageBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md bg-night/75 px-2 py-1 font-mono-label text-[10px] text-white backdrop-blur-sm", className)}>
      {children}
    </span>
  );
}

export function FavoriteButton({ active, onToggle, label, className }: { active: boolean; onToggle: () => void; label: string; className?: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-soft backdrop-blur-sm transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active ? "text-[hsl(var(--coral))]" : "text-foreground",
        className,
      )}
    >
      <Icon icon={Heart} size={20} className={active ? "fill-current" : undefined} />
    </motion.button>
  );
}

/* ─── States ──────────────────────────────────────────────────────────── */

export function EmptyState({ icon, illustration, title, body, action }: { icon?: LucideIcon; illustration?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-6 py-12 text-center">
      {illustration ? (
        <div className="mb-1">{illustration}</div>
      ) : icon ? (
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-card text-muted-foreground shadow-soft">
          <Icon icon={icon} size={24} />
        </span>
      ) : null}
      <p className="font-display text-xl">{title}</p>
      {body ? <p className="max-w-sm text-sm text-muted-foreground">{body}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ title = "Noe gikk galt", body, onRetry }: { title?: string; body?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-12 text-center">
      <p className="font-display text-xl">{title}</p>
      {body ? <p className="max-w-sm text-sm text-muted-foreground">{body}</p> : null}
      {onRetry ? (
        <SecondaryButton onClick={onRetry} className="mt-2">
          Prøv igjen
        </SecondaryButton>
      ) : null}
    </div>
  );
}
