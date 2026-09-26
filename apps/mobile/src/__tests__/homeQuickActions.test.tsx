import { AccessibilityInfo, Animated, Text as RNText } from "react-native";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { writePref } from "../lib/localStore";
import { initialForm } from "../lib/searchForm";
import { formatDateSpan, formatDay } from "../lib/format";
import { fakeServer } from "../test/fakeServer";
import { SEARCH_RESULT } from "../test/fixtures";
import HomeScreen from "../app/(tabs)/index";

// Hjem: andre nylige søk med ett trykk, «bytt» som sier den nye ruten, og reglene for reisende sagt der de biter.

const router = (globalThis as unknown as { __router: { push: jest.Mock } }).__router;
const BCN = { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spania" };
const BGO = { iata: "BGO", name: "Bergen lufthavn Flesland", city: "Bergen", country: "Norge" };
const LHR = { iata: "LHR", name: "London Heathrow", city: "London", country: "Storbritannia" };
const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

function Probe() {
  const { form } = useApp();
  return (
    <>
      <RNText testID="probe">{`${form.origin?.iata ?? "-"}→${form.destination?.iata ?? "-"} a${form.adults} i${form.infantAges.length}`}</RNText>
      <RNText testID="probe-dates">{`${form.departDate}/${form.returnDate}`}</RNText>
    </>
  );
}

async function renderHome(initial?: Record<string, unknown>) {
  const server = fakeServer({ "mobileAuth.me": () => ({ data: null }), "flights.search": () => ({ data: SEARCH_RESULT }) });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  await render(
    <AppProvider initialLocale="nb" apiFactory={factory} initial={initial}>
      <HomeScreen />
      <Probe />
    </AppProvider>,
  );
  return server;
}

afterEach(() => jest.restoreAllMocks());

describe("nylige søk på forsiden", () => {
  const london = { ...initialForm(), origin: BGO, destination: LHR, departDate: future(30), returnDate: future(37) };
  const same = { ...initialForm(), destination: BCN };
  const past = { ...initialForm(), origin: BGO, destination: BCN, departDate: "2026-01-05", returnDate: "2026-01-12" };

  it("andre søk enn skjemaet, med datoer som ikke har passert, står som brikker i stedet for linjen om innlogging", async () => {
    writePref("recent", [same, london, past]);
    await renderHome({ destination: BCN });
    const row = screen.getByTestId("home-recent");
    const pills = within(row).getAllByTestId(/^home-recent-/);
    expect(pills.map((p) => p.props.testID)).toEqual([`home-recent-BGO-LHR-${london.departDate}`]);
    expect(pills[0]).toHaveTextContent(`BGO‑LHR${formatDateSpan(london.departDate, london.returnDate, "nb")}`);
    expect(pills[0]!.props.accessibilityLabel).toBe(`Søk igjen: Bergen → London, ${formatDay(london.departDate, "nb")} – ${formatDay(london.returnDate, "nb")} · 1 voksen · Økonomi`);
    expect(pills[0]!.props.accessibilityHint).toBe("Søker på nytt med disse valgene");
    expect(screen.queryByText("Du trenger ikke logge inn for å søke.")).toBeNull();
  });

  it("ett trykk søker igjen med akkurat de valgene og åpner resultatene", async () => {
    writePref("recent", [london]);
    const server = await renderHome({ destination: BCN });
    await fireEvent.press(screen.getByTestId(`home-recent-BGO-LHR-${london.departDate}`));
    expect(router.push).toHaveBeenCalledWith("/resultater");
    await waitFor(() => expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(1));
    const slices = (server.calls.find((c) => c.path === "flights.search")!.input as { slices: { origin: string; destination: string; departureDate: string }[] }).slices;
    expect(slices).toEqual([
      expect.objectContaining({ origin: "BGO", destination: "LHR", departureDate: london.departDate }),
      expect.objectContaining({ origin: "LHR", destination: "BGO", departureDate: london.returnDate }),
    ]);
    expect(screen.getByTestId("probe")).toHaveTextContent(/^BGO→LHR /);
  });

  it("bare søket som står i skjemaet (eller ingen): linjen om innlogging står, ingen rad", async () => {
    writePref("recent", [same, past]);
    await renderHome({ destination: BCN });
    expect(screen.queryByTestId("home-recent")).toBeNull();
    expect(screen.getByText("Du trenger ikke logge inn for å søke.")).toBeOnTheScreen();
  });

  it("datospennet: samme måned kort, ellers begge datoer; én vei bare avreisen", () => {
    expect(formatDateSpan("2026-10-09", "2026-10-16", "nb")).toBe("9.–16. okt.");
    expect(formatDateSpan("2026-10-30", "2026-11-06", "nb")).toBe("30. okt. – 6. nov.");
    expect(formatDateSpan("2026-10-09", "2026-10-16", "en")).toBe("9–16 Oct");
    expect(formatDateSpan("2026-12-28", "2027-01-04", "en")).toBe("28 Dec – 4 Jan");
    expect(formatDateSpan("2026-10-09", null, "nb")).toBe("9. okt.");
    // Hjem samme dag: én dato, ikke «9.–9. okt.».
    expect(formatDateSpan("2026-10-09", "2026-10-09", "nb")).toBe("9. okt.");
    expect(formatDateSpan("2026-10-09", "2026-10-09", "en")).toBe("9 Oct");
  });
});

describe("nylige søk på forsiden – kanttilfeller", () => {
  const base = { ...initialForm(), origin: BGO, destination: LHR, departDate: future(30), returnDate: future(37) };

  afterEach(() => jest.useRealTimers());

  it("datoen har passert siden raden ble tegnet (appen lå over midnatt): ruten med nye datoer, ikke noe søk og ingen feil", async () => {
    // Bare klokken er falsk; tidtakere og løfter går som vanlig.
    jest.useFakeTimers({ doNotFake: ["hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setImmediate", "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
    jest.setSystemTime(new Date(2026, 9, 9, 21, 0));
    writePref("recent", [{ ...initialForm(), origin: BGO, destination: LHR, departDate: "2026-10-09", returnDate: "2026-10-16" }]);
    const server = await renderHome({ destination: BCN });
    const chip = screen.getByTestId("home-recent-BGO-LHR-2026-10-09");
    jest.setSystemTime(new Date(2026, 9, 10, 8, 0));
    await fireEvent.press(chip);
    expect(router.push).not.toHaveBeenCalled();
    expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(0);
    expect(screen.getByTestId("probe")).toHaveTextContent(/^BGO→LHR /);
    expect(screen.getByTestId("probe-dates")).not.toHaveTextContent(/2026-10-09/);
    expect(screen.queryByTestId("card-error")).toBeNull();
    expect(screen.queryByTestId("home-recent-BGO-LHR-2026-10-09")).toBeNull();
  });

  it("brikker som søker forskjellig, ser og høres forskjellige ut (reisende, klasse, direkte, én vei)", async () => {
    const oneWay = { ...base, tripType: "oneway" as const, departDate: future(40) };
    writePref("recent", [base, { ...base, adults: 2, childAges: [5], cabinClass: "business" as const }, { ...base, directOnly: true }, oneWay]);
    await renderHome({ destination: BCN });
    const pills = within(screen.getByTestId("home-recent")).getAllByTestId(/^home-recent-/);
    expect(pills).toHaveLength(4);
    const texts = pills.map((p) => within(p).queryAllByText(/./).map((t) => String(t.props.children)).join(" "));
    expect(new Set(texts).size).toBe(4);
    expect(texts[1]).toMatch(/· 3 reisende · Business$/);
    expect(texts[2]).toMatch(/· Direkte$/);
    const labels = pills.map((p) => p.props.accessibilityLabel as string);
    expect(new Set(labels).size).toBe(4);
    expect(labels[2]).toMatch(/ · Bare direktefly$/);
    expect(labels[3]).toMatch(/^Søk igjen: Bergen → London, Én vei · /);
  });

  it("feilen fra «Søk fly» forsvinner når en brikke har fylt skjemaet og søkt", async () => {
    writePref("recent", [base]);
    await renderHome();
    await fireEvent.press(screen.getByTestId("search-button"));
    expect(screen.getByTestId("form-error")).toHaveTextContent("Velg hvor du skal.");
    await fireEvent.press(within(screen.getByTestId("home-recent")).getAllByTestId(/^home-recent-/)[0]!);
    expect(router.push).toHaveBeenCalledWith("/resultater");
    expect(screen.queryByTestId("form-error")).toBeNull();
  });
});

describe("bytt fra og til", () => {
  it("VoiceOver hører den nye ruten; pilene snur en halv runde", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    const timing = jest.spyOn(Animated, "timing");
    await renderHome({ destination: BCN });
    await fireEvent.press(screen.getByTestId("swap"));
    expect(screen.getByTestId("probe")).toHaveTextContent(/^BCN→OSL /);
    expect(announce).toHaveBeenCalledWith("Byttet. Fra Barcelona, til Oslo.");
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, useNativeDriver: true }));
  });

  it("«Reduser bevegelse»: ingen snuing, men ruten leses fortsatt opp", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    await renderHome({ destination: BCN });
    await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    const timing = jest.spyOn(Animated, "timing");
    await fireEvent.press(screen.getByTestId("swap"));
    expect(timing).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith("Byttet. Fra Barcelona, til Oslo.");
  });
});

describe("reisende-arket", () => {
  const more = (label: string) => fireEvent.press(screen.getByLabelText(`Flere ${label}`));
  const fewerButton = (label: string) => screen.getByLabelText(`Færre ${label}`);

  it("sammendraget øverst følger valgene; høyst ett spedbarn per voksen – sagt der det stopper", async () => {
    await renderHome({ destination: BCN });
    await fireEvent.press(screen.getByTestId("travellers"));
    expect(screen.getByTestId("travellers-summary")).toHaveTextContent("1 voksen · Økonomi");
    expect(screen.queryByTestId("infants-note")).toBeNull();

    await more("spedbarn");
    expect(screen.getByTestId("travellers-summary")).toHaveTextContent("1 voksen, 1 spedbarn · Økonomi");
    expect(screen.getByTestId("infants-note")).toHaveTextContent("Høyst ett spedbarn per voksen: spedbarn sitter på fanget til en voksen.");
    expect(screen.getByLabelText("Flere spedbarn").props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId("stepper-Spedbarn").props.accessibilityHint).toBe("Under 2 år, på fanget. Høyst ett spedbarn per voksen: spedbarn sitter på fanget til en voksen.");

    // To voksne: plass til ett spedbarn til; da stopper det igjen.
    await more("voksne");
    expect(screen.queryByTestId("infants-note")).toBeNull();
    await more("spedbarn");
    expect(screen.getByTestId("infants-note")).toBeOnTheScreen();
  });

  it("voksne kan ikke bli færre enn spedbarn – ingen spedbarn forsvinner i det stille", async () => {
    await renderHome({ destination: BCN });
    await fireEvent.press(screen.getByTestId("travellers"));
    await more("voksne");
    await more("spedbarn");
    await more("spedbarn");
    expect(screen.getByTestId("probe")).toHaveTextContent(/a2 i2$/);
    expect(fewerButton("voksne").props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId("adults-note")).toHaveTextContent("Hvert spedbarn trenger en voksen. Ta bort et spedbarn først.");
    await fireEvent.press(fewerButton("voksne"));
    expect(screen.getByTestId("probe")).toHaveTextContent(/a2 i2$/);
    // Ett spedbarn færre: da kan en voksen tas bort.
    await fireEvent.press(fewerButton("spedbarn"));
    expect(screen.queryByTestId("adults-note")).toBeNull();
    await fireEvent.press(fewerButton("voksne"));
    expect(screen.getByTestId("probe")).toHaveTextContent(/a1 i1$/);
  });

  it("ni reisende: grensen står under stegene", async () => {
    await renderHome({ destination: BCN });
    await fireEvent.press(screen.getByTestId("travellers"));
    for (let i = 0; i < 8; i++) await more("voksne");
    expect(screen.getByTestId("probe")).toHaveTextContent(/a9 i0$/);
    expect(screen.getByTestId("travellers-max-note")).toHaveTextContent("Høyst 9 reisende i ett søk.");
    expect(screen.getByLabelText("Flere barn").props.accessibilityState).toMatchObject({ disabled: true });
  });
});
