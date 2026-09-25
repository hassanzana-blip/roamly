import { useEffect, type ReactNode } from "react";
import { AccessibilityInfo, Pressable, RefreshControl, Text } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { MobileSearchResult } from "@contracts/mobileSearch";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { NOK_OFFER, SAME_TRIP_OTHER_SELLER, SEARCH_RESULT, SEK_OFFER } from "../test/fixtures";
import type { Locale } from "../i18n/types";
import ResultsScreen from "../app/resultater";
import OfferScreen from "../app/tilbud/[id]";
import { pinClock } from "../test/clock";

// Oppdater prisene (dra ned, eller «Oppdater prisene»): samme søk på nytt. Listen står mens det nye svaret hentes, og
// de nye prisene kommer inn i den samme listen. Feiler det, står de forrige prisene, med beskjed om når de er fra.
// Et annet søk (nye datoer) viser plassholderne, som før. Åpne flydetaljer følger reisen, også når tilbudene får nye ID-er.

const setParams = (globalThis as unknown as { __setParams: (p: Record<string, string>) => void }).__setParams;
const BCN = { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spania" };
const announce = AccessibilityInfo.announceForAccessibility as jest.Mock;
const spoken = () => announce.mock.calls.map(([text]) => text as string);
const CLOCK = "\\d{2}:\\d{2}";

type Reply = { data: MobileSearchResult } | { status: number; error: { message: string; appCode: string } };

/** Kiwi.com-reisen (nok_1) koster 1 990 kr i det nye svaret. */
const UPDATED: MobileSearchResult = {
  ...SEARCH_RESULT,
  offers: SEARCH_RESULT.offers.map((o) =>
    o.offer.id === NOK_OFFER.offer.id ? { ...o, price: { ...o.price, total: { amount: "1990.00", currency: "NOK" }, nok: { kind: "exact", currency: "NOK", amountMinor: 199000, estimate: false } } } : o,
  ),
};
/** Som metasøket: samme fly, men nye tilbud-ID-er ved hvert søk. */
const withNewIds = (r: MobileSearchResult): MobileSearchResult => ({ ...r, offers: r.offers.map((o) => ({ ...o, offer: { ...o.offer, id: `${o.offer.id}_ny` } })) });
const EMPTY: MobileSearchResult = { ...SEARCH_RESULT, offers: [] };

/** Første søk svarer med `first` med en gang; `hold()` gjør at neste søk venter til testen svarer med `answer()`. */
function controlledServer(first: MobileSearchResult = SEARCH_RESULT) {
  const held: ((r: Reply) => void)[] = [];
  let holdNext = false;
  const server = fakeServer({
    "flights.search": (() => {
      if (!holdNext) return { data: first };
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
  const searches = () => server.calls.filter((c) => c.path === "flights.search");
  return { factory, hold, answer, searches };
}

function Harness({ children }: { children: ReactNode }) {
  const { runSearch, setForm } = useApp();
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
      {/* Som datoarket: nye datoer i skjemaet, uten å søke. */}
      <Pressable testID="test-edit-dates" onPress={() => setForm((f) => ({ ...f, departDate: "2026-11-02", returnDate: "2026-11-09" }))}>
        <Text>endre datoer</Text>
      </Pressable>
    </>
  );
}

async function showResults({ first = SEARCH_RESULT, locale = "nb" }: { first?: MobileSearchResult; locale?: Locale } = {}) {
  const s = controlledServer(first);
  await render(
    <AppProvider initialLocale={locale} apiFactory={s.factory} initial={{ destination: BCN, departDate: "2026-10-23", returnDate: "2026-10-30" }}>
      <Harness>
        <ResultsScreen />
      </Harness>
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
  announce.mockClear();
  return s;
}

/** Kontrollen for «dra ned» (iOS' UIRefreshControl). Testoppsettets RefreshControl husker den siste som ble vist. */
const refreshControl = () => (RefreshControl as unknown as { latestRef: { props: { refreshing: boolean; onRefresh: () => void; progressViewOffset?: number } } }).latestRef;
const pull = async () => {
  await act(async () => {
    refreshControl().props.onRefresh();
  });
};


// Klokken står fast (bare Date), så de faste reisedatoene i testene aldri har passert.
beforeEach(() => pinClock());
afterEach(() => jest.useRealTimers());

describe("dra ned for å oppdatere prisene", () => {
  it("listen står mens de nye prisene hentes; de kommer inn i den samme listen; VoiceOver hører start og slutt", async () => {
    const s = await showResults();
    expect(refreshControl().props.refreshing).toBe(false);
    s.hold();
    await pull();
    expect(s.searches()).toHaveLength(2);
    // Ingen plassholdere: kortene og prisene står, og linjen over listen sier hva som skjer og hvor gamle prisene er.
    expect(screen.queryByTestId("results-loading")).toBeNull();
    expect(screen.getByTestId("offer-nok_1")).toBeOnTheScreen();
    expect(screen.getByTestId("price-refreshing")).toHaveTextContent(new RegExp(`^Oppdaterer prisene fra kl\\. ${CLOCK} …$`));
    expect(refreshControl().props.refreshing).toBe(true);
    expect(spoken()).toEqual(["Oppdaterer prisene."]);

    await s.answer({ data: UPDATED });
    expect(screen.getByTestId("price-nok_1")).toHaveTextContent(/1\s990\skr/);
    expect(screen.queryByTestId("price-refreshing")).toBeNull();
    expect(refreshControl().props.refreshing).toBe(false);
    expect(spoken()).toEqual(["Oppdaterer prisene.", "Prisene er oppdatert. 5 reiser."]);
  });

  it("iOS' spinner står under statuslinjen, og vises bare når kunden dro ned – ikke når lenken eller arket startet det", async () => {
    const s = await showResults();
    expect(refreshControl().props.progressViewOffset).toBeGreaterThanOrEqual(0);
    s.hold();
    await fireEvent.press(screen.getByTestId("test-same-search"));
    expect(screen.getByTestId("price-refreshing")).toBeOnTheScreen();
    expect(refreshControl().props.refreshing).toBe(false);
    await s.answer({ data: SEARCH_RESULT });
    expect(screen.queryByTestId("price-refreshing")).toBeNull();
  });

  it("sorteringen og filtrene kunden valgte, står; VoiceOver sier antallet som vises", async () => {
    const s = await showResults();
    await fireEvent.press(screen.getByTestId("sort-tab-price"));
    const sortedByPrice = String(screen.getByTestId("sort-summary").props.children);
    // Et prisfilter fra arket (det laveste taket) skjuler noen reiser.
    await fireEvent.press(screen.getByTestId("open-filters"));
    await fireEvent.press(screen.getAllByTestId(/^price-\d+$/)[0]!);
    await fireEvent.press(screen.getByTestId("filter-apply"));
    const shown = String(screen.getByTestId("result-count").props.children[0]).split(" · ")[0];
    expect(shown).not.toBe("5 reiser");
    announce.mockClear();
    s.hold();
    await pull();
    await s.answer({ data: SEARCH_RESULT });
    // Én reise igjen: fanene er borte, men sorteringen står i linjen over listen.
    expect(screen.getByTestId("sort-summary")).toHaveTextContent(sortedByPrice);
    expect(screen.getByTestId("active-price")).toBeOnTheScreen();
    expect(spoken()).toEqual(["Oppdaterer prisene.", `Prisene er oppdatert. ${shown}.`]);
  });

  it("dra ned oppdaterer søket som vises – ikke datoer som er valgt i arket uten å søke", async () => {
    const s = await showResults();
    await fireEvent.press(screen.getByTestId("test-edit-dates"));
    s.hold();
    await pull();
    const last = s.searches().at(-1)!.input as { slices: { departureDate: string }[] };
    expect(last.slices.map((x) => x.departureDate)).toEqual(["2026-10-23", "2026-10-30"]);
    expect(screen.queryByTestId("results-loading")).toBeNull();
    expect(screen.getByTestId("price-refreshing")).toBeOnTheScreen();
    await s.answer({ data: SEARCH_RESULT });
    expect(screen.getByTestId("results-list")).toBeOnTheScreen();
  });

  it("feiler oppdateringen, står de forrige prisene – med beskjed om hva som skjedde og hvor gamle de er", async () => {
    const s = await showResults();
    const price = screen.getByTestId("price-nok_1").props.accessibilityLabel;
    s.hold();
    await pull();
    await s.answer({ status: 429, error: { message: "For mange forespørsler. Prøv igjen om litt.", appCode: "RATE_LIMITED" } });
    expect(screen.queryByTestId("results-error")).toBeNull();
    expect(screen.getByTestId("price-nok_1").props.accessibilityLabel).toBe(price);
    const why = new RegExp(`^Fikk ikke oppdatert prisene\\. For mange forespørsler\\. Prøv igjen om litt\\. Prisene under er fra kl\\. ${CLOCK}\\.$`);
    expect(screen.getByTestId("refresh-error")).toHaveTextContent(why);
    expect(spoken()).toHaveLength(2);
    expect(spoken()[1]).toMatch(why);
    expect(refreshControl().props.refreshing).toBe(false);

    // Neste forsøk lykkes: beskjeden forsvinner.
    s.hold();
    await pull();
    await s.answer({ data: UPDATED });
    expect(screen.queryByTestId("refresh-error")).toBeNull();
    expect(screen.getByTestId("price-nok_1")).toHaveTextContent(/1\s990\skr/);
  });

  it("uten reiser å vise sier en feilet oppdatering ingenting om priser", async () => {
    const s = await showResults({ first: EMPTY });
    s.hold();
    await pull();
    await s.answer({ status: 503, error: { message: "Leverandøren svarer ikke akkurat nå.", appCode: "SUPPLIER_UNAVAILABLE" } });
    expect(screen.getByTestId("refresh-error")).toHaveTextContent("Fikk ikke søkt på nytt. Leverandøren svarer ikke akkurat nå.");
    expect(screen.getByTestId("results-none")).toBeOnTheScreen();
    expect(spoken().at(-1)).toBe("Fikk ikke søkt på nytt. Leverandøren svarer ikke akkurat nå.");
  });

  it("på engelsk", async () => {
    const s = await showResults({ locale: "en" });
    s.hold();
    await pull();
    expect(screen.getByTestId("price-refreshing")).toHaveTextContent(new RegExp(`^Updating the prices from ${CLOCK} …$`));
    expect(spoken()).toEqual(["Updating the prices."]);
    await s.answer({ status: 503, error: { message: "down", appCode: "SUPPLIER_UNAVAILABLE" } });
    expect(screen.getByTestId("refresh-error")).toHaveTextContent(
      new RegExp(`^Couldn't update the prices\\. The flight providers aren't answering right now\\. Try again in a moment\\. The prices below are from ${CLOCK}\\.$`),
    );
  });

  it("«Søk på nytt» med samme datoer gjør det samme: listen står", async () => {
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
    expect(spoken()).toEqual([]);
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
  async function openDetails(id: string, first: MobileSearchResult = SEARCH_RESULT) {
    const s = controlledServer(first);
    setParams({ id });
    await render(
      <AppProvider initialLocale="nb" apiFactory={s.factory} initial={{ destination: BCN, departDate: "2026-10-23", returnDate: "2026-10-30" }}>
        <Harness>
          <OfferScreen />
        </Harness>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("bar-provider")).toBeOnTheScreen());
    return s;
  }

  it("reisen som er åpen, står til det nye svaret er her", async () => {
    const s = await openDetails("nok_1");
    s.hold();
    await fireEvent.press(screen.getByTestId("test-same-search"));
    expect(screen.getByTestId("bar-provider")).toHaveTextContent("Kiwi.com ·");
    await s.answer({ data: SEARCH_RESULT });
    expect(screen.getByTestId("bar-provider")).toHaveTextContent("Kiwi.com ·");
  });

  it("får tilbudene nye ID-er, følges reisen på fly og tider – med den nye prisen, ikke «borte»", async () => {
    const s = await openDetails("nok_1");
    s.hold();
    await fireEvent.press(screen.getByTestId("test-same-search"));
    await s.answer({ data: withNewIds(UPDATED) });
    expect(screen.queryByText("Tilbudet er borte")).toBeNull();
    expect(screen.getByTestId("bar-provider")).toHaveTextContent("Kiwi.com ·");
    expect(screen.getByTestId("bar-price")).toHaveTextContent(/1\s990\skr/);
  });

  it("en selger kunden valgte, er fortsatt valgt etter oppdateringen", async () => {
    const both = { ...SEARCH_RESULT, offers: [SEK_OFFER, SAME_TRIP_OTHER_SELLER] };
    const s = await openDetails("gtg_1", both);
    // Gotogate er billigst; kunden velger SAS.
    await fireEvent.press(screen.getByTestId("seller-sek_1"));
    expect(screen.getByTestId("bar-provider")).toHaveTextContent("SAS ·");
    s.hold();
    await fireEvent.press(screen.getByTestId("test-same-search"));
    await s.answer({ data: withNewIds(both) });
    expect(screen.getByTestId("bar-provider")).toHaveTextContent("SAS ·");
  });
});
