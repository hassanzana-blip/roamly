import { Text as RNText, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as SafeArea from "react-native-safe-area-context";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { PROFILE, SEARCH_RESULT, TOKEN } from "../test/fixtures";
import { colors, space } from "../lib/theme";
import HomeScreen from "../app/(tabs)/index";
import { pinClock } from "../test/clock";

// Hjem: første bilde og kjernesøket. Jest kan ikke måle piksler; det som prøves er
// det som bestemmer første bilde (rekkefølge, tittel og konto, tett luft i panelet,
// 44 pt trykkflater, stor tekst ikke skrudd av) og at søket virker som før.
// Pikselmålene (375/390/430 pt) står i docs/evidence (nettleser, ikke iPhone).

const router = (globalThis as unknown as { __router: { push: jest.Mock } }).__router;
const keychain = (SecureStore as unknown as { __store: Map<string, { value: string; options: unknown }> }).__store;
const BCN = { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spania" };

function Probe() {
  const { form } = useApp();
  return <RNText testID="probe">{`${form.tripType} ${form.origin?.iata ?? "-"}→${form.destination?.iata ?? "-"} ${form.departDate}/${form.returnDate} a${form.adults} ${form.cabinClass}`}</RNText>;
}

async function renderHome({ signedIn = false, initial }: { signedIn?: boolean; initial?: Record<string, unknown> } = {}) {
  if (signedIn) keychain.set("hellosky.customer-session", { value: JSON.stringify({ token: TOKEN, expiresAt: "2099-01-01T00:00:00Z" }), options: {} });
  const server = fakeServer({ "mobileAuth.me": () => ({ data: signedIn ? PROFILE : null }), "flights.search": () => ({ data: SEARCH_RESULT }) });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  await render(
    <AppProvider initialLocale="nb" apiFactory={factory} initial={initial}>
      <HomeScreen />
      <Probe />
    </AppProvider>,
  );
  return server;
}

/** testID-er og tekst i skjermrekkefølge. */
function order(): string[] {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (n == null) return;
    if (typeof n === "string") return void out.push(n);
    if (Array.isArray(n)) return n.forEach(walk);
    const x = n as { props?: { testID?: string }; children?: unknown };
    if (x.props?.testID) out.push(`#${x.props.testID}`);
    walk(x.children);
  };
  walk(screen.toJSON());
  return out;
}
const flat = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style) ?? {};

beforeEach(() => keychain.clear());


// Klokken står fast (bare Date), så de faste reisedatoene i testene aldri har passert.
beforeEach(() => pinClock());
afterEach(() => jest.useRealTimers());

describe("Hjem: første bilde", () => {
  it("dekker statuslinjen når panelet rulles under den", async () => {
    const inset = jest.spyOn(SafeArea, "useSafeAreaInsets").mockReturnValue({ top: 59, bottom: 34, left: 0, right: 0 });
    try {
      await renderHome();
      expect(screen.queryByTestId("status-bar-shield")).toBeNull();
      fireEvent.scroll(screen.getByTestId("home-scroll"), { nativeEvent: { contentOffset: { y: 90 } } });
      await waitFor(() => expect(flat("status-bar-shield").height).toBe(59));
      fireEvent.scroll(screen.getByTestId("home-scroll"), { nativeEvent: { contentOffset: { y: 0 } } });
      await waitFor(() => expect(screen.queryByTestId("status-bar-shield")).toBeNull());
    } finally {
      inset.mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 });
    }
  });

  it("rekkefølgen: tittel → konto → Fly/Hotell → reisetype → fra → til → datoer → reisende/klasse → «Søk fly» → gjestelinje → reisemål → forklaring", async () => {
    await renderHome();
    const o = order();
    const at = (x: string | RegExp) => o.findIndex((s) => (typeof x === "string" ? s === x : x.test(s)));
    const seq = [at("#home-title"), at("#account-button"), at("#service-switch"), at("#segment-roundtrip"), at("#origin"), at("#destination"), at("#depart-date"), at("#return-date"), at("#travellers"), at("#cabin"), at("#search-button"), at("Du trenger ikke logge inn for å søke."), at(/^#destination-/), at("#how-it-works-home")];
    expect(seq.every((i) => i >= 0)).toBe(true);
    expect([...seq].sort((a, b) => a - b)).toEqual(seq);
    // Ingen priser på forsiden: vi har ingen verifisert pris uten et søk.
    expect(screen.queryByText(/\bkr\b|NOK|\d+\s?,-/)).toBeNull();
  });

  it("gjest: spørsmålet søket svarer på er overskriften, uten en generell hilsen; kontoknappen går til Profil", async () => {
    await renderHome();
    const title = screen.getByTestId("home-title");
    expect(title).toHaveTextContent("Hvor vil du reise?");
    expect(title).toHaveProp("accessibilityRole", "header");
    expect(screen.queryByText(/^God (morgen|formiddag|ettermiddag|kveld|natt)/)).toBeNull();
    // Knappen heter det den åpner: Profil (med innloggingskortet øverst).
    expect(screen.getByTestId("account-button")).toHaveProp("accessibilityLabel", "Din profil");
    await fireEvent.press(screen.getByTestId("account-button"));
    expect(router.push).toHaveBeenLastCalledWith("/profil");
    // Panelet med søket: tett luft mellom delene, og ingen luft over tittelen utover statuslinjen.
    const sheet = flat("home-sheet");
    expect(sheet.gap).toBeLessThanOrEqual(space.lg);
    expect(sheet.paddingTop).toBeLessThanOrEqual(space.md);
  });

  it("innlogget: tittelen er hilsenen med navn, og kontoknappen viser initialene", async () => {
    await renderHome({ signedIn: true });
    // Hilsenen følger klokken («Hei» om natten).
    await waitFor(() => expect(screen.getByTestId("home-title")).toHaveTextContent(/^(God (morgen|formiddag|ettermiddag|kveld)|Hei), Kari$/));
    expect(screen.getByTestId("account-button")).toHaveTextContent("KN");
    expect(screen.getByTestId("account-button")).toHaveProp("accessibilityLabel", "Din profil");
  });

  it("44 pt: konto, Fly/Hotell (uten hitSlop), reisetype, bytt, fra/til, datoer og «Søk fly»; brikkene med hitSlop som ikke når naboene", async () => {
    await renderHome();
    const acc = flat("account-button");
    expect(acc.width).toBeGreaterThanOrEqual(44);
    expect(acc.height).toBeGreaterThanOrEqual(44);
    for (const id of ["service-flights", "service-hotels"]) {
      expect(flat(id).minHeight).toBeGreaterThanOrEqual(44);
      expect(screen.getByTestId(id).props.hitSlop).toBeUndefined();
    }
    const swap = flat("swap");
    expect(Math.min(swap.width, swap.height)).toBeGreaterThanOrEqual(44);
    for (const id of ["segment-roundtrip", "segment-oneway", "origin", "destination", "depart-date", "return-date", "search-button"]) {
      const s = flat(id);
      expect([id, Math.max(s.minHeight ?? 0, s.height ?? 0) >= 44]).toEqual([id, true]);
    }
    // Reisende og klasse er lavere brikker (40 pt) med hitSlop til 44 pt; luften rundt (8 pt) er større enn hitSlop.
    for (const id of ["travellers", "cabin"]) {
      const slop = screen.getByTestId(id).props.hitSlop as number;
      expect([id, (flat(id).minHeight as number) + 2 * slop]).toEqual([id, 44]);
      expect(slop).toBeLessThanOrEqual(space.sm / 2);
    }
  });

  it("stor tekst: ingen tekst i søket har skrudd av Dynamic Type, og feltverdiene kuttes ikke", async () => {
    await renderHome({ initial: { destination: BCN } });
    const panelIds = ["origin", "destination", "depart-date", "return-date", "travellers", "cabin", "search-button", "service-switch"];
    for (const id of panelIds) {
      expect(within(screen.getByTestId(id)).queryAllByText(/.+/, { includeHiddenElements: true }).length).toBeGreaterThan(0);
      for (const t of within(screen.getByTestId(id)).queryAllByText(/.+/, { includeHiddenElements: true })) {
        expect(t.props.allowFontScaling).not.toBe(false);
        if (t.props.maxFontSizeMultiplier != null) expect(t.props.maxFontSizeMultiplier).toBeGreaterThanOrEqual(1.4);
      }
    }
    // Reisende og datoer kan bryte linjen, ikke kuttes.
    for (const id of ["travellers", "cabin", "depart-date", "return-date"]) {
      for (const t of within(screen.getByTestId(id)).queryAllByText(/.+/, { includeHiddenElements: true })) expect(t.props.numberOfLines ?? 0).not.toBe(1);
    }
  });
});

describe("Hjem: skjemaet som hos de store søketjenestene", () => {
  const OCT = { departDate: "2026-10-23", returnDate: "2026-10-30" };

  it("fra og til under hverandre: valgt flyplass som by og kode; tomt felt viser spørsmålet i dempet farge, og VoiceOver sier «ikke valgt»", async () => {
    await renderHome();
    expect(screen.getByTestId("origin")).toHaveTextContent("Oslo (OSL)");
    expect(screen.getByTestId("origin")).toHaveProp("accessibilityLabel", expect.stringMatching(/^Fra: Oslo, .+, OSL$/));
    const empty = within(screen.getByTestId("destination")).getByText("Til hvor?");
    expect(StyleSheet.flatten(empty.props.style).color).toBe(colors.textSecondary);
    expect(screen.getByTestId("destination")).toHaveProp("accessibilityLabel", "Til: ikke valgt");
    expect(screen.getByTestId("destination")).toHaveProp("accessibilityHint", "Åpner flyplassøket");
  });

  it("bytt-knappen står midt på skillelinjen, også når fra-raden blir høyere (lang by, stor tekst)", async () => {
    await renderHome();
    expect(flat("swap").top).toBe(56 - 22);
    await fireEvent(screen.getByTestId("origin"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 358, height: 84 } } });
    expect(flat("swap").top).toBe(84 - 22);
  });

  it("datoene i ett felt: ukedag og dato for avreise og retur; VoiceOver hører hele datoen; hver halvdel åpner kalenderen på sin dato", async () => {
    await renderHome({ initial: OCT });
    expect(screen.getByTestId("depart-date")).toHaveTextContent("fre. 23. okt.");
    expect(screen.getByTestId("return-date")).toHaveTextContent("fre. 30. okt.");
    expect(screen.getByTestId("depart-date")).toHaveProp("accessibilityLabel", "Avreise: fredag 23. oktober 2026");
    expect(screen.getByTestId("return-date")).toHaveProp("accessibilityLabel", "Retur: fredag 30. oktober 2026");
    await fireEvent.press(screen.getByTestId("return-date"));
    expect(screen.getByTestId("calendar-pick-return")).toBeSelected();
    await fireEvent.press(screen.getByTestId("calendar-done-button"));
    await fireEvent.press(screen.getByTestId("depart-date"));
    expect(screen.getByTestId("calendar-pick-depart")).toBeSelected();
  });

  it("én vei: returhalvdelen blir «+ Legg til retur», som gjør reisen tur-retur og åpner kalenderen på returen", async () => {
    await renderHome({ initial: OCT });
    await fireEvent.press(screen.getByTestId("segment-oneway"));
    expect(screen.getByTestId("add-return")).toHaveTextContent("+ Legg til retur");
    expect(screen.getByTestId("add-return")).toHaveProp("accessibilityLabel", "Legg til retur");
    await fireEvent.press(screen.getByTestId("add-return"));
    expect(screen.getByTestId("probe")).toHaveTextContent(/^roundtrip /);
    expect(screen.getByTestId("calendar-pick-return")).toBeSelected();
  });

  it("reisetypen som faner: den valgte er lys med blå strek under – ikke bare en annen farge – og VoiceOver hører valget", async () => {
    await renderHome();
    const color = (id: string) => StyleSheet.flatten(within(screen.getByTestId(id)).getByText(/./).props.style).color;
    expect(screen.getByTestId("segment-roundtrip")).toHaveProp("accessibilityRole", "radio");
    expect(screen.getByTestId("segment-roundtrip")).toBeSelected();
    expect(screen.getByTestId("segment-oneway")).not.toBeSelected();
    expect([color("segment-roundtrip"), color("segment-oneway")]).toEqual([colors.onDark, colors.onDarkDim]);
    // Streken under: blå under den valgte, usynlig under den andre.
    const line = (id: string) => {
      const kids = (screen.getByTestId(id).children as { props: { style?: StyleProp<ViewStyle> } }[]).filter((c) => typeof c === "object");
      return StyleSheet.flatten(kids[kids.length - 1]!.props.style)?.backgroundColor;
    };
    expect([line("segment-roundtrip"), line("segment-oneway")]).toEqual([colors.blueOnDark, "transparent"]);
  });

  it("Fly/Hotell som to like brede ruter: den valgte med svak blå flate og blå kant; helblått er forbeholdt «Søk fly»", async () => {
    await renderHome();
    const flights = flat("service-flights");
    const hotels = flat("service-hotels");
    expect([flights.flex, hotels.flex]).toEqual([1, 1]);
    expect([flights.backgroundColor, flights.borderColor]).toEqual([colors.blueOnDarkTint, colors.blueOnDark]);
    expect(hotels.backgroundColor).toBe(colors.bg);
    expect(screen.getByTestId("service-flights")).toHaveProp("accessibilityRole", "tab");
    expect(flat("search-button").backgroundColor).toBe(colors.blue);
  });

  it("brikkene: reisende og klasse – med «Bare direktefly» når det er på – åpner det samme arket", async () => {
    await renderHome({ initial: { directOnly: true, adults: 2 } });
    expect(screen.getByTestId("travellers")).toHaveTextContent("2 voksne");
    expect(screen.getByTestId("travellers")).toHaveProp("accessibilityLabel", "Reisende: 2 voksne");
    expect(screen.getByTestId("cabin")).toHaveTextContent("Økonomi · Bare direktefly");
    expect(screen.getByTestId("cabin")).toHaveProp("accessibilityLabel", "Reiseklasse: Økonomi, Bare direktefly");
    await fireEvent.press(screen.getByTestId("cabin"));
    expect(screen.getByTestId("travellers-sheet")).toBeOnTheScreen();
  });

  it("reisemålene som hvite kort uten pris: by, land og kode og «Se flyreiser»; et trykk søker dit med skjemaets datoer", async () => {
    const server = await renderHome({ initial: OCT });
    const card = screen.getByTestId("destination-barcelona");
    expect(card).toHaveTextContent(/^Barcelona\s*Spania · BCN\s*Se flyreiser$/);
    expect(card).toHaveProp("accessibilityRole", "button");
    expect(card).toHaveProp("accessibilityLabel", "Se flyreiser til Barcelona, Barcelona-El Prat");
    expect(flat("destination-barcelona").backgroundColor).toBe(colors.white);
    // Lange navn og stor tekst bryter linjen i stedet for å kuttes.
    for (const el of within(card).getAllByText(/./)) expect(el.props.numberOfLines).toBeUndefined();
    await fireEvent.press(card);
    expect(router.push).toHaveBeenCalledWith("/resultater");
    await waitFor(() => expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(1));
    const input = server.calls.find((c) => c.path === "flights.search")!.input as { slices: { origin: string; destination: string; departureDate: string }[] };
    expect(input.slices.map((x) => `${x.origin}-${x.destination} ${x.departureDate}`)).toEqual(["OSL-BCN 2026-10-23", "BCN-OSL 2026-10-30"]);
  });

  it("et reisemål når datoene har passert: feilen står over kortene, og det søkes ikke", async () => {
    const server = await renderHome({ initial: { departDate: "2020-01-10", returnDate: "2020-01-17" } });
    await fireEvent.press(screen.getByTestId("destination-barcelona"));
    expect(screen.getByTestId("card-error")).toHaveTextContent("Utreisedatoen har passert. Velg en ny dato.");
    const o = order();
    expect(o.indexOf("#card-error")).toBeLessThan(o.indexOf("#destination-barcelona"));
    expect(router.push).not.toHaveBeenCalledWith("/resultater");
    expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(0);
  });
});

describe("Hjem: kjernesøket virker som før", () => {
  it("bytt rute, én vei (retur kan legges til igjen), flyplassvalg og reisende åpner riktig", async () => {
    await renderHome({ initial: { destination: BCN } });
    expect(screen.getByTestId("probe")).toHaveTextContent(/^roundtrip OSL→BCN /);
    await fireEvent.press(screen.getByTestId("swap"));
    expect(screen.getByTestId("probe")).toHaveTextContent(/^roundtrip BCN→OSL /);
    await fireEvent.press(screen.getByTestId("segment-oneway"));
    expect(screen.getByTestId("probe")).toHaveTextContent(/^oneway /);
    expect(screen.queryByTestId("return-date")).toBeNull();
    await fireEvent.press(screen.getByTestId("add-return"));
    expect(screen.getByTestId("probe")).toHaveTextContent(/^roundtrip /);
    await fireEvent.press(screen.getByTestId("origin"));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: "/flyplass", params: { felt: "fra" } });
    await fireEvent.press(screen.getByTestId("destination"));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: "/flyplass", params: { felt: "til" } });
    await fireEvent.press(screen.getByTestId("travellers"));
    expect(screen.getByTestId("travellers-sheet")).toBeOnTheScreen();
  });

  it("uten reisemål: en tydelig feil, ingen navigasjon og ikke noe søk", async () => {
    const server = await renderHome();
    await fireEvent.press(screen.getByTestId("search-button"));
    expect(screen.getByTestId("form-error")).toHaveTextContent("Velg hvor du skal.");
    expect(router.push).not.toHaveBeenCalledWith("/resultater");
    expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(0);
  });

  it("søk med reisemål går til resultater med nøyaktig rute, datoer og reisende; gjestesøk uten innlogging", async () => {
    const server = await renderHome({ initial: { destination: BCN } });
    const before = screen.getByTestId("probe").props.children as string;
    await fireEvent.press(screen.getByTestId("search-button"));
    expect(router.push).toHaveBeenCalledWith("/resultater");
    await waitFor(() => expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(1));
    const call = server.calls.find((c) => c.path === "flights.search")!;
    expect((call.input as { slices: { origin: string; destination: string }[] }).slices[0]).toMatchObject({ origin: "OSL", destination: "BCN" });
    expect(call.headers.authorization).toBeUndefined();
    expect(screen.getByTestId("probe").props.children).toBe(before);
  });

  it("Hotell-bryteren åpner hotellsøket (som finnes); Fly er valgt", async () => {
    await renderHome();
    expect(screen.getByTestId("service-flights")).toBeSelected();
    await fireEvent.press(screen.getByTestId("service-hotels"));
    expect(router.push).toHaveBeenCalledWith("/hotell");
  });
});
