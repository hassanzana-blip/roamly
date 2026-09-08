import { useState } from "react";
import { cn } from "@/lib/utils";
import { founderForName } from "@/content/team";

/**
 * Ansiktet til den som er logget inn.
 *
 * Er personen en av grunnleggerne, viser vi fotografiet. Ellers – og hvis
 * bildet ikke lastes – står initialene. Vi bytter aldri inn et vilkårlig
 * ansikt for å fylle sirkelen.
 */
export function Avatar({
  name,
  size = 32,
  className,
  ring = false,
}: {
  name: string;
  size?: 24 | 28 | 32 | 40 | 48 | 64;
  className?: string;
  /** Tynn lysende kant – brukes der avataren ligger på en mørk flate. */
  ring?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const founder = founderForName(name);
  const derived = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
  const initials = founder?.initials ?? (derived || "?");

  const box = cn(
    "relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-muted",
    ring && "ring-1 ring-white/20",
    className,
  );

  if (founder && !failed) {
    return (
      <span className={box} style={{ width: size, height: size }}>
        <img
          src={founder.avatar.src}
          srcSet={founder.avatar.srcSet}
          sizes={`${size}px`}
          width={size}
          height={size}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(box, "bg-night text-white")}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      <span className="font-semibold leading-none tracking-tight">{initials}</span>
    </span>
  );
}
