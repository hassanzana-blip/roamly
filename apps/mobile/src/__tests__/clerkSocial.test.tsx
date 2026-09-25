import fs from "fs";
import path from "path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import type { MobileAuthProviders } from "@contracts/mobileAuth";
import { AppProvider, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { nativeSocialSignIn } from "../lib/nativeSocial";
import { SSO_REDIRECT_URL } from "../lib/socialAuth";
import { __resetSsoRunnerForTests } from "../lib/clerkBridge";
import { fakeServer } from "../test/fakeServer";
import { AUTH_RESULT, TOKEN } from "../test/fixtures";
import AccountScreen from "../app/(tabs)/profil";
import SearchScreen from "../app/(tabs)/index";

// Den ekte iOS-veien: lib/nativeSocial.ios.tsx + lib/clerkSocial.ios.tsx, med
// @clerk/expo byttet ut i jest.setup.tsx (ingen nettverk). Det som prøves er
// appens bruk av Clerk: når Clerk lastes, hvilken flyt og retur-URL, token →
// exchangeSocialToken → HelloSky-sesjon, avbrudd, feil, dobbeltrykk og utlogging av Clerk.

type ClerkMock = { providers: Record<string, unknown>[]; startSSOFlow: jest.Mock; getToken: jest.Mock; signOut: jest.Mock };
const clerk = (jest.requireMock("@clerk/expo") as { __clerk: ClerkMock }).__clerk;
const keychain = (SecureStore as unknown as { __store: Map<string, { value: string; options: unknown }> }).__store;
const SESSION_KEY = "hellosky.customer-session";
const CLERK_TOKEN = "clerk-session-jwt-short-lived-0123456789abcdef";
const PK = "pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk";

const caps = (google: boolean, apple: boolean, key: string | null = PK): MobileAuthProviders => ({
  password: true,
  social: [
    { provider: "google", available: google, reason: google ? null : "native_not_ready" },
    { provider: "apple", available: apple, reason: apple ? null : "not_configured" },
  ],
  clerkPublishableKey: google || apple ? key : null,
});

const SUCCESS = () => ({ createdSessionId: "sess_1", setActive: jest.fn(async () => undefined), authSessionResult: { type: "success" } });

type Routes = Parameters<typeof fakeServer>[0];
async function renderProfile(providers: MobileAuthProviders, routes: Routes = {}, locale: "nb" | "en" = "nb") {
  const server = fakeServer({ "mobileAuth.me": () => ({ data: null }), "mobileAuth.providers": () => ({ data: providers }), ...routes });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  await render(
    <AppProvider initialLocale={locale} apiFactory={factory}>
      <AccountScreen />
    </AppProvider>,
  );
  await waitFor(() => expect(server.calls.some((c) => c.path === "mobileAuth.providers")).toBe(true));
  // Skjemaet (og Google/Apple) står i innloggingsarket, som åpnes fra kortet øverst i Profil.
  await fireEvent.press(screen.getByTestId("open-login"));
  return server;
}

beforeEach(() => {
  keychain.clear();
  clerk.providers.length = 0;
  clerk.startSSOFlow.mockReset();
  clerk.getToken.mockReset();
  clerk.signOut.mockClear();
  __resetSsoRunnerForTests();
});

describe("iOS-builden: hva som vises, og når Clerk lastes", () => {
  it("Google støttes av builden, Apple ikke (krever Sign in with Apple-rettighet som ikke finnes)", () => {
    expect(nativeSocialSignIn.supports("google")).toBe(true);
    expect(nativeSocialSignIn.supports("apple")).toBe(false);
    expect(nativeSocialSignIn.Host).toBeDefined();
  });

  it("iOS-bunten får Clerk-adapteret: standardfilen har samme filendelse som iOS-filen (Metro prøver .ts før .tsx)", () => {
    const lib = path.resolve(__dirname, "../lib");
    expect(fs.existsSync(path.join(lib, "nativeSocial.ios.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(lib, "nativeSocial.tsx"))).toBe(true);
    for (const shadow of ["nativeSocial.ts", "nativeSocial.ios.ts", "nativeSocial.native.ts", "nativeSocial.native.tsx"]) expect(fs.existsSync(path.join(lib, shadow))).toBe(false);
  });

  it("Clerks native iOS-modul er utelatt fra autolinking (ellers feiler «pod install»: ClerkExpo-podspecen legger til SPM-produktene ClerkKit/ClerkKitUI)", () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../package.json"), "utf8")) as { expo?: { autolinking?: { ios?: { exclude?: string[] } } } };
    expect(pkg.expo?.autolinking?.ios?.exclude).toContain("@clerk/expo");
  });

  it("retur-URL-en er appens eget skjema fra app.json + /sso-callback", () => {
    const app = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../app.json"), "utf8")) as { expo: { scheme: string } };
    expect(SSO_REDIRECT_URL).toBe(`${app.expo.scheme}://sso-callback`);
    expect(SSO_REDIRECT_URL).toBe("hellosky://sso-callback");
  });

  it("serveren sier ikke klar (som produksjon og staging i dag): ingen knapp, og Clerk lastes aldri", async () => {
    await renderProfile(caps(false, false));
    expect(screen.queryByTestId("social-sign-in")).toBeNull();
    expect(clerk.providers).toHaveLength(0);
  });

  it("gjestesøk på forsiden: ingen innloggingskall og ingen Clerk", async () => {
    const server = fakeServer({ "mobileAuth.me": () => ({ data: null }), "mobileAuth.providers": () => ({ data: caps(true, true) }) });
    const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
    await render(
      <AppProvider initialLocale="nb" apiFactory={factory}>
        <SearchScreen />
      </AppProvider>,
    );
    expect(server.calls.some((c) => c.path === "mobileAuth.providers")).toBe(false);
    expect(clerk.providers).toHaveLength(0);
  });

  it("Google klar: bare Google vises (også når serveren sier Apple er klar), og Clerk får bare den publiserbare nøkkelen – ingen tokenCache", async () => {
    await renderProfile(caps(true, true));
    await waitFor(() => expect(screen.getByTestId("social-google")).toBeOnTheScreen());
    expect(screen.queryByTestId("social-apple")).toBeNull();
    const props = clerk.providers.at(-1)!;
    expect(props.publishableKey).toBe(PK);
    expect(props.tokenCache).toBeUndefined();
    expect(props.__experimental_disableNativeClientSync).toBe(true);
    expect(JSON.stringify(props)).not.toMatch(/sk_(live|test)_/);
  });
});

describe("Google via Clerk → exchangeSocialToken → HelloSky-sesjon", () => {
  it("vellykket: oauth_google med den faste retur-URL-en, Clerk-token byttes, HelloSky-sesjonen lagres, Clerk logges ut", async () => {
    const flow = SUCCESS();
    clerk.startSSOFlow.mockResolvedValue(flow);
    clerk.getToken.mockResolvedValue(CLERK_TOKEN);
    const server = await renderProfile(caps(true, false), { "mobileAuth.exchangeSocialToken": () => ({ data: { ...AUTH_RESULT, created: true, linked: false } }) });
    await waitFor(() => expect(screen.getByTestId("social-google")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-google"));
    await waitFor(() => expect(screen.getByTestId("account-signed-in")).toBeOnTheScreen());

    expect(clerk.startSSOFlow).toHaveBeenCalledWith({ strategy: "oauth_google", redirectUrl: "hellosky://sso-callback" });
    expect(flow.setActive).toHaveBeenCalledWith({ session: "sess_1" });
    const exchange = server.calls.filter((c) => c.path === "mobileAuth.exchangeSocialToken");
    expect(exchange).toHaveLength(1);
    expect(exchange[0]!.input).toEqual({ token: CLERK_TOKEN, locale: "nb" });
    expect(exchange[0]!.headers.authorization).toBeUndefined();
    const stored = keychain.get(SESSION_KEY)!.value;
    expect(JSON.parse(stored).token).toBe(TOKEN);
    expect(stored).not.toContain(CLERK_TOKEN);
    expect(clerk.signOut).toHaveBeenCalledTimes(1);
  });

  it("kunden lukker Google-vinduet: avbrutt, ingen bytte, ingen sesjon", async () => {
    clerk.startSSOFlow.mockResolvedValue({ createdSessionId: null, authSessionResult: { type: "cancel" } });
    const server = await renderProfile(caps(true, false));
    await waitFor(() => expect(screen.getByTestId("social-google")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-google"));
    await waitFor(() => expect(screen.getByTestId("social-note")).toHaveTextContent("Innloggingen ble avbrutt. Ingenting er endret."));
    expect(server.calls.some((c) => c.path === "mobileAuth.exchangeSocialToken")).toBe(false);
    expect(clerk.getToken).not.toHaveBeenCalled();
    expect(keychain.has(SESSION_KEY)).toBe(false);
  });

  it("Clerk fullfører ikke (ingen økt etter vellykket vindu): ærlig feil, ingen bytte", async () => {
    clerk.startSSOFlow.mockResolvedValue({ createdSessionId: null, authSessionResult: { type: "success" } });
    const server = await renderProfile(caps(true, false), {}, "en");
    await waitFor(() => expect(screen.getByTestId("social-google")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-google"));
    await waitFor(() => expect(screen.getByTestId("auth-error")).toHaveTextContent("We couldn't sign you in. Try again, or use e-mail and password."));
    expect(server.calls.some((c) => c.path === "mobileAuth.exchangeSocialToken")).toBe(false);
  });

  it("serveren avviser byttet (ansatts adresse): feilen vises, ingen HelloSky-sesjon, og Clerk-økten avsluttes likevel", async () => {
    clerk.startSSOFlow.mockResolvedValue(SUCCESS());
    clerk.getToken.mockResolvedValue(CLERK_TOKEN);
    await renderProfile(caps(true, false), { "mobileAuth.exchangeSocialToken": () => ({ status: 403, error: { message: "x", appCode: "FORBIDDEN", field: "social" } }) });
    await waitFor(() => expect(screen.getByTestId("social-google")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-google"));
    await waitFor(() => expect(screen.getByTestId("auth-error")).toHaveTextContent(/^Denne e-postadressen kan ikke brukes til en kundekonto\./));
    expect(keychain.has(SESSION_KEY)).toBe(false);
    expect(clerk.signOut).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["getToken kaster", () => clerk.getToken.mockRejectedValue(new Error("network"))],
    ["getToken gir ingen token", () => clerk.getToken.mockResolvedValue(null)],
  ])("Google: økten er aktivert, men %s – Clerk-økten avsluttes før feilen, ingen bytte, ingen sesjon", async (_label, arrange) => {
    const flow = SUCCESS();
    clerk.startSSOFlow.mockResolvedValue(flow);
    arrange();
    const server = await renderProfile(caps(true, false), {}, "en");
    await waitFor(() => expect(screen.getByTestId("social-google")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-google"));
    await waitFor(() => expect(screen.getByTestId("auth-error")).toHaveTextContent("We couldn't sign you in. Try again, or use e-mail and password."));
    expect(flow.setActive).toHaveBeenCalledWith({ session: "sess_1" });
    expect(clerk.signOut).toHaveBeenCalledTimes(1);
    expect(clerk.signOut.mock.invocationCallOrder[0]).toBeGreaterThan(flow.setActive.mock.invocationCallOrder[0]!);
    expect(server.calls.some((c) => c.path === "mobileAuth.exchangeSocialToken")).toBe(false);
    expect(keychain.has(SESSION_KEY)).toBe(false);
    expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen();
  });

  it("dobbeltrykk mens Google-vinduet er åpent: én flyt, ett bytte", async () => {
    let finish!: (v: unknown) => void;
    clerk.startSSOFlow.mockImplementation(() => new Promise((r) => (finish = r)));
    clerk.getToken.mockResolvedValue(CLERK_TOKEN);
    const server = await renderProfile(caps(true, false), { "mobileAuth.exchangeSocialToken": () => ({ data: { ...AUTH_RESULT, created: false, linked: false } }) });
    await waitFor(() => expect(screen.getByTestId("social-google")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-google"));
    await fireEvent.press(screen.getByTestId("social-google"));
    await fireEvent.press(screen.getByTestId("social-google"));
    await waitFor(() => expect(clerk.startSSOFlow).toHaveBeenCalledTimes(1));
    finish(SUCCESS());
    await waitFor(() => expect(screen.getByTestId("account-signed-in")).toBeOnTheScreen());
    expect(clerk.startSSOFlow).toHaveBeenCalledTimes(1);
    expect(server.calls.filter((c) => c.path === "mobileAuth.exchangeSocialToken")).toHaveLength(1);
  });
});
