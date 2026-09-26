import { StyleSheet, Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { SEARCH_RESULT } from "../test/fixtures";
import type { SearchForm } from "../lib/searchForm";
import { TOUCH } from "../lib/theme";
import ExploreScreen from "../app/(tabs)/utforsk";
import AirportPicker from "../app/flyplass";

// Utforsk: fra-flyplassen, datoene og de reisende står øverst som knapper og endres der – uten å gå til forsiden. Et
// reisemål søker med det som står der.

const router = (globalThis as unknown as { __router: { push: jest.Mock } }).__router;
const T0 = Date.parse("2026-09-25T10:00:00Z");
const DATES = { departDate: "2026-10-23", returnDate: "2026-10-30" };

function Probe() {
  const { form } = useApp();
  return <Text testID="probe">{`${form.origin?.iata ?? "-"} ${form.departDate}/${form.returnDate}`}</Text>;
}

async function renderExplore({ locale = "nb", initial = DATES }: { locale?: "nb" | "en"; initial?: Partial<SearchForm> } = {}) {
  const server = fakeServer({ "mobileAuth.me": () => ({ data: null }), "flights.search": () => ({ data: SEARCH_RESULT }) });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  await render(
    <AppProvider initialLocale={locale} apiFactory={factory} initial={initial}>
      <ExploreScreen />
      <Probe />
    </AppProvider>,
  );
  return server;
}

beforeEach(() => {
  jest.useFakeTimers({ now: T0, doNotFake: ["nextTick", "queueMicrotask", "setImmediate", "performance"] });
  router.push.mockClear();
});
afterEach(() => jest.useRealTimers());

describe("søket øverst i Utforsk", () => {
  it("fra-flyplassen er en knapp til flyplassøket; datoene en knapp med kort datospenn; reisende en knapp", async () => {
    await renderExplore();
    const origin = screen.getByTestId("context-origin");
    expect(origin).toHaveTextContent("Fra Oslo (OSL)");
    expect(origin).toHaveProp("accessibilityRole", "button");
    expect(origin).toHaveProp("accessibilityHint", "Åpner flyplassøket");
    await fireEvent.press(origin);
    expect(router.push).toHaveBeenCalledWith({ pathname: "/flyplass", params: { felt: "fra" } });

    const dates = screen.getByTestId("context-dates");
    expect(dates).toHaveTextContent("23.–30. okt.");
    expect(dates).toHaveProp("accessibilityLabel", "Avreise fredag 23. oktober 2026, retur fredag 30. oktober 2026, 7 netter");
    expect(dates).toHaveProp("accessibilityHint", "Åpner kalenderen");
    expect(screen.getByTestId("context-travellers")).toHaveTextContent("1 voksen");
    expect(screen.getByTestId("context-travellers")).toHaveProp("accessibilityLabel", "Reisende: 1 voksen");
    expect(screen.getByTestId("context-travellers")).toHaveProp("accessibilityHint", "Åpner reisende og reiseklasse");
  });

  it("reisende og klasse endres i det samme arket som på forsiden; knappen viser det som ikke er standard", async () => {
    const server = await renderExplore();
    await fireEvent.press(screen.getByTestId("context-travellers"));
    expect(screen.getByTestId("travellers-sheet")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Flere voksne"));
    await fireEvent.press(screen.getByText("Business"));
    expect(screen.getByTestId("travellers-summary")).toHaveTextContent("2 voksne · Business");
    await fireEvent.press(screen.getByTestId("travellers-sheet-done"));
    expect(screen.getByTestId("context-travellers")).toHaveTextContent("2 voksne · Business");
    await fireEvent.press(screen.getByTestId("explore-barcelona"));
    const search = server.calls.find((c) => c.path === "flights.search")!.input as { passengers: unknown[]; cabinClass: string };
    expect([search.passengers.length, search.cabinClass]).toEqual([2, "business"]);
  });

  it("knappene er 36 pt høye, med trykkflate på minst 44 pt som raden ikke klipper; første trykk virker med tastaturet oppe", async () => {
    await renderExplore();
    const row = screen.getByTestId("explore-summary");
    const pad = (StyleSheet.flatten(row.props.contentContainerStyle) as { paddingVertical: number }).paddingVertical;
    expect(row).toHaveProp("keyboardShouldPersistTaps", "handled");
    for (const id of ["context-origin", "context-dates", "context-travellers"]) {
      const b = screen.getByTestId(id);
      const style = StyleSheet.flatten(b.props.style) as { minHeight: number };
      expect([id, style.minHeight + 2 * (b.props.hitSlop as number)]).toEqual([id, TOUCH]);
      expect(pad).toBeGreaterThanOrEqual(b.props.hitSlop as number);
    }
  });

  it("feilen fra et reisemål forsvinner når datoene rettes her", async () => {
    // Appen sto åpen over natten: avreisen har passert.
    await renderExplore({ initial: { departDate: "2026-09-20", returnDate: "2026-09-27" } });
    await fireEvent.press(screen.getByTestId("explore-barcelona"));
    expect(screen.getByTestId("explore-error")).toHaveTextContent("Utreisedatoen har passert. Velg en ny dato.");
    await fireEvent.press(screen.getByTestId("context-dates"));
    await fireEvent.press(screen.getByTestId("day-2026-10-09"));
    await fireEvent.press(screen.getByTestId("day-2026-10-16"));
    await fireEvent.press(screen.getByTestId("context-dates-done"));
    expect(screen.queryByTestId("explore-error")).toBeNull();
  });

  it("feilen «velg hvor du reiser fra» forsvinner når fra-flyplassen velges fra knappen", async () => {
    const setParams = (globalThis as unknown as { __setParams: (p: Record<string, string>) => void }).__setParams;
    setParams({ felt: "fra" });
    const server = fakeServer({ "mobileAuth.me": () => ({ data: null }), "flights.airports": () => ({ data: [] }), "flights.search": () => ({ data: SEARCH_RESULT }) });
    const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
    await render(
      <AppProvider initialLocale="nb" apiFactory={factory} initial={{ ...DATES, origin: null }}>
        <ExploreScreen />
        <AirportPicker />
      </AppProvider>,
    );
    await fireEvent.press(screen.getByTestId("explore-barcelona"));
    expect(screen.getByTestId("explore-error")).toHaveTextContent("Velg hvor du reiser fra.");
    await fireEvent.changeText(screen.getByTestId("airport-query"), "bergen");
    await fireEvent.press(screen.getByTestId("airport-BGO"));
    expect(screen.getByTestId("context-origin")).toHaveTextContent("Fra Bergen (BGO)");
    expect(screen.queryByTestId("explore-error")).toBeNull();
  });

  it("datoene endres i kalenderen her, og et reisemål søker med de nye datoene", async () => {
    const server = await renderExplore();
    await fireEvent.press(screen.getByTestId("context-dates"));
    expect(screen.getByTestId("context-calendar")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("day-2026-10-09"));
    await fireEvent.press(screen.getByTestId("day-2026-10-16"));
    await fireEvent.press(screen.getByTestId("context-dates-done"));
    expect(screen.getByTestId("context-dates")).toHaveTextContent("9.–16. okt.");
    expect(screen.getByTestId("probe")).toHaveTextContent("OSL 2026-10-09/2026-10-16");

    await fireEvent.press(screen.getByTestId("explore-barcelona"));
    const search = server.calls.find((c) => c.path === "flights.search")!.input as { slices: { origin: string; departureDate: string }[] };
    expect(search.slices.map((s) => `${s.origin} ${s.departureDate}`)).toEqual(["OSL 2026-10-09", "BCN 2026-10-16"]);
    expect(router.push).toHaveBeenCalledWith("/resultater");
  });

  it("på kartet står de samme knappene", async () => {
    await renderExplore();
    await fireEvent.press(screen.getByTestId("tab-map"));
    expect(screen.getByTestId("context-origin")).toHaveTextContent("Fra Oslo (OSL)");
    await fireEvent.press(screen.getByTestId("context-dates"));
    expect(screen.getByTestId("context-calendar")).toBeOnTheScreen();
  });

  it("uten fra-flyplass ber knappen om en; én vei viser bare avreisen", async () => {
    await renderExplore({ initial: { ...DATES, origin: null, tripType: "oneway" } });
    expect(screen.getByTestId("context-origin")).toHaveTextContent("Velg avreiseflyplass");
    expect(screen.getByTestId("context-dates")).toHaveTextContent("Én vei · 23. okt.");
    expect(screen.getByTestId("context-dates")).toHaveProp("accessibilityLabel", "Avreise fredag 23. oktober 2026");
  });

  it("på engelsk", async () => {
    await renderExplore({ locale: "en" });
    expect(screen.getByTestId("context-origin")).toHaveTextContent("From Oslo (OSL)");
    expect(screen.getByTestId("context-origin")).toHaveProp("accessibilityHint", "Opens the airport search");
    expect(screen.getByTestId("context-dates")).toHaveTextContent("23–30 Oct");
    expect(screen.getByTestId("context-dates")).toHaveProp("accessibilityLabel", "Departure Friday 23 October 2026, return Friday 30 October 2026, 7 nights");
    expect(screen.getByTestId("context-travellers")).toHaveTextContent("1 adult");
    expect(screen.getByTestId("context-travellers")).toHaveProp("accessibilityLabel", "Travellers: 1 adult");
  });
});
