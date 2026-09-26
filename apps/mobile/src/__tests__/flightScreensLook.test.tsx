import { useEffect, type ReactNode } from "react";
import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import * as SafeArea from "react-native-safe-area-context";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import type { MobileSearchResult } from "@contracts/mobileSearch";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { colors, radius, space, TOUCH } from "../lib/theme";
import { fakeServer } from "../test/fakeServer";
import { SEARCH_RESULT, SEK_OFFER } from "../test/fixtures";
import ResultsScreen from "../app/resultater";
import OfferScreen from "../app/tilbud/[id]";
import { pinClock } from "../test/clock";

// «Cloud + Graphite» i resultatene og flydetaljene: lys grunn, hvite kort, og grafittøyer bare der de er valgt med
// vilje – ruteoverskriften øverst i resultatene (med ruten, prisstatusen og fanene), den flytende verktøylinjen og
// bunnlinjen i detaljene. Statuslinjen følger det som står under den.

// Statuslinjen er en innstilling som ikke tegnes; her blir den et element som husker stilen den fikk.
jest.mock("expo-status-bar", () => {
  const { View } = jest.requireActual("react-native");
  return { StatusBar: (props: { style?: string }) => <View testID="status-bar" {...({ statusBarStyle: props.style } as object)} /> };
});

const setParams = (globalThis as unknown as { __setParams: (p: Record<string, string>) => void }).__setParams;
const BCN = { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spania" };
/** Statuslinjen på en iPhone med Dynamic Island. */
const TOP = 59;

const flat = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style);
const colorOf = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as StyleProp<TextStyle>)?.color;
const statusBarStyle = () => screen.getByTestId("status-bar").props.statusBarStyle as string;

function SearchOnMount({ children }: { children: ReactNode }) {
  const { runSearch } = useApp();
  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

function factoryFor(routes: Parameters<typeof fakeServer>[0]): ApiFactory {
  const server = fakeServer(routes);
  return (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
}

async function renderResults(result: MobileSearchResult = SEARCH_RESULT, factory: ApiFactory = factoryFor({ "flights.search": () => ({ data: result }) })) {
  await render(
    <AppProvider initialLocale="nb" apiFactory={factory} initial={{ destination: BCN, departDate: "2026-10-23", returnDate: "2026-10-30" }}>
      <SearchOnMount>
        <ResultsScreen />
      </SearchOnMount>
    </AppProvider>,
  );
}

async function showResults(result: MobileSearchResult = SEARCH_RESULT) {
  await renderResults(result);
  await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
}

async function showOffer(id: string, result: MobileSearchResult = SEARCH_RESULT) {
  setParams({ id });
  await render(
    <AppProvider initialLocale="nb" apiFactory={factoryFor({ "flights.search": () => ({ data: result }) })} initial={{ destination: BCN }}>
      <SearchOnMount>
        <OfferScreen />
      </SearchOnMount>
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("offer-screen")).toBeOnTheScreen());
}

/** Alle elementer under `root` (dybde først), også de som er skjult for VoiceOver. */
function descendants(root: { children: unknown[] }): { props: Record<string, unknown> }[] {
  const out: { props: Record<string, unknown>; children: unknown[] }[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { props: Record<string, unknown>; children: unknown[] };
    out.push(node);
    node.children.forEach(walk);
  };
  root.children.forEach(walk);
  return out;
}

beforeEach(() => {
  // Klokken står fast (bare Date), så de faste reisedatoene aldri har passert.
  pinClock();
  jest.spyOn(SafeArea, "useSafeAreaInsets").mockReturnValue({ top: TOP, bottom: 34, left: 0, right: 0 });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("Resultater: ruteoverskriften er en grafittøy, listen står på den lyse grunnen", () => {
  it("øya går helt opp under statuslinjen, med runde hjørner nederst; ruten, datoene, prisstatusen og fanene står inni", async () => {
    await showResults();
    const header = screen.getByTestId("results-header");
    expect(StyleSheet.flatten(header.props.style)).toMatchObject({ backgroundColor: colors.raised, borderBottomLeftRadius: radius.sheet, borderBottomRightRadius: radius.sheet, paddingTop: TOP + space.sm });
    expect(StyleSheet.flatten(header.props.style).marginHorizontal).toBeUndefined();
    const inside = within(header);
    expect(inside.getByRole("header")).toHaveTextContent("Oslo → Barcelona");
    expect(inside.getByTestId("header-route")).toHaveTextContent("Oslo → Barcelona");
    expect(inside.getByTestId("header-dates")).toHaveTextContent("23.–30. okt.");
    expect(inside.getByTestId("header-travellers")).toHaveTextContent("1 voksen · Økonomi");
    expect(inside.getByTestId("header-back")).toBeOnTheScreen();
    expect(inside.getByTestId("edit-search")).toBeOnTheScreen();
    expect(inside.getByTestId("price-status")).toHaveTextContent(/^Ekte priser · sjekket kl\. \d\d:\d\d$/);
    expect(inside.getByTestId("sort-tabs")).toBeOnTheScreen();
    // Under øya, ikke i den: brikkene, meldingene, antallet og kortene.
    for (const id of ["results-chips", "results-notices", "result-count", "offer-sek_1"]) expect(inside.queryByTestId(id)).toBeNull();
    // Lys tekst på øya, mørk på grunnen – aldri omvendt.
    expect(colorOf(inside.getByRole("header"))).toBe(colors.onDark);
    expect(colorOf(screen.getByTestId("result-count"))).toBe(colors.textSecondary);
    expect(colorOf(screen.getByTestId("sort-summary"))).toBe(colors.textSecondary);
  });

  it("fanene ligger i øya: `bg` med mørk kant, den valgte hvit", async () => {
    await showResults();
    expect(flat("sort-tab-best")).toMatchObject({ backgroundColor: colors.white });
    for (const key of ["price", "duration"]) expect(flat(`sort-tab-${key}`)).toMatchObject({ backgroundColor: colors.bg, borderColor: colors.darkBorder });
    await fireEvent.press(screen.getByTestId("sort-tab-price"));
    expect(flat("sort-tab-price")).toMatchObject({ backgroundColor: colors.white });
    expect(flat("sort-tab-best")).toMatchObject({ backgroundColor: colors.bg });
  });

  it("grunnen er lys bak brikkene og de hvite kortene; brikkene er lyse; verktøylinjen er fortsatt grafitt", async () => {
    await showResults();
    expect(flat("results-screen").backgroundColor).toBe(colors.canvas);
    expect(StyleSheet.flatten(screen.getByTestId("results-list").props.contentContainerStyle)).toMatchObject({ backgroundColor: colors.canvas, flexGrow: 1 });
    expect(flat("offer-sek_1").backgroundColor).toBe(colors.white);
    // «Alle» er valgt (blå); de andre er lyse brikker på grunnen.
    expect(flat("chip-all").backgroundColor).toBe(colors.blue);
    expect(flat("chip-max1")).toMatchObject({ backgroundColor: colors.inset, borderColor: colors.lightBorder });
    expect(colorOf(within(screen.getByTestId("chip-max1")).getByText("Maks 1 mellomlanding"))).toBe(colors.text);
    expect(flat("results-toolbar").backgroundColor).toBe(colors.raised);
  });

  it("meldingene står lyst på grunnen: én hvit flate, advarsler i advarselsfarge; «DEMO» står ved ruten; «Om …» er fortsatt en rad på 44 pt", async () => {
    await showResults({ ...SEARCH_RESULT, provider: "demo", sandbox: true });
    expect(flat("results-notices").backgroundColor).toBe(colors.white);
    const demo = screen.getByTestId("sandbox-banner");
    expect(colorOf(within(demo).getByText("Demo: testdata, ikke ekte fly eller priser."))).toBe(colors.warning);
    expect(within(screen.getByTestId("results-header")).getByLabelText("Demo: prisene er ikke ekte")).toBeOnTheScreen();
    const fx = screen.getByTestId("fx-notice");
    expect(StyleSheet.flatten(fx.props.style).minHeight).toBeGreaterThanOrEqual(TOUCH);
    expect(fx.props.hitSlop).toBeUndefined();
    expect(fx.props.accessibilityState).toMatchObject({ expanded: false });
    await fireEvent.press(fx);
    expect(screen.getByTestId("fx-notice").props.accessibilityState).toMatchObject({ expanded: true });
  });

  it("utdaterte priser: «Oppdater prisene» er en blå lenke på øya, selv 44 pt høy, med luft bare til sidene – den når ikke søkeknappen eller fanene", async () => {
    jest.useFakeTimers({ now: Date.parse("2026-09-23T10:00:00Z"), doNotFake: ["nextTick", "queueMicrotask", "setImmediate", "performance"] });
    await showResults();
    await act(async () => {
      jest.advanceTimersByTime(16 * 60_000);
    });
    const link = within(screen.getByTestId("results-header")).getByTestId("refresh-prices");
    expect(StyleSheet.flatten(link.props.style).minHeight).toBeGreaterThanOrEqual(TOUCH);
    expect(link.props.hitSlop).toEqual({ left: 10, right: 10 });
    expect(colorOf(within(link).getByText("Oppdater prisene"))).toBe(colors.blueOnDark);
  });
});

describe("Resultater: tilstandene under øya er lyse", () => {
  it("ingen reiser: lys tilstand, lyse datobrikker og en lys «Endre søk»", async () => {
    await showResults({ ...SEARCH_RESULT, offers: [] });
    const none = within(screen.getByTestId("results-none"));
    expect(colorOf(none.getByRole("header"))).toBe(colors.text);
    expect(flat("nearby--1")).toMatchObject({ backgroundColor: colors.inset });
    expect(colorOf(within(screen.getByTestId("nearby-dates")).getByText("Prøv datoene rundt"))).toBe(colors.text);
    expect(flat("edit-search-state")).toMatchObject({ backgroundColor: colors.white });
  });

  it("feil: meldingen er lys og «Endre søk» er lys; øya står fast øverst med lys tekst i statuslinjen", async () => {
    await renderResults(SEARCH_RESULT, factoryFor({ "flights.search": () => ({ status: 503, error: { message: "Leverandøren svarer ikke.", appCode: "SUPPLIER_UNAVAILABLE" } }) }));
    await waitFor(() => expect(screen.getByTestId("results-error")).toBeOnTheScreen());
    const message = within(screen.getByTestId("results-error")).getAllByText(/./)[0]!;
    expect(StyleSheet.flatten(message.parent!.props.style).backgroundColor).toBe(colors.dangerSoft);
    expect(flat("edit-search-state")).toMatchObject({ backgroundColor: colors.white });
    expect(flat("results-screen").backgroundColor).toBe(colors.canvas);
    expect(flat("results-header").backgroundColor).toBe(colors.raised);
    expect(statusBarStyle()).toBe("light");
    expect(screen.queryByTestId("status-bar-shield")).toBeNull();
  });

  it("lasting: statuslinjen og plassholderkortene er hvite, med grå flater som synes mot hvitt – og uten et eneste tall", async () => {
    const hanging: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: (() => new Promise(() => undefined)) as unknown as typeof fetch });
    await renderResults(SEARCH_RESULT, hanging);
    await waitFor(() => expect(screen.getByTestId("results-loading")).toBeOnTheScreen());
    const status = screen.getByRole("progressbar");
    expect(StyleSheet.flatten(status.props.style).backgroundColor).toBe(colors.white);
    const cards = screen.getByTestId("results-loading-cards", { includeHiddenElements: true });
    const fills = descendants(cards as unknown as { children: unknown[] }).map((n) => StyleSheet.flatten(n.props.style as StyleProp<ViewStyle>)?.backgroundColor);
    expect(fills.filter((c) => c === colors.white)).toHaveLength(3);
    expect(fills.filter((c) => c === colors.lightBorder).length).toBeGreaterThan(10);
    expect(fills).not.toContain(colors.inset);
    expect(within(cards).queryAllByText(/./, { includeHiddenElements: true })).toHaveLength(0);
    // «Stopp søket» står der verktøylinjen kommer, i grafitt som den.
    expect(flat("cancel-search").backgroundColor).toBe(colors.raised);
    expect(statusBarStyle()).toBe("light");
  });
});

describe("statuslinjen følger det som står under den", () => {
  const scrollTo = (y: number) =>
    fireEvent.scroll(screen.getByTestId("results-list"), {
      nativeEvent: { contentOffset: { x: 0, y }, contentSize: { width: 390, height: 2400 }, layoutMeasurement: { width: 390, height: 844 }, zoomScale: 1 },
      timeStamp: y + 1,
    });

  it("resultater: lys over øya; når øya har rullet ut under statuslinjen, mørk tekst og en lys skjerm – og tilbake igjen", async () => {
    await showResults();
    expect(statusBarStyle()).toBe("light");
    expect(screen.queryByTestId("status-bar-shield")).toBeNull();
    await fireEvent(screen.getByTestId("results-header"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 260 } } });
    // 260 − 59 = 201 pt kan rulles før øya er ute av statuslinjen.
    await scrollTo(150);
    expect(statusBarStyle()).toBe("light");
    await scrollTo(240);
    expect(statusBarStyle()).toBe("dark");
    expect(StyleSheet.flatten(screen.getByTestId("status-bar-shield").props.style)).toMatchObject({ height: TOP, backgroundColor: colors.canvas });
    await scrollTo(0);
    expect(statusBarStyle()).toBe("light");
    expect(screen.queryByTestId("status-bar-shield")).toBeNull();
  });

  it("flydetaljer: tittellinjen står på den lyse grunnen – mørk tekst i statuslinjen og en lys skjerm bak den", async () => {
    await showOffer("sek_1");
    expect(statusBarStyle()).toBe("dark");
    expect(StyleSheet.flatten(screen.getByTestId("status-bar-shield").props.style)).toMatchObject({ height: TOP, backgroundColor: colors.canvas });
  });
});

describe("Flydetaljer i «Cloud + Graphite»", () => {
  it("lys grunn og tittellinje med lyse knapper; kortene er hvite; bunnlinjen er en grafittøy med runde hjørner øverst og lys tekst", async () => {
    await showOffer("sek_1");
    expect(flat("offer-details").backgroundColor).toBe(colors.canvas);
    expect(flat("header-back")).toMatchObject({ backgroundColor: colors.white, borderColor: colors.lightBorder });
    expect(flat("share")).toMatchObject({ backgroundColor: colors.white, borderColor: colors.lightBorder });
    expect(colorOf(screen.getByRole("header", { name: "Flydetaljer" }))).toBe(colors.text);
    expect(flat("price-card").backgroundColor).toBe(colors.white);
    expect(screen.getByTestId("journey-summary")).toBeOnTheScreen();
    expect(flat("offer-bar")).toMatchObject({ backgroundColor: colors.raised, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet });
    expect(colorOf(screen.getByTestId("bar-amount"))).toBe(colors.onDark);
    expect(colorOf(screen.getByTestId("handoff-note"))).toBe(colors.onDarkMuted);
    expect(colorOf(screen.getByTestId("bar-provider"))).toBe(colors.onDark);
    expect(flat("handoff-button").backgroundColor).toBe(colors.blue);
  });

  it("meldinger og «Før du går videre» står lyst på grunnen: hvite flater, advarselsfarge og mørk tekst", async () => {
    const out = SEK_OFFER.offer.slices[0]!;
    const [a, b] = out.segments;
    // Bytte av flyplass i Paris (CDG → ORY) på utreisen.
    const warned = {
      ...SEK_OFFER,
      offer: {
        ...SEK_OFFER.offer,
        slices: [{ ...out, segments: [{ ...a!, destination: { ...a!.destination, iata: "CDG", city: "Paris" } }, { ...b!, origin: { ...b!.origin, iata: "ORY", city: "Paris" } }] }, SEK_OFFER.offer.slices[1]!],
      },
    };
    await showOffer("sek_1", { ...SEARCH_RESULT, provider: "demo", sandbox: true, priceBasis: { kind: "unverified", reason: "per_person" }, offers: [warned] } as MobileSearchResult);
    expect(flat("offer-notices").backgroundColor).toBe(colors.white);
    expect(colorOf(within(screen.getByTestId("demo-banner")).getByText(/^Demo/))).toBe(colors.warning);
    expect(screen.getByTestId("price-basis-notice")).toBeOnTheScreen();
    const box = within(screen.getByTestId("journey-warnings"));
    expect(flat("journey-warnings").backgroundColor).toBe(colors.white);
    expect(colorOf(box.getByText("Før du går videre"))).toBe(colors.warning);
    expect(colorOf(screen.getByTestId("warning-airportChange"))).toBe(colors.text);
  });

  it("uten søkeresultat: lys tilstand under en lys tittellinje", async () => {
    setParams({ id: "finnes-ikke" });
    await render(
      <AppProvider initialLocale="nb" apiFactory={factoryFor({})}>
        <OfferScreen />
      </AppProvider>,
    );
    expect(flat("offer-details").backgroundColor).toBe(colors.canvas);
    expect(flat("header-back")).toMatchObject({ backgroundColor: colors.white });
    expect(colorOf(screen.getByRole("header", { name: "Tilbudet er borte" }))).toBe(colors.text);
    expect(statusBarStyle()).toBe("dark");
  });
});
