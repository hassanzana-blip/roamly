import type { Offer } from "@contracts/types";

/**
 * Videresending til leverandøren.
 *
 * Bare tilbud leverandøren selv selger (booking.kind = "external", i dag
 * KAYAK) kan bestilles fra appen: kunden sendes til leverandørens egen lenke,
 * urørt. Lenken må være https og uten mellomrom eller kontrolltegn; alt annet
 * åpnes ikke. Tilbud HelloSky selger krever nettets kasse og har ingen
 * bestillingsknapp i appen ennå.
 */

const SAFE_HTTPS = /^https:\/\/[A-Za-z0-9.-]+(:\d+)?(\/[^\s]*)?$/;
const CONTROL = /[\u0000-\u001F\u007F]/;

export type BookingHandoff =
  | { kind: "external"; url: string; providerName: string; sellerKind: "airline" | "agency" | "unknown"; disclosure: string | null }
  | { kind: "not_in_app" }
  | { kind: "invalid_link" };

export function bookingHandoff(offer: Offer): BookingHandoff {
  const b = offer.booking;
  if (!b || b.kind !== "external") return { kind: "not_in_app" };
  if (typeof b.url !== "string" || CONTROL.test(b.url) || !SAFE_HTTPS.test(b.url)) return { kind: "invalid_link" };
  return { kind: "external", url: b.url, providerName: b.provider.name, sellerKind: b.sellerKind, disclosure: b.disclosure ?? null };
}

/** Knappetekst som sier hvor kunden havner. */
export function handoffLabel(h: Extract<BookingHandoff, { kind: "external" }>): string {
  return h.sellerKind === "airline" ? `Bestill hos ${h.providerName}` : `Se tilbudet hos ${h.providerName}`;
}

export function offerExpired(offer: Offer, now: Date = new Date()): boolean {
  const t = Date.parse(offer.expiresAt);
  return Number.isFinite(t) && t < now.getTime();
}
