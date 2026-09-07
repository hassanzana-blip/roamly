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

/** Lime CTA — the single vivid action of a screen. ≥48px target. */
export const PrimaryButton = forwardRef<HTMLButtonElement, BtnProps>(
  function PrimaryButton({ icon, className, children, ...rest }, ref) {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.97 }}
        className={cn(
          "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[15px] font-bold text-primary-foreground transition-colors duration-200 hover:bg-[hsl(74,93%,50%)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
        {...(rest as MotionBtnRest)}
      >
        {icon ? <Icon icon={icon} size={20} /> : null}
        {children}
      </motion.button>
    );
  },
);

/** Quiet dark action — near-black pill. */
export const SecondaryButton = forwardRef<HTMLButtonElement, BtnProps>(
  function SecondaryButton({ icon, className, children, ...rest }, ref) {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.97 }}
        className={cn(
          "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-night px-6 text-[15px] font-semibold text-white transition-colors duration-200 hover:bg-[hsl(240,6%,16%)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
        {...(rest as MotionBtnRest)}
      >
        {icon ? <Icon icon={icon} size={20} /> : null}
        {children}
      </motion.button>
    );
  },
);

/** Round outline icon button — 44px touch target. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  BtnProps & { label: string }
>(function IconButton({ icon, label, className, ...rest }, ref) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.9 }}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-white text-foreground transition-colors duration-200 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
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
  // Redaksjonell score fra HelloSky (ikke brukeranmeldelser) — merkes tydelig
  // slik at den ikke kan forveksles med kundevurderinger (OTA-178).
  const label = `HelloSky-favoritt ${value.toFixed(1)} av 5 (redaksjonell vurdering)`;
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-bold text-foreground shadow-soft backdrop-blur-sm",
        className,
      )}
    >
      <Icon icon={Star} size={14} className="fill-[hsl(var(--primary))] text-[hsl(var(--skyline))]" />
      <span aria-hidden="true">Vår favoritt</span>
    </span>
  );
}

/** Small floating label over photos (e.g. "Populær", IATA). */
export function ImageBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-night/80 px-2.5 py-1 font-mono-label text-[10px] text-white backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function FavoriteButton({
  active,
  onToggle,
  label,
  className,
}: {
  active: boolean;
  onToggle: () => void;
  label: string;
  className?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.82 }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-soft backdrop-blur-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active ? "text-[hsl(var(--coral))]" : "text-foreground",
        className,
      )}
    >
      <Icon icon={Heart} size={20} className={active ? "fill-current" : undefined} />
    </motion.button>
  );
}

/* ─── States ──────────────────────────────────────────────────────────── */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-muted/40 px-6 py-12 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-muted-foreground shadow-soft">
        <Icon icon={icon} size={24} />
      </span>
      <p className="font-display text-lg">{title}</p>
      {body ? <p className="max-w-sm text-sm text-muted-foreground">{body}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Noe gikk galt",
  body,
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-white px-6 py-12 text-center">
      <p className="font-display text-lg">{title}</p>
      {body ? <p className="max-w-sm text-sm text-muted-foreground">{body}</p> : null}
      {onRetry ? (
        <SecondaryButton onClick={onRetry} className="mt-2">
          Prøv igjen
        </SecondaryButton>
      ) : null}
    </div>
  );
}
