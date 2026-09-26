import { useEffect, type ReactNode } from "react";
import { AccessibilityInfo, Animated, LayoutAnimation, Pressable as RNPressable, RefreshControl, StyleSheet, Text as RNText, type LayoutAnimationConfig } from "react-native";
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
// bevegelsen er kort og myk – eller borte med «Reduser bevegelse». Overskriften beskriver alltid søket som vises, og
// alle tilstandene (ingen søk, lasting, feil, svar) står i én og samme liste, så ingenting bygges på nytt midt i bruk.

const router = (globalThis as unknown as { __router: { push: jest.Mock; navigate: jest.Mock; back: jest.Mock } }).__router;
const BCN = { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spania" };
const LHR = { iata: "LHR", name: "London Heathrow", city: "London", country: "Storbritannia" };
const BGO = { iata: "BGO", name: "Bergen lufthavn Flesland", city: "Bergen", country: "Norge" };
const EMPTY: MobileSearchResult = { ...SEARCH_RESULT, offers: [] };
const DOWN = { status: 503, error: { message: "Leverandøren svarer ikke.", appCode: "SUPPLIER_UNAVAILABLE" } };
/** Tekster fra ordbøker denne pakken ikke eier (forsiden, felles, kalender): regnet ut, ikke skrevet av. */
const nb = i18nFor("nb").t;

type SearchInput = { slices: { origin: string; destination: string; departureDate: string }[]; passengers: { type: string }[] };
type Reply = { data: MobileSearchResult } | { status: number; error: { message: string; appCode: string } };

/** Første søk svarer med en gang; `hold()` gjør at neste søk venter til testen svarer med `answer()`. */
function controlledServer(first: MobileSearchResult = SEARCH_RESULT) {
  const held: ((r: Reply) => void)[] = [];
  let holdNext = false;
  const server = fakeServer({
    "flights.search": (() => {
      if (!holdNext) return { data: first };
      holdNext = false;
      return new Promise<Reply>((resolve) => held.push(resolve));
    }) as never,
  });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  return {
    factory,
    hold: () => {
      holdNext = true;
    },
    answer: async (reply: Reply = { data: SEARCH_RESULT }) => {
      await waitFor(() => expect(held.length).toBe(1));
      await act(async () => held.shift()!(reply));
    },
    searches: () => server.calls.filter((c) => c.path === "flights.search").map((c) => c.input as SearchInput),
  };
}

/**
 * Søker ved start (med mindre skjermen er åpnet uten et søk), viser skjemaet, og har knapper som endrer skjemaet slik
 * andre deler av appen gjør (uten å søke).
 */
function Harness({ children, searchOnMount }: { children: ReactNode; searchOnMount: boolean }) {
  const { runSearch, setForm, form } = useApp();
  useEffect(() => {
    if (searchOnMount) runSearch();
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

/** Skjermen, uten å vente på noe (lasting, feil eller ingen søk). */
async function renderScreen({ initial = {}, server = controlledServer(), searchOnMount = true }: { initial?: Record<string, unknown>; server?: ReturnType<typeof controlledServer>; searchOnMount?: boolean } = {}) {
  await render(
    <AppProvider initialLocale="nb" apiFactory={server.factory} initial={{ destination: BCN, departDate: "2026-10-23", returnDate: "2026-10-30", ...initial }}>
      <Harness searchOnMount={searchOnMount}>
        <ResultsScreen />
      </Harness>
    </AppProvider>,
  );
  return server;
}

/** Skjermen med et ferdig svar. */
async function renderResults(options: Parameters<typeof renderScreen>[0] = {}) {
  const server = await renderScreen(options);
  await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
  return server;
}

/** Stil for et element – også et som er skjult for VoiceOver (under skjemaet i øya). */
const flat = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID, { includeHiddenElements: true }).props.style) ?? {};
const probe = () => screen.getByTestId("probe");
const header = () => within(screen.getByTestId("results-header"));
const editor = () => within(screen.getByTestId("results-header-editor"));
/** Verdiens forskyvning i en rad i rutefeltet (0 = på plass). */
const shift = (testID: string) => ((flat(testID).transform as { translateY: number }[] | undefined)?.[0]?.translateY ?? 0) as number;
/** Kontrollen for «dra ned» (iOS' UIRefreshControl). Testoppsettets RefreshControl husker den siste som ble vist. */
const refreshControl = () => (RefreshControl as unknown as { latestRef: { props: { enabled?: boolean; onRefresh: () => void } } }).latestRef;
/** Elementene VoiceOver er flyttet til, i rekkefølge (testID-ene). */
const focused = () => (AccessibilityInfo.sendAccessibilityEvent as jest.Mock).mock.calls.map(([node, event]) => `${(node as { props: { testID?: string } }).props.testID}:${event as string}`);
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
  // Hver test starter med bevegelse på (svaret fra iOS er nullstilt i jest.setup.tsx).
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockClear().mockResolvedValue(false);
  (AccessibilityInfo.sendAccessibilityEvent as jest.Mock).mockClear();
  (AccessibilityInfo.announceForAccessibility as jest.Mock).mockClear();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("søket i toppen, kompakt", () => {
  it("ruten er skjermens overskrift for VoiceOver (med ord), og en trykkflate for den som ser; «Endre søk» er knappen; datoer og reisende er lyse brikker på grafitt, hver minst 44 pt, med hele teksten", async () => {
    await renderResults();
    // Én overskrift i øya: ruten. iOS gir ett element én rolle, så trykkflaten rundt den er ikke et eget element.
    const titles = header().getAllByRole("header");
    expect(titles).toHaveLength(1);
    expect(titles[0]).toHaveTextContent("Oslo → Barcelona");
    expect(titles[0]).toHaveProp("accessibilityLabel", "Oslo til Barcelona");
    expect(titles[0]).toHaveProp("accessibilityLanguage", "nb-NO");
    const route = screen.getByTestId("header-route");
    expect(route).toHaveProp("accessible", false);
    expect(within(route).getByRole("header")).toBe(titles[0]);
    expect(flat("header-route").minHeight).toBeGreaterThanOrEqual(TOUCH);
    // For VoiceOver er «Endre søk» knappen som åpner søket.
    const edit = screen.getByTestId("edit-search");
    expect(edit).toHaveProp("accessibilityRole", "button");
    expect(edit).toHaveProp("accessibilityLabel", "Endre søk");

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

    for (const id of ["header-dates", "header-travellers"]) {
      expect([id, (flat(id).minHeight as number) >= TOUCH]).toEqual([id, true]);
      expect([id, screen.getByTestId(id).props.accessibilityLanguage]).toEqual([id, "nb-NO"]);
    }
    // Stor tekst: brytes, kuttes aldri.
    for (const id of ["header-route", "header-dates", "header-travellers"]) {
      for (const text of within(screen.getByTestId(id)).queryAllByText(/.+/)) expect(text.props.numberOfLines ?? 0).not.toBe(1);
    }
    // «Cloud + Graphite»: brikkene er `bg` med mørk kant i øya, med lys tekst.
    expect(flat("header-dates")).toMatchObject({ backgroundColor: colors.bg, borderColor: colors.darkBorder });
    expect(StyleSheet.flatten(within(travellers).getByText(/voksen/).props.style).color).toBe(colors.onDark);
  });

  it("et trykk på ruten (for den som ser) åpner søket, som «Endre søk»", async () => {
    await renderResults();
    await fireEvent.press(screen.getByTestId("header-route"));
    expect(editor().getByTestId("search-button")).toBeOnTheScreen();
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
    expect(String(within(travellers).getByText(/voksne/).props.children)).toContain("2\u00A0voksne");
  });

  it("overskriften beskriver søket som vises – også når skjemaet er endret uten å søke", async () => {
    await renderResults();
    await fireEvent.press(screen.getByTestId("test-edit-form"));
    expect(probe()).toHaveTextContent(/→LHR 2026-11-02\/2026-11-09 a3$/);
    expect(header().getByRole("header")).toHaveTextContent("Oslo → Barcelona");
    expect(header().getByRole("header")).toHaveProp("accessibilityLabel", "Oslo til Barcelona");
    expect(screen.getByTestId("header-dates")).toHaveTextContent("23.–30. okt.");
    expect(screen.getByTestId("header-travellers")).toHaveTextContent("1 voksen · Økonomi");
  });
});

describe("søket åpnes i øya", () => {
  it("«Endre søk» gjør øya til hele søkeskjemaet, med «Lukk» øverst til høyre; VoiceOver går til skjemaets overskrift", async () => {
    await renderResults();
    await fireEvent.press(screen.getByTestId("edit-search"));
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
    for (const id of ["header-route", "header-dates", "header-travellers", "price-status", "sort-tabs", "results-toolbar"]) expect(screen.queryByTestId(id, { includeHiddenElements: true })).toBeNull();
    // Hver knapp i skjemaet leses med norsk stemme.
    for (const button of open.getAllByRole("button")) expect(button.props.accessibilityLanguage).toBe("nb-NO");
    await waitFor(() => expect(focused()).toEqual(["header-editor-title:focus"]));
    expect(router.push).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("«Søk fly» i øya søker på nytt her – ingen ny resultatside – og øya krymper til ruten og brikkene, som viser det nye søket mens det lastes", async () => {
    const s = await renderResults();
    await fireEvent.press(screen.getByTestId("header-route"));
    // VoiceOver står i skjemaet når det har åpnet seg.
    await waitFor(() => expect(focused()).toEqual(["header-editor-title:focus"]));
    await fireEvent.press(editor().getByTestId("swap"));
    s.hold();
    await fireEvent.press(editor().getByTestId("search-button"));
    expect(s.searches()).toHaveLength(2);
    expect(s.searches()[1]!.slices.map((x) => `${x.origin}-${x.destination} ${x.departureDate}`)).toEqual(["BCN-OSL 2026-10-23", "OSL-BCN 2026-10-30"]);
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByTestId("results-header-editor")).toBeNull();
    expect(header().getByRole("header")).toHaveTextContent("Barcelona → Oslo");
    expect(header().getByRole("header")).toHaveProp("accessibilityLabel", "Barcelona til Oslo");
    expect(screen.getByTestId("results-loading")).toBeOnTheScreen();
    // VoiceOver: tilbake til skjermens overskrift når øya har krympet.
    await waitFor(() => expect(focused()).toEqual(["header-editor-title:focus", "header-title:focus"]));
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

  it("«Lukk» lukker uten å søke: listen står, overskriften viser søket som vises, og skjemaet er igjen det søket; lukkes det før det har åpnet seg helt, går VoiceOver rett til ruten", async () => {
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
    // Skjemaet ble lukket før åpningen var ferdig: VoiceOver sendes aldri til et skjema som er borte.
    await waitFor(() => expect(focused()).toEqual(["header-title:focus"]));
    await act(() => new Promise<void>((r) => setTimeout(r, 300)));
    expect(focused()).toEqual(["header-title:focus"]);
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

describe("mens søket står åpent i øya, er alt under den stille", () => {
  it("listen: ingen trykk, skjult for VoiceOver, og «dra ned» gjør ingenting – til skjemaet lukkes", async () => {
    const s = await renderResults();
    await fireEvent.press(screen.getByTestId("header-route"));
    // Tegnet, men ikke til å nå: VoiceOver hopper over det (og spørringer som leser som VoiceOver, finner det ikke).
    expect(screen.queryByTestId("offer-sek_1")).toBeNull();
    await fireEvent.press(screen.getByTestId("offer-sek_1", { includeHiddenElements: true }));
    expect(router.push).not.toHaveBeenCalled();
    const below = screen.getByTestId("results-below-header", { includeHiddenElements: true });
    expect(below).toHaveProp("pointerEvents", "none");
    expect(below).toHaveProp("accessibilityElementsHidden", true);
    expect(below).toHaveProp("importantForAccessibility", "no-hide-descendants");
    expect(refreshControl().props.enabled).toBe(false);
    await act(async () => refreshControl().props.onRefresh());
    expect(s.searches()).toHaveLength(1);

    await fireEvent.press(screen.getByTestId("header-editor-close"));
    expect(screen.getByTestId("offer-sek_1")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("offer-sek_1"));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/tilbud/[id]", params: { id: "sek_1" } });
    expect(refreshControl().props.enabled).toBe(true);
  });

  it("feil: «Prøv igjen» og «Endre søk» i tilstanden virker ikke mens skjemaet står åpent", async () => {
    const s = controlledServer();
    s.hold();
    await renderScreen({ server: s });
    await s.answer(DOWN);
    await fireEvent.press(screen.getByTestId("edit-search"));
    expect(screen.queryByTestId("results-error")).toBeNull();
    await fireEvent.press(screen.getByTestId("retry-search", { includeHiddenElements: true }));
    expect(s.searches()).toHaveLength(1);
    expect(screen.getByTestId("results-header-editor")).toBeOnTheScreen();
    expect(refreshControl().props.enabled).toBe(false);
  });

  it("ingen reiser: «Prøv datoene rundt» virker ikke mens skjemaet står åpent", async () => {
    const s = await renderResults({ server: controlledServer(EMPTY) });
    await fireEvent.press(screen.getByTestId("edit-search"));
    expect(screen.queryByTestId("nearby-dates")).toBeNull();
    await fireEvent.press(screen.getByTestId("nearby-1", { includeHiddenElements: true }));
    await fireEvent.press(screen.getByTestId("edit-search-state", { includeHiddenElements: true }));
    expect(s.searches()).toHaveLength(1);
    expect(probe()).toHaveTextContent("roundtrip OSL→BCN 2026-10-23/2026-10-30 a1");
  });
});

describe("én og samme liste i alle tilstandene", () => {
  it("et datoark som står åpent når svaret kommer, står åpent – og neste trykk er fortsatt returdatoen", async () => {
    const s = controlledServer();
    s.hold();
    await renderScreen({ server: s });
    await waitFor(() => expect(screen.getByTestId("results-loading")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("header-dates"));
    expect(screen.getByTestId("dates-sheet-hint")).toHaveTextContent(nb.calendar.pickDepart);
    await fireEvent.press(screen.getByTestId("day-2026-11-02"));
    expect(screen.getByTestId("dates-sheet-hint")).toHaveTextContent(nb.calendar.pickReturn);
    // Svaret kommer mens kunden er midt i valget.
    await s.answer();
    expect(screen.getByTestId("results-list")).toBeOnTheScreen();
    expect(screen.getByTestId("dates-sheet")).toBeOnTheScreen();
    expect(screen.getByTestId("dates-sheet-hint")).toHaveTextContent(nb.calendar.pickReturn);
    await fireEvent.press(screen.getByTestId("day-2026-11-06"));
    expect(probe()).toHaveTextContent("roundtrip OSL→BCN 2026-11-02/2026-11-06 a1");
  });

  it("skjemaet i øya står når svaret kommer: kalenderen det har åpnet, og feilen det viser, står", async () => {
    const s = controlledServer();
    s.hold();
    await renderScreen({ server: s });
    await waitFor(() => expect(screen.getByTestId("results-loading")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("header-route"));
    await fireEvent.press(screen.getByTestId("test-same-airport"));
    await fireEvent.press(editor().getByTestId("search-button"));
    expect(editor().getByTestId("form-error")).toHaveTextContent("Avreise og reisemål kan ikke være samme flyplass.");
    await fireEvent.press(editor().getByTestId("depart-date"));
    expect(screen.getByTestId("calendar")).toBeOnTheScreen();
    await s.answer();
    expect(screen.getByTestId("results-list")).toBeOnTheScreen();
    expect(screen.getByTestId("calendar")).toBeOnTheScreen();
    expect(editor().getByTestId("form-error")).toHaveTextContent("Avreise og reisemål kan ikke være samme flyplass.");
  });

  it("mens et søk lastes og søket står åpent i øya: «Stopp søket» står utenfor listen og virker, og lastingen har fortsatt en høyde", async () => {
    const s = controlledServer();
    s.hold();
    await renderScreen({ server: s });
    await waitFor(() => expect(screen.getByTestId("results-loading")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("header-route"));
    expect(within(screen.getByTestId("results-shell")).queryByTestId("cancel-search", { includeHiddenElements: true })).toBeNull();
    expect(flat("results-loading-block").minHeight).toBeGreaterThanOrEqual(240);
    await fireEvent.press(screen.getByTestId("cancel-search"));
    expect(router.back).toHaveBeenCalled();
  });
});

describe("brikkene endrer søket med én gang", () => {
  it("datoene: brikken åpner kalenderen, og «Søk på nytt» søker med de nye datoene – resultatene laster det nye søket", async () => {
    const s = await renderResults();
    await fireEvent.press(screen.getByTestId("header-dates"));
    expect(screen.getByTestId("dates-sheet")).toBeOnTheScreen();
    expect(screen.getByTestId("dates-sheet-hint")).toHaveTextContent(nb.calendar.pickDepart);
    expect(screen.getByTestId("dates-search")).toHaveProp("accessibilityLabel", "Søk på nytt");
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

  it("«Ferdig» lukker uten å søke, og skjemaet er igjen søket som vises – «Søk på nytt» tar aldri med noe kunden ikke ser", async () => {
    const s = await renderResults();
    await fireEvent.press(screen.getByTestId("header-dates"));
    await fireEvent.press(screen.getByTestId("day-2026-11-02"));
    await fireEvent.press(screen.getByTestId("dates-sheet-done"));
    expect(s.searches()).toHaveLength(1);
    expect(screen.getByTestId("header-dates")).toHaveTextContent("23.–30. okt.");
    expect(probe()).toHaveTextContent("roundtrip OSL→BCN 2026-10-23/2026-10-30 a1");
    await fireEvent.press(screen.getByTestId("header-travellers"));
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

describe("feil og lasting", () => {
  it("«Prøv igjen» søker på nytt med søket som feilet – ikke datoer som er valgt i arket etterpå uten å søke", async () => {
    const s = controlledServer();
    s.hold();
    await renderScreen({ server: s });
    await s.answer(DOWN);
    expect(screen.getByTestId("results-error")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("header-dates"));
    await fireEvent.press(screen.getByTestId("day-2026-11-02"));
    await fireEvent.press(screen.getByTestId("dates-sheet-done"));
    s.hold();
    await fireEvent.press(screen.getByTestId("retry-search"));
    expect(s.searches()).toHaveLength(2);
    expect(s.searches()[1]!.slices.map((x) => x.departureDate)).toEqual(["2026-10-23", "2026-10-30"]);
    expect(screen.getByTestId("results-loading")).toBeOnTheScreen();
    await s.answer();
    expect(screen.getByTestId("results-list")).toBeOnTheScreen();
  });

  it("mens søket lastes, kan datoene endres fra brikken", async () => {
    const s = controlledServer();
    s.hold();
    await renderScreen({ server: s });
    await waitFor(() => expect(screen.getByTestId("results-loading")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("header-dates"));
    expect(screen.getByTestId("dates-sheet")).toBeOnTheScreen();
  });

  it("feil: «Endre søk» åpner søket i øya over meldingen, ingen tur til forsiden", async () => {
    const s = controlledServer();
    s.hold();
    await renderScreen({ server: s });
    await s.answer(DOWN);
    await fireEvent.press(screen.getByTestId("edit-search-state"));
    expect(header().getByTestId("results-header-editor")).toBeOnTheScreen();
    // Meldingen står under skjemaet, men er stille så lenge det er åpent.
    expect(screen.getByTestId("results-error", { includeHiddenElements: true })).toHaveProp("accessibilityElementsHidden", true);
    expect(router.navigate).not.toHaveBeenCalled();
  });
});

describe("uten et søk (skjermen er åpnet fra en lenke)", () => {
  it("lukkes arket eller skjemaet uten å søke, står skjemaet som før, og overskriften beskriver aldri noe som ikke er søkt", async () => {
    await renderScreen({ searchOnMount: false });
    expect(screen.getByTestId("results-empty")).toBeOnTheScreen();
    expect(header().getByRole("header")).toHaveTextContent("Oslo → Barcelona");
    const before = "roundtrip OSL→BCN 2026-10-23/2026-10-30 a1";

    // Arket: knappen heter «Søk» (det er ikke søkt ennå). Bak arket står overskriften på skjemaet slik det var.
    await fireEvent.press(screen.getByTestId("header-dates"));
    expect(screen.getByTestId("dates-search")).toHaveProp("accessibilityLabel", "Søk");
    await fireEvent.press(screen.getByTestId("day-2026-11-02"));
    expect(probe()).toHaveTextContent("roundtrip OSL→BCN 2026-11-02/2026-11-09 a1");
    expect(screen.getByTestId("header-dates")).toHaveTextContent("23.–30. okt.");
    await fireEvent.press(screen.getByTestId("dates-sheet-done"));
    expect(probe()).toHaveTextContent(before);
    expect(screen.getByTestId("header-dates")).toHaveTextContent("23.–30. okt.");

    // Skjemaet i øya: «Lukk» setter det tilbake.
    await fireEvent.press(screen.getByTestId("header-route"));
    await fireEvent.press(editor().getByTestId("swap"));
    expect(probe()).toHaveTextContent(/^roundtrip BCN→OSL /);
    await fireEvent.press(screen.getByTestId("header-editor-close"));
    expect(probe()).toHaveTextContent(before);
    expect(header().getByRole("header")).toHaveTextContent("Oslo → Barcelona");
  });

  it("«Søk» i arket starter det første søket, med datoene kunden valgte", async () => {
    const s = controlledServer();
    await renderScreen({ server: s, searchOnMount: false });
    await fireEvent.press(screen.getByTestId("header-dates"));
    await fireEvent.press(screen.getByTestId("day-2026-11-02"));
    s.hold();
    await fireEvent.press(screen.getByTestId("dates-search"));
    expect(s.searches()).toHaveLength(1);
    expect(s.searches()[0]!.slices.map((x) => x.departureDate)).toEqual(["2026-11-02", "2026-11-09"]);
    expect(screen.getByTestId("results-loading")).toBeOnTheScreen();
    expect(screen.getByTestId("header-dates")).toHaveTextContent("2.–9. nov.");
    await s.answer();
    expect(screen.getByTestId("results-list")).toBeOnTheScreen();
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

  it("VoiceOver flyttes først når forvandlingen er ferdig (iOS melder fra), ikke midt i den – også med «Reduser bevegelse», etter toningen", async () => {
    const ends: (() => void)[] = [];
    const layout = jest.spyOn(LayoutAnimation, "configureNext").mockImplementation((_config, done) => {
      if (done) ends.push(done);
    });
    await renderResults();
    await fireEvent.press(screen.getByTestId("header-route"));
    expect(screen.getByTestId("results-header-editor")).toBeOnTheScreen();
    expect(focused()).toEqual([]);
    await act(async () => ends.shift()!());
    expect(focused()).toEqual(["header-editor-title:focus"]);
    await fireEvent.press(screen.getByTestId("header-editor-close"));
    expect(focused()).toEqual(["header-editor-title:focus"]);
    await act(async () => ends.shift()!());
    expect(focused()).toEqual(["header-editor-title:focus", "header-title:focus"]);
    await screen.unmount();

    // «Reduser bevegelse»: toningen (ingen størrelse) – og VoiceOver flyttes når den er ferdig.
    (AccessibilityInfo.sendAccessibilityEvent as jest.Mock).mockClear();
    reduceMotionOn();
    await renderResults();
    await motionSettingRead();
    await fireEvent.press(screen.getByTestId("header-route"));
    expect((layout.mock.calls.at(-1)![0] as LayoutAnimationConfig).update).toBeUndefined();
    expect(focused()).toEqual([]);
    await act(async () => ends.shift()!());
    expect(focused()).toEqual(["header-editor-title:focus"]);
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

  it("ankomsten går ferdig også når svaret kommer midt i den – ruten blir aldri stående halvveis gjennomsiktig", async () => {
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
    await renderScreen({ server: s });
    expect(screen.getByTestId("results-loading")).toBeOnTheScreen();
    // Svaret kommer før ruten har glidd på plass.
    await s.answer();
    expect(screen.getByTestId("results-list")).toBeOnTheScreen();
    await act(() => new Promise<void>((r) => setTimeout(r, 200)));
    expect(ends).toEqual([true]);
    // Sluttverdien er med (som på en iPhone): neste tegning står helt på plass.
    await fireEvent.press(screen.getByTestId("chip-max1"));
    expect(flat("header-summary")).toMatchObject({ opacity: 1, transform: [{ translateY: 0 }] });
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
  });

  it("bytt to ganger raskt: det andre byttet fortsetter fra der verdiene står – ingen hopp til en hel rad unna", async () => {
    await renderResults();
    await fireEvent.press(screen.getByTestId("header-route"));
    // Glidningen står stille i testen: hvor langt den er kommet, regnes fra den festede klokken (Date), ikke fra
    // animasjonens egne bilder, som i Jest går i sanntid og gjorde testen ustabil når maskinen var travel.
    jest.spyOn(Animated, "timing").mockImplementation(() => ({ start: () => undefined, stop: () => undefined, reset: () => undefined }));
    await fireEvent.press(editor().getByTestId("swap"));
    const row = shift("route-value-origin");
    expect(row).toBeGreaterThan(50);
    // Halvveis i tiden (130 av 260 ms): med kurven (rask start, rolig landing) har verdiene 12,5 % av raden igjen.
    await act(() => jest.advanceTimersByTime(130));
    await fireEvent.press(editor().getByTestId("swap"));
    expect(probe()).toHaveTextContent(/^roundtrip OSL→BCN /);
    // Oslo går tilbake til fra-raden fra der den står nå (87,5 % av raden under), og Barcelona motsatt vei.
    expect(shift("route-value-origin")).toBeCloseTo(0.875 * row, 1);
    expect(shift("route-value-destination")).toBeCloseTo(-0.875 * row, 1);
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
