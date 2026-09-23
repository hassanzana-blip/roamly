import type { FareCondition, Offer } from "@contracts/types";

/**
 * Fakta om et tilbud slik appen viser dem. Alt her kommer fra leverandørens
 * data; det som ikke er oppgitt, sies å ikke være oppgitt – aldri gjettet.
 *
 * HelloSky utsteder ingen billett i appen. Et tilbud en ekstern leverandør
 * selger (i dag KAYAK) åpnes hos leverandøren via deres egen, urørte
 * klikklenke; bestillingen fullføres der.
 */

/** Hvem som selger billetten, når leverandøren oppgir det; ellers null. */
export function sellerName(offer: Offer): string | null {
  const b = offer.booking;
  if (!b || b.kind !== "external") return null;
  const name = b.provider?.name?.trim();
  return name ? name : null;
}

/** Tilbudet er eldre enn leverandørens gyldighetstid, så prisen kan ha endret seg. */
export function offerExpired(offer: Offer, now: Date = new Date()): boolean {
  const t = Date.parse(offer.expiresAt);
  return Number.isFinite(t) && t < now.getTime();
}

// ─── Videre til leverandøren ────────────────────────────────────────────────

const SAFE_HTTPS = /^https:\/\/[A-Za-z0-9.-]+(:\d+)?(\/[^\s]*)?$/;
const CONTROL = /[\u0000-\u001F\u007F]/;

export type Handoff =
  | { kind: "external"; url: string; providerName: string; sellerKind: "airline" | "agency" | "unknown"; logoUrl: string | null; disclosure: string | null }
  | { kind: "not_in_app" }
  | { kind: "invalid_link" };

/**
 * Hvor kunden kan gå videre. Bare leverandørens egen https-lenke, urørt;
 * alt annet (http, mellomrom, kontrolltegn, brukerinfo) åpnes ikke.
 */
export function providerHandoff(offer: Offer): Handoff {
  const b = offer.booking;
  if (!b || b.kind !== "external") return { kind: "not_in_app" };
  if (typeof b.url !== "string" || CONTROL.test(b.url) || !SAFE_HTTPS.test(b.url)) return { kind: "invalid_link" };
  return {
    kind: "external",
    url: b.url,
    providerName: b.provider.name.trim() || offer.owner.name,
    sellerKind: b.sellerKind,
    logoUrl: b.provider.logoUrl && /^https:\/\//.test(b.provider.logoUrl) ? b.provider.logoUrl : null,
    disclosure: b.disclosure?.trim() || null,
  };
}

export function handoffLabel(h: Extract<Handoff, { kind: "external" }>): string {
  return `Se tilbud hos ${h.providerName}`;
}

export function sellerKindLabel(kind: "airline" | "agency" | "unknown"): string {
  return kind === "airline" ? "Flyselskap" : kind === "agency" ? "Reisebyrå" : "Tilbyder";
}

// ─── Vilkår: bare det leverandøren faktisk oppga ────────────────────────────

export type ConditionFact = { key: "refund" | "change"; label: string; value: string; allowed: boolean };

/**
 * Bare om endring/refusjon er tillatt. Gebyrbeløp vises aldri: de kan være i
 * annen valuta, og appen viser bare kroner (kildekodetesten sperrer feltene).
 */
function conditionText(c: FareCondition): string {
  return c.allowed ? "Tillatt ifølge tilbyderen" : "Ikke tillatt";
}

/**
 * Endring og refusjon før avreise – kun fra `conditions`. Tilbudets
 * `refundable`/`changeable` er false også når leverandøren ikke sa noe, så de
 * brukes aldri alene til å si «kan ikke refunderes».
 */
export function conditionFacts(offer: Offer): ConditionFact[] {
  const out: ConditionFact[] = [];
  const c = offer.conditions;
  if (c?.refundBeforeDeparture) out.push({ key: "refund", label: "Refusjon før avreise", value: conditionText(c.refundBeforeDeparture), allowed: c.refundBeforeDeparture.allowed });
  if (c?.changeBeforeDeparture) out.push({ key: "change", label: "Endring før avreise", value: conditionText(c.changeBeforeDeparture), allowed: c.changeBeforeDeparture.allowed });
  return out;
}

// ─── Bagasje ────────────────────────────────────────────────────────────────

export type BagState = "included" | "not_included" | "unknown";
export type BagFact = { key: "carryOn" | "checked"; label: string; state: BagState; value: string };

/**
 * Håndbagasje og innsjekket bagasje per reisende, slik leverandøren oppga.
 * «Ikke oppgitt» er ikke det samme som «ikke inkludert». Leverandøren skiller
 * ikke liten veske fra kabinkoffert, så det gjør heller ikke appen.
 */
export function baggageFacts(offer: Offer): BagFact[] {
  const b = offer.baggage;
  const fact = (key: BagFact["key"], label: string, count: number, unknown: boolean | undefined): BagFact => {
    if (unknown) return { key, label, state: "unknown", value: "Ikke oppgitt" };
    if (count > 0) return { key, label, state: "included", value: count === 1 ? "Inkludert" : `${count} stk. inkludert` };
    return { key, label, state: "not_included", value: "Ikke inkludert" };
  };
  return [fact("carryOn", "Håndbagasje", b.carryOnBags, b.carryOnUnknown), fact("checked", "Innsjekket bagasje", b.checkedBags, b.checkedUnknown)];
}

/** Kort bagasjelinje til resultatkortet. */
export function baggageShort(f: BagFact): string {
  if (f.state === "unknown") return `${f.label}: ikke oppgitt`;
  if (f.state === "included") return `${f.label} inkludert`;
  return `Uten ${f.label.toLowerCase()}`;
}

/** Innsjekket bagasje er med i prisen ifølge tilbyderen (til filteret). */
export function checkedBagIncluded(offer: Offer): boolean {
  return !offer.baggage.checkedUnknown && offer.baggage.checkedBags > 0;
}

// ─── Hva prisen gjelder ─────────────────────────────────────────────────────

/** «1 voksen», «2 voksne, 1 barn» – fra tilbudets egne passasjerer. */
export function travellersOf(offer: Offer): string {
  const count = (t: string) => offer.passengers.filter((p) => p.type === t).length;
  const adults = count("adult");
  const children = count("child");
  const infants = offer.passengers.filter((p) => p.type.startsWith("infant")).length;
  const parts = [`${adults} ${adults === 1 ? "voksen" : "voksne"}`];
  if (children) parts.push(`${children} barn`);
  if (infants) parts.push(`${infants} spedbarn`);
  return parts.join(", ");
}

export function tripKind(offer: Offer): "Tur-retur" | "Én vei" | "Flere strekninger" {
  if (offer.slices.length === 1) return "Én vei";
  const first = offer.slices[0]!;
  const last = offer.slices[offer.slices.length - 1]!;
  return offer.slices.length === 2 && last.destination.iata === first.origin.iata ? "Tur-retur" : "Flere strekninger";
}

/**
 * Prisen er totalen for alle reisende (KAYAK spørres med priceMode=total;
 * Duffel oppgir total_amount). Aldri «per person».
 */
export function priceBasis(offer: Offer): string {
  return `Totalt for ${travellersOf(offer)} · ${tripKind(offer)}`;
}
