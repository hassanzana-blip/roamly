import type { FareCondition, Offer } from "@contracts/types";
import type { I18n } from "../i18n";
import type { SellerKind, TripKind } from "../i18n/ns/offer";

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

export function handoffLabel(h: Extract<Handoff, { kind: "external" }>, { t }: Pick<I18n, "t">): string {
  return t.offer.handoff(h.providerName);
}

export function sellerKindLabel(kind: SellerKind, { t }: Pick<I18n, "t">): string {
  return t.offer.sellerKinds[kind];
}

// ─── Vilkår: bare det leverandøren faktisk oppga ────────────────────────────

export type ConditionFact = { key: "refund" | "change"; label: string; value: string; state: "allowed" | "fee" | "not_allowed" };

/**
 * Bare om endring/refusjon er tillatt. Gebyrbeløp vises aldri: de kan være i
 * annen valuta, og appen viser bare kroner (kildekodetesten sperrer feltene).
 */
function conditionState(c: FareCondition): ConditionFact["state"] {
  if (!c.allowed) return "not_allowed";
  // Serveren sier om et gebyr gjelder; beløpet leses aldri (bare kroner i appen).
  return c.feeApplies ? "fee" : "allowed";
}

function conditionFact(key: ConditionFact["key"], label: string, c: FareCondition, { t }: Pick<I18n, "t">): ConditionFact {
  const state = conditionState(c);
  const w = t.offer.conditions;
  return { key, label, state, value: state === "fee" ? w.allowedFee : state === "allowed" ? w.allowed : w.notAllowed };
}

/**
 * Endring og refusjon før avreise – kun fra `conditions`. Tilbudets
 * `refundable`/`changeable` er false også når leverandøren ikke sa noe, så de
 * brukes aldri alene til å si «kan ikke refunderes».
 */
export function conditionFacts(offer: Offer, i18n: Pick<I18n, "t">): ConditionFact[] {
  const out: ConditionFact[] = [];
  const c = offer.conditions;
  const t = i18n.t.offer.conditions;
  if (c?.refundBeforeDeparture) out.push(conditionFact("refund", t.refund, c.refundBeforeDeparture, i18n));
  if (c?.changeBeforeDeparture) out.push(conditionFact("change", t.change, c.changeBeforeDeparture, i18n));
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
export function baggageFacts(offer: Offer, { t }: Pick<I18n, "t">): BagFact[] {
  const b = offer.baggage;
  const w = t.offer.bags;
  const fact = (key: BagFact["key"], label: string, count: number, unknown: boolean | undefined): BagFact => {
    if (unknown) return { key, label, state: "unknown", value: w.unknown };
    if (count > 0) return { key, label, state: "included", value: count === 1 ? w.included : w.includedCount(count) };
    return { key, label, state: "not_included", value: w.notIncluded };
  };
  return [fact("carryOn", w.carryOn, b.carryOnBags, b.carryOnUnknown), fact("checked", w.checked, b.checkedBags, b.checkedUnknown)];
}

/** Kort bagasjelinje til resultatkortet. */
export function baggageShort(f: BagFact, { t }: Pick<I18n, "t">): string {
  if (f.state === "unknown") return t.offer.bags.shortUnknown(f.label);
  if (f.state === "included") return t.offer.bags.shortIncluded(f.label);
  return t.offer.bags.shortNotIncluded(f.label);
}

/**
 * Samme opplysning, kortere, på resultatkortet: bare «inkludert» forkortes
 * («inkl.»). «Uten …» og «ikke oppgitt» skrives alltid helt ut.
 */
export function baggageCard(f: BagFact, i18n: Pick<I18n, "t">): string {
  return f.state === "included" ? i18n.t.offer.bags.cardIncluded(f.label) : baggageShort(f, i18n);
}

/** Innsjekket bagasje er med i prisen ifølge tilbyderen (til filteret). */
export function checkedBagIncluded(offer: Offer): boolean {
  return !offer.baggage.checkedUnknown && offer.baggage.checkedBags > 0;
}

// ─── Hva prisen gjelder ─────────────────────────────────────────────────────

/** «1 voksen», «2 voksne, 1 barn» / «2 adults, 1 child» – fra tilbudets egne passasjerer. */
export function travellersOf(offer: Offer, { t }: Pick<I18n, "t">): string {
  const count = (type: string) => offer.passengers.filter((p) => p.type === type).length;
  const adults = count("adult");
  const children = count("child");
  const infants = offer.passengers.filter((p) => p.type.startsWith("infant")).length;
  const parts = [t.offer.adults(adults)];
  if (children) parts.push(t.offer.children(children));
  if (infants) parts.push(t.offer.infants(infants));
  return parts.join(", ");
}

export function tripKind(offer: Offer): TripKind {
  if (offer.slices.length === 1) return "oneway";
  const first = offer.slices[0]!;
  const last = offer.slices[offer.slices.length - 1]!;
  return offer.slices.length === 2 && last.destination.iata === first.origin.iata ? "roundtrip" : "multi";
}

export function tripKindLabel(offer: Offer, { t }: Pick<I18n, "t">): string {
  return t.offer.tripKinds[tripKind(offer)];
}

/**
 * «Totalt for …» bare når serveren har bekreftet at prisen gjelder alle reisende (se totalConfirmed); ellers
 * «Tilbyderens pris, total ikke bekreftet». Beløpet er det samme – det ganges aldri opp.
 */
export function priceBasis(offer: Offer, i18n: Pick<I18n, "t">, totalConfirmed = true): string {
  return totalConfirmed ? i18n.t.offer.priceBasis(travellersOf(offer, i18n), tripKindLabel(offer, i18n)) : i18n.t.offer.priceBasisUnverified(tripKindLabel(offer, i18n));
}

/**
 * Kortversjonen på resultatkortet: begge strekningene står på kortet, så reisetypen («Tur-retur») gjentas ikke der.
 * «Totalt for …» står fortsatt ved hvert beløp; VoiceOver og flydetaljene får hele grunnlaget (priceBasis).
 */
export function priceBasisCard(offer: Offer, i18n: Pick<I18n, "t">, totalConfirmed = true): string {
  return totalConfirmed ? i18n.t.offer.priceBasisCard(travellersOf(offer, i18n)) : i18n.t.offer.priceBasisUnverifiedCard;
}
