import type { I18nKey } from "@/lib/i18n";

/**
 * Valgene i reiseprofilen – én kilde for onboarding og innstillinger.
 * Etikettene er i18n-nøkler; verdiene matcher api/account.ts.
 */

export type TasteDimension = "beach" | "city" | "food" | "culture" | "nature" | "shopping" | "family" | "nightlife" | "luxury" | "adventure" | "calm" | "romantic" | "football" | "events";

export const TASTE: { id: TasteDimension; label: I18nKey; emoji: string }[] = [
  { id: "beach", label: "taste.beach", emoji: "🏖️" },
  { id: "city", label: "taste.city", emoji: "🏙️" },
  { id: "food", label: "taste.food", emoji: "🍽️" },
  { id: "culture", label: "taste.culture", emoji: "🏛️" },
  { id: "nature", label: "taste.nature", emoji: "🏔️" },
  { id: "shopping", label: "taste.shopping", emoji: "🛍️" },
  { id: "family", label: "taste.family", emoji: "👨‍👩‍👧" },
  { id: "nightlife", label: "taste.nightlife", emoji: "🌙" },
  { id: "luxury", label: "taste.luxury", emoji: "✨" },
  { id: "adventure", label: "taste.adventure", emoji: "🧭" },
  { id: "calm", label: "taste.calm", emoji: "🌿" },
  { id: "romantic", label: "taste.romantic", emoji: "💛" },
  { id: "football", label: "taste.football", emoji: "⚽" },
  { id: "events", label: "taste.events", emoji: "🎟️" },
];

export const BAGGAGE_OPTIONS: { id: "cabin_only" | "20kg" | "30kg" | "40kg"; label: I18nKey; sub: I18nKey; bags: number }[] = [
  { id: "cabin_only", label: "bagpref.cabin", sub: "bagpref.cabinsub", bags: 0 },
  { id: "20kg", label: "bagpref.20", sub: "bagpref.20sub", bags: 1 },
  { id: "30kg", label: "bagpref.30", sub: "bagpref.30sub", bags: 2 },
  { id: "40kg", label: "bagpref.40", sub: "bagpref.40sub", bags: 3 },
];

export const COMPANION_OPTIONS: { id: "solo" | "partner" | "family" | "friends"; label: I18nKey; sub: I18nKey }[] = [
  { id: "solo", label: "comp.solo", sub: "comp.solosub" },
  { id: "partner", label: "comp.partner", sub: "comp.partnersub" },
  { id: "family", label: "comp.family", sub: "comp.familysub" },
  { id: "friends", label: "comp.friends", sub: "comp.friendssub" },
];

export const CABIN_OPTIONS: { id: "economy" | "premium_economy" | "business" | "first"; label: I18nKey }[] = [
  { id: "economy", label: "cabin.economy" },
  { id: "premium_economy", label: "cabin.premium" },
  { id: "business", label: "cabin.business" },
  { id: "first", label: "cabin.first" },
];

export const SEAT_OPTIONS: { id: "window" | "aisle" | "together"; label: I18nKey }[] = [
  { id: "window", label: "seat.window" },
  { id: "aisle", label: "seat.aisle" },
  { id: "together", label: "seat.together" },
];

export const FLIGHT_PREF_OPTIONS: { id: "directPreferred" | "maxOneStop" | "avoidSelfTransfer" | "avoidAirportChange" | "shortLayovers" | "flexibleTickets" | "refundablePreferred"; label: I18nKey }[] = [
  { id: "directPreferred", label: "fp.direct" },
  { id: "maxOneStop", label: "fp.maxonestop" },
  { id: "avoidSelfTransfer", label: "fp.noselftransfer" },
  { id: "avoidAirportChange", label: "fp.noairportchange" },
  { id: "shortLayovers", label: "fp.shortlayovers" },
  { id: "flexibleTickets", label: "fp.flexible" },
  { id: "refundablePreferred", label: "fp.refundable" },
];

export const TIMING_PREF_OPTIONS: { id: "morningDeparture" | "daytimeArrival" | "avoidOvernightConnection"; label: I18nKey }[] = [
  { id: "morningDeparture", label: "tp.morning" },
  { id: "daytimeArrival", label: "tp.daytime" },
  { id: "avoidOvernightConnection", label: "tp.noovernight" },
];

/** Flyplassene folk i Norge oftest reiser fra – snarveier i onboarding; alt annet via søk. */
export const HOME_AIRPORT_SHORTCUTS = ["OSL", "TRF", "BGO", "SVG", "TRD", "TOS", "ARN", "GOT", "CPH"];
