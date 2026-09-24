import fs from "fs";
import path from "path";
import { PixelRatio, Text } from "react-native";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { SEARCH_RESULT } from "../test/fixtures";
import { DESTINATIONS } from "../lib/destinations";
import { AIRPORT_COORDINATES, MAP_POINTS, areaRegion, pointsIn } from "../lib/destinationMap";
import ExploreScreen from "../app/(tabs)/utforsk";
import type { DestinationMapProps } from "../components/DestinationMap";

// Utforsk som liste og kart: ekte skjerm, ekte app-tilstand og ekte API-klient.
// Kartet (react-native-maps) er byttet ut med View-er i jest.setup.tsx – dette
// prøver appens oppførsel, ikke Apple Maps selv.

const router = (globalThis as unknown as { __router: { push: jest.Mock } }).__router;
const animateToRegion = (jest.requireMock("react-native-maps") as { __animateToRegion: jest.Mock }).__animateToRegion;
const SIZE = { width: 390, height: 470 };
type MapProps = { initialRegion: unknown; mapPadding: { bottom: number }; onRegionChangeComplete: (r: unknown) => void };

type AirportMeta = { i: string; la: number; lo: number; c: string };
const REGISTER: AirportMeta[] = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../../api/data/airports-meta.json"), "utf8"));

function setup() {
  const server = fakeServer({ "mobileAuth.me": () => ({ data: null }), "flights.search": () => ({ data: SEARCH_RESULT }) });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  return { server, factory };
}

/** Viser skjemaet slik søket ser det, og lar testen sette fra-flyplassen. */
function FormProbe() {
  const { form, setForm } = useApp();
  return (
    <>
      <Text testID="probe">{`${form.origin?.iata ?? "-"}→${form.destination?.iata ?? "-"} ${form.departDate}/${form.returnDate} ${form.adults}`}</Text>
      <Text testID="probe-set-tos" onPress={() => setForm((f) => ({ ...f, origin: { iata: "TOS", name: "Tromsø lufthavn", city: "Tromsø", country: "Norge" } }))}>
        tos
      </Text>
    </>
  );
}

async function renderExplore(locale: "nb" | "en" = "nb") {
  const { server, factory } = setup();
  await render(
    <AppProvider initialLocale={locale} apiFactory={factory}>
      <ExploreScreen />
      <FormProbe />
    </AppProvider>,
  );
  return server;
}

// Vanlig tekststørrelse (Jest-oppsettet til React Native sier 2); stor tekst prøves for seg.
let fontScale: jest.SpyInstance;
beforeEach(() => {
  animateToRegion.mockClear();
  fontScale = jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(1);
});
afterEach(() => fontScale.mockRestore());

/** Åpner kartet og gir det en størrelse (som på en 390 pt iPhone); først da tegnes Apple-kartet. */
async function openMap() {
  await fireEvent.press(screen.getByTestId("tab-map"));
  await fireEvent(screen.getByTestId("destination-map-frame"), "layout", { nativeEvent: { layout: { x: 0, y: 0, ...SIZE } } });
}
const mapProps = () => (screen.getByTestId("destination-map").props as { mapProps: MapProps }).mapProps;
/** Alle flyplassene på kartet, enten som egen nål eller i en gruppe. */
const shownAirports = () => [
  ...screen.getAllByTestId(/^map-pin-(?!card|city|airport|search|close)/).map((n) => n.props.testID.slice(8) as string),
  ...screen.queryAllByTestId(/^map-group-/).flatMap((n) => (n.props.testID.slice(10) as string).split("+")),
];

describe("kartets reisemål: ekte flyplasskoordinater", () => {
  it("hvert reisemål har en nål, på nøyaktig flyplassen søket bruker (OurAirports-registeret)", () => {
    expect(MAP_POINTS).toHaveLength(DESTINATIONS.length);
    expect(Object.keys(AIRPORT_COORDINATES).sort()).toEqual(DESTINATIONS.map((d) => d.iata).sort());
    for (const p of MAP_POINTS) {
      const a = REGISTER.find((x) => x.i === p.destination.iata);
      expect(a).toBeDefined();
      expect(p.latitude).toBeCloseTo(a!.la, 4);
      expect(p.longitude).toBeCloseTo(a!.lo, 4);
    }
  });

  it("dekker hele verden – fra New York til Tokyo, fra Tromsø til Colombo", () => {
    const lng = MAP_POINTS.map((p) => p.longitude);
    const lat = MAP_POINTS.map((p) => p.latitude);
    expect(Math.min(...lng)).toBeLessThan(-70);
    expect(Math.max(...lng)).toBeGreaterThan(135);
    expect(Math.max(...lat)).toBeGreaterThan(69);
    expect(Math.min(...lat)).toBeLessThan(8);
  });
});

describe("Utforsk: liste og kart", () => {
  it("listen er standard; kartet åpner i Europa med nøyaktige flyplassnåler, uten priser – og ingen reisemål er borte", async () => {
    await renderExplore();
    expect(screen.getByTestId("tab-list")).toBeSelected();
    expect(screen.getByTestId("explore-barcelona")).toBeOnTheScreen();
    expect(screen.queryByTestId("destination-map")).toBeNull();

    await openMap();
    expect(screen.getByTestId("tab-map")).toBeSelected();
    expect(screen.getByLabelText("Verdenskart med HelloSkys reisemål")).toBeOnTheScreen();
    // Europa – ikke hele verden på én gang.
    expect(mapProps().initialRegion).toEqual(areaRegion("europe", SIZE));
    expect(screen.getByTestId("map-area-europe")).toBeSelected();
    expect(screen.getByTestId("map-area-world")).not.toBeSelected();
    // Alle 24 er der (egne nåler eller grupper), hver én gang.
    expect(shownAirports().sort()).toEqual(DESTINATIONS.map((d) => d.id).sort());
    // Nålen står på nøyaktig flyplassen søket bruker.
    expect(screen.getByTestId("map-pin-barcelona")).toHaveProp("coordinate", AIRPORT_COORDINATES.BCN);
    expect(screen.getByTestId("map-pin-barcelona")).toHaveProp("accessibilityLabel", "Barcelona, BCN, reisemål");
    expect(screen.getByTestId("map-pin-nyc")).toHaveProp("accessibilityLabel", "New York, JFK, reisemål");
    expect(screen.getByTestId("map-note")).toHaveTextContent("Nålene er reisemål, ikke priser. Prisene ser du etter at du har søkt.");
    expect(screen.queryByText(/\bkr\b|NOK/)).toBeNull();
    expect(screen.queryByTestId("map-pin-card")).toBeNull();
  });

  it("områdeknappene: tydelige navn og antall for skjermleser, flytter kartet, og hele verden er alltid ett trykk unna", async () => {
    await renderExplore();
    const draft = screen.getByTestId("probe").props.children as string;
    await openMap();
    expect(screen.getByTestId("map-area-europe")).toHaveProp("accessibilityLabel", "Europa og Nord-Afrika, 11 reisemål");
    expect(screen.getByTestId("map-area-middleEast")).toHaveProp("accessibilityLabel", "Midtøsten, 5 reisemål");
    expect(screen.getByTestId("map-area-asia")).toHaveProp("accessibilityLabel", "Asia, 7 reisemål");
    expect(screen.getByTestId("map-area-americas")).toHaveProp("accessibilityLabel", "Nord-Amerika, 1 reisemål");
    expect(screen.getByTestId("map-area-world")).toHaveProp("accessibilityLabel", "Hele verden, 24 reisemål");
    expect(screen.getByTestId("map-area-world")).toHaveProp("accessibilityRole", "button");

    await fireEvent.press(screen.getByTestId("map-area-asia"));
    expect(animateToRegion).toHaveBeenLastCalledWith(areaRegion("asia", SIZE), 450);
    expect(screen.getByTestId("map-area-asia")).toBeSelected();
    expect(screen.getByTestId("map-area-europe")).not.toBeSelected();
    await fireEvent.press(screen.getByTestId("map-area-world"));
    expect(animateToRegion).toHaveBeenLastCalledWith(areaRegion("world", SIZE), 450);
    // Samme knapp igjen flytter kartet tilbake (etter at kunden har dratt bort).
    await fireEvent.press(screen.getByTestId("map-area-world"));
    expect(animateToRegion).toHaveBeenCalledTimes(3);
    // Områdene endrer bare kartet – aldri søkeutkastet.
    expect(screen.getByTestId("probe").props.children).toBe(draft);
  });

  it("drar kunden kartet bort fra området, er ingen områdeknapp lenger valgt", async () => {
    await renderExplore();
    await openMap();
    const e = areaRegion("europe", SIZE);
    await act(() => mapProps().onRegionChangeComplete({ ...e, latitude: e.latitude - 1 }));
    expect(screen.getByTestId("map-area-europe")).toBeSelected();
    await act(() => mapProps().onRegionChangeComplete({ ...e, longitude: 100 }));
    expect(screen.getByTestId("map-area-europe")).not.toBeSelected();
  });

  it("nære flyplasser blir én gruppe på en ekte flyplass; trykk zoomer inn, og så kan hver velges", async () => {
    await renderExplore();
    await openMap();
    await fireEvent.press(screen.getByTestId("map-area-middleEast"));
    await act(() => mapProps().onRegionChangeComplete(areaRegion("middleEast", SIZE)));
    const group = screen.getAllByTestId(/^map-group-/).find((n) => (n.props.testID as string).includes("sulaymaniyah"))!;
    expect(group.props.testID).toMatch(/erbil/);
    expect(group).toHaveProp("accessibilityLabel", expect.stringMatching(/^\d reisemål tett sammen: .*Erbil \(EBL\).*Sulaymaniyah \(ISU\)/));
    expect(group).toHaveProp("accessibilityHint", "Zoomer inn så du kan velge ett");
    expect(group).toHaveProp("coordinate", expect.objectContaining({ latitude: expect.any(Number) }));
    const lead = (group.props.testID as string).slice(10).split("+")[0]!;
    expect(group.props.coordinate).toEqual(AIRPORT_COORDINATES[MAP_POINTS.find((p) => p.destination.id === lead)!.destination.iata]);

    // Trykk: nærmere (minst 3×), og området er ikke lenger «valgt».
    const before = animateToRegion.mock.calls.length;
    await fireEvent.press(group);
    const zoom = animateToRegion.mock.calls[before]![0] as { longitudeDelta: number };
    expect(zoom.longitudeDelta).toBeLessThanOrEqual(areaRegion("middleEast", SIZE).longitudeDelta / 3 + 1e-9);
    expect(screen.getByTestId("map-area-middleEast")).not.toBeSelected();
    // Kartet melder det nye utsnittet; zoom igjen om nødvendig, til Erbil og Sulaymaniyah er egne nåler.
    await act(() => mapProps().onRegionChangeComplete(zoom));
    const again = screen.queryAllByTestId(/^map-group-/).find((n) => (n.props.testID as string).includes("sulaymaniyah"));
    if (again) {
      await fireEvent.press(again);
      await act(() => mapProps().onRegionChangeComplete(animateToRegion.mock.calls.at(-1)![0]));
    }
    expect(screen.getByTestId("map-pin-erbil")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("map-pin-sulaymaniyah"));
    expect(screen.getByTestId("map-pin-airport")).toHaveTextContent("Sulaymaniyah internasjonale lufthavn (ISU)");
    expect(screen.getByTestId("map-pin-sulaymaniyah")).toBeSelected();
  });

  it("kortet ligger over kartet: kartet krymper ikke, Apple-merket flyttes over kortet, og en skjult nål flyttes fram", async () => {
    await renderExplore();
    await openMap();
    await fireEvent.press(screen.getByTestId("map-pin-barcelona"));
    const cardScroll = screen.getByTestId("map-pin-card-scroll");
    expect(cardScroll).toHaveStyle({ position: "absolute", bottom: 0 });
    // Kartets ramme fyller fortsatt hele kartflaten (absoluteFill), kortet tar ingen plass fra den.
    expect(screen.getByTestId("destination-map-frame")).toHaveStyle({ position: "absolute", top: 0, bottom: 0 });
    expect(mapProps().mapPadding.bottom).toBe(0);
    await fireEvent(cardScroll, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 190 } } });
    expect(mapProps().mapPadding.bottom).toBe(190);
    // Barcelona (sør i Europa) lå under kortet: kartet flyttes med samme zoom, så nålen står over kortet.
    const moved = animateToRegion.mock.calls.at(-1)![0] as { longitude: number; longitudeDelta: number };
    expect(moved.longitude).toBeCloseTo(AIRPORT_COORDINATES.BCN!.longitude, 4);
    expect(moved.longitudeDelta).toBeCloseTo(areaRegion("europe", SIZE).longitudeDelta, 6);
    // Lukk: ingen dekning igjen.
    await fireEvent.press(screen.getByTestId("map-pin-close"));
    expect(mapProps().mapPadding.bottom).toBe(0);
  });

  it("stor tekst: nålene blir større, så flere slås sammen – men alle reisemålene er fortsatt på kartet", async () => {
    fontScale.mockReturnValue(1.4);
    await renderExplore();
    await openMap();
    const large = screen.queryAllByTestId(/^map-group-/).length;
    expect(shownAirports().sort()).toEqual(DESTINATIONS.map((d) => d.id).sort());
    fontScale.mockReturnValue(1);
    await act(() => mapProps().onRegionChangeComplete(areaRegion("europe", SIZE)));
    await fireEvent.press(screen.getByTestId("tab-list"));
    await openMap();
    expect(screen.queryAllByTestId(/^map-group-/).length).toBeLessThanOrEqual(large);
  });

  it("Tromsø er ikke borte: en knapp med navn øverst på kartet velger nøyaktig Tromsø lufthavn, og kartet flyttes dit", async () => {
    await renderExplore();
    const draft = screen.getByTestId("probe").props.children as string;
    await openMap();
    // Europa åpner på resten av Europa; Tromsø har en egen knapp.
    const tos = screen.getByTestId("map-off-tromso");
    expect(tos).toHaveTextContent("↑ Tromsø (TOS)");
    expect(tos).toHaveProp("accessibilityLabel", "Tromsø, TOS, reisemål utenfor kartet");
    expect(tos).toHaveProp("accessibilityRole", "button");
    await fireEvent.press(tos);
    expect(screen.getByTestId("map-pin-airport")).toHaveTextContent("Tromsø lufthavn (TOS)");
    // Med kortet åpent er knappen borte (for lite plass); den kommer tilbake når kortet lukkes.
    expect(screen.queryByTestId("map-off-tromso")).toBeNull();
    await fireEvent(screen.getByTestId("map-pin-card-scroll"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 190 } } });
    const moved = animateToRegion.mock.calls.at(-1)![0] as { longitude: number };
    expect(moved.longitude).toBeCloseTo(AIRPORT_COORDINATES.TOS!.longitude, 4);
    // Området er fortsatt Europa (kartets egen flytting), og utkastet er urørt.
    await act(() => mapProps().onRegionChangeComplete(moved));
    expect(screen.getByTestId("map-area-europe")).toBeSelected();
    expect(screen.getByTestId("probe").props.children).toBe(draft);
    await fireEvent.press(screen.getByTestId("map-pin-close"));
    await fireEvent.press(screen.getByTestId("map-area-europe"));
    await act(() => mapProps().onRegionChangeComplete(areaRegion("europe", SIZE)));
    expect(screen.getByTestId("map-off-tromso")).toBeOnTheScreen();
  });

  it("den valgte nålen dekkes aldri: zoomer kunden ut, tar den naboene inn («BCN +N», valgt), og et trykk zoomer inn igjen", async () => {
    await renderExplore();
    await openMap();
    await fireEvent.press(screen.getByTestId("map-pin-barcelona"));
    await act(() => mapProps().onRegionChangeComplete(areaRegion("world", SIZE)));
    const sel = screen.getAllByTestId(/^map-group-barcelona\+/);
    expect(sel).toHaveLength(1);
    expect(sel[0]).toBeSelected();
    expect(sel[0]).toHaveProp("accessibilityLabel", expect.stringMatching(/^Barcelona, BCN, reisemål, valgt\. Tett ved: .*London \(LHR\)/));
    expect(sel[0]).toHaveProp("accessibilityHint", "Zoomer inn så du kan velge ett");
    // Ingen annen nål eller gruppe inneholder Barcelona.
    expect(shownAirports().filter((id) => id === "barcelona")).toHaveLength(1);
    const before = animateToRegion.mock.calls.length;
    await fireEvent.press(sel[0]!);
    expect((animateToRegion.mock.calls[before]![0] as { longitudeDelta: number }).longitudeDelta).toBeLessThanOrEqual(areaRegion("world", SIZE).longitudeDelta / 3 + 1e-9);
    expect(screen.getByTestId("map-pin-card")).toBeOnTheScreen();
  });

  it("bytte område lukker et valgt reisemål som ville havnet utenfor; innenfor blir det stående", async () => {
    await renderExplore();
    await openMap();
    await fireEvent.press(screen.getByTestId("map-pin-barcelona"));
    await fireEvent.press(screen.getByTestId("map-area-world"));
    expect(screen.getByTestId("map-pin-card")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("map-area-europe"));
    expect(screen.getByTestId("map-pin-card")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("map-area-asia"));
    expect(screen.queryByTestId("map-pin-card")).toBeNull();
    expect(pointsIn("asia").some((p) => p.destination.id === "barcelona")).toBe(false);
  });

  it("en nål viser by, land, flyplass og IATA; «Se flyreiser» søker med skjemaets fra-flyplass, datoer og reisende", async () => {
    const server = await renderExplore();
    const before = screen.getByTestId("probe").props.children as string;
    await openMap();
    await fireEvent.press(screen.getByTestId("map-pin-barcelona"));
    const card = within(screen.getByTestId("map-pin-card"));
    expect(card.getByText("Reisemål")).toBeOnTheScreen();
    expect(screen.getByTestId("map-pin-city")).toHaveTextContent("Barcelona Spania");
    expect(card.getByText("Spania")).toBeOnTheScreen();
    expect(screen.getByTestId("map-pin-airport")).toHaveTextContent("Barcelona-El Prat (BCN)");
    expect(card.getByText("Ingen pris før du søker med dine datoer og reisende.")).toBeOnTheScreen();
    expect(screen.getByTestId("map-pin-search")).toHaveProp("accessibilityLabel", "Se flyreiser til Barcelona, Barcelona-El Prat (BCN)");

    await fireEvent.press(screen.getByTestId("map-pin-search"));
    expect(router.push).toHaveBeenCalledWith("/resultater");
    // Bare reisemålet er byttet; fra-flyplass, datoer og reisende er de samme som før.
    const after = screen.getByTestId("probe").props.children as string;
    expect(after.replace("→BCN", "→-")).toBe(before.replace(/→\S+/, "→-"));
    expect(after).toMatch(/^OSL→BCN /);
    await waitFor(() => expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(1));
    const input = server.calls.find((c) => c.path === "flights.search")!.input as { slices: { origin: string; destination: string }[] };
    expect(input.slices[0]).toMatchObject({ origin: "OSL", destination: "BCN" });
    // Tilbake til Utforsk: kartet og det valgte reisemålet er der fortsatt.
    expect(screen.getByTestId("tab-map")).toBeSelected();
    expect(screen.getByTestId("map-pin-card")).toBeOnTheScreen();
  });

  it("ugyldig søk (samme flyplass) sies rett ut på kartet; ingen navigasjon", async () => {
    const server = await renderExplore();
    await fireEvent.press(screen.getByTestId("probe-set-tos"));
    await openMap();
    await fireEvent.press(screen.getByTestId("map-pin-tromso"));
    await fireEvent.press(screen.getByTestId("map-pin-search"));
    expect(screen.getByTestId("explore-error")).toHaveTextContent("Avreise og reisemål kan ikke være samme flyplass.");
    expect(router.push).not.toHaveBeenCalled();
    expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(0);
  });

  it("lukk-knappen fjerner kortet; bytte til listen og tilbake beholder valgt visning", async () => {
    await renderExplore();
    await openMap();
    await fireEvent.press(screen.getByTestId("map-pin-tokyo"));
    expect(screen.getByTestId("map-pin-airport")).toHaveTextContent("Tokyo Haneda (HND)");
    await fireEvent.press(screen.getByTestId("map-pin-close"));
    expect(screen.queryByTestId("map-pin-card")).toBeNull();
    await fireEvent.press(screen.getByTestId("tab-list"));
    expect(screen.getByTestId("explore-tokyo")).toBeOnTheScreen();
    expect(screen.queryByTestId("destination-map")).toBeNull();
  });

  it("engelsk", async () => {
    await renderExplore("en");
    await openMap();
    expect(screen.getByTestId("tab-map")).toHaveTextContent("Map");
    expect(screen.getByTestId("map-pin-rome")).toHaveProp("accessibilityLabel", "Rome, FCO, destination");
    expect(screen.getByTestId("map-area-middleEast")).toHaveProp("accessibilityLabel", "Middle East, 5 destinations");
    expect(screen.getByTestId("map-area-americas")).toHaveProp("accessibilityLabel", "North America, 1 destination");
    await fireEvent.press(screen.getByTestId("map-pin-rome"));
    expect(screen.getByTestId("map-pin-airport")).toHaveTextContent("Rome Fiumicino (FCO)");
    expect(screen.getByTestId("map-pin-search")).toHaveTextContent("See flights");
    expect(screen.getByTestId("map-note")).toHaveTextContent("Pins are destinations, not prices. You see prices after you search.");
  });
});

describe("reserve uten Apple Maps (nettleser)", () => {
  it("laster ikke react-native-maps, sier at kartet er i iPhone-appen, og lar kunden velge samme reisemål", async () => {
    // Den plattformuavhengige filen (brukes på web); iOS-filen er DestinationMap.ios.tsx.
    const src = fs.readFileSync(path.resolve(__dirname, "../components/DestinationMap.tsx"), "utf8");
    expect(src).not.toMatch(/react-native-maps/);
    const { DestinationMap } = jest.requireActual("../components/DestinationMap.tsx") as { DestinationMap: (p: DestinationMapProps) => React.JSX.Element };
    const onSelect = jest.fn();
    const { factory } = setup();
    await render(
      <AppProvider initialLocale="nb" apiFactory={factory}>
        <DestinationMap points={MAP_POINTS} selectedId={null} onSelect={onSelect} bottomInset={0} area="world" areaRequest={0} onLeaveArea={() => undefined} />
      </AppProvider>,
    );
    expect(screen.getByTestId("destination-map-fallback")).toHaveTextContent(/Kartet vises i iPhone-appen/);
    await fireEvent.press(screen.getByTestId("map-pin-dubai"));
    expect(onSelect).toHaveBeenCalledWith("dubai");
  });
});
