import { Dimensions, StyleSheet } from "react-native";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { AppProvider, type ApiFactory, type NativeSocialSignIn } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { AUTH_RESULT, PROFILE, TOKEN } from "../test/fixtures";
import { colors } from "../lib/theme";
import AccountScreen from "../app/(tabs)/profil";

// Min side: for gjester innloggingen øverst i grafittøya (skjemaet åpnes i et eget ark), så innstillinger og hjelp som
// grupper med rader. Innlogget: konto, sidene på hellosky.no, innstillinger, hjelp og til slutt «Logg ut» og «Slett
// konto». Oversikten og modulene (nylige søk, lagrede reisemål, reisevaner) prøves i minSide.test.tsx.

const keychain = (SecureStore as unknown as { __store: Map<string, { value: string; options: unknown }> }).__store;

// Versjonen kommer fra app.json via expo-constants; i Jest er den innebygde konfigurasjonen tom, så den settes her.
const mockConstants: { expoConfig: { version?: string } | null } = { expoConfig: { version: "1.0.0" } };
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockConstants.expoConfig;
    },
  },
}));

async function renderProfile({ signedIn = false, locale = "nb", routes = {} }: { signedIn?: boolean; locale?: "nb" | "en"; routes?: Parameters<typeof fakeServer>[0] } = {}) {
  if (signedIn) keychain.set("hellosky.customer-session", { value: JSON.stringify({ token: TOKEN, expiresAt: "2099-01-01T00:00:00Z" }), options: {} });
  const server = fakeServer({ "mobileAuth.me": () => ({ data: signedIn ? PROFILE : null }), ...routes });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  await render(
    <AppProvider initialLocale={locale} apiFactory={factory}>
      <AccountScreen />
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByTestId(signedIn ? "account-card" : "account-signed-out")).toBeOnTheScreen());
  return server;
}

/** testID-ene i skjermrekkefølge. */
function idsInOrder(): string[] {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (n == null || typeof n === "string") return;
    if (Array.isArray(n)) return n.forEach(walk);
    const x = n as { props?: { testID?: string }; children?: unknown };
    if (x.props?.testID) out.push(x.props.testID);
    walk(x.children);
  };
  walk(screen.toJSON());
  return out;
}
const inOrder = (ids: string[]) => {
  const all = idsInOrder();
  const at = ids.map((id) => all.indexOf(id));
  expect(at.every((i) => i >= 0)).toBe(true);
  expect([...at].sort((x, y) => x - y)).toEqual(at);
};

beforeEach(() => keychain.clear());

describe("Min side for gjester", () => {
  it("innloggingen øverst og innstillingene under – ikke et skjema med én gang", async () => {
    await renderProfile();
    const card = screen.getByTestId("sign-in-card");
    expect(within(card).getByText("Min side")).toHaveProp("accessibilityRole", "header");
    expect(card).toHaveTextContent(/Logg inn for å bruke samme konto som på hellosky\.no\. Du trenger ikke konto for å søke og sammenligne fly\./);
    expect(screen.getByTestId("open-login")).toHaveProp("accessibilityHint", "Åpner innloggingen");
    expect(screen.getByTestId("open-register")).toHaveProp("accessibilityHint", "Åpner skjemaet for ny konto");
    expect(screen.queryByTestId("email")).toBeNull();
    expect(screen.queryByTestId("auth-modal")).toBeNull();
    // Rekkefølgen: innloggingen og oversikten, reisevaner, innstillingene, hjelpen – og appens versjon nederst (fra app.json).
    inOrder(["sign-in-card", "hub-overview", "preferences-group", "settings-group", "help-card", "app-version"]);
    expect(screen.getByTestId("app-version")).toHaveTextContent("HelloSky 1.0.0");
  });

  it("uten en innebygd versjon står ingen versjonslinje (ingen tom eller oppdiktet verdi)", async () => {
    mockConstants.expoConfig = null;
    try {
      await renderProfile();
      expect(screen.queryByTestId("app-version")).toBeNull();
    } finally {
      mockConstants.expoConfig = { version: "1.0.0" };
    }
  });

  it("«Logg inn» åpner skjemaet i et eget ark; «Lukk» lukker det, og passordet blir ikke liggende", async () => {
    await renderProfile();
    await fireEvent.press(screen.getByTestId("open-login"));
    expect(screen.getByTestId("auth-modal")).toBeOnTheScreen();
    expect(within(screen.getByTestId("auth-modal")).getAllByRole("header")[0]).toHaveTextContent("Logg inn");
    expect(screen.getByTestId("segment-login")).toBeSelected();
    await fireEvent.changeText(screen.getByTestId("email"), "kari@example.no");
    await fireEvent.changeText(screen.getByTestId("password"), "passord-123456");
    await fireEvent.press(screen.getByTestId("auth-close"));
    expect(screen.queryByTestId("auth-modal")).toBeNull();
    await fireEvent.press(screen.getByTestId("open-login"));
    expect(screen.getByTestId("email").props.value).toBe("kari@example.no");
    expect(screen.getByTestId("password").props.value).toBe("");
  });

  it("arket er iOS' sidekort som kan dras ned; å dra det ned lukker det som «Lukk»", async () => {
    await renderProfile();
    await fireEvent.press(screen.getByTestId("open-login"));
    type Node = { type: string; props: Record<string, unknown>; children: (Node | string)[] | null };
    const find = (n: Node | string | null): Node | null => {
      if (!n || typeof n === "string") return null;
      if (n.props.presentationStyle) return n;
      for (const c of n.children ?? []) {
        const hit = find(c);
        if (hit) return hit;
      }
      return null;
    };
    const tree = screen.toJSON() as Node | Node[];
    const modal = (Array.isArray(tree) ? tree : [tree]).map(find).find(Boolean)!;
    expect(modal.props).toMatchObject({ presentationStyle: "pageSheet", allowSwipeDismissal: true, visible: true });
    await act(async () => (modal.props.onRequestClose as () => void)());
    expect(screen.queryByTestId("auth-modal")).toBeNull();
  });

  it("«Opprett konto» åpner arket rett på ny konto", async () => {
    await renderProfile();
    await fireEvent.press(screen.getByTestId("open-register"));
    expect(screen.getByTestId("segment-register")).toBeSelected();
    expect(screen.getByTestId("first-name")).toBeOnTheScreen();
    expect(screen.getByTestId("auth-submit")).toHaveProp("accessibilityLabel", "Opprett konto");
  });

  it("vellykket innlogging: arket lukkes, og Min side viser kontoen", async () => {
    await renderProfile({ routes: { "mobileAuth.login": () => ({ data: AUTH_RESULT }) } });
    await fireEvent.press(screen.getByTestId("open-login"));
    await fireEvent.changeText(screen.getByTestId("email"), "kari@example.no");
    await fireEvent.changeText(screen.getByTestId("password"), "passord-123456");
    await fireEvent.press(screen.getByTestId("auth-submit"));
    await waitFor(() => expect(screen.getByTestId("account-signed-in")).toBeOnTheScreen());
    expect(screen.queryByTestId("auth-modal")).toBeNull();
  });

  it("innstillingene: språket med begge språk, og valutaen som informasjon (NOK) – ingen knapp", async () => {
    await renderProfile();
    const settings = within(screen.getByTestId("settings-group"));
    expect(settings.getByText("Innstillinger")).toHaveProp("accessibilityRole", "header");
    expect(settings.getByTestId("segment-nb")).toBeSelected();
    expect(settings.getByTestId("segment-en")).not.toBeSelected();
    // Med stor tekst brytes språknavnet i stedet for å kuttes («Norsk (bok…»).
    for (const id of ["segment-nb", "segment-en"]) expect(within(screen.getByTestId(id)).getByText(/./).props.numberOfLines).toBeUndefined();
    const currency = screen.getByTestId("currency-row");
    expect(currency).toHaveProp("accessibilityLabel", "Valuta, NOK, Alle priser vises i norske kroner.");
    expect(currency.props.accessibilityRole).toBeUndefined();
    expect(currency.props.onClick ?? currency.props.onPress).toBeUndefined();
  });

  it("hjelp og juridisk er lenker med hele raden som trykkflate (minst 44 pt), på engelsk med beskjed om at sidene er på norsk", async () => {
    await renderProfile({ locale: "en" });
    const help = within(screen.getByTestId("help-card"));
    expect(help.getByText("Help & legal")).toHaveProp("accessibilityRole", "header");
    for (const id of ["link-help", "link-privacy", "link-terms", "link-about"]) {
      expect(screen.getByTestId(id)).toHaveProp("accessibilityRole", "link");
      expect(StyleSheet.flatten(screen.getByTestId(id).props.style).minHeight).toBeGreaterThanOrEqual(44);
    }
    expect(help.getByText("Opens hellosky.no (in Norwegian)")).toBeOnTheScreen();
  });
});

describe("Min side innlogget", () => {
  it("konto som rader (navn og e-post), så innstillinger og hjelp; «Logg ut» og «Slett konto» nederst", async () => {
    await renderProfile({ signedIn: true });
    const account = within(screen.getByTestId("account-card"));
    expect(account.getByText("Konto og sikkerhet")).toHaveProp("accessibilityRole", "header");
    // Verdien øverst og hva den er under; VoiceOver hører «Navn: Kari Nordmann».
    expect(account.getByLabelText("Navn: Kari Nordmann")).toHaveTextContent(/^Kari Nordmann\s*Navn$/);
    expect(account.getByLabelText("E-post: kari@example.no")).toHaveTextContent(/^kari@example\.no\s*E-post$/);
    expect(screen.getByTestId("open-edit-profile")).toHaveProp("accessibilityRole", "button");
    expect(screen.getByTestId("logout-button")).toHaveProp("accessibilityRole", "button");
    // «Slett konto» er rød – med tekst, ikke bare farge.
    const del = within(screen.getByTestId("open-delete-account")).getByText("Slett konto");
    expect(StyleSheet.flatten(del.props.style).color).toBe(colors.danger);
    inOrder(["alerts-group", "account-card", "settings-group", "help-card", "logout-button", "open-delete-account"]);
  });
});

describe("Min side: tilstand mellom innlogging og utlogging", () => {
  it("listen starter øverst etter innlogging og etter utlogging (egen rulleflate per tilstand)", async () => {
    await renderProfile({ routes: { "mobileAuth.login": () => ({ data: AUTH_RESULT }), "mobileAuth.logout": () => ({ data: { ok: true } }) } });
    const guest = screen.getByTestId("account-signed-out");
    await fireEvent.press(screen.getByTestId("open-login"));
    await fireEvent.changeText(screen.getByTestId("email"), "kari@example.no");
    await fireEvent.changeText(screen.getByTestId("password"), "passord-123456");
    await fireEvent.press(screen.getByTestId("auth-submit"));
    await waitFor(() => expect(screen.getByTestId("account-signed-in")).toBeOnTheScreen());
    const signedIn = screen.getByTestId("account-signed-in");
    expect(signedIn).not.toBe(guest);
    await fireEvent.press(screen.getByTestId("logout-button"));
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    expect(screen.getByTestId("account-signed-out")).not.toBe(signedIn);
  });

  it("e-postadressen står til neste gang også etter innlogging og utlogging – passordet gjør det aldri", async () => {
    await renderProfile({ routes: { "mobileAuth.login": () => ({ data: AUTH_RESULT }), "mobileAuth.logout": () => ({ data: { ok: true } }) } });
    await fireEvent.press(screen.getByTestId("open-login"));
    await fireEvent.changeText(screen.getByTestId("email"), "kari@example.no");
    await fireEvent.changeText(screen.getByTestId("password"), "passord-123456");
    await fireEvent.press(screen.getByTestId("auth-submit"));
    await waitFor(() => expect(screen.getByTestId("account-signed-in")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("logout-button"));
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("open-login"));
    expect(screen.getByTestId("email").props.value).toBe("kari@example.no");
    expect(screen.getByTestId("password").props.value).toBe("");
  });

  const GOOGLE_READY = { password: true, social: [{ provider: "google" as const, available: true, reason: null }, { provider: "apple" as const, available: false, reason: "not_configured" as const }], clerkPublishableKey: "pk_live_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk" };

  it("et passord som ble skrevet, blir ikke liggende når innloggingen skjer uten skjemaet (Google)", async () => {
    const native: NativeSocialSignIn = { supports: (p) => p === "google", signIn: jest.fn(async () => ({ kind: "token" as const, token: "clerk-token-0123456789-0123456789" })) };
    const server = fakeServer({
      "mobileAuth.me": () => ({ data: null }),
      "mobileAuth.providers": () => ({ data: GOOGLE_READY }),
      "mobileAuth.exchangeSocialToken": () => ({ data: { ...AUTH_RESULT, created: false, linked: false } }),
      "mobileAuth.logout": () => ({ data: { ok: true } }),
    });
    const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
    await render(
      <AppProvider initialLocale="nb" apiFactory={factory} nativeSocial={native}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(server.calls.some((c) => c.path === "mobileAuth.providers")).toBe(true));
    await fireEvent.press(screen.getByTestId("open-login"));
    await waitFor(() => expect(screen.getByTestId("social-google")).toBeOnTheScreen());
    await fireEvent.changeText(screen.getByTestId("password"), "ikke-sendt-passord");
    await fireEvent.press(screen.getByTestId("social-google"));
    await waitFor(() => expect(screen.getByTestId("account-signed-in")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("logout-button"));
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("open-login"));
    expect(screen.getByTestId("password").props.value).toBe("");
  });

  it("mens innloggingen pågår: «Glemt passordet?» og bytte til ny konto gjør ingenting", async () => {
    // Google-vinduet står åpent (løftet svarer først når testen sier det).
    let finish!: () => void;
    const native: NativeSocialSignIn = { supports: (p) => p === "google", signIn: jest.fn(() => new Promise((resolve) => (finish = () => resolve({ kind: "cancelled" as const })))) };
    const server = fakeServer({ "mobileAuth.me": () => ({ data: null }), "mobileAuth.providers": () => ({ data: GOOGLE_READY }) });
    const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
    await render(
      <AppProvider initialLocale="nb" apiFactory={factory} nativeSocial={native}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(server.calls.some((c) => c.path === "mobileAuth.providers")).toBe(true));
    await fireEvent.press(screen.getByTestId("open-login"));
    await waitFor(() => expect(screen.getByTestId("social-google")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-google"));
    await fireEvent.press(screen.getByTestId("open-forgot"));
    expect(screen.queryByTestId("forgot-password")).toBeNull();
    await fireEvent.press(screen.getByTestId("segment-register"));
    expect(screen.getByTestId("segment-login")).toBeSelected();
    // Avbrutt: nå virker begge igjen.
    await act(async () => finish());
    await fireEvent.press(screen.getByTestId("open-forgot"));
    expect(screen.getByTestId("forgot-password")).toBeOnTheScreen();
  });

  it("en lang verdi til høyre tar aldri mer enn litt over halve raden, så etiketten får plass", async () => {
    // Med vanlig tekst står verdien til høyre (Jest-oppsettets standard er fontScale 2, der den står under tittelen).
    const base = { ...Dimensions.get("window") };
    const baseScreen = { ...Dimensions.get("screen") };
    try {
      await act(async () => Dimensions.set({ window: { ...base, fontScale: 1 }, screen: { ...baseScreen, fontScale: 1 } }));
      await renderProfile();
      const value = within(screen.getByTestId("currency-row")).getByText("NOK");
      expect(StyleSheet.flatten(value.props.style)).toMatchObject({ maxWidth: "55%", flexShrink: 1 });
    } finally {
      await act(async () => Dimensions.set({ window: base, screen: baseScreen }));
    }
  });
});
