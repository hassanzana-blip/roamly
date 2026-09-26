import type { ReactNode } from "react";
import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import * as SafeArea from "react-native-safe-area-context";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { AppProvider, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { colors, radius, TOUCH } from "../lib/theme";
import { __resetLocalStoreForTests, writePref } from "../lib/localStore";
import { initialForm, type SearchForm } from "../lib/searchForm";
import { toIsoDate } from "../lib/format";
import { DESTINATIONS } from "../lib/destinations";
import { MAP_POINTS } from "../lib/destinationMap";
import { fakeServer } from "../test/fakeServer";
import { SEARCH_RESULT } from "../test/fixtures";
import { CHECKIN, CHECKOUT, HOTEL_A, HOTEL_DETAIL, HOTEL_RESULT, LONDON, STATUS_LIVE, STATUS_OFF, STATUS_SANDBOX } from "../test/hotelFixtures";
import { pinClock } from "../test/clock";
import type { DestinationMapProps } from "../components/DestinationMap";
import ExploreScreen from "../app/(tabs)/utforsk";
import SavedScreen from "../app/(tabs)/lagret";
import HotelSearchScreen from "../app/hotell/index";
import HotelResultsScreen from "../app/hotell/resultater";
import HotelDetailScreen from "../app/hotell/detaljer";

// «Cloud + Graphite» i Utforsk, Lagret og hotellskjermene: lys grunn, hvite flater og mørk tekst – ingen grafittøy
// øverst. Grafitt står bare igjen der den hører til: fotokortene i Utforsk (hvit tekst på foto) og Apple-kartet.

// Statuslinjen er en innstilling som ikke tegnes; her blir den et element som husker stilen den fikk.
jest.mock("expo-status-bar", () => {
  const { View } = jest.requireActual("react-native");
  return { StatusBar: (props: { style?: string }) => <View testID="status-bar" {...({ statusBarStyle: props.style } as object)} /> };
});

const setParams = (globalThis as unknown as { __setParams: (p: Record<string, string>) => void }).__setParams;
/** Statuslinjen på en iPhone med Dynamic Island. */
const TOP = 59;
const OSL = { iata: "OSL", name: "Oslo lufthavn Gardermoen", city: "Oslo", country: "Norge" };
const BGO = { iata: "BGO", name: "Bergen lufthavn Flesland", city: "Bergen", country: "Norge" };
const BCN = { iata: "BCN", name: "Barcelona-El Prat", city: "Barcelona", country: "Spania" };
const LHR = { iata: "LHR", name: "London Heathrow", city: "London", country: "Storbritannia" };
const STAY = { sted: LONDON.key, navn: "London, England, Storbritannia", inn: CHECKIN, ut: CHECKOUT, voksne: "2", barn: "", rom: "1" };
/** Fotokortene i Utforsk: hvit tekst på foto (med overlegg) er riktig der. */
const PHOTO_CARDS = new Set(DESTINATIONS.map((d) => `explore-${d.id}`));

const flat = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style as StyleProp<ViewStyle>);
const colorOf = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as StyleProp<TextStyle>)?.color;
const statusBarStyle = () => screen.getByTestId("status-bar").props.statusBarStyle as string;
const day = (offset: number) => toIsoDate(new Date(Date.now() + offset * 86_400_000));

type HostNode = { type: string; props: Record<string, unknown>; children: (HostNode | string)[] | null };
const textOf = (n: HostNode | string): string => (typeof n === "string" ? n : (n.children ?? []).map(textOf).join(""));

/** Elementer på skjermen som oppfyller `test`, utenom det som ligger under et element `skip` sier nei til. */
function findOnScreen(test: (n: HostNode) => boolean, skip: (testID: string) => boolean = () => false): string[] {
  const out: string[] = [];
  const walk = (n: HostNode | string | null) => {
    if (!n || typeof n === "string") return;
    const id = typeof n.props.testID === "string" ? n.props.testID : "";
    if (id && skip(id)) return;
    if (test(n)) out.push(id || `${n.type}: ${textOf(n).slice(0, 40)}`);
    for (const c of n.children ?? []) walk(c);
  };
  const tree = screen.toJSON() as HostNode | HostNode[] | null;
  for (const root of Array.isArray(tree) ? tree : [tree]) walk(root);
  return out;
}

/** Tekst i farger som bare hører hjemme på grafitt (onDark …, blueOnDark, warningOnDark). */
const DARK_TEXT: string[] = [colors.onDark, colors.onDarkMuted, colors.onDarkDim, colors.blueOnDark, colors.warningOnDark];
const darkTexts = (skip?: (testID: string) => boolean) => findOnScreen((n) => n.type === "Text" && DARK_TEXT.includes(colorOf(n) as string), skip);
/** Grafittflater (bg, raised, darkBorder). */
const GRAPHITE: string[] = [colors.bg, colors.raised, colors.darkBorder];
const graphiteSurfaces = (skip?: (testID: string) => boolean) =>
  findOnScreen((n) => GRAPHITE.includes(StyleSheet.flatten(n.props.style as StyleProp<ViewStyle>)?.backgroundColor as string), skip);

/**
 * Alt VoiceOver kan stoppe på (tilgjengelige elementer, felt og tekst som ikke er gruppert under et tilgjengelig
 * element) som mangler språket – samme regel som i a11yLanguage-testen.
 */
function withoutLanguage(lang: string, skip: (testID: string) => boolean = () => false): string[] {
  const wrong: string[] = [];
  const walk = (n: HostNode | string | null, insideAccessible: boolean) => {
    if (!n || typeof n === "string") return;
    const p = n.props ?? {};
    if (p.accessibilityElementsHidden === true || p.importantForAccessibility === "no-hide-descendants") return;
    const id = typeof p.testID === "string" ? p.testID : "";
    if (id && skip(id)) return;
    const accessible = p.accessible === true;
    const focusable = accessible || n.type === "TextInput" || p.accessibilityViewIsModal === true || (n.type === "Text" && !insideAccessible);
    if (focusable && p.accessible !== false && p.accessibilityLanguage !== lang) wrong.push(id || `${n.type}: ${textOf(n).slice(0, 40)}`);
    for (const c of n.children ?? []) walk(c, insideAccessible || accessible);
  };
  const tree = screen.toJSON() as HostNode | HostNode[] | null;
  for (const root of Array.isArray(tree) ? tree : [tree]) walk(root, false);
  return wrong;
}

function factoryFor(routes: Parameters<typeof fakeServer>[0]): ApiFactory {
  const server = fakeServer({ "mobileAuth.me": () => ({ data: null }), ...routes });
  return (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
}

async function renderWith(ui: ReactNode, routes: Parameters<typeof fakeServer>[0] = {}, initial?: Partial<SearchForm>) {
  await render(
    <AppProvider initialLocale="nb" apiFactory={factoryFor({ "flights.search": () => ({ data: SEARCH_RESULT }), ...routes })} initial={initial}>
      {ui}
    </AppProvider>,
  );
}

beforeEach(() => {
  // Klokken står fast (bare Date), så datoene i testene aldri passerer av seg selv.
  pinClock();
  jest.spyOn(SafeArea, "useSafeAreaInsets").mockReturnValue({ top: TOP, bottom: 34, left: 0, right: 0 });
  writePref("saved", null);
  writePref("recent", null);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("Utforsk i «Cloud + Graphite»", () => {
  it("lys grunn og mørk tittel; mørk tekst i statuslinjen og en lys skjerm bak den; ingen grafitt utenfor fotokortene", async () => {
    await renderWith(<ExploreScreen />);
    expect(flat("explore-screen").backgroundColor).toBe(colors.canvas);
    expect(colorOf(screen.getByRole("header", { name: "Utforsk reisemål" }))).toBe(colors.text);
    expect(statusBarStyle()).toBe("dark");
    expect(flat("status-bar-shield")).toMatchObject({ height: TOP, backgroundColor: colors.canvas });
    const onPhoto = (id: string) => PHOTO_CARDS.has(id);
    expect(darkTexts(onPhoto)).toEqual([]);
    expect(graphiteSurfaces(onPhoto)).toEqual([]);
    // Hjelperne ser grafitt når den er der: i fotokortene (mørk flate til bildet er lastet, hvit tekst på fotoet).
    expect(graphiteSurfaces().filter((id) => PHOTO_CARDS.has(id))).toHaveLength(DESTINATIONS.length);
    expect(darkTexts().length).toBeGreaterThanOrEqual(DESTINATIONS.length);
    // Alt VoiceOver kan stoppe på har språket, også de nye knappene (fanene, «Tøm søket»).
    expect(withoutLanguage("nb-NO")).toEqual([]);
  });

  it("søket øverst er hvite piller med lys kant og mørk tekst – fortsatt 36 pt med hitSlop til 44", async () => {
    await renderWith(<ExploreScreen />);
    for (const id of ["context-origin", "context-dates", "context-travellers"]) {
      const pill = screen.getByTestId(id);
      expect(flat(id)).toMatchObject({ backgroundColor: colors.white, borderColor: colors.lightBorder, minHeight: 36 });
      expect(36 + 2 * (pill.props.hitSlop as number)).toBe(TOUCH);
      for (const label of within(pill).getAllByText(/./)) expect(colorOf(label)).toBe(colors.text);
    }
  });

  it("søkefeltet er hvitt med mørk tekst og sekundærfarget plassholder; «Tøm søket» er en egen 44 pt-knapp uten hitSlop", async () => {
    await renderWith(<ExploreScreen />);
    expect(flat("explore-search-field")).toMatchObject({ backgroundColor: colors.white, borderColor: colors.lightBorder });
    const input = screen.getByTestId("explore-search");
    expect(colorOf(input)).toBe(colors.text);
    expect(input).toHaveProp("placeholderTextColor", colors.textSecondary);
    await fireEvent.changeText(input, "spania");
    expect(colorOf(screen.getByTestId("explore-count"))).toBe(colors.textSecondary);
    const clear = screen.getByTestId("explore-search-clear");
    expect(flat("explore-search-clear")).toMatchObject({ width: TOUCH, height: TOUCH });
    expect(clear.props.hitSlop).toBeUndefined();
    expect(clear).toHaveProp("accessibilityRole", "button");
    expect(clear).toHaveProp("accessibilityLabel", "Tøm søket");
    expect(clear).toHaveProp("accessibilityLanguage", "nb-NO");
    // Under et søk: flyplassen under kortet, også sekundærfarget på grunnen.
    expect(colorOf(screen.getByTestId("explore-airport-barcelona"))).toBe(colors.textSecondary);
  });

  it("Liste | Kart er et lyst fanevalg: samme testID-er, fanerolle og valgt tilstand; den valgte er blå med hvit tekst", async () => {
    await renderWith(<ExploreScreen />);
    expect(screen.getByTestId("explore-view-tabs")).toHaveProp("accessibilityRole", "tablist");
    expect(flat("explore-view-tabs")).toMatchObject({ backgroundColor: colors.white, borderColor: colors.lightBorder });
    expect(screen.getAllByRole("tab").map((t) => t.props.accessibilityLabel)).toEqual(["Liste", "Kart"]);
    for (const id of ["tab-list", "tab-map"]) {
      const tab = screen.getByTestId(id);
      expect(tab).toHaveProp("accessibilityRole", "tab");
      expect(tab).toHaveProp("accessibilityLanguage", "nb-NO");
      expect(flat(id).minHeight).toBeGreaterThanOrEqual(TOUCH);
      expect(tab.props.hitSlop).toBeUndefined();
    }
    expect(screen.getByTestId("tab-list")).toBeSelected();
    expect(screen.getByTestId("tab-map")).not.toBeSelected();
    expect(flat("tab-list").backgroundColor).toBe(colors.blue);
    expect(flat("tab-map").backgroundColor).toBeUndefined();
    expect(colorOf(within(screen.getByTestId("tab-list")).getByText("Liste"))).toBe(colors.white);
    expect(colorOf(within(screen.getByTestId("tab-map")).getByText("Kart"))).toBe(colors.text);

    await fireEvent.press(screen.getByTestId("tab-map"));
    expect(screen.getByTestId("tab-map")).toBeSelected();
    expect(screen.getByTestId("tab-list")).not.toBeSelected();
    expect(flat("tab-map").backgroundColor).toBe(colors.blue);
    expect(colorOf(within(screen.getByTestId("tab-list")).getByText("Liste"))).toBe(colors.text);
  });

  it("fotokortene beholder fotoet, overlegget og lagreknappen på fotoet; teksten under kortet står sekundærfarget og uten linjegrense", async () => {
    await renderWith(<ExploreScreen />);
    // På fotoet: hvit tekst over et mørkt overlegg, og lagreknappen på overlegget – som før.
    expect(colorOf(within(screen.getByTestId("explore-barcelona")).getByText("Barcelona"))).toBe(colors.onDark);
    expect(flat("save-barcelona")).toMatchObject({ backgroundColor: colors.scrim, width: TOUCH, height: TOUCH });
    const caption = screen.getByTestId("explore-country-barcelona");
    expect(caption).toHaveTextContent("Spania · BCN");
    expect(colorOf(caption)).toBe(colors.textSecondary);
    expect(caption.props.numberOfLines).toBeUndefined();
  });

  it("kartvisningen: lys grunn, lyse områdeknapper (valgt blå), merknaden sekundærfarget; Apple-kartet på sin mørke flate, kortet hvitt", async () => {
    await renderWith(<ExploreScreen />);
    await fireEvent.press(screen.getByTestId("tab-map"));
    await fireEvent(screen.getByTestId("destination-map-frame"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 470 } } });
    expect(flat("explore-screen").backgroundColor).toBe(colors.canvas);
    expect(statusBarStyle()).toBe("dark");
    expect(flat("status-bar-shield").backgroundColor).toBe(colors.canvas);
    expect(colorOf(screen.getByTestId("map-note"))).toBe(colors.textSecondary);
    expect(flat("map-area-europe")).toMatchObject({ backgroundColor: colors.blue, borderColor: colors.blue });
    expect(colorOf(within(screen.getByTestId("map-area-europe")).getByText("Europa og Nord-Afrika"))).toBe(colors.white);
    expect(flat("map-area-asia")).toMatchObject({ backgroundColor: colors.inset, borderColor: colors.lightBorder, minHeight: TOUCH });
    expect(colorOf(within(screen.getByTestId("map-area-asia")).getByText("Asia"))).toBe(colors.text);
    // Kartet selv er som før (mørk, dempet stil); flaten bak det er like mørk, så det ikke blinker lyst.
    expect(flat("explore-map-area").backgroundColor).toBe(colors.bg);
    await fireEvent.press(screen.getByTestId("map-pin-barcelona"));
    expect(flat("map-pin-card").backgroundColor).toBe(colors.white);
    const outsideMap = (id: string) => id === "explore-map-area";
    expect(darkTexts(outsideMap)).toEqual([]);
    expect(graphiteSurfaces(outsideMap)).toEqual([]);
    // Språket: alt utenom kartets egne nåler (Apple-kartet er som før); kortet over kartet er med.
    expect(withoutLanguage("nb-NO", (id) => id === "destination-map-frame")).toEqual([]);
  });

  it("feil og ingen treff: feilen er et lyst varsel; den tomme tilstanden er lys, med en lys «Tøm søket»", async () => {
    // Avreisen har passert: et reisemål gir en feil i stedet for et søk.
    await renderWith(<ExploreScreen />, {}, { departDate: "2026-09-20", returnDate: "2026-09-27" });
    await fireEvent.press(screen.getByTestId("explore-barcelona"));
    expect(flat("explore-error").backgroundColor).toBe(colors.dangerSoft);
    expect(colorOf(within(screen.getByTestId("explore-error")).getByText("Utreisedatoen har passert. Velg en ny dato."))).toBe(colors.danger);

    await fireEvent.changeText(screen.getByTestId("explore-search"), "zzz");
    const empty = within(screen.getByTestId("explore-empty"));
    expect(colorOf(empty.getByText(/^Ingen av våre 24 reisemål/))).toBe(colors.text);
    expect(colorOf(empty.getByText(/^Søket gjelder bare/))).toBe(colors.textSecondary);
    expect(flat("explore-empty-clear")).toMatchObject({ backgroundColor: colors.white, borderColor: colors.lightBorder });
    expect(darkTexts()).toEqual([]);
  });

  it("reserven uten Apple Maps (nettleser) er lys: hvite rader, den valgte svakt blå med blå kant, merknaden sekundærfarget", async () => {
    const { DestinationMap } = jest.requireActual("../components/DestinationMap.tsx") as { DestinationMap: (p: DestinationMapProps) => React.JSX.Element };
    await renderWith(<DestinationMap points={MAP_POINTS} selectedId="dubai" onSelect={() => undefined} bottomInset={0} area="world" areaRequest={0} onLeaveArea={() => undefined} />);
    expect(colorOf(screen.getByText(/^Kartet vises i iPhone-appen/))).toBe(colors.textSecondary);
    expect(flat("map-pin-rome")).toMatchObject({ backgroundColor: colors.white, minHeight: TOUCH });
    expect(colorOf(within(screen.getByTestId("map-pin-rome")).getByText("Roma, Italia"))).toBe(colors.text);
    expect(flat("map-pin-dubai")).toMatchObject({ backgroundColor: colors.blueSoft, borderColor: colors.blue });
    expect(screen.getByTestId("map-pin-dubai")).toBeSelected();
    expect(colorOf(within(screen.getByTestId("map-pin-dubai")).getByText("DXB"))).toBe(colors.white);
    expect(darkTexts()).toEqual([]);
  });
});

describe("Lagret i «Cloud + Graphite»", () => {
  async function renderSaved() {
    __resetLocalStoreForTests(); // som en omstart: det lagrede leses fra filen
    await renderWith(<SavedScreen />);
  }

  it("lys grunn, mørk tittel og statuslinje; overskriftene i tekstfarge; radene er hvite i én gruppe med lyse skiller", async () => {
    writePref("saved", [{ id: "london", iata: "LHR" }, { id: "barcelona", iata: "BCN" }]);
    writePref("recent", [
      { ...initialForm(), origin: OSL, destination: BCN, departDate: day(-10), returnDate: day(-3) },
      { ...initialForm(), origin: BGO, destination: LHR, departDate: day(30), returnDate: day(37) },
    ]);
    await renderSaved();
    expect(flat("saved-screen").backgroundColor).toBe(colors.canvas);
    expect(colorOf(screen.getByTestId("saved-title"))).toBe(colors.text);
    expect(colorOf(screen.getByTestId("saved-note"))).toBe(colors.textSecondary);
    expect(statusBarStyle()).toBe("dark");
    expect(flat("status-bar-shield")).toMatchObject({ height: TOP, backgroundColor: colors.canvas });
    for (const id of ["saved-destinations-title", "recent-title"]) expect(colorOf(screen.getByTestId(id))).toBe(colors.text);

    // Én hvit gruppe per seksjon; skillet (lyst) står bare mellom radene.
    expect(flat("saved-destinations-list")).toMatchObject({ backgroundColor: colors.white, borderRadius: radius.input });
    expect(flat("recent-list")).toMatchObject({ backgroundColor: colors.white, borderRadius: radius.input });
    expect(["saved-london", "saved-barcelona"].map((id) => flat(id).borderTopColor).filter(Boolean)).toEqual([colors.lightBorder]);

    const use = within(screen.getByTestId("saved-use-london"));
    expect(colorOf(use.getByText("London, Storbritannia"))).toBe(colors.text);
    expect(colorOf(screen.getByTestId("saved-airport-london"))).toBe(colors.textSecondary);
    expect(colorOf(use.getByText("Bruk i søket"))).toBe(colors.blue);
    expect(colorOf(within(screen.getByTestId(`recent-again-BGO-LHR-${day(30)}`)).getByText("Søk igjen"))).toBe(colors.blue);
    expect(colorOf(within(screen.getByTestId(`recent-past-OSL-BCN-${day(-10)}`)).getByText("Datoene har passert"))).toBe(colors.warning);

    // «Fjern»: en egen 44 pt-knapp ved siden av raden, uten hitSlop inn over radens knapp.
    for (const id of ["saved-remove-london", `recent-remove-BGO-LHR-${day(30)}`]) {
      const remove = screen.getByTestId(id);
      expect(flat(id)).toMatchObject({ width: TOUCH, height: TOUCH });
      expect(remove.props.hitSlop).toBeUndefined();
      expect(remove).toHaveProp("accessibilityRole", "button");
      expect(remove).toHaveProp("accessibilityLanguage", "nb-NO");
    }
    expect(darkTexts()).toEqual([]);
    expect(graphiteSurfaces()).toEqual([]);
    expect(withoutLanguage("nb-NO")).toEqual([]);
  });

  it("«Om Lagret» er en lys ikonknapp – svakt blå når forklaringen er åpen – og forklaringen står i et hvitt kort", async () => {
    await renderSaved();
    expect(flat("saved-info")).toMatchObject({ backgroundColor: colors.white, borderColor: colors.lightBorder, width: TOUCH, height: TOUCH });
    await fireEvent.press(screen.getByTestId("saved-info"));
    expect(screen.getByTestId("saved-info")).toHaveProp("accessibilityState", { expanded: true });
    expect(flat("saved-info")).toMatchObject({ backgroundColor: colors.blueSoft, borderColor: colors.blue });
    expect(flat("saved-note-detail").backgroundColor).toBe(colors.white);
    expect(colorOf(within(screen.getByTestId("saved-note-detail")).getByText(/^Lagres bare på denne telefonen/))).toBe(colors.textSecondary);
  });

  it("tomme seksjoner er hvite kort med sekundærtekst; «Gå til Utforsk» er en blå lenke", async () => {
    await renderSaved();
    expect(flat("saved-destinations-empty").backgroundColor).toBe(colors.white);
    expect(colorOf(within(screen.getByTestId("saved-destinations-empty")).getByText(/^Ingen lagrede reisemål ennå/))).toBe(colors.textSecondary);
    expect(colorOf(within(screen.getByTestId("saved-to-explore")).getByText("Gå til Utforsk"))).toBe(colors.blue);
    expect(flat("recent-empty").backgroundColor).toBe(colors.white);
    expect(colorOf(within(screen.getByTestId("recent-empty")).getByText("Søk du kjører, vises her."))).toBe(colors.textSecondary);
    expect(darkTexts()).toEqual([]);
    expect(graphiteSurfaces()).toEqual([]);
    expect(withoutLanguage("nb-NO")).toEqual([]);
  });
});

describe("Hotell i «Cloud + Graphite»", () => {
  it("hotellsøket: lys grunn og tittellinje med lys tilbakeknapp; skjemaet og «Søk hotell» i et hvitt kort", async () => {
    await renderWith(<HotelSearchScreen />, { "hotels.status": () => ({ data: STATUS_LIVE }) });
    await waitFor(() => expect(screen.getByTestId("hotel-form")).toBeOnTheScreen());
    expect(flat("hotel-search-screen").backgroundColor).toBe(colors.canvas);
    expect(statusBarStyle()).toBe("dark");
    expect(flat("header-back")).toMatchObject({ backgroundColor: colors.white, borderColor: colors.lightBorder });
    expect(colorOf(screen.getByRole("header", { name: "Hotell" }))).toBe(colors.text);
    expect(colorOf(screen.getByRole("header", { name: "Finn hotell" }))).toBe(colors.text);
    expect(flat("hotel-form-card")).toMatchObject({ backgroundColor: colors.white, borderRadius: radius.card });
    const card = within(screen.getByTestId("hotel-form-card"));
    for (const id of ["hotel-place-query", "hotel-checkin", "hotel-checkout", "hotel-guests", "hotel-search-button"]) expect(card.getByTestId(id)).toBeOnTheScreen();
    expect(colorOf(screen.getByTestId("hotel-search-disclosure"))).toBe(colors.textSecondary);
    expect(darkTexts()).toEqual([]);
    expect(graphiteSurfaces()).toEqual([]);
    expect(withoutLanguage("nb-NO")).toEqual([]);
  });

  it("hotellsøket er av: en lys tilstand med nettets hotellforespørsel – fortsatt uten skjema", async () => {
    await renderWith(<HotelSearchScreen />, { "hotels.status": () => ({ data: STATUS_OFF }) });
    await waitFor(() => expect(screen.getByTestId("hotels-disabled")).toBeOnTheScreen());
    expect(flat("hotel-search-screen").backgroundColor).toBe(colors.canvas);
    expect(colorOf(screen.getByRole("header", { name: "Hotellsøk er ikke tilgjengelig i appen ennå" }))).toBe(colors.text);
    expect(flat("hotels-inquiry").backgroundColor).toBe(colors.blue);
    expect(screen.queryByTestId("hotel-form-card")).toBeNull();
    expect(darkTexts()).toEqual([]);
    expect(graphiteSurfaces()).toEqual([]);
    expect(withoutLanguage("nb-NO")).toEqual([]);
  });

  it("hotellresultater: lys tittellinje uten linjegrense, meldingene i én hvit flate, lyse sorteringsbrikker og hvite kort", async () => {
    setParams(STAY);
    await renderWith(<HotelResultsScreen />, { "hotels.search": () => ({ data: { ...HOTEL_RESULT, sandbox: true } }) });
    await waitFor(() => expect(screen.getByTestId("hotel-results-count")).toBeOnTheScreen());
    expect(flat("hotel-results-screen").backgroundColor).toBe(colors.canvas);
    expect(statusBarStyle()).toBe("dark");
    for (const id of ["header-back", "hotel-edit-search"]) expect(flat(id)).toMatchObject({ backgroundColor: colors.white, borderColor: colors.lightBorder });
    const title = within(screen.getByTestId("hotel-results-header")).getByRole("header");
    expect(title).toHaveTextContent("London, England, Storbritannia");
    expect(colorOf(title)).toBe(colors.text);
    expect(title.props.numberOfLines).toBeUndefined();
    expect(colorOf(screen.getByTestId("hotel-stay-line"))).toBe(colors.textSecondary);
    expect(flat("hotel-notices").backgroundColor).toBe(colors.white);
    expect(colorOf(within(screen.getByTestId("hotel-sandbox-notice")).getByText(/prisene er ikke ekte/))).toBe(colors.warning);
    expect(colorOf(screen.getByTestId("hotel-results-count"))).toBe(colors.text);
    expect(flat("hotel-sort-recommended").backgroundColor).toBe(colors.blue);
    expect(flat("hotel-sort-price")).toMatchObject({ backgroundColor: colors.inset, borderColor: colors.lightBorder });
    expect(flat(`hotel-${HOTEL_A.key}`).backgroundColor).toBe(colors.white);
    expect(colorOf(screen.getByTestId("hotel-disclosure"))).toBe(colors.textSecondary);
    expect(darkTexts()).toEqual([]);
    expect(graphiteSurfaces()).toEqual([]);
    expect(withoutLanguage("nb-NO")).toEqual([]);
  });

  it("hotellresultater under lasting: lys tilstand med en lys «Avbryt»", async () => {
    setParams(STAY);
    // Leverandøren svarer aldri: skjermen står i lastetilstanden.
    await renderWith(<HotelResultsScreen />, { "hotels.search": (() => new Promise(() => undefined)) as unknown as () => Promise<never> });
    expect(screen.getByTestId("hotel-results-loading")).toBeOnTheScreen();
    expect(colorOf(within(screen.getByTestId("hotel-results-loading")).getByRole("header"))).toBe(colors.text);
    expect(flat("hotel-search-cancel")).toMatchObject({ backgroundColor: colors.white, borderColor: colors.lightBorder });
    expect(darkTexts()).toEqual([]);
    expect(graphiteSurfaces()).toEqual([]);
    expect(withoutLanguage("nb-NO")).toEqual([]);
  });

  it("hotellresultater ved feil: lys tilstand, blå «Prøv igjen» og en lys hotellforespørsel", async () => {
    setParams(STAY);
    await renderWith(<HotelResultsScreen />, { "hotels.search": () => ({ status: 503, error: { message: "x", appCode: "SUPPLIER_UNAVAILABLE" } }) });
    await waitFor(() => expect(screen.getByTestId("hotel-results-error")).toBeOnTheScreen());
    expect(colorOf(within(screen.getByTestId("hotel-results-error")).getByRole("header"))).toBe(colors.text);
    expect(flat("hotel-results-retry").backgroundColor).toBe(colors.blue);
    expect(flat("hotel-results-inquiry")).toMatchObject({ backgroundColor: colors.white, borderColor: colors.lightBorder });
    expect(darkTexts()).toEqual([]);
    expect(graphiteSurfaces()).toEqual([]);
    expect(withoutLanguage("nb-NO")).toEqual([]);
  });

  it("hotelldetaljer: lys tittellinje; bildet og fakta i ett hvitt kort; lyse meldinger og hvite seksjoner – ingen grafittlinje nederst", async () => {
    setParams({ ...STAY, hotell: HOTEL_A.key });
    await renderWith(<HotelDetailScreen />, { "hotels.status": () => ({ data: STATUS_SANDBOX }), "hotels.detail": () => ({ data: { ...HOTEL_DETAIL, sandbox: true } }) });
    await waitFor(() => expect(screen.getByTestId("hotel-detail-sandbox")).toBeOnTheScreen());
    expect(flat("hotel-detail-screen").backgroundColor).toBe(colors.canvas);
    expect(statusBarStyle()).toBe("dark");
    expect(flat("header-back")).toMatchObject({ backgroundColor: colors.white, borderColor: colors.lightBorder });
    expect(colorOf(screen.getByRole("header", { name: "Hotell" }))).toBe(colors.text);
    const summary = within(screen.getByTestId("hotel-detail-summary"));
    expect(flat("hotel-detail-summary")).toMatchObject({ backgroundColor: colors.white, borderRadius: radius.card });
    expect(summary.getByTestId("hotel-detail-stay")).toBeOnTheScreen();
    expect(colorOf(summary.getByRole("header"))).toBe(colors.text);
    expect(colorOf(screen.getByTestId("hotel-detail-stay"))).toBe(colors.textSecondary);
    expect(colorOf(within(screen.getByTestId("hotel-map")).getByText("Vis på kart"))).toBe(colors.blue);
    expect(flat("hotel-detail-sandbox").backgroundColor).toBe(colors.warningSoft);
    expect(flat("hotel-rates").backgroundColor).toBe(colors.white);
    expect(colorOf(screen.getByTestId("hotel-detail-disclosure"))).toBe(colors.textSecondary);
    expect(darkTexts()).toEqual([]);
    expect(graphiteSurfaces()).toEqual([]);
    expect(withoutLanguage("nb-NO")).toEqual([]);
  });

  it("hotelldetaljer når statusen ikke kunne hentes: lys feilmelding og en lys «Prøv igjen»", async () => {
    setParams({ ...STAY, hotell: HOTEL_A.key });
    await renderWith(<HotelDetailScreen />, { "hotels.status": () => ({ status: 503, error: { message: "x", appCode: "SUPPLIER_UNAVAILABLE" } }), "hotels.detail": () => ({ data: HOTEL_DETAIL }) });
    await waitFor(() => expect(screen.getByTestId("hotel-detail-status-error")).toBeOnTheScreen());
    expect(flat("hotel-detail-status-error").backgroundColor).toBe(colors.dangerSoft);
    expect(flat("hotel-detail-status-retry")).toMatchObject({ backgroundColor: colors.white, borderColor: colors.lightBorder });
    expect(darkTexts()).toEqual([]);
    expect(graphiteSurfaces()).toEqual([]);
    expect(withoutLanguage("nb-NO")).toEqual([]);
  });
});
