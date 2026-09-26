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

async function renderResults(result: object, locale: "nb" | "en" = "nb") {
  const server = fakeServer({ "flights.search": () => ({ data: result }) });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  await render(
    <AppProvider initialLocale={locale} apiFactory={factory} initial={{ destination: BCN }}>
      <SearchOnMount>
        <ResultsScreen />
      </SearchOnMount>
    </AppProvider>,
  );
}

const MIXED = { ...SEARCH_RESULT, provider: "kayak", sandbox: true, offers: [SEK_OFFER], excluded: { count: 7, reasons: { origin: 2, destination: 2, date: 2, missing_leg: 1 } } };
const NONE_LEFT = { ...MIXED, offers: [] };

describe("tilbud som ikke gjaldt søket", () => {
  it.each([
    ["nb", "7 tilbud fra tilbyderen gjaldt ikke søket ditt (annen flyplass, annen dato, en strekning mangler) og vises ikke."],
    ["en", "7 offers from the provider didn't match your search (different airport, different date, a missing leg) and aren't shown."],
  ] as const)("noen vises (%s): en linje sier hvor mange som er holdt utenfor og hvorfor", async (locale, text) => {
    await renderResults(MIXED, locale);
    await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
    expect(screen.getByTestId("excluded-notice")).toHaveTextContent(text);
    expect(screen.getByTestId("offer-sek_1")).toBeOnTheScreen();
  });

  it.each([
    ["nb", "Ingen reiser passet søket", "Tilbyderen svarte, men ingen av de 7 tilbudene gjaldt flyplassene og datoene du valgte (annen flyplass, annen dato, en strekning mangler). Prøv andre datoer eller en annen flyplass."],
    ["en", "No journeys matched your search", "The provider answered, but none of its 7 offers were for your airports and dates (different airport, different date, a missing leg). Try other dates or another airport."],
  ] as const)("alle holdt utenfor (%s): en sann tom tilstand, ingen kort og ingen erstatningspriser", async (locale, title, body) => {
    await renderResults(NONE_LEFT, locale);
    await waitFor(() => expect(screen.getByTestId("results-excluded-empty")).toBeOnTheScreen());
    expect(screen.getByText(title)).toBeOnTheScreen();
    expect(screen.getByText(body)).toBeOnTheScreen();
    expect(screen.queryByTestId(/^offer-/)).toBeNull();
    expect(screen.queryByTestId("excluded-notice")).toBeNull();
    expect(screen.getByTestId("edit-search-state")).toBeOnTheScreen();
  });

  it.each([
    ["extra_leg", "en ekstra strekning"],
    ["incomplete", "ufullstendige flydata"],
    ["missing_leg", "en strekning mangler"],
  ] as const)("strekningene (%s) forklares nøyaktig, uten å gjette hvilken", async (reason, why) => {
    await renderResults({ ...NONE_LEFT, excluded: { count: 1, reasons: { [reason]: 1 } } });
    await waitFor(() => expect(screen.getByTestId("results-excluded-empty")).toBeOnTheScreen());
    expect(screen.getByText(`Tilbyderen svarte, men det ene tilbudet gjaldt ikke flyplassene og datoene du valgte (${why}). Prøv andre datoer eller en annen flyplass.`)).toBeOnTheScreen();
  });

  it("flere strekningsgrunner samtidig, på engelsk", async () => {
    await renderResults({ ...NONE_LEFT, excluded: { count: 3, reasons: { missing_leg: 1, extra_leg: 1, incomplete: 1 } } }, "en");
    await waitFor(() => expect(screen.getByTestId("results-excluded-empty")).toBeOnTheScreen());
    expect(screen.getByText("The provider answered, but none of its 3 offers were for your airports and dates (a missing leg, an extra leg, incomplete flight data). Try other dates or another airport.")).toBeOnTheScreen();
  });

  it("eldre server uten feltet: vanlig tom tilstand", async () => {
    await renderResults({ ...SEARCH_RESULT, offers: [] });
    await waitFor(() => expect(screen.getByText("Ingen fly funnet")).toBeOnTheScreen());
    expect(screen.queryByTestId("results-excluded-empty")).toBeNull();
  });

  it("ingenting holdt utenfor: ingen linje", async () => {
    await renderResults({ ...MIXED, excluded: { count: 0, reasons: {} } });
    await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
    expect(screen.queryByTestId("excluded-notice")).toBeNull();
  });
});
