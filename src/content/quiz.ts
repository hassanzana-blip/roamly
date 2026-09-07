/**
 * HelloSky reisequiz — spørsmål, destinasjonsprofiler og poengberegning.
 *
 * Alt er kuratert innhold: hvert reisemål er tagget for hvem det passer,
 * stemning, vær, hva man ser og budsjett. Romantiske forslag er skrevet
 * for "Vi to"-modus. Ingen priser eller tilgjengelighet er påstått —
 * resultatet er inspirasjon med lenke til ekte søk.
 */

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

export interface QuizOption<T extends string> {
  id: T;
  label: string;
  sub: string;
  image: string;
}

export interface QuizQuestion {
  key: keyof QuizAnswers;
  title: string;
  options: QuizOption<string>[];
}

export const QUESTIONS: QuizQuestion[] = [
  {
    key: "company",
    title: "Hvem reiser du med?",
    options: [
      { id: "solo", label: "Bare meg", sub: "Frihet i eget tempo", image: img("tokyo") },
      { id: "date", label: "Min kjære", sub: "Vi to — date eller overraskelse", image: img("paris") },
      { id: "family", label: "Familien", sub: "Trygt og enkelt for alle", image: img("malaga") },
      { id: "friends", label: "Vennegjengen", sub: "Felles minner og sent kveld", image: img("barcelona") },
    ],
  },
  {
    key: "mood",
    title: "Hvilken stemning drømmer du om?",
    options: [
      { id: "romance", label: "Romantikk", sub: "Gyllent lys og lange kvelder", image: img("paris") },
      { id: "adventure", label: "Eventyr", sub: "Noe du aldri har gjort før", image: img("tromso") },
      { id: "relax", label: "Avslapning", sub: "Sengekant, sol og ro", image: img("srilanka") },
      { id: "city", label: "Bypuls", sub: "Gater, lys og liv", image: img("nyc") },
    ],
  },
  {
    key: "weather",
    title: "Hvilket vær vil du våkne til?",
    options: [
      { id: "hot", label: "Sol og varme", sub: "Badevær og lette klær", image: img("dubai") },
      { id: "mild", label: "Mildt og lyst", sub: "Perfekt for å vandre", image: img("lisboa") },
      { id: "cold", label: "Kaldt og klart", sub: "Snø, mørke og nordlys", image: img("tromso") },
      { id: "any", label: "Spiller ingen rolle", sub: "Reisemålet betyr mer", image: img("istanbul") },
    ],
  },
  {
    key: "sights",
    title: "Hva vil du helst se?",
    options: [
      { id: "beach", label: "Strender", sub: "Tær i sanden", image: img("malaga") },
      { id: "landmarks", label: "Landemerker", sub: "Ikoner du kjenner fra bilder", image: img("london") },
      { id: "nature", label: "Vill natur", sub: "Fjell, fosser og vidder", image: img("srilanka") },
      { id: "food", label: "Mat og kultur", sub: "Smak deg gjennom byen", image: img("rome") },
    ],
  },
  {
    key: "budget",
    title: "Og hva sier lommeboka?",
    options: [
      { id: "low", label: "Smart og rimelig", sub: "Mye opplevelse per krone", image: img("warsaw") },
      { id: "mid", label: "Middels", sub: "Litt ekstra komfort", image: img("athens") },
      { id: "high", label: "Vi spanderer", sub: "Dette er den store reisen", image: img("dubai") },
    ],
  },
];

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
