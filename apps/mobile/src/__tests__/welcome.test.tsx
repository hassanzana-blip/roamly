import { useEffect } from "react";
import { AccessibilityInfo, Animated, StyleSheet } from "react-native";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as FileSystem from "expo-file-system";
import * as SafeArea from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import type { MobileAuthProviders } from "@contracts/mobileAuth";
import { AppProvider, useApp, type ApiFactory, type NativeSocialSignIn } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { appleBuildReady } from "../lib/appleSupport";
import { __resetLocalStoreForTests, readPref, writePref } from "../lib/localStore";
import { I18nProvider } from "../i18n";
import { fakeServer } from "../test/fakeServer";
import { AUTH_RESULT, PROFILE, TOKEN } from "../test/fixtures";
import { colors } from "../lib/theme";
import { WELCOME_SEEN_KEY, WelcomeGate } from "../components/WelcomeGate";
import { SocialButtons } from "../components/SocialButtons";
import SearchScreen from "../app/(tabs)/index";

// Velkomsten ved første oppstart (components/WelcomeGate.tsx), montert over appen som i src/app/_layout.tsx – her over
// forsiden. Serveren er en falsk HTTP-server, og Google/Apple et testadapter (som i socialAuth.test.tsx), så det som
// prøves er appens regler: når velkomsten vises, hva som lukker den, hvilke knapper som står, og flagget på telefonen.

// Kan builden kjøre Sign in with Apple? Standard: den ekte sjekken (nei i Jest, der app.json ikke er bygget inn).
jest.mock("../lib/appleSupport", () => {
  const actual = jest.requireActual("../lib/appleSupport");
  return { ...actual, appleBuildReady: jest.fn(actual.appleBuildReady) };
});

// Apples systemknapp (expo-apple-authentication) finnes bare i en ekte build: her en View som husker det den fikk.
jest.mock("expo-apple-authentication", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");
  const AppleAuthenticationButton = jest.fn((props: { testID?: string; onPress: () => void }) => <View {...({ testID: props.testID, onPress: props.onPress } as object)} />);
  return {
    __esModule: true,
    AppleAuthenticationButton,
    AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
    AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
  };
});

// Statuslinjen: en View som viser stilen den fikk (lys eller mørk tekst).
jest.mock("expo-status-bar", () => {
  const { View } = jest.requireActual("react-native");
  return { StatusBar: (props: { style?: string }) => <View testID="status-bar" {...({ statusBarStyle: props.style } as object)} /> };
});

const appleReady = appleBuildReady as jest.Mock;
const AppleSystemButton = (jest.requireMock("expo-apple-authentication") as { AppleAuthenticationButton: jest.Mock }).AppleAuthenticationButton;
const realAppleBuildReady = (jest.requireActual("../lib/appleSupport") as { appleBuildReady: () => boolean }).appleBuildReady;

const keychain = (SecureStore as unknown as { __store: Map<string, { value: string; options: unknown }> }).__store;
const files = (FileSystem as unknown as { __files: Map<string, string> }).__files;
const PREFS = "file:///documents/hellosky-prefs.json";
const SESSION_KEY = "hellosky.customer-session";
const CLERK_TOKEN = "clerk-session-token-from-native-sdk-0123456789";
const PK = "pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk";

const caps = (google: boolean, apple: boolean): MobileAuthProviders => ({
  password: true,
  social: [
    { provider: "google", available: google, reason: google ? null : "native_not_ready" },
    { provider: "apple", available: apple, reason: apple ? null : "not_configured" },
  ],
  clerkPublishableKey: google || apple ? PK : null,
});

/** Testadapter: støtter de oppgitte leverandørene; svaret styres per test. */
function fakeNative(supported: string[], signIn: NativeSocialSignIn["signIn"] = async () => ({ kind: "token", token: CLERK_TOKEN })): NativeSocialSignIn & { signIn: jest.Mock } {
  return { supports: (p) => supported.includes(p), signIn: jest.fn(signIn) };
}

/** Appens tilstand slik den er etter siste bilde (auth, logout). */
let app: ReturnType<typeof useApp>;
function Probe({ onApp }: { onApp: (value: ReturnType<typeof useApp>) => void }) {
  const value = useApp();
  useEffect(() => {
    onApp(value);
  });
  return null;
}

type Routes = Parameters<typeof fakeServer>[0];
async function renderApp({ providers = caps(false, false), native = fakeNative([]), routes = {}, locale = "nb", signedIn = false }: { providers?: MobileAuthProviders; native?: NativeSocialSignIn; routes?: Routes; locale?: "nb" | "en"; signedIn?: boolean } = {}) {
  if (signedIn) keychain.set(SESSION_KEY, { value: JSON.stringify({ token: TOKEN, expiresAt: "2099-01-01T00:00:00Z" }), options: {} });
  const server = fakeServer({ "mobileAuth.me": () => ({ data: signedIn ? PROFILE : null }), "mobileAuth.providers": () => ({ data: providers }), ...routes });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  await render(
    <AppProvider initialLocale={locale} apiFactory={factory} nativeSocial={native}>
      <Probe onApp={(value) => (app = value)} />
      <SearchScreen />
      <WelcomeGate />
    </AppProvider>,
  );
  return server;
}

/** Velkomsten er oppe (gjest, auth avklart). */
async function welcomeShown() {
  await waitFor(() => expect(screen.getByTestId("welcome")).toBeOnTheScreen());
}

const seenFlag = () => readPref(WELCOME_SEEN_KEY, (v) => v);

type HostNode = { type: string; props: Record<string, unknown>; children: (HostNode | string)[] | null };

/** Elementer VoiceOver kan stoppe på uten riktig språk (samme regel som i a11yLanguage.test.tsx). */
function wrongLanguage(expected: string): { count: number; wrong: { type: string; testID?: string; lang: unknown }[] } {
  const wrong: { type: string; testID?: string; lang: unknown }[] = [];
  let count = 0;
  const walk = (n: HostNode | string | null, insideAccessible: boolean) => {
    if (!n || typeof n === "string") return;
    const p = n.props ?? {};
    if (p.accessibilityElementsHidden === true || p.importantForAccessibility === "no-hide-descendants") return;
    const accessible = p.accessible === true;
    const focusable = accessible || n.type === "TextInput" || p.accessibilityViewIsModal === true || (n.type === "Text" && !insideAccessible);
    if (focusable && p.accessible !== false) {
      count++;
      if (p.accessibilityLanguage !== expected) wrong.push({ type: n.type, testID: p.testID as string | undefined, lang: p.accessibilityLanguage });
    }
    for (const c of n.children ?? []) walk(c, insideAccessible || accessible);
  };
  walk(screen.getByTestId("welcome") as unknown as HostNode, false);
  return { count, wrong };
}

beforeEach(() => {
  keychain.clear();
  appleReady.mockReset();
  appleReady.mockImplementation(realAppleBuildReady);
  AppleSystemButton.mockClear();
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(false);
  (AccessibilityInfo.sendAccessibilityEvent as jest.Mock).mockClear();
});

describe("når velkomsten vises", () => {
  it("ny installasjon, gjest: velkomsten dekker appen som et modalt lag – og ingenting er lagret bare av å vise den", async () => {
    await renderApp();
    await welcomeShown();
    const root = screen.getByTestId("welcome");
    expect(root.props.accessibilityViewIsModal).toBe(true);
    // Forsiden under er skjult for VoiceOver så lenge velkomsten står.
    expect(screen.queryByTestId("search-button")).toBeNull();
    expect(screen.getByTestId("search-button", { includeHiddenElements: true })).toBeTruthy();
    // VoiceOver går til overskriften når velkomsten er tonet inn – én gang.
    await waitFor(() => expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenCalledWith(expect.anything(), "focus"));
    expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenCalledTimes(1);
    expect(seenFlag()).toBeNull();
  });

  it("med flagget satt vises den aldri – og forsiden gjør ingen innloggingskall", async () => {
    writePref(WELCOME_SEEN_KEY, true);
    const server = await renderApp();
    await waitFor(() => expect(app.auth.status).toBe("signedOut"));
    expect(screen.queryByTestId("welcome", { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId("search-button")).toBeOnTheScreen();
    expect(server.calls.some((c) => c.path === "mobileAuth.providers")).toBe(false);
  });

  it("innlogget ved oppstart: velkomsten vises ikke, flagget settes – og den kommer ikke etter en utlogging", async () => {
    await renderApp({ signedIn: true, routes: { "mobileAuth.logout": () => ({ data: { ok: true } }) } });
    await waitFor(() => expect(app.auth.status).toBe("signedIn"));
    await waitFor(() => expect(seenFlag()).toBe(true));
    expect(screen.queryByTestId("welcome", { includeHiddenElements: true })).toBeNull();
    await act(async () => {
      await app.logout();
    });
    expect(app.auth.status).toBe("signedOut");
    expect(screen.queryByTestId("welcome", { includeHiddenElements: true })).toBeNull();
  });

  it("mens en lagret økt sjekkes ved oppstart (serveren svarer ikke ennå), vises ingenting", async () => {
    let answer!: () => void;
    const me = () => new Promise<never>((resolve) => (answer = () => (resolve as (v: unknown) => void)({ data: PROFILE })));
    await renderApp({ signedIn: true, routes: { "mobileAuth.me": me } });
    await act(async () => undefined);
    expect(app.auth.status).toBe("loading");
    expect(screen.queryByTestId("welcome", { includeHiddenElements: true })).toBeNull();
    expect(seenFlag()).toBeNull();
    // Serveren svarer: kunden er logget inn, og velkomsten kommer aldri.
    await act(async () => answer());
    await waitFor(() => expect(app.auth.status).toBe("signedIn"));
    expect(screen.queryByTestId("welcome", { includeHiddenElements: true })).toBeNull();
    expect(seenFlag()).toBe(true);
  });
});

describe("«Hopp over»", () => {
  it("lukker velkomsten, setter flagget og gir forsiden tilbake til VoiceOver; trykkflaten er minst 44 pt", async () => {
    await renderApp();
    await welcomeShown();
    const skip = screen.getByTestId("welcome-skip");
    expect(StyleSheet.flatten(skip.props.style)).toMatchObject({ minHeight: 44, minWidth: 44 });
    expect(skip).toHaveProp("accessibilityRole", "button");
    await fireEvent.press(skip);
    expect(screen.queryByTestId("welcome")).toBeNull();
    expect(screen.getByTestId("search-button")).toBeOnTheScreen();
    expect(seenFlag()).toBe(true);
    // Laget er helt borte når det har gått ut av skjermen.
    await waitFor(() => expect(screen.queryByTestId("welcome", { includeHiddenElements: true })).toBeNull());
  });

  it("huskes på telefonen: neste oppstart har ingen velkomst, og filen har bare flagget – ingen persondata", async () => {
    await renderApp();
    await welcomeShown();
    await fireEvent.press(screen.getByTestId("welcome-skip"));
    expect(JSON.parse(files.get(PREFS)!)).toMatchObject({ v: 1, welcomeSeen: true });
    await screen.unmount();
    __resetLocalStoreForTests(); // som en ekte omstart: flagget må leses fra filen

    await renderApp();
    await waitFor(() => expect(app.auth.status).toBe("signedOut"));
    expect(screen.queryByTestId("welcome", { includeHiddenElements: true })).toBeNull();
  });

  it("VoiceOvers «tilbake»-gest (to fingre, Z) er det samme som «Hopp over»", async () => {
    await renderApp();
    await welcomeShown();
    await act(async () => (screen.getByTestId("welcome").props.onAccessibilityEscape as () => void)());
    expect(screen.queryByTestId("welcome")).toBeNull();
    expect(seenFlag()).toBe(true);
  });

  it("uten «Reduser bevegelse» skyves velkomsten ned; med den tones den ut", async () => {
    // Animasjonen holdes igjen, så laget kan sjekkes midt i utgangen.
    const timing = jest.spyOn(Animated, "timing").mockImplementation(() => ({ start: () => undefined, stop: () => undefined, reset: () => undefined }) as unknown as Animated.CompositeAnimation);
    try {
      await renderApp();
      await welcomeShown();
      await fireEvent.press(screen.getByTestId("welcome-skip"));
      const sliding = StyleSheet.flatten(screen.getByTestId("welcome", { includeHiddenElements: true }).props.style);
      expect(sliding.opacity).toBe(1);
      expect(sliding.transform).toEqual([{ translateY: expect.any(Number) }]);
      expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ toValue: 0, duration: 320 }));
      await screen.unmount();
      __resetLocalStoreForTests();
      files.clear();

      (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
      await renderApp();
      await welcomeShown();
      await act(async () => undefined);
      await fireEvent.press(screen.getByTestId("welcome-skip"));
      const fading = StyleSheet.flatten(screen.getByTestId("welcome", { includeHiddenElements: true }).props.style);
      // Ingen bevegelse: laget blir der det er og tones ut.
      expect(fading.transform).toEqual([{ translateY: 0 }]);
      expect(fading.opacity).toEqual(expect.any(Number));
      expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ toValue: 0, duration: 200 }));
    } finally {
      timing.mockRestore();
    }
  });
});

describe("statuslinjen", () => {
  it("lys tekst over fotoet; har øya rullet ut under statuslinjen (stor tekst), mørk tekst og en lys skjerm – og tilbake", async () => {
    const TOP = 59;
    // Safe area-modulen er allerede byttet ut i jest.setup.tsx; den opprinnelige utgaven settes tilbake etterpå.
    const insets = SafeArea.useSafeAreaInsets as jest.Mock;
    const original = insets.getMockImplementation()!;
    insets.mockReturnValue({ top: TOP, bottom: 34, left: 0, right: 0 });
    try {
      await renderApp();
      await welcomeShown();
      const welcome = () => within(screen.getByTestId("welcome"));
      const statusBarStyle = () => welcome().getByTestId("status-bar").props.statusBarStyle as string;
      const scrollTo = (y: number) =>
        fireEvent.scroll(screen.getByTestId("welcome-scroll"), {
          nativeEvent: { contentOffset: { x: 0, y }, contentSize: { width: 390, height: 1400 }, layoutMeasurement: { width: 390, height: 844 }, zoomScale: 1 },
          timeStamp: y + 1,
        });
      // Fotoet går under statuslinjen, og «Hopp over» står under den.
      expect(StyleSheet.flatten(screen.getByTestId("welcome-island").props.style).paddingTop).toBeGreaterThan(TOP);
      expect(statusBarStyle()).toBe("light");
      expect(welcome().queryByTestId("status-bar-shield")).toBeNull();
      await fireEvent(screen.getByTestId("welcome-island"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 420 } } });
      // 420 − 59 = 361 pt kan rulles før øya er ute av statuslinjen.
      await scrollTo(300);
      expect(statusBarStyle()).toBe("light");
      await scrollTo(400);
      expect(statusBarStyle()).toBe("dark");
      expect(StyleSheet.flatten(welcome().getByTestId("status-bar-shield").props.style)).toMatchObject({ height: TOP, backgroundColor: colors.canvas });
      await scrollTo(0);
      expect(statusBarStyle()).toBe("light");
      expect(welcome().queryByTestId("status-bar-shield")).toBeNull();
    } finally {
      insets.mockImplementation(original);
    }
  });
});

describe("e-post", () => {
  it("«Fortsett med e-post» åpner innloggingsarket i innlogging; lukkes arket, står velkomsten igjen uten flagg", async () => {
    await renderApp();
    await welcomeShown();
    expect(screen.getByTestId("welcome-email")).toHaveProp("accessibilityHint", "Åpner innloggingen");
    await fireEvent.press(screen.getByTestId("welcome-email"));
    expect(screen.getByTestId("auth-modal")).toBeOnTheScreen();
    expect(screen.getByTestId("segment-login")).toBeSelected();
    await fireEvent.press(screen.getByTestId("auth-close"));
    expect(screen.queryByTestId("auth-modal")).toBeNull();
    expect(screen.getByTestId("welcome")).toBeOnTheScreen();
    expect(seenFlag()).toBeNull();
  });

  it("«Opprett konto» åpner arket rett på ny konto", async () => {
    await renderApp();
    await welcomeShown();
    const register = screen.getByTestId("welcome-register");
    expect(register).toHaveProp("accessibilityHint", "Åpner skjemaet for ny konto");
    expect(StyleSheet.flatten(register.props.style).minHeight).toBeGreaterThanOrEqual(44);
    await fireEvent.press(register);
    expect(screen.getByTestId("segment-register")).toBeSelected();
    expect(screen.getByTestId("first-name")).toBeOnTheScreen();
  });

  it("vellykket innlogging: arket og velkomsten lukkes, flagget settes – og innstillingsfilen har ingen persondata", async () => {
    const server = await renderApp({ routes: { "mobileAuth.login": () => ({ data: AUTH_RESULT }) } });
    await welcomeShown();
    await fireEvent.press(screen.getByTestId("welcome-email"));
    await fireEvent.changeText(screen.getByTestId("email"), "kari@example.no");
    await fireEvent.changeText(screen.getByTestId("password"), "passord-123456");
    await fireEvent.press(screen.getByTestId("auth-submit"));
    await waitFor(() => expect(app.auth.status).toBe("signedIn"));
    expect(screen.queryByTestId("welcome")).toBeNull();
    expect(screen.queryByTestId("auth-modal")).toBeNull();
    expect(seenFlag()).toBe(true);
    expect(server.calls.find((c) => c.path === "mobileAuth.login")!.input).toMatchObject({ identifier: "kari@example.no" });
    const stored = files.get(PREFS)!;
    expect(JSON.parse(stored).welcomeSeen).toBe(true);
    expect(stored).not.toMatch(/kari|Kari|Nordmann|passord|tok_/);
  });
});

describe("Google og Apple på velkomsten", () => {
  it("serveren sier nei (som i dag): ingen knapper – e-post og «Hopp over» virker", async () => {
    const server = await renderApp({ providers: caps(false, false), native: fakeNative(["google", "apple"]) });
    await welcomeShown();
    await waitFor(() => expect(server.calls.some((c) => c.path === "mobileAuth.providers")).toBe(true));
    await act(async () => undefined);
    expect(screen.queryByTestId("welcome-social")).toBeNull();
    expect(screen.queryByTestId("social-google")).toBeNull();
    expect(screen.queryByTestId("social-apple")).toBeNull();
    expect(screen.getByTestId("welcome-email")).toBeOnTheScreen();
  });

  it("serveren sier ja til begge, men builden kan bare Google: bare Google", async () => {
    await renderApp({ providers: caps(true, true), native: fakeNative(["google"]) });
    await waitFor(() => expect(screen.getByTestId("social-google")).toHaveTextContent("Fortsett med Google"));
    expect(screen.queryByTestId("social-apple")).toBeNull();
  });

  it("begge klare: Apple først, så Google, og så e-post – med etikett og hint", async () => {
    await renderApp({ providers: caps(true, true), native: fakeNative(["google", "apple"]) });
    await waitFor(() => expect(screen.getByTestId("social-apple")).toBeOnTheScreen());
    const buttons = within(screen.getByTestId("welcome-actions")).getAllByRole("button").map((b) => b.props.testID as string);
    expect(buttons).toEqual(["social-apple", "social-google", "welcome-email", "welcome-register"]);
    for (const id of ["social-apple", "social-google"]) expect(screen.getByTestId(id)).toHaveProp("accessibilityHint", "Åpner leverandørens innlogging. HelloSky får navnet og e-postadressen din.");
  });

  it("uten Apples native modul: vår svarte pille med «Fortsett med Apple» – ikke Apples systemknapp", async () => {
    appleReady.mockReturnValue(false);
    await renderApp({ providers: caps(false, true), native: fakeNative(["apple"]) });
    await waitFor(() => expect(screen.getByTestId("social-apple")).toHaveTextContent("Fortsett med Apple"));
    const apple = screen.getByTestId("social-apple");
    expect(apple).toHaveProp("accessibilityRole", "button");
    expect(apple).toHaveProp("accessibilityLabel", "Fortsett med Apple");
    expect(StyleSheet.flatten(apple.props.style)).toMatchObject({ backgroundColor: "#000000", borderRadius: 999, minHeight: 52 });
    expect(within(apple).getByText("Fortsett med Apple")).toHaveStyle({ color: colors.white });
    expect(AppleSystemButton).not.toHaveBeenCalled();
  });

  it("builden kan kjøre Sign in with Apple: Apples systemknapp, og et trykk logger inn med Apple", async () => {
    appleReady.mockReturnValue(true);
    let finish!: () => void;
    const native = fakeNative(["apple"], () => new Promise((resolve) => (finish = () => resolve({ kind: "token", token: CLERK_TOKEN }))));
    const server = await renderApp({ providers: caps(false, true), native, routes: { "mobileAuth.exchangeSocialToken": () => ({ data: { ...AUTH_RESULT, created: true, linked: false } }) } });
    await waitFor(() => expect(screen.getByTestId("social-apple")).toBeOnTheScreen());
    expect(AppleSystemButton).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("social-apple"));
    // Apple har sin egen tekst på knappen: at innloggingen pågår, står under knappene.
    expect(screen.getByTestId("social-busy")).toHaveTextContent("Logger inn med Apple …");
    await act(async () => finish());
    await waitFor(() => expect(app.auth.status).toBe("signedIn"));
    expect(native.signIn).toHaveBeenCalledWith("apple", PK);
    expect(server.calls.filter((c) => c.path === "mobileAuth.exchangeSocialToken")).toHaveLength(1);
    expect(screen.queryByTestId("welcome")).toBeNull();
    expect(seenFlag()).toBe(true);
  });

  it("Google: innlogget, velkomsten lukkes og flagget settes; HelloSky-sesjonen ligger i nøkkelringen", async () => {
    const native = fakeNative(["google"]);
    await renderApp({ providers: caps(true, false), native, routes: { "mobileAuth.exchangeSocialToken": () => ({ data: { ...AUTH_RESULT, created: false, linked: false } }) } });
    await waitFor(() => expect(screen.getByTestId("social-google")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-google"));
    await waitFor(() => expect(app.auth.status).toBe("signedIn"));
    expect(native.signIn).toHaveBeenCalledWith("google", PK);
    expect(screen.queryByTestId("welcome")).toBeNull();
    expect(seenFlag()).toBe(true);
    expect(JSON.parse(keychain.get(SESSION_KEY)!.value).token).toBe(TOKEN);
  });

  it("avbrutt av kunden: en rolig melding, velkomsten står og flagget er ikke satt", async () => {
    await renderApp({ providers: caps(true, false), native: fakeNative(["google"], async () => ({ kind: "cancelled" })) });
    await waitFor(() => expect(screen.getByTestId("social-google")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-google"));
    await waitFor(() => expect(screen.getByTestId("welcome-social-note")).toHaveTextContent("Innloggingen ble avbrutt. Ingenting er endret."));
    expect(screen.getByTestId("welcome")).toBeOnTheScreen();
    expect(seenFlag()).toBeNull();
  });

  it("feil i innloggingen: en ærlig melding på velkomsten (engelsk)", async () => {
    const native = fakeNative(["google"], async () => {
      throw new Error("sdk failure");
    });
    await renderApp({ providers: caps(true, false), native, locale: "en" });
    await waitFor(() => expect(screen.getByTestId("social-google")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-google"));
    await waitFor(() => expect(screen.getByTestId("welcome-error")).toHaveTextContent("We couldn't sign you in. Try again, or use e-mail and password."));
    expect(screen.getByTestId("welcome")).toBeOnTheScreen();
  });

  it("mens Google logger inn: knappen sier det, e-post starter ikke en innlogging til – men «Hopp over» virker alltid", async () => {
    let finish!: () => void;
    const native = fakeNative(["google"], () => new Promise((resolve) => (finish = () => resolve({ kind: "cancelled" }))));
    await renderApp({ providers: caps(true, false), native });
    await waitFor(() => expect(screen.getByTestId("social-google")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-google"));
    expect(screen.getByTestId("social-google")).toHaveTextContent("Logger inn med Google …");
    await fireEvent.press(screen.getByTestId("social-google"));
    await fireEvent.press(screen.getByTestId("welcome-email"));
    expect(screen.queryByTestId("auth-modal")).toBeNull();
    expect(native.signIn).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId("welcome-skip"));
    expect(screen.queryByTestId("welcome")).toBeNull();
    expect(seenFlag()).toBe(true);
    await act(async () => finish());
  });
});

describe("knappene for Google og Apple (også i innloggingsarket)", () => {
  it("Google: hvit pille med tynn, lys kant og mørk tekst, minst 52 pt – ingen logo tegnet av oss", async () => {
    await render(
      <I18nProvider initialLocale="nb">
        <SocialButtons providers={["google"]} busy={null} onPress={() => undefined} />
      </I18nProvider>,
    );
    const google = screen.getByTestId("social-google");
    expect(StyleSheet.flatten(google.props.style)).toMatchObject({ backgroundColor: colors.white, borderColor: colors.lightBorder, borderRadius: 999, minHeight: 52 });
    expect(within(google).getByText("Fortsett med Google")).toHaveStyle({ color: colors.text });
    expect(within(google).queryByTestId(/logo/i)).toBeNull();
  });

  it("Apples systemknapp: «Fortsett», svart, pilleform og 52 pt – Apple tegner tekst og logo, vi setter aldri farge eller hjørner i stilen", async () => {
    appleReady.mockReturnValue(true);
    const onPress = jest.fn();
    await render(
      <I18nProvider initialLocale="nb">
        <SocialButtons providers={["google", "apple"]} busy={null} onPress={onPress} />
      </I18nProvider>,
    );
    const props = AppleSystemButton.mock.calls.at(-1)![0] as { buttonType: number; buttonStyle: number; cornerRadius: number; style: unknown; testID: string };
    expect(props).toMatchObject({ buttonType: 1, buttonStyle: 2, cornerRadius: 26, testID: "social-apple" });
    const style = StyleSheet.flatten(props.style as never) as Record<string, unknown>;
    expect(style.height).toBeGreaterThanOrEqual(44);
    expect(style.backgroundColor).toBeUndefined();
    expect(style.borderRadius).toBeUndefined();
    await fireEvent.press(screen.getByTestId("social-apple"));
    expect(onPress).toHaveBeenCalledWith("apple");
    // Google er fortsatt vår egen pille.
    expect(screen.getByTestId("social-google")).toHaveTextContent("Fortsett med Google");
  });

  it("en leverandør som ikke er i listen, får ingen knapp – og en tom liste gir ingenting", async () => {
    await render(
      <I18nProvider initialLocale="nb">
        <SocialButtons providers={[]} busy={null} onPress={() => undefined} testID="social" />
      </I18nProvider>,
    );
    expect(screen.queryByTestId("social")).toBeNull();
  });
});

describe.each([
  ["nb", "nb-NO", { title: "Sammenlign flypriser fra flyselskaper og reisebyråer – i norske kroner.", skip: "Hopp over", skipHint: "Går videre uten konto. Du kan logge inn senere i Profil.", email: "Fortsett med e-post", register: "Opprett konto", note: "Du kan søke uten konto.", google: "Fortsett med Google", apple: "Fortsett med Apple" }],
  ["en", "en-GB", { title: "Compare flight prices from airlines and travel agencies – in Norwegian kroner.", skip: "Skip", skipHint: "Continues without an account. You can log in later in Profile.", email: "Continue with e-mail", register: "Create account", note: "You can search without an account.", google: "Continue with Google", apple: "Continue with Apple" }],
] as const)("språk og VoiceOver (%s)", (locale, lang, c) => {
  it("tekstene, overskriften og VoiceOver-språket på roten og på hvert element", async () => {
    await renderApp({ locale, providers: caps(true, true), native: fakeNative(["google", "apple"]) });
    await welcomeShown();
    await waitFor(() => expect(screen.getByTestId("social-apple")).toBeOnTheScreen());
    expect(screen.getByTestId("welcome")).toHaveProp("accessibilityLanguage", lang);
    expect(screen.getByTestId("welcome-title")).toHaveTextContent(c.title);
    expect(screen.getByTestId("welcome-title")).toHaveProp("accessibilityRole", "header");
    expect(screen.getByTestId("welcome-skip")).toHaveProp("accessibilityLabel", c.skip);
    expect(screen.getByTestId("welcome-skip")).toHaveProp("accessibilityHint", c.skipHint);
    expect(screen.getByTestId("welcome-email")).toHaveTextContent(c.email);
    expect(screen.getByTestId("welcome-register")).toHaveTextContent(c.register);
    expect(screen.getByTestId("welcome-no-account")).toHaveTextContent(c.note);
    expect(screen.getByTestId("social-google")).toHaveTextContent(c.google);
    expect(screen.getByTestId("social-apple")).toHaveTextContent(c.apple);
    // Merket leses som «HelloSky»; fotoet er pynt og hoppes over.
    expect(within(screen.getByTestId("welcome")).getByLabelText("HelloSky")).toHaveProp("accessibilityRole", "image");
    const { count, wrong } = wrongLanguage(lang);
    expect(wrong).toEqual([]);
    expect(count).toBeGreaterThanOrEqual(8);
    // Ingen tekst er kuttet: ingen linjegrense noe sted på velkomsten.
    for (const el of within(screen.getByTestId("welcome")).getAllByText(/./)) expect(el.props.numberOfLines).toBeUndefined();
  });
});
