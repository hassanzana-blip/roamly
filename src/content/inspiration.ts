import { ALL_DESTINATIONS, type DiscoverDestination } from "./discover";

/**
 * «Hva slags ferie trenger du?» – tempo før sted.
 *
 * Tre tempoer, hvert med en redaksjonell rekkefølge av reisemål fra det
 * felles registeret. Den første i listen er hovedkortet, den andre er
 * bikortet. Ingen reisemål er hardkodet i visningen: bytter registeret,
 * bytter visningen.
 */
export type TempoId = "sea" | "city" | "calm";

export type Tempo = {
  id: TempoId;
  /** Reisemål i prioritert rekkefølge. */
  ids: string[];
  /** Én linje per reisemål, skrevet for dette tempoet. */
  lines: Record<string, string>;
  /** Hva bikortet lokker med. */
  secondaryTitle: string;
};

export const TEMPOS: Tempo[] = [
  {
    id: "sea",
    ids: ["malaga", "athens", "barcelona", "lisboa", "dubai", "colombo"],
    lines: {
      malaga: "Lange strender og sen middag.",
      athens: "Sjøbad tjue minutter fra Akropolis.",
      barcelona: "Bystrand, tapas og kveldssol.",
      lisboa: "Atlanterhavet rett utenfor byen.",
      dubai: "Varmt hav når Norge er mørkt.",
      colombo: "Kyst, tog og teåser i ett.",
    },
    secondaryTitle: "Mer badeliv. Mindre plan.",
  },
  {
    id: "city",
    ids: ["paris", "london", "rome", "istanbul", "tokyo", "nyc", "warszawa"],
    lines: {
      paris: "Kafeer, kunst og kvartaler å gå seg bort i.",
      london: "Helgeklassikeren, alltid noe nytt.",
      rome: "Ruiner, trattoriaer og trange gater.",
      istanbul: "To kontinenter på én kveldstur.",
      tokyo: "Ryddig, rart og uendelig stort.",
      nyc: "Storbyen alle kjenner, på ekte.",
      warszawa: "Nær, rimelig og undervurdert.",
    },
    secondaryTitle: "Mer by. Mindre hastverk.",
  },
  {
    id: "calm",
    ids: ["tromso", "marrakech", "colombo", "malaga", "lisboa"],
    lines: {
      tromso: "Nordlys, vidde og stille kvelder.",
      marrakech: "Riad, hage og te i skyggen.",
      colombo: "Sakte tog gjennom teåsene.",
      malaga: "Solsenger og ingen vekkerklokke.",
      lisboa: "Utsiktspunkter og lange lunsjer.",
    },
    secondaryTitle: "Mer ro. Mindre støy.",
  },
];

const byId = new Map(ALL_DESTINATIONS.map((d) => [d.id, d]));

export type TempoPick = { destination: DiscoverDestination; line: string };

/** Hovedkort og bikort for et tempo, bare reisemål med ekte foto. */
export function picksFor(tempo: TempoId): { primary: TempoPick | null; secondary: TempoPick | null; all: TempoPick[] } {
  const t = TEMPOS.find((x) => x.id === tempo)!;
  const all = t.ids
    .map((id) => byId.get(id))
    .filter((d): d is DiscoverDestination => Boolean(d?.image))
    .map((d) => ({ destination: d, line: t.lines[d.id] ?? d.tagline }));
  return { primary: all[0] ?? null, secondary: all[1] ?? null, all };
}

/** Den offentlige reisemålssiden for et kort. */
export function destinationHref(d: DiscoverDestination): string {
  return `/reisemal/${d.id}`;
}
