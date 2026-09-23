import { useEffect, type ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as FileSystem from "expo-file-system";
import * as WebBrowser from "expo-web-browser";
import type { MobileSearchResult } from "@contracts/mobileSearch";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { __resetLocalStoreForTests, readPref, writePref } from "../lib/localStore";
import { fakeServer } from "../test/fakeServer";
import { AUTH_RESULT, SEARCH_RESULT, SEK_OFFER } from "../test/fixtures";
import SearchScreen from "../app/(tabs)/index";
import ResultsScreen from "../app/resultater";
import OfferScreen from "../app/tilbud/[id]";
import AccountScreen from "../app/(tabs)/profil";

// Språk (norsk bokmål ved første oppstart, engelsk som lagret valg) og tillit:
// ærlige merker for demo/testmiljø/ekte priser, utdaterte priser, avbrutt søk,
// ett klikk = én måling, utløpt tilbud og advarsler før man går videre.

const router = (globalThis as unknown as { __router: { push: jest.Mock; back: jest.Mock; replace: jest.Mock } }).__router;
const setParams = (globalThis as unknown as { __setParams: (p: Record<string, string>) => void }).__setParams;
const BCN = { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spain" };

function setup(routes: Parameters<typeof fakeServer>[0]) {
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

/** Kunden har valgt engelsk i Profil tidligere (lagret på telefonen). */
function savedEnglish() {
  writePref("locale", "en");
}

async function renderResults(result: MobileSearchResult, locale?: "en" | "nb") {
  const s = setup({ "flights.search": () => ({ data: result }), "flights.trackProviderClick": () => ({ data: { clickRef: null } }) });
  await render(
    <AppProvider initialLocale={locale} apiFactory={s.factory} initial={{ destination: BCN }}>
      <SearchOnMount>
        <ResultsScreen />
      </SearchOnMount>
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen(), { timeout: 5000 });
  return s;
}

describe("ny installasjon: norsk bokmål; engelsk er et lagret valg", () => {
  it("uten lagret valg er appen på norsk bokmål – og standarden lagres ikke som et valg", async () => {
    await renderResults(SEARCH_RESULT);
    const card = within(screen.getByTestId("offer-sek_1"));
    expect(card.getByText("Totalt for 1 voksen · Tur-retur")).toBeOnTheScreen();
    expect(card.getByText("Ut · 23. okt.")).toBeOnTheScreen();
    expect(within(screen.getByTestId("price-nok_1")).getByText(/^2\s100,50\skr$/)).toBeOnTheScreen();
    expect(screen.getByTestId("result-count")).toHaveTextContent("5 reiser · 5 tilbud");
    expect(readPref("locale", (v) => v)).toBeNull();
  });

  it("forsiden og søkeknappen er på norsk", async () => {
    const { factory } = setup({});
    await render(
      <AppProvider apiFactory={factory}>
        <SearchScreen />
      </AppProvider>,
    );
    expect(screen.getByTestId("search-button").props.accessibilityLabel).toBe("Søk fly");
    expect(screen.getByText("Du trenger ikke logge inn for å søke.")).toBeOnTheScreen();
  });

  it("et lagret engelsk valg beholdes: samme kronebeløp, engelsk tekst", async () => {
    savedEnglish();
    await renderResults(SEARCH_RESULT);
    const card = within(screen.getByTestId("offer-sek_1"));
    expect(card.getByText("Total for 1 adult · Return")).toBeOnTheScreen();
    expect(card.getByText("Out · 23 Oct")).toBeOnTheScreen();
    expect(within(screen.getByTestId("price-nok_1")).getByText(/^NOK\s2,100\.50$/)).toBeOnTheScreen();
    expect(screen.getByTestId("result-count")).toHaveTextContent("5 journeys · 5 offers");
    expect(readPref("locale", (v) => v)).toBe("en");
  });
});

describe("språkvalget", () => {
  it("gjelder med én gang, huskes på telefonen og brukes ved neste oppstart", async () => {
    const { factory } = setup({ "mobileAuth.me": () => ({ data: null }) });
    await render(
      <AppProvider apiFactory={factory}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    expect(screen.getByText("Du kan søke etter fly uten å logge inn.")).toBeOnTheScreen();
    // Ny installasjon: bokmål er valgt i velgeren, men ingenting er lagret bare av å vise Profil.
    expect(screen.getByTestId("segment-nb").props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId("segment-en").props.accessibilityState).toMatchObject({ selected: false });
    expect(readPref("locale", (v) => v)).toBeNull();
    await fireEvent.press(screen.getByTestId("segment-en"));
    expect(screen.getByText("You can search for flights without logging in.")).toBeOnTheScreen();
    expect(readPref("locale", (v) => v as string)).toBe("en");
    await screen.unmount();
    __resetLocalStoreForTests(); // som en ekte omstart: minnet er tomt, valget må leses fra filen

    // Ny oppstart: det lagrede valget leses før første bilde – norsk er bare standarden for en ny installasjon.
    await render(
      <AppProvider apiFactory={factory}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByText("You can search for flights without logging in.")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("segment-nb"));
    expect(readPref("locale", (v) => v as string)).toBe("nb");
  });

  it("språket endrer aldri søket: samme forespørsel på engelsk og norsk", async () => {
    const en = await renderResults(SEARCH_RESULT, "en");
    await screen.unmount();
    const nb = await renderResults(SEARCH_RESULT, "nb");
    const input = (s: typeof en) => s.server.calls.find((c) => c.path === "flights.search")!.input as Record<string, unknown>;
    const strip = (i: Record<string, unknown>) => ({ ...i, sessionId: undefined });
    expect(strip(input(en))).toEqual(strip(input(nb)));
    expect(JSON.stringify(input(en))).not.toMatch(/currency|locale|"en"|"nb"/);
  });

  it.each([
    ["ny installasjon", undefined, "nb"],
    ["engelsk lagret", "en", "en"],
  ] as const)("ny konto får appens språk som kontospråk (%s)", async (_label, saved, expected) => {
    if (saved) writePref("locale", saved);
    const { server, factory } = setup({ "mobileAuth.register": () => ({ data: AUTH_RESULT }), "mobileAuth.me": () => ({ data: null }) });
    await render(
      <AppProvider apiFactory={factory}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("segment-register"));
    await fireEvent.changeText(screen.getByTestId("first-name"), "Sam");
    await fireEvent.changeText(screen.getByTestId("last-name"), "Smith");
    await fireEvent.changeText(screen.getByTestId("email"), "sam@example.com");
    await fireEvent.changeText(screen.getByTestId("password"), "password-123456");
    await fireEvent.press(screen.getByTestId("auth-submit"));
    await waitFor(() => expect(server.calls.some((c) => c.path === "mobileAuth.register")).toBe(true));
    expect(server.calls.find((c) => c.path === "mobileAuth.register")!.input).toMatchObject({ locale: expected });
    // Å registrere seg lagrer ikke språket på telefonen; bare et eget valg i Profil gjør det.
    expect(readPref("locale", (v) => v)).toBe(saved ?? null);
  });

  it("feil ved innlogging vises på engelsk, også når serveren svarer på norsk", async () => {
    savedEnglish();
    const { factory } = setup({
      "mobileAuth.me": () => ({ data: null }),
      "mobileAuth.login": () => ({ status: 401, error: { message: "Feil e-post/telefon eller passord.", appCode: "UNAUTHORIZED" } }),
    });
    await render(
      <AppProvider apiFactory={factory}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    await fireEvent.changeText(screen.getByTestId("email"), "sam@example.com");
    await fireEvent.changeText(screen.getByTestId("password"), "wrong-password");
    await fireEvent.press(screen.getByTestId("auth-submit"));
    await waitFor(() => expect(screen.getByTestId("auth-error")).toHaveTextContent("Wrong e-mail or password."));
  });
});

describe("språkvalget leses fra filen på telefonen", () => {
  const PREFS = "file:///documents/hellosky-prefs.json";
  async function coldStart(content: string) {
    (FileSystem as unknown as { __files: Map<string, string> }).__files.set(PREFS, content);
    __resetLocalStoreForTests();
    const { factory } = setup({});
    await render(
      <AppProvider apiFactory={factory}>
        <SearchScreen />
      </AppProvider>,
    );
    return screen.getByTestId("search-button").props.accessibilityLabel as string;
  }

  it("et lagret engelsk valg gjelder fra første bilde etter kaldstart", async () => {
    expect(await coldStart(JSON.stringify({ v: 1, locale: "en" }))).toBe("Search flights");
  });

  it.each([["de"], ["EN"], ["nb-NO"], [""], [null], [42], [{}]])("en ukjent verdi (%p) gir bokmål, ikke krasj", async (value) => {
    expect(await coldStart(JSON.stringify({ v: 1, locale: value }))).toBe("Søk fly");
  });

  it("en ødelagt fil gir bokmål, ikke krasj", async () => {
    expect(await coldStart("{ikke json")).toBe("Søk fly");
  });
});

describe("ærlige merker på resultatene", () => {
  beforeEach(savedEnglish);

  it("ekte priser: «Live prices» med klokkeslett, ingen DEMO – selv om Duffel ikke er satt opp (demoMode)", async () => {
    await renderResults({ ...SEARCH_RESULT, provider: "kayak", sandbox: false, demoMode: true });
    expect(screen.queryByTestId("sandbox-banner")).toBeNull();
    expect(screen.getByTestId("price-status")).toHaveTextContent(/^Live prices · checked at \d\d:\d\d$/);
  });

  it("uten uttrykkelig bevis (leverandør + sandbox: false) kalles prisene aldri ekte", async () => {
    // Eldre server uten leverandørfelt: demoMode/liveMode alene beviser ingenting.
    await renderResults({ ...SEARCH_RESULT, provider: undefined, sandbox: undefined, demoMode: false, liveMode: true });
    expect(screen.getByTestId("unverified-banner")).toHaveTextContent("We couldn't confirm that these are live prices. Check the price with the provider before you book.");
    expect(screen.getByTestId("price-status")).toHaveTextContent(/^Prices checked at \d\d:\d\d$/);
    expect(screen.queryByText(/Live prices/)).toBeNull();
  });

  it("leverandørens testmiljø sies med navn; HelloSkys demomotor sies som demo", async () => {
    await renderResults({ ...SEARCH_RESULT, provider: "kayak", sandbox: true });
    expect(screen.getByTestId("sandbox-banner")).toHaveTextContent("Test data from KAYAK's test environment: prices are not real.");
    expect(screen.queryByTestId("price-status")).toBeNull();
    await screen.unmount();
    await renderResults({ ...SEARCH_RESULT, provider: "demo", sandbox: true });
    expect(screen.getByTestId("sandbox-banner")).toHaveTextContent("Demo data: these are not real flights or prices.");
  });

  it("delvise svar sies rett ut", async () => {
    await renderResults({ ...SEARCH_RESULT, partial: true });
    expect(screen.getByTestId("partial-banner")).toHaveTextContent(/^Not all providers answered in time\. Search again to see more journeys\./);
  });

  it("etter 15 minutter: prisene kan ha endret seg, og «Refresh prices» søker på nytt", async () => {
    // Bare klokka og tidtakerne; løfter og mikrooppgaver går som vanlig.
    jest.useFakeTimers({ now: Date.parse("2026-09-23T10:00:00Z"), doNotFake: ["nextTick", "queueMicrotask", "setImmediate", "performance"] });
    try {
      const { server } = await renderResults(SEARCH_RESULT);
      expect(screen.queryByTestId("refresh-prices")).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(16 * 60_000);
      });
      expect(screen.getByTestId("price-status")).toHaveTextContent(/^Prices checked at \d\d:\d\d may have changed\.Refresh prices$/);
      await fireEvent.press(screen.getByTestId("refresh-prices"));
      await waitFor(() => expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(2));
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("tregt søk kan stoppes", () => {
  it("«Stop search» avbryter forespørselen og går tilbake til skjemaet", async () => {
    let aborted = false;
    const factory: ApiFactory = (getToken) =>
      createApiClient({
        baseUrl: "https://api.hellosky.test",
        getToken,
        fetchImpl: ((_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              aborted = true;
              reject(new Error("aborted"));
            });
          })) as unknown as typeof fetch,
      });
    await render(
      <AppProvider apiFactory={factory} initial={{ destination: BCN }}>
        <SearchOnMount>
          <ResultsScreen />
        </SearchOnMount>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("results-loading")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("cancel-search"));
    expect(aborted).toBe(true);
    expect(router.back).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId("results-empty")).toBeOnTheScreen());
  });
});

describe("videre til tilbyderen", () => {
  beforeEach(savedEnglish);

  beforeEach(() => jest.mocked(WebBrowser.openBrowserAsync).mockClear());

  async function openOffer(result: MobileSearchResult, id: string) {
    const s = setup({ "flights.search": () => ({ data: result }), "flights.trackProviderClick": () => ({ data: { clickRef: null } }) });
    setParams({ id });
    await render(
      <AppProvider apiFactory={s.factory} initial={{ destination: BCN }}>
        <SearchOnMount>
          <OfferScreen />
        </SearchOnMount>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("offer-screen")).toBeOnTheScreen(), { timeout: 5000 });
    return s;
  }

  it("ett trykk: én klikkmåling og leverandørens egen lenke, på engelsk", async () => {
    const { server } = await openOffer(SEARCH_RESULT, "sek_1");
    expect(screen.getByTestId("handoff-button").props.accessibilityLabel).toBe("View offer at SAS");
    expect(screen.getByTestId("handoff-note")).toHaveTextContent("You complete the booking with the provider.");
    await fireEvent.press(screen.getByTestId("handoff-button"));
    await waitFor(() => expect(server.calls.filter((c) => c.path === "flights.trackProviderClick")).toHaveLength(1));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledTimes(1);
  });

  it("utløpt tilbud: «Search again» er hovedvalget, tilbyderen kan fortsatt åpnes", async () => {
    const expired = { ...SEK_OFFER, offer: { ...SEK_OFFER.offer, expiresAt: "2020-01-01T00:00:00Z" } };
    const { server } = await openOffer({ ...SEARCH_RESULT, offers: [expired] }, "sek_1");
    expect(screen.getByTestId("offer-expired")).toBeOnTheScreen();
    expect(screen.getByTestId("handoff-button").props.accessibilityLabel).toBe("Continue to SAS anyway");
    await fireEvent.press(screen.getByTestId("search-again"));
    await waitFor(() => expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(2));
    expect(router.back).toHaveBeenCalled();
  });

  it("flyplassbytte, lang ventetid og ankomst neste dag varsles før man går videre", async () => {
    const s1 = SEK_OFFER.offer.slices[0]!;
    const [a, b] = s1.segments;
    const warned = {
      ...SEK_OFFER,
      offer: {
        ...SEK_OFFER.offer,
        slices: [
          {
            ...s1,
            arrivingAt: "2026-10-24T09:00:00",
            segments: [
              { ...a!, destination: { ...a!.destination, iata: "CDG", city: "Paris" }, arrivingAt: "2026-10-23T08:15:00" },
              { ...b!, origin: { ...b!.origin, iata: "ORY", city: "Paris" }, departingAt: "2026-10-23T16:30:00", arrivingAt: "2026-10-24T09:00:00" },
            ],
          },
          SEK_OFFER.offer.slices[1]!,
        ],
      },
    };
    await openOffer({ ...SEARCH_RESULT, offers: [warned] }, "sek_1");
    const box = within(screen.getByTestId("journey-warnings"));
    expect(box.getByText("Before you continue")).toBeOnTheScreen();
    expect(screen.getByTestId("warning-airportChange")).toHaveTextContent("Change of airport in Paris: CDG → ORY. Allow time to transfer.");
    expect(screen.getByTestId("warning-longLayover")).toHaveTextContent("Long layover in Paris: 8h 15m.");
    expect(screen.getByTestId("warning-overnight")).toHaveTextContent("Outbound arrives the next day.");
  });
});

describe("omregning når alt gikk bra", () => {
  beforeEach(savedEnglish);

  it("forklaringen ligger bak en tydelig knapp; kortene har «approx.» og kilden", async () => {
    const offers = SEARCH_RESULT.offers.filter((o) => o.price.nok.kind !== "unavailable");
    await renderResults({ ...SEARCH_RESULT, offers, fx: { ...SEARCH_RESULT.fx, status: "ok", unconvertedCount: 0 } });
    const fx = screen.getByTestId("fx-notice");
    expect(fx).toHaveTextContent('About "approx." prices');
    expect(fx.props.accessibilityRole).toBe("button");
    expect(fx.props.accessibilityState).toMatchObject({ expanded: false });
    await fireEvent.press(fx);
    expect(screen.getByTestId("fx-notice")).toHaveTextContent(/^Prices marked "approx\." are converted to NOK with Norges Bank's mid rate of 22 Sep 2026/);
    expect(within(screen.getByTestId("price-sek_1")).getByText("Norges Bank rate 22 Sep 2026")).toBeOnTheScreen();
    // Demo-/testmiljøvarselet er aldri lukket.
    expect(screen.queryByTestId("sandbox-banner")).toBeNull();
  });
});
