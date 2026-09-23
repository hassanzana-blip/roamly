import { useEffect, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { MobileSearchResult } from "@contracts/mobileSearch";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { SEARCH_RESULT } from "../test/fixtures";
import ResultsScreen from "../app/resultater";
import FilterScreen from "../app/filter";

const router = (globalThis as unknown as { __router: { push: jest.Mock; back: jest.Mock; replace: jest.Mock } }).__router;
const BCN = { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spania" };

function SearchOnMount({ children }: { children: ReactNode }) {
  const { runSearch } = useApp();
  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

/** Resultatet med én ekstra direkte ettermiddagsavgang, så sortering og filtre har noe å skille på. */
function withDirect(): MobileSearchResult {
  const nok = SEARCH_RESULT.offers[2]!;
  const slices = nok.offer.slices.map((s) => ({ ...s, departingAt: s.departingAt.replace("07:05", "14:20"), durationMinutes: 150, stops: 0, segments: s.segments.slice(0, 1) }));
  const direct = { ...nok, offer: { ...nok.offer, id: "direct_1", slices }, price: { ...nok.price, nok: { ...nok.price.nok, amountMinor: 350000 } } } as typeof nok;
  return { ...SEARCH_RESULT, offers: [...SEARCH_RESULT.offers, direct] };
}

async function renderBoth(result: MobileSearchResult) {
  const server = fakeServer({ "flights.search": () => ({ data: result }) });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  await render(
    <AppProvider apiFactory={factory} initial={{ destination: BCN }}>
      <SearchOnMount>
        <ResultsScreen />
        <FilterScreen />
      </SearchOnMount>
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
}

const offerIds = () => screen.getAllByTestId(/^offer-/).map((el) => el.props.testID as string);

describe("sortering og filtre på resultatene", () => {
  it("sorteringsknappene endrer rekkefølgen; tilbud uten kronepris står sist", async () => {
    await renderBoth(withDirect());
    // «Billigst» er serverens rekkefølge, urørt.
    expect(offerIds()).toEqual(["offer-sek_1", "offer-hs_eur", "offer-nok_1", "offer-unsafe_1", "offer-thb_1", "offer-direct_1"]);
    await fireEvent.press(screen.getByTestId("sort-duration"));
    expect(offerIds()[0]).toBe("offer-direct_1");
    expect(offerIds().at(-1)).toBe("offer-thb_1");
    expect(screen.getByText(/raskeste først/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("sort-price"));
    expect(offerIds()[0]).toBe("offer-sek_1");
  });

  it("filteret «Bare direkte» viser bare direktefly, teller skjulte og merker filterknappen", async () => {
    await renderBoth(withDirect());
    expect(screen.getByLabelText("Bare direkte, 1 reise")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("stops-direct"));
    expect(offerIds()).toEqual(["offer-direct_1"]);
    expect(screen.getByText(/5 skjult av filtre/)).toBeOnTheScreen();
    expect(screen.getByLabelText("Filtrer, 1 aktive")).toBeOnTheScreen();
    expect(screen.getByTestId("filter-apply")).toHaveTextContent("Vis 1 reise");
    await fireEvent.press(screen.getByTestId("filter-apply"));
    expect(router.back).toHaveBeenCalled();
  });

  it("valg som ville gitt null reiser kan ikke velges, og «Nullstill» fjerner filteret", async () => {
    await renderBoth(withDirect());
    expect(screen.getByTestId("band-night").props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByTestId("band-afternoon"));
    expect(offerIds()).toEqual(["offer-direct_1"]);
    await fireEvent.press(screen.getByTestId("band-afternoon"));
    await fireEvent.press(screen.getByTestId("band-morning"));
    expect(offerIds()).toHaveLength(5);
    // Ingen morgenavgang er direkte: valget er sperret i stedet for å gi en tom liste.
    expect(screen.getByTestId("stops-direct").props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByLabelText("Bare direkte, 0 reiser")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Nullstill avgangstid"));
    expect(offerIds()).toHaveLength(6);
    expect(screen.queryByText(/skjult av filtre/)).toBeNull();
  });

  it("uten søk: filterskjermen sier fra i stedet for å vise tomme valg", async () => {
    const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: fakeServer({}).fetchImpl });
    await render(
      <AppProvider apiFactory={factory}>
        <FilterScreen />
      </AppProvider>,
    );
    expect(screen.getByTestId("filter-empty")).toBeOnTheScreen();
  });
});
