import { motion, useReducedMotion } from "motion/react";
import SkyMark from "@/components/brand/SkyMark";
import { cn } from "@/lib/utils";

/**
 * Digitalt HelloSky-kort. Identitet, ikke betaling: navn, nivå, medlemsnummer
 * og programnavn. Aldri saldo, aldri noe som ligner et kortnummer.
 * Kortet er mørkt med én lime-detalj — brand-øyeblikket i profilen.
 */
export default function MembershipCard({
  name,
  programName,
  tierName,
  memberNumber,
  memberSince,
  className,
  compact = false,
}: {
  name: string;
  programName: string;
  tierName: string;
  memberNumber: string;
  memberSince: string | null;
  className?: string;
  compact?: boolean;
}) {
  const reduce = useReducedMotion();
  const since = memberSince ? new Date(memberSince).getFullYear() : null;
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(
        "relative w-full overflow-hidden rounded-2xl bg-night text-white shadow-lift",
        compact ? "aspect-[1.9/1]" : "aspect-[1.586/1] max-w-md",
        className,
      )}
      role="img"
      aria-label={`${programName}: ${name}, ${tierName}, medlemsnummer ${memberNumber}`}
    >
      {/* Én stor, stille bue — merket som landskap, ikke som logo. */}
      <SkyMark className="absolute -right-10 -top-16 h-[150%] w-auto text-primary opacity-[0.16]" aria-hidden="true" />
      <div className="relative flex h-full flex-col justify-between p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <SkyMark className="h-6 w-6 text-white" />
            <span className="text-[17px] font-extrabold lowercase tracking-tight">hellosky</span>
          </div>
          <span className="rounded-md border border-white/20 px-2 py-0.5 font-mono-label text-[10px] uppercase tracking-[0.16em] text-white/85">{tierName}</span>
        </div>
        <div>
          <p className="font-mono-label text-[10px] uppercase tracking-[0.18em] text-primary">{programName}</p>
          <p className={cn("font-display leading-tight", compact ? "mt-1 text-xl" : "mt-1.5 text-2xl sm:text-3xl")}>{name}</p>
          <div className="mt-3 flex items-end justify-between gap-3 text-[11px] text-white/70">
            <span className="font-mono tracking-[0.14em]">{memberNumber}</span>
            {since && <span>Medlem siden {since}</span>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
