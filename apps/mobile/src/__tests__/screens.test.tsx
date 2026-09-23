import { useEffect, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { AUTH_RESULT, KAYAK_URL, PROFILE, SEARCH_RESULT, TOKEN } from "../test/fixtures";
import SearchScreen from "../app/index";
import ResultsScreen from "../app/resultater";
import OfferScreen from "../app/tilbud/[id]";
import AccountScreen from "../app/konto";

// Skjermtester: ekte skjermer, ekte app-tilstand og ekte API-klient – bare
// HTTP-laget er en falsk server som husker hver forespørsel.

const router = (globalThis as unknown as { __router: { push: jest.Mock; back: jest.Mock; replace: jest.Mock } }).__router;
const setParams = (globalThis as unknown as { __setParams: (p: Record<string, string>) => void }).__setParams;
const keychain = (SecureStore as unknown as { __store: Map<string, { value: string; options: unknown }> }).__store;
const BCN = { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spania" };

type Routes = Parameters<typeof fakeServer>[0];

function setup(routes: Routes) {
  const server = fakeServer(routes);
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  return { server, factory };
}

function SearchOnMount({ children }: { children: ReactNode }) {
  const { runSearch } = useApp();
  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

const consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((m) => jest.spyOn(console, m));

beforeEach(() => {
  keychain.clear();
  jest.mocked(WebBrowser.openBrowserAsync).mockClear();
  consoleSpies.forEach((s) => s.mockClear());
});

afterEach(() => {
  // Tokenet skal aldri havne i en logg.
  for (const spy of consoleSpies) {
    for (const args of spy.mock.calls) expect(JSON.stringify(args)).not.toContain(TOKEN);
  }
});

describe("søk uten innlogging", () => {
  it("ufullstendig skjema gir norsk feilmelding og søker ikke", async () => {
    const { server, factory } = setup({});
    await render(
      <AppProvider apiFactory={factory}>
        <SearchScreen />
      </AppProvider>,
    );
    await fireEvent.press(screen.getByTestId("search-button"));
    expect(screen.getByTestId("form-error")).toHaveTextContent("Velg hvor du skal.");
    expect(router.push).not.toHaveBeenCalled();
    expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(0);
  });

  it("anonymt søk: riktig forespørsel uten token, og resultatene vises sortert med «ca.» og kurskilde", async () => {
    const { server, factory } = setup({ "flights.search": () => ({ data: SEARCH_RESULT }) });
    await render(
      <AppProvider apiFactory={factory} initial={{ destination: BCN, departDate: "2026-10-23", returnDate: "2026-10-30" }}>
        <SearchScreen />
        <ResultsScreen />
      </AppProvider>,
    );
    await fireEvent.press(screen.getByTestId("search-button"));
    expect(router.push).toHaveBeenCalledWith("/resultater");

    await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
    const search = server.calls.find((c) => c.path === "flights.search")!;
    expect(search.method).toBe("POST");
    expect(search.headers.authorization).toBeUndefined();
    expect(search.input).toEqual({
      slices: [
        { origin: "OSL", destination: "BCN", departureDate: "2026-10-23" },
        { origin: "BCN", destination: "OSL", departureDate: "2026-10-30" },
      ],
      passengers: [{ type: "adult" }],
      cabinClass: "economy",
      sessionId: "11111111-2222-4333-8444-555555555555",
    });
    // Ingen innlogget kunde: ingen me-kall.
    expect(server.calls.some((c) => c.path.startsWith("mobileAuth."))).toBe(false);

    // Serverens rekkefølge beholdes (billigste NOK først, uten kronepris sist).
    const ids = screen.getAllByTestId(/^offer-/).map((el) => el.props.testID as string);
    expect(ids).toEqual(["offer-sek_1", "offer-hs_eur", "offer-nok_1", "offer-unsafe_1", "offer-thb_1"]);

    const sek = within(screen.getByTestId("price-sek_1"));
    expect(sek.getByText(/^ca\. 1\s442\skr$/)).toBeOnTheScreen();
    expect(sek.getByText(/^Omregnet fra 1\s500,00\sSEK · Norges Bank 22\.09\.2026$/)).toBeOnTheScreen();
    expect(within(screen.getByTestId("price-nok_1")).getByText(/^2\s100,50\skr$/)).toBeOnTheScreen();

    // THB har ingen kronepris – og ingen tekst i kortet som ser ut som kroner.
    const thb = within(screen.getByTestId("price-thb_1"));
    expect(thb.getByText("Ingen pris i kroner")).toBeOnTheScreen();
    expect(thb.queryByText(/\d\s?kr\b/)).toBeNull();
    expect(thb.getByText(/3\s000,00\sTHB/)).toBeOnTheScreen();

    expect(screen.getByTestId("fx-notice")).toHaveTextContent(/Norges Banks midtkurs 22\.09\.2026.*Ett tilbud kunne ikke regnes om til kroner og står nederst\./);
  });

  it("serverfeil vises med serverens melding", async () => {
    const { factory } = setup({ "flights.search": () => ({ status: 429, error: { message: "For mange forespørsler på kort tid. Vent 30 sekunder og prøv igjen.", appCode: "RATE_LIMITED" } }) });
    await render(
      <AppProvider apiFactory={factory} initial={{ destination: BCN }}>
        <SearchOnMount>
          <ResultsScreen />
        </SearchOnMount>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("results-error")).toBeOnTheScreen());
    expect(screen.getByText(/For mange forespørsler/)).toBeOnTheScreen();
  });

  it("testdata merkes tydelig", async () => {
    const { factory } = setup({ "flights.search": () => ({ data: { ...SEARCH_RESULT, sandbox: true } }) });
    await render(
      <AppProvider apiFactory={factory} initial={{ destination: BCN }}>
        <SearchOnMount>
          <ResultsScreen />
        </SearchOnMount>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("sandbox-banner")).toBeOnTheScreen());
  });
});

describe("tilbudsdetaljer og videresending", () => {
  async function openOffer(id: string) {
    const { factory } = setup({ "flights.search": () => ({ data: SEARCH_RESULT }) });
    setParams({ id });
    await render(
      <AppProvider apiFactory={factory} initial={{ destination: BCN }}>
        <SearchOnMount>
          <OfferScreen />
        </SearchOnMount>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("offer-screen")).toBeOnTheScreen());
  }

  it("eksternt tilbud åpner leverandørens lenke nøyaktig som den er", async () => {
    await openOffer("sek_1");
    expect(screen.getByTestId("fx-details")).toHaveTextContent(/Kurs: 100 SEK = 96,10\skr \(Norges Bank, 22\.09\.2026, veiledende midtkurs\)/);
    expect(screen.getByText(/Du bestiller og betaler hos SAS, ikke hos HelloSky/)).toBeOnTheScreen();
    expect(screen.getByText("SAS tar betalt i SEK.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("handoff-button"));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledTimes(1);
    expect(jest.mocked(WebBrowser.openBrowserAsync).mock.calls[0]![0]).toBe(KAYAK_URL);
  });

  it("tilbud HelloSky selger: gebyret vises, men ingen bestillingsknapp", async () => {
    await openOffer("hs_eur");
    expect(screen.getByText(/Herav HelloSkys servicegebyr: 31,00\sEUR/)).toBeOnTheScreen();
    expect(screen.getByTestId("handoff-not-in-app")).toBeOnTheScreen();
    expect(screen.queryByTestId("handoff-button")).toBeNull();
  });

  it("en utrygg lenke åpnes aldri", async () => {
    await openOffer("unsafe_1");
    expect(screen.getByTestId("handoff-invalid")).toBeOnTheScreen();
    expect(screen.queryByTestId("handoff-button")).toBeNull();
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });

  it("uten søkeresultat: ber kunden søke på nytt", async () => {
    const { factory } = setup({});
    setParams({ id: "finnes-ikke" });
    await render(
      <AppProvider apiFactory={factory}>
        <OfferScreen />
      </AppProvider>,
    );
    expect(screen.getByText(/ikke lenger tilgjengelig/)).toBeOnTheScreen();
  });
});

describe("kundekonto", () => {
  it("innlogging lagrer tokenet i nøkkelringen; utlogging tilbakekaller med Bearer og sletter det", async () => {
    const { server, factory } = setup({
      "mobileAuth.login": () => ({ data: AUTH_RESULT }),
      "mobileAuth.logout": () => ({ data: { ok: true } }),
    });
    await render(
      <AppProvider apiFactory={factory}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    const tree = JSON.stringify(screen.toJSON());
    for (const word of ["admin", "Admin", "ansatt", "staff", "Staff", "eier"]) expect(tree).not.toContain(word);

    await fireEvent.changeText(screen.getByTestId("email"), "kari@example.no");
    await fireEvent.changeText(screen.getByTestId("password"), "passord-123456");
    await fireEvent.press(screen.getByTestId("auth-submit"));
    await waitFor(() => expect(screen.getByTestId("account-signed-in")).toBeOnTheScreen());
    expect(screen.getByText("Hei, Kari")).toBeOnTheScreen();

    expect(server.calls[0]).toMatchObject({ path: "mobileAuth.login", input: { identifier: "kari@example.no", password: "passord-123456" } });
    expect(server.calls[0]!.headers.authorization).toBeUndefined();
    expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith("hellosky.customer-session", JSON.stringify({ token: TOKEN, expiresAt: AUTH_RESULT.session.expiresAt }), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    // Tokenet vises ikke noe sted i grensesnittet.
    expect(JSON.stringify(screen.toJSON())).not.toContain(TOKEN);

    await fireEvent.press(screen.getByTestId("logout-button"));
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    const logout = server.calls.find((c) => c.path === "mobileAuth.logout")!;
    expect(logout.headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(keychain.size).toBe(0);
  });

  it("utlogging uten nett sletter tokenet lokalt likevel", async () => {
    const { factory } = setup({ "mobileAuth.login": () => ({ data: AUTH_RESULT }), "mobileAuth.logout": () => Promise.reject(new Error("offline")) });
    await render(
      <AppProvider apiFactory={factory}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    await fireEvent.changeText(screen.getByTestId("email"), "kari@example.no");
    await fireEvent.changeText(screen.getByTestId("password"), "passord-123456");
    await fireEvent.press(screen.getByTestId("auth-submit"));
    await waitFor(() => expect(screen.getByTestId("logout-button")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("logout-button"));
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    expect(keychain.size).toBe(0);
  });

  it("registrering: kort passord stoppes i appen; serverens melding vises ellers", async () => {
    const { server, factory } = setup({
      "mobileAuth.register": () => ({ status: 409, error: { message: "Det finnes allerede en konto med denne e-postadressen. Prøv å logge inn.", appCode: "CONFLICT", field: "identifier" } }),
    });
    await render(
      <AppProvider apiFactory={factory}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    await fireEvent.press(screen.getByLabelText("Ny konto"));
    await fireEvent.changeText(screen.getByTestId("first-name"), "Kari");
    await fireEvent.changeText(screen.getByTestId("last-name"), "Nordmann");
    await fireEvent.changeText(screen.getByTestId("email"), "kari@example.no");
    await fireEvent.changeText(screen.getByTestId("password"), "kort");
    await fireEvent.press(screen.getByTestId("auth-submit"));
    expect(screen.getByTestId("auth-error")).toHaveTextContent("Passordet må være minst 10 tegn.");
    expect(server.calls).toHaveLength(0);

    await fireEvent.changeText(screen.getByTestId("password"), "passord-123456");
    await fireEvent.press(screen.getByTestId("auth-submit"));
    await waitFor(() => expect(screen.getByTestId("auth-error")).toHaveTextContent("Det finnes allerede en konto med denne e-postadressen. Prøv å logge inn."));
    expect(keychain.size).toBe(0);
  });

  it("ved oppstart: en lagret sesjon serveren ikke kjenner lenger, slettes", async () => {
    keychain.set("hellosky.customer-session", { value: JSON.stringify({ token: TOKEN, expiresAt: "2099-01-01T00:00:00Z" }), options: {} });
    const { server, factory } = setup({ "mobileAuth.me": () => ({ data: null }) });
    await render(
      <AppProvider apiFactory={factory}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    expect(server.calls[0]).toMatchObject({ path: "mobileAuth.me", headers: { authorization: `Bearer ${TOKEN}` } });
    expect(keychain.size).toBe(0);
  });

  it("ved oppstart: gyldig sesjon gir innlogget kunde; uten nett beholdes den", async () => {
    keychain.set("hellosky.customer-session", { value: JSON.stringify({ token: TOKEN, expiresAt: "2099-01-01T00:00:00Z" }), options: {} });
    const ok = setup({ "mobileAuth.me": () => ({ data: PROFILE }) });
    const first = await render(
      <AppProvider apiFactory={ok.factory}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByText("Hei, Kari")).toBeOnTheScreen());
    await first.unmount();

    const offline = setup({ "mobileAuth.me": () => Promise.reject(new Error("offline")) });
    await render(
      <AppProvider apiFactory={offline.factory}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByText(/fikk ikke hentet kontoen/)).toBeOnTheScreen());
    expect(keychain.size).toBe(1);
  });
});
