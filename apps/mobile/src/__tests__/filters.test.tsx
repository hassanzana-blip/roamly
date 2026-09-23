import { useEffect, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import type { MobileSearchResult } from "@contracts/mobileSearch";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { NOK_OFFER, SAME_TRIP_OTHER_SELLER, SEARCH_RESULT, SEK_OFFER } from "../test/fixtures";
import ResultsScreen from "../app/resultater";

// Resultatsiden: sortering, filterbrikker, filterarket, datoer og gruppering
// av samme reise hos flere tilbydere – mot ekte app-tilstand og API-klient.

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

async function renderResults(result: MobileSearchResult) {
  const server = fakeServer({ "flights.search": () => ({ data: result }) });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  await render(
    <AppProvider initialLocale="nb" apiFactory={factory} initial={{ destination: BCN, departDate: "2026-10-23", returnDate: "2026-10-30" }}>
      <SearchOnMount>
        <ResultsScreen />
      </SearchOnMount>
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
  return server;
}

const cardIds = () => screen.getAllByTestId(/^offer-/).map((el) => el.props.testID as string);

describe("sortering", () => {
  it("«Billigst» er serverens rekkefølge; «Raskest» sorterer på reisetid; uten kronepris står sist", async () => {
    await renderResults(withDirect());
    expect(cardIds()).toEqual(["offer-sek_1", "offer-hs_eur", "offer-nok_1", "offer-unsafe_1", "offer-thb_1", "offer-direct_1"]);
    expect(screen.getByText("Laveste pris først")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("open-sort"));
    await fireEvent.press(screen.getByTestId("sort-duration"));
    expect(cardIds()[0]).toBe("offer-direct_1");
    expect(cardIds().at(-1)).toBe("offer-thb_1");
    expect(screen.getByText("Korteste reisetid først")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("open-sort-toolbar"));
    await fireEvent.press(screen.getByTestId("sort-price"));
    expect(cardIds()[0]).toBe("offer-sek_1");
  });
});

describe("filtre", () => {
  it("brikken «Direkte» filtrerer, teller skjulte og merker filterknappen; «Alle» nullstiller", async () => {
    await renderResults(withDirect());
    await fireEvent.press(screen.getByTestId("chip-direct"));
    expect(cardIds()).toEqual(["offer-direct_1"]);
    expect(screen.getByTestId("result-count")).toHaveTextContent("1 reise · 1 tilbud · 5 skjult av filtre");
    expect(screen.getByLabelText("Filtrer, 1 aktive")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("chip-all"));
    expect(cardIds()).toHaveLength(6);
  });

  it("filterarket: valg uten treff er sperret, avgangstid virker og «Nullstill filtre» fjerner alt", async () => {
    await renderResults(withDirect());
    await fireEvent.press(screen.getByTestId("open-filters"));
    expect(screen.getByTestId("band-night").props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByTestId("band-afternoon"));
    expect(cardIds()).toEqual(["offer-direct_1"]);
    expect(screen.getByTestId("filter-apply").props.accessibilityLabel).toBe("Vis 1 reise");
    await fireEvent.press(screen.getByTestId("band-afternoon"));
    await fireEvent.press(screen.getByTestId("band-morning"));
    expect(cardIds()).toHaveLength(5);
    // Ingen morgenavgang er direkte: valget er sperret i stedet for å gi en tom liste.
    expect(screen.getByTestId("stops-direct").props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByLabelText("Direkte, 0 reiser")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("filter-reset"));
    expect(cardIds()).toHaveLength(6);
    expect(screen.queryByText(/skjult av filtre/)).toBeNull();
  });

  it("bagasjefilteret finnes bare når noen tilbud har innsjekket bagasje – og «fra»-prisen er et tilbud som passer", async () => {
    await renderResults(SEARCH_RESULT);
    expect(screen.queryByTestId("chip-bags")).toBeNull();
    await screen.unmount();

    await renderResults({ ...SEARCH_RESULT, offers: [SEK_OFFER, SAME_TRIP_OTHER_SELLER, NOK_OFFER] });
    await fireEvent.press(screen.getByTestId("chip-bags"));
    // Bare Gotogate har innsjekket bagasje: SAS-reisen vises med Gotogates pris, alene.
    expect(cardIds()).toEqual(["offer-gtg_1"]);
    expect(within(screen.getByTestId("price-gtg_1")).getByText(/^1\s390\skr$/)).toBeOnTheScreen();
    expect(screen.queryByText("2 tilbydere")).toBeNull();
  });
});

describe("samme reise hos flere tilbydere", () => {
  it("ett kort per reise; den billigste tilbyderen representerer den; tellingen skiller reiser og tilbud", async () => {
    await renderResults({ ...SEARCH_RESULT, offers: [SAME_TRIP_OTHER_SELLER, SEK_OFFER, NOK_OFFER] });
    expect(cardIds()).toEqual(["offer-gtg_1", "offer-nok_1"]);
    expect(within(screen.getByTestId("offer-gtg_1")).getByText("2 tilbydere")).toBeOnTheScreen();
    expect(screen.getByTestId("result-count")).toHaveTextContent("2 reiser · 3 tilbud");
  });
});

describe("resultatkortet", () => {
  it("tur-retur viser både ut- og hjemreise, og hva prisen gjelder", async () => {
    await renderResults(SEARCH_RESULT);
    const card = within(screen.getByTestId("offer-sek_1"));
    expect(card.getByText("Ut · 23. okt.")).toBeOnTheScreen();
    expect(card.getByText("Hjem · 30. okt.")).toBeOnTheScreen();
    expect(card.getByText("Totalt for 1 voksen · Tur-retur")).toBeOnTheScreen();
    expect(card.getByText("Håndbagasje inkludert")).toBeOnTheScreen();
    expect(card.getByText("Innsjekket bagasje: ikke oppgitt")).toBeOnTheScreen();
  });
});

describe("datoer", () => {
  it("«Datoer» i verktøylinjen søker på nytt med den nye datoen", async () => {
    const server = await renderResults(SEARCH_RESULT);
    await fireEvent.press(screen.getByTestId("open-dates"));
    await fireEvent(screen.getByTestId("dates-depart"), "onChange", {}, new Date(2026, 10, 2));
    await fireEvent.press(screen.getByTestId("dates-search"));
    await waitFor(() => expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(2));
    const last = server.calls.filter((c) => c.path === "flights.search").at(-1)!;
    expect((last.input as { slices: { departureDate: string }[] }).slices[0]!.departureDate).toBe("2026-11-02");
    // Hjemreisen var før den nye utreisen: flyttes en uke etter.
    expect((last.input as { slices: { departureDate: string }[] }).slices[1]!.departureDate).toBe("2026-11-09");
  });
});

describe("flere filtre i filterarket", () => {
  it("flyselskap og makspris: bare fra svaret, og uten kronepris skjules under en prisgrense", async () => {
    const base = withDirect();
    const last = base.offers.at(-1)!;
    const dy = { ...last, offer: { ...last.offer, slices: last.offer.slices.map((s) => ({ ...s, segments: s.segments.map((g) => ({ ...g, carrier: { iata: "DY", name: "Norwegian" } })) })) } };
    await renderResults({ ...base, offers: [...base.offers.slice(0, -1), dy] });
    await fireEvent.press(screen.getByTestId("open-filters"));

    expect(screen.getByTestId("airline-DY")).toHaveTextContent(/Norwegian \(DY\)/);
    await fireEvent.press(screen.getByTestId("airline-DY"));
    expect(cardIds()).toEqual(["offer-direct_1"]);
    await fireEvent.press(screen.getByTestId("airline-DY"));

    const limits = screen.getAllByTestId(/^price-\d+$/);
    expect(limits.length).toBeGreaterThan(0);
    await fireEvent.press(limits[0]!);
    expect(cardIds()).not.toContain("offer-thb_1");
    expect(cardIds()).not.toContain("offer-direct_1");
    await fireEvent.press(screen.getByTestId("price-any"));
    expect(cardIds()).toContain("offer-thb_1");
  });
});

describe("endre søket", () => {
  it("«Endre søk» går til søkeskjemaet på forsiden, også når søket startet fra Utforsk", async () => {
    const router = (globalThis as unknown as { __router: { navigate: jest.Mock; back: jest.Mock } }).__router;
    await renderResults(SEARCH_RESULT);
    await fireEvent.press(screen.getByTestId("edit-search"));
    expect(router.navigate).toHaveBeenCalledWith("/");
    expect(router.back).not.toHaveBeenCalled();
  });
});

describe("fra kort til detaljer", () => {
  it("første kort åpner detaljene for akkurat det tilbudet (kortets billigste tilbyder)", async () => {
    const router = (globalThis as unknown as { __router: { push: jest.Mock } }).__router;
    await renderResults(SEARCH_RESULT);
    const firstId = cardIds()[0]!.replace(/^offer-/, "");
    await fireEvent.press(screen.getAllByTestId(/^offer-/)[0]!);
    expect(router.push).toHaveBeenLastCalledWith({ pathname: "/tilbud/[id]", params: { id: firstId } });
  });
});
