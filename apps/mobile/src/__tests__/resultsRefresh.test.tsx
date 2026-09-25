import { useEffect, type ReactNode } from "react";
import { AccessibilityInfo, Pressable, RefreshControl, Text } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { MobileSearchResult } from "@contracts/mobileSearch";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { NOK_OFFER, SEARCH_RESULT } from "../test/fixtures";
import ResultsScreen from "../app/resultater";
import OfferScreen from "../app/tilbud/[id]";

// Oppdater prisene (dra ned, eller «Oppdater prisene»): samme søk på nytt. Listen står mens det nye svaret hentes, og
// de nye prisene kommer inn i den samme listen. Feiler det, står de forrige prisene, med beskjed om når de er fra.
// Et annet søk (nye datoer) viser plassholderne, som før.

const setParams = (globalThis as unknown as { __setParams: (p: Record<string, string>) => void }).__setParams;
const BCN = { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spania" };

type Reply = { data: MobileSearchResult } | { status: number; error: { message: string; appCode: string } };

/** Kiwi.com-reisen (nok_1) koster 1 990 kr i det nye svaret. */
const UPDATED: MobileSearchResult = {
  ...SEARCH_RESULT,
  offers: SEARCH_RESULT.offers.map((o) =>
    o.offer.id === NOK_OFFER.offer.id ? { ...o, price: { ...o.price, total: { amount: "1990.00", currency: "NOK" }, nok: { kind: "exact", currency: "NOK", amountMinor: 199000, estimate: false } } } : o,
  ),
};

/** Første søk svarer med en gang; `hold()` gjør at neste søk venter til testen svarer med `answer()`. */
function controlledServer() {
  const held: ((r: Reply) => void)[] = [];
  let holdNext = false;
  const server = fakeServer({
    "flights.search": (() => {
      if (!holdNext) return { data: SEARCH_RESULT };
      holdNext = false;
      return new Promise<Reply>((resolve) => held.push(resolve));
    }) as never,
    "flights.trackProviderClick": () => ({ data: { clickRef: null } }),
  });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  const hold = () => {
    holdNext = true;
  };
  const answer = async (r: Reply) => {
    await waitFor(() => expect(held.length).toBe(1));
    await act(async () => held.shift()!(r));
  };
  return { factory, hold, answer, server };
}

function Harness({ children }: { children: ReactNode }) {
  const { runSearch } = useApp();
  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      {children}
      <Pressable testID="test-same-search" onPress={() => runSearch()}>
        <Text>samme søk</Text>
      </Pressable>
      <Pressable testID="test-new-dates" onPress={() => runSearch({ departDate: "2026-10-24", returnDate: "2026-10-31" })}>
        <Text>nye datoer</Text>
      </Pressable>
    </>
  );
}

async function showResults() {
  const s = controlledServer();
  await render(
    <AppProvider initialLocale="nb" apiFactory={s.factory} initial={{ destination: BCN, departDate: "2026-10-23", returnDate: "2026-10-30" }}>
      <Harness>
        <ResultsScreen />
      </Harness>
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
  return s;
}

/** Kontrollen for «dra ned» (iOS' UIRefreshControl). Testoppsettets RefreshControl husker den siste som ble vist. */
const refreshControl = () => (RefreshControl as unknown as { latestRef: { props: { refreshing: boolean; onRefresh: () => void } } }).latestRef;
const pull = async () => {
  await act(async () => {
    refreshControl().props.onRefresh();
  });
};
const searches = (s: ReturnType<typeof controlledServer>) => s.server.calls.filter((c) => c.path === "flights.search").length;

afterEach(() => jest.restoreAllMocks());

describe("dra ned for å oppdatere prisene", () => {
  it("listen står mens de nye prisene hentes; de kommer inn i den samme listen, og VoiceOver hører at de er oppdatert", async () => {
    const s = await showResults();
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    expect(refreshControl().props.refreshing).toBe(false);
    s.hold();
    await pull();
    expect(searches(s)).toBe(2);
    // Ingen plassholdere: kortene og prisene står, og linjen over listen sier hva som skjer.
    expect(screen.queryByTestId("results-loading")).toBeNull();
    expect(screen.getByTestId("offer-nok_1")).toBeOnTheScreen();
    expect(screen.getByTestId("price-refreshing")).toHaveTextContent("Oppdaterer prisene …");
    expect(refreshControl().props.refreshing).toBe(true);

    await s.answer({ data: UPDATED });
    expect(screen.getByTestId("price-nok_1")).toHaveTextContent(/1\s990\skr/);
    expect(screen.queryByTestId("price-refreshing")).toBeNull();
    expect(refreshControl().props.refreshing).toBe(false);
    expect(announce).toHaveBeenCalledWith("Prisene er oppdatert. 5 reiser.");
  });

  it("sorteringen kunden valgte, står etter en oppdatering (samme søk)", async () => {
    const s = await showResults();
    await fireEvent.press(screen.getByTestId("sort-tab-price"));
    s.hold();
    await pull();
    await s.answer({ data: SEARCH_RESULT });
    expect(screen.getByTestId("sort-tab-price").props.accessibilityState).toMatchObject({ selected: true });
  });

  it("feiler oppdateringen, står de forrige prisene – med beskjed om hva som skjedde og hvor gamle de er", async () => {
    const s = await showResults();
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    const price = screen.getByTestId("price-nok_1").props.accessibilityLabel;
    s.hold();
    await pull();
    await s.answer({ status: 429, error: { message: "For mange forespørsler. Prøv igjen om litt.", appCode: "RATE_LIMITED" } });
    expect(screen.queryByTestId("results-error")).toBeNull();
    expect(screen.getByTestId("price-nok_1").props.accessibilityLabel).toBe(price);
    const why = /^Fikk ikke oppdatert prisene\. For mange forespørsler\. Prøv igjen om litt\. Prisene under er fra kl\. \d{2}:\d{2}\.$/;
    expect(screen.getByTestId("refresh-error")).toHaveTextContent(why);
    expect(announce.mock.calls.some(([text]) => why.test(text))).toBe(true);
    expect(refreshControl().props.refreshing).toBe(false);

    // Neste forsøk lykkes: beskjeden forsvinner.
    s.hold();
    await pull();
    await s.answer({ data: UPDATED });
    expect(screen.queryByTestId("refresh-error")).toBeNull();
    expect(screen.getByTestId("price-nok_1")).toHaveTextContent(/1\s990\skr/);
  });

  it("«Oppdater prisene» og «Søk på nytt» med samme datoer gjør det samme: listen står", async () => {
    const s = await showResults();
    s.hold();
    await fireEvent.press(screen.getByTestId("test-same-search"));
    expect(screen.queryByTestId("results-loading")).toBeNull();
    expect(screen.getByTestId("price-refreshing")).toBeOnTheScreen();
    await s.answer({ data: SEARCH_RESULT });
    expect(screen.queryByTestId("price-refreshing")).toBeNull();
  });

  it("et annet søk (nye datoer) viser plassholderne, ikke den forrige listen", async () => {
    const s = await showResults();
    s.hold();
    await fireEvent.press(screen.getByTestId("test-new-dates"));
    expect(screen.getByTestId("results-loading")).toBeOnTheScreen();
    expect(screen.queryByTestId("offer-nok_1")).toBeNull();
    expect(screen.queryByTestId("price-refreshing")).toBeNull();
    await s.answer({ data: SEARCH_RESULT });
    expect(screen.getByTestId("results-list")).toBeOnTheScreen();
  });

  it("uten et svar å vise (første søk feilet) gir «Prøv igjen» plassholderne, ikke en tom liste", async () => {
    const s = controlledServer();
    s.hold();
    await render(
      <AppProvider initialLocale="nb" apiFactory={s.factory} initial={{ destination: BCN, departDate: "2026-10-23", returnDate: "2026-10-30" }}>
        <Harness>
          <ResultsScreen />
        </Harness>
      </AppProvider>,
    );
    await s.answer({ status: 503, error: { message: "down", appCode: "SUPPLIER_UNAVAILABLE" } });
    expect(screen.getByTestId("results-error")).toBeOnTheScreen();
    s.hold();
    await fireEvent.press(screen.getByTestId("retry-search"));
    expect(screen.getByTestId("results-loading")).toBeOnTheScreen();
    await s.answer({ data: SEARCH_RESULT });
    expect(screen.getByTestId("results-list")).toBeOnTheScreen();
  });
});

describe("flydetaljene mens prisene oppdateres", () => {
  it("reisen som er åpen, står til det nye svaret er her", async () => {
    const s = controlledServer();
    setParams({ id: "nok_1" });
    await render(
      <AppProvider initialLocale="nb" apiFactory={s.factory} initial={{ destination: BCN, departDate: "2026-10-23", returnDate: "2026-10-30" }}>
        <Harness>
          <OfferScreen />
        </Harness>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("bar-provider")).toBeOnTheScreen());
    s.hold();
    await fireEvent.press(screen.getByTestId("test-same-search"));
    expect(screen.getByTestId("bar-provider")).toHaveTextContent("Kiwi.com ·");
    await s.answer({ data: SEARCH_RESULT });
    expect(screen.getByTestId("bar-provider")).toHaveTextContent("Kiwi.com ·");
  });
});
