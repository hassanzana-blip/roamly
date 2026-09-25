import { useEffect, type ReactNode } from "react";
import { Dimensions, StyleSheet, Text } from "react-native";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
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
  it("standard «Best»; fanene viser ekte pris og reisetid for toppen av hver sortering og bytter rekkefølgen", async () => {
    await renderResults(withDirect());
    const selected = (key: string) => screen.getByTestId(`sort-tab-${key}`).props.accessibilityState?.selected;
    expect([selected("best"), selected("price"), selected("duration")]).toEqual([true, false, false]);
    // Best: pris mot billigste, reisetid mot raskeste og bytter. Den dyre direkteruten (3 500 kr) veier ikke opp.
    expect(cardIds()).toEqual(["offer-sek_1", "offer-hs_eur", "offer-nok_1", "offer-unsafe_1", "offer-direct_1", "offer-thb_1"]);
    expect(screen.getByTestId("sort-summary")).toHaveTextContent("Pris, reisetid og bytter veid sammen");
    // Fanene: tallene til reisen som står øverst med hver sortering.
    expect(screen.getByTestId("sort-tab-price")).toHaveTextContent(/Billigst.*ca\.\s1\s442\skr.*4 t 35 min/);
    expect(screen.getByTestId("sort-tab-duration")).toHaveTextContent(/Raskest.*3\s500\skr.*2 t 30 min/);
    expect(screen.getByTestId("sort-tab-duration").props.accessibilityLabel).toMatch(/^Raskest, 3\s500 kroner, i snitt 2 timer 30 minutter per vei$/);

    await fireEvent.press(screen.getByTestId("sort-tab-duration"));
    expect(selected("duration")).toBe(true);
    expect(cardIds()[0]).toBe("offer-direct_1");
    expect(cardIds().at(-1)).toBe("offer-thb_1");
    expect(screen.getByText("Korteste reisetid først")).toBeOnTheScreen();

    // «Billigst» er serverens rekkefølge, urørt.
    await fireEvent.press(screen.getByTestId("sort-tab-price"));
    expect(cardIds()).toEqual(["offer-sek_1", "offer-hs_eur", "offer-nok_1", "offer-unsafe_1", "offer-thb_1", "offer-direct_1"]);
    expect(screen.getByText("Laveste pris først")).toBeOnTheScreen();
  });

  it("«Sorter»: fem valg, «Best» forklart åpent; tidligst avgang velges der, og da er ingen fane valgt", async () => {
    await renderResults(withDirect());
    await fireEvent.press(screen.getByTestId("open-sort-toolbar"));
    for (const key of ["best", "price", "duration", "departure", "stops"]) expect(screen.getByTestId(`sort-${key}`)).toBeOnTheScreen();
    expect(screen.getByTestId("best-explained")).toHaveTextContent(/pris.*reisetid.*mellomlandinger.*Ingen betaler for plassering\./);
    await fireEvent.press(screen.getByTestId("sort-departure"));
    // Alle testreisene går 07:05 unntatt direkteruten (14:20); lik tid avgjøres av prisen, uten kronepris sist.
    expect(cardIds()).toEqual(["offer-sek_1", "offer-hs_eur", "offer-nok_1", "offer-unsafe_1", "offer-direct_1", "offer-thb_1"]);
    expect(screen.getByTestId("sort-summary")).toHaveTextContent("Tidligste avgang på utreisen først");
    for (const key of ["best", "price", "duration"]) expect(screen.getByTestId(`sort-tab-${key}`).props.accessibilityState?.selected).toBe(false);
  });

  it("stor tekst: fanene står side om side til et beløp brytes – da under hverandre, for akkurat den tekststørrelsen", async () => {
    const baseWindow = Dimensions.get("window");
    const setScale = (fontScale: number) => act(async () => Dimensions.set({ window: { ...baseWindow, fontScale }, screen: { ...Dimensions.get("screen"), fontScale } }));
    Dimensions.set({ window: baseWindow, screen: Dimensions.get("screen") });
    try {
      await setScale(1.2);
      await renderResults(withDirect());
      const direction = () => StyleSheet.flatten(screen.getByTestId("sort-tabs").props.style).flexDirection;
      expect(direction()).toBe("row");
      const oneLine = { nativeEvent: { layout: { x: 0, y: 0, width: 90, height: 21 * 1.2 } } };
      await fireEvent(screen.getByTestId("sort-tab-price-price"), "layout", oneLine);
      expect(direction()).toBe("row");
      // «1 442 kr» delt over to linjer: under hverandre.
      await fireEvent(screen.getByTestId("sort-tab-price-price"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 60, height: 2 * 21 * 1.2 } } });
      expect(direction()).toBe("column");
      // Tilgjengelighetsstørrelser: alltid under hverandre.
      await setScale(1.8);
      expect(direction()).toBe("column");
    } finally {
      await setScale(baseWindow.fontScale);
    }
  });

  it("én reise: ingen faner (ingenting å veie mot)", async () => {
    await renderResults({ ...SEARCH_RESULT, offers: [SEK_OFFER] });
    expect(screen.queryByTestId("sort-tabs")).toBeNull();
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
    expect(card.getAllByText(/07:05 – 13:40/)).toHaveLength(2);
    // Byttestedet står ved mellomlandingen.
    expect(card.getAllByText(/OSL → BCN · 4 t 35 min · 1 mellomlanding · CPH|BCN → OSL · 4 t 35 min · 1 mellomlanding · CPH/)).toHaveLength(2);
    // Beløpet: «Totalt for …»; begge strekningene står på kortet, så «Tur-retur» gjentas ikke der – VoiceOver får det.
    expect(card.getByText("Totalt for 1 voksen")).toBeOnTheScreen();
    // Kortet viser en kort form; «Uten …» og «ikke oppgitt» skrives helt ut. VoiceOver får alt i sin helhet.
    expect(card.getByText("Håndbagasje inkl.")).toBeOnTheScreen();
    expect(card.getByText("Innsjekket bagasje: ikke oppgitt")).toBeOnTheScreen();
    const spoken = screen.getByTestId("offer-sek_1").props.accessibilityLabel as string;
    expect(spoken).toContain("Håndbagasje inkludert. Innsjekket bagasje: ikke oppgitt.");
    expect(spoken).toContain("1 mellomlanding i København");
    expect(spoken).toContain("totalt for 1 voksen · tur-retur");
  });
});

describe("datoer", () => {
  it("«Datoer» i verktøylinjen søker på nytt med den nye datoen", async () => {
    const server = await renderResults(SEARCH_RESULT);
    await fireEvent.press(screen.getByTestId("open-dates"));
    // Kalenderen åpner på avreise; ett trykk på 2. november velger ny avreise.
    expect(screen.getByTestId("dates-sheet-hint")).toHaveTextContent("Velg avreisedato");
    await fireEvent.press(screen.getByTestId("day-2026-11-02"));
    expect(screen.getByTestId("dates-sheet-hint")).toHaveTextContent("Velg returdato");
    await fireEvent.press(screen.getByTestId("dates-search"));
    await waitFor(() => expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(2));
    const last = server.calls.filter((c) => c.path === "flights.search").at(-1)!;
    expect((last.input as { slices: { departureDate: string }[] }).slices[0]!.departureDate).toBe("2026-11-02");
    // Hjemreisen var før den nye utreisen: flyttes med samme reiselengde (en uke).
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

describe("resultatsiden følger søket som vises", () => {
  function Controls() {
    const { setForm, runSearch } = useApp();
    return (
      <>
        <Text testID="set-lhr" onPress={() => setForm((f) => ({ ...f, destination: { iata: "LHR", name: "Heathrow", city: "London", country: "UK" } }))}>
          lhr
        </Text>
        <Text testID="rerun" onPress={() => runSearch()}>
          rerun
        </Text>
      </>
    );
  }

  async function renderWithControls(result: MobileSearchResult) {
    const server = fakeServer({ "flights.search": () => ({ data: result }) });
    const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
    await render(
      <AppProvider initialLocale="nb" apiFactory={factory} initial={{ destination: BCN, departDate: "2026-10-23", returnDate: "2026-10-30" }}>
        <SearchOnMount>
          <ResultsScreen />
          <Controls />
        </SearchOnMount>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
    return server;
  }

  it("et skjema som endres uten nytt søk, endrer ikke overskriften", async () => {
    await renderWithControls(withDirect());
    await fireEvent.press(screen.getByTestId("set-lhr"));
    expect(screen.getByText("Oslo → Barcelona")).toBeOnTheScreen();
    expect(screen.queryByText("Oslo → London")).toBeNull();
  });

  it("filtrene står når samme søk kjøres på nytt, men nullstilles for et annet søk", async () => {
    const server = await renderWithControls(withDirect());
    await fireEvent.press(screen.getByTestId("chip-direct"));
    expect(cardIds()).toEqual(["offer-direct_1"]);
    await fireEvent.press(screen.getByTestId("rerun"));
    await waitFor(() => expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(2));
    await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
    expect(cardIds()).toEqual(["offer-direct_1"]);

    await fireEvent.press(screen.getByTestId("set-lhr"));
    await fireEvent.press(screen.getByTestId("rerun"));
    await waitFor(() => expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(3));
    await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
    expect(cardIds().length).toBeGreaterThan(1);
  });

  it("sorteringen forklarer hvordan «ca.»-priser rangeres", async () => {
    await renderWithControls(withDirect());
    await fireEvent.press(screen.getByTestId("open-sort-toolbar"));
    expect(screen.getByText("Priser merket «ca.» rangeres etter det omregnede kronebeløpet, som kan avvike fra det tilbyderen tar betalt.")).toBeOnTheScreen();
  });
});

describe("feil i søket", () => {
  async function renderError(error: { message: string; appCode: string }) {
    const server = fakeServer({ "flights.search": () => ({ status: 400, error }) });
    const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
    await render(
      <AppProvider initialLocale="nb" apiFactory={factory} initial={{ destination: BCN }}>
        <SearchOnMount>
          <ResultsScreen />
        </SearchOnMount>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("results-error")).toBeOnTheScreen());
  }

  it("et ugyldig søk tilbyr ikke «Prøv igjen», bare «Endre søk»", async () => {
    await renderError({ message: "Ugyldig søk.", appCode: "VALIDATION" });
    expect(screen.queryByTestId("retry-search")).toBeNull();
    expect(screen.getByTestId("edit-search-state")).toBeOnTheScreen();
  });

  it("en leverandør som ikke svarte i tide: «Prøv igjen» er hovedvalget", async () => {
    await renderError({ message: "Leverandøren svarte ikke i tide.", appCode: "SUPPLIER_TIMEOUT" });
    expect(screen.getByTestId("retry-search")).toBeOnTheScreen();
  });
});
