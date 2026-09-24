import { Text as RNText, StyleSheet } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as SafeArea from "react-native-safe-area-context";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { PROFILE, SEARCH_RESULT, TOKEN } from "../test/fixtures";
import { space, type } from "../lib/theme";
import HomeScreen from "../app/(tabs)/index";

// Hjem: første bilde og kjernesøket. Jest kan ikke måle piksler; det som prøves er
// det som bestemmer høyden i første bilde (rekkefølge, fotohodets størrelse og
// luft, 44 pt trykkflater, stor tekst ikke skrudd av) og at søket virker som før.
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

describe("Hjem: første bilde", () => {
  it("dekker statuslinjen når fotohodet rulles under den", async () => {
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

  it("rekkefølgen: fotohode → Fly/Hotell → reisetype → rute → datoer → reisende/klasse → «Søk fly» → gjestelinje → reisemål → forklaring", async () => {
    await renderHome();
    const o = order();
    const at = (x: string | RegExp) => o.findIndex((s) => (typeof x === "string" ? s === x : x.test(s)));
    const seq = [at("#home-hero"), at("#service-switch"), at("#segment-roundtrip"), at("#origin"), at("#destination"), at("#depart-date"), at("#return-date"), at("#travellers"), at("#cabin"), at("#search-button"), at("Du trenger ikke logge inn for å søke."), at(/^#destination-/), at("#how-it-works-home")];
    expect(seq.every((i) => i >= 0)).toBe(true);
    expect([...seq].sort((a, b) => a - b)).toEqual(seq);
    // Ingen priser på forsiden: vi har ingen verifisert pris uten et søk.
    expect(screen.queryByText(/\bkr\b|NOK|\d+\s?,-/)).toBeNull();
  });

  it("lavt fotohode: logo og konto på én linje, tittel i «title»-størrelse, ingen generell hilsen for gjester", async () => {
    await renderHome();
    const hero = flat("home-hero");
    expect(hero.paddingBottom).toBeLessThanOrEqual(36);
    expect(hero.gap).toBeLessThanOrEqual(space.sm);
    const title = StyleSheet.flatten(screen.getByTestId("home-title").props.style);
    expect(title.fontSize).toBe(type.title.fontSize);
    expect(title.fontSize).toBeLessThan(type.hero.fontSize);
    expect(screen.getByTestId("home-title")).toHaveTextContent("Nye opplevelser er bare en reise unna.");
    expect(screen.queryByTestId("home-greeting")).toBeNull();
    expect(screen.queryByText(/^God (morgen|formiddag|ettermiddag|kveld|natt)/)).toBeNull();
    // Arket med søket: tett luft mellom delene.
    const sheet = flat("home-sheet");
    expect(sheet.gap).toBeLessThanOrEqual(space.sm);
    expect(sheet.paddingTop).toBeLessThanOrEqual(space.md);
  });

  it("innlogget: hilsen med navn beholdes, liten, over tittelen", async () => {
    await renderHome({ signedIn: true });
    await waitFor(() => expect(screen.getByTestId("home-greeting")).toHaveTextContent(/, Kari$/));
    const o = order();
    expect(o.indexOf("#home-greeting")).toBeLessThan(o.indexOf("#home-title"));
    expect(StyleSheet.flatten(screen.getByTestId("home-greeting").props.style).fontSize).toBe(type.footnote.fontSize);
  });

  it("44 pt: konto, Fly/Hotell (uten hitSlop), reisetype, bytt, felt og «Søk fly»", async () => {
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
    for (const id of ["segment-roundtrip", "segment-oneway", "depart-date", "return-date", "travellers", "cabin", "search-button"]) {
      const s = flat(id);
      expect(Math.max(s.minHeight ?? 0, s.height ?? 0)).toBeGreaterThanOrEqual(44);
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
