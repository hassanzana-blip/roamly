import { useEffect, type ReactNode } from "react";
import { Text } from "react-native";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import type { MobileSearchResult } from "@contracts/mobileSearch";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { SEARCH_RESULT } from "../test/fixtures";
import ResultsScreen from "../app/resultater";

// Ingen reiser: «Prøv datoene rundt» – samme reise noen dager før eller etter, som nye søk uten priser. Og søket i
// toppen kan trykkes for å endre det.

const router = (globalThis as unknown as { __router: { navigate: jest.Mock } }).__router;
const BCN = { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spania" };
const EMPTY = { ...SEARCH_RESULT, offers: [] } as MobileSearchResult;

function SearchOnMount({ children }: { children: ReactNode }) {
  const { runSearch } = useApp();
  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

function Form() {
  const { form } = useApp();
  return <Text testID="form">{`${form.origin?.iata}→${form.destination?.iata} ${form.departDate}/${form.returnDate} a${form.adults}`}</Text>;
}

async function show(result: MobileSearchResult, initial: Record<string, unknown>) {
  const server = fakeServer({ "flights.search": () => ({ data: result }) });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  await render(
    <AppProvider initialLocale="nb" apiFactory={factory} initial={{ destination: BCN, ...initial }}>
      <SearchOnMount>
        <ResultsScreen />
      </SearchOnMount>
      <Form />
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
  return server;
}

const searches = (server: Awaited<ReturnType<typeof show>>) => server.calls.filter((c) => c.path === "flights.search").map((c) => (c.input as { slices: { departureDate: string }[] }).slices.map((s) => s.departureDate));

beforeEach(() => {
  // Bare klokken står stille (25. september 2026); tidtakere og løfter går som vanlig.
  jest.useFakeTimers({ doNotFake: ["hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setImmediate", "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
  jest.setSystemTime(new Date(2026, 8, 25, 12, 0));
});
afterEach(() => jest.useRealTimers());

describe("ingen reiser", () => {
  it("«Prøv datoene rundt»: fire nye søk med samme reiselengde, uten priser; VoiceOver hører hele datoene", async () => {
    await show(EMPTY, { departDate: "2026-10-23", returnDate: "2026-10-30" });
    const none = screen.getByTestId("results-none");
    expect(within(none).getByText("Prøv datoene rundt")).toBeOnTheScreen();
    const chips = within(none).getAllByTestId(/^nearby--?\d+$/);
    expect(chips.map((c) => c.props.testID)).toEqual(["nearby--3", "nearby--1", "nearby-1", "nearby-3"]);
    expect(chips.map((c) => within(c).getByText(/./).props.children)).toEqual(["20.–27. okt.", "22.–29. okt.", "24.–31. okt.", "26. okt. – 2. nov."]);
    expect(chips[1]!.props.accessibilityLabel).toBe("Søk med avreise tor. 22. okt. og retur tor. 29. okt.");
    expect(within(none).queryByText(/kr\b/)).toBeNull();
  });

  it("et trykk søker på nytt med søket som vises og de nye datoene", async () => {
    const server = await show(EMPTY, { departDate: "2026-10-23", returnDate: "2026-10-30", adults: 2 });
    await fireEvent.press(screen.getByTestId("nearby-1"));
    await waitFor(() => expect(searches(server)).toHaveLength(2));
    expect(searches(server)[1]).toEqual(["2026-10-24", "2026-10-31"]);
    expect(screen.getByTestId("form")).toHaveTextContent("OSL→BCN 2026-10-24/2026-10-31 a2");
  });

  it("én vei: datoen med ukedag; aldri en dato som har passert", async () => {
    await show(EMPTY, { tripType: "oneway", departDate: "2026-09-26" });
    const chips = within(screen.getByTestId("results-none")).getAllByTestId(/^nearby--?\d+$/);
    expect(chips.map((c) => c.props.testID)).toEqual(["nearby--1", "nearby-1", "nearby-3"]);
    expect(within(chips[0]!).getByText(/./).props.children).toBe("fre. 25. sep.");
  });

  it("tilbydernes svar gjaldt ikke søket: de samme datoene å prøve", async () => {
    const other = { ...EMPTY, excluded: { count: 2, reasons: { date: 2 } } } as unknown as MobileSearchResult;
    await show(other, { departDate: "2026-10-23", returnDate: "2026-10-30" });
    expect(within(screen.getByTestId("results-excluded-empty")).getAllByTestId(/^nearby--?\d+$/)).toHaveLength(4);
  });

  it("med reiser: ingen «Prøv datoene rundt»; prisstatus og valutaforklaring står", async () => {
    await show(SEARCH_RESULT, { departDate: "2026-10-23", returnDate: "2026-10-30" });
    expect(screen.queryByTestId("nearby-dates")).toBeNull();
    expect(screen.getByTestId("price-status")).toBeOnTheScreen();
    expect(screen.getByTestId("fx-notice")).toBeOnTheScreen();
  });

  it("uten tilbud er det ingen priser å forklare: ingen «Ekte priser · sjekket …» og ingen «Om «ca.»-priser»", async () => {
    await show(EMPTY, { departDate: "2026-10-23", returnDate: "2026-10-30" });
    expect(screen.getByTestId("results-none")).toBeOnTheScreen();
    expect(screen.queryByTestId("price-status")).toBeNull();
    expect(screen.queryByTestId("fx-notice")).toBeNull();
  });
});

describe("søket i toppen", () => {
  it("et trykk på ruten åpner søkeskjemaet; for VoiceOver er ruten en overskrift og knappen gjør jobben", async () => {
    await show(SEARCH_RESULT, { departDate: "2026-10-23", returnDate: "2026-10-30" });
    const head = screen.getByTestId("header-edit");
    expect(head.props.accessible).toBe(false);
    expect(within(head).getByRole("header")).toHaveTextContent("Oslo → Barcelona");
    await fireEvent.press(head);
    expect(router.navigate).toHaveBeenCalledWith("/");
  });
});
