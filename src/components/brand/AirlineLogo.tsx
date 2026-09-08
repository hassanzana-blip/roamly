import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Flyselskapets identitet.
 *
 * Kilden er leverandøren selv: Duffel leverer flyselskapenes egne logoer som
 * SVG (`logo_symbol_url` for det kvadratiske merket, `logo_lockup_url` for
 * merke + navn). Vi viser dem – vi tegner dem ikke, og vi henter dem ikke fra
 * bildesøk. Uten logo fra leverandøren faller vi tilbake på et rent
 * IATA-monogram, som er en ærlig representasjon og ikke et gjettet merke.
 *
 * Logoen beholder alltid sitt eget sideforhold; rammen er kvadratisk og
 * bildet skaleres inn i den (`object-contain`), aldri strukket.
 */

export type AirlineIdentity = {
  /** IATA-kode, f.eks. "DY", "SK", "TK". Brukes til monogrammet. */
  iata: string;
  name: string;
  /** Kvadratisk merke fra leverandøren, når det finnes. */
  logoSymbolUrl?: string;
  /** Merke + navn fra leverandøren, når det finnes. */
  logoLockupUrl?: string;
};

export default function AirlineLogo({
  airline,
  size = 32,
  variant = "symbol",
  className,
}: {
  airline: AirlineIdentity;
  /** Høyde i piksler. */
  size?: number;
  /** `symbol` = kvadratisk merke. `lockup` = merke + navn, når leverandøren har det. */
  variant?: "symbol" | "lockup";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = variant === "lockup" ? airline.logoLockupUrl : airline.logoSymbolUrl;
  const code = (airline.iata || "").slice(0, 3).toUpperCase();

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={airline.name}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={{ height: size }}
        className={cn("w-auto max-w-full shrink-0 object-contain", className)}
      />
    );
  }

  // Monogram: rolig flate, tabulære bokstaver, ingen påstand om et merke vi ikke har.
  return (
    <span
      role="img"
      aria-label={airline.name || code}
      title={airline.name || undefined}
      style={{ height: size, width: size, fontSize: Math.max(10, Math.round(size * 0.34)) }}
      className={cn(
        "grid shrink-0 place-items-center rounded-lg bg-muted font-semibold tracking-[0.06em] text-foreground",
        className,
      )}
    >
      {code || "–"}
    </span>
  );
}
