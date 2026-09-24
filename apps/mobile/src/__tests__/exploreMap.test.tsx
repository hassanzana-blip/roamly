import fs from "fs";
import path from "path";
import { Text } from "react-native";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { SEARCH_RESULT } from "../test/fixtures";
import { DESTINATIONS } from "../lib/destinations";
import { AIRPORT_COORDINATES, MAP_POINTS } from "../lib/destinationMap";
import ExploreScreen from "../app/(tabs)/utforsk";
import type { DestinationMapProps } from "../components/DestinationMap";

// Utforsk som liste og kart: ekte skjerm, ekte app-tilstand og ekte API-klient.
// Kartet (react-native-maps) er byttet ut med View-er i jest.setup.tsx – dette
// prøver appens oppførsel, ikke Apple Maps selv.

const router = (globalThis as unknown as { __router: { push: jest.Mock } }).__router;
const fitToCoordinates = (jest.requireMock("react-native-maps") as { __fitToCoordinates: jest.Mock }).__fitToCoordinates;

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

beforeEach(() => fitToCoordinates.mockClear());

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
  it("listen er standard; kartet viser alle reisemål som nåler merket «reisemål», uten priser", async () => {
    await renderExplore();
    expect(screen.getByTestId("tab-list")).toBeSelected();
    expect(screen.getByTestId("explore-barcelona")).toBeOnTheScreen();
    expect(screen.queryByTestId("destination-map")).toBeNull();

    await fireEvent.press(screen.getByTestId("tab-map"));
    expect(screen.getByTestId("tab-map")).toBeSelected();
    expect(screen.getByLabelText("Verdenskart med HelloSkys reisemål")).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^map-pin-/)).toHaveLength(DESTINATIONS.length);
    expect(screen.getByTestId("map-pin-barcelona")).toHaveProp("accessibilityLabel", "Barcelona, BCN, reisemål");
    expect(screen.getByTestId("map-pin-nyc")).toHaveProp("accessibilityLabel", "New York, JFK, reisemål");
    expect(screen.getByTestId("map-note")).toHaveTextContent("Nålene er reisemål, ikke priser. Prisene ser du etter at du har søkt.");
    expect(screen.queryByText(/\bkr\b|NOK/)).toBeNull();
    // Kartet tilpasses alle nålene når det er klart.
    expect(fitToCoordinates).toHaveBeenCalled();
    expect(fitToCoordinates.mock.calls[0]![0]).toHaveLength(DESTINATIONS.length);
    expect(screen.queryByTestId("map-pin-card")).toBeNull();
  });

  it("en nål viser by, land, flyplass og IATA; «Se flyreiser» søker med skjemaets fra-flyplass, datoer og reisende", async () => {
    const server = await renderExplore();
    const before = screen.getByTestId("probe").props.children as string;
    await fireEvent.press(screen.getByTestId("tab-map"));
    await fireEvent.press(screen.getByTestId("map-pin-barcelona"));
    const card = within(screen.getByTestId("map-pin-card"));
    expect(card.getByText("Reisemål")).toBeOnTheScreen();
    expect(screen.getByTestId("map-pin-city")).toHaveTextContent("Barcelona");
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
    await fireEvent.press(screen.getByTestId("tab-map"));
    await fireEvent.press(screen.getByTestId("map-pin-tromso"));
    await fireEvent.press(screen.getByTestId("map-pin-search"));
    expect(screen.getByTestId("explore-error")).toHaveTextContent("Avreise og reisemål kan ikke være samme flyplass.");
    expect(router.push).not.toHaveBeenCalled();
    expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(0);
  });

  it("lukk-knappen fjerner kortet; bytte til listen og tilbake beholder valgt visning", async () => {
    await renderExplore();
    await fireEvent.press(screen.getByTestId("tab-map"));
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
    await fireEvent.press(screen.getByTestId("tab-map"));
    expect(screen.getByTestId("tab-map")).toHaveTextContent("Map");
    expect(screen.getByTestId("map-pin-lisboa")).toHaveProp("accessibilityLabel", "Lisbon, LIS, destination");
    await fireEvent.press(screen.getByTestId("map-pin-lisboa"));
    expect(screen.getByTestId("map-pin-airport")).toHaveTextContent("Lisbon Humberto Delgado (LIS)");
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
        <DestinationMap points={MAP_POINTS} selectedId={null} onSelect={onSelect} bottomInset={0} />
      </AppProvider>,
    );
    expect(screen.getByTestId("destination-map-fallback")).toHaveTextContent(/Kartet vises i iPhone-appen/);
    await fireEvent.press(screen.getByTestId("map-pin-dubai"));
    expect(onSelect).toHaveBeenCalledWith("dubai");
  });
});
