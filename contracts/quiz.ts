// ─── ReiseMatch: delt mellom klient og server ────────────────────────────────
// Destinasjonene er kuratert innhold med tagger for hvem, stemning, vær, hva
// man ser og budsjett. Ingen priser eller tilgjengelighet påstås her —
// resultatet er inspirasjon med lenke til ekte søk. Serveren bruker samme
// poengregler til Par- og Vennematch, så et resultat betyr det samme overalt.

const img = (name: string) => `/destinations/${name}.jpg`;

export type Company = "solo" | "date" | "family" | "friends";
export type Mood = "romance" | "adventure" | "relax" | "city";
export type Weather = "hot" | "mild" | "cold" | "any";
export type Sights = "beach" | "landmarks" | "nature" | "food";
export type Budget = "low" | "mid" | "high";

export interface QuizAnswers {
  company?: Company;
  mood?: Mood;
  weather?: Weather;
  sights?: Sights;
  budget?: Budget;
}

export interface QuizDestination {
  id: string;
  city: string;
  country: string;
  iata: string;
  image: string;
  tagline: string;
  /** Romantisk idé — vises i "Vi to"-modus */
  romance: string;
  company: Company[];
  mood: Mood[];
  weather: Weather[];
  sights: Sights[];
  budget: Budget[];
}

export const QUIZ_DESTINATIONS: QuizDestination[] = [
  { id: "paris", city: "Paris", country: "Frankrike", iata: "CDG", image: img("paris"), tagline: "Byen over alle byer", romance: "Piknik ved Seinen mens Eiffeltårnet glitrer i mørket.", company: ["date", "friends", "solo"], mood: ["romance", "city"], weather: ["mild", "any"], sights: ["landmarks", "food"], budget: ["mid", "high"] },
  { id: "rome", city: "Roma", country: "Italia", iata: "FCO", image: img("rome"), tagline: "Den evige stad", romance: "Gelato på Den spanske trappen mens byen tenner lysene.", company: ["date", "family", "friends"], mood: ["city", "romance"], weather: ["mild", "hot"], sights: ["food", "landmarks"], budget: ["mid"] },
  { id: "athens", city: "Athen", country: "Hellas", iata: "ATH", image: img("athens"), tagline: "Antikk storby", romance: "Middag på en takterrasse med Akropolis opplyst i mørket.", company: ["friends", "family", "date"], mood: ["city", "adventure"], weather: ["hot", "mild"], sights: ["landmarks", "food"], budget: ["low", "mid"] },
  { id: "lisboa", city: "Lisboa", country: "Portugal", iata: "LIS", image: img("lisboa"), tagline: "Trikker og utsiktspunkter", romance: "Trikk 28 til Miradouro akkurat i gulltimen.", company: ["date", "friends", "solo"], mood: ["relax", "city"], weather: ["mild", "hot"], sights: ["landmarks", "food"], budget: ["low", "mid"] },
  { id: "malaga", city: "Málaga", country: "Spania", iata: "AGP", image: img("malaga"), tagline: "Costa del Sols hjerte", romance: "Solnedgang fra strandpromenaden med noe kaldt i glasset.", company: ["family", "friends", "date"], mood: ["relax"], weather: ["hot"], sights: ["beach", "food"], budget: ["low", "mid"] },
  { id: "barcelona", city: "Barcelona", country: "Spania", iata: "BCN", image: img("barcelona"), tagline: "By, strand og tapas", romance: "Tapas i det Gotiske kvarter, så nattbad i Barceloneta.", company: ["friends", "family", "date"], mood: ["city", "adventure"], weather: ["hot", "mild"], sights: ["beach", "landmarks", "food"], budget: ["mid"] },
  { id: "london", city: "London", country: "Storbritannia", iata: "LHR", image: img("london"), tagline: "Helgeklassikeren", romance: "Rooftop-bar over Themsen mens bylyset tenner.", company: ["friends", "solo", "family"], mood: ["city"], weather: ["any", "mild", "cold"], sights: ["landmarks"], budget: ["mid", "high"] },
  { id: "nyc", city: "New York", country: "USA", iata: "JFK", image: img("nyc"), tagline: "Storbyliv", romance: "Solnedgang fra Brooklyn Bridge Park med skyline som bakteppe.", company: ["friends", "solo", "date"], mood: ["city", "adventure"], weather: ["any"], sights: ["landmarks"], budget: ["high"] },
  { id: "dubai", city: "Dubai", country: "Emiratene", iata: "DXB", image: img("dubai"), tagline: "Vinterens solgaranti", romance: "Ørkensafari i solnedgang og middag under stjernene.", company: ["date", "family", "friends"], mood: ["relax", "adventure"], weather: ["hot"], sights: ["landmarks", "beach"], budget: ["high"] },
  { id: "bangkok", city: "Bangkok", country: "Thailand", iata: "BKK", image: img("bangkok"), tagline: "Gatekjøkken og templer", romance: "Longtail-båt på Chao Phraya i solnedgang.", company: ["friends", "solo"], mood: ["adventure", "city"], weather: ["hot"], sights: ["food", "landmarks"], budget: ["low"] },
  { id: "tokyo", city: "Tokyo", country: "Japan", iata: "HND", image: img("tokyo"), tagline: "Fremtid og tradisjon", romance: "Kirsebærblomster i Ueno-parken — hvis dere treffer sesongen.", company: ["solo", "friends", "date"], mood: ["city", "adventure"], weather: ["mild", "any"], sights: ["food", "landmarks"], budget: ["mid", "high"] },
  { id: "tromso", city: "Tromsø", country: "Norge", iata: "TOS", image: img("tromso"), tagline: "Nordlysbyen", romance: "Nordlys fra en varm utendørs badstue — bare dere to.", company: ["solo", "friends", "date"], mood: ["adventure"], weather: ["cold"], sights: ["nature"], budget: ["mid", "high"] },
  { id: "istanbul", city: "Istanbul", country: "Tyrkia", iata: "IST", image: img("istanbul"), tagline: "To kontinenter, én by", romance: "Ferge over Bosporos i gulltimen, te på dekk.", company: ["family", "friends", "solo"], mood: ["city", "adventure"], weather: ["mild", "hot", "any"], sights: ["food", "landmarks"], budget: ["low", "mid"] },
  { id: "marrakech", city: "Marrakech", country: "Marokko", iata: "RAK", image: img("marrakech"), tagline: "Medinaens magi", romance: "Mynte-te på en takterrasse over medinaens lys.", company: ["friends", "date", "solo"], mood: ["adventure", "city"], weather: ["hot", "mild"], sights: ["food", "landmarks"], budget: ["low", "mid"] },
  { id: "colombo", city: "Sri Lanka", country: "Sri Lanka", iata: "CMB", image: img("srilanka"), tagline: "Teåser og kyst", romance: "Togturen gjennom teåsene — omtalt som verdens vakreste.", company: ["solo", "friends", "family", "date"], mood: ["adventure", "relax"], weather: ["hot"], sights: ["nature", "beach", "food"], budget: ["low"] },
  { id: "warszawa", city: "Warszawa", country: "Polen", iata: "WAW", image: img("warsaw"), tagline: "Nær og kjær", romance: "Gamlebyen i kveldslys, to timer hjemmefra.", company: ["friends", "solo", "family"], mood: ["city"], weather: ["cold", "mild", "any"], sights: ["landmarks", "food"], budget: ["low"] },
];

/** Sterke romantikk-kandidater får et lite ekstra dytt i "Vi to"-modus. */
const ROMANTIC_FAVOURITES = new Set(["paris", "rome", "lisboa", "dubai", "tromso", "colombo"]);

export interface QuizResult {
  top: QuizDestination;
  alternatives: QuizDestination[];
  isCouple: boolean;
}

export function scoreQuiz(a: QuizAnswers): QuizResult {
  const scored = QUIZ_DESTINATIONS.map((d) => {
    let s = 0;
    if (a.mood && d.mood.includes(a.mood)) s += 3;
    if (a.sights && d.sights.includes(a.sights)) s += 3;
    if (a.weather && (a.weather === "any" ? true : d.weather.includes(a.weather))) s += 2;
    if (a.company && d.company.includes(a.company)) s += 2;
    if (a.budget && d.budget.includes(a.budget)) s += 1;
    const couple = a.company === "date" || a.mood === "romance";
    if (couple && ROMANTIC_FAVOURITES.has(d.id)) s += 1;
    return { d, s };
  });
  scored.sort((x, y) => y.s - x.s);
  const best = scored[0].s;
  // Trekk ut topp-scoreren + de to beste blant resten (unike byer)
  const winners = scored.filter((x) => x.s === best);
  const top = winners[0].d;
  const alternatives = scored
    .filter((x) => x.d.id !== top.id)
    .slice(0, 2)
    .map((x) => x.d);
  return { top, alternatives, isCouple: a.company === "date" || a.mood === "romance" };
}


// ─── Flere som svarer: enighet og felles kandidater ──────────────────────────

export type MatchDimension = "mood" | "weather" | "sights" | "budget";
export const MATCH_DIMENSIONS: MatchDimension[] = ["mood", "weather", "sights", "budget"];

/** Dimensjonene alle er enige om (identisk svar). Budsjett tas kun med når alle har delt det. */
export function agreementOf(answers: QuizAnswers[], includeBudget: boolean): Partial<Record<MatchDimension, string>> {
  const out: Partial<Record<MatchDimension, string>> = {};
  if (answers.length === 0) return out;
  for (const dim of MATCH_DIMENSIONS) {
    if (dim === "budget" && !includeBudget) continue;
    const first = answers[0][dim];
    if (first && answers.every((a) => a[dim] === first)) out[dim] = first;
  }
  return out;
}

function scoreOne(d: QuizDestination, a: QuizAnswers): number {
  let s = 0;
  if (a.mood && d.mood.includes(a.mood)) s += 3;
  if (a.sights && d.sights.includes(a.sights)) s += 3;
  if (a.weather && (a.weather === "any" ? true : d.weather.includes(a.weather))) s += 2;
  if (a.company && d.company.includes(a.company)) s += 2;
  if (a.budget && d.budget.includes(a.budget)) s += 1;
  return s;
}

export type GroupResult = {
  destination: QuizDestination;
  /** Sum av alles poeng. */
  score: number;
  /** Laveste enkeltpoeng — høy verdi betyr at ingen må ofre mye. */
  floor: number;
  /** Hvor mange av deltakerne som har dette blant sine tre beste. */
  inTopThree: number;
};

/**
 * Felles kandidater for flere deltakere. Rangerer på laveste enkeltpoeng
 * først (ingen skal tape), så sum. Budsjettsvar teller bare når alle delte.
 */
export function scoreGroup(answers: QuizAnswers[], includeBudget: boolean): GroupResult[] {
  if (answers.length === 0) return [];
  const eff = includeBudget ? answers : answers.map((a) => ({ ...a, budget: undefined }));
  const perPerson = eff.map((a) => {
    const scored = QUIZ_DESTINATIONS.map((d) => ({ id: d.id, s: scoreOne(d, a) })).sort((x, y) => y.s - x.s);
    return { scored, top3: new Set(scored.slice(0, 3).map((x) => x.id)) };
  });
  return QUIZ_DESTINATIONS.map((d) => {
    const scores = perPerson.map((p) => p.scored.find((x) => x.id === d.id)!.s);
    return {
      destination: d,
      score: scores.reduce((a, b) => a + b, 0),
      floor: Math.min(...scores),
      inTopThree: perPerson.filter((p) => p.top3.has(d.id)).length,
    };
  }).sort((a, b) => b.floor - a.floor || b.inTopThree - a.inTopThree || b.score - a.score);
}
