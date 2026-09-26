import { AccessibilityInfo, Dimensions, StyleSheet, Text as RNText, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import * as SafeArea from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { WEB_PAGES } from "../lib/config";
import { __resetLocalStoreForTests, readPref, writePref } from "../lib/localStore";
import { initialForm, type SearchForm } from "../lib/searchForm";
import { greetingName, NAMELESS_FIRST_NAME } from "../lib/customerName";
import type { CustomerProfile } from "@contracts/mobileAuth";
import { colors, radius, space } from "../lib/theme";
import { fakeServer } from "../test/fakeServer";
import { PROFILE, SEARCH_RESULT, TOKEN } from "../test/fixtures";
import { pinClock } from "../test/clock";
import AccountScreen from "../app/(tabs)/profil";
import AirportPicker from "../app/flyplass";
import HomeScreen from "../app/(tabs)/index";

// Min side: kundens egen side. Øverst en grafittøy med innloggingen (gjest) eller hilsenen (innlogget) og en oversikt
// over det som faktisk ligger på telefonen – nylige søk, lagrede reisemål og vanlig avreiseflyplass. Under: søk å
// fortsette, lagrede reisemål (eller «Kom i gang»), reisevaner, og for innloggede kontoen og sidene på hellosky.no.
// Ekte skjerm, ekte app-tilstand og ekte localStore; klokken står fast (bare Date), så datoene aldri passerer av seg selv.

// Statuslinjen er en innstilling som ikke tegnes; her blir den et element som husker stilen den fikk.
jest.mock("expo-status-bar", () => {
  const { View } = jest.requireActual("react-native");
  return { StatusBar: (props: { style?: string }) => <View testID="status-bar" {...({ statusBarStyle: props.style } as object)} /> };
});

// Versjonen kommer fra app.json via expo-constants; i Jest er den innebygde konfigurasjonen tom, så den settes her.
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { version: "1.0.0" } } }));

const router = (globalThis as unknown as { __router: { push: jest.Mock; navigate: jest.Mock; back: jest.Mock } }).__router;
const setParams = (globalThis as unknown as { __setParams: (p: Record<string, string>) => void }).__setParams;
const keychain = (SecureStore as unknown as { __store: Map<string, { value: string; options: unknown }> }).__store;

/** Statuslinjen på en iPhone med Dynamic Island. */
const TOP = 59;
const OSL = { iata: "OSL", name: "Oslo lufthavn Gardermoen", city: "Oslo", country: "Norge" };
const BGO = { iata: "BGO", name: "Bergen lufthavn Flesland", city: "Bergen", country: "Norge" };
const TOS = { iata: "TOS", name: "Tromsø lufthavn", city: "Tromsø", country: "Norge" };
const BCN = { iata: "BCN", name: "Barcelona-El Prat", city: "Barcelona", country: "Spania" };
const LHR = { iata: "LHR", name: "London Heathrow Airport", city: "London", country: "Storbritannia" };
const FCO = { iata: "FCO", name: "Roma Fiumicino", city: "Roma", country: "Italia" };

/** Et kjørt søk slik det ligger på telefonen (klokken står på fredag 25. september 2026). */
const search = (patch: Partial<SearchForm>) => ({ ...initialForm(), ...patch });

/** Hva den vanlige avreiseflyplassen gjør – i flyplassøket og under «Reisevaner» (regelen i lib/appState.tsx). */
const HOME_HINT = "Lagres bare på denne telefonen. Søket starter derfra når du åpner appen, med mindre du er midt i å planlegge en reise.";

const flat = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style as StyleProp<ViewStyle>);
const colorOf = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as StyleProp<TextStyle>)?.color;
const statusBarStyle = () => screen.getByTestId("status-bar").props.statusBarStyle as string;

type HostNode = { type: string; props: Record<string, unknown>; children: (HostNode | string)[] | null };
const textOf = (n: HostNode | string): string => (typeof n === "string" ? n : (n.children ?? []).map(textOf).join(""));

/** testID-ene i skjermrekkefølge. */
function idsInOrder(): string[] {
  const out: string[] = [];
  const walk = (n: HostNode | string | null): void => {
    if (!n || typeof n === "string") return;
    if (typeof n.props.testID === "string") out.push(n.props.testID);
    for (const c of n.children ?? []) walk(c);
  };
  const tree = screen.toJSON() as HostNode | HostNode[] | null;
  for (const root of Array.isArray(tree) ? tree : [tree]) walk(root);
  return out;
}
const inOrder = (ids: string[]) => {
  const all = idsInOrder();
  const at = ids.map((id) => all.indexOf(id));
  expect(at.every((i) => i >= 0)).toBe(true);
  expect([...at].sort((x, y) => x - y)).toEqual(at);
};

/** Språkvalgene står på sitt eget språk og leses med den stemmen (se a11yLanguage-testen). */
const OWN_LANGUAGE: Record<string, string> = { "segment-nb": "nb-NO", "segment-en": "en-GB" };

/** Alt VoiceOver kan stoppe på som mangler språket – samme regel som i a11yLanguage-testen. */
function withoutLanguage(expected: string, skip: (testID: string) => boolean = () => false): string[] {
  const wrong: string[] = [];
  const walk = (n: HostNode | string | null, insideAccessible: boolean, want: string) => {
    if (!n || typeof n === "string") return;
    const p = n.props ?? {};
    if (p.accessibilityElementsHidden === true || p.importantForAccessibility === "no-hide-descendants") return;
    const id = typeof p.testID === "string" ? p.testID : "";
    if (id && skip(id)) return;
    const lang = OWN_LANGUAGE[id] ?? want;
    const accessible = p.accessible === true;
    const focusable = accessible || n.type === "TextInput" || /Switch/i.test(n.type) || p.accessibilityViewIsModal === true || (n.type === "Text" && !insideAccessible);
    if (focusable && p.accessible !== false && p.accessibilityLanguage !== lang) wrong.push(id || `${n.type}: ${textOf(n).slice(0, 40)}`);
    for (const c of n.children ?? []) walk(c, insideAccessible || accessible, lang);
  };
  const tree = screen.toJSON() as HostNode | HostNode[] | null;
  for (const root of Array.isArray(tree) ? tree : [tree]) walk(root, false, expected);
  return wrong;
}

/** Skjemaet slik søket ser det. */
function Probe() {
  const { form } = useApp();
  return <RNText testID="probe">{`${form.tripType} ${form.origin?.iata ?? "-"}→${form.destination?.iata ?? "-"} ${form.departDate}/${form.returnDate}`}</RNText>;
}

/** Endrer «Fra» i skjemaet et annet sted (som på Hjem), mens Min side står. */
function ChangeOrigin() {
  const { setForm } = useApp();
  return (
    <RNText testID="change-origin" onPress={() => setForm((f) => ({ ...f, origin: BGO }))}>
      BGO
    </RNText>
  );
}

/** Det som ligger på telefonen, skrevet før appen starter (som en omstart: alt leses fra filen). */
function seed({ recent, saved, homeAirport, draft }: { recent?: unknown[]; saved?: unknown[]; homeAirport?: unknown; draft?: unknown }) {
  if (recent) writePref("recent", recent);
  if (saved) writePref("saved", saved);
  if (homeAirport) writePref("homeAirport", homeAirport);
  if (draft) writePref("draft", draft);
  __resetLocalStoreForTests();
}

async function renderMinSide({ signedIn = false, locale = "nb", routes = {}, profile = PROFILE }: { signedIn?: boolean; locale?: "nb" | "en"; routes?: Parameters<typeof fakeServer>[0]; profile?: CustomerProfile } = {}) {
  if (signedIn) keychain.set("hellosky.customer-session", { value: JSON.stringify({ token: TOKEN, expiresAt: "2099-01-01T00:00:00Z" }), options: {} });
  const server = fakeServer({ "mobileAuth.me": () => ({ data: signedIn ? profile : null }), "flights.search": () => ({ data: SEARCH_RESULT }), ...routes });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  await render(
    <AppProvider initialLocale={locale} apiFactory={factory}>
      <AccountScreen />
      <Probe />
      <ChangeOrigin />
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByTestId(signedIn ? "account-card" : "account-signed-out")).toBeOnTheScreen());
  return server;
}

const searches = (server: ReturnType<typeof fakeServer>) => server.calls.filter((c) => c.path === "flights.search");
const HOME_PICKER = { pathname: "/flyplass", params: { felt: "fra", hjem: "1" } };

beforeEach(() => {
  pinClock();
  keychain.clear();
  (WebBrowser.openBrowserAsync as jest.Mock).mockClear();
  for (const key of ["recent", "saved", "homeAirport", "draft"]) writePref(key, null);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("Min side for gjester", () => {
  it("«Min side» er overskriften; innloggingen står øverst i grafitten med to knapper og tydelige hint", async () => {
    await renderMinSide();
    const card = within(screen.getByTestId("sign-in-card"));
    expect(card.getByText("Min side")).toHaveProp("accessibilityRole", "header");
    expect(card.getByText("Logg inn for å bruke samme konto som på hellosky.no. Du trenger ikke konto for å søke og sammenligne fly.")).toBeOnTheScreen();
    expect(within(screen.getByTestId("account-hero")).getByTestId("sign-in-card")).toBeOnTheScreen();
    const login = screen.getByTestId("open-login");
    expect(login).toHaveProp("accessibilityRole", "button");
    expect(login).toHaveProp("accessibilityHint", "Åpner innloggingen");
    expect(screen.getByTestId("open-register")).toHaveProp("accessibilityHint", "Åpner skjemaet for ny konto");
    // «Logg inn» åpner arket med skjemaet; ingenting av kontoen vises for en gjest.
    await fireEvent.press(login);
    expect(screen.getByTestId("auth-modal")).toBeOnTheScreen();
    expect(screen.queryByTestId("account-card")).toBeNull();
    expect(screen.queryByTestId("web-account-group")).toBeNull();
  });

  it("oversikten uten noe lagret: 0, 0 og «–», med etiketter VoiceOver kan si, og hver flis går dit den sier", async () => {
    await renderMinSide();
    const recent = screen.getByTestId("hub-recent");
    expect(within(recent).getByText("0")).toBeOnTheScreen();
    expect(within(recent).getByText("Nylige søk")).toBeOnTheScreen();
    expect(recent).toHaveProp("accessibilityRole", "button");
    expect(recent).toHaveProp("accessibilityLabel", "Ingen nylige søk");
    expect(recent).toHaveProp("accessibilityHint", "Åpner Lagret");
    const saved = screen.getByTestId("hub-saved");
    expect(within(saved).getByText("0")).toBeOnTheScreen();
    expect(within(saved).getByText("Lagrede reisemål")).toBeOnTheScreen();
    expect(saved).toHaveProp("accessibilityLabel", "Ingen lagrede reisemål");
    const home = screen.getByTestId("hub-home-airport");
    expect(within(home).getByText("–")).toBeOnTheScreen();
    expect(within(home).getByText("Vanlig avreise")).toBeOnTheScreen();
    expect(home).toHaveProp("accessibilityLabel", "Vanlig avreiseflyplass: ikke valgt");
    expect(home).toHaveProp("accessibilityHint", "Velg flyplass");

    await fireEvent.press(recent);
    expect(router.navigate).toHaveBeenLastCalledWith("/lagret");
    await fireEvent.press(saved);
    expect(router.navigate).toHaveBeenCalledTimes(2);
    expect(router.navigate).toHaveBeenLastCalledWith("/lagret");
    await fireEvent.press(home);
    expect(router.push).toHaveBeenLastCalledWith(HOME_PICKER);
    // «Reisevaner» sier det samme.
    const row = screen.getByTestId("home-airport-row");
    expect(within(row).getByText("Ikke valgt")).toBeOnTheScreen();
    expect(row).toHaveProp("accessibilityLabel", "Vanlig avreiseflyplass: ikke valgt");
  });

  it("«Kom i gang» når ingenting er lagret: én setning om hva som samles her, og veien til søket og Utforsk", async () => {
    await renderMinSide();
    const start = screen.getByTestId("hub-start");
    expect(within(start).getByText("Kom i gang")).toHaveProp("accessibilityRole", "header");
    expect(start).toHaveTextContent(/Søkene dine og reisemålene du lagrer, samles her – bare på denne telefonen\./);
    expect(screen.queryByTestId("hub-continue")).toBeNull();
    expect(screen.queryByTestId("hub-saved-destinations")).toBeNull();
    await fireEvent.press(screen.getByTestId("hub-start-search"));
    expect(router.navigate).toHaveBeenLastCalledWith("/");
    await fireEvent.press(screen.getByTestId("hub-start-explore"));
    expect(router.navigate).toHaveBeenLastCalledWith("/utforsk");
    for (const id of ["hub-start-search", "hub-start-explore"]) {
      expect(screen.getByTestId(id)).toHaveProp("accessibilityRole", "button");
      expect(flat(id).minHeight).toBeGreaterThanOrEqual(44);
    }
    inOrder(["account-hero", "hub-overview", "hub-start", "preferences-group", "settings-group", "help-card", "app-version"]);
  });

  it("engelsk: «Profile», og flisene med entall og flertall", async () => {
    seed({ recent: [search({ origin: OSL, destination: BCN, departDate: "2026-10-09", returnDate: "2026-10-16" })], saved: [{ id: "london", iata: "LHR" }] });
    await renderMinSide({ locale: "en" });
    expect(within(screen.getByTestId("sign-in-card")).getByText("Profile")).toHaveProp("accessibilityRole", "header");
    expect(screen.getByTestId("hub-recent")).toHaveProp("accessibilityLabel", "1 recent search");
    expect(screen.getByTestId("hub-saved")).toHaveProp("accessibilityLabel", "1 saved destination");
    expect(screen.getByTestId("hub-home-airport")).toHaveProp("accessibilityLabel", "Usual departure airport: not chosen");
    expect(screen.getByTestId("hub-recent")).toHaveProp("accessibilityHint", "Opens Saved");
    expect(screen.getByRole("header", { name: "Continue your search" })).toBeOnTheScreen();
  });
});

describe("Min side med søk, reisemål og vanlig avreiseflyplass", () => {
  // Nyeste først, som på telefonen: et passert søk ligger mellom de kommende.
  function seedAll() {
    seed({
      recent: [
        search({ origin: OSL, destination: BCN, departDate: "2026-10-09", returnDate: "2026-10-16" }),
        search({ origin: BGO, destination: LHR, departDate: "2026-09-10", returnDate: "2026-09-17" }),
        search({ tripType: "oneway", origin: OSL, destination: LHR, departDate: "2026-10-23", returnDate: "2026-10-30" }),
        search({ origin: BGO, destination: FCO, departDate: "2026-10-30", returnDate: "2026-11-06", adults: 2, cabinClass: "business", directOnly: true }),
      ],
      saved: [{ id: "barcelona", iata: "BCN" }, { id: "london", iata: "LHR" }],
      homeAirport: OSL,
    });
  }

  it("flisene teller alt på telefonen (4 søk, 2 reisemål) og viser den vanlige avreiseflyplassen", async () => {
    seedAll();
    await renderMinSide();
    expect(within(screen.getByTestId("hub-recent")).getByText("4")).toBeOnTheScreen();
    expect(screen.getByTestId("hub-recent")).toHaveProp("accessibilityLabel", "4 nylige søk");
    expect(within(screen.getByTestId("hub-saved")).getByText("2")).toBeOnTheScreen();
    expect(screen.getByTestId("hub-saved")).toHaveProp("accessibilityLabel", "2 lagrede reisemål");
    expect(within(screen.getByTestId("hub-home-airport")).getByText("OSL")).toBeOnTheScreen();
    expect(screen.getByTestId("hub-home-airport")).toHaveProp("accessibilityLabel", "Vanlig avreiseflyplass: Oslo (OSL)");
    expect(screen.queryByTestId("hub-start")).toBeNull();
    inOrder(["account-hero", "hub-overview", "hub-continue", "hub-saved-destinations", "preferences-group", "settings-group"]);
  });

  it("«Fortsett søket»: de tre nyeste som kan kjøres, i rekkefølge – det passerte står bare i Lagret", async () => {
    seedAll();
    await renderMinSide();
    const rows = idsInOrder().filter((id) => /^hub-recent-[A-Z]{3}-/.test(id));
    expect(rows).toEqual(["hub-recent-OSL-BCN-2026-10-09", "hub-recent-OSL-LHR-2026-10-23", "hub-recent-BGO-FCO-2026-10-30"]);
    expect(screen.queryByTestId("hub-recent-BGO-LHR-2026-09-10")).toBeNull();
    expect(within(screen.getByTestId("hub-continue")).getByText("Fortsett søket")).toHaveProp("accessibilityRole", "header");

    // Rute, nøyaktige koder med ikke-brytende bindestrek og det korte spennet; én vei sies; reisende og klasse under.
    const first = within(screen.getByTestId("hub-recent-OSL-BCN-2026-10-09"));
    expect(first.getByText("Oslo → Barcelona")).toBeOnTheScreen();
    expect(first.getByText("OSL\u2011BCN · 9.–16.\u00A0okt.")).toBeOnTheScreen();
    expect(first.getByText("1 voksen · Økonomi")).toBeOnTheScreen();
    expect(within(screen.getByTestId("hub-recent-OSL-LHR-2026-10-23")).getByText("OSL\u2011LHR · Én vei · 23.\u00A0okt.")).toBeOnTheScreen();
    const last = within(screen.getByTestId("hub-recent-BGO-FCO-2026-10-30"));
    expect(last.getByText("Bergen → Roma")).toBeOnTheScreen();
    expect(last.getByText("BGO\u2011FCO · 30.\u00A0okt. – 6.\u00A0nov.")).toBeOnTheScreen();
    expect(last.getByText("2 voksne · Business · Bare direktefly")).toBeOnTheScreen();

    // Hele raden er én knapp; VoiceOver hører hele datoene med ukedag.
    const row = screen.getByTestId("hub-recent-OSL-BCN-2026-10-09");
    expect(row).toHaveProp("accessibilityRole", "button");
    expect(row).toHaveProp("accessibilityLabel", "Søk igjen: Oslo → Barcelona, fre. 9. okt. – fre. 16. okt. · 1 voksen · Økonomi");
    expect(row).toHaveProp("accessibilityHint", "Søker på nytt med disse valgene");
    expect(screen.getByTestId("hub-recent-OSL-LHR-2026-10-23")).toHaveProp("accessibilityLabel", "Søk igjen: Oslo → London, Én vei · fre. 23. okt. · 1 voksen · Økonomi");
    expect(within(row).queryAllByRole("button")).toHaveLength(0);
    expect(flat("hub-recent-OSL-BCN-2026-10-09").minHeight).toBeGreaterThanOrEqual(64);
  });

  it("et trykk på en rad søker nøyaktig den reisen og åpner resultatene", async () => {
    seedAll();
    const server = await renderMinSide();
    await fireEvent.press(screen.getByTestId("hub-recent-OSL-BCN-2026-10-09"));
    expect(router.push).toHaveBeenCalledWith("/resultater");
    await waitFor(() => expect(searches(server)).toHaveLength(1));
    const input = searches(server)[0]!.input as { slices: { origin: string; destination: string; departureDate: string }[] };
    expect(input.slices).toEqual([
      { origin: "OSL", destination: "BCN", departureDate: "2026-10-09" },
      { origin: "BCN", destination: "OSL", departureDate: "2026-10-16" },
    ]);
    expect(screen.queryByTestId("hub-error")).toBeNull();
  });

  it("«Se alle» går til Lagret og sier det til VoiceOver", async () => {
    seedAll();
    await renderMinSide();
    const all = screen.getByTestId("hub-continue-all");
    expect(all).toHaveProp("accessibilityLabel", "Se alle nylige søk i Lagret");
    expect(within(all).getByText("Se alle")).toBeOnTheScreen();
    await fireEvent.press(all);
    expect(router.navigate).toHaveBeenLastCalledWith("/lagret");
    expect(screen.getByTestId("hub-saved-all")).toHaveProp("accessibilityLabel", "Se alle lagrede reisemål i Lagret");
    await fireEvent.press(screen.getByTestId("hub-saved-all"));
    expect(router.navigate).toHaveBeenCalledTimes(2);
    expect(router.navigate).toHaveBeenLastCalledWith("/lagret");
  });

  it("lagrede reisemål som fotokort i en rad fra kant til kant; et trykk søker dit fra den vanlige flyplassen", async () => {
    seedAll();
    const server = await renderMinSide();
    const saved = within(screen.getByTestId("hub-saved-destinations"));
    expect(saved.getByText("Lagrede reisemål")).toHaveProp("accessibilityRole", "header");
    expect(idsInOrder().filter((id) => /^hub-saved-(?!all$|destinations$|rail$)/.test(id))).toEqual(["hub-saved-barcelona", "hub-saved-london"]);
    const rail = screen.getByTestId("hub-saved-rail");
    expect(rail).toHaveProp("horizontal", true);
    expect(flat("hub-saved-rail").marginHorizontal).toBe(-space.lg);
    expect(screen.getByTestId("hub-saved-london")).toHaveProp("accessibilityLabel", "Se flyreiser til London, London Heathrow Airport");

    await fireEvent.press(screen.getByTestId("hub-saved-london"));
    expect(router.push).toHaveBeenCalledWith("/resultater");
    await waitFor(() => expect(searches(server)).toHaveLength(1));
    const input = searches(server)[0]!.input as { slices: { origin: string; destination: string }[] };
    expect(input.slices[0]).toMatchObject({ origin: "OSL", destination: "LHR" });
  });

  it("«Reisevaner»: vanlig avreiseflyplass med verdien, og raden åpner flyplassøket for den", async () => {
    seedAll();
    await renderMinSide();
    const group = within(screen.getByTestId("preferences-group"));
    expect(group.getByText("Reisevaner")).toHaveProp("accessibilityRole", "header");
    expect(group.getByText(HOME_HINT)).toBeOnTheScreen();
    const row = screen.getByTestId("home-airport-row");
    expect(within(row).getByText("Vanlig avreiseflyplass")).toBeOnTheScreen();
    expect(within(row).getByText("Oslo (OSL)")).toBeOnTheScreen();
    expect(row).toHaveProp("accessibilityLabel", "Vanlig avreiseflyplass: Oslo (OSL)");
    expect(row).toHaveProp("accessibilityHint", "Velg flyplass");
    await fireEvent.press(row);
    expect(router.push).toHaveBeenLastCalledWith(HOME_PICKER);
  });

  it("flere enn tre kommende søk: bare de tre nyeste står; flisen teller alle", async () => {
    seed({
      recent: ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"].map((d) => search({ origin: OSL, destination: BCN, departDate: d, returnDate: "2026-10-20" })),
    });
    await renderMinSide();
    expect(within(screen.getByTestId("hub-recent")).getByText("5")).toBeOnTheScreen();
    expect(idsInOrder().filter((id) => /^hub-recent-[A-Z]{3}-/.test(id))).toEqual(["hub-recent-OSL-BCN-2026-10-01", "hub-recent-OSL-BCN-2026-10-02", "hub-recent-OSL-BCN-2026-10-03"]);
    // Uten lagrede reisemål: ingen tom rad for dem.
    expect(screen.queryByTestId("hub-saved-destinations")).toBeNull();
  });

  it("bare passerte søk: ingen «Fortsett søket», men flisen teller dem og «Kom i gang» står", async () => {
    seed({ recent: [search({ origin: OSL, destination: BCN, departDate: "2026-09-10", returnDate: "2026-09-17" })] });
    await renderMinSide();
    expect(within(screen.getByTestId("hub-recent")).getByText("1")).toBeOnTheScreen();
    expect(screen.getByTestId("hub-recent")).toHaveProp("accessibilityLabel", "1 nylig søk");
    expect(screen.queryByTestId("hub-continue")).toBeNull();
    expect(screen.getByTestId("hub-start")).toBeOnTheScreen();
  });

  it("datoene passerte mens siden sto åpen: raden gir ruten med nye datoer på Hjem – uten å søke", async () => {
    seed({ recent: [search({ origin: OSL, destination: BCN, departDate: "2026-09-26", returnDate: "2026-10-03" })] });
    const server = await renderMinSide();
    const row = screen.getByTestId("hub-recent-OSL-BCN-2026-09-26");
    // To dager senere, uten at siden er tegnet på nytt.
    jest.setSystemTime(new Date(2026, 8, 27, 9, 0));
    await fireEvent.press(row);
    const fresh = initialForm();
    expect(screen.getByTestId("probe")).toHaveTextContent(`roundtrip OSL→BCN ${fresh.departDate}/${fresh.returnDate}`);
    expect(router.navigate).toHaveBeenLastCalledWith("/");
    expect(router.push).not.toHaveBeenCalledWith("/resultater");
    expect(searches(server)).toHaveLength(0);
    expect(screen.queryByTestId("hub-error")).toBeNull();
  });

  it("et søk som ikke kan kjøres (samme flyplass begge veier): feilen står over modulene og leses opp – ingen navigasjon", async () => {
    // Kunden bor i Tromsø og har lagret Tromsø: skjemaet starter fra TOS, så et søk dit er samme flyplass.
    seed({ saved: [{ id: "tromso", iata: "TOS" }, { id: "london", iata: "LHR" }], homeAirport: TOS });
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    const server = await renderMinSide();
    await fireEvent.press(screen.getByTestId("hub-saved-tromso"));
    const error = screen.getByTestId("hub-error");
    expect(error).toHaveTextContent("Avreise og reisemål kan ikke være samme flyplass.");
    expect(error).toHaveProp("accessibilityRole", "alert");
    expect(flat("hub-error").backgroundColor).toBe(colors.dangerSoft);
    expect(announce).toHaveBeenCalledWith("Avreise og reisemål kan ikke være samme flyplass.");
    expect(router.push).not.toHaveBeenCalled();
    expect(searches(server)).toHaveLength(0);
    inOrder(["hub-overview", "hub-error", "hub-saved-destinations"]);
    // Trykket førte ingen vei, så skjemaet er som før: Tromsø står ikke som reisemål.
    expect(screen.getByTestId("probe")).toHaveTextContent(/^roundtrip TOS→- /);

    // Et søk som går, tar feilen bort.
    await fireEvent.press(screen.getByTestId("hub-saved-london"));
    expect(screen.queryByTestId("hub-error")).toBeNull();
    expect(router.push).toHaveBeenCalledWith("/resultater");
    await waitFor(() => expect(searches(server)).toHaveLength(1));
  });

  it("et lagret reisemål som ikke kan søkes, bytter ikke ut reisen kunden holder på med", async () => {
    // Kunden planlegger Tromsø → Barcelona og trykker på det lagrede Tromsø: samme flyplass begge veier.
    const draft = search({ origin: TOS, destination: BCN, departDate: "2026-11-02", returnDate: "2026-11-09" });
    seed({ saved: [{ id: "tromso", iata: "TOS" }], draft });
    const server = await renderMinSide();
    expect(screen.getByTestId("probe")).toHaveTextContent("roundtrip TOS→BCN 2026-11-02/2026-11-09");
    await fireEvent.press(screen.getByTestId("hub-saved-tromso"));
    expect(screen.getByTestId("hub-error")).toHaveTextContent("Avreise og reisemål kan ikke være samme flyplass.");
    // Skjemaet – og utkastet på telefonen – står urørt, og ingenting er søkt.
    expect(screen.getByTestId("probe")).toHaveTextContent("roundtrip TOS→BCN 2026-11-02/2026-11-09");
    await waitFor(() => expect(readPref("draft", (v) => (v as SearchForm).destination?.iata)).toBe("BCN"));
    expect(searches(server)).toHaveLength(0);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("feilen gjelder søket slik det var: endres skjemaet et annet sted (som på Hjem), står den ikke lenger", async () => {
    seed({ saved: [{ id: "tromso", iata: "TOS" }], homeAirport: TOS });
    const server = await renderMinSide();
    await fireEvent.press(screen.getByTestId("hub-saved-tromso"));
    expect(screen.getByTestId("hub-error")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("change-origin"));
    expect(screen.getByTestId("probe")).toHaveTextContent(/^roundtrip BGO→- /);
    expect(screen.queryByTestId("hub-error")).toBeNull();
    // Nå går søket.
    await fireEvent.press(screen.getByTestId("hub-saved-tromso"));
    expect(router.push).toHaveBeenCalledWith("/resultater");
    await waitFor(() => expect(searches(server)).toHaveLength(1));
  });

  it("alt VoiceOver kan stoppe på har språket, også flisene, radene og fotokortene", async () => {
    seedAll();
    await renderMinSide();
    for (const id of ["hub-recent", "hub-home-airport", "hub-recent-OSL-BCN-2026-10-09", "hub-continue-all", "hub-saved-barcelona", "home-airport-row"]) {
      expect(screen.getByTestId(id)).toHaveProp("accessibilityLanguage", "nb-NO");
    }
    expect(withoutLanguage("nb-NO", (id) => id === "probe" || id === "change-origin")).toEqual([]);
  });
});

describe("Min side innlogget", () => {
  it("hilsenen og e-postadressen i grafitten; initialene er bare pynt", async () => {
    await renderMinSide({ signedIn: true });
    const hero = within(screen.getByTestId("account-hero"));
    expect(hero.getByText("Hei, Kari")).toHaveProp("accessibilityRole", "header");
    expect(hero.getByText("kari@example.no")).toBeOnTheScreen();
    expect(screen.queryByText("KN")).toBeNull();
    expect(screen.getByText("KN", { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByTestId("sign-in-card")).toBeNull();
    expect(screen.queryByTestId("open-login")).toBeNull();
    // Oversikten står for innloggede også.
    expect(hero.getByTestId("hub-overview")).toBeOnTheScreen();
  });

  it("rekkefølgen: grafitten, oversikten, modulene, reisevaner, kontoen, hellosky.no, innstillinger, hjelp, logg ut, slett, versjon", async () => {
    await renderMinSide({ signedIn: true });
    inOrder([
      "account-hero",
      "hub-overview",
      "hub-start",
      "preferences-group",
      "account-card",
      "web-account-group",
      "settings-group",
      "help-card",
      "logout-button",
      "open-delete-account",
      "app-version",
    ]);
  });

  it("«På hellosky.no»: kundens sider som lenker med hint, åpnet i Safari-visning", async () => {
    await renderMinSide({ signedIn: true });
    const group = within(screen.getByTestId("web-account-group"));
    expect(group.getByText("På hellosky.no")).toHaveProp("accessibilityRole", "header");
    expect(group.getByText("Sidene åpnes på hellosky.no. Første gang logger du inn der med samme konto.")).toBeOnTheScreen();
    // «Mine reiser» er bestillinger gjort på nettet – linjen under sier det, så ingen leter etter appens søk der.
    expect(within(screen.getByTestId("link-trips")).getByText("Bestillinger gjort på hellosky.no")).toBeOnTheScreen();
    for (const [id, label, url] of [
      ["link-trips", "Mine reiser, Bestillinger gjort på hellosky.no", WEB_PAGES.trips],
      ["link-travellers", "Reisende", WEB_PAGES.travellers],
      ["link-price-alerts", "Prisvarsler", WEB_PAGES.priceAlerts],
      ["link-security", "Sikkerhet og innlogging", WEB_PAGES.security],
    ] as const) {
      const link = screen.getByTestId(id);
      expect(link).toHaveProp("accessibilityRole", "link");
      expect(link).toHaveProp("accessibilityLabel", label);
      expect(link).toHaveProp("accessibilityHint", "Åpner hellosky.no");
      expect(flat(id).minHeight).toBeGreaterThanOrEqual(44);
      await fireEvent.press(link);
      expect(WebBrowser.openBrowserAsync).toHaveBeenLastCalledWith(url, expect.anything());
    }
    expect([WEB_PAGES.trips, WEB_PAGES.travellers, WEB_PAGES.priceAlerts, WEB_PAGES.security]).toEqual([
      "https://hellosky.no/reiser",
      "https://hellosky.no/profil/reisende",
      "https://hellosky.no/profil/prisvarsler",
      "https://hellosky.no/profil/sikkerhet",
    ]);
  });

  it("engelsk: sidene på hellosky.no er på norsk, og det sies", async () => {
    await renderMinSide({ signedIn: true, locale: "en" });
    const group = within(screen.getByTestId("web-account-group"));
    expect(group.getByText("On hellosky.no")).toBeOnTheScreen();
    expect(group.getByText("These pages open on hellosky.no and are in Norwegian. The first time, you log in there with the same account.")).toBeOnTheScreen();
    expect(screen.getByTestId("link-trips")).toHaveProp("accessibilityLabel", "My trips, Bookings made on hellosky.no");
  });

  it("«Profilen er lagret» står rett over kontoen (der kunden er når arket lukkes), som et lyst varsel", async () => {
    await renderMinSide({ signedIn: true, routes: { "mobileAuth.updateProfile": (req) => ({ data: { ...PROFILE, ...(req.input as object) } }) } });
    expect(screen.queryByTestId("profile-saved")).toBeNull();
    expect(colorOf(within(screen.getByTestId("account-card")).getByText("Konto"))).toBe(colors.text);
    await fireEvent.press(screen.getByTestId("open-edit-profile"));
    await fireEvent.changeText(screen.getByTestId("edit-first-name"), "Karianne");
    await fireEvent.press(screen.getByTestId("edit-save"));
    await waitFor(() => expect(screen.getByTestId("profile-saved")).toHaveTextContent("Profilen er lagret."));
    expect(flat("profile-saved").backgroundColor).toBe(colors.blueSoft);
    inOrder(["preferences-group", "profile-saved", "account-card"]);
    // Hilsenen i grafitten følger det nye navnet.
    expect(within(screen.getByTestId("account-hero")).getByText("Hei, Karianne")).toBeOnTheScreen();
  });

  it("utløpt økt: tilbake til innloggingen, med et lyst varsel under grafitten", async () => {
    await renderMinSide({ signedIn: true, routes: { "mobileAuth.updateProfile": () => ({ status: 401, error: { message: "Du må logge inn.", appCode: "UNAUTHORIZED" } }) } });
    await fireEvent.press(screen.getByTestId("open-edit-profile"));
    await fireEvent.press(screen.getByTestId("edit-save"));
    await waitFor(() => expect(screen.getByTestId("auth-notice-expired")).toBeOnTheScreen());
    expect(flat("auth-notice-expired").backgroundColor).toBe(colors.warningSoft);
    expect(screen.getByTestId("sign-in-card")).toBeOnTheScreen();
    inOrder(["account-hero", "auth-notice-expired", "hub-start"]);
  });
});

describe("konto uten navn (Google/Apple uten navn)", () => {
  // Serveren lagrer «Reisende» som fornavn når leverandøren ikke oppga navn (api/customerAuth.ts). Det er ikke et navn.
  const NAMELESS: CustomerProfile = { ...PROFILE, firstName: NAMELESS_FIRST_NAME, lastName: "", hasPassword: false };

  it("bare et ekte fornavn hilses med: tomt, bare mellomrom og serverens plassholder er ikke navn", () => {
    expect(NAMELESS_FIRST_NAME).toBe("Reisende");
    expect(greetingName({ firstName: "Kari" })).toBe("Kari");
    expect(greetingName({ firstName: "  Kari " })).toBe("Kari");
    for (const firstName of ["", "   ", "Reisende", " Reisende "]) expect(greetingName({ firstName })).toBeNull();
    expect(greetingName(null)).toBeNull();
  });

  it.each([
    ["nb", "Du er logget inn", "Hei, Reisende"],
    ["en", "You're logged in", "Hi, Reisende"],
  ] as const)("Min side (%s): «%s» i stedet for en hilsen med plassholderen, og et ikon i stedet for initialer", async (locale, signedInText, wrong) => {
    await renderMinSide({ signedIn: true, locale, profile: NAMELESS });
    const hero = within(screen.getByTestId("account-hero"));
    expect(hero.getByText(signedInText)).toHaveProp("accessibilityRole", "header");
    expect(screen.queryByText(wrong)).toBeNull();
    expect(screen.queryByText("R", { includeHiddenElements: true })).toBeNull();
    // Adressen står fortsatt, så kunden ser hvilken konto det er.
    expect(hero.getByText("kari@example.no")).toBeOnTheScreen();
  });

  it("et fornavn med bare mellomrom gir heller ingen hilsen", async () => {
    await renderMinSide({ signedIn: true, profile: { ...PROFILE, firstName: "   " } });
    expect(within(screen.getByTestId("account-hero")).getByText("Du er logget inn")).toBeOnTheScreen();
    expect(screen.queryByText(/^Hei,/)).toBeNull();
  });

  it("Hjem: spørsmålet står i stedet for «God …, Reisende», og kontoknappen har ingen initialer fra plassholderen", async () => {
    keychain.set("hellosky.customer-session", { value: JSON.stringify({ token: TOKEN, expiresAt: "2099-01-01T00:00:00Z" }), options: {} });
    const server = fakeServer({ "mobileAuth.me": () => ({ data: NAMELESS }) });
    const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
    await render(
      <AppProvider initialLocale="nb" apiFactory={factory}>
        <HomeScreen />
      </AppProvider>,
    );
    // Innlogget: kontoknappen er sirkelen (for gjester er den en ikonknapp med lys kant).
    await waitFor(() => expect(flat("account-button").backgroundColor).toBe(colors.blue));
    expect(screen.getByTestId("home-title")).toHaveTextContent("Hvor vil du reise?");
    // («Reisende» står også som feltet for antall reisende i søket – det er ikke det som prøves her.)
    expect(screen.queryByText(/, Reisende$/)).toBeNull();
    expect(screen.getByTestId("account-button")).not.toHaveTextContent(/R/);
  });
});

describe("Min side i «Cloud + Graphite»", () => {
  beforeEach(() => {
    jest.spyOn(SafeArea, "useSafeAreaInsets").mockReturnValue({ top: TOP, bottom: 34, left: 0, right: 0 });
  });

  it("grafittøya går opp under statuslinjen, med runde hjørner nederst; siden under er lys", async () => {
    await renderMinSide();
    expect(flat("account-signed-out").backgroundColor).toBe(colors.canvas);
    expect(flat("account-hero")).toMatchObject({ backgroundColor: colors.raised, borderBottomLeftRadius: radius.sheet, borderBottomRightRadius: radius.sheet, paddingTop: TOP + space.lg, paddingHorizontal: space.lg, paddingBottom: space.xl });
    expect(colorOf(within(screen.getByTestId("sign-in-card")).getByText("Min side"))).toBe(colors.onDark);
    // Gruppene under står på den lyse grunnen: overskrifter i tekstfarge, merknader og versjon sekundærfarget.
    expect(colorOf(within(screen.getByTestId("settings-group")).getByText("Innstillinger"))).toBe(colors.text);
    expect(colorOf(within(screen.getByTestId("preferences-group")).getByText(HOME_HINT))).toBe(colors.textSecondary);
    expect(colorOf(screen.getByTestId("app-version"))).toBe(colors.textSecondary);
    expect(flat("hub-start").backgroundColor).toBe(colors.white);
  });

  it("statuslinjen: lys tekst over grafitten; rullet forbi øya blir den mørk med en lys skjerm bak – og tilbake", async () => {
    await renderMinSide();
    expect(statusBarStyle()).toBe("light");
    expect(screen.queryByTestId("status-bar-shield")).toBeNull();
    await fireEvent(screen.getByTestId("account-hero"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 320 } } });
    // Øya er 320 pt; statuslinjen er 59 pt. Ved 250 ligger grafitten fortsatt under den.
    await fireEvent.scroll(screen.getByTestId("account-signed-out"), { nativeEvent: { contentOffset: { x: 0, y: 250 } } });
    expect(statusBarStyle()).toBe("light");
    expect(screen.queryByTestId("status-bar-shield")).toBeNull();
    await fireEvent.scroll(screen.getByTestId("account-signed-out"), { nativeEvent: { contentOffset: { x: 0, y: 300 } } });
    expect(statusBarStyle()).toBe("dark");
    expect(flat("status-bar-shield")).toMatchObject({ height: TOP, backgroundColor: colors.canvas });
    await fireEvent.scroll(screen.getByTestId("account-signed-out"), { nativeEvent: { contentOffset: { x: 0, y: 20 } } });
    expect(statusBarStyle()).toBe("light");
    expect(screen.queryByTestId("status-bar-shield")).toBeNull();
  });

  it("flisene: tre like knapper på minst 72 pt i grafitt, tallet med tabellsifre; ingen tekst har linjegrense", async () => {
    seed({ recent: [search({ origin: OSL, destination: BCN, departDate: "2026-10-09", returnDate: "2026-10-16" })], homeAirport: OSL });
    await renderMinSide();
    const tiles = ["hub-recent", "hub-saved", "hub-home-airport"];
    for (const id of tiles) {
      expect(flat(id)).toMatchObject({ backgroundColor: colors.bg, borderColor: colors.darkBorder, borderWidth: 1, borderRadius: radius.input, padding: space.md });
      expect(flat(id).minHeight).toBeGreaterThanOrEqual(72);
      const [value, label] = within(screen.getByTestId(id)).getAllByText(/.+/);
      expect(StyleSheet.flatten(value!.props.style)).toMatchObject({ color: colors.onDark, fontVariant: ["tabular-nums"] });
      expect(colorOf(label!)).toBe(colors.onDarkMuted);
    }
    // Like brede: samme grunnbredde og vekst for alle tre.
    expect(new Set(tiles.map((id) => flat(id).flexBasis)).size).toBe(1);
    expect(new Set(tiles.map((id) => flat(id).flexGrow)).size).toBe(1);
    // Stor tekst bryter linjen i stedet for å kutte (fotokortene er Utforsks egne og prøves der).
    for (const id of ["hub-overview", "hub-continue", "preferences-group", "sign-in-card"]) {
      for (const text of within(screen.getByTestId(id)).getAllByText(/.+/)) expect(text.props.numberOfLines).toBeUndefined();
    }
  });

  it("stor tekst: en rads verdi står under tittelen, så et langt ord i tittelen aldri deles – med vanlig tekst står den til høyre", async () => {
    seed({ homeAirport: OSL });
    // Kopier: Dimensions.get gir objektet Dimensions.set endrer.
    const base = { ...Dimensions.get("window") };
    const baseScreen = { ...Dimensions.get("screen") };
    try {
      await act(async () => Dimensions.set({ window: { ...base, fontScale: 1.35 }, screen: { ...baseScreen, fontScale: 1.35 } }));
      await renderMinSide();
      const stacked = within(screen.getByTestId("home-airport-row")).getByText("Oslo (OSL)");
      expect(StyleSheet.flatten(stacked.props.style).maxWidth).toBeUndefined();
      expect(colorOf(stacked)).toBe(colors.textSecondary);
      // VoiceOver hører det samme som før.
      expect(screen.getByTestId("home-airport-row")).toHaveProp("accessibilityLabel", "Vanlig avreiseflyplass: Oslo (OSL)");
      // Vanlig tekst (Jest-oppsettets standard er fontScale 2, så den settes her): verdien står til høyre.
      await act(async () => Dimensions.set({ window: { ...base, fontScale: 1 }, screen: { ...baseScreen, fontScale: 1 } }));
      await renderMinSide();
      expect(StyleSheet.flatten(within(screen.getByTestId("home-airport-row")).getByText("Oslo (OSL)").props.style).maxWidth).toBe("55%");
    } finally {
      await act(async () => Dimensions.set({ window: base, screen: baseScreen }));
    }
  });

  it("«Logg inn» (blå) og «Opprett konto» (mørk) er like høye, i en rad som brytes når etikettene ikke får plass", async () => {
    await renderMinSide();
    expect(flat("open-login")).toMatchObject({ minHeight: 44, backgroundColor: colors.blue });
    expect(flat("open-register")).toMatchObject({ minHeight: 44, backgroundColor: colors.raised, borderColor: colors.darkBorder });
    expect(colorOf(within(screen.getByTestId("open-register")).getByText("Opprett konto"))).toBe(colors.onDark);
    expect(flat("sign-in-actions")).toMatchObject({ flexDirection: "row", flexWrap: "wrap" });
  });
});

describe("flyplassøket fra Min side (vanlig avreiseflyplass)", () => {
  async function renderPicker(params: Record<string, string>, locale: "nb" | "en" = "nb") {
    setParams(params);
    const server = fakeServer({ "mobileAuth.me": () => ({ data: null }), "flights.airports": () => ({ data: [] }) });
    const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
    await render(
      <AppProvider initialLocale={locale} apiFactory={factory}>
        <AirportPicker />
        <Probe />
      </AppProvider>,
    );
  }

  it("med hjem=1: «Glem» glemmer den vanlige flyplassen – søket her står åpent, og skjemaet er urørt", async () => {
    seed({ homeAirport: OSL });
    await renderPicker({ felt: "fra", hjem: "1" });
    expect(screen.getByTestId("home-airport")).toHaveTextContent(/^Vanlig avreiseflyplass: Oslo \(OSL\)Glem$/);
    const before = screen.getByTestId("probe").props.children as string;
    await fireEvent.press(screen.getByTestId("forget-home-airport"));
    expect(readPref("homeAirport", (v) => v)).toBeNull();
    expect(screen.queryByTestId("home-airport")).toBeNull();
    // Forklaringen står fortsatt, og kunden kan velge en ny.
    expect(screen.getByTestId("home-airport-note")).toHaveTextContent(HOME_HINT);
    expect(router.back).not.toHaveBeenCalled();
    expect(screen.getByTestId("probe").props.children).toBe(before);
  });

  it("engelsk: den vanlige flyplassen står med byen på appens språk, som på Min side (lagret «København»)", async () => {
    seed({ homeAirport: { iata: "CPH", name: "København lufthavn Kastrup", city: "København", country: "Danmark" } });
    await renderPicker({ felt: "fra", hjem: "1" }, "en");
    expect(screen.getByTestId("home-airport")).toHaveTextContent(/^Usual departure airport: Copenhagen \(CPH\)Forget$/);
    expect(screen.getByTestId("home-airport-note")).toHaveTextContent("Saved only on this phone. Your search starts from it when you open the app, unless you're in the middle of planning a trip.");
  });

  it("med hjem=1: egen tittel og spørsmål, ingen bryter – forklaringen står; valget huskes, blir «Fra» og lukker", async () => {
    await renderPicker({ felt: "fra", hjem: "1" });
    expect(screen.getByRole("header", { name: "Vanlig avreiseflyplass" })).toBeOnTheScreen();
    expect(screen.getByTestId("airport-query")).toHaveProp("accessibilityLabel", "Hvor reiser du vanligvis fra?");
    expect(screen.queryByTestId("remember-home-airport")).toBeNull();
    expect(screen.getByTestId("home-airport-note")).toHaveTextContent(HOME_HINT);
    expect(readPref("homeAirport", (v) => v)).toBeNull();

    await fireEvent.press(within(screen.getByTestId("airport-suggestions")).getByTestId("airport-BGO"));
    expect(readPref("homeAirport", (v) => (v as { iata: string }).iata)).toBe("BGO");
    expect(screen.getByTestId("probe")).toHaveTextContent(/^roundtrip BGO→/);
    expect(router.back).toHaveBeenCalledTimes(1);
    // Den valgte står nå som vanlig avreiseflyplass, med «Glem».
    expect(screen.getByTestId("home-airport")).toHaveTextContent(/^Vanlig avreiseflyplass: Bergen \(BGO\)Glem$/);
  });

  it("med en vanlig flyplass fra før: den står med «Glem», og et nytt valg erstatter den", async () => {
    writePref("homeAirport", OSL);
    __resetLocalStoreForTests();
    await renderPicker({ felt: "fra", hjem: "1" });
    expect(screen.getByTestId("home-airport")).toHaveTextContent(/^Vanlig avreiseflyplass: Oslo \(OSL\)Glem$/);
    await fireEvent.press(within(screen.getByTestId("airport-suggestions")).getByTestId("airport-TOS"));
    expect(readPref("homeAirport", (v) => (v as { iata: string }).iata)).toBe("TOS");
    expect(screen.getByTestId("probe")).toHaveTextContent(/^roundtrip TOS→/);
  });

  it("uten hjem=1: som før – «Velg flyplass», bryteren står, og et valg uten den huskes ikke", async () => {
    await renderPicker({ felt: "fra" });
    expect(screen.getByRole("header", { name: "Velg flyplass" })).toBeOnTheScreen();
    expect(screen.getByTestId("airport-query")).toHaveProp("accessibilityLabel", "Hvor reiser du fra?");
    expect(screen.getByTestId("remember-home-airport")).toBeOnTheScreen();
    expect(screen.queryByTestId("home-airport-note")).toBeNull();
    await fireEvent.press(within(screen.getByTestId("airport-suggestions")).getByTestId("airport-BGO"));
    expect(readPref("homeAirport", (v) => v)).toBeNull();
    expect(screen.getByTestId("probe")).toHaveTextContent(/^roundtrip BGO→/);
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("hjem=1 gjelder bare «Fra»: for «Til» er det vanlig flyplassøk, og ingenting huskes", async () => {
    await renderPicker({ felt: "til", hjem: "1" });
    expect(screen.getByRole("header", { name: "Velg flyplass" })).toBeOnTheScreen();
    expect(screen.queryByTestId("home-airport-note")).toBeNull();
    await fireEvent.press(within(screen.getByTestId("airport-suggestions")).getByTestId("airport-BCN"));
    expect(readPref("homeAirport", (v) => v)).toBeNull();
    expect(screen.getByTestId("probe")).toHaveTextContent(/→BCN /);
  });
});

describe("vanlig avreiseflyplass når appen åpnes (lib/appState.tsx)", () => {
  /** Appen startes med det som ligger på telefonen; svaret er skjemaet slik søket ser det. */
  async function start(): Promise<string> {
    const server = fakeServer({ "mobileAuth.me": () => ({ data: null }) });
    const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
    await render(
      <AppProvider initialLocale="nb" apiFactory={factory}>
        <Probe />
      </AppProvider>,
    );
    return screen.getByTestId("probe").props.children as string;
  }
  /** Standarddatoene (om to uker, én uke) – dit flyttes et utkast med passerte datoer. */
  const fresh = () => `${initialForm().departDate}/${initialForm().returnDate}`;

  it("uten utkast: søket starter fra den vanlige flyplassen", async () => {
    seed({ homeAirport: BGO });
    expect(await start()).toBe(`roundtrip BGO→- ${fresh()}`);
  });

  it("et gammelt utkast (avreisen har passert): «Fra» blir den vanlige flyplassen; reisemålet står, med nye datoer", async () => {
    seed({ homeAirport: BGO, draft: search({ origin: OSL, destination: BCN, departDate: "2026-09-10", returnDate: "2026-09-17" }) });
    expect(await start()).toBe(`roundtrip BGO→BCN ${fresh()}`);
  });

  it("et utkast uten reisemål ennå: «Fra» blir den vanlige flyplassen; datoene står", async () => {
    seed({ homeAirport: BGO, draft: search({ origin: TOS, destination: null, departDate: "2026-11-02", returnDate: "2026-11-09" }) });
    expect(await start()).toBe("roundtrip BGO→- 2026-11-02/2026-11-09");
  });

  it("en reise under planlegging (reisemål og datoer som ikke har passert) står som den var", async () => {
    seed({ homeAirport: BGO, draft: search({ origin: TOS, destination: BCN, departDate: "2026-11-02", returnDate: "2026-11-09" }) });
    expect(await start()).toBe("roundtrip TOS→BCN 2026-11-02/2026-11-09");
  });

  it("avreise i dag har ikke passert: reisen står", async () => {
    seed({ homeAirport: BGO, draft: search({ origin: TOS, destination: BCN, departDate: "2026-09-25", returnDate: "2026-09-30" }) });
    expect(await start()).toBe("roundtrip TOS→BCN 2026-09-25/2026-09-30");
  });

  it("et gammelt utkast til den vanlige flyplassen: reisemålet tas bort, så «Fra» og «Til» aldri er like", async () => {
    seed({ homeAirport: BGO, draft: search({ origin: OSL, destination: BGO, departDate: "2026-09-10", returnDate: "2026-09-17" }) });
    expect(await start()).toBe(`roundtrip BGO→- ${fresh()}`);
  });

  it("uten vanlig flyplass er utkastet som før: passerte datoer flyttes fram, og «Fra» står", async () => {
    seed({ draft: search({ origin: TOS, destination: BCN, departDate: "2026-09-10", returnDate: "2026-09-17" }) });
    expect(await start()).toBe(`roundtrip TOS→BCN ${fresh()}`);
  });
});
