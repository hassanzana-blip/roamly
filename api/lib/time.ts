import { DateTime } from "luxon";
import { airportByIata } from "../../contracts/airports";

// ─── Tidssoner for segmenter (OTA-B9) ───────────────────────────────────────
// Leverandøren (og demo) gir avgang/ankomst som LOKAL veggklokke uten offset
// ("2026-10-01T10:30:00"). Date.parse() tolker slike som serverens lokaltid —
// feil i produksjon (UTC). Her tolkes de i flyplassens IANA-sone. Strenger MED
// offset/Z beholder sitt tidspunkt uansett sone.

export const DEFAULT_ZONE = "UTC";

/** Sone for et segmentpunkt: eksplisitt sone fra leverandøren > flyplassregister > UTC. */
export function zoneFor(iata: string | null | undefined, explicit?: string | null): string {
  if (explicit && DateTime.local().setZone(explicit).isValid) return explicit;
  const tz = iata ? airportByIata(iata)?.timeZone : undefined;
  return tz ?? DEFAULT_ZONE;
}

/**
 * ISO-tidspunkt for et segment → epoch-millisekunder. `tz` brukes KUN når
 * strengen mangler offset. Ugyldig input → null (aldri NaN videre i logikk).
 */
export function segmentInstant(iso: string | null | undefined, tz?: string | null): number | null {
  if (!iso) return null;
  const zone = tz && DateTime.local().setZone(tz).isValid ? tz : DEFAULT_ZONE;
  const dt = DateTime.fromISO(iso, { zone });
  return dt.isValid ? dt.toMillis() : null;
}

/** Lokal veggklokke (ISO uten offset) for visning/varsler i flyplassens sone. */
export function segmentLocal(iso: string | null | undefined, tz?: string | null): string | null {
  const ms = segmentInstant(iso, tz);
  if (ms === null) return null;
  const zone = tz && DateTime.local().setZone(tz).isValid ? tz : DEFAULT_ZONE;
  return DateTime.fromMillis(ms, { zone }).toISO({ includeOffset: false, suppressMilliseconds: true });
}
