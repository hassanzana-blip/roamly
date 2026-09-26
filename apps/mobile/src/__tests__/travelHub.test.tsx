import { useEffect, type ReactNode } from "react";
import { Share, StyleSheet, Text as RNText, type StyleProp, type ViewStyle } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import type { MobileAccountHub, MobileTraveller } from "@contracts/mobileAccount";
import type { MobileSearchResult } from "@contracts/mobileSearch";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { WEB_PAGES } from "../lib/config";
import { __resetLocalStoreForTests, readPref, writePref } from "../lib/localStore";
import { flightFromOffer } from "../lib/savedTrips";
import { initialForm, type SearchForm } from "../lib/searchForm";
import { fakeServer, type Recorded } from "../test/fakeServer";
import { NOK_OFFER, PROFILE, SEARCH_RESULT, TOKEN } from "../test/fixtures";
import { pinClock } from "../test/clock";
import AccountScreen from "../app/(tabs)/profil";
import SavedScreen from "../app/(tabs)/lagret";
import ResultsScreen from "../app/resultater";
import { SaveFlightButton } from "../components/SaveFlightButton";

// Min side som reisehub og Lagret som eget produktområde: kontoens egne data gjennom mobil-API-et (mobileAccount.*)
// når serveren har dem, ellers det som ligger på telefonen – aldri oppdiktede reiser, priser, varsler eller bonus.
// Ekte skjermer, ekte app-tilstand og ekte localStore; klokken står fast på fredag 25. september 2026.

jest.mock("expo-status-bar", () => {
  const { View } = jest.requireActual("react-native");
  return { StatusBar: () => <View /> };
});
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { version: "1.0.0" } } }));

const router = (globalThis as unknown as { __router: { push: jest.Mock; navigate: jest.Mock } }).__router;
const setParams = (globalThis as unknown as { __setParams: (p: Record<string, string>) => void }).__setParams;
const keychain = (SecureStore as unknown as { __store: Map<string, { value: string; options: unknown }> }).__store;

const OSL = { iata: "OSL", name: "Oslo lufthavn Gardermoen", city: "Oslo", country: "Norge" };
const BCN = { iata: "BCN", name: "Barcelona-El Prat", city: "Barcelona", country: "Spania" };
const TRF = { iata: "TRF", name: "Sandefjord lufthavn Torp", city: "Sandefjord", country: "Norge" };

const HUB: MobileAccountHub = {
  nextTrip: { bookingReference: "HS7K2Q", originIata: "OSL", originCity: "Oslo", destinationIata: "BCN", destinationCity: "Barcelona", departingAt: "2026-10-09T07:05:00", returningAt: "2026-10-16T18:00:00", passengerCount: 2 },
  upcomingTrips: 2,
  saved: { destinations: 1, flights: 0, routes: 0 },
  travellers: 1,
  priceWatches: 2,
  unreadNotifications: 1,
};
const EMPTY_HUB: MobileAccountHub = { nextTrip: null, upcomingTrips: 0, saved: { destinations: 0, flights: 0, routes: 0 }, travellers: 0, priceWatches: 0, unreadNotifications: 0 };
const ACCOUNT_PER: MobileTraveller = { id: 41, firstName: "Per", lastName: "Nordmann", kind: "child", cabin: null };

const QUERY: SearchForm = { ...initialForm(), origin: OSL, destination: BCN, departDate: "2026-10-23", returnDate: "2026-10-30" };
const SAVED_FLIGHT = flightFromOffer(NOK_OFFER, QUERY, new Date("2026-09-25T12:05:00"));

type Routes = Parameters<typeof fakeServer>[0];

/** Det som ligger på telefonen før appen starter (som en omstart). */
function seed(prefs: Record<string, unknown>) {
  for (const [k, v] of Object.entries(prefs)) writePref(k, v);
  __resetLocalStoreForTests();
}

function Probe() {
  const { form, travellers, savedFlights, savedRoutes } = useApp();
  return <RNText testID="probe">{`${form.origin?.iata ?? "-"}→${form.destination?.iata ?? "-"} ${form.cabinClass} t${travellers.length} f${savedFlights.length} r${savedRoutes.length}`}</RNText>;
}

async function renderApp(ui: ReactNode, { signedIn = false, routes = {} }: { signedIn?: boolean; routes?: Routes } = {}) {
  if (signedIn) keychain.set("hellosky.customer-session", { value: JSON.stringify({ token: TOKEN, expiresAt: "2099-01-01T00:00:00Z" }), options: {} });
  const server = fakeServer({ "mobileAuth.me": () => ({ data: signedIn ? PROFILE : null }), "flights.search": () => ({ data: SEARCH_RESULT }), ...routes });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  const view = await render(
    <AppProvider initialLocale="nb" apiFactory={factory}>
      {ui}
      <Probe />
    </AppProvider>,
  );
  return { server, view };
}

const account = (s: { calls: Recorded[] }) => s.calls.filter((c) => c.path.startsWith("mobileAccount."));
const flat = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as StyleProp<ViewStyle>);

beforeEach(() => {
  pinClock();
  keychain.clear();
  (WebBrowser.openBrowserAsync as jest.Mock).mockClear();
  for (const key of ["recent", "saved", "homeAirport", "draft", "travelPrefs", "travellers", "savedFlights", "savedRoutes"]) writePref(key, null);
  __resetLocalStoreForTests();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("Min side: kontoens data (mobileAccount.hub)", () => {
  const routes = (over: Routes = {}): Routes => ({
    "mobileAccount.hub": () => ({ data: HUB }),
    "mobileAccount.travellers": () => ({ data: [ACCOUNT_PER] }),
    ...over,
  });

  it("neste reise er kontoens bestilling – med bestillingsnummer, merket «Bestilt på hellosky.no», og åpner Mine reiser", async () => {
    const { server } = await renderApp(<AccountScreen />, { signedIn: true, routes: routes() });
    await waitFor(() => expect(screen.getByTestId("next-trip")).toBeOnTheScreen());
    const card = within(screen.getByTestId("next-trip"));
    expect(card.getByText("Oslo → Barcelona")).toBeOnTheScreen();
    expect(card.getByText(/^OSL.BCN · 9\.–16\..okt\.$/)).toBeOnTheScreen();
    expect(card.getByText("Bestillingsnr. HS7K2Q · 2 reisende")).toBeOnTheScreen();
    expect(card.getByText("Bestilt på hellosky.no")).toBeOnTheScreen();
    expect(card.getByText("1 reise til er bestilt")).toBeOnTheScreen();
    const link = screen.getByTestId("next-trip");
    expect(link).toHaveProp("accessibilityRole", "link");
    expect(link.props.accessibilityLabel).toMatch(/^Neste reise: Oslo → Barcelona, 9\.–16\..okt\.\. Bestillingsnummer HS7K2Q$/);
    await fireEvent.press(link);
    expect(WebBrowser.openBrowserAsync).toHaveBeenLastCalledWith(WEB_PAGES.trips, expect.anything());
    // Med token, bare lesing.
    const hub = account(server).find((c) => c.path === "mobileAccount.hub")!;
    expect(hub.method).toBe("GET");
    expect(hub.headers.authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("tallene er kontoens: aktive prisvarsler, uleste meldinger og kommende reiser – og ingen bonus eller nivå", async () => {
    await renderApp(<AccountScreen />, { signedIn: true, routes: routes() });
    await waitFor(() => expect(within(screen.getByTestId("link-price-alerts")).getByText("2 aktive")).toBeOnTheScreen());
    expect(within(screen.getByTestId("link-inbox")).getByText("1 ulest")).toBeOnTheScreen();
    expect(within(screen.getByTestId("link-trips")).getByText("2 kommende")).toBeOnTheScreen();
    expect(screen.queryByText(/bonus|nivå|poeng|sølv|gull/i)).toBeNull();
  });

  it("reisende på kontoen: listen og flisen er kontoens; ny reisende sendes med bare navn, type og klasse", async () => {
    const { server } = await renderApp(<AccountScreen />, {
      signedIn: true,
      routes: routes({ "mobileAccount.saveTraveller": (req) => ({ data: { id: 42, ...(req.input as object) } }) }),
    });
    await waitFor(() => expect(screen.getByTestId("traveller-a41")).toBeOnTheScreen());
    expect(screen.getByTestId("traveller-a41")).toHaveProp("accessibilityLabel", "Per Nordmann, Barn");
    expect(screen.getByTestId("travellers-note")).toHaveTextContent("På kontoen din – de samme som på hellosky.no.");
    expect(within(screen.getByTestId("hub-travellers")).getByText("1")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("traveller-add"));
    expect(screen.getByTestId("traveller-privacy")).toHaveTextContent("Bare navn og type. Pass eller ID oppgir du til flyselskapet eller byrået når du bestiller.");
    await fireEvent.changeText(screen.getByTestId("traveller-first-name"), " Liv ");
    await fireEvent.changeText(screen.getByTestId("traveller-last-name"), "Nordmann");
    await fireEvent.press(screen.getByTestId("traveller-kind-infant"));
    await fireEvent.press(screen.getByTestId("traveller-cabin-business"));
    await fireEvent.press(screen.getByTestId("traveller-save"));
    await waitFor(() => expect(screen.getByTestId("traveller-a42")).toBeOnTheScreen());
    const saved = account(server).find((c) => c.path === "mobileAccount.saveTraveller")!;
    expect(saved.method).toBe("POST");
    expect(saved.input).toEqual({ firstName: "Liv", lastName: "Nordmann", kind: "infant", cabin: "business" });
    expect(within(screen.getByTestId("hub-travellers")).getByText("2")).toBeOnTheScreen();
    // Ingenting ble lagret på telefonen.
    expect(readPref("travellers", (v) => v)).toBeNull();
  });

  it("reisende som bare ligger på telefonen, kan flyttes til kontoen med ett trykk", async () => {
    seed({ travellers: [{ id: "l1", firstName: "Ola", lastName: "Nordmann", kind: "adult", cabin: null }] });
    const { server } = await renderApp(<AccountScreen />, {
      signedIn: true,
      routes: routes({ "mobileAccount.saveTraveller": (req) => ({ data: { id: 43, ...(req.input as object) } }) }),
    });
    await waitFor(() => expect(screen.getByTestId("travellers-move")).toBeOnTheScreen());
    expect(screen.getByTestId("travellers-move")).toHaveTextContent(/1 reisende er lagret bare på denne telefonen\./);
    await fireEvent.press(screen.getByTestId("travellers-move-button"));
    await waitFor(() => expect(screen.queryByTestId("travellers-move")).toBeNull());
    expect(account(server).filter((c) => c.path === "mobileAccount.saveTraveller").map((c) => c.input)).toEqual([{ firstName: "Ola", lastName: "Nordmann", kind: "adult", cabin: null }]);
    expect(screen.getByTestId("traveller-a43")).toBeOnTheScreen();
    expect(screen.getByTestId("probe")).toHaveTextContent(/ t0 /);
  });

  it("en server uten kontorutene (404): ingen tall, ingen feilmelding – bare telefonens data og lenkene", async () => {
    await renderApp(<AccountScreen />, { signedIn: true });
    await waitFor(() => expect(screen.getByTestId("account-card")).toBeOnTheScreen());
    await act(async () => {});
    expect(screen.queryByTestId("next-trip")).toBeNull();
    expect(screen.queryByTestId("account-data-error")).toBeNull();
    expect(within(screen.getByTestId("link-price-alerts")).queryByText(/aktiv/)).toBeNull();
    expect(screen.getByTestId("travellers-note")).toHaveTextContent(/^Lagres bare på denne telefonen\./);
  });

  it("en feil på serveren: kort beskjed med «Prøv igjen», som henter på nytt", async () => {
    let fail = true;
    const { server } = await renderApp(<AccountScreen />, {
      signedIn: true,
      routes: routes({ "mobileAccount.hub": () => (fail ? { status: 500, error: { message: "x", appCode: "INTERNAL" } } : { data: EMPTY_HUB }) }),
    });
    await waitFor(() => expect(screen.getByTestId("account-data-error")).toBeOnTheScreen());
    expect(screen.getByTestId("account-data-error")).toHaveTextContent(/Vi fikk ikke hentet dataene fra kontoen/);
    fail = false;
    await fireEvent.press(screen.getByTestId("account-data-retry"));
    await waitFor(() => expect(screen.queryByTestId("account-data-error")).toBeNull());
    expect(account(server).filter((c) => c.path === "mobileAccount.hub")).toHaveLength(2);
    // Ingen bestilling på kontoen: ingen «Neste reise».
    expect(screen.queryByTestId("next-trip")).toBeNull();
  });

  it("gjest: ingen kall til kontoen, ingen varsler-gruppe", async () => {
    const { server } = await renderApp(<AccountScreen />);
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    expect(account(server)).toEqual([]);
    expect(screen.queryByTestId("alerts-group")).toBeNull();
  });
});

describe("Min side: reisende på telefonen (gjest)", () => {
  it("tom: forklarer at vi aldri spør om pass eller personnummer; en ny reisende overlever en omstart", async () => {
    const first = await renderApp(<AccountScreen />);
    expect(screen.getByTestId("travellers-empty")).toHaveTextContent(/^Legg til dem du reiser med, så har du navnene klare\. Vi spør aldri om pass, ID-nummer eller personnummer\./);
    await fireEvent.press(screen.getByTestId("traveller-add-first"));
    // Et navn med tall avvises med feltet.
    await fireEvent.changeText(screen.getByTestId("traveller-first-name"), "P3r");
    await fireEvent.changeText(screen.getByTestId("traveller-last-name"), "Nordmann");
    await fireEvent.press(screen.getByTestId("traveller-save"));
    expect(screen.getByText("Sjekk fornavnet (bokstaver, mellomrom, bindestrek; maks 60).")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("traveller-first-name"), "Åse");
    await fireEvent.press(screen.getByTestId("traveller-kind-child"));
    await fireEvent.press(screen.getByTestId("traveller-save"));
    expect(screen.getByTestId("probe")).toHaveTextContent(/ t1 /);
    await first.view.unmount();
    __resetLocalStoreForTests();

    await renderApp(<AccountScreen />);
    const row = screen.getAllByTestId(/^traveller-l(?!ist)/)[0]!;
    expect(row).toHaveProp("accessibilityLabel", "Åse Nordmann, Barn");
    expect(flat(row).minHeight).toBeGreaterThanOrEqual(44);
    // Endre og fjerne i samme ark.
    await fireEvent.press(row);
    await fireEvent.press(screen.getByTestId("traveller-remove"));
    expect(screen.getByTestId("travellers-empty")).toBeOnTheScreen();
    expect(readPref("travellers", (v) => v)).toBeNull();
  });
});

describe("Min side: reisepreferanser", () => {
  it("hver rad viser valget; bytter, klasse og tider lagres på telefonen og overlever en omstart", async () => {
    const first = await renderApp(<AccountScreen />);
    const group = within(screen.getByTestId("preferences-group"));
    expect(group.getByText("Preferansene gjør standardvalgene bedre. De skjuler aldri treff: i resultatene velger du selv «Mine preferanser». Lagres bare på denne telefonen.")).toBeOnTheScreen();
    expect(screen.getByTestId("pref-stops")).toHaveProp("accessibilityLabel", "Bytter: Alle");

    await fireEvent.press(screen.getByTestId("pref-stops"));
    await fireEvent.press(screen.getByTestId("pref-stops-direct"));
    await fireEvent.press(screen.getByTestId("pref-sheet-done"));
    expect(screen.getByTestId("pref-stops")).toHaveProp("accessibilityLabel", "Bytter: Bare direkte");

    await fireEvent.press(screen.getByTestId("pref-cabin"));
    await fireEvent.press(screen.getByTestId("pref-cabin-business"));
    expect(screen.getByText("Nye søk starter med denne klassen. Du kan alltid endre den før du søker.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("pref-sheet-done"));

    await fireEvent.press(screen.getByTestId("pref-depart"));
    await fireEvent.press(screen.getByTestId("pref-band-morning"));
    await fireEvent.press(screen.getByTestId("pref-sheet-done"));
    expect(screen.getByTestId("pref-depart")).toHaveProp("accessibilityLabel", "Avgangstid: Morgen");
    await first.view.unmount();
    __resetLocalStoreForTests();

    // Omstart uten søkeutkast: skjemaet starter med preferansens klasse – og ingenting annet er endret.
    writePref("draft", null);
    __resetLocalStoreForTests();
    await renderApp(<AccountScreen />);
    expect(screen.getByTestId("pref-stops")).toHaveProp("accessibilityLabel", "Bytter: Bare direkte");
    expect(screen.getByTestId("pref-cabin")).toHaveProp("accessibilityLabel", "Reiseklasse: Business");
    expect(screen.getByTestId("probe")).toHaveTextContent(/^OSL→- business /);
  });

  it("flyselskaper: ett trykk foretrekker, to unngår, tre nullstiller – og VoiceOver hører tilstanden", async () => {
    await renderApp(<AccountScreen />);
    await fireEvent.press(screen.getByTestId("pref-airlines"));
    const sk = () => screen.getByTestId("pref-airline-SK");
    expect(sk()).toHaveProp("accessibilityLabel", "SAS, ingen preferanse");
    await fireEvent.press(sk());
    expect(sk()).toHaveProp("accessibilityLabel", "SAS, foretrukket");
    await fireEvent.press(screen.getByTestId("pref-airline-FR"));
    await fireEvent.press(screen.getByTestId("pref-airline-FR"));
    expect(screen.getByTestId("pref-airline-FR")).toHaveProp("accessibilityLabel", "Ryanair, unngås");
    await fireEvent.press(screen.getByTestId("pref-sheet-done"));
    expect(screen.getByTestId("pref-airlines")).toHaveProp("accessibilityLabel", "Flyselskaper: 1 foretrukket · 1 unngås");
  });

  it("andre flyplasser: «Legg til» åpner flyplassøket i egen modus; en flyplass kan fjernes", async () => {
    seed({ travelPrefs: { altAirports: [TRF] } });
    await renderApp(<AccountScreen />);
    expect(screen.getByTestId("pref-alt")).toHaveProp("accessibilityLabel", "Andre flyplasser: Sandefjord (TRF)");
    await fireEvent.press(screen.getByTestId("pref-alt"));
    await fireEvent.press(screen.getByTestId("pref-alt-add"));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: "/flyplass", params: { felt: "fra", ekstra: "1" } });
    await fireEvent.press(screen.getByTestId("pref-alt"));
    await fireEvent.press(screen.getByTestId("pref-alt-remove-TRF"));
    await fireEvent.press(screen.getByTestId("pref-sheet-done"));
    expect(screen.getByTestId("pref-alt")).toHaveProp("accessibilityLabel", "Andre flyplasser: Ingen");
  });
});

describe("Min side: neste lagrede fly (uten bestilling)", () => {
  it("merket «Lagret – ikke bestilt» og åpner Lagret på flyene", async () => {
    seed({ savedFlights: [SAVED_FLIGHT] });
    await renderApp(<AccountScreen />);
    const card = within(screen.getByTestId("next-saved-flight"));
    expect(card.getByText("Lagret – ikke bestilt")).toBeOnTheScreen();
    expect(card.getByText("07:05–13:40 · SAS · 1 mellomlanding")).toBeOnTheScreen();
    expect(within(screen.getByTestId("hub-saved")).getByText("1")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("next-saved-flight"));
    expect(router.navigate).toHaveBeenLastCalledWith({ pathname: "/lagret", params: { vis: "fly" } });
  });
});

describe("Lagret: fly, ruter, søk, prisvarsler og reisemål", () => {
  it("tom: hver seksjon forklarer hva som havner der; filtrene viser én del om gangen", async () => {
    await renderApp(<SavedScreen />);
    expect(screen.getByTestId("saved-flights-empty")).toHaveTextContent(/^Lagre et fly fra detaljene i søkeresultatet, så finner du det her – med prisen du så og når\./);
    expect(screen.getByTestId("saved-routes-empty")).toHaveTextContent(/En rute er to flyplasser – datoene velger du når du søker\./);
    expect(screen.getByTestId("saved-alerts-card")).toHaveTextContent(/Prisvarsler er ikke i appen ennå\. Med en konto kan du følge en rute på hellosky\.no/);
    await fireEvent.press(screen.getByTestId("saved-alerts-login"));
    expect(router.navigate).toHaveBeenLastCalledWith("/profil");
    await fireEvent.press(screen.getByTestId("saved-filter-ruter"));
    expect(screen.getByTestId("saved-filter-ruter")).toHaveProp("accessibilityState", { selected: true, disabled: false });
    expect(screen.getByTestId("saved-routes")).toBeOnTheScreen();
    expect(screen.queryByTestId("saved-flights")).toBeNull();
    expect(screen.queryByTestId("recent-searches")).toBeNull();
  });

  it("åpnet fra Min side med «Nylige søk»: bare søkene", async () => {
    setParams({ vis: "sok" });
    await renderApp(<SavedScreen />);
    expect(screen.getByTestId("recent-searches")).toBeOnTheScreen();
    expect(screen.queryByTestId("saved-flights")).toBeNull();
  });

  it("et lagret fly: prisen du så med datoen (aldri som dagens pris); arket søker igjen, deler, lagrer ruten og fjerner", async () => {
    seed({ savedFlights: [SAVED_FLIGHT] });
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
    const { server } = await renderApp(<SavedScreen />);
    expect(screen.getByTestId("saved-filter-fly")).toHaveProp("accessibilityLabel", "Fly, 1");
    const id = SAVED_FLIGHT.key.slice(0, 40);
    expect(screen.getByTestId(`flight-price-${id}`)).toHaveTextContent(/^2.100,50.kr da du lagret · 25\..sep\.$/);
    expect(screen.getByTestId(`flight-open-${id}`).props.accessibilityLabel).toMatch(/2.100,50 kroner da du lagret det 25\..sep\.\. Prisen kan ha endret seg\./);

    await fireEvent.press(screen.getByTestId(`flight-open-${id}`));
    const sheet = within(screen.getByTestId("flight-sheet"));
    expect(sheet.getByText(/^Du så 2.100,50.kr 25\..sep\. 12:05\. Prisene endrer seg – søk igjen for ferske priser\.$/)).toBeOnTheScreen();
    // Begge strekningene, hver med selskap og flynumre (testreisen bruker samme flynumre begge veier).
    expect(sheet.getAllByText("SAS · Fly SK1457, SK587")).toHaveLength(2);
    await fireEvent.press(screen.getByTestId("flight-share"));
    expect(share.mock.calls[0]![0].message).toBe("Oslo → Barcelona, 23.–30. okt. – sammenlign fly på HelloSky: https://hellosky.no/sok?adults=1&children=0&infants=0&cabin=economy&from=OSL&to=BCN&depart=2026-10-23&ret=2026-10-30");
    await fireEvent.press(screen.getByTestId("flight-save-route"));
    expect(screen.getByTestId("probe")).toHaveTextContent(/ r1$/);
    await fireEvent.press(screen.getByTestId("flight-follow-web"));
    expect(WebBrowser.openBrowserAsync).toHaveBeenLastCalledWith(WEB_PAGES.priceWatches, expect.anything());

    await fireEvent.press(screen.getByTestId("flight-search"));
    await waitFor(() => expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(1));
    expect(router.push).toHaveBeenLastCalledWith("/resultater");
    expect(screen.getByTestId("probe")).toHaveTextContent(/^OSL→BCN /);
  });

  it("en reise som har gått: sies, og «Søk med nye datoer» fyller Hjem uten å søke", async () => {
    const past = flightFromOffer(NOK_OFFER, { ...QUERY, departDate: "2026-09-10", returnDate: "2026-09-17" }, new Date("2026-09-01T10:00:00"));
    const legs = past.legs.map((l, i) => ({ ...l, departingAt: i ? "2026-09-17T07:05:00" : "2026-09-10T07:05:00", arrivingAt: i ? "2026-09-17T13:40:00" : "2026-09-10T13:40:00" }));
    seed({ savedFlights: [{ ...past, legs }] });
    const { server } = await renderApp(<SavedScreen />);
    expect(screen.getByText("Reisen har gått")).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByTestId(/^flight-open-/)[0]!);
    expect(screen.getByTestId("flight-search")).toHaveTextContent("Søk med nye datoer");
    await fireEvent.press(screen.getByTestId("flight-search"));
    expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(0);
    expect(router.navigate).toHaveBeenLastCalledWith("/");
  });

  it("nylige søk: ruten lagres med ett trykk; en lagret rute fyller søket, deles og fjernes", async () => {
    seed({ recent: [{ ...QUERY }] });
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
    await renderApp(<SavedScreen />);
    const save = screen.getByTestId("recent-route-OSL-BCN-2026-10-23");
    expect(save).toHaveProp("accessibilityLabel", "Lagre ruten Oslo → Barcelona");
    expect(flat(save).width).toBeGreaterThanOrEqual(44);
    await fireEvent.press(save);
    expect(screen.getByTestId("recent-route-OSL-BCN-2026-10-23")).toHaveProp("accessibilityState", { selected: true });
    expect(screen.getByTestId("route-OSL-BCN")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("route-share-OSL-BCN"));
    expect(share.mock.calls[0]![0].message).toMatch(/^Oslo → Barcelona – sammenlign fly på HelloSky: https:\/\/hellosky\.no\/sok\?.*from=OSL&to=BCN&depart=2026-10-09&ret=2026-10-16$/);
    await fireEvent.press(screen.getByTestId("route-use-OSL-BCN"));
    expect(router.navigate).toHaveBeenLastCalledWith("/");
    await fireEvent.press(screen.getByTestId("route-remove-OSL-BCN"));
    expect(screen.getByTestId("saved-routes-empty")).toBeOnTheScreen();
  });

  it("prisvarsler for en innlogget kunde: kontoens antall og veien til hellosky.no – ingen oppdiktede varsler", async () => {
    await renderApp(<SavedScreen />, { signedIn: true, routes: { "mobileAccount.hub": () => ({ data: HUB }), "mobileAccount.travellers": () => ({ data: [] }) } });
    await waitFor(() => expect(screen.getByTestId("saved-alerts-count")).toHaveTextContent("2 aktive prisvarsler på kontoen din."));
    await fireEvent.press(screen.getByTestId("saved-alerts-web"));
    expect(WebBrowser.openBrowserAsync).toHaveBeenLastCalledWith(WEB_PAGES.priceWatches, expect.anything());
  });
});

describe("lagre et fly fra detaljene", () => {
  it("bokmerket lagrer reisen med søket den kom fra; et nytt trykk fjerner den", async () => {
    function WithSearch() {
      const { runSearch, search } = useApp();
      useEffect(() => {
        runSearch({ destination: BCN, departDate: "2026-10-23", returnDate: "2026-10-30" });
      // Søket kjøres én gang, som når kunden kommer fra Hjem.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <SaveFlightButton item={NOK_OFFER} query={search.status === "idle" ? null : search.query} />;
    }
    await renderApp(<WithSearch />);
    const button = await screen.findByTestId("save-flight");
    expect(button).toHaveProp("accessibilityLabel", "Lagre flyet");
    expect(button).toHaveProp("accessibilityState", { selected: false });
    await fireEvent.press(button);
    expect(screen.getByTestId("save-flight")).toHaveProp("accessibilityState", { selected: true });
    expect(screen.getByTestId("save-flight")).toHaveProp("accessibilityLabel", "Fjern lagret fly");
    const stored = readPref("savedFlights", (v) => v) as { query: SearchForm; seenPrice: unknown }[];
    expect(stored[0]!.query.destination?.iata).toBe("BCN");
    expect(stored[0]!.seenPrice).toEqual({ amountMinor: 210050, estimate: false });
    await fireEvent.press(screen.getByTestId("save-flight"));
    expect(readPref("savedFlights", (v) => v)).toBeNull();
  });
});

describe("resultatene: «Mine preferanser»", () => {
  function SearchOnMount({ children }: { children: ReactNode }) {
    const { runSearch } = useApp();
    useEffect(() => {
      runSearch({ destination: BCN, departDate: "2026-10-23", returnDate: "2026-10-30" });
    // Søket kjøres én gang, som når kunden kommer fra Hjem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <>{children}</>;
  }

  it("aldri satt av seg selv; et trykk setter preferansene som synlige filtre, et nytt fjerner dem; unngåtte selskaper merkes", async () => {
    seed({ travelPrefs: { stops: "max1", avoidAirlines: ["SK"] } });
    await renderApp(
      <SearchOnMount>
        <ResultsScreen />
      </SearchOnMount>,
      { routes: { "flights.search": () => ({ data: SEARCH_RESULT as MobileSearchResult }) } },
    );
    await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
    const chip = () => screen.getByTestId("chip-prefs");
    expect(chip()).toHaveProp("accessibilityState", { selected: false, disabled: false });
    expect(chip()).toHaveProp("accessibilityLabel", "Mine preferanser. Setter reisepreferansene dine som filtre. Du kan fjerne dem ett og ett.");
    expect(screen.getByTestId("chip-max1")).toHaveProp("accessibilityState", { selected: false, disabled: false });
    // Et selskap kunden vil unngå, merkes – kortet står.
    expect(screen.getByTestId("avoided-nok_1")).toHaveTextContent("Du vil helst unngå SAS");
    await fireEvent.press(chip());
    expect(chip()).toHaveProp("accessibilityState", { selected: true, disabled: false });
    expect(screen.getByTestId("chip-max1")).toHaveProp("accessibilityState", { selected: true, disabled: false });
    await fireEvent.press(chip());
    expect(screen.getByTestId("chip-max1")).toHaveProp("accessibilityState", { selected: false, disabled: false });
  });

  it("ingen reise passer preferansene: valget står, avslått, og VoiceOver hører hvorfor", async () => {
    // Ingen av testreisene har innsjekket bagasje bekreftet.
    seed({ travelPrefs: { checkedBag: true } });
    await renderApp(
      <SearchOnMount>
        <ResultsScreen />
      </SearchOnMount>,
    );
    await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
    expect(screen.getByTestId("chip-prefs")).toHaveProp("accessibilityState", { selected: false, disabled: true });
    expect(screen.getByTestId("chip-prefs")).toHaveProp("accessibilityLabel", "Mine preferanser. Ingen av disse reisene passer preferansene dine.");
  });

  it("uten filterpreferanser: ingen brikke", async () => {
    await renderApp(
      <SearchOnMount>
        <ResultsScreen />
      </SearchOnMount>,
    );
    await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
    expect(screen.queryByTestId("chip-prefs")).toBeNull();
    expect(screen.queryByTestId(/^avoided-/)).toBeNull();
  });
});
