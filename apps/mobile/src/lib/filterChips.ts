import type { I18n } from "../i18n";
import { TIME_BANDS, type AirlineOption, type BandKey, type ResultsView } from "./resultsView";

export type ActiveFilterChip = {
  key: string;
  label: string;
  /** VoiceOver: «Fjern filter: …». */
  spoken: string;
  /** Visningen uten dette filteret. */
  clear: (v: ResultsView) => ResultsView;
};

const BAND_KEYS: readonly BandKey[] = ["departBands", "arriveBands", "returnBands", "returnArriveBands"];
const BAND_ORDER = TIME_BANDS.map((b) => b.value);

/**
 * Filtrene som settes i arket – tider, flyselskaper, mellomlandinger, pris og reisetid – som brikker over listen når
 * arket er lukket, så kunden ser hva som skjuler reiser. Et trykk fjerner filteret. Direkte, maks 1 og bagasje har
 * egne brikker og står ikke her.
 */
export function activeFilterChips(v: ResultsView, ctx: { airlines: AirlineOption[]; roundTrip: boolean }, i18n: I18n): ActiveFilterChip[] {
  const { t, f } = i18n;
  const a = t.results.screen.active;
  const out: ActiveFilterChip[] = [];
  const add = (key: string, label: string, clear: (v: ResultsView) => ResultsView) => out.push({ key, label, spoken: a.remove(label), clear });

  for (const key of BAND_KEYS) {
    const bands = BAND_ORDER.filter((b) => v[key].includes(b));
    if (!bands.length) continue;
    // Én vei: bare «Avgang»/«Ankomst» – det finnes ingen hjemreise å skille fra.
    const what = ctx.roundTrip ? a.what[key] : key === "arriveBands" ? a.what.arrive : a.what.depart;
    const list = bands.length > 2 ? a.bandsMany(bands.length) : bands.map((b) => t.results.bands[b].toLowerCase()).join(", ");
    add(key, a.time(what, list), (x) => ({ ...x, [key]: [] }));
  }
  if (v.airlines.length) {
    const names = v.airlines.map((iata) => ctx.airlines.find((o) => o.iata === iata)?.name || iata);
    add("airlines", names.length > 2 ? a.airlinesMany(names.length) : names.join(", "), (x) => ({ ...x, airlines: [] }));
  }
  if (v.avoidConnections.length) {
    const codes = v.avoidConnections;
    add("via", codes.length > 2 ? a.viaMany(codes.length) : a.via(codes.join(", ")), (x) => ({ ...x, avoidConnections: [] }));
  }
  if (v.maxPriceMinor !== null) add("price", t.results.screen.upTo(f.nok(v.maxPriceMinor)), (x) => ({ ...x, maxPriceMinor: null }));
  if (v.maxLegMinutes !== null) add("leg", a.leg(f.duration(v.maxLegMinutes)), (x) => ({ ...x, maxLegMinutes: null }));
  return out;
}
