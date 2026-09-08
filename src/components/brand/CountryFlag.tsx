import { cn } from "@/lib/utils";

/**
 * Landflagg som SVG, servert som statisk fil fra /flags.
 *
 * Flaggene er hentet fra flag-icons (MIT) og lagt i public/flags – bare de
 * landene HelloSky faktisk viser. Ingenting av dette havner i JS-bunten, og
 * hvert flagg lastes først når det vises.
 *
 * Flagg er orientering, ikke pynt: bruk dem der landet er informasjon
 * (flyplassvelger, ruter, reisehistorikk), aldri som dekor.
 */

/** Landene vi har flagg for. Mangler et land, viser vi ingenting i stedet for feil flagg. */
const AVAILABLE = new Set([
  "ae", "af", "ar", "at", "au", "bd", "br", "ca", "ch", "cz", "de", "dk", "ee", "er", "es", "et", "fi", "fr", "gb", "gr",
  "hk", "hu", "ie", "in", "iq", "is", "it", "jp", "kr", "lb", "lk", "lt", "lv", "ma", "mx", "nl", "no", "pk", "pl", "pt",
  "qa", "sa", "se", "sg", "so", "sy", "th", "tr", "us", "za",
]);

export default function CountryFlag({
  code,
  countryName,
  size = 16,
  className,
}: {
  /** ISO 3166-1 alpha-2, f.eks. "NO", "IQ", "TR". */
  code: string | null | undefined;
  /** Landets navn. Uten navn er flagget dekorativt og skjules for skjermlesere. */
  countryName?: string;
  /** Høyde i piksler; bredden følger 4:3 og strekkes aldri. */
  size?: number;
  className?: string;
}) {
  const cc = code?.toLowerCase();
  if (!cc || !AVAILABLE.has(cc)) return null;
  return (
    <img
      src={`/flags/${cc}.svg`}
      alt={countryName ?? ""}
      aria-hidden={countryName ? undefined : "true"}
      loading="lazy"
      decoding="async"
      width={Math.round((size * 4) / 3)}
      height={size}
      style={{ height: size, width: Math.round((size * 4) / 3) }}
      className={cn("shrink-0 rounded-[2px] object-cover ring-1 ring-inset ring-foreground/10", className)}
    />
  );
}
