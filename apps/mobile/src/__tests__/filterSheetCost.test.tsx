import { useEffect, type ReactNode } from "react";
import { AccessibilityInfo, Pressable, Text } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { MobileSearchResult } from "@contracts/mobileSearch";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { SEARCH_RESULT } from "../test/fixtures";
import { connectionOptions, journeysVia } from "../lib/resultsView";
import ResultsScreen from "../app/resultater";

// Filterarket regner bare mens det er åpent; en fjernet brikke sies til VoiceOver; og et prisfilter tegnes aldri
// – ikke én gang – mens totalen for alle reisende ikke er bekreftet.

const mockChips: string[] = [];
jest.mock("../lib/resultsView", () => {
  const actual = jest.requireActual("../lib/resultsView");
  return { ...actual, journeysVia: jest.fn(actual.journeysVia), connectionOptions: jest.fn(actual.connectionOptions) };
});
jest.mock("../components/ui", () => {
  const actual = jest.requireActual("../components/ui");
  const { createElement } = jest.requireActual("react");
  return {
    ...actual,
    Chip: (props: { testID?: string }) => {
      if (props.testID) mockChips.push(props.testID);
      return createElement(actual.Chip, props);
    },
  };
});

const BCN = { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spania" };

function SearchOnMount({ children }: { children: ReactNode }) {
  const { runSearch } = useApp();
  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      {children}
      <Pressable testID="test-search-again" onPress={() => runSearch()}>
        <Text>søk igjen</Text>
      </Pressable>
    </>
  );
}

async function show(results: MobileSearchResult[]) {
  const queue = [...results];
  const server = fakeServer({ "flights.search": () => ({ data: queue.length > 1 ? queue.shift() : queue[0] }) });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  await render(
    <AppProvider initialLocale="nb" apiFactory={factory} initial={{ destination: BCN, departDate: "2026-10-23", returnDate: "2026-10-30" }}>
      <SearchOnMount>
        <ResultsScreen />
      </SearchOnMount>
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
}

const counted = () => (journeysVia as jest.Mock).mock.calls.length + (connectionOptions as jest.Mock).mock.calls.length;

afterEach(() => jest.restoreAllMocks());

describe("filterarket regner bare mens det er åpent", () => {
  it("lukket: ingen telling når listen tegnes på nytt (fanene); åpent: tellingene står; lukket igjen: stille", async () => {
    await show([SEARCH_RESULT]);
    (journeysVia as jest.Mock).mockClear();
    (connectionOptions as jest.Mock).mockClear();
    await fireEvent.press(screen.getByTestId("sort-tab-price"));
    await fireEvent.press(screen.getByTestId("sort-tab-best"));
    expect(counted()).toBe(0);

    await fireEvent.press(screen.getByTestId("open-filters"));
    expect(screen.getByTestId("via-CPH")).toBeOnTheScreen();
    expect(counted()).toBeGreaterThan(0);

    await fireEvent.press(screen.getByTestId("filter-apply"));
    (journeysVia as jest.Mock).mockClear();
    (connectionOptions as jest.Mock).mockClear();
    await fireEvent.press(screen.getByTestId("sort-tab-price"));
    await fireEvent.press(screen.getByTestId("sort-tab-duration"));
    expect(counted()).toBe(0);
  });
});

describe("en aktiv filterbrikke", () => {
  it("er en fjern-knapp, ikke «valgt»; fjernet sier VoiceOver hva som forsvant og hvor mange reiser det nå er", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    await show([SEARCH_RESULT]);
    await fireEvent.press(screen.getByTestId("open-filters"));
    await fireEvent.press(screen.getByTestId("band-morning"));
    await fireEvent.press(screen.getByTestId("filter-apply"));
    const chip = screen.getByTestId("active-departBands");
    expect(chip.props.accessibilityState).toEqual({ disabled: false });
    await fireEvent.press(chip);
    expect(announce).toHaveBeenCalledWith("Fjernet: Avgang ut: morgen. 5 reiser.");
  });
});

describe("prisfilteret og en ubekreftet total", () => {
  it("samme søk på nytt gir en ubekreftet total: når det nye svaret kommer, tegnes «Opptil …»-brikken ikke en eneste gang", async () => {
    const verified = { ...SEARCH_RESULT, priceBasis: { kind: "total" } } as MobileSearchResult;
    const perPerson = { ...SEARCH_RESULT, priceBasis: { kind: "unverified", reason: "per_person" } } as MobileSearchResult;
    // Det andre svaret venter til testen slipper det, så oppdateringen kan ses før og etter.
    let release: ((r: { data: MobileSearchResult }) => void) | null = null;
    let calls = 0;
    const server = fakeServer({ "flights.search": (() => (++calls === 1 ? { data: verified } : new Promise((resolve) => (release = resolve)))) as never });
    const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
    await render(
      <AppProvider initialLocale="nb" apiFactory={factory} initial={{ destination: BCN, departDate: "2026-10-23", returnDate: "2026-10-30" }}>
        <SearchOnMount>
          <ResultsScreen />
        </SearchOnMount>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("open-filters"));
    await fireEvent.press(screen.getAllByTestId(/^price-\d+$/)[0]!);
    await fireEvent.press(screen.getByTestId("filter-apply"));
    expect(screen.getByTestId("active-price")).toBeOnTheScreen();

    // Mens prisene oppdateres, står det forrige svaret – der totalen er bekreftet og prisfilteret gjelder.
    await fireEvent.press(screen.getByTestId("test-search-again"));
    expect(screen.getByTestId("price-refreshing")).toBeOnTheScreen();
    expect(screen.getByTestId("active-price")).toBeOnTheScreen();

    mockChips.length = 0;
    await waitFor(() => expect(release).not.toBeNull());
    await act(async () => release!({ data: perPerson }));
    await waitFor(() => expect(screen.getByTestId("price-basis-notice")).toBeOnTheScreen());
    expect(mockChips).not.toContain("active-price");
    expect(screen.queryByTestId("active-price")).toBeNull();
  });
});
