import type { CabinClass } from "@contracts/types";
import { addDays, fromIsoDate, toIsoDate } from "./format";
import { CABINS, CHILD_AGES, INFANT_AGES, MAX_PASSENGERS, initialForm, type AirportChoice, type SearchForm } from "./searchForm";

/**
 * Søkeutkastet på telefonen (localStore): bare skjemaet – flyplasser, datoer,
 * reisende og klasse. Aldri token, navn eller e-post. Leses ved oppstart,
 * sjekkes felt for felt, og en dato som har passert flyttes fram.
 */
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const IATA = /^[A-Z]{3}$/;

function airport(v: unknown): AirportChoice | null {
  if (!v || typeof v !== "object") return null;
  const a = v as Record<string, unknown>;
  if (typeof a.iata !== "string" || !IATA.test(a.iata)) return null;
  const str = (x: unknown) => (typeof x === "string" ? x.slice(0, 120) : "");
  return { iata: a.iata, name: str(a.name), city: str(a.city) || a.iata, country: str(a.country) };
}

const ints = (v: unknown, allowed: readonly number[]): number[] | null =>
  Array.isArray(v) && v.every((n) => typeof n === "number" && allowed.includes(n)) ? (v as number[]) : null;

/**
 * Et gyldig, oppdatert utkast – eller null (da brukes standardskjemaet).
 * `keepPastDates`: behold datoene som de var (nylige søk viser da at de har
 * passert, i stedet for å flytte reisen i det stille).
 */
export function parseDraft(raw: unknown, today: Date = new Date(), { keepPastDates = false }: { keepPastDates?: boolean } = {}): SearchForm | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const base = initialForm(today);
  const tripType = d.tripType === "oneway" || d.tripType === "roundtrip" ? d.tripType : null;
  const adults = typeof d.adults === "number" && Number.isInteger(d.adults) && d.adults >= 1 && d.adults <= MAX_PASSENGERS ? d.adults : null;
  const childAges = ints(d.childAges, CHILD_AGES);
  const infantAges = ints(d.infantAges, INFANT_AGES);
  const cabinClass = CABINS.includes(d.cabinClass as CabinClass) ? (d.cabinClass as CabinClass) : null;
  if (!tripType || !adults || !childAges || !infantAges || !cabinClass) return null;
  if (adults + childAges.length + infantAges.length > MAX_PASSENGERS || infantAges.length > adults) return null;

  let departDate = typeof d.departDate === "string" && ISO.test(d.departDate) ? d.departDate : base.departDate;
  let returnDate = typeof d.returnDate === "string" && ISO.test(d.returnDate) ? d.returnDate : addDays(departDate, 7);
  const todayIso = toIsoDate(today);
  if (departDate < todayIso && !keepPastDates) {
    // Datoen har passert: flytt reisen fram til standarddatoen, med samme lengde.
    const length = Math.max(0, Math.round((fromIsoDate(returnDate).getTime() - fromIsoDate(departDate).getTime()) / 86_400_000));
    departDate = base.departDate;
    returnDate = addDays(departDate, length || 7);
  }
  if (returnDate < departDate) returnDate = addDays(departDate, 7);

  return {
    tripType,
    origin: airport(d.origin),
    destination: airport(d.destination),
    departDate,
    returnDate,
    adults,
    childAges,
    infantAges,
    cabinClass,
    directOnly: d.directOnly === true,
  };
}
