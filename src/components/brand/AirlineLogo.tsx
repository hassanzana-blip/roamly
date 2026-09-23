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
 *
 * Monogrammet er ikke en logo og skal ikke se ut som en. Men det skal se
 * bevisst ut, ikke ødelagt: selskapets egen merkefarge er et faktum vi kan
 * bruke uten å tegne et merke vi ikke har rett til.
 */

/**
 * Merkefarger for selskapene nordiske reisende faktisk møter. Brukes bare
 * som bakgrunn bak IATA-koden når leverandøren ikke sender logo. Står
 * selskapet ikke her, blir flaten nøytral – vi gjetter ikke en farge.
 */
const BRAND_TINT: Record<string, { bg: string; fg: string }> = {
  DY: { bg: "#D81939", fg: "#FFFFFF" },
  D8: { bg: "#D81939", fg: "#FFFFFF" },
  SK: { bg: "#003D87", fg: "#FFFFFF" },
  WF: { bg: "#004B87", fg: "#FFFFFF" },
  BA: { bg: "#075AAA", fg: "#FFFFFF" },
  KL: { bg: "#00A1DE", fg: "#FFFFFF" },
  AF: { bg: "#002157", fg: "#FFFFFF" },
  LH: { bg: "#05164D", fg: "#FFFFFF" },
  LX: { bg: "#E30613", fg: "#FFFFFF" },
  OS: { bg: "#E30613", fg: "#FFFFFF" },
  AY: { bg: "#0B1560", fg: "#FFFFFF" },
  TK: { bg: "#C70A0C", fg: "#FFFFFF" },
  QR: { bg: "#5C0632", fg: "#FFFFFF" },
  EK: { bg: "#D71921", fg: "#FFFFFF" },
  FR: { bg: "#073590", fg: "#FFFFFF" },
  W6: { bg: "#C6007E", fg: "#FFFFFF" },
  U2: { bg: "#FF6600", fg: "#FFFFFF" },
  LO: { bg: "#11397E", fg: "#FFFFFF" },
  IB: { bg: "#D7192D", fg: "#FFFFFF" },
  TP: { bg: "#008F4C", fg: "#FFFFFF" },
  AZ: { bg: "#00874E", fg: "#FFFFFF" },
  SN: { bg: "#00A0DF", fg: "#FFFFFF" },
  DL: { bg: "#003268", fg: "#FFFFFF" },
  UA: { bg: "#002244", fg: "#FFFFFF" },
  AA: { bg: "#0078D2", fg: "#FFFFFF" },
};

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

  // Monogram: rolig flate, tabulære bokstaver, ingen påstand om et merke vi
  // ikke har – men i selskapets egen farge når vi kjenner den.
  const tint = BRAND_TINT[code];
  return (
    <span
      role="img"
      aria-label={airline.name || code}
      title={airline.name || undefined}
      style={{
        height: size,
        width: size,
        fontSize: Math.max(11, Math.round(size * 0.38)),
        ...(tint ? { backgroundColor: tint.bg, color: tint.fg } : {}),
      }}
      className={cn(
        "grid shrink-0 place-items-center rounded-lg font-bold leading-none tracking-[0.02em]",
        tint ? "" : "bg-muted text-foreground",
        className,
      )}
    >
      {code || "–"}
    </span>
  );
}
