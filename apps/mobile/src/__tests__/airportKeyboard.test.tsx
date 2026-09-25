import { Text } from "react-native";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import type { Airport } from "@contracts/airports";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import AirportPicker from "../app/flyplass";

// Flyplassvelgeren med søkefeltet i fokus og tastaturet oppe (iOS). Jest kan ikke
// vise et tastatur; det som prøves er oppsettet som gjør at alt kan nås over det:
// bare søkefeltet står fast, alt annet ligger i en liste som på iOS slutter der
// tastaturet begynner. Pluss nøyaktig flyplassvalg, utkast og tilbake.

const router = (globalThis as unknown as { __router: { back: jest.Mock } }).__router;
const setParams = (globalThis as unknown as { __setParams: (p: Record<string, string>) => void }).__setParams;

const ap = (iata: string, name: string, city: string): Airport => ({ iata, name, city, country: "Norge", countryCode: "NO", lat: 0, lng: 0 });
const OSL = ap("OSL", "Oslo lufthavn Gardermoen", "Oslo");
const TRF = ap("TRF", "Sandefjord lufthavn Torp", "Sandefjord");

/** Viser skjemaet slik søket ser det. */
function FormProbe() {
  const { form, homeAirport } = useApp();
  return <Text testID="probe">{`${form.origin?.iata ?? "-"}→${form.destination?.iata ?? "-"} ${form.departDate}/${form.returnDate} ${form.adults} home:${homeAirport?.iata ?? "-"}`}</Text>;
}

async function renderPicker(felt: "fra" | "til" = "fra") {
  const server = fakeServer({
    "mobileAuth.me": () => ({ data: null }),
    "flights.airports": (req) => {
      const q = (req.input as { query: string }).query.toLowerCase();
      return { data: q.startsWith("osl") ? [OSL, TRF] : [] };
    },
  });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  setParams({ felt });
  await render(
    <AppProvider initialLocale="nb" apiFactory={factory}>
      <AirportPicker />
      <FormProbe />
    </AppProvider>,
  );
  return server;
}

const list = () => screen.getByTestId("airport-list");
const inList = (testID: string) => within(list()).queryByTestId(testID) !== null;

describe("flyplassvelgeren med tastaturet oppe", () => {
  it("listen slutter over tastaturet på iOS, første trykk velger, og et drag legger bort tastaturet", async () => {
    await renderPicker();
    expect(list()).toHaveProp("automaticallyAdjustKeyboardInsets", true);
    expect(list()).toHaveProp("keyboardShouldPersistTaps", "handled");
    expect(list()).toHaveProp("keyboardDismissMode", "interactive");
  });

  it("bare søkefeltet står fast; forklaring, «husk», forslag og treff ligger i listen og kan rulles fram", async () => {
    await renderPicker();
    expect(inList("airport-query")).toBe(false);
    expect(screen.getByTestId("airport-query")).toBeOnTheScreen();
    expect(inList("airport-list-head")).toBe(true);
    expect(inList("remember-home-airport")).toBe(true);
    expect(inList("airport-suggestions")).toBe(true);
    expect(within(list()).getByText("Vi søker bare fra og til flyplassen du velger – aldri andre flyplasser i samme by.")).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId("airport-query"), "osl");
    // OSL står med én gang (registeret i appen); TRF kommer med serverens svar.
    expect(inList("airport-OSL")).toBe(true);
    await waitFor(() => expect(screen.getByTestId("airport-TRF")).toBeOnTheScreen());
    expect(inList("airport-TRF")).toBe(true);
  });

  it("ingen treff: «Tøm søket» ligger i listen og gir forslagene tilbake", async () => {
    const server = await renderPicker("til");
    await fireEvent.changeText(screen.getByTestId("airport-query"), "zzz");
    await waitFor(() => expect(screen.getByTestId("airport-clear")).toBeOnTheScreen());
    expect(inList("airport-clear")).toBe(true);
    expect(server.calls.filter((c) => c.path === "flights.airports")).toHaveLength(1);
    await fireEvent.press(screen.getByTestId("airport-clear"));
    expect(screen.getByTestId("airport-query")).toHaveProp("value", "");
    expect(inList("airport-suggestions")).toBe(true);
  });

  it("nøyaktig flyplass: OSL gir OSL – ikke TRF – og resten av utkastet er uendret", async () => {
    await renderPicker();
    const before = screen.getByTestId("probe").props.children as string;
    await fireEvent.changeText(screen.getByTestId("airport-query"), "osl");
    await waitFor(() => expect(screen.getByTestId("airport-OSL")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("airport-OSL"));
    const after = screen.getByTestId("probe").props.children as string;
    expect(after).toMatch(/^OSL→/);
    expect(after).not.toMatch(/TRF/);
    expect(after.replace(/^\S+→/, "")).toBe(before.replace(/^\S+→/, ""));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("TRF velges som TRF, og «husk» (nå i listen) fungerer fortsatt", async () => {
    await renderPicker();
    await fireEvent(screen.getByTestId("remember-home-airport"), "valueChange", true);
    await fireEvent.changeText(screen.getByTestId("airport-query"), "osl");
    await waitFor(() => expect(screen.getByTestId("airport-TRF")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("airport-TRF"));
    expect(screen.getByTestId("probe")).toHaveTextContent(/^TRF→.* home:TRF$/);
  });

  it("lukk uten å velge: tilbake, og utkastet er urørt", async () => {
    await renderPicker();
    const before = screen.getByTestId("probe").props.children as string;
    await fireEvent.changeText(screen.getByTestId("airport-query"), "osl");
    await waitFor(() => expect(screen.getByTestId("airport-OSL")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("header-back"));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("probe").props.children).toBe(before);
  });
});
