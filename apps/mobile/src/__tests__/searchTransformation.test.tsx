import { useEffect, type ReactNode } from "react";
import { AccessibilityInfo, Animated, LayoutAnimation, NativeModules, Pressable as RNPressable, StyleSheet, Text as RNText, type LayoutAnimationConfig } from "react-native";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import type { MobileSearchResult } from "@contracts/mobileSearch";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { __setReducedMotionForTests } from "../lib/motion";
import { i18nFor } from "../i18n";
import { colors, TOUCH } from "../lib/theme";
import { fakeServer } from "../test/fakeServer";
import { SEARCH_RESULT } from "../test/fixtures";
import { pinClock } from "../test/clock";
import ResultsScreen from "../app/resultater";

// Søket i toppen av resultatene: kompakt (ruten og to brikker) eller åpent som hele søkeskjemaet fra forsiden – i den
// samme grafittøya. Et søk derfra kjøres her (ingen ny resultatside), brikkene søker på nytt med én gang, og
// bevegelsen er kort og myk – eller borte med «Reduser bevegelse». Overskriften beskriver alltid søket som vises.

const router = (globalThis as unknown as { __router: { push: jest.Mock; navigate: jest.Mock; back: jest.Mock } }).__router;
const BCN = { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spania" };
const LHR = { iata: "LHR", name: "London Heathrow", city: "London", country: "Storbritannia" };
const BGO = { iata: "BGO", name: "Bergen lufthavn Flesland", city: "Bergen", country: "Norge" };
/** Tekster fra ordbøker denne pakken ikke eier (forsiden, felles, kalender): regnet ut, ikke skrevet av. */
const nb = i18nFor("nb").t;

type SearchInput = { slices: { origin: string; destination: string; departureDate: string }[]; passengers: { type: string }[] };

/** Første søk svarer med en gang; `hold()` gjør at neste søk venter til testen svarer med `answer()`. */
function controlledServer(first: MobileSearchResult = SEARCH_RESULT) {
  const held: ((r: { data: MobileSearchResult }) => void)[] = [];
  let holdNext = false;
  const server = fakeServer({
    "flights.search": (() => {
      if (!holdNext) return { data: first };
      holdNext = false;
      return new Promise((resolve) => held.push(resolve));
    }) as never,
  });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  return {
    factory,
    hold: () => {
      holdNext = true;
    },
    answer: async (data: MobileSearchResult = SEARCH_RESULT) => {
      await waitFor(() => expect(held.length).toBe(1));
      await act(async () => held.shift()!({ data }));
    },
    searches: () => server.calls.filter((c) => c.path === "flights.search").map((c) => c.input as SearchInput),
  };
}

/** Søker ved start, viser skjemaet, og har knapper som endrer skjemaet slik andre deler av appen gjør (uten å søke). */
function Harness({ children }: { children: ReactNode }) {
  const { runSearch, setForm, form } = useApp();
  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      {children}
      <RNText testID="probe">{`${form.tripType} ${form.origin?.iata ?? "-"}→${form.destination?.iata ?? "-"} ${form.departDate}/${form.returnDate} a${form.adults}`}</RNText>
      <RNPressable testID="test-edit-form" onPress={() => setForm((f) => ({ ...f, destination: LHR, departDate: "2026-11-02", returnDate: "2026-11-09", adults: 3 }))} />
      <RNPressable testID="test-same-airport" onPress={() => setForm((f) => ({ ...f, destination: f.origin }))} />
      {/* Som flyplassøket: velger «Fra» og går tilbake hit. */}
      <RNPressable testID="test-picked-bgo" onPress={() => setForm((f) => ({ ...f, origin: BGO }))} />
    </>
  );
}

async function renderResults({ initial = {}, server = controlledServer() }: { initial?: Record<string, unknown>; server?: ReturnType<typeof controlledServer> } = {}) {
  await render(
    <AppProvider initialLocale="nb" apiFactory={server.factory} initial={{ destination: BCN, departDate: "2026-10-23", returnDate: "2026-10-30", ...initial }}>
      <Harness>
        <ResultsScreen />
      </Harness>
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
  return server;
}

const flat = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style) ?? {};
const probe = () => screen.getByTestId("probe");
const header = () => within(screen.getByTestId("results-header"));
const editor = () => within(screen.getByTestId("results-header-editor"));
/** Verdiens forskyvning i en rad i rutefeltet (0 = på plass). */
const shift = (testID: string) => ((flat(testID).transform as { translateY: number }[] | undefined)?.[0]?.translateY ?? 0) as number;
/**
 * «Reduser bevegelse» på. Forhåndsoppsettets egen mock (ikke en spion): verdien settes direkte, og settes tilbake i
 * beforeEach – restoreAllMocks rører den ikke.
 */
function reduceMotionOn() {
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
}
/** Alle som spurte om «Reduser bevegelse», har fått svaret. */
async function motionSettingRead() {
  await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());
  await act(() => new Promise<void>((r) => setTimeout(r, 0)));
}

beforeEach(() => {
  // Klokken står fast (bare Date), så de faste reisedatoene aldri har passert.
  pinClock();
  // Hver test starter med bevegelse på og uten svar fra iOS ennå, uansett rekkefølge.
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockClear().mockResolvedValue(false);
  __setReducedMotionForTests(null);
  (AccessibilityInfo.sendAccessibilityEvent as jest.Mock).mockClear();
  (AccessibilityInfo.announceForAccessibility as jest.Mock).mockClear();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("søket i toppen, kompakt", () => {
  it("ruten er skjermens overskrift og en knapp som endrer søket; datoer og reisende er lyse brikker på grafitt, hver minst 44 pt, med hele teksten for VoiceOver", async () => {
    await renderResults();
    expect(header().getByRole("header")).toHaveTextContent("Oslo → Barcelona");
    const route = screen.getByTestId("header-route");
    expect(route).toHaveProp("accessibilityRole", "button");
    expect(route).toHaveProp("accessibilityLabel", "Endre søk: Oslo til Barcelona");
    expect(route).toHaveProp("accessibilityHint", "Åpner søket her, så du kan endre det");
    expect(within(route).getByRole("header")).toHaveTextContent("Oslo → Barcelona");

    const dates = header().getByTestId("header-dates");
    expect(dates).toHaveTextContent("23.–30. okt.");
    expect(dates).toHaveProp("accessibilityRole", "button");
    expect(dates).toHaveProp("accessibilityLabel", nb.calendar.summarySpoken("fredag 23. oktober 2026", "fredag 30. oktober 2026", nb.calendar.nights(7)));
    expect(dates).toHaveProp("accessibilityHint", "Velg nye datoer og søk på nytt");

    const travellers = header().getByTestId("header-travellers");
    expect(travellers).toHaveTextContent("1 voksen · Økonomi");
    expect(travellers).toHaveProp("accessibilityRole", "button");
    expect(travellers).toHaveProp("accessibilityLabel", "Reisende og reiseklasse: 1 voksen, Økonomi");
    expect(travellers).toHaveProp("accessibilityHint", "Velg reisende og reiseklasse og søk på nytt");

    for (const id of ["header-route", "header-dates", "header-travellers"]) {
      expect([id, (flat(id).minHeight as number) >= TOUCH]).toEqual([id, true]);
      expect([id, screen.getByTestId(id).props.accessibilityLanguage]).toEqual([id, "nb-NO"]);
      // Stor tekst: brytes, kuttes aldri.
      for (const text of within(screen.getByTestId(id)).queryAllByText(/.+/)) expect(text.props.numberOfLines ?? 0).not.toBe(1);
    }
    // «Cloud + Graphite»: brikkene er `bg` med mørk kant i øya, med lys tekst.
    expect(flat("header-dates")).toMatchObject({ backgroundColor: colors.bg, borderColor: colors.darkBorder });
    expect(StyleSheet.flatten(within(travellers).getByText(/voksen/).props.style).color).toBe(colors.onDark);
  });

  it("én vei, flere reisende, annen klasse og bare direktefly: brikkene sier alt det, og VoiceOver hører hele datoen", async () => {
    await renderResults({ initial: { tripType: "oneway", adults: 2, childAges: [5], cabinClass: "business", directOnly: true } });
    const dates = screen.getByTestId("header-dates");
    expect(dates).toHaveTextContent("Én vei · 23. okt.");
    expect(dates).toHaveProp("accessibilityLabel", `${nb.calendar.summarySpoken("fredag 23. oktober 2026", null, null)}, én vei`);
    const travellers = screen.getByTestId("header-travellers");
    expect(travellers).toHaveTextContent("2 voksne, 1 barn · Business · Direkte");
    expect(travellers).toHaveProp("accessibilityLabel", "Reisende og reiseklasse: 2 voksne, 1 barn, Business, bare direktefly");
    // Tallet og ordet står sammen: «2 voksne» brytes aldri mellom «2» og «voksne».
    expect(String(within(travellers).getByText(/voksne/).props.children)).toContain("2 voksne");
  });

  it("overskriften beskriver søket som vises – også når skjemaet er endret uten å søke", async () => {
    await renderResults();
    await fireEvent.press(screen.getByTestId("test-edit-form"));
    expect(probe()).toHaveTextContent(/→LHR 2026-11-02\/2026-11-09 a3$/);
    expect(header().getByRole("header")).toHaveTextContent("Oslo → Barcelona");
    expect(screen.getByTestId("header-route")).toHaveProp("accessibilityLabel", "Endre søk: Oslo til Barcelona");
    expect(screen.getByTestId("header-dates")).toHaveTextContent("23.–30. okt.");
    expect(screen.getByTestId("header-travellers")).toHaveTextContent("1 voksen · Økonomi");
  });
});

describe("søket åpnes i øya", () => {
  it("et trykk på ruten gjør øya til hele søkeskjemaet, med «Lukk» øverst til høyre; VoiceOver går til skjemaets overskrift", async () => {
    await renderResults();
    await fireEvent.press(screen.getByTestId("header-route"));
    const open = editor();
    expect(within(screen.getByTestId("results-header")).getByTestId("results-header-editor")).toBeOnTheScreen();
    for (const id of ["segment-roundtrip", "origin", "destination", "swap", "depart-date", "return-date", "travellers", "cabin", "search-button"]) expect(open.getByTestId(id)).toBeOnTheScreen();
    expect(open.getByRole("header")).toHaveTextContent("Endre søk");
    const close = open.getByTestId("header-editor-close");
    expect(close).toHaveProp("accessibilityRole", "button");
    expect(close).toHaveProp("accessibilityLabel", "Lukk");
    expect(close).toHaveProp("accessibilityHint", "Lukker skjemaet uten å søke");
    expect(flat("header-editor-close").minHeight).toBeGreaterThanOrEqual(TOUCH);
    expect(flat("header-editor-close").minWidth).toBeGreaterThanOrEqual(TOUCH);
    expect(StyleSheet.flatten(within(close).getByText("Lukk").props.style).color).toBe(colors.blueOnDark);
    // Bare det ene hovedvalget er helblått.
    expect(flat("search-button").backgroundColor).toBe(colors.blue);
    // Det kompakte (ruten, brikkene), prisstatusen, fanene og verktøylinjen er borte mens skjemaet står åpent.
    for (const id of ["header-route", "header-dates", "header-travellers", "price-status", "sort-tabs", "results-toolbar"]) expect(screen.queryByTestId(id)).toBeNull();
    // Listen står under øya.
    expect(screen.getByTestId("results-list")).toBeOnTheScreen();
    // Hver knapp i skjemaet leses med norsk stemme.
    for (const button of open.getAllByRole("button")) expect(button.props.accessibilityLanguage).toBe("nb-NO");
    expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenCalledTimes(1);
    expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenLastCalledWith(expect.anything(), "focus");
    expect(router.push).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("«Endre søk» ved siden av ruten åpner det samme", async () => {
    await renderResults();
    expect(screen.getByTestId("edit-search")).toHaveProp("accessibilityLabel", "Endre søk");
    await fireEvent.press(screen.getByTestId("edit-search"));
    expect(editor().getByTestId("search-button")).toBeOnTheScreen();
  });

  it("«Søk fly» i øya søker på nytt her – ingen ny resultatside – og øya krymper til ruten og brikkene, som viser det nye søket mens det lastes", async () => {
    const s = await renderResults();
    await fireEvent.press(screen.getByTestId("header-route"));
    await fireEvent.press(editor().getByTestId("swap"));
    s.hold();
    await fireEvent.press(editor().getByTestId("search-button"));
    expect(s.searches()).toHaveLength(2);
    expect(s.searches()[1]!.slices.map((x) => `${x.origin}-${x.destination} ${x.departureDate}`)).toEqual(["BCN-OSL 2026-10-23", "OSL-BCN 2026-10-30"]);
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByTestId("results-header-editor")).toBeNull();
    expect(header().getByRole("header")).toHaveTextContent("Barcelona → Oslo");
    expect(screen.getByTestId("header-route")).toHaveProp("accessibilityLabel", "Endre søk: Barcelona til Oslo");
    expect(screen.getByTestId("results-loading")).toBeOnTheScreen();
    // VoiceOver: til skjemaet da det åpnet, tilbake til ruten da det lukket.
    expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenCalledTimes(2);
    await s.answer();
    expect(screen.getByTestId("results-list")).toBeOnTheScreen();
    expect(header().getByRole("header")).toHaveTextContent("Barcelona → Oslo");
  });

  it("en feil i skjemaet står i øya, som på forsiden; øya står åpen, og ingenting søkes", async () => {
    const s = await renderResults();
    await fireEvent.press(screen.getByTestId("header-route"));
    await fireEvent.press(screen.getByTestId("test-same-airport"));
    await fireEvent.press(editor().getByTestId("search-button"));
    expect(editor().getByTestId("form-error")).toHaveTextContent("Avreise og reisemål kan ikke være samme flyplass.");
    expect(s.searches()).toHaveLength(1);
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByTestId("results-list")).toBeOnTheScreen();
  });

  it("«Lukk» lukker uten å søke: listen står, overskriften viser søket som vises, og skjemaet er igjen det søket", async () => {
    const s = await renderResults();
    await fireEvent.press(screen.getByTestId("header-route"));
    await fireEvent.press(editor().getByTestId("swap"));
    expect(probe()).toHaveTextContent(/^roundtrip BCN→OSL /);
    await fireEvent.press(screen.getByTestId("header-editor-close"));
    expect(screen.queryByTestId("results-header-editor")).toBeNull();
    expect(header().getByRole("header")).toHaveTextContent("Oslo → Barcelona");
    expect(probe()).toHaveTextContent("roundtrip OSL→BCN 2026-10-23/2026-10-30 a1");
    expect(s.searches()).toHaveLength(1);
    expect(screen.getByTestId("offer-sek_1")).toBeOnTheScreen();
    expect(screen.getByTestId("results-toolbar")).toBeOnTheScreen();
    expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenCalledTimes(2);
  });

  it("VoiceOvers «tilbake»-gest (to fingre, Z) lukker skjemaet som «Lukk»", async () => {
    await renderResults();
    await fireEvent.press(screen.getByTestId("edit-search"));
    await act(async () => (screen.getByTestId("results-header-editor").props.onAccessibilityEscape as () => void)());
    expect(screen.queryByTestId("results-header-editor")).toBeNull();
    expect(screen.getByTestId("header-route")).toBeOnTheScreen();
  });

  it("flyplassradene åpner flyplassøket mens øya står åpen; valget kommer tilbake i skjemaet og søkes med «Søk fly»", async () => {
    const s = await renderResults();
    await fireEvent.press(screen.getByTestId("header-route"));
    await fireEvent.press(editor().getByTestId("origin"));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: "/flyplass", params: { felt: "fra" } });
    await fireEvent.press(editor().getByTestId("destination"));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: "/flyplass", params: { felt: "til" } });
    // Flyplassøket (et eget ark) setter «Fra» og går tilbake: øya står fortsatt åpen, med det nye valget.
    await fireEvent.press(screen.getByTestId("test-picked-bgo"));
    expect(editor().getByTestId("origin")).toHaveTextContent("Bergen (BGO)");
    s.hold();
    await fireEvent.press(editor().getByTestId("search-button"));
    expect(s.searches()[1]!.slices[0]).toMatchObject({ origin: "BGO", destination: "BCN" });
    expect(router.push).not.toHaveBeenCalledWith("/resultater");
    await s.answer();
  });

  it("skjemaet i øya starter fra søket som vises, ikke fra et skjema som er endret uten å søke", async () => {
    await renderResults();
    await fireEvent.press(screen.getByTestId("test-edit-form"));
    await fireEvent.press(screen.getByTestId("header-route"));
    expect(editor().getByTestId("destination")).toHaveTextContent("Barcelona (BCN)");
    expect(editor().getByTestId("depart-date")).toHaveTextContent("fre. 23. okt.");
    expect(probe()).toHaveTextContent("roundtrip OSL→BCN 2026-10-23/2026-10-30 a1");
  });
});

describe("brikkene endrer søket med én gang", () => {
  it("datoene: brikken åpner kalenderen, og «Søk på nytt» søker med de nye datoene – resultatene laster det nye søket", async () => {
    const s = await renderResults();
    await fireEvent.press(screen.getByTestId("header-dates"));
    expect(screen.getByTestId("dates-sheet")).toBeOnTheScreen();
    expect(screen.getByTestId("dates-sheet-hint")).toHaveTextContent(nb.calendar.pickDepart);
    await fireEvent.press(screen.getByTestId("day-2026-11-02"));
    s.hold();
    await fireEvent.press(screen.getByTestId("dates-search"));
    expect(s.searches()).toHaveLength(2);
    // Hjemreisen var før den nye utreisen: flyttes med samme reiselengde (en uke).
    expect(s.searches()[1]!.slices.map((x) => x.departureDate)).toEqual(["2026-11-02", "2026-11-09"]);
    expect(screen.queryByTestId("dates-sheet")).toBeNull();
    expect(screen.getByTestId("results-loading")).toBeOnTheScreen();
    expect(screen.getByTestId("header-dates")).toHaveTextContent("2.–9. nov.");
    await s.answer();
    expect(screen.getByTestId("results-list")).toBeOnTheScreen();
  });

  it("reisende: brikken åpner reisende-arket, og «Søk på nytt» søker med de nye reisende", async () => {
    const s = await renderResults();
    await fireEvent.press(screen.getByTestId("header-travellers"));
    expect(screen.getByTestId("travellers-sheet")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText(nb.common.more(nb.home.adults)));
    s.hold();
    await fireEvent.press(screen.getByTestId("travellers-search"));
    expect(s.searches()).toHaveLength(2);
    expect(s.searches()[1]!.passengers).toEqual([{ type: "adult" }, { type: "adult" }]);
    expect(screen.queryByTestId("travellers-sheet")).toBeNull();
    expect(screen.getByTestId("header-travellers")).toHaveTextContent("2 voksne · Økonomi");
    await s.answer();
  });

  it("«Datoer» i verktøylinjen er det samme arket, med det samme «Søk på nytt»", async () => {
    await renderResults();
    await fireEvent.press(screen.getByTestId("open-dates"));
    expect(screen.getByTestId("dates-sheet")).toBeOnTheScreen();
    expect(screen.getByTestId("dates-search")).toHaveTextContent("Søk på nytt");
  });

  it("«Ferdig» lukker uten å søke; neste ark starter fra søket som vises, så «Søk på nytt» aldri tar med noe kunden ikke ser", async () => {
    const s = await renderResults();
    await fireEvent.press(screen.getByTestId("header-dates"));
    await fireEvent.press(screen.getByTestId("day-2026-11-02"));
    await fireEvent.press(screen.getByTestId("dates-sheet-done"));
    expect(s.searches()).toHaveLength(1);
    expect(screen.getByTestId("header-dates")).toHaveTextContent("23.–30. okt.");
    await fireEvent.press(screen.getByTestId("header-travellers"));
    expect(probe()).toHaveTextContent("roundtrip OSL→BCN 2026-10-23/2026-10-30 a1");
    s.hold();
    await fireEvent.press(screen.getByTestId("travellers-search"));
    expect(s.searches()[1]!.slices.map((x) => x.departureDate)).toEqual(["2026-10-23", "2026-10-30"]);
    await s.answer();
  });

  it("en feil i skjemaet (datoen har passert mens appen sto åpen) stopper søket og står i arket, over knappen", async () => {
    const s = await renderResults();
    jest.setSystemTime(new Date(2026, 9, 24, 12, 0));
    await fireEvent.press(screen.getByTestId("header-travellers"));
    await fireEvent.press(screen.getByTestId("travellers-search"));
    expect(screen.getByTestId("sheet-error")).toHaveTextContent("Utreisedatoen har passert. Velg en ny dato.");
    expect(screen.getByTestId("travellers-sheet")).toBeOnTheScreen();
    expect(s.searches()).toHaveLength(1);
  });
});

describe("uten liste: lasting og feil", () => {
  it("mens søket lastes, kan datoene endres fra brikken", async () => {
    const hanging: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: (() => new Promise(() => undefined)) as unknown as typeof fetch });
    await render(
      <AppProvider initialLocale="nb" apiFactory={hanging} initial={{ destination: BCN, departDate: "2026-10-23", returnDate: "2026-10-30" }}>
        <Harness>
          <ResultsScreen />
        </Harness>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("results-loading")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("header-dates"));
    expect(screen.getByTestId("dates-sheet")).toBeOnTheScreen();
  });

  it("feil: «Endre søk» åpner søket i øya over meldingen, ingen tur til forsiden", async () => {
    const server = fakeServer({ "flights.search": () => ({ status: 503, error: { message: "Leverandøren svarer ikke.", appCode: "SUPPLIER_UNAVAILABLE" } }) });
    const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
    await render(
      <AppProvider initialLocale="nb" apiFactory={factory} initial={{ destination: BCN, departDate: "2026-10-23", returnDate: "2026-10-30" }}>
        <Harness>
          <ResultsScreen />
        </Harness>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("results-error")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("edit-search-state"));
    expect(header().getByTestId("results-header-editor")).toBeOnTheScreen();
    expect(screen.getByTestId("results-error")).toBeOnTheScreen();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});

describe("bevegelse", () => {
  it("åpne og lukke: øya og listen under glir på plass i neste tegning (260 ms, myk ut), nytt innhold tones inn", async () => {
    const layout = jest.spyOn(LayoutAnimation, "configureNext").mockImplementation(() => undefined);
    await renderResults();
    await fireEvent.press(screen.getByTestId("header-route"));
    expect(layout).toHaveBeenCalledTimes(1);
    expect(layout.mock.calls[0]![0]).toEqual({ duration: 260, create: { type: "easeOut", property: "opacity" }, update: { type: "easeOut" }, delete: { type: "easeOut", property: "opacity" } });
    await fireEvent.press(screen.getByTestId("header-editor-close"));
    expect(layout).toHaveBeenCalledTimes(2);
  });

  it("«Reduser bevegelse»: ingen størrelse eller bevegelse, bare en toning – og skjemaet virker som før", async () => {
    reduceMotionOn();
    const layout = jest.spyOn(LayoutAnimation, "configureNext").mockImplementation(() => undefined);
    await renderResults();
    await motionSettingRead();
    await fireEvent.press(screen.getByTestId("header-route"));
    const config = layout.mock.calls.at(-1)![0] as LayoutAnimationConfig;
    expect(config.update).toBeUndefined();
    expect(config).toMatchObject({ create: { property: "opacity" }, delete: { property: "opacity" } });
    expect(editor().getByTestId("search-button")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("header-editor-close"));
    expect((layout.mock.calls.at(-1)![0] as LayoutAnimationConfig).update).toBeUndefined();
    expect(screen.getByTestId("header-route")).toBeOnTheScreen();
  });

  it("ankomst: ruten og brikkene tones inn og glir 8 pt på plass når vi vet at bevegelse er på; med «Reduser bevegelse» – eller før iOS har svart – står de stille", async () => {
    const arrival = expect.objectContaining({ toValue: 1, duration: 260, delay: 80, useNativeDriver: true });
    __setReducedMotionForTests(false);
    const timing = jest.spyOn(Animated, "timing");
    await renderResults();
    expect(timing).toHaveBeenCalledWith(expect.anything(), arrival);
    await screen.unmount();

    for (const known of [true, null]) {
      timing.mockClear();
      __setReducedMotionForTests(known);
      await renderResults();
      expect([known, timing.mock.calls.some(([, config]) => (config as { delay?: number }).delay === 80)]).toEqual([known, false]);
      const still = flat("header-summary");
      expect(still.opacity).toBe(1);
      expect(still.transform).toEqual([{ translateY: 0 }]);
      await screen.unmount();
    }
  });

  it("ankomsten går ferdig også når et raskt svar gjør lastingen om til en liste midt i den – ruten blir aldri stående halvveis gjennomsiktig", async () => {
    __setReducedMotionForTests(false);
    const ends: boolean[] = [];
    const realTiming = Animated.timing;
    jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
      const anim = realTiming(value, config);
      if (config.delay !== 80) return anim;
      return { ...anim, start: (done?: Animated.EndCallback) => anim.start((r) => (ends.push(r.finished), done?.(r))) };
    });
    const s = controlledServer();
    s.hold();
    await render(
      <AppProvider initialLocale="nb" apiFactory={s.factory} initial={{ destination: BCN, departDate: "2026-10-23", returnDate: "2026-10-30" }}>
        <Harness>
          <ResultsScreen />
        </Harness>
      </AppProvider>,
    );
    expect(screen.getByTestId("results-loading")).toBeOnTheScreen();
    // Svaret kommer før ruten har glidd på plass: øya bygges på nytt, i listen.
    await s.answer();
    expect(screen.getByTestId("results-list")).toBeOnTheScreen();
    await act(() => new Promise<void>((r) => setTimeout(r, 200)));
    expect(ends).toEqual([true]);
  });

  it("åpnes søket mens ruten glir inn, står ruten og brikkene helt synlige og på plass når øya lukkes igjen", async () => {
    __setReducedMotionForTests(false);
    await renderResults();
    // Rett etter ankomsten, før ruten har glidd på plass.
    await fireEvent.press(screen.getByTestId("header-route"));
    await fireEvent.press(screen.getByTestId("header-editor-close"));
    const summary = flat("header-summary");
    expect(summary.opacity).toBe(1);
    expect(summary.transform).toEqual([{ translateY: 0 }]);
  });

  it("bytt i øya: verdiene bytter plass synlig – ny fra-verdi kommer nedenfra, ny til-verdi ovenfra – og lander uten hopp", async () => {
    // Animasjonen går på iOS' egen tråd (native driver); når den er ferdig, får JS sluttverdien derfra. Testoppsettets
    // utgave melder bare «ferdig», så her sender den også sluttverdien, som på en iPhone.
    const nativeAnimated = NativeModules.NativeAnimatedModule as { startAnimatingNode: jest.Mock };
    const plain = nativeAnimated.startAnimatingNode.getMockImplementation();
    nativeAnimated.startAnimatingNode.mockImplementation((_id: number, _tag: number, config: { toValue?: number }, end: (r: { finished: boolean; value?: number }) => void) => {
      setTimeout(() => end({ finished: true, value: config.toValue }), 16);
    });
    try {
      await renderResults();
      await fireEvent.press(screen.getByTestId("header-route"));
      const timing = jest.spyOn(Animated, "timing");
      await fireEvent.press(editor().getByTestId("swap"));
      // Skjemaet er byttet med én gang; bare tegningen glir.
      expect(probe()).toHaveTextContent(/^roundtrip BCN→OSL /);
      expect(editor().getByTestId("origin")).toHaveTextContent("Barcelona (BCN)");
      expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 0, duration: 260, useNativeDriver: true }));
      // Første bilde: verdiene står der de var – Barcelona nede i til-raden, Oslo oppe i fra-raden (to halve rader og
      // skillelinjen unna) – og glir så på plass.
      expect(shift("route-value-origin")).toBeGreaterThan(50);
      expect(shift("route-value-destination")).toBeLessThan(-50);
      await act(() => new Promise<void>((r) => setTimeout(r, 40)));
      // Neste tegning viser hvor verdiene landet: på plass i sin nye rad, uten hopp tilbake.
      await fireEvent.press(editor().getByTestId("segment-roundtrip"));
      expect(shift("route-value-origin")).toBe(0);
      expect(shift("route-value-destination")).toBe(0);
      expect(editor().getByTestId("destination")).toHaveTextContent("Oslo (OSL)");
    } finally {
      nativeAnimated.startAnimatingNode.mockImplementation(plain);
    }
  });

  it("bytt med «Reduser bevegelse»: ingen glidning og ingen snuing, men byttet skjer og VoiceOver hører den nye ruten", async () => {
    reduceMotionOn();
    const announce = AccessibilityInfo.announceForAccessibility as jest.Mock;
    await renderResults();
    await motionSettingRead();
    await fireEvent.press(screen.getByTestId("header-route"));
    await motionSettingRead();
    const timing = jest.spyOn(Animated, "timing");
    await fireEvent.press(editor().getByTestId("swap"));
    expect(probe()).toHaveTextContent(/^roundtrip BCN→OSL /);
    expect(timing).not.toHaveBeenCalled();
    expect(flat("route-value-origin").transform).toBeUndefined();
    expect(flat("route-value-destination").transform).toBeUndefined();
    expect(announce).toHaveBeenCalledWith(nb.home.swapped("Barcelona", "Oslo"));
  });
});
