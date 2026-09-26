import type { SearchPassengerInput, SearchResult } from "../../contracts/types";
import type { MobilePriceBasis } from "../../contracts/mobileSearch";
import { passengerCode } from "./kayak";

// ─── Gjelder prisen alle reisende? ──────────────────────────────────────────
// KAYAK (developers.kayak.com, Flights Search API): PriceMode er «total» eller «perPerson», og standarden er
// «perPerson». PollResponse oppgir priceMode og antall reisende. BookingOption.displayPrice regnes med
// priceMode. Vi ber om «total», men et svar kalles bare en total for alle når svaret selv sier «total» og har
// priset nøyaktig de reisende kunden søkte for. Beløpene endres aldri, og ingenting ganges opp.
//
// Duffel (total_amount), Travelport (TotalPrice) og demo er totaler for hele tilbudet i sine egne kontrakter,
// uendret.

/** KAYAK-nøklene for antall reisende (PollResponse.passengers). INL = spedbarn på fanget = «infants». */
const KAYAK_COUNT_KEY = { ADT: "adults", CHD: "children", YTH: "youth", INL: "infants" } as const;
/** Nøkler som må finnes i svaret for at partiet kan sammenlignes. */
const REQUIRED_KEYS = Object.values(KAYAK_COUNT_KEY);

function expectedCounts(requested: readonly SearchPassengerInput[]): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(REQUIRED_KEYS.map((k) => [k, 0]));
  for (const p of requested) out[KAYAK_COUNT_KEY[passengerCode(p)]]! += 1;
  return out;
}

/** Stemmer reisende i svaret med søket? «missing» når antallene mangler eller ikke er fullstendige. */
function partyCheck(counts: Record<string, number> | null, requested: readonly SearchPassengerInput[]): "match" | "missing" | "mismatch" {
  if (!counts || REQUIRED_KEYS.some((k) => counts[k] === undefined)) return "missing";
  const want = expectedCounts(requested);
  for (const [k, n] of Object.entries(counts)) if ((want[k] ?? 0) !== n) return "mismatch";
  return "match";
}

export function priceBasisFor(result: Pick<SearchResult, "provider" | "priceBasis">, requested: readonly SearchPassengerInput[]): MobilePriceBasis {
  if (result.provider !== "kayak") return { kind: "total" };
  const basis = result.priceBasis;
  if (!basis || basis.mode === null) return { kind: "unverified", reason: "mode_missing" };
  const party = partyCheck(basis.passengers, requested);
  if (basis.mode === "total") {
    if (party === "match") return { kind: "total" };
    return { kind: "unverified", reason: party === "missing" ? "party_missing" : "party_mismatch" };
  }
  if (basis.mode === "perPerson") {
    // Én reisende, og svaret har priset nøyaktig den ene: prisen per person er da hele prisen.
    if (requested.length === 1 && party === "match") return { kind: "total" };
    return { kind: "unverified", reason: party === "match" ? "per_person" : party === "missing" ? "party_missing" : "party_mismatch" };
  }
  return { kind: "unverified", reason: "mode_unknown" };
}
