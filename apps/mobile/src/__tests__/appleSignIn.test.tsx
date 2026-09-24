import fs from "fs";
import path from "path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import type { MobileAuthProviders } from "@contracts/mobileAuth";
import { AppProvider, type ApiFactory, type NativeSocialSignIn } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { createNativeSocial } from "../lib/nativeSocial.ios";
import { appleBuildReady } from "../lib/appleSupport";
import { __resetSsoRunnerForTests } from "../lib/clerkBridge";
import { fakeServer } from "../test/fakeServer";
import { AUTH_RESULT, TOKEN } from "../test/fixtures";
import AccountScreen from "../app/(tabs)/profil";

// Sign in with Apple via Clerks useSignInWithApple (@clerk/expo/apple), med Clerk
// byttet ut i jest.setup.tsx. Det som prøves er appens regler: når Apple kan
// vises, og at tokenet går samme vei som Google – exchangeSocialToken →
// HelloSky-sesjon – med avbrudd, feil og dobbeltrykk. Ingen ekte Apple-innlogging.

type ClerkMock = { providers: Record<string, unknown>[]; startSSOFlow: jest.Mock; startAppleAuthenticationFlow: jest.Mock; loaded: boolean; getToken: jest.Mock; signOut: jest.Mock };
const clerk = (jest.requireMock("@clerk/expo") as { __clerk: ClerkMock }).__clerk;
const keychain = (SecureStore as unknown as { __store: Map<string, { value: string; options: unknown }> }).__store;
const SESSION_KEY = "hellosky.customer-session";
const CLERK_TOKEN = "clerk-session-jwt-from-apple-flow-0123456789";
const PK = "pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk";

const caps = (google: boolean, apple: boolean): MobileAuthProviders => ({
  password: true,
  social: [
    { provider: "google", available: google, reason: google ? null : "native_not_ready" },
    { provider: "apple", available: apple, reason: apple ? null : "not_configured" },
  ],
  clerkPublishableKey: google || apple ? PK : null,
});

/** En build der Apple ER klar (rettighet + modul) – bare i test. */
const APPLE_READY = createNativeSocial(() => true);

type Routes = Parameters<typeof fakeServer>[0];
async function renderProfile(providers: MobileAuthProviders, native: NativeSocialSignIn = APPLE_READY, routes: Routes = {}, locale: "nb" | "en" = "nb") {
  const server = fakeServer({ "mobileAuth.me": () => ({ data: null }), "mobileAuth.providers": () => ({ data: providers }), ...routes });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  await render(
    <AppProvider initialLocale={locale} apiFactory={factory} nativeSocial={native}>
      <AccountScreen />
    </AppProvider>,
  );
  await waitFor(() => expect(server.calls.some((c) => c.path === "mobileAuth.providers")).toBe(true));
  return server;
}

const OK = { data: { ...AUTH_RESULT, created: true, linked: false } };
const APPLE_SESSION = () => ({ createdSessionId: "sess_apple", setActive: jest.fn(async () => undefined), signUp: { status: "complete" } });

beforeEach(() => {
  keychain.clear();
  clerk.providers.length = 0;
  clerk.startSSOFlow.mockReset();
  clerk.startAppleAuthenticationFlow.mockReset();
  clerk.getToken.mockReset();
  clerk.signOut.mockClear();
  clerk.loaded = true;
  __resetSsoRunnerForTests();
});

describe("når builden kan kjøre Sign in with Apple", () => {
  it("bare når Apples native modul er lenket OG app.json har ios.usesAppleSignIn – ellers aldri", () => {
    expect(appleBuildReady({ nativeModuleLinked: () => true, usesAppleSignIn: () => true })).toBe(true);
    expect(appleBuildReady({ nativeModuleLinked: () => false, usesAppleSignIn: () => true })).toBe(false);
    expect(appleBuildReady({ nativeModuleLinked: () => true, usesAppleSignIn: () => false })).toBe(false);
    expect(
      appleBuildReady({
        nativeModuleLinked: () => {
          throw new Error("x");
        },
        usesAppleSignIn: () => true,
      }),
    ).toBe(false);
  });

  it("iOS-konfigurasjonen lenker Apple-modulen og ber om rettigheten, men beholder Clerk JS uten native Clerk-modul", () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../package.json"), "utf8")) as { expo: { autolinking: { ios: { exclude: string[] } } } };
    expect(pkg.expo.autolinking.ios.exclude).toContain("@clerk/expo");
    expect(pkg.expo.autolinking.ios.exclude).not.toContain("expo-apple-authentication");
    const app = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../app.json"), "utf8")) as { expo: { ios?: { usesAppleSignIn?: boolean }; plugins?: unknown[] } };
    expect(app.expo.ios?.usesAppleSignIn).toBe(true);
    expect(app.expo.plugins).toContain("expo-apple-authentication");
  });

  it("manglende native Apple-modul + serveren sier klar: ingen død Apple-knapp", async () => {
    await renderProfile(caps(false, true), createNativeSocial(() => false));
    expect(screen.queryByTestId("social-apple")).toBeNull();
    expect(screen.queryByTestId("social-sign-in")).toBeNull();
    expect(clerk.providers).toHaveLength(0);
  });

  it("Apple-klar build, men serveren sier nei: ingen knapp og ingen Clerk", async () => {
    await renderProfile(caps(false, false));
    expect(screen.queryByTestId("social-apple")).toBeNull();
    expect(clerk.providers).toHaveLength(0);
  });
});

describe("Apple via Clerk → exchangeSocialToken → HelloSky-sesjon (Apple-klar build, i test)", () => {
  it("vellykket: Clerks Apple-flyt, Clerk-token byttes, HelloSky-sesjonen lagres, Clerk logges ut – Google røres ikke", async () => {
    const res = APPLE_SESSION();
    clerk.startAppleAuthenticationFlow.mockResolvedValue(res);
    clerk.getToken.mockResolvedValue(CLERK_TOKEN);
    const server = await renderProfile(caps(false, true), APPLE_READY, { "mobileAuth.exchangeSocialToken": () => OK });
    await waitFor(() => expect(screen.getByTestId("social-apple")).toHaveTextContent("Fortsett med Apple"));
    expect(screen.queryByTestId("social-google")).toBeNull();
    await fireEvent.press(screen.getByTestId("social-apple"));
    await waitFor(() => expect(screen.getByTestId("account-signed-in")).toBeOnTheScreen());

    expect(clerk.startAppleAuthenticationFlow).toHaveBeenCalledTimes(1);
    expect(clerk.startSSOFlow).not.toHaveBeenCalled();
    expect(res.setActive).toHaveBeenCalledWith({ session: "sess_apple" });
    const exchange = server.calls.filter((c) => c.path === "mobileAuth.exchangeSocialToken");
    expect(exchange).toHaveLength(1);
    expect(exchange[0]!.input).toEqual({ token: CLERK_TOKEN, locale: "nb" });
    expect(exchange[0]!.headers.authorization).toBeUndefined();
    const stored = keychain.get(SESSION_KEY)!.value;
    expect(JSON.parse(stored).token).toBe(TOKEN);
    expect(stored).not.toContain(CLERK_TOKEN);
    expect(clerk.signOut).toHaveBeenCalledTimes(1);
  });

  it("Apple-arket lukket (Clerk gir ingen økt): avbrutt, ingen bytte, ingen sesjon", async () => {
    clerk.startAppleAuthenticationFlow.mockResolvedValue({ createdSessionId: null });
    const server = await renderProfile(caps(false, true));
    await waitFor(() => expect(screen.getByTestId("social-apple")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-apple"));
    await waitFor(() => expect(screen.getByTestId("social-note")).toHaveTextContent("Innloggingen ble avbrutt. Ingenting er endret."));
    expect(server.calls.some((c) => c.path === "mobileAuth.exchangeSocialToken")).toBe(false);
    expect(clerk.getToken).not.toHaveBeenCalled();
    expect(keychain.has(SESSION_KEY)).toBe(false);
  });

  it("Avbryt i Apple-arket som AVVIST løfte (code ERR_REQUEST_CANCELED, som i Clerks Expo-eksempel): stille avbrudd, ingen feil, ingen bytte", async () => {
    clerk.startAppleAuthenticationFlow.mockRejectedValue(Object.assign(new Error("The user canceled the authorization attempt"), { code: "ERR_REQUEST_CANCELED" }));
    const server = await renderProfile(caps(false, true));
    await waitFor(() => expect(screen.getByTestId("social-apple")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-apple"));
    await waitFor(() => expect(screen.getByTestId("social-note")).toHaveTextContent("Innloggingen ble avbrutt. Ingenting er endret."));
    expect(screen.queryByTestId("auth-error")).toBeNull();
    expect(server.calls.some((c) => c.path === "mobileAuth.exchangeSocialToken")).toBe(false);
    expect(clerk.getToken).not.toHaveBeenCalled();
    expect(clerk.signOut).not.toHaveBeenCalled();
    expect(keychain.has(SESSION_KEY)).toBe(false);
    expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen();
  });

  it.each([
    ["annen Apple-kode (ERR_REQUEST_FAILED)", Object.assign(new Error("failed"), { code: "ERR_REQUEST_FAILED" })],
    ["feil uten kode", new Error("boom")],
  ])("en annen avvisning (%s) er fortsatt en feil – ikke et avbrudd", async (_label, err) => {
    clerk.startAppleAuthenticationFlow.mockRejectedValue(err);
    const server = await renderProfile(caps(false, true), APPLE_READY, {}, "en");
    await waitFor(() => expect(screen.getByTestId("social-apple")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-apple"));
    await waitFor(() => expect(screen.getByTestId("auth-error")).toHaveTextContent("We couldn't sign you in. Try again, or use e-mail and password."));
    expect(screen.queryByTestId("social-note")).toBeNull();
    expect(server.calls.some((c) => c.path === "mobileAuth.exchangeSocialToken")).toBe(false);
    expect(keychain.has(SESSION_KEY)).toBe(false);
  });

  it("ufullstendig registrering hos Clerk (missing_requirements) er en feil, ikke et avbrudd", async () => {
    clerk.startAppleAuthenticationFlow.mockResolvedValue({ createdSessionId: null, signUp: { status: "missing_requirements" } });
    const server = await renderProfile(caps(false, true), APPLE_READY, {}, "en");
    await waitFor(() => expect(screen.getByTestId("social-apple")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-apple"));
    await waitFor(() => expect(screen.getByTestId("auth-error")).toHaveTextContent("We couldn't sign you in. Try again, or use e-mail and password."));
    expect(screen.queryByTestId("social-note")).toBeNull();
    expect(server.calls.some((c) => c.path === "mobileAuth.exchangeSocialToken")).toBe(false);
  });

  it("Clerk ikke lastet ennå: feil, ikke «avbrutt», og Apple-arket åpnes ikke", async () => {
    clerk.loaded = false;
    await renderProfile(caps(false, true));
    await waitFor(() => expect(screen.getByTestId("social-apple")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-apple"));
    await waitFor(() => expect(screen.getByTestId("auth-error")).toBeOnTheScreen());
    expect(screen.queryByTestId("social-note")).toBeNull();
    expect(clerk.startAppleAuthenticationFlow).not.toHaveBeenCalled();
  });

  it("serveren avviser byttet (lookalike-adresse): meldingen vises, ingen HelloSky-sesjon, Clerk logges ut", async () => {
    clerk.startAppleAuthenticationFlow.mockResolvedValue(APPLE_SESSION());
    clerk.getToken.mockResolvedValue(CLERK_TOKEN);
    await renderProfile(caps(false, true), APPLE_READY, { "mobileAuth.exchangeSocialToken": () => ({ status: 409, error: { message: "x", appCode: "CONFLICT", field: "social", reason: "email_lookalike" } }) });
    await waitFor(() => expect(screen.getByTestId("social-apple")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-apple"));
    await waitFor(() => expect(screen.getByTestId("auth-error")).toHaveTextContent(/^Denne e-postadressen kan ikke brukes til en ny konto\./));
    expect(keychain.has(SESSION_KEY)).toBe(false);
    expect(clerk.signOut).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["getToken kaster", () => clerk.getToken.mockRejectedValue(new Error("network"))],
    ["getToken gir ingen token", () => clerk.getToken.mockResolvedValue(null)],
  ])("Apple: økten er aktivert, men %s – Clerk-økten avsluttes før feilen, ingen bytte, ingen sesjon", async (_label, arrange) => {
    const res = APPLE_SESSION();
    clerk.startAppleAuthenticationFlow.mockResolvedValue(res);
    arrange();
    const server = await renderProfile(caps(false, true));
    await waitFor(() => expect(screen.getByTestId("social-apple")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-apple"));
    await waitFor(() => expect(screen.getByTestId("auth-error")).toHaveTextContent("Vi fikk ikke logget deg inn. Prøv igjen, eller bruk e-post og passord."));
    expect(res.setActive).toHaveBeenCalledWith({ session: "sess_apple" });
    expect(clerk.signOut).toHaveBeenCalledTimes(1);
    expect(clerk.signOut.mock.invocationCallOrder[0]).toBeGreaterThan(res.setActive.mock.invocationCallOrder[0]!);
    expect(server.calls.some((c) => c.path === "mobileAuth.exchangeSocialToken")).toBe(false);
    expect(keychain.has(SESSION_KEY)).toBe(false);
    expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen();
  });

  it("dobbeltrykk, og Google trykket mens Apple-arket er åpent: én flyt, ett bytte", async () => {
    let finish!: (v: unknown) => void;
    clerk.startAppleAuthenticationFlow.mockImplementation(() => new Promise((r) => (finish = r)));
    clerk.getToken.mockResolvedValue(CLERK_TOKEN);
    const server = await renderProfile(caps(true, true), APPLE_READY, { "mobileAuth.exchangeSocialToken": () => OK });
    await waitFor(() => expect(screen.getByTestId("social-apple")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-apple"));
    await fireEvent.press(screen.getByTestId("social-apple"));
    await fireEvent.press(screen.getByTestId("social-google"));
    await waitFor(() => expect(clerk.startAppleAuthenticationFlow).toHaveBeenCalledTimes(1));
    finish(APPLE_SESSION());
    await waitFor(() => expect(screen.getByTestId("account-signed-in")).toBeOnTheScreen());
    expect(clerk.startAppleAuthenticationFlow).toHaveBeenCalledTimes(1);
    expect(clerk.startSSOFlow).not.toHaveBeenCalled();
    expect(server.calls.filter((c) => c.path === "mobileAuth.exchangeSocialToken")).toHaveLength(1);
  });
});
