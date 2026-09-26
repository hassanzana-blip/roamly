import { useEffect, type ReactNode } from "react";
import { Dimensions, StyleSheet } from "react-native";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { SAME_TRIP_OTHER_SELLER, SEARCH_RESULT, SEK_OFFER } from "../test/fixtures";
import { EDGE_AGENCY, EDGE_AGENCY_2, EDGE_AIRLINE, EDGE_RESULT } from "../test/edgeFixtures";
import SearchScreen from "../app/(tabs)/index";
import ResultsScreen from "../app/resultater";
import OfferScreen from "../app/tilbud/[id]";

// Kantilfeller i kjerneflyten (fiktive testdata, se test/edgeFixtures.ts): fire
// reisende og svært lange navn. Prisgrunnlaget gjelder alle reisende, og pris,
// bagasje, vilkår og handlingen følger alltid den valgte selgeren. Ingen av de
// lange tekstene har en linjegrense som kan kutte dem.

const setParams = (globalThis as unknown as { __setParams: (p: Record<string, string>) => void }).__setParams;
const BCN = { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spania" };
const FAMILY_FORM = { destination: BCN, adults: 2, childAges: [8], infantAges: [1] };

const COPY = {
  nb: {
    travellers: "2 voksne, 1 barn, 1 spedbarn",
    toPlaceholder: "Til hvor?",
    basis: "Totalt for 2 voksne, 1 barn, 1 spedbarn · Tur-retur",
    cardBasis: "Totalt for 2 voksne, 1 barn, 1 spedbarn",
    providers: "3 tilbydere",
    count: "2 reiser · 4 tilbud",
    action: (s: string) => `Gå til tilbud hos ${s}`,
    note: (s: string) => `${s} · Bestillingen fullføres hos tilbyderen.`,
    sellers: [
      { id: "edge_agency", name: EDGE_AGENCY, price: /^18\s450\skr$/, checked: /Innsjekket bagasje.*2 stk\. inkludert/, terms: ["Refusjon før avreise", "Endring før avreise"] },
      { id: "edge_agency2", name: EDGE_AGENCY_2, price: /^18\s990\skr$/, checked: /Innsjekket bagasje.*Ikke oppgitt/, terms: ["Endring før avreise"] },
      { id: "edge_airline", name: EDGE_AIRLINE, price: /^19\s990\skr$/, checked: /Innsjekket bagasje.*Ikke inkludert/, terms: null },
    ],
  },
  en: {
    travellers: "2 adults, 1 child, 1 infant",
    toPlaceholder: "To?",
    basis: "Total for 2 adults, 1 child, 1 infant · Return",
    cardBasis: "Total for 2 adults, 1 child, 1 infant",
    providers: "3 providers",
    count: "2 journeys · 4 offers",
    action: (s: string) => `Go to offer at ${s}`,
    note: (s: string) => `${s} · You complete the booking with the provider.`,
    sellers: [
      { id: "edge_agency", name: EDGE_AGENCY, price: /^NOK\s18,450$/, checked: /Checked bag.*2 included/, terms: ["Refund before departure", "Change before departure"] },
      { id: "edge_agency2", name: EDGE_AGENCY_2, price: /^NOK\s18,990$/, checked: /Checked bag.*Not stated/, terms: ["Change before departure"] },
      { id: "edge_airline", name: EDGE_AIRLINE, price: /^NOK\s19,990$/, checked: /Checked bag.*Not included/, terms: null },
    ],
  },
} as const;

function setup(result = EDGE_RESULT) {
  const server = fakeServer({ "flights.search": () => ({ data: result }), "flights.trackProviderClick": () => ({ data: { clickRef: null } }) });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  return { server, factory };
}

function SearchOnMount({ children }: { children: ReactNode }) {
  const { runSearch } = useApp();
  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

type HostNode = { props: Record<string, unknown>; children: (HostNode | string)[] | null };

/** Første element i treet som oppfyller betingelsen. */
function findHost(test: (n: HostNode) => boolean): HostNode | null {
  const find = (n: HostNode | string | null): HostNode | null => {
    if (!n || typeof n === "string") return null;
    if (test(n)) return n;
    for (const c of n.children ?? []) {
      const hit = find(c);
      if (hit) return hit;
    }
    return null;
  };
  return find(screen.toJSON() as HostNode | null);
}

/** Fanelisten er ikke selv et tilgjengelig element, så `getByRole` finner den ikke. */
const hostWithRole = (role: string) => findHost((n) => n.props.accessibilityRole === role);

/** Ingen tekst i elementet har en linjegrense. */
function expectNoLineCaps(testID: string) {
  for (const el of within(screen.getByTestId(testID)).getAllByText(/./)) expect({ text: el.props.children, numberOfLines: el.props.numberOfLines }).toEqual({ text: el.props.children, numberOfLines: undefined });
}

describe.each(["nb", "en"] as const)("fire reisende og lange navn (%s)", (locale) => {
  const c = COPY[locale];

  it("Hjem: de fire reisende står i sin helhet, og flyplassfeltene viser by og kode – eller spørsmålet – uten linjegrense", async () => {
    const { factory } = setup();
    await render(
      <AppProvider initialLocale={locale} apiFactory={factory} initial={{ ...FAMILY_FORM, destination: null }}>
        <SearchScreen />
      </AppProvider>,
    );
    // Hele teksten, og når den brytes, står tallet og ordet sammen («1 barn», ikke «1» / «barn»).
    expect(within(screen.getByTestId("travellers")).getByText(c.travellers).props.children).toBe(c.travellers.replace(/(\d) /g, "$1\u00A0"));
    expectNoLineCaps("travellers");
    // Byen og koden («Oslo (OSL)») og spørsmålet i et tomt felt bryter linjen i stedet for å kuttes.
    expect(screen.getByTestId("origin")).toHaveTextContent("Oslo (OSL)");
    expect(within(screen.getByTestId("destination")).getByText(c.toPlaceholder)).toBeOnTheScreen();
    expectNoLineCaps("origin");
    expectNoLineCaps("destination");
  });

  it("resultatlisten: grunnlaget gjelder alle reisende, samme reise hos tre selgere vises én gang", async () => {
    const { factory } = setup();
    await render(
      <AppProvider initialLocale={locale} apiFactory={factory} initial={FAMILY_FORM}>
        <SearchOnMount>
          <ResultsScreen />
        </SearchOnMount>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
    expect(screen.getByTestId("result-count")).toHaveTextContent(c.count);
    const card = within(screen.getByTestId("offer-edge_agency"));
    // Kortet viser begge strekningene, så reisetypen gjentas ikke ved beløpet; VoiceOver får hele grunnlaget.
    expect(card.getByText(c.cardBasis)).toBeOnTheScreen();
    expect(card.getByText(c.providers)).toBeOnTheScreen();
    expect(card.getByText(EDGE_AIRLINE)).toBeOnTheScreen();
    expect(screen.getByTestId("offer-edge_agency").props.accessibilityLabel).toContain(c.basis.toLowerCase());
    expectNoLineCaps("offer-edge_agency");
    expectNoLineCaps("offer-edge_single");
  });

  it("detaljene: hver selger har sin pris, bagasje og sine vilkår – og handlingen følger valget", async () => {
    const { factory } = setup();
    setParams({ id: "edge_agency" });
    await render(
      <AppProvider initialLocale={locale} apiFactory={factory} initial={FAMILY_FORM}>
        <SearchOnMount>
          <OfferScreen />
        </SearchOnMount>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("sellers")).toBeOnTheScreen());
    expectNoLineCaps("sellers");
    for (const s of c.sellers) {
      const row = within(screen.getByTestId(`seller-${s.id}`));
      expect(row.getByText(s.name)).toBeOnTheScreen();
      expect(row.getByText(s.price)).toBeOnTheScreen();
    }
    for (const s of c.sellers) {
      await fireEvent.press(screen.getByTestId(`seller-${s.id}`));
      expect(screen.getByTestId(`seller-${s.id}`).props.accessibilityState).toMatchObject({ selected: true });
      // Bunnlinjen: pris og grunnlag for alle fire, handlingen og tilbyderen er den valgte selgeren.
      const bar = within(screen.getByTestId("offer-bar"));
      expect(bar.getByText(s.price)).toBeOnTheScreen();
      expect(bar.getByText(c.basis)).toBeOnTheScreen();
      expect(screen.getByTestId("handoff-button").props.accessibilityLabel).toBe(c.action(s.name));
      expect(screen.getByTestId("handoff-note")).toHaveTextContent(c.note(s.name));
      expectNoLineCaps("offer-bar");
      // Bagasje og vilkår fra akkurat denne selgeren – på samme rulleflate, uten faner.
      expect(screen.getByTestId("bag-checked")).toHaveTextContent(s.checked);
      if (s.terms) {
        for (const term of s.terms) expect(within(screen.getByTestId("terms-card")).getByText(term)).toBeOnTheScreen();
      } else {
        expect(screen.queryByTestId("terms-card")).toBeNull();
      }
    }
    // Flyselskapets lange navn står helt, både øverst og i tidslinjen.
    expect(within(screen.getByTestId("journey-summary")).getByText(EDGE_AIRLINE).props.numberOfLines).toBeUndefined();
    const names = screen.getAllByText(EDGE_AIRLINE);
    expect(names.length).toBeGreaterThanOrEqual(1 + 4); // oversikten + fire flyvninger
    for (const el of names) expect(el.props.numberOfLines).toBeUndefined();
    // Tidslinjen: får ikke logo, navn og varighet plass på én linje, legger varigheten seg under – navnet får
    // hele bredden i stedet for en smal stripe der ordene deles («Testflysels» / «kap»).
    const flight = findHost((n) => typeof n.props.testID === "string" && n.props.testID.startsWith("flight-"))!;
    expect(StyleSheet.flatten(flight.props.style as never)).toMatchObject({ flexDirection: "row", flexWrap: "wrap" });
    const [who, duration] = flight.children as HostNode[];
    expect(StyleSheet.flatten(who!.props.style as never)).toMatchObject({ flexGrow: 1, flexShrink: 1, flexBasis: "auto" });
    expect(StyleSheet.flatten(duration!.props.style as never)).toMatchObject({ marginLeft: "auto" });
    // Ingen faner lenger: alt står på én rulleflate, så ingenting skjules bak et trykk.
    expect(hostWithRole("tablist")).toBeNull();
    expectNoLineCaps("itinerary");
  });
});

// Selgerraden: prisen står til høyre så lenge teksten ved siden av har plass. Brytes navnet, eller blir tekstkolonnen
// for smal for de faste ordene («Håndbagasje») ved denne tekststørrelsen, legger prisen seg under teksten – så ingen
// ord deles («Testflyselska» / «p»). Korte navn med vanlig tekst beholder den kompakte raden.
describe("selgerraden gir navn, bagasje og vilkår nok bredde", () => {
  const baseWindow = Dimensions.get("window");
  const base = baseWindow.fontScale;
  const layout = (width: number, height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height } } });
  const line = (scale: number) => 20 * scale; // type.calloutStrong.lineHeight ved tekststørrelsen
  // Navnets bredde er stor nok til at målingen aldri kan utløse kolonneregelen (hendelsen bobler i testene).
  const nameLines = (id: string, lines: number, scale = base) => fireEvent(screen.getByTestId(`sellername-${id}`), "layout", layout(400, lines * line(scale)));
  const column = (id: string, width: number) => fireEvent(screen.getByTestId(`sellertext-${id}`), "layout", layout(width, 200));

  /** Hvor prisen står: «right» = siste element i raden; «below» = siste element i tekstkolonnen, rett etter bagasjen. */
  function placement(id: string): "right" | "below" | "other" {
    const ids = (n: HostNode | null) => (n?.children ?? []).map((c) => (typeof c === "string" ? c : (c.props.testID as string | undefined)));
    const row = ids(findHost((n) => n.props.testID === `seller-${id}`));
    const col = ids(findHost((n) => n.props.testID === `sellertext-${id}`));
    if (row.at(-1) === `sellerprice-${id}` && !col.includes(`sellerprice-${id}`)) return "right";
    if (col.at(-1) === `sellerprice-${id}` && col.at(-2) === `sellerbags-${id}` && !row.includes(`sellerprice-${id}`)) return "below";
    return "other";
  }

  // React Native sender ikke «change» første gang Dimensions.set kalles; marker dimensjonene som satt (uendret).
  beforeAll(() => Dimensions.set({ window: Dimensions.get("window"), screen: Dimensions.get("screen") }));
  async function setFontScale(fontScale: number) {
    await act(async () => Dimensions.set({ window: { ...baseWindow, fontScale }, screen: { ...Dimensions.get("screen"), fontScale } }));
  }
  afterEach(async () => {
    if (Dimensions.get("window").fontScale !== base) await setFontScale(base);
  });

  async function renderOffer(id: string, result: typeof EDGE_RESULT, locale: "nb" | "en" = "nb") {
    const { factory } = setup(result);
    setParams({ id });
    await render(
      <AppProvider initialLocale={locale} apiFactory={factory} initial={FAMILY_FORM}>
        <SearchOnMount>
          <OfferScreen />
        </SearchOnMount>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("sellers")).toBeOnTheScreen());
  }
  const shortNames = { ...SEARCH_RESULT, offers: [SEK_OFFER, SAME_TRIP_OTHER_SELLER] };

  it("korte navn, vanlig tekst: navnet på én linje og en kolonne akkurat bred nok – prisen blir stående til høyre", async () => {
    await renderOffer("sek_1", shortNames);
    for (const id of ["sek_1", "gtg_1"]) {
      await nameLines(id, 1);
      await column(id, 80 * base);
      expect(placement(id)).toBe("right");
    }
  });

  it.each(["nb", "en"] as const)("et navn som brytes (%s): prisen under bagasjen, hele navnet og tilgjengelighetsnavnet uendret, valget virker", async (locale) => {
    const c = COPY[locale];
    await renderOffer("edge_agency", EDGE_RESULT, locale);
    const airline = c.sellers[2];
    const label = screen.getByTestId("seller-edge_airline").props.accessibilityLabel as string;
    expect(placement("edge_airline")).toBe("right");
    // To linjer er nok: det minste tilfellet der et ord kan deles («Testflyselska» / «p»).
    await nameLines("edge_airline", 2);
    expect(placement("edge_airline")).toBe("below");
    expect(placement("edge_agency")).toBe("right");
    const row = within(screen.getByTestId("seller-edge_airline"));
    expect(row.getByText(EDGE_AIRLINE)).toBeOnTheScreen();
    expect(screen.getByTestId("sellerprice-edge_airline")).toHaveTextContent(airline.price);
    expect(screen.getByTestId("seller-edge_airline").props.accessibilityLabel).toBe(label);
    expect(label).toContain(EDGE_AIRLINE);
    for (const el of row.getAllByText(/./)) expect(el.props.numberOfLines).toBeUndefined();
    // Valget: radioknappen, bunnlinjen, handlingen og bagasjen følger selgeren.
    await fireEvent.press(screen.getByTestId("seller-edge_airline"));
    expect(screen.getByTestId("seller-edge_airline").props.accessibilityState).toMatchObject({ selected: true });
    expect(within(screen.getByTestId("bar-price")).getByText(airline.price)).toBeOnTheScreen();
    expect(screen.getByTestId("handoff-button").props.accessibilityLabel).toBe(c.action(EDGE_AIRLINE));
    expect(placement("edge_airline")).toBe("below");
    // Bagasjen følger valget; prisen står fortsatt under – ingen ny måling, ingen hopping.
    expect(screen.getByTestId("bag-checked")).toHaveTextContent(airline.checked);
    expect(placement("edge_airline")).toBe("below");
  });

  it("kort navn, men for smal tekstkolonne (stor tekst): prisen under; den hopper ikke tilbake med samme tekststørrelse", async () => {
    await renderOffer("sek_1", shortNames);
    await nameLines("gtg_1", 1);
    await column("gtg_1", 80 * base - 1);
    expect(placement("gtg_1")).toBe("below");
    expect(placement("sek_1")).toBe("right");
    await column("gtg_1", 250);
    await nameLines("gtg_1", 1);
    expect(placement("gtg_1")).toBe("below");
  });

  it("endres tekststørrelsen, måles radene og beløpet i bunnlinjen på nytt med den nye skalaen – i begge retninger", async () => {
    await renderOffer("sek_1", shortNames);
    // På telefonen kommer en ny måling bare for nye elementer: raden og beløpet lages på nytt når størrelsen endres.
    const [rowBefore, amountBefore] = [screen.getByTestId("sellertext-gtg_1"), screen.getByTestId("bar-amount")];
    // Stor tekst: kolonnen er for smal, prisen under; beløpet brytes, prisen alene i bunnlinjen.
    await setFontScale(1.786);
    expect(screen.getByTestId("sellertext-gtg_1")).not.toBe(rowBefore);
    expect(screen.getByTestId("bar-amount")).not.toBe(amountBefore);
    await column("gtg_1", 126); // < 80 × 1,786
    await fireEvent(screen.getByTestId("bar-amount"), "layout", layout(150, 2 * 30 * 1.786));
    expect(placement("gtg_1")).toBe("below");
    expect(StyleSheet.flatten(screen.getByTestId("bar-price").props.style).flexBasis).toBe("100%");
    // Tilbake til vanlig tekst: nye noder, prisen til høyre til en ny måling sier noe annet.
    await setFontScale(1);
    expect(placement("gtg_1")).toBe("right");
    expect(StyleSheet.flatten(screen.getByTestId("bar-price").props.style).flexBasis).toBe(120);
    await column("gtg_1", 190);
    await nameLines("gtg_1", 1, 1);
    expect(placement("gtg_1")).toBe("right");
    // Og opp igjen: den nye skalaen gjelder, ikke den gamle målingen (126 pt er for smalt ved 1,786, ikke ved 1,235).
    await setFontScale(1.235);
    await column("gtg_1", 126);
    expect(placement("gtg_1")).toBe("right");
    await setFontScale(1.786);
    await column("gtg_1", 126);
    expect(placement("gtg_1")).toBe("below");
  });
});
