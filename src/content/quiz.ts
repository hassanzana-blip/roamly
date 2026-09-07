/**
 * HelloSky reisequiz – spørsmål, destinasjonsprofiler og poengberegning.
 *
 * Alt er kuratert innhold: hvert reisemål er tagget for hvem det passer,
 * stemning, vær, hva man ser og budsjett. Romantiske forslag er skrevet
 * for "Vi to"-modus. Ingen priser eller tilgjengelighet er påstått – 
 * resultatet er inspirasjon med lenke til ekte søk.
 */

import type { QuizAnswers } from "@contracts/quiz";

export type { Budget, Company, Mood, QuizAnswers, Sights, Weather, QuizDestination, QuizResult, GroupResult, MatchDimension } from "@contracts/quiz";
export { QUIZ_DESTINATIONS, scoreQuiz, scoreGroup, agreementOf, MATCH_DIMENSIONS } from "@contracts/quiz";

const img = (name: string) => `/destinations/${name}.jpg`;

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
      { id: "date", label: "Min kjære", sub: "Vi to – date eller overraskelse", image: img("paris") },
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

