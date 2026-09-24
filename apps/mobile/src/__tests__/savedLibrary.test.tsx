import { useEffect, type ReactNode } from "react";
import { StyleSheet, Text } from "react-native";
import * as SafeArea from "react-native-safe-area-context";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { __resetLocalStoreForTests, readPref, writePref } from "../lib/localStore";
import { fakeServer } from "../test/fakeServer";
import { SEARCH_RESULT } from "../test/fixtures";
import { initialForm } from "../lib/searchForm";
import { toIsoDate } from "../lib/format";
import { BottomNavigation } from "../components/BottomNavigation";
import ExploreScreen from "../app/(tabs)/utforsk";
import SavedScreen from "../app/(tabs)/lagret";
import HomeScreen from "../app/(tabs)/index";

// Lagret: reisemål og nylige søk, bare på denne telefonen. Ekte skjermer, ekte
// app-tilstand og ekte localStore (filen i Jest-oppsettets minne); «omstart»
// tømmer minnet så alt må leses fra filen igjen.

const router = (globalThis as unknown as { __router: { push: jest.Mock; navigate: jest.Mock } }).__router;
const OSL = { iata: "OSL", name: "Oslo lufthavn Gardermoen", city: "Oslo", country: "Norge" };
const BGO = { iata: "BGO", name: "Bergen lufthavn Flesland", city: "Bergen", country: "Norge" };
const BCN = { iata: "BCN", name: "Barcelona-El Prat", city: "Barcelona", country: "Spania" };
const LHR = { iata: "LHR", name: "London Heathrow", city: "London", country: "Storbritannia" };
const day = (offset: number) => toIsoDate(new Date(Date.now() + offset * 86_400_000));

function setup() {
  const server = fakeServer({ "flights.search": () => ({ data: SEARCH_RESULT }), "mobileAuth.me": () => ({ data: null }) });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  return { server, factory };
}

function Probe() {
  const { form } = useApp();
  return <Text testID="probe">{`${form.tripType} ${form.origin?.iata ?? "-"}→${form.destination?.iata ?? "-"} ${form.departDate}/${form.returnDate} a${form.adults} ${form.cabinClass}`}</Text>;
}

async function renderApp(children: ReactNode) {
  const s = setup();
  const r = await render(
    <AppProvider initialLocale="nb" apiFactory={s.factory}>
      {children}
      <Probe />
    </AppProvider>,
  );
  return { ...s, unmount: r.unmount };
}

beforeEach(() => {
  writePref("saved", null);
  writePref("recent", null);
  writePref("draft", null);
});

describe("lagre reisemål fra Utforsk", () => {
  it("lagre og fjerne: tydelig valgt-tilstand og etikett, bare id + nøyaktig IATA på telefonen", async () => {
    await renderApp(<ExploreScreen />);
    const save = screen.getByTestId("save-barcelona");
    expect(save).toHaveProp("accessibilityLabel", "Lagre Barcelona (BCN) på denne telefonen");
    expect(save).not.toBeSelected();
    await fireEvent.press(save);
    expect(screen.getByTestId("save-barcelona")).toBeSelected();
    expect(screen.getByTestId("save-barcelona")).toHaveProp("accessibilityLabel", "Lagret: Barcelona (BCN). Fjern fra Lagret");
    await fireEvent.press(screen.getByTestId("save-london"));
    expect(readPref("saved", (v) => v)).toEqual([{ id: "london", iata: "LHR" }, { id: "barcelona", iata: "BCN" }]);
    expect(JSON.stringify(readPref("saved", (v) => v))).not.toMatch(/price|kr|token|email|name/i);
    // Å lagre er ikke et søk og ikke en navigasjon.
    expect(router.push).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("save-barcelona"));
    expect(readPref("saved", (v) => v)).toEqual([{ id: "london", iata: "LHR" }]);
    // Kortet selv søker fortsatt som før (egen knapp, ikke inni lagreknappen).
    expect(screen.getByTestId("explore-barcelona")).toHaveProp("accessibilityRole", "button");
  });

  it("også fra kartets kort", async () => {
    await renderApp(<ExploreScreen />);
    await fireEvent.press(screen.getByTestId("tab-map"));
    await fireEvent(screen.getByTestId("destination-map-frame"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 470 } } });
    await fireEvent.press(screen.getByTestId("map-pin-barcelona"));
    await fireEvent.press(screen.getByTestId("map-pin-save"));
    expect(readPref("saved", (v) => v)).toEqual([{ id: "barcelona", iata: "BCN" }]);
    expect(screen.getByTestId("map-pin-save")).toBeSelected();
  });
});

describe("Lagret-fanen", () => {
  it("tom: forklarer at alt bare ligger på telefonen og ikke er bestillinger, priser, varsler eller synket", async () => {
    await renderApp(<SavedScreen />);
    // Én kort, sann setning øverst; hele forklaringen bak «Om Lagret».
    expect(screen.getByTestId("saved-note")).toHaveTextContent("Bare på denne telefonen – ikke bestillinger eller priser.");
    expect(screen.queryByTestId("saved-note-detail")).toBeNull();
    const info = screen.getByTestId("saved-info");
    expect(info).toHaveProp("accessibilityLabel", "Om Lagret");
    expect(info).toHaveProp("accessibilityState", { expanded: false });
    await fireEvent.press(info);
    expect(screen.getByTestId("saved-info")).toHaveProp("accessibilityState", { expanded: true });
    expect(screen.getByTestId("saved-note-detail")).toHaveTextContent(/bare på denne telefonen.*ikke bestillinger, holdte priser eller prisvarsler.*synkroniseres ikke med kontoen/);
    await fireEvent.press(screen.getByTestId("saved-info"));
    expect(screen.queryByTestId("saved-note-detail")).toBeNull();
    expect(screen.getByTestId("saved-destinations-empty")).toHaveTextContent(/^Ingen lagrede reisemål ennå. Lagre et fra Utforsk./);
    await fireEvent.press(screen.getByTestId("saved-to-explore"));
    expect(router.navigate).toHaveBeenCalledWith("/utforsk");
    expect(screen.getByTestId("recent-empty")).toBeOnTheScreen();
    expect(screen.queryByText(/\bkr\b|NOK/)).toBeNull();
  });

  it("lagret reisemål overlever en omstart, vises med nøyaktig flyplass, og «Bruk i søket» fyller bare inn søket", async () => {
    const first = await renderApp(<ExploreScreen />);
    await fireEvent.press(screen.getByTestId("save-tromso"));
    await fireEvent.press(screen.getByTestId("save-london"));
    await first.unmount();
    __resetLocalStoreForTests(); // som en ekte omstart

    const { server } = await renderApp(<SavedScreen />);
    const list = within(screen.getByTestId("saved-destinations"));
    expect(list.getByTestId("saved-london")).toBeOnTheScreen();
    expect(screen.getByTestId("saved-airport-london")).toHaveTextContent("London Heathrow Airport (LHR)");
    expect(screen.getByTestId("saved-airport-tromso")).toHaveTextContent("Tromsø lufthavn (TOS)");
    const before = screen.getByTestId("probe").props.children as string;

    await fireEvent.press(screen.getByTestId("saved-use-london"));
    expect(screen.getByTestId("probe").props.children).toBe(before.replace(/→\S+/, "→LHR"));
    expect(router.navigate).toHaveBeenCalledWith("/");
    expect(router.push).not.toHaveBeenCalledWith("/resultater");
    expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(0);
    expect(screen.getByTestId("saved-use-london")).toHaveProp("accessibilityHint", "Fyller inn reisemålet på Hjem. Søker ikke.");

    await fireEvent.press(screen.getByTestId("saved-remove-tromso"));
    expect(screen.queryByTestId("saved-tromso")).toBeNull();
    expect(readPref("saved", (v) => v)).toEqual([{ id: "london", iata: "LHR" }]);
  });

  it("et kjørt søk vises i Lagret (ikke på Hjem), overlever omstart, og «Søk igjen» søker nøyaktig samme reise", async () => {
    function SearchNow({ children }: { children: ReactNode }) {
      const { runSearch } = useApp();
      useEffect(() => {
        runSearch({ destination: BCN, departDate: day(20), returnDate: day(27) });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <>{children}</>;
    }
    const first = await renderApp(
      <SearchNow>
        <HomeScreen />
      </SearchNow>,
    );
    expect(screen.queryByTestId("recent-searches")).toBeNull(); // ikke på Hjem lenger
    const stored = JSON.stringify(readPref("recent", (v) => v));
    expect(stored).toContain('"BCN"');
    expect(stored).not.toMatch(/token|email|price|offer|firstName/i);
    await first.unmount();
    __resetLocalStoreForTests();

    const { server } = await renderApp(<SavedScreen />);
    const id = `OSL-BCN-${day(20)}`;
    expect(screen.getByTestId(`recent-${id}`)).toHaveTextContent(/Oslo → Barcelona/);
    expect(screen.getByTestId(`recent-${id}`)).toHaveTextContent(/OSL\u2011BCN · /);
    expect(screen.queryByTestId(`recent-past-${id}`)).toBeNull();
    await fireEvent.press(screen.getByTestId(`recent-again-${id}`));
    expect(router.push).toHaveBeenCalledWith("/resultater");
    await waitFor(() => expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(1));
    const input = server.calls.find((c) => c.path === "flights.search")!.input as { slices: { origin: string; destination: string; departureDate: string }[] };
    expect(input.slices[0]).toMatchObject({ origin: "OSL", destination: "BCN" });
    expect(JSON.stringify(input)).toContain(day(20));
  });

  it("passerte datoer: sies rett ut; ingen «Søk igjen»; «Velg nye datoer» gir ruten med nye datoer på Hjem – uten å søke", async () => {
    writePref("recent", [
      { ...initialForm(), origin: OSL, destination: BCN, departDate: day(-10), returnDate: day(-3), adults: 2, cabinClass: "business" },
      { ...initialForm(), origin: BGO, destination: LHR, departDate: day(30), returnDate: day(37) },
    ]);
    __resetLocalStoreForTests();
    const { server } = await renderApp(<SavedScreen />);
    const past = `OSL-BCN-${day(-10)}`;
    expect(screen.getByTestId(`recent-past-${past}`)).toHaveTextContent("Datoene har passert");
    expect(screen.queryByTestId(`recent-again-${past}`)).toBeNull();
    // Datoene som står, er de ekte (ikke flyttet i det stille).
    expect(readPref("recent", (v) => v)).toEqual(expect.arrayContaining([expect.objectContaining({ departDate: day(-10) })]));
    expect(screen.getByTestId(`recent-again-BGO-LHR-${day(30)}`)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(`recent-newdates-${past}`));
    const fresh = initialForm();
    expect(screen.getByTestId("probe")).toHaveTextContent(`roundtrip OSL→BCN ${fresh.departDate}/${fresh.returnDate} a2 business`);
    expect(router.navigate).toHaveBeenCalledWith("/");
    expect(router.push).not.toHaveBeenCalledWith("/resultater");
    expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(0);
  });

  it("fjerne ett nylig søk, eller alle", async () => {
    writePref("recent", [
      { ...initialForm(), origin: OSL, destination: BCN, departDate: day(10), returnDate: day(17) },
      { ...initialForm(), origin: BGO, destination: LHR, departDate: day(30), returnDate: day(37) },
    ]);
    __resetLocalStoreForTests();
    await renderApp(<SavedScreen />);
    await fireEvent.press(screen.getByTestId(`recent-remove-OSL-BCN-${day(10)}`));
    expect(screen.queryByTestId(`recent-OSL-BCN-${day(10)}`)).toBeNull();
    expect(screen.getByTestId(`recent-BGO-LHR-${day(30)}`)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("recent-clear"));
    expect(screen.getByTestId("recent-empty")).toBeOnTheScreen();
    expect(readPref("recent", (v) => v)).toBeNull();
  });

  it("radene: hele raden er én knapp med full etikett; «Fjern» er en egen 44 pt-knapp ved siden av – ingen knapp inni en knapp", async () => {
    writePref("saved", [{ id: "london", iata: "LHR" }]);
    writePref("recent", [
      { ...initialForm(), origin: OSL, destination: BCN, departDate: day(-10), returnDate: day(-3) },
      { ...initialForm(), origin: BGO, destination: LHR, departDate: day(30), returnDate: day(37) },
    ]);
    __resetLocalStoreForTests();
    await renderApp(<SavedScreen />);

    const use = screen.getByTestId("saved-use-london");
    expect(use).toHaveProp("accessibilityRole", "button");
    expect(use).toHaveProp("accessibilityLabel", "Bruk London, London Heathrow Airport (LHR) som reisemål");
    expect(within(use).getByText("Bruk i søket")).toBeOnTheScreen();
    expect(within(use).queryAllByRole("button")).toHaveLength(0);
    // «Fjern» ligger ved siden av radens knapp, ikke inni den.
    expect(within(use).queryByTestId("saved-remove-london")).toBeNull();
    expect(within(screen.getByTestId("saved-london")).getByTestId("saved-remove-london")).toHaveProp("accessibilityLabel", "Fjern London (LHR)");

    const past = `OSL-BCN-${day(-10)}`;
    const newDates = screen.getByTestId(`recent-newdates-${past}`);
    expect(newDates).toHaveProp("accessibilityLabel", expect.stringMatching(/^Velg nye datoer for Oslo → Barcelona\. Datoene har passert: \S+\u00A0\d+\.\u00A0\S+ – \S+\u00A0\d+\.\u00A0\S+$/));
    expect(newDates).toHaveProp("accessibilityHint", "Fyller inn ruten på Hjem med nye datoer. Søker ikke.");
    expect(within(newDates).getByTestId(`recent-past-${past}`)).toHaveTextContent("Datoene har passert");
    expect(within(newDates).queryAllByRole("button")).toHaveLength(0);
    const again = screen.getByTestId(`recent-again-BGO-LHR-${day(30)}`);
    expect(again).toHaveProp("accessibilityLabel", expect.stringMatching(/^Søk igjen: Bergen → London, .+ · 1 voksen · Økonomi$/));
    expect(within(again).queryAllByRole("button")).toHaveLength(0);

    // Seksjonsoverskriftene er overskrifter med antall.
    expect(screen.getByTestId("saved-destinations-title")).toHaveProp("accessibilityLabel", "Reisemål, 1");
    expect(screen.getByTestId("recent-title")).toHaveProp("accessibilityLabel", "Nylige søk, 2");
    expect(screen.getByTestId("recent-title")).toHaveProp("accessibilityRole", "header");
  });

  it("handlingene er ekte 44 pt-knapper", async () => {
    writePref("saved", [{ id: "barcelona", iata: "BCN" }]);
    writePref("recent", [{ ...initialForm(), origin: OSL, destination: BCN, departDate: day(10), returnDate: day(17) }]);
    __resetLocalStoreForTests();
    await renderApp(<SavedScreen />);
    for (const id of ["saved-remove-barcelona", `recent-remove-OSL-BCN-${day(10)}`]) {
      const s = StyleSheet.flatten(screen.getByTestId(id).props.style);
      expect(Math.min(s.width, s.height)).toBeGreaterThanOrEqual(44);
    }
    for (const id of ["saved-use-barcelona", `recent-again-OSL-BCN-${day(10)}`]) {
      expect(StyleSheet.flatten(screen.getByTestId(id).props.style).minHeight).toBeGreaterThanOrEqual(44);
    }
    const info = StyleSheet.flatten(screen.getByTestId("saved-info").props.style);
    expect(Math.min(info.width, info.height)).toBeGreaterThanOrEqual(44);
    // Ingen tekst i Lagret har skrudd av Dynamic Type.
    for (const t of screen.getAllByText(/.+/)) expect(t.props.allowFontScaling).not.toBe(false);
  });
});

describe("fire faner", () => {
  const routes = ["index", "utforsk", "lagret", "profil"].map((name) => ({ key: `${name}-key`, name }));
  function renderBar(index: number, insets = { top: 47, bottom: 34, left: 0, right: 0 }) {
    jest.spyOn(SafeArea, "useSafeAreaInsets").mockReturnValue(insets);
    const navigation = { navigate: jest.fn(), emit: jest.fn(() => ({ defaultPrevented: false })) };
    return { navigation, r: render(
      <AppProvider initialLocale="nb" apiFactory={setup().factory}>
        <BottomNavigation state={{ index, routes }} navigation={navigation} />
      </AppProvider>,
    ) };
  }
  afterEach(() => jest.restoreAllMocks());

  it("Hjem, Utforsk, Lagret, Profil – én valgt (for skjermleser og med pille), og et trykk bytter fane", async () => {
    const { navigation } = renderBar(2);
    await waitFor(() => expect(screen.getByTestId("tab-lagret")).toBeOnTheScreen());
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.props.accessibilityLabel)).toEqual(["Hjem", "Utforsk", "Lagret", "Profil"]);
    expect(tabs.map((t) => !!t.props.accessibilityState?.selected)).toEqual([false, false, true, false]);
    expect(screen.getByTestId("tab-lagret-selected")).toBeOnTheScreen();
    expect(screen.queryByTestId("tab-index-selected")).toBeNull();
    await fireEvent.press(screen.getByTestId("tab-utforsk"));
    expect(navigation.navigate).toHaveBeenCalledWith("utforsk");
    // Trykk på valgt fane: ingen ny navigasjon.
    await fireEvent.press(screen.getByTestId("tab-lagret"));
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
  });

  it("44 pt, etiketter på én linje med stor tekst opptil 1,3×, og linjen står over hjemindikatoren (safe area)", async () => {
    renderBar(0);
    await waitFor(() => expect(screen.getByTestId("tab-index")).toBeOnTheScreen());
    for (const t of screen.getAllByRole("tab")) {
      expect(StyleSheet.flatten(t.props.style).minHeight).toBeGreaterThanOrEqual(44);
      const label = within(t).getByText(/.+/);
      expect(label.props.numberOfLines).toBe(1);
      expect(label.props.maxFontSizeMultiplier).toBeLessThanOrEqual(1.3);
      expect(label.props.maxFontSizeMultiplier).toBeGreaterThan(1);
    }
    const bar = screen.getByTestId("bottom-navigation");
    expect(StyleSheet.flatten(bar.props.style).paddingBottom).toBe(34);
  });

  it("engelsk: Saved", async () => {
    jest.spyOn(SafeArea, "useSafeAreaInsets").mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 });
    await render(
      <AppProvider initialLocale="en" apiFactory={setup().factory}>
        <BottomNavigation state={{ index: 0, routes }} navigation={{ navigate: jest.fn(), emit: jest.fn(() => ({ defaultPrevented: false })) }} />
      </AppProvider>,
    );
    expect(screen.getAllByRole("tab").map((t) => t.props.accessibilityLabel)).toEqual(["Home", "Explore", "Saved", "Profile"]);
    // Uten safe area: likevel luft under etikettene.
    expect(StyleSheet.flatten(screen.getByTestId("bottom-navigation").props.style).paddingBottom).toBeGreaterThanOrEqual(8);
  });
});
