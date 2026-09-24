import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import type { MobileAuthProviders } from "@contracts/mobileAuth";
import { AppProvider, type ApiFactory, type NativeSocialSignIn } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { nativeSocialSignIn } from "../lib/nativeSocial";
import { visibleSocialProviders } from "../lib/socialAuth";
import { fakeServer } from "../test/fakeServer";
import { AUTH_RESULT, TOKEN } from "../test/fixtures";
import AccountScreen from "../app/(tabs)/profil";

// Sosial innlogging i Profil. Serveren er en falsk HTTP-server; den native
// delen er et testadapter (ikke Clerk). Det som prøves er appens regler:
// når knappene vises, og hva som skjer med token, avbrudd, feil og lasting.

const keychain = (SecureStore as unknown as { __store: Map<string, { value: string; options: unknown }> }).__store;
const SESSION_KEY = "hellosky.customer-session";
const CLERK_TOKEN = "clerk-session-token-from-native-sdk-0123456789";
const PK = "pk_live_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk";

const caps = (google: MobileAuthProviders["social"][number], apple: MobileAuthProviders["social"][number], key: string | null = PK): MobileAuthProviders => ({ password: true, social: [google, apple], clerkPublishableKey: key });
const LIVE_GOOGLE = caps({ provider: "google", available: true, reason: null }, { provider: "apple", available: false, reason: "not_configured" });
const PROD_TODAY = caps({ provider: "google", available: false, reason: "native_not_ready" }, { provider: "apple", available: false, reason: "not_configured" }, null);
const STAGING_TODAY = caps({ provider: "google", available: false, reason: "not_configured" }, { provider: "apple", available: false, reason: "not_configured" }, null);
const BOTH = caps({ provider: "google", available: true, reason: null }, { provider: "apple", available: true, reason: null });

/** Testadapter: støtter de oppgitte leverandørene; svaret styres per test. */
function fakeNative(supported: string[], signIn: NativeSocialSignIn["signIn"] = async () => ({ kind: "token", token: CLERK_TOKEN })): NativeSocialSignIn & { signIn: jest.Mock } {
  return { supports: (p) => supported.includes(p), signIn: jest.fn(signIn) };
}

type Routes = Parameters<typeof fakeServer>[0];
async function renderProfile({ providers, routes = {}, native, locale = "nb" }: { providers: MobileAuthProviders | "error"; routes?: Routes; native?: NativeSocialSignIn; locale?: "nb" | "en" }) {
  const server = fakeServer({
    "mobileAuth.me": () => ({ data: null }),
    "mobileAuth.providers": () => (providers === "error" ? { status: 503, error: { message: "nede", appCode: "INTERNAL" } } : { data: providers }),
    ...routes,
  });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  await render(
    <AppProvider initialLocale={locale} apiFactory={factory} nativeSocial={native}>
      <AccountScreen />
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
  await waitFor(() => expect(server.calls.some((c) => c.path === "mobileAuth.providers")).toBe(true));
  return server;
}

beforeEach(() => keychain.clear());

describe("hvilke knapper Profil viser", () => {
  it("iOS-builden (ekte adapter): Google kan vises, Apple aldri – og ingenting når serveren sier nei", async () => {
    expect(nativeSocialSignIn.supports("google")).toBe(true);
    expect(nativeSocialSignIn.supports("apple")).toBe(false);
    await renderProfile({ providers: PROD_TODAY });
    expect(screen.queryByTestId("social-sign-in")).toBeNull();
    // E-post og passord er uendret.
    expect(screen.getByTestId("email")).toBeOnTheScreen();
    expect(screen.getByTestId("auth-submit")).toBeOnTheScreen();
  });

  it("produksjon i dag (Google på nett, native ikke klar) og staging i dag (ingen Clerk): ingen knapper, selv med en native flyt", async () => {
    const native = fakeNative(["google", "apple"]);
    expect(visibleSocialProviders(PROD_TODAY, native)).toEqual([]);
    expect(visibleSocialProviders(STAGING_TODAY, native)).toEqual([]);
    // Uten publiserbar nøkkel vises ingenting, selv om en leverandør står som tilgjengelig.
    expect(visibleSocialProviders({ ...LIVE_GOOGLE, clerkPublishableKey: null }, native)).toEqual([]);
    await renderProfile({ providers: PROD_TODAY, native });
    expect(screen.queryByTestId("social-sign-in")).toBeNull();
  });

  it("når statusen ikke kan hentes: ingen knapper, e-post virker", async () => {
    await renderProfile({ providers: "error", native: fakeNative(["google"]) });
    expect(screen.queryByTestId("social-sign-in")).toBeNull();
    expect(screen.getByTestId("auth-submit")).toBeOnTheScreen();
  });

  it("Google klar på serveren og i builden: bare Google (Apple er ikke satt opp i Clerk)", async () => {
    await renderProfile({ providers: LIVE_GOOGLE, native: fakeNative(["google", "apple"]) });
    await waitFor(() => expect(screen.getByTestId("social-google")).toBeOnTheScreen());
    expect(screen.getByTestId("social-google")).toHaveTextContent("Fortsett med Google");
    expect(screen.queryByTestId("social-apple")).toBeNull();
  });

  it("begge klare, men builden støtter bare Apple: bare Apple", async () => {
    await renderProfile({ providers: BOTH, native: fakeNative(["apple"]), locale: "en" });
    await waitFor(() => expect(screen.getByTestId("social-apple")).toHaveTextContent("Continue with Apple"));
    expect(screen.queryByTestId("social-google")).toBeNull();
    expect(screen.getByText("or with e-mail")).toBeOnTheScreen();
  });
});

describe("innlogging via Clerk-token → HelloSky-sesjon", () => {
  it("token fra native flyt byttes med exchangeSocialToken (uten Bearer), HelloSky-sesjonen lagres i nøkkelringen – Clerk-tokenet aldri", async () => {
    const native = fakeNative(["google"]);
    const server = await renderProfile({ providers: LIVE_GOOGLE, native, routes: { "mobileAuth.exchangeSocialToken": () => ({ data: { ...AUTH_RESULT, created: false, linked: false } }) } });
    await waitFor(() => expect(screen.getByTestId("social-google")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-google"));
    await waitFor(() => expect(screen.getByTestId("account-signed-in")).toBeOnTheScreen());

    expect(native.signIn).toHaveBeenCalledWith("google", PK);
    const call = server.calls.find((c) => c.path === "mobileAuth.exchangeSocialToken")!;
    expect(call.method).toBe("POST");
    expect(call.input).toEqual({ token: CLERK_TOKEN, locale: "nb" });
    expect(call.headers.authorization).toBeUndefined();
    const stored = keychain.get(SESSION_KEY)!.value;
    expect(JSON.parse(stored).token).toBe(TOKEN);
    expect(stored).not.toContain(CLERK_TOKEN);
  });

  it("avbrutt av kunden: ingen serverkall, ingen sesjon, en rolig melding", async () => {
    const native = fakeNative(["google"], async () => ({ kind: "cancelled" }));
    const server = await renderProfile({ providers: LIVE_GOOGLE, native });
    await waitFor(() => expect(screen.getByTestId("social-google")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-google"));
    await waitFor(() => expect(screen.getByTestId("social-note")).toHaveTextContent("Innloggingen ble avbrutt. Ingenting er endret."));
    expect(server.calls.some((c) => c.path === "mobileAuth.exchangeSocialToken")).toBe(false);
    expect(keychain.has(SESSION_KEY)).toBe(false);
    expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen();
  });

  it("serverens avvisninger på kundens språk: ansatts adresse og lookalike-adresse; ingen sesjon", async () => {
    let answer: { status: number; error: { message: string; appCode: string; field?: string; reason?: string } } = { status: 403, error: { message: "x", appCode: "FORBIDDEN", field: "social" } };
    await renderProfile({ providers: LIVE_GOOGLE, native: fakeNative(["google"]), routes: { "mobileAuth.exchangeSocialToken": () => answer } });
    await waitFor(() => expect(screen.getByTestId("social-google")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-google"));
    await waitFor(() => expect(screen.getByTestId("auth-error")).toHaveTextContent("Denne e-postadressen kan ikke brukes til en kundekonto. Kontakt oss hvis du mener dette er feil."));
    answer = { status: 409, error: { message: "x", appCode: "CONFLICT", field: "social", reason: "email_lookalike" } };
    await fireEvent.press(screen.getByTestId("social-google"));
    await waitFor(() => expect(screen.getByTestId("auth-error")).toHaveTextContent("Denne e-postadressen kan ikke brukes til en ny konto. Logg inn på en annen måte, eller kontakt oss."));
    expect(keychain.has(SESSION_KEY)).toBe(false);
  });

  it("feil i native flyt eller et avvist token: generell, ærlig feil på engelsk", async () => {
    const native = fakeNative(["google"], async () => {
      throw new Error("sdk failure");
    });
    await renderProfile({ providers: LIVE_GOOGLE, native, locale: "en" });
    await waitFor(() => expect(screen.getByTestId("social-google")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-google"));
    await waitFor(() => expect(screen.getByTestId("auth-error")).toHaveTextContent("We couldn't sign you in. Try again, or use e-mail and password."));
    expect(keychain.has(SESSION_KEY)).toBe(false);
  });

  it("mens innloggingen pågår: knappen sier det, og et nytt trykk eller e-postskjemaet starter ikke noe til", async () => {
    let finish!: () => void;
    const native = fakeNative(["google"], () => new Promise((resolve) => (finish = () => resolve({ kind: "cancelled" }))));
    const server = await renderProfile({ providers: LIVE_GOOGLE, native });
    await waitFor(() => expect(screen.getByTestId("social-google")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("social-google"));
    expect(screen.getByTestId("social-google")).toHaveTextContent("Logger inn med Google …");
    await fireEvent.press(screen.getByTestId("social-google"));
    await fireEvent.changeText(screen.getByTestId("email"), "anna@example.com");
    await fireEvent.changeText(screen.getByTestId("password"), "passord-passord");
    await fireEvent.press(screen.getByTestId("auth-submit"));
    expect(native.signIn).toHaveBeenCalledTimes(1);
    expect(server.calls.some((c) => c.path === "mobileAuth.login")).toBe(false);
    finish();
    await waitFor(() => expect(screen.getByTestId("social-google")).toHaveTextContent("Fortsett med Google"));
  });
});
