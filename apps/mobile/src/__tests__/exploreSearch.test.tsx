import { PixelRatio, StyleSheet, Text } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { SEARCH_RESULT } from "../test/fixtures";
import { DESTINATIONS } from "../lib/destinations";
import { MAP_POINTS, areaRegion } from "../lib/destinationMap";
import { fitRegion } from "../lib/mapGeometry";
import ExploreScreen from "../app/(tabs)/utforsk";

// Søk i Utforsk: bare de 24 kuraterte reisemålene, i liste og kart likt.
// Ekte skjerm, ekte app-tilstand; kartet er Jest-oppsettets View-erstatning.

const router = (globalThis as unknown as { __router: { push: jest.Mock } }).__router;
const animateToRegion = (jest.requireMock("react-native-maps") as { __animateToRegion: jest.Mock }).__animateToRegion;
const SIZE = { width: 390, height: 470 };

function Probe() {
  const { form } = useApp();
  return <Text testID="probe">{`${form.origin?.iata ?? "-"}→${form.destination?.iata ?? "-"} ${form.departDate}/${form.returnDate} ${form.adults}`}</Text>;
}

async function renderExplore(locale: "nb" | "en" = "nb") {
  const server = fakeServer({ "mobileAuth.me": () => ({ data: null }), "flights.search": () => ({ data: SEARCH_RESULT }) });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  await render(
    <AppProvider initialLocale={locale} apiFactory={factory}>
      <ExploreScreen />
      <Probe />
    </AppProvider>,
  );
  return server;
}

const cards = () => screen.queryAllByTestId(/^explore-[a-z]+$/).map((n) => n.props.testID.slice(8) as string).filter((id) => !["screen", "summary", "error", "search", "count", "empty"].includes(id));
const type = (q: string) => fireEvent.changeText(screen.getByTestId("explore-search"), q);
const mapProps = () => (screen.getByTestId("destination-map").props as { mapProps: { initialRegion: unknown; onRegionChangeComplete: (r: unknown) => void } }).mapProps;
const shownAirports = () => [
  ...screen.queryAllByTestId(/^map-pin-(?!card|city|airport|search|close|save)/).map((n) => n.props.testID.slice(8) as string),
  ...screen.queryAllByTestId(/^map-group-/).flatMap((n) => (n.props.testID.slice(10) as string).split("+")),
];
async function openMap() {
  await fireEvent.press(screen.getByTestId("tab-map"));
  await fireEvent(screen.getByTestId("destination-map-frame"), "layout", { nativeEvent: { layout: { x: 0, y: 0, ...SIZE } } });
}

let fontScale: jest.SpyInstance;
beforeEach(() => {
  animateToRegion.mockClear();
  fontScale = jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(1);
});
afterEach(() => fontScale.mockRestore());

describe("søk i listen", () => {
  it("uten søk: alle 24, ingen teller; søkefeltet har etikett, hint og ingen priser", async () => {
    await renderExplore();
    expect(cards()).toHaveLength(24);
    expect(screen.queryByTestId("explore-count")).toBeNull();
    const input = screen.getByTestId("explore-search");
    expect(input).toHaveProp("accessibilityLabel", "Søk blant reisemålene");
    expect(input).toHaveProp("accessibilityHint", "Filtrerer listen og kartet. Bare HelloSkys reisemål; ingen priser.");
    expect(input).toHaveProp("placeholder", "By, land, flyplass eller kode");
    expect(screen.queryByTestId("explore-search-clear")).toBeNull();
    expect(input).toHaveProp("returnKeyType", "search");
    expect(input).toHaveProp("autoCorrect", false);
    // Tastaturet oppe: første trykk på et kort virker, et drag legger bort tastaturet, og listen slutter over tastaturet (iOS).
    const list = screen.getByTestId("explore-screen");
    expect(list).toHaveProp("keyboardShouldPersistTaps", "handled");
    expect(list).toHaveProp("keyboardDismissMode", "on-drag");
    expect(list).toHaveProp("automaticallyAdjustKeyboardInsets", true);
    // Stor tekst er ikke skrudd av i feltet.
    expect(input.props.allowFontScaling).not.toBe(false);
    expect(input.props.maxFontSizeMultiplier).toBeUndefined();
  });

  it("land på bokmål: to treff, teller for skjermleser, og kortene viser den nøyaktige flyplassen", async () => {
    await renderExplore();
    await type("spania");
    expect(cards()).toEqual(["barcelona", "malaga"]);
    expect(screen.getByTestId("explore-count")).toHaveTextContent("2 av 24 reisemål");
    expect(screen.getByTestId("explore-count")).toHaveProp("accessibilityLiveRegion", "polite");
    expect(screen.getByTestId("explore-airport-barcelona")).toHaveTextContent("Barcelona-El Prat (BCN)");
    expect(screen.getByTestId("explore-airport-malaga")).toHaveTextContent("Málaga-Costa del Sol (AGP)");
    expect(screen.queryByText(/\bkr\b|NOK/)).toBeNull();
  });

  it("nøyaktig IATA: «LHR» gir London Heathrow – og LGW (en annen London-flyplass) gir ingen treff, med en knapp for å tømme søket", async () => {
    await renderExplore();
    await type("LHR");
    expect(cards()).toEqual(["london"]);
    expect(screen.getByTestId("explore-airport-london")).toHaveTextContent("London Heathrow Airport (LHR)");
    await type("LGW");
    expect(cards()).toEqual([]);
    expect(screen.getByTestId("explore-empty")).toHaveTextContent(/^Ingen av våre 24 reisemål passer «LGW»\./);
    expect(screen.getByTestId("explore-empty")).toHaveTextContent(/Alle flyplasser kan velges under «Til» på Hjem\./);
    await fireEvent.press(screen.getByTestId("explore-empty-clear"));
    expect(screen.getByTestId("explore-search")).toHaveProp("value", "");
    expect(cards()).toHaveLength(24);
    expect(screen.queryByTestId("explore-empty")).toBeNull();
  });

  it("«Tøm søket» i feltet er en egen 44 pt-knapp", async () => {
    await renderExplore();
    await type("tromso");
    expect(cards()).toEqual(["tromso"]);
    const clear = screen.getByTestId("explore-search-clear");
    expect(clear).toHaveProp("accessibilityLabel", "Tøm søket");
    const s = StyleSheet.flatten(clear.props.style);
    expect(Math.min(s.width, s.height)).toBeGreaterThanOrEqual(44);
    await fireEvent.press(clear);
    expect(cards()).toHaveLength(24);
  });

  it("engelsk: engelske og norske navn virker begge; tekstene er på engelsk", async () => {
    await renderExplore("en");
    await type("Lisboa");
    expect(cards()).toEqual(["lisboa"]);
    await type("lisbon");
    expect(cards()).toEqual(["lisboa"]);
    expect(screen.getByTestId("explore-count")).toHaveTextContent("1 of 24 destinations");
    expect(screen.getByTestId("explore-airport-lisboa")).toHaveTextContent("Lisbon Humberto Delgado (LIS)");
    await type("xyz");
    expect(screen.getByTestId("explore-empty")).toHaveTextContent(/^None of our 24 destinations match “xyz”\./);
  });

  it("et treff søker fly til nøyaktig den flyplassen; å skrive i feltet endrer ikke søkeutkastet", async () => {
    const server = await renderExplore();
    const before = screen.getByTestId("probe").props.children as string;
    await type("heathrow");
    expect(screen.getByTestId("probe").props.children).toBe(before);
    await fireEvent.press(screen.getByTestId("explore-london"));
    expect(router.push).toHaveBeenCalledWith("/resultater");
    expect(screen.getByTestId("probe")).toHaveTextContent(/^OSL→LHR /);
    await waitFor(() => expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(1));
  });
});

describe("liste og kart viser de samme treffene", () => {
  it("søk i listen, bytt til kart: bare treffene som nåler, kartet åpner på dem, områdeknappene er borte", async () => {
    await renderExplore();
    await type("kurdistan");
    expect(cards().sort()).toEqual(["erbil", "sulaymaniyah"]);
    await openMap();
    expect(shownAirports().sort()).toEqual(["erbil", "sulaymaniyah"]);
    const points = MAP_POINTS.filter((p) => ["erbil", "sulaymaniyah"].includes(p.destination.id));
    expect(mapProps().initialRegion).toEqual(fitRegion(points, SIZE));
    expect(screen.queryByTestId("map-areas")).toBeNull();
    expect(screen.getByTestId("explore-count")).toHaveTextContent("2 av 24 reisemål");
    // Nytt søk på kartet: nålene og kartet følger.
    await type("dubai");
    expect(shownAirports()).toEqual(["dubai"]);
    expect(animateToRegion).toHaveBeenLastCalledWith(fitRegion(MAP_POINTS.filter((p) => p.destination.id === "dubai"), SIZE), 400);
    // Ingen treff på kartet: samme tomme tilstand som i listen, ikke et tomt kart.
    await type("zzz");
    expect(screen.queryByTestId("destination-map")).toBeNull();
    expect(screen.getByTestId("explore-empty")).toBeOnTheScreen();
    // Tilbake til listen: samme søk står.
    await fireEvent.press(screen.getByTestId("tab-list"));
    expect(screen.getByTestId("explore-search")).toHaveProp("value", "zzz");
    expect(screen.getByTestId("explore-empty")).toBeOnTheScreen();
  });

  it("det valgte reisemålet står bare så lenge det passer søket; tømt søk gir området tilbake", async () => {
    await renderExplore();
    await openMap();
    await fireEvent.press(screen.getByTestId("map-pin-barcelona"));
    expect(screen.getByTestId("map-pin-city")).toHaveTextContent(/^Barcelona/);
    await type("spa");
    expect(screen.getByTestId("map-pin-card")).toBeOnTheScreen(); // Barcelona passer «spa» (Spania)
    await type("spania");
    expect(screen.getByTestId("map-pin-card")).toBeOnTheScreen();
    await type("malaga");
    expect(screen.queryByTestId("map-pin-card")).toBeNull(); // Barcelona passer ikke lenger
    await type("spania");
    expect(screen.queryByTestId("map-pin-card")).toBeNull(); // og kommer ikke tilbake av seg selv
    await type("");
    expect(screen.getByTestId("map-areas")).toBeOnTheScreen();
    expect(screen.getByTestId("map-area-europe")).toBeSelected();
    expect(animateToRegion).toHaveBeenLastCalledWith(areaRegion("europe", SIZE), 450);
    await act(() => mapProps().onRegionChangeComplete(areaRegion("europe", SIZE)));
    expect(shownAirports().sort()).toEqual(DESTINATIONS.map((d) => d.id).sort());
  });
});
