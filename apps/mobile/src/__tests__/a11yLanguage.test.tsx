import { useEffect, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Dimensions } from "react-native";
import * as SecureStore from "expo-secure-store";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { PROFILE, SAME_TRIP_OTHER_SELLER, SEARCH_RESULT, SEK_OFFER, TOKEN } from "../test/fixtures";
import SearchScreen from "../app/(tabs)/index";
import ResultsScreen from "../app/resultater";
import OfferScreen from "../app/tilbud/[id]";
import AccountScreen from "../app/(tabs)/profil";
import AirportPicker from "../app/flyplass";

// VoiceOver-språk: hvert element VoiceOver kan stoppe på – tekst som ikke er
// gruppert under et tilgjengelig element, knapper, brytere, felt og roten i et
// ark – har `accessibilityLanguage` (nb-NO / en-GB). Det arves ikke fra en
// forelder som ikke selv er tilgjengelig, så vi krever det på hvert element.
// Dette er en kodetest; VoiceOver selv er ikke testet her.

type HostNode = { type: string; props: Record<string, unknown>; children: (HostNode | string)[] | null };
type Finding = { type: string; testID?: string; text: string; lang: unknown; expected: string };

const setParams = (globalThis as unknown as { __setParams: (p: Record<string, string>) => void }).__setParams;
const keychain = (SecureStore as unknown as { __store: Map<string, { value: string; options: unknown }> }).__store;
const BCN = { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spania" };
const OWN_LANGUAGE: Record<string, string> = { "segment-nb": "nb-NO", "segment-en": "en-GB" };

function textOf(n: HostNode | string): string {
  if (typeof n === "string") return n;
  return (n.children ?? []).map(textOf).join("");
}

/** Alle elementer VoiceOver kan stoppe på, med språket de skal ha. */
function focusable(expected: string): { count: number; wrong: Finding[] } {
  const wrong: Finding[] = [];
  let count = 0;
  const walk = (n: HostNode | string | null, insideAccessible: boolean, want: string) => {
    if (!n || typeof n === "string") return;
    const p = n.props ?? {};
    if (p.accessibilityElementsHidden === true || p.importantForAccessibility === "no-hide-descendants") return;
    const testID = typeof p.testID === "string" ? p.testID : undefined;
    const lang = testID && OWN_LANGUAGE[testID] ? OWN_LANGUAGE[testID]! : want;
    const accessible = p.accessible === true;
    const isFocusable = accessible || n.type === "TextInput" || /Switch/i.test(n.type) || p.accessibilityViewIsModal === true || (n.type === "Text" && !insideAccessible);
    if (isFocusable && p.accessible !== false) {
      count++;
      if (p.accessibilityLanguage !== lang) wrong.push({ type: n.type, testID, text: textOf(n).slice(0, 40), lang: p.accessibilityLanguage, expected: lang });
    }
    for (const c of n.children ?? []) walk(c, insideAccessible || accessible, lang);
  };
  const tree = screen.toJSON() as HostNode | HostNode[] | null;
  for (const root of Array.isArray(tree) ? tree : [tree]) walk(root, false, expected);
  return { count, wrong };
}

function expectAll(expected: string, atLeast: number) {
  const { count, wrong } = focusable(expected);
  expect(wrong).toEqual([]);
  expect(count).toBeGreaterThanOrEqual(atLeast);
}

function setup(result = { ...SEARCH_RESULT, provider: "demo", sandbox: true }, extra: Parameters<typeof fakeServer>[0] = {}) {
  const server = fakeServer({ "flights.search": () => ({ data: result }), "mobileAuth.me": () => ({ data: null }), ...extra });
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

beforeEach(() => keychain.clear());

describe.each([
  ["nb", "nb-NO"],
  ["en", "en-GB"],
] as const)("VoiceOver-språk på %s", (locale, lang) => {
  it("Hjem, også med reisende-arket åpent", async () => {
    const { factory } = setup();
    await render(
      <AppProvider initialLocale={locale} apiFactory={factory}>
        <SearchScreen />
      </AppProvider>,
    );
    expectAll(lang, 15);
    await fireEvent.press(screen.getByTestId("travellers"));
    await waitFor(() => expect(screen.getByTestId("travellers-sheet")).toBeOnTheScreen());
    expect(screen.getByTestId("travellers-sheet").props.accessibilityViewIsModal).toBe(true);
    expectAll(lang, 25);
  });

  it("Resultater, også med filterarket åpent", async () => {
    const { factory } = setup();
    await render(
      <AppProvider initialLocale={locale} apiFactory={factory} initial={{ destination: BCN }}>
        <SearchOnMount>
          <ResultsScreen />
        </SearchOnMount>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
    expectAll(lang, 15);
    await fireEvent.press(screen.getByTestId("open-filters"));
    await waitFor(() => expect(screen.getByTestId("filter-screen")).toBeOnTheScreen());
    expectAll(lang, 30);
  });

  it("Flydetaljer for en reise hos flere selgere, hele rulleflaten", async () => {
    const { factory } = setup({ ...SEARCH_RESULT, provider: "demo", sandbox: true, offers: [SEK_OFFER, SAME_TRIP_OTHER_SELLER] });
    setParams({ id: "sek_1" });
    await render(
      <AppProvider initialLocale={locale} apiFactory={factory} initial={{ destination: BCN }}>
        <SearchOnMount>
          <OfferScreen />
        </SearchOnMount>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("sellers")).toBeOnTheScreen());
    expectAll(lang, 20);
    // Også når prisen har lagt seg under teksten i en selgerrad (navnet brytes).
    await fireEvent(screen.getByTestId("sellername-gtg_1"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 2 * 20 * Dimensions.get("window").fontScale } } });
    expect(within(screen.getByTestId("sellertext-gtg_1")).getByTestId("sellerprice-gtg_1")).toBeOnTheScreen();
    expectAll(lang, 20);
  });

  it("flyplassvelgeren: forslag, søkefelt, bryter og treff", async () => {
    const { factory } = setup(undefined, { "flights.airports": () => ({ data: [{ iata: "BCN", name: "Barcelona-El Prat", city: "Barcelona", country: "Spain", countryCode: "ES" }] }) });
    setParams({ felt: "fra" });
    await render(
      <AppProvider initialLocale={locale} apiFactory={factory}>
        <AirportPicker />
      </AppProvider>,
    );
    expectAll(lang, 10);
    await fireEvent.changeText(screen.getByTestId("airport-query"), "bar");
    await waitFor(() => expect(screen.getByTestId("airport-BCN")).toBeOnTheScreen());
    expect(screen.getByTestId("airport-query").props.accessibilityLanguage).toBe(lang);
    expectAll(lang, 5);
  });

  it("Profil innlogget, med redigeringsarket (tekstfelt) åpent", async () => {
    keychain.set("hellosky.customer-session", { value: JSON.stringify({ token: TOKEN, expiresAt: "2099-01-01T00:00:00Z" }), options: {} });
    const { factory } = setup(undefined, { "mobileAuth.me": () => ({ data: PROFILE }) });
    await render(
      <AppProvider initialLocale={locale} apiFactory={factory}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("account-card")).toBeOnTheScreen());
    expectAll(lang, 15);
    await fireEvent.press(screen.getByTestId("open-edit-profile"));
    await waitFor(() => expect(screen.getByTestId("edit-first-name")).toBeOnTheScreen());
    expect(screen.getByTestId("edit-first-name").props.accessibilityLanguage).toBe(lang);
    expectAll(lang, 20);
  });
});

describe("språkvalget i Profil", () => {
  it("bytter VoiceOver-språket på hele skjermen med én gang; hvert språknavn leses på sitt eget språk", async () => {
    const { factory } = setup();
    await render(
      <AppProvider apiFactory={factory}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    expectAll("nb-NO", 15);
    expect(screen.getByTestId("segment-en").props.accessibilityLanguage).toBe("en-GB");
    expect(screen.getByTestId("segment-nb").props.accessibilityLanguage).toBe("nb-NO");
    await fireEvent.press(screen.getByTestId("segment-en"));
    expectAll("en-GB", 15);
    // «Norsk (bokmål)» står på norsk også i den engelske appen – og leses med norsk stemme.
    expect(screen.getByTestId("segment-nb").props.accessibilityLanguage).toBe("nb-NO");
  });
});
