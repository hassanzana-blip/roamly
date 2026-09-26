import { Dimensions, FlatList, StyleSheet, Text as RNText } from "react-native";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { SEARCH_RESULT } from "../test/fixtures";
import { SearchPanel } from "../components/SearchPanel";

// Kalenderen på forsiden: avreise og retur i ett ark, ett trykk per dato, og skjemaet gyldig etter hvert trykk.
// Klokken står fast (25.09.2026), så «i dag» og passerte dager er de samme uansett når testene kjøres.

const BCN = { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spania" };

function Probe() {
  const { form } = useApp();
  return <RNText testID="probe">{`${form.tripType} ${form.departDate}/${form.returnDate}`}</RNText>;
}

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 8, 25, 10, 0), doNotFake: ["nextTick", "queueMicrotask", "setImmediate", "performance"] });
});
afterEach(() => jest.useRealTimers());

async function renderPanel(initial: Record<string, unknown> = {}, locale: "nb" | "en" = "nb") {
  const server = fakeServer({ "flights.search": () => ({ data: SEARCH_RESULT }) });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  await render(
    <AppProvider initialLocale={locale} apiFactory={factory} initial={{ destination: BCN, departDate: "2026-10-09", returnDate: "2026-10-16", ...initial }}>
      <SearchPanel />
      <Probe />
    </AppProvider>,
  );
}
const probe = () => screen.getByTestId("probe").props.children as string;
/** Månedene listen faktisk har tegnet (den første er der listen åpner). */
const renderedMonths = () => [...new Set(screen.queryAllByTestId(/^month-\d+-\d+$/).map((n) => n.props.testID as string))];

describe("kalenderen på forsiden", () => {
  it("avreise og retur i ett ark: to trykk, båndet og antall netter følger valget", async () => {
    await renderPanel();
    await fireEvent.press(screen.getByTestId("depart-date"));
    expect(screen.getByTestId("calendar")).toBeOnTheScreen();
    expect(screen.getByTestId("calendar-hint")).toHaveTextContent("Velg avreisedato");
    expect(screen.getByTestId("calendar-nights")).toHaveTextContent("7 netter");
    expect(screen.getByTestId("day-2026-10-09").props.accessibilityLabel).toBe("fredag 9. oktober 2026, avreise");
    expect(screen.getByTestId("day-2026-10-12").props.accessibilityLabel).toBe("mandag 12. oktober 2026, mellom avreise og retur");

    await fireEvent.press(screen.getByTestId("day-2026-10-14"));
    expect(probe()).toBe("roundtrip 2026-10-14/2026-10-16");
    expect(screen.getByTestId("calendar-hint")).toHaveTextContent("Velg returdato");
    expect(screen.getByTestId("day-2026-10-14").props.accessibilityHint).toBe("Velger returdato");

    await fireEvent.press(screen.getByTestId("day-2026-10-20"));
    expect(probe()).toBe("roundtrip 2026-10-14/2026-10-20");
    expect(screen.getByTestId("calendar-nights")).toHaveTextContent("6 netter");
    expect(screen.getByTestId("day-2026-10-20").props.accessibilityState).toMatchObject({ selected: true });

    await fireEvent.press(screen.getByTestId("calendar-done-button"));
    expect(within(screen.getByTestId("depart-date")).getByText("ons. 14. okt.")).toBeOnTheScreen();
    expect(within(screen.getByTestId("return-date")).getByText("tir. 20. okt.")).toBeOnTheScreen();
  });

  it("«Retur» åpner kalenderen på retur; en dag før avreisen blir ny avreise", async () => {
    await renderPanel();
    await fireEvent.press(screen.getByTestId("return-date"));
    expect(screen.getByTestId("calendar-hint")).toHaveTextContent("Velg returdato");
    await fireEvent.press(screen.getByTestId("day-2026-10-05"));
    expect(probe()).toBe("roundtrip 2026-10-05/2026-10-16");
    expect(screen.getByTestId("calendar-hint")).toHaveTextContent("Velg returdato");
  });

  it("passerte dager kan ikke velges og sier det; i dag er merket", async () => {
    // Avreise i september: kalenderen åpner på september, der i dag (25.) og passerte dager står.
    await renderPanel({ departDate: "2026-09-28", returnDate: "2026-10-05" });
    await fireEvent.press(screen.getByTestId("depart-date"));
    const past = screen.getByTestId("day-2026-09-24");
    expect(past.props.accessibilityState).toMatchObject({ disabled: true });
    expect(past.props.accessibilityLabel).toBe("torsdag 24. september 2026, kan ikke velges, har passert");
    expect(past.props.accessibilityHint).toBeUndefined();
    await fireEvent.press(past);
    expect(probe()).toBe("roundtrip 2026-09-28/2026-10-05");
    expect(screen.getByTestId("day-2026-09-25").props.accessibilityLabel).toBe("fredag 25. september 2026, i dag");
    expect(screen.getByTestId("day-2026-09-25").props.accessibilityState).toMatchObject({ disabled: false });
  });

  it("én vei: ett trykk; «Legg til» retur gjør søket til tur-retur og åpner kalenderen på retur", async () => {
    await renderPanel({ tripType: "oneway" });
    await fireEvent.press(screen.getByTestId("depart-date"));
    expect(screen.queryByTestId("calendar-nights")).toBeNull();
    await fireEvent.press(screen.getByTestId("day-2026-10-21"));
    expect(probe()).toBe("oneway 2026-10-21/2026-10-28");
    expect(screen.getByTestId("calendar-hint")).toHaveTextContent("Velg avreisedato");
    await fireEvent.press(screen.getByTestId("calendar-done-button"));

    await fireEvent.press(screen.getByTestId("add-return"));
    expect(probe()).toMatch(/^roundtrip /);
    expect(screen.getByTestId("calendar-hint")).toHaveTextContent("Velg returdato");
    await fireEvent.press(screen.getByTestId("day-2026-10-25"));
    expect(probe()).toBe("roundtrip 2026-10-21/2026-10-25");
  });

  it("engelsk: dager og hjelpetekst på engelsk", async () => {
    await renderPanel({}, "en");
    await fireEvent.press(screen.getByTestId("depart-date"));
    expect(screen.getByTestId("calendar-hint")).toHaveTextContent("Choose your departure date");
    expect(screen.getByTestId("day-2026-10-16").props.accessibilityLabel).toBe("Friday 16 October 2026, return");
    expect(screen.getByTestId("calendar-nights")).toHaveTextContent("7 nights");
  });

  it("åpner på måneden til datoen kunden trykket på – også når returen er måneder unna, og ved gjenåpning", async () => {
    await renderPanel({ returnDate: "2027-03-05" });
    await fireEvent.press(screen.getByTestId("return-date"));
    expect(screen.getByTestId("calendar-hint")).toHaveTextContent("Velg returdato");
    expect(renderedMonths()[0]).toBe("month-2027-3");
    await fireEvent.press(screen.getByTestId("calendar-done-button"));

    // Bare avreise valgt, så lukket: åpnet fra «Avreise» står listen på avreisens måned, ikke på returens.
    await fireEvent.press(screen.getByTestId("depart-date"));
    expect(renderedMonths()[0]).toBe("month-2026-10");
    await fireEvent.press(screen.getByTestId("day-2026-10-12"));
    await fireEvent.press(screen.getByTestId("calendar-done-button"));
    await fireEvent.press(screen.getByTestId("depart-date"));
    expect(screen.getByTestId("calendar-hint")).toHaveTextContent("Velg avreisedato");
    expect(renderedMonths()[0]).toBe("month-2026-10");
  });

  it("trykk på «Retur» øverst ruller til returens måned", async () => {
    const scroll = jest.spyOn(FlatList.prototype, "scrollToIndex").mockImplementation(() => undefined);
    try {
      await renderPanel({ returnDate: "2027-03-05" });
      await fireEvent.press(screen.getByTestId("depart-date"));
      await fireEvent.press(screen.getByTestId("calendar-pick-return"));
      expect(scroll).toHaveBeenLastCalledWith({ index: 6, animated: true });
      expect(screen.getByTestId("calendar-hint")).toHaveTextContent("Velg returdato");
    } finally {
      scroll.mockRestore();
    }
  });

  it("i retur-modus sier en dag før avreisen at den blir ny avreise (det trykket faktisk gjør)", async () => {
    await renderPanel();
    await fireEvent.press(screen.getByTestId("return-date"));
    expect(screen.getByTestId("day-2026-10-05").props.accessibilityHint).toBe("Velger avreisedato");
    expect(screen.getByTestId("day-2026-10-12").props.accessibilityHint).toBe("Velger returdato");
  });

  describe("skjermbredde og tekststørrelse", () => {
    const baseWindow = Dimensions.get("window");
    beforeAll(() => Dimensions.set({ window: baseWindow, screen: Dimensions.get("screen") }));
    const setWindow = (patch: Partial<typeof baseWindow>) => act(async () => Dimensions.set({ window: { ...baseWindow, ...patch }, screen: { ...Dimensions.get("screen"), ...patch } }));
    afterEach(() => setWindow({}));

    it("320 pt bred skjerm: hver dag er fortsatt minst 44 pt bred", async () => {
      await setWindow({ width: 320, fontScale: 1 });
      await renderPanel();
      await fireEvent.press(screen.getByTestId("depart-date"));
      expect(StyleSheet.flatten(screen.getByTestId("day-2026-10-14").props.style).width).toBeGreaterThanOrEqual(44);
    });

    it("stor tekst: månedsnavnet får høyde etter tekststørrelsen, og listen gir etter så handlingen nederst synes", async () => {
      await setWindow({ width: 390, fontScale: 1.8 });
      await renderPanel();
      await fireEvent.press(screen.getByTestId("depart-date"));
      const heading = screen.getByText("oktober 2026");
      const box = StyleSheet.flatten(heading.parent?.props.style);
      expect(box.height).toBeGreaterThanOrEqual(22 * 1.8);
      const list = StyleSheet.flatten(screen.getByTestId("calendar-months").props.style);
      expect(list.flexShrink).toBe(1);
      expect(list.minHeight).toBeGreaterThan(0);
      expect(screen.getByTestId("calendar-done-button")).toBeOnTheScreen();
    });
  });
});
