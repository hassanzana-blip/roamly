import { useEffect, type ReactNode } from "react";
import { Pressable, Share, Text } from "react-native";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { SEARCH_RESULT } from "../test/fixtures";
import ResultsScreen from "../app/resultater";
import OfferScreen from "../app/tilbud/[id]";

// «Totalt for …» bare når serveren bekreftet at prisen gjelder alle reisende. Ellers: samme beløp, merket
// «Tilbyderens pris, total ikke bekreftet», en forklaring, ingen «total»-sortering og ikke noe prisfilter.

const setParams = (globalThis as unknown as { __setParams: (p: Record<string, string>) => void }).__setParams;
const BCN = { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spania" };
const FAMILY = { destination: BCN, adults: 2, childAges: [8], infantAges: [1] };
const FAMILY_PAX = [
  { id: "p1", type: "adult" as const },
  { id: "p2", type: "adult" as const },
  { id: "p3", type: "child" as const, age: 8 },
  { id: "p4", type: "infant_without_seat" as const, age: 1 },
];
// Alle testdataenes tilbud, priset for de fire reisende (flere priser gir et prisfilter i den bekreftede testen).
const base = { ...SEARCH_RESULT, offers: SEARCH_RESULT.offers.map((o) => ({ ...o, offer: { ...o.offer, passengers: FAMILY_PAX } })) };
const VERIFIED = { ...base, priceBasis: { kind: "total" } };
const PER_PERSON = { ...base, priceBasis: { kind: "unverified", reason: "per_person" } };
const OLD_KAYAK = { ...base, priceBasis: undefined };
const OLD_DEMO = { ...base, provider: "demo", priceBasis: undefined };

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

async function show(result: object | object[], screenName: "results" | "details", locale: "nb" | "en" = "nb") {
  const results = Array.isArray(result) ? [...result] : [result];
  const server = fakeServer({ "flights.search": () => ({ data: results.length > 1 ? results.shift() : results[0] }) });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  setParams({ id: "sek_1" });
  await render(
    <AppProvider initialLocale={locale} apiFactory={factory} initial={FAMILY}>
      <SearchOnMount>{screenName === "results" ? <ResultsScreen /> : <OfferScreen />}</SearchOnMount>
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByTestId(screenName === "results" ? "results-list" : "offer-screen")).toBeOnTheScreen());
}

const NB_TOTAL = "Totalt for 2 voksne, 1 barn, 1 spedbarn · Tur-retur";
const NB_UNVERIFIED = "Tilbyderens pris, total ikke bekreftet · Tur-retur";
const NB_EXPLAINED = "Tilbyderen bekreftet ikke at prisene gjelder alle reisende. Sjekk totalprisen hos tilbyderen før du bestiller.";

describe("resultatkortet", () => {
  it("bekreftet total: «Totalt for» alle fire, ingen forklaring, vanlig sortering og prisfilter", async () => {
    await show(VERIFIED, "results");
    const card = within(screen.getByTestId("offer-sek_1"));
    expect(card.getByText(NB_TOTAL)).toBeOnTheScreen();
    expect(screen.queryByTestId("price-basis-notice")).toBeNull();
    expect(screen.getByTestId("sort-summary")).toHaveTextContent("Laveste pris først");
    await fireEvent.press(screen.getByTestId("open-filters"));
    await waitFor(() => expect(screen.getByTestId("filter-screen")).toBeOnTheScreen());
    expect(screen.getByTestId("price-any")).toBeOnTheScreen();
  });

  it.each([
    ["perPerson for fire", PER_PERSON],
    ["eldre server, KAYAK", OLD_KAYAK],
  ])("ubekreftet (%s): samme beløp, «Tilbyderens pris», forklaring, nøytral sortering, ingen «Totalt for» noe sted", async (_n, result) => {
    await show(result, "results");
    const card = screen.getByTestId("offer-sek_1");
    expect(within(card).getByText(NB_UNVERIFIED)).toBeOnTheScreen();
    expect(within(card).queryByText(/Totalt for/)).toBeNull();
    expect(card.props.accessibilityLabel).toContain(NB_UNVERIFIED.toLowerCase());
    expect(card.props.accessibilityLabel).not.toMatch(/totalt for/);
    // Beløpet er uendret (1 500 SEK ≈ 1 442 kr, som i den bekreftede testen) – aldri ganget med antall reisende.
    expect(screen.getByTestId("price-sek_1")).toHaveTextContent(/1\s442\skr/);
    expect(screen.getByTestId("price-sek_1")).not.toHaveTextContent(/5\s768/);
    expect(screen.getByTestId("price-basis-notice")).toHaveTextContent(NB_EXPLAINED);
    expect(screen.getByTestId("sort-summary")).toHaveTextContent("Laveste pris fra tilbyderen først");
  });

  it("ubekreftet: prisfilteret («Opptil …») vises ikke, og et prisfilter valgt i et bekreftet søk fjernes", async () => {
    await show([VERIFIED, PER_PERSON], "results");
    await fireEvent.press(screen.getByTestId("open-filters"));
    await waitFor(() => expect(screen.getByTestId("filter-screen")).toBeOnTheScreen());
    const firstPrice = screen.getAllByTestId(/^price-\d+$/)[0]!;
    await fireEvent.press(firstPrice);
    expect(firstPrice.props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByTestId("filter-apply"));
    // Nytt søk: tilbyderen bekreftet ikke totalen.
    await fireEvent.press(screen.getByTestId("test-search-again"));
    await waitFor(() => expect(screen.getByTestId("price-basis-notice")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("open-filters"));
    await waitFor(() => expect(screen.getByTestId("filter-screen")).toBeOnTheScreen());
    expect(screen.queryByTestId("price-any")).toBeNull();
    expect(screen.queryAllByTestId(/^price-\d+$/)).toHaveLength(0);
    // Filteret er tatt bort, så alle reisene vises igjen.
    expect(screen.getByTestId("filter-apply")).toHaveTextContent(/^Vis \d+ reiser$/);
  });

  it("eldre server med demo-data: en kjent total, som før", async () => {
    await show(OLD_DEMO, "results");
    expect(within(screen.getByTestId("offer-sek_1")).getByText(NB_TOTAL)).toBeOnTheScreen();
    expect(screen.queryByTestId("price-basis-notice")).toBeNull();
  });

  it("engelsk", async () => {
    await show(PER_PERSON, "results", "en");
    expect(within(screen.getByTestId("offer-sek_1")).getByText("Provider's price, total not confirmed · Return")).toBeOnTheScreen();
    expect(screen.getByTestId("price-basis-notice")).toHaveTextContent("The provider didn't confirm that these prices cover all travellers. Check the total with the provider before you book.");
    expect(screen.getByTestId("sort-summary")).toHaveTextContent("Lowest provider price first");
  });
});

describe("flydetaljene", () => {
  afterEach(() => jest.restoreAllMocks());

  it("ubekreftet: bunnlinjen, prisfeltet, VoiceOver og delingsteksten sier «Tilbyderens pris», aldri «Totalt for»", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    await show(PER_PERSON, "details");
    const bar = within(screen.getByTestId("offer-bar"));
    expect(bar.getByText(NB_UNVERIFIED)).toBeOnTheScreen();
    expect(screen.getByTestId("bar-price").props.accessibilityLabel).toContain(NB_UNVERIFIED);
    expect(screen.getAllByText(NB_UNVERIFIED).length).toBeGreaterThanOrEqual(2); // prisfeltet og bunnlinjen
    expect(screen.queryByText(/Totalt for/)).toBeNull();
    expect(screen.getByTestId("price-basis-notice")).toHaveTextContent(NB_EXPLAINED);
    await fireEvent.press(screen.getByTestId("share"));
    const message = share.mock.calls[0]![0] as { message: string };
    expect(message.message).toContain(NB_UNVERIFIED.toLowerCase());
    expect(message.message).not.toMatch(/totalt for/i);
  });

  it("bekreftet: «Totalt for» i bunnlinjen, uten forklaring", async () => {
    await show(VERIFIED, "details");
    expect(within(screen.getByTestId("offer-bar")).getByText(NB_TOTAL)).toBeOnTheScreen();
    expect(screen.queryByTestId("price-basis-notice")).toBeNull();
  });
});
