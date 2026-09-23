import { useEffect, type ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { SEARCH_RESULT, SEK_OFFER } from "../test/fixtures";
import ResultsScreen from "../app/resultater";

// Serveren holder utenfor tilbud som ikke gjelder søket (annen flyplass, annen dato, manglende retur) og sier hvor
// mange. Appen sier det rett ut – og viser aldri noe annet i stedet.

const BCN = { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spania" };

function SearchOnMount({ children }: { children: ReactNode }) {
  const { runSearch } = useApp();
  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

async function renderResults(result: object, locale: "nb" | "en" = "nb", tripType: "roundtrip" | "oneway" = "roundtrip") {
  const server = fakeServer({ "flights.search": () => ({ data: result }) });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  await render(
    <AppProvider initialLocale={locale} apiFactory={factory} initial={{ destination: BCN, tripType }}>
      <SearchOnMount>
        <ResultsScreen />
      </SearchOnMount>
    </AppProvider>,
  );
}

const MIXED = { ...SEARCH_RESULT, provider: "kayak", sandbox: true, offers: [SEK_OFFER], excluded: { count: 7, reasons: { origin: 2, destination: 2, date: 2, slices: 1 } } };
const NONE_LEFT = { ...MIXED, offers: [] };

describe("tilbud som ikke gjaldt søket", () => {
  it.each([
    ["nb", "7 tilbud fra tilbyderen gjaldt ikke søket ditt (annen flyplass, annen dato, uten hjemreise) og vises ikke."],
    ["en", "7 offers from the provider didn't match your search (different airport, different date, no return flight) and aren't shown."],
  ] as const)("noen vises (%s): en linje sier hvor mange som er holdt utenfor og hvorfor", async (locale, text) => {
    await renderResults(MIXED, locale);
    await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
    expect(screen.getByTestId("excluded-notice")).toHaveTextContent(text);
    expect(screen.getByTestId("offer-sek_1")).toBeOnTheScreen();
  });

  it.each([
    ["nb", "Ingen reiser passet søket", "Tilbyderen svarte, men ingen av de 7 tilbudene gjaldt flyplassene og datoene du valgte (annen flyplass, annen dato, uten hjemreise). Prøv andre datoer eller en annen flyplass."],
    ["en", "No journeys matched your search", "The provider answered, but none of its 7 offers were for your airports and dates (different airport, different date, no return flight). Try other dates or another airport."],
  ] as const)("alle holdt utenfor (%s): en sann tom tilstand, ingen kort og ingen erstatningspriser", async (locale, title, body) => {
    await renderResults(NONE_LEFT, locale);
    await waitFor(() => expect(screen.getByTestId("results-excluded-empty")).toBeOnTheScreen());
    expect(screen.getByText(title)).toBeOnTheScreen();
    expect(screen.getByText(body)).toBeOnTheScreen();
    expect(screen.queryByTestId(/^offer-/)).toBeNull();
    expect(screen.queryByTestId("excluded-notice")).toBeNull();
    expect(screen.getByTestId("edit-search-state")).toBeOnTheScreen();
  });

  it("en vei: et tilbud med en ekstra strekning forklares som det", async () => {
    await renderResults({ ...NONE_LEFT, slices: SEARCH_RESULT.slices.slice(0, 1), excluded: { count: 1, reasons: { slices: 1 } } }, "nb", "oneway");
    await waitFor(() => expect(screen.getByTestId("results-excluded-empty")).toBeOnTheScreen());
    expect(screen.getByText("Tilbyderen svarte, men det ene tilbudet gjaldt ikke flyplassene og datoene du valgte (en ekstra strekning). Prøv andre datoer eller en annen flyplass.")).toBeOnTheScreen();
  });

  it("eldre server uten feltet, eller ingenting holdt utenfor: ingen linje, vanlig tom tilstand", async () => {
    await renderResults({ ...SEARCH_RESULT, offers: [] });
    await waitFor(() => expect(screen.getByText("Ingen fly funnet")).toBeOnTheScreen());
    expect(screen.queryByTestId("results-excluded-empty")).toBeNull();
    screen.unmount();
    await renderResults({ ...MIXED, excluded: { count: 0, reasons: {} } });
    await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
    expect(screen.queryByTestId("excluded-notice")).toBeNull();
  });
});
