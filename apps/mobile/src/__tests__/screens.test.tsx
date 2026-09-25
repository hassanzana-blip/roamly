import { useEffect, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Share } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { AUTH_RESULT, KAYAK_URL, PROFILE, SAME_TRIP_OTHER_SELLER, SEARCH_RESULT, SEK_OFFER, TOKEN } from "../test/fixtures";
import { foreignNumbers } from "../test/foreignNumbers";
import SearchScreen from "../app/(tabs)/index";
import ResultsScreen from "../app/resultater";
import OfferScreen from "../app/tilbud/[id]";
import AccountScreen from "../app/(tabs)/profil";

/** Leverandørens lenke vises aldri som tekst; den åpnes bare fra knappen. Ingen «betal»-løfter. */
function expectNoRawLinks() {
  const tree = renderedStrings();
  expect(tree).not.toMatch(/https?:\/\//);
  expect(tree).not.toContain(KAYAK_URL);
  expect(tree).not.toMatch(/betal nå|billetten er utstedt|kjøp bagasje/i);
}

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

/**
 * Hele det rendrede treet (tekst OG tilgjengelighetsetiketter) inneholder
 * ingen av leverandørens tall, publiserte kurser eller valutakoder for
 * tilbud i annen valuta.
 */
function renderedStrings(): string {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (node == null) return;
    if (typeof node === "string" || typeof node === "number") {
      out.push(String(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const n = node as { props?: Record<string, unknown>; children?: unknown };
    for (const v of Object.values(n.props ?? {})) if (typeof v === "string") out.push(v);
    walk(n.children);
  };
  walk(screen.toJSON());
  return out.join(" | ");
}

/** Tallet som et helt tall i teksten – ikke som en del av et større tall (f.eks. «100» i «2 100,50 kr»). */
function containsNumber(text: string, n: string): boolean {
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\d\u00A0.,])${escaped}(?![\\d]|[.,\u00A0]\\d)`).test(text);
}

function expectNoForeignAmounts() {
  const tree = renderedStrings();
  expect(tree.length).toBeGreaterThan(100);
  const foreign = SEARCH_RESULT.offers.filter((o) => o.price.total.currency.toUpperCase() !== "NOK");
  for (const o of foreign) {
    for (const n of foreignNumbers(o)) expect({ found: n, in: containsNumber(tree, n) }).toEqual({ found: n, in: false });
  }
  for (const code of ["EUR", "SEK", "THB", "USD", "JPY"]) expect(tree).not.toMatch(new RegExp(`\\b${code}\\b`));
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
      <AppProvider initialLocale="nb" apiFactory={factory}>
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
      <AppProvider initialLocale="nb" apiFactory={factory} initial={{ destination: BCN, departDate: "2026-10-23", returnDate: "2026-10-30" }}>
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
    // Kortet: kilden kort; detaljsiden og skjermleseren har hele setningen.
    expect(sek.getByText("Norges Banks kurs 22.09.2026")).toBeOnTheScreen();
    expect(screen.getByTestId("price-sek_1").props.accessibilityLabel).toBe("Omtrent 1\u00A0442 kroner, omregnet med Norges Banks kurs 22.09.2026");
    expect(within(screen.getByTestId("price-nok_1")).getByText(/^2\s100,50\skr$/)).toBeOnTheScreen();

    // THB har ingen kronepris – bare grunnen, ingen tall.
    const thb = within(screen.getByTestId("price-thb_1"));
    expect(thb.getByText("Ingen pris i kroner")).toBeOnTheScreen();
    expect(thb.getByText("Vi har ingen kurs for valutaen leverandøren priser i")).toBeOnTheScreen();

    // Kort linje over listen; hele forklaringen når kunden åpner den.
    expect(screen.getByTestId("fx-notice")).toHaveTextContent("Priser merket «ca.» er omregnet med Norges Banks kurs 22.09.2026 og kan avvike. Ett tilbud kunne ikke regnes om til kroner og står nederst.");
    await fireEvent.press(screen.getByTestId("fx-notice"));
    expect(screen.getByTestId("fx-notice")).toHaveTextContent(
      /Norges Banks midtkurs 22\.09\.2026\. Leverandøren kan ta betalt i en annen valuta, og endelig beløp kan avvike\. Ett tilbud kunne ikke regnes om til kroner og står nederst\./,
    );
    expect(screen.getByTestId("fx-notice").props.accessibilityState).toMatchObject({ expanded: true });
    expectNoForeignAmounts();
    expectNoRawLinks();
  });

  it("serverfeil vises med serverens melding", async () => {
    const { factory } = setup({ "flights.search": () => ({ status: 429, error: { message: "For mange forespørsler på kort tid. Vent 30 sekunder og prøv igjen.", appCode: "RATE_LIMITED" } }) });
    await render(
      <AppProvider initialLocale="nb" apiFactory={factory} initial={{ destination: BCN }}>
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
      <AppProvider initialLocale="nb" apiFactory={factory} initial={{ destination: BCN }}>
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
      <AppProvider initialLocale="nb" apiFactory={factory} initial={{ destination: BCN }}>
        <SearchOnMount>
          <OfferScreen />
        </SearchOnMount>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("offer-screen")).toBeOnTheScreen());
  }

  it("ekstern selger: «Se tilbud hos SAS» måler klikket og åpner leverandørens lenke urørt", async () => {
    const { server, factory } = setup({ "flights.search": () => ({ data: SEARCH_RESULT }), "flights.trackProviderClick": () => ({ data: { clickRef: "ref-1" } }) });
    setParams({ id: "sek_1" });
    await render(
      <AppProvider initialLocale="nb" apiFactory={factory} initial={{ destination: BCN }}>
        <SearchOnMount>
          <OfferScreen />
        </SearchOnMount>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("offer-screen")).toBeOnTheScreen());
    expect(within(screen.getByTestId("offer-price")).getByText(/^ca\. 1\s442\skr$/)).toBeOnTheScreen();
    expect(screen.getByText("Omregnet med Norges Banks kurs 22.09.2026")).toBeOnTheScreen();
    // Hva prisen gjelder, både i priskortet og ved knappen.
    expect(within(screen.getByTestId("price-card")).getByText("Totalt for 1 voksen · Tur-retur")).toBeOnTheScreen();
    expect(within(screen.getByTestId("offer-bar")).getByText("Totalt for 1 voksen · Tur-retur")).toBeOnTheScreen();
    expect(screen.getByTestId("fx-details")).toHaveTextContent(/annen valuta enn norske kroner.*endelig beløp kan avvike/);
    expect(screen.getByTestId("seller")).toHaveTextContent(/Selges av SAS/);
    // Kort, tydelig handling; valgt tilbyder står rett ved den, og i knappens fulle navn.
    expect(screen.getByTestId("handoff-note")).toHaveTextContent("SAS · Bestillingen fullføres hos tilbyderen.");
    expect(within(screen.getByTestId("handoff-button")).getByText("Gå til tilbud")).toBeOnTheScreen();
    expectNoForeignAmounts();
    expectNoRawLinks();

    await fireEvent.press(screen.getByTestId("handoff-button"));
    expect(screen.getByTestId("handoff-button").props.accessibilityLabel).toBe("Gå til tilbud hos SAS");
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledTimes(1);
    expect(jest.mocked(WebBrowser.openBrowserAsync).mock.calls[0]![0]).toBe(KAYAK_URL);
    // Nettets klikkmåling: bare tilbuds-id og den anonyme søkeøkten – aldri token.
    const click = server.calls.find((c) => c.path === "flights.trackProviderClick")!;
    expect(click.input).toEqual({ offerId: "sek_1", sessionId: "11111111-2222-4333-8444-555555555555" });
    expect(click.headers.authorization).toBeUndefined();
  });

  it("vilkår: bare leverandørens egne opplysninger – «refundable: false» uten vilkår blir aldri «kan ikke refunderes»", async () => {
    await openOffer("sek_1");
    // SEK-tilbudet har refundable: false, men ingen `conditions` – bare leverandørens erklæring.
    expect(screen.getByTestId("disclosure")).toHaveTextContent("Billetten kan ikke refunderes.");
    expect(screen.queryByText(/Refusjon før avreise/)).toBeNull();
    expect(screen.queryByText(/Kan endres|Kan ikke endres/)).toBeNull();

    expect(screen.getByTestId("bag-carryOn")).toHaveTextContent(/Håndbagasje.*Inkludert/);
    expect(screen.getByTestId("bag-checked")).toHaveTextContent(/Innsjekket bagasje.*Ikke oppgitt/);
  });

  it("tilbud HelloSky selger: gebyret nevnes uten beløp i annen valuta; samme søk åpnes på hellosky.no; ingen vilkårskort uten vilkår", async () => {
    await openOffer("hs_eur");
    expect(screen.getByTestId("service-fee")).toHaveTextContent("Prisen inkluderer HelloSkys servicegebyr.");
    expect(screen.queryByTestId("seller")).toBeNull();
    expect(screen.queryByTestId("handoff-button")).toBeNull();
    expect(screen.getByTestId("handoff-not-in-app")).toHaveTextContent("HelloSky selger denne billetten på hellosky.no. Det samme søket åpnes der, og prisen sjekkes på nytt.");
    await fireEvent.press(screen.getByTestId("web-handoff"));
    const [url] = (WebBrowser.openBrowserAsync as jest.Mock).mock.calls.at(-1)!;
    expect(url).toMatch(/^https:\/\/hellosky\.no\/sok\?adults=1&children=0&infants=0&cabin=economy&from=[A-Z]{3}&to=[A-Z]{3}&depart=\d{4}-\d{2}-\d{2}/);
    expect(screen.queryByTestId("terms-card")).toBeNull();
    expectNoForeignAmounts();
    expectNoRawLinks();
  });

  it("en utrygg lenke åpnes aldri", async () => {
    await openOffer("unsafe_1");
    expect(screen.getByTestId("handoff-invalid")).toBeOnTheScreen();
    expect(screen.queryByTestId("handoff-button")).toBeNull();
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });

  it("alle tilbudsdetaljer: ingen utenlandske beløp, kurser, valutakoder eller rå lenker", async () => {
    for (const o of SEARCH_RESULT.offers) {
      await openOffer(o.offer.id);
      expectNoForeignAmounts();
      expectNoRawLinks();
      await screen.unmount();
    }
  });

  it("samme reise hos flere tilbydere: velg tilbyder – pris, bagasje og knapp følger valget", async () => {
    const { factory } = setup({ "flights.search": () => ({ data: { ...SEARCH_RESULT, offers: [SEK_OFFER, SAME_TRIP_OTHER_SELLER] } }) });
    setParams({ id: "sek_1" });
    await render(
      <AppProvider initialLocale="nb" apiFactory={factory} initial={{ destination: BCN }}>
        <SearchOnMount>
          <OfferScreen />
        </SearchOnMount>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("sellers")).toBeOnTheScreen());
    expect(within(screen.getByTestId("sellers")).getByText("Samme reise hos 2 tilbydere. Pris, bagasje og vilkår gjelder den du velger.")).toBeOnTheScreen();
    // Billigst først i sammenligningen.
    const rows = within(screen.getByTestId("sellers")).getAllByTestId(/^seller-/).map((el) => el.props.testID as string);
    expect(rows).toEqual(["seller-gtg_1", "seller-sek_1"]);
    expect(screen.getByTestId("handoff-button").props.accessibilityLabel).toBe("Gå til tilbud hos SAS");
    expect(screen.getByTestId("bar-provider")).toHaveTextContent("SAS ·");
    // Sammenligningen står først, før reiseplanen (én rulleflate, ingen faner).
    const overview = screen.getByTestId("offer-screen");
    const order = within(overview).getAllByText(/^(Tilbydere|Utreise · .+|Bagasje)$/).map((el) => el.props.children as string);
    expect(order[0]).toBe("Tilbydere");
    expect(order[1]).toMatch(/^Utreise · /);
    // Hver selgers bagasje står i sin helhet – ingen linjegrense som kan kutte forskjellen.
    for (const id of ["gtg_1", "sek_1"]) {
      const bags = screen.getByTestId(`sellerbags-${id}`);
      expect(bags.props.numberOfLines).toBeUndefined();
      expect(bags).toHaveTextContent(/^Håndbagasje .+ · Innsjekket bagasje/);
    }

    await fireEvent.press(screen.getByTestId("seller-gtg_1"));
    // Pris, bagasje, vilkår og handlingen følger valget – samtidig.
    expect(screen.getByTestId("handoff-button").props.accessibilityLabel).toBe("Gå til tilbud hos Gotogate");
    expect(screen.getByTestId("bar-provider")).toHaveTextContent("Gotogate ·");
    expect(within(screen.getByTestId("bar-price")).getByText(/^1\s390\skr$/)).toBeOnTheScreen();
    expect(within(screen.getByTestId("offer-price")).getByText(/^1\s390\skr$/)).toBeOnTheScreen();
    expect(screen.getByTestId("bag-checked")).toHaveTextContent(/Innsjekket bagasje.*Inkludert/);
    expect(screen.getByText("Refusjon før avreise")).toBeOnTheScreen();
    expect(screen.getByText("Endring før avreise")).toBeOnTheScreen();
  });

  it("deling: bare kronebeløp og hva prisen gjelder", async () => {
    const spy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    await openOffer("sek_1");
    await fireEvent.press(screen.getByTestId("share"));
    const message = (spy.mock.calls[0]![0] as { message: string }).message;
    expect(message).toMatch(/^Oslo → Barcelona, fre\. 23\. okt\. – fre\. 30\. okt\.: ca\. 1\s442\skr \(totalt for 1 voksen · tur-retur\)/);
    expect(message).not.toMatch(/SEK|1500|kayak/i);
    // Prisen er et øyeblikksbilde; lenken er det samme søket på hellosky.no – uten token eller leverandørlenke.
    expect(message).toContain("prisen kan ha endret seg siden");
    expect(message).toMatch(/\nhttps:\/\/hellosky\.no\/sok\?adults=1&children=0&infants=0&cabin=economy&from=OSL&to=BCN&depart=2026-10-23&ret=2026-10-30$/);
    spy.mockRestore();
  });

  it("utløpt tilbud: nøytral merknad om at prisen kan ha endret seg", async () => {
    const old = { ...SEARCH_RESULT.offers[0]!, offer: { ...SEARCH_RESULT.offers[0]!.offer, id: "old_1", expiresAt: "2020-01-01T00:00:00Z" } };
    const { factory } = setup({ "flights.search": () => ({ data: { ...SEARCH_RESULT, offers: [old] } }) });
    setParams({ id: "old_1" });
    await render(
      <AppProvider initialLocale="nb" apiFactory={factory} initial={{ destination: BCN }}>
        <SearchOnMount>
          <OfferScreen />
        </SearchOnMount>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("offer-screen")).toBeOnTheScreen());
    expect(screen.getByTestId("offer-expired")).toHaveTextContent("Prisen kan ha endret seg siden søket. Søk på nytt for oppdaterte priser.");
  });

  it("tilbud i kroner med servicegebyr i kroner: gebyret vises som kronebeløp", async () => {
    const nokHs = { ...SEARCH_RESULT.offers[2]!, offer: { ...SEARCH_RESULT.offers[2]!.offer, id: "hs_nok", booking: undefined }, price: { ...SEARCH_RESULT.offers[2]!.price, serviceFee: { amount: "250.00", currency: "NOK" } } };
    const { factory } = setup({ "flights.search": () => ({ data: { ...SEARCH_RESULT, offers: [nokHs] } }) });
    setParams({ id: "hs_nok" });
    await render(
      <AppProvider initialLocale="nb" apiFactory={factory} initial={{ destination: BCN }}>
        <SearchOnMount>
          <OfferScreen />
        </SearchOnMount>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("offer-screen")).toBeOnTheScreen());
    expect(screen.getByTestId("service-fee")).toHaveTextContent(/^Herav HelloSkys servicegebyr: 250\skr$/);
  });

  it("byttetid over sommertidsskifte regnes med tidssone", async () => {
    const base = SEARCH_RESULT.offers[0]!;
    const slice0 = base.offer.slices[0]!;
    const segs = [
      { ...slice0.segments[0]!, arrivingAt: "2026-10-25T01:30:00+02:00" },
      { ...slice0.segments[1]!, departingAt: "2026-10-25T02:15:00+01:00" },
    ];
    const dst = { ...base, offer: { ...base.offer, id: "dst_1", slices: [{ ...slice0, segments: segs }] } };
    const { factory } = setup({ "flights.search": () => ({ data: { ...SEARCH_RESULT, offers: [dst] } }) });
    setParams({ id: "dst_1" });
    await render(
      <AppProvider initialLocale="nb" apiFactory={factory} initial={{ destination: BCN }}>
        <SearchOnMount>
          <OfferScreen />
        </SearchOnMount>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("offer-screen")).toBeOnTheScreen());
    // Reiseplanen står alltid på skjermen (ingen fane å åpne).
    expect(within(screen.getByTestId("itinerary")).getByText("Bytte i København · 1 t 45 min")).toBeOnTheScreen();
  });

  it("uten søkeresultat: ber kunden søke på nytt", async () => {
    const { factory } = setup({});
    setParams({ id: "finnes-ikke" });
    await render(
      <AppProvider initialLocale="nb" apiFactory={factory}>
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
      <AppProvider initialLocale="nb" apiFactory={factory}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    const tree = renderedStrings();
    for (const word of ["admin", "Admin", "ansatt", "staff", "Staff", "eier"]) expect(tree).not.toContain(word);

    await fireEvent.changeText(screen.getByTestId("email"), "kari@example.no");
    await fireEvent.changeText(screen.getByTestId("password"), "passord-123456");
    await fireEvent.press(screen.getByTestId("auth-submit"));
    await waitFor(() => expect(screen.getByTestId("account-signed-in")).toBeOnTheScreen());
    expect(screen.getByText("Hei, Kari")).toBeOnTheScreen();

    // Innloggingsmåtene (mobileAuth.providers) er et offentlig kall uten token; ellers er innloggingen det eneste.
    const providers = server.calls.filter((c) => c.path === "mobileAuth.providers");
    expect(providers.every((c) => c.headers.authorization === undefined)).toBe(true);
    const calls = server.calls.filter((c) => c.path !== "mobileAuth.providers");
    expect(calls[0]).toMatchObject({ path: "mobileAuth.login", input: { identifier: "kari@example.no", password: "passord-123456" } });
    expect(calls[0]!.headers.authorization).toBeUndefined();
    expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith("hellosky.customer-session", JSON.stringify({ token: TOKEN, expiresAt: AUTH_RESULT.session.expiresAt }), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    // Tokenet vises ikke noe sted i grensesnittet.
    expect(renderedStrings()).not.toContain(TOKEN);

    await fireEvent.press(screen.getByTestId("logout-button"));
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    const logout = server.calls.find((c) => c.path === "mobileAuth.logout")!;
    expect(logout.headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(keychain.size).toBe(0);
  });

  it("utlogging uten nett sletter tokenet lokalt likevel", async () => {
    const { factory } = setup({ "mobileAuth.login": () => ({ data: AUTH_RESULT }), "mobileAuth.logout": () => Promise.reject(new Error("offline")) });
    await render(
      <AppProvider initialLocale="nb" apiFactory={factory}>
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
      <AppProvider initialLocale="nb" apiFactory={factory}>
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
    expect(server.calls.filter((c) => c.path !== "mobileAuth.providers")).toHaveLength(0);

    await fireEvent.changeText(screen.getByTestId("password"), "passord-123456");
    await fireEvent.press(screen.getByTestId("auth-submit"));
    await waitFor(() => expect(screen.getByTestId("auth-error")).toHaveTextContent("Det finnes allerede en konto med denne e-postadressen. Prøv å logge inn."));
    expect(keychain.size).toBe(0);
  });

  it("registrering: nye kontoer lages med e-post – et telefonnummer sendes aldri til serveren", async () => {
    const { server, factory } = setup({ "mobileAuth.register": () => ({ data: AUTH_RESULT }) });
    await render(
      <AppProvider initialLocale="nb" apiFactory={factory}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    await fireEvent.press(screen.getByLabelText("Ny konto"));
    await fireEvent.changeText(screen.getByTestId("first-name"), "Kari");
    await fireEvent.changeText(screen.getByTestId("last-name"), "Nordmann");
    await fireEvent.changeText(screen.getByTestId("email"), "+47 912 34 567");
    await fireEvent.changeText(screen.getByTestId("password"), "passord-123456");
    await fireEvent.press(screen.getByTestId("auth-submit"));
    expect(screen.getByTestId("auth-error")).toHaveTextContent("Skriv inn en gyldig e-postadresse.");
    expect(server.calls.filter((c) => c.path === "mobileAuth.register")).toHaveLength(0);
    expect(keychain.size).toBe(0);
  });

  it("ved oppstart: en lagret sesjon serveren ikke kjenner lenger, slettes", async () => {
    keychain.set("hellosky.customer-session", { value: JSON.stringify({ token: TOKEN, expiresAt: "2099-01-01T00:00:00Z" }), options: {} });
    const { server, factory } = setup({ "mobileAuth.me": () => ({ data: null }) });
    await render(
      <AppProvider initialLocale="nb" apiFactory={factory}>
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
      <AppProvider initialLocale="nb" apiFactory={ok.factory}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByText("Hei, Kari")).toBeOnTheScreen());
    await first.unmount();

    const offline = setup({ "mobileAuth.me": () => Promise.reject(new Error("offline")) });
    await render(
      <AppProvider initialLocale="nb" apiFactory={offline.factory}>
        <AccountScreen />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByText(/fikk ikke hentet kontoen/)).toBeOnTheScreen());
    expect(keychain.size).toBe(1);
  });
});
