import { airportByIata } from "./airports";

/**
 * Rutesider: /fly/oslo-london.
 *
 * Systemet først, sidene etterpå. Her ligger definisjonen av hva en ruteside
 * *er*, og en håndplukket startliste. Den skal vokse når noen har noe å si om
 * en rute – ikke fordi en løkke kan lage tusen kombinasjoner.
 *
 * Reglene for hva som får stå her:
 *
 *  1. **Ingen oppdiktede tall.** Reisetid og direktefly-selskaper er
 *     ruteopplysninger vi kan stå for. Priser står ikke her i det hele tatt:
 *     de hentes når noen søker, fra leverandøren, og de er ferskvare.
 *  2. **Ingen generert fyllingstekst.** `intro` er skrevet for ruten. Er det
 *     ingenting å si, hører ruten ikke hjemme i listen.
 *  3. **Én rute, én side.** Oslo–London og London–Oslo er samme marked for en
 *     norsk leser; vi lager ikke begge for å doble antallet sider.
 *
 * Både serveren (prerender, sitemap, 404) og klienten leser herfra, så en ny
 * rute dukker opp alle steder samtidig.
 */

export type RouteDefinition = {
  /** URL-biten etter /fly/. Små bokstaver, bindestrek. */
  slug: string;
  /** IATA for avreise. */
  from: string;
  /** IATA for ankomst. */
  to: string;
  /**
   * Vanlig reisetid uten stopp, i minutter. Utelates når vi ikke vet den –
   * vi gjetter ikke på et tall folk planlegger etter.
   */
  typicalDurationMinutes?: number;
  /** Selskaper som flyr ruten direkte. Tom liste = ingen kjente direktefly. */
  directCarriers: string[];
  /** Andre norske avreisebyer det er naturlig å sammenligne med. IATA. */
  nearbyOrigins: string[];
  /** To–tre setninger skrevet for denne ruten. Ingen mal, ingen fyll. */
  intro: string;
};

export const ROUTES: RouteDefinition[] = [
  {
    slug: "oslo-london",
    from: "OSL",
    to: "LHR",
    typicalDurationMinutes: 135,
    directCarriers: ["Norwegian", "SAS", "British Airways"],
    nearbyOrigins: ["TRF", "BGO", "SVG", "TRD"],
    intro:
      "Oslo–London er den tettest trafikkerte ruten mellom Norge og Storbritannia, med flere direkteavganger om dagen. London har fem flyplasser, og hvilken du lander på betyr mer for reisetiden inn til byen enn en halvtime i luften gjør.",
  },
  {
    slug: "oslo-barcelona",
    from: "OSL",
    to: "BCN",
    typicalDurationMinutes: 195,
    directCarriers: ["Norwegian", "SAS", "Vueling"],
    nearbyOrigins: ["TRF", "BGO", "SVG"],
    intro:
      "Barcelona flys direkte fra Oslo året rundt, med flest avganger fra mai til september. Flyplassen El Prat ligger et kvarter fra sentrum med tog, så en morgenavgang gir en hel dag i byen.",
  },
  {
    slug: "oslo-alicante",
    from: "OSL",
    to: "ALC",
    typicalDurationMinutes: 225,
    directCarriers: ["Norwegian", "SAS"],
    nearbyOrigins: ["TRF", "BGO", "SVG", "TRD"],
    intro:
      "Alicante er innfallsporten til Costa Blanca og en av de mest trafikkerte sydenrutene fra Norge. Direkteflyene går hyppigst i sommerhalvåret; om vinteren er tilbudet tynnere og prisen gjerne lavere.",
  },
  {
    slug: "oslo-malaga",
    from: "OSL",
    to: "AGP",
    typicalDurationMinutes: 240,
    directCarriers: ["Norwegian", "SAS"],
    nearbyOrigins: ["TRF", "BGO", "SVG", "TRD"],
    intro:
      "Málaga betjener Costa del Sol og har direktefly fra Oslo store deler av året. Flyplassen ligger ti minutter fra Málaga sentrum og under en time fra Marbella.",
  },
  {
    slug: "oslo-lisboa",
    from: "OSL",
    to: "LIS",
    typicalDurationMinutes: 235,
    directCarriers: ["Norwegian", "TAP Air Portugal"],
    nearbyOrigins: ["BGO", "SVG"],
    intro:
      "Lisboa har direktefly fra Oslo mesteparten av året, men færre avganger enn de spanske rutene – ofte noen faste ukedager. Flyplassen ligger inne i byen, tjue minutter fra sentrum med metro.",
  },
  {
    slug: "oslo-istanbul",
    from: "OSL",
    to: "IST",
    typicalDurationMinutes: 210,
    directCarriers: ["Turkish Airlines"],
    nearbyOrigins: ["BGO", "SVG", "TRD"],
    intro:
      "Turkish Airlines flyr Oslo–Istanbul direkte daglig. Istanbul er også et av de vanligste byttepunktene videre til Midtøsten og Asia, så samme rute dukker opp både som reisemål og som mellomlanding.",
  },
  {
    slug: "oslo-erbil",
    from: "OSL",
    to: "EBL",
    directCarriers: [],
    nearbyOrigins: ["BGO", "SVG"],
    intro:
      "Det går ikke direktefly fra Oslo til Erbil. Reisen går med ett bytte, oftest via Istanbul, Wien eller Frankfurt, og total reisetid er som regel mellom sju og tolv timer avhengig av mellomlandingen. Bagasjereglene kan skille mellom de to strekningene når billetten er satt sammen av to selskaper – sjekk dem før du bestiller.",
  },
  {
    slug: "bergen-london",
    from: "BGO",
    to: "LHR",
    typicalDurationMinutes: 130,
    directCarriers: ["Norwegian", "British Airways"],
    nearbyOrigins: ["OSL", "SVG", "TRD"],
    intro:
      "Bergen–London flys direkte, men med færre daglige avganger enn fra Oslo. Er tidspunktene upraktiske, er det ofte verdt å sammenligne med en avgang fra Stavanger eller Oslo.",
  },
  {
    slug: "trondheim-alicante",
    from: "TRD",
    to: "ALC",
    typicalDurationMinutes: 245,
    directCarriers: ["Norwegian"],
    nearbyOrigins: ["OSL", "BGO", "SVG"],
    intro:
      "Trondheim–Alicante går direkte i sommersesongen, typisk én til to ganger i uken. Utenfor sesongen må reisen som regel gå via Oslo eller København.",
  },
  {
    slug: "stavanger-london",
    from: "SVG",
    to: "LHR",
    typicalDurationMinutes: 125,
    directCarriers: ["British Airways", "SAS"],
    nearbyOrigins: ["BGO", "OSL"],
    intro:
      "Stavanger–London er en gammel oljerute med god frekvens på hverdager og tynnere tilbud i helgene. Det gir hverdagsavganger som ofte passer bedre for en jobbreise enn for en langhelg.",
  },
];

const BY_SLUG = new Map(ROUTES.map((r) => [r.slug, r]));

export function routeBySlug(slug: string): RouteDefinition | undefined {
  return BY_SLUG.get(slug.toLowerCase());
}

/** «Fly Oslo – London» – tittelen brukes i <h1>, <title> og lenker. */
export function routeTitle(r: RouteDefinition): string {
  const from = airportByIata(r.from)?.city ?? r.from;
  const to = airportByIata(r.to)?.city ?? r.to;
  return `Fly ${from} – ${to}`;
}

/** Kort beskrivelse til <meta name="description">. */
export function routeDescription(r: RouteDefinition): string {
  const from = airportByIata(r.from)?.city ?? r.from;
  const to = airportByIata(r.to)?.city ?? r.to;
  const direct = r.directCarriers.length ? `Direktefly med ${r.directCarriers.join(", ")}.` : "Ingen kjente direktefly – reisen går med bytte.";
  return `${from} til ${to}: flyplasser, vanlig reisetid og hvem som flyr. ${direct} Søk og sammenlign priser hos leverandørene.`;
}
