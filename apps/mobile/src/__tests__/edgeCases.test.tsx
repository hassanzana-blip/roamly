import { useEffect, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
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
    cityOrAirport: "By eller flyplass",
    basis: "Totalt for 2 voksne, 1 barn, 1 spedbarn · Tur-retur",
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
    cityOrAirport: "City or airport",
    basis: "Total for 2 adults, 1 child, 1 infant · Return",
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

function setup() {
  const server = fakeServer({ "flights.search": () => ({ data: EDGE_RESULT }), "flights.trackProviderClick": () => ({ data: { clickRef: null } }) });
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

  it("Hjem: de fire reisende og flyplassfeltenes by eller hjelpetekst står i sin helhet", async () => {
    const { factory } = setup();
    await render(
      <AppProvider initialLocale={locale} apiFactory={factory} initial={{ ...FAMILY_FORM, destination: null }}>
        <SearchScreen />
      </AppProvider>,
    );
    // Hele teksten, og når den brytes, står tallet og ordet sammen («1 barn», ikke «1» / «barn»).
    expect(within(screen.getByTestId("travellers")).getByText(c.travellers).props.children).toBe(c.travellers.replace(/(\d) /g, "$1\u00A0"));
    expectNoLineCaps("travellers");
    // Den store koden (OSL, «Velg») er alltid kort; etiketten og by/hjelpetekst («By eller flyplass») bryter linjen.
    for (const id of ["origin", "destination"]) {
      const lines = within(screen.getByTestId(id)).getAllByText(/./);
      expect(lines).toHaveLength(3);
      for (const el of [lines[0]!, lines[2]!]) expect(el.props.numberOfLines).toBeUndefined();
    }
    expect(within(screen.getByTestId("destination")).getByText(c.cityOrAirport)).toBeOnTheScreen();
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
    expect(card.getByText(c.basis)).toBeOnTheScreen();
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
      await fireEvent.press(screen.getByTestId("tab-overview"));
      await fireEvent.press(screen.getByTestId(`seller-${s.id}`));
      expect(screen.getByTestId(`seller-${s.id}`).props.accessibilityState).toMatchObject({ selected: true });
      // Bunnlinjen: pris og grunnlag for alle fire, handlingen og tilbyderen er den valgte selgeren.
      const bar = within(screen.getByTestId("offer-bar"));
      expect(bar.getByText(s.price)).toBeOnTheScreen();
      expect(bar.getByText(c.basis)).toBeOnTheScreen();
      expect(screen.getByTestId("handoff-button").props.accessibilityLabel).toBe(c.action(s.name));
      expect(screen.getByTestId("handoff-note")).toHaveTextContent(c.note(s.name));
      expectNoLineCaps("offer-bar");
      // Bagasje og vilkår fra akkurat denne selgeren.
      await fireEvent.press(screen.getByTestId("tab-baggage"));
      expect(screen.getByTestId("bag-checked")).toHaveTextContent(s.checked);
      if (s.terms) {
        await fireEvent.press(screen.getByTestId("tab-terms"));
        for (const term of s.terms) expect(within(screen.getByTestId("terms-card")).getByText(term)).toBeOnTheScreen();
      } else {
        expect(screen.queryByTestId("tab-terms")).toBeNull();
      }
    }
    // Flyselskapets lange navn står helt, både øverst og i tidslinjen.
    expect(within(screen.getByTestId("journey-summary")).getByText(EDGE_AIRLINE).props.numberOfLines).toBeUndefined();
    await fireEvent.press(screen.getByTestId("tab-itinerary"));
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
    // Fanene: ingen linjegrense, og raden brytes når etikettene ikke får plass (stor tekst).
    for (const id of ["tab-overview", "tab-baggage", "tab-itinerary"]) {
      const tab = screen.getByTestId(id);
      expect(within(tab).getByText(/./).props.numberOfLines).toBeUndefined();
      expect(StyleSheet.flatten(tab.props.style)).toMatchObject({ flexGrow: 1, flexShrink: 0, flexBasis: "auto" });
    }
    expect(StyleSheet.flatten(hostWithRole("tablist")?.props.style)).toMatchObject({ flexDirection: "row", flexWrap: "wrap" });
  });
});
