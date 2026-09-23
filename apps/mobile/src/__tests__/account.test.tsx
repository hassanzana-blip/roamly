import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import type { CustomerProfile } from "@contracts/mobileAuth";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { WEB_PAGES } from "../lib/config";
import { parseDraft } from "../lib/draft";
import { toIsoDate } from "../lib/format";
import { readPref, writePref } from "../lib/localStore";
import { fakeServer } from "../test/fakeServer";
import { PROFILE, TOKEN } from "../test/fixtures";
import AccountScreen from "../app/(tabs)/profil";

// Kontoen i appen: endre profil, glemt passord, slette kontoen, utløpt økt,
// hjelp og juridiske sider – samme konto og samme regler som på nettet.

const keychain = (SecureStore as unknown as { __store: Map<string, { value: string; options: unknown }> }).__store;
const SESSION_KEY = "hellosky.customer-session";

function signedInKeychain() {
  keychain.set(SESSION_KEY, { value: JSON.stringify({ token: TOKEN, expiresAt: "2099-01-01T00:00:00Z" }), options: {} });
}

function setup(routes: Parameters<typeof fakeServer>[0]) {
  const server = fakeServer(routes);
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  return { server, factory };
}

/** `locale: null` = ny installasjon: ikke valgt, ingenting lagret (appen viser bokmål). */
async function renderSignedIn(routes: Parameters<typeof fakeServer>[0], profile: CustomerProfile = PROFILE, locale: "en" | "nb" | null = "en") {
  signedInKeychain();
  const s = setup({ "mobileAuth.me": () => ({ data: profile }), ...routes });
  await render(
    <AppProvider initialLocale={locale ?? undefined} apiFactory={s.factory}>
      <AccountScreen />
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("account-card")).toBeOnTheScreen());
  return s;
}

beforeEach(() => {
  keychain.clear();
  (WebBrowser.openBrowserAsync as jest.Mock).mockClear();
});

describe("endre profil", () => {
  it("lagrer navnet på kontoen, med Bearer, og viser det nye navnet", async () => {
    const { server } = await renderSignedIn({
      "mobileAuth.updateProfile": (req) => ({ data: { ...PROFILE, ...(req.input as object) } }),
    });
    await fireEvent.press(screen.getByTestId("open-edit-profile"));
    await fireEvent.changeText(screen.getByTestId("edit-first-name"), "  Karianne ");
    await fireEvent.press(screen.getByTestId("edit-save"));
    await waitFor(() => expect(screen.getByTestId("profile-saved")).toHaveTextContent("Your profile was saved."));
    expect(screen.getByText("Karianne Nordmann")).toBeOnTheScreen();

    const call = server.calls.find((c) => c.path === "mobileAuth.updateProfile")!;
    expect(call.headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(call.input).toEqual({ firstName: "Karianne", lastName: "Nordmann", locale: "en" });
  });

  it("kontoens språk endres bare når kunden har valgt språk – ikke av standarden ved ny installasjon", async () => {
    const { server } = await renderSignedIn({ "mobileAuth.updateProfile": (req) => ({ data: { ...PROFILE, ...(req.input as object) } }) }, { ...PROFILE, locale: "en" }, null);
    await fireEvent.press(screen.getByTestId("open-edit-profile"));
    await fireEvent.press(screen.getByTestId("edit-save"));
    await waitFor(() => expect(screen.getByTestId("profile-saved")).toBeOnTheScreen());
    // Appen viser bokmål, men kontoens engelske e-postspråk røres ikke.
    expect(server.calls.filter((c) => c.path === "mobileAuth.updateProfile")[0]!.input).toEqual({ firstName: "Kari", lastName: "Nordmann" });

    // Etter et eget valg i Profil følger språket med.
    await fireEvent.press(screen.getByTestId("segment-en"));
    await fireEvent.press(screen.getByTestId("open-edit-profile"));
    await fireEvent.press(screen.getByTestId("edit-save"));
    await waitFor(() => expect(server.calls.filter((c) => c.path === "mobileAuth.updateProfile")).toHaveLength(2));
    expect(server.calls.filter((c) => c.path === "mobileAuth.updateProfile")[1]!.input).toEqual({ firstName: "Kari", lastName: "Nordmann", locale: "en" });
  });

  it("telefonnummeret (en innloggingsnøkkel) kan ikke endres i appen", async () => {
    await renderSignedIn({}, { ...PROFILE, phone: "+4791234567" });
    expect(screen.getByText("+4791234567")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("open-edit-profile"));
    expect(screen.queryByTestId("edit-phone")).toBeNull();
  });

  it("tomt navn stoppes i appen", async () => {
    const { server } = await renderSignedIn({ "mobileAuth.updateProfile": () => ({ data: PROFILE }) });
    await fireEvent.press(screen.getByTestId("open-edit-profile"));
    await fireEvent.changeText(screen.getByTestId("edit-last-name"), "   ");
    await fireEvent.press(screen.getByTestId("edit-save"));
    expect(screen.getByText(/^Check your last name/)).toBeOnTheScreen();
    expect(server.calls.filter((c) => c.path === "mobileAuth.updateProfile")).toHaveLength(0);

    await fireEvent.changeText(screen.getByTestId("edit-last-name"), "Nordmann");
    await fireEvent.press(screen.getByTestId("edit-save"));
    await waitFor(() => expect(screen.getByTestId("profile-saved")).toBeOnTheScreen());
    expect(server.calls.find((c) => c.path === "mobileAuth.updateProfile")!.input).toEqual({ firstName: "Kari", lastName: "Nordmann", locale: "en" });
  });

  it("serverens navneregel vises ved feltet", async () => {
    await renderSignedIn({
      "mobileAuth.updateProfile": () => ({ status: 400, error: { message: "Ugyldig fornavn.", appCode: "VALIDATION", field: "firstName" } }),
    });
    await fireEvent.press(screen.getByTestId("open-edit-profile"));
    await fireEvent.changeText(screen.getByTestId("edit-first-name"), "K4ri");
    await fireEvent.press(screen.getByTestId("edit-save"));
    await waitFor(() => expect(screen.getByText(/^Check your first name/)).toBeOnTheScreen());
    expect(screen.queryByTestId("profile-saved")).toBeNull();
  });

  it("utløpt økt under lagring: logget ut med forklaring, tokenet er borte", async () => {
    await renderSignedIn({
      "mobileAuth.updateProfile": () => ({ status: 401, error: { message: "Du må logge inn.", appCode: "UNAUTHORIZED" } }),
    });
    await fireEvent.press(screen.getByTestId("open-edit-profile"));
    await fireEvent.press(screen.getByTestId("edit-save"));
    await waitFor(() => expect(screen.getByTestId("auth-notice-expired")).toBeOnTheScreen());
    expect(screen.getByTestId("auth-notice-expired")).toHaveTextContent(/Your search is still here/);
    expect(keychain.size).toBe(0);
    // Arket fra den gamle økten kommer ikke tilbake.
    expect(screen.queryByTestId("edit-save")).toBeNull();
  });
});

describe("glemt passord", () => {
  it("sender adressen og språket til nettets tilbakestilling, og svarer likt uansett", async () => {
    const { server, factory } = setup({ "mobileAuth.me": () => ({ data: null }), "mobileAuth.requestPasswordReset": () => ({ data: { ok: true } }) });
    await render(
      <AppProvider initialLocale="nb" apiFactory={factory}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    await fireEvent.changeText(screen.getByTestId("email"), "kari@example.no");
    await fireEvent.press(screen.getByTestId("open-forgot"));
    // Adressen fra innloggingen er fylt inn.
    expect(screen.getByTestId("forgot-email").props.value).toBe("kari@example.no");
    await fireEvent.press(screen.getByTestId("forgot-send"));
    await waitFor(() => expect(screen.getByTestId("forgot-sent")).toHaveTextContent(/Hvis det finnes en konto/));
    const call = server.calls.find((c) => c.path === "mobileAuth.requestPasswordReset")!;
    expect(call.input).toEqual({ identifier: "kari@example.no", locale: "nb" });
    expect(call.headers.authorization).toBeUndefined();
  });

  it("ugyldig adresse stoppes før noe sendes", async () => {
    const { server, factory } = setup({ "mobileAuth.me": () => ({ data: null }) });
    await render(
      <AppProvider apiFactory={factory}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("open-forgot"));
    await fireEvent.changeText(screen.getByTestId("forgot-email"), "kari");
    await fireEvent.press(screen.getByTestId("forgot-send"));
    expect(screen.getByTestId("forgot-error")).toHaveTextContent("Skriv inn en gyldig e-postadresse.");
    expect(server.calls.filter((c) => c.path === "mobileAuth.requestPasswordReset")).toHaveLength(0);
  });
});

describe("slette kontoen", () => {
  it("med passord: kontoen slettes, tokenet fjernes og kunden får beskjed", async () => {
    const { server } = await renderSignedIn({ "mobileAuth.deleteAccount": () => ({ data: { ok: true } }) });
    await fireEvent.press(screen.getByTestId("open-delete-account"));
    await fireEvent.press(screen.getByTestId("delete-confirm"));
    expect(screen.getByTestId("delete-error")).toHaveTextContent("Enter your password.");
    expect(server.calls.filter((c) => c.path === "mobileAuth.deleteAccount")).toHaveLength(0);

    await fireEvent.changeText(screen.getByTestId("delete-password"), "passord-123456");
    await fireEvent.press(screen.getByTestId("delete-confirm"));
    await waitFor(() => expect(screen.getByTestId("auth-notice-deleted")).toBeOnTheScreen());
    const call = server.calls.find((c) => c.path === "mobileAuth.deleteAccount")!;
    expect(call.input).toEqual({ password: "passord-123456" });
    expect(call.headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(keychain.size).toBe(0);
    expect(screen.queryByTestId("delete-confirm")).toBeNull();
  });

  it("feil passord: ingenting slettes, kunden er fortsatt innlogget", async () => {
    await renderSignedIn({
      "mobileAuth.deleteAccount": () => ({ status: 401, error: { message: "Feil passord.", appCode: "UNAUTHORIZED", field: "password" } }),
    });
    await fireEvent.press(screen.getByTestId("open-delete-account"));
    await fireEvent.changeText(screen.getByTestId("delete-password"), "feil-passord");
    await fireEvent.press(screen.getByTestId("delete-confirm"));
    await waitFor(() => expect(screen.getByTestId("delete-error")).toHaveTextContent("The password is not correct. Nothing was deleted."));
    expect(screen.getByTestId("account-signed-in")).toBeOnTheScreen();
    expect(keychain.size).toBe(1);
  });

  it("utløpt økt under sletting: logget ut med forklaring, ingen «feil passord»", async () => {
    await renderSignedIn({
      "mobileAuth.deleteAccount": () => ({ status: 401, error: { message: "Du må logge inn.", appCode: "UNAUTHORIZED" } }),
    });
    await fireEvent.press(screen.getByTestId("open-delete-account"));
    await fireEvent.changeText(screen.getByTestId("delete-password"), "passord-123456");
    await fireEvent.press(screen.getByTestId("delete-confirm"));
    await waitFor(() => expect(screen.getByTestId("auth-notice-expired")).toBeOnTheScreen());
    expect(keychain.size).toBe(0);
  });

  it("serveren krever fersk innlogging: tydelig beskjed, ingenting slettet", async () => {
    await renderSignedIn(
      { "mobileAuth.deleteAccount": () => ({ status: 403, error: { message: "Logg inn på nytt.", appCode: "FORBIDDEN", reason: "reauth_required" } }) },
      { ...PROFILE, hasPassword: false },
    );
    await fireEvent.press(screen.getByTestId("open-delete-account"));
    await fireEvent.changeText(screen.getByTestId("delete-word"), "DELETE");
    await fireEvent.press(screen.getByTestId("delete-confirm"));
    await waitFor(() => expect(screen.getByTestId("delete-error")).toHaveTextContent(/log out and log in again/));
    expect(screen.getByTestId("account-signed-in")).toBeOnTheScreen();
    expect(keychain.size).toBe(1);
  });

  it("konto uten passord (Apple/Google) bekreftes med ordet på valgt språk", async () => {
    const { server } = await renderSignedIn({ "mobileAuth.deleteAccount": () => ({ data: { ok: true } }) }, { ...PROFILE, hasPassword: false }, "nb");
    await fireEvent.press(screen.getByTestId("open-delete-account"));
    expect(screen.queryByTestId("delete-password")).toBeNull();
    await fireEvent.changeText(screen.getByTestId("delete-word"), "slet");
    await fireEvent.press(screen.getByTestId("delete-confirm"));
    expect(screen.getByTestId("delete-error")).toHaveTextContent("Skriv SLETT nøyaktig for å bekrefte.");
    await fireEvent.changeText(screen.getByTestId("delete-word"), "slett");
    await fireEvent.press(screen.getByTestId("delete-confirm"));
    await waitFor(() => expect(screen.getByTestId("auth-notice-deleted")).toBeOnTheScreen());
    expect(server.calls.find((c) => c.path === "mobileAuth.deleteAccount")!.input).toEqual({ confirmation: "SLETT" });
  });
});

describe("utløpt økt og hjelp", () => {
  it("ved oppstart: en økt serveren har avsluttet gir en forklaring, ikke bare et tomt skjema", async () => {
    signedInKeychain();
    const { factory } = setup({ "mobileAuth.me": () => ({ data: null }) });
    await render(
      <AppProvider apiFactory={factory}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("auth-notice-expired")).toBeOnTheScreen());
    expect(keychain.size).toBe(0);
  });

  it("hjelp, personvern, vilkår og om oss åpner HelloSkys egne sider", async () => {
    const { factory } = setup({ "mobileAuth.me": () => ({ data: null }) });
    await render(
      <AppProvider apiFactory={factory}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    expect(screen.getByTestId("how-it-works")).toHaveTextContent(/bestiller og betaler du på tilbyderens egen nettside/);
    for (const [id, url] of [
      ["link-help", WEB_PAGES.help],
      ["link-privacy", WEB_PAGES.privacy],
      ["link-terms", WEB_PAGES.terms],
      ["link-about", WEB_PAGES.about],
    ] as const) {
      await fireEvent.press(screen.getByTestId(id));
      expect(WebBrowser.openBrowserAsync).toHaveBeenLastCalledWith(url, expect.anything());
    }
    expect(Object.values(WEB_PAGES).every((u) => u.startsWith("https://hellosky.no/"))).toBe(true);
    expect(screen.getAllByText("Åpner hellosky.no").length).toBe(4);
  });

  it("med engelsk som lagret valg får kunden vite at nettsidene er på norsk", async () => {
    writePref("locale", "en");
    const { factory } = setup({ "mobileAuth.me": () => ({ data: null }) });
    await render(
      <AppProvider apiFactory={factory}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    expect(screen.getByTestId("how-it-works")).toHaveTextContent(/you book and pay on that provider's own website/);
    expect(screen.getAllByText("Opens hellosky.no (in Norwegian)").length).toBe(4);
  });
});

describe("søkeutkastet", () => {
  const today = new Date(2026, 8, 23);

  it("en dato som har passert flyttes fram, med samme reiselengde", () => {
    const draft = parseDraft(
      { tripType: "roundtrip", origin: { iata: "OSL", name: "Oslo lufthavn", city: "Oslo", country: "Norge" }, destination: null, departDate: "2026-09-01", returnDate: "2026-09-05", adults: 2, childAges: [7], infantAges: [], cabinClass: "economy", directOnly: true },
      today,
    )!;
    expect(draft.departDate).toBe("2026-10-07");
    expect(draft.returnDate).toBe("2026-10-11");
    expect(draft.origin?.iata).toBe("OSL");
    expect(draft).toMatchObject({ adults: 2, childAges: [7], directOnly: true });
  });

  it("ugyldige eller for mange reisende forkastes", () => {
    expect(parseDraft(null, today)).toBeNull();
    expect(parseDraft({ tripType: "roundtrip", adults: 0, childAges: [], infantAges: [], cabinClass: "economy" }, today)).toBeNull();
    expect(parseDraft({ tripType: "roundtrip", adults: 1, childAges: [], infantAges: [0, 1], cabinClass: "economy" }, today)).toBeNull();
    expect(parseDraft({ tripType: "roundtrip", adults: 1, childAges: [], infantAges: [], cabinClass: "first-ish" }, today)).toBeNull();
    const bad = parseDraft({ tripType: "oneway", origin: { iata: "oslo" }, adults: 1, childAges: [], infantAges: [], cabinClass: "economy" }, today)!;
    expect(bad.origin).toBeNull();
  });

  it("skjemaet huskes mellom oppstarter – uten token, navn eller e-post", async () => {
    const future = toIsoDate(new Date(Date.now() + 40 * 86_400_000));
    writePref("draft", { tripType: "oneway", origin: { iata: "BGO", name: "Bergen lufthavn", city: "Bergen", country: "Norge" }, destination: null, departDate: future, returnDate: future, adults: 1, childAges: [], infantAges: [], cabinClass: "business", directOnly: false });
    const { factory } = setup({});
    let seen: ReturnType<typeof useApp>["form"] | null = null;
    function Probe() {
      seen = useApp().form;
      return null;
    }
    await render(
      <AppProvider apiFactory={factory}>
        <Probe />
      </AppProvider>,
    );
    expect(seen).toMatchObject({ tripType: "oneway", origin: { iata: "BGO" }, departDate: future, cabinClass: "business" });
    const stored = JSON.stringify(readPref("draft", (v) => v));
    expect(stored).not.toMatch(/token|email|firstName/);
  });
});
