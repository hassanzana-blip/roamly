import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as WebBrowser from "expo-web-browser";
import { AppProvider, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { BOOK_URL_A, BOOK_URL_B, CHECKIN, CHECKOUT, HOTEL_A, HOTEL_DETAIL, HOTEL_RESULT, LONDON, LONDON_EYE, STATUS_LIVE, STATUS_OFF, STATUS_SANDBOX } from "../test/hotelFixtures";
import HomeScreen from "../app/(tabs)/index";
import HotelSearchScreen from "../app/hotell/index";
import HotelResultsScreen from "../app/hotell/resultater";
import HotelDetailScreen from "../app/hotell/detaljer";

// Hotellflyten: ekte skjermer, ekte app-tilstand og ekte API-klient – bare
// HTTP-laget er en falsk server som husker hver forespørsel.

const router = (globalThis as unknown as { __router: { push: jest.Mock; back: jest.Mock; replace: jest.Mock } }).__router;
const setParams = (globalThis as unknown as { __setParams: (p: Record<string, string>) => void }).__setParams;
const openBrowser = WebBrowser.openBrowserAsync as jest.Mock;

type Routes = Parameters<typeof fakeServer>[0];

function setup(routes: Routes) {
  const server = fakeServer({ "mobileAuth.me": () => ({ data: null }), ...routes });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  const called = (path: string) => server.calls.filter((c) => c.path === path);
  return { server, factory, called };
}

async function renderWith(factory: ApiFactory, ui: ReactNode, locale?: "nb" | "en") {
  await render(
    <AppProvider initialLocale={locale} apiFactory={factory}>
      {ui}
    </AppProvider>,
  );
}

/** Et svar som holdes tilbake til testen slipper det, så lastetilstanden kan sjekkes. */
function held<T>(value: T) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const handler = (async () => {
    await gate;
    return value;
  }) as unknown as () => Promise<never>;
  return { handler, release: async () => act(async () => release()) };
}

const STAY = { sted: LONDON.key, navn: "London, England, Storbritannia", inn: CHECKIN, ut: CHECKOUT, voksne: "2", barn: "", rom: "1" };
const NBSP = " ";

beforeEach(() => openBrowser.mockClear());

describe("inngang fra forsiden", () => {
  it("når hotellsøket er på: Hotell i søkeøya åpner hotellsøket; Fly er valgt", async () => {
    const { factory } = setup({ "hotels.status": () => ({ data: STATUS_LIVE }) });
    await renderWith(factory, <HomeScreen />);
    await waitFor(() => expect(screen.getByTestId("service-flights")).toBeOnTheScreen());
    expect(screen.getByTestId("service-flights")).toBeSelected();
    expect(screen.getByTestId("service-hotels")).not.toBeSelected();
    await fireEvent.press(screen.getByTestId("service-hotels"));
    expect(router.push).toHaveBeenCalledWith("/hotell");
  });
});

describe("hotellsøket: status fra serveren styrer alt", () => {
  it("avslått: forklarer det, viser ingen skjema eller priser, og sender til nettets hotellforespørsel", async () => {
    const { factory, called, server } = setup({ "hotels.status": () => ({ data: STATUS_OFF }) });
    await renderWith(factory, <HotelSearchScreen />);
    await waitFor(() => expect(screen.getByTestId("hotels-disabled")).toBeOnTheScreen());
    expect(screen.getByText("Hotellsøk er ikke tilgjengelig i appen ennå")).toBeOnTheScreen();
    expect(screen.queryByTestId("hotel-form")).toBeNull();
    expect(screen.queryByTestId("hotel-search-button")).toBeNull();
    await fireEvent.press(screen.getByTestId("hotels-inquiry"));
    expect(openBrowser).toHaveBeenCalledWith("https://hellosky.no/hotell-bil?fane=hotell", expect.anything());
    // Bare statusen ble spurt – ingen stedsøk, hotellsøk eller reservedata.
    expect(called("hotels.status")).toHaveLength(1);
    expect(server.calls.filter((c) => c.path.startsWith("hotels.") && c.path !== "hotels.status")).toHaveLength(0);
  });

  it("mens statusen hentes vises verken skjema eller knapp; feil kan prøves igjen", async () => {
    let fail = true;
    const first = held({ status: 503, error: { message: "nede", appCode: "SUPPLIER_UNAVAILABLE" } });
    const { factory, called } = setup({
      "hotels.status": () => (fail ? first.handler() : { data: STATUS_LIVE }),
    });
    await renderWith(factory, <HotelSearchScreen />);
    expect(screen.getByTestId("hotels-status-loading")).toBeOnTheScreen();
    expect(screen.queryByTestId("hotel-form")).toBeNull();
    await first.release();
    await waitFor(() => expect(screen.getByTestId("hotels-status-error")).toBeOnTheScreen());
    expect(screen.getByTestId("hotels-inquiry")).toBeOnTheScreen();
    fail = false;
    await fireEvent.press(screen.getByTestId("hotels-status-retry"));
    await waitFor(() => expect(screen.getByTestId("hotel-form")).toBeOnTheScreen());
    expect(called("hotels.status")).toHaveLength(2);
    expect(screen.queryByTestId("hotels-sandbox")).toBeNull();
  });

  it("sandbox: skjemaet vises, men merket som testdata", async () => {
    const { factory } = setup({ "hotels.status": () => ({ data: STATUS_SANDBOX }) });
    await renderWith(factory, <HotelSearchScreen />);
    await waitFor(() => expect(screen.getByTestId("hotels-sandbox")).toBeOnTheScreen());
    expect(screen.getByTestId("hotels-sandbox")).toHaveTextContent(/prisene er ikke ekte/);
  });

  it("stedsøk → valgt sted → søk: resultatene får sted, datoer, gjester og rom", async () => {
    const { factory, called } = setup({
      "hotels.status": () => ({ data: STATUS_LIVE }),
      "hotels.places": (req) => ({ data: (req.input as { query: string }).query.toLowerCase().startsWith("lon") ? [LONDON, LONDON_EYE] : [] }),
    });
    await renderWith(factory, <HotelSearchScreen />);
    await waitFor(() => expect(screen.getByTestId("hotel-form")).toBeOnTheScreen());

    // Uten valgt sted: tydelig feil, ingen navigasjon.
    await fireEvent.press(screen.getByTestId("hotel-search-button"));
    expect(screen.getByTestId("hotel-form-error")).toHaveTextContent("Velg et sted fra listen.");
    expect(router.push).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId("hotel-place-query"), "Lon");
    await waitFor(() => expect(screen.getByTestId(`hotel-place-${LONDON.key}`)).toBeOnTheScreen());
    expect(called("hotels.places").at(-1)!.input).toEqual({ query: "Lon" });
    await fireEvent.press(screen.getByTestId(`hotel-place-${LONDON.key}`));
    expect(screen.getByTestId("hotel-place-chosen")).toHaveTextContent("Valgt: London, England, Storbritannia");
    expect(screen.queryByTestId("hotel-place-results")).toBeNull();

    // Gjester: 3 voksne, 1 barn (8 år), 2 rom.
    await fireEvent.press(screen.getByTestId("hotel-guests"));
    const sheet = within(screen.getByTestId("hotel-guests-sheet"));
    await fireEvent.press(sheet.getByLabelText("Flere voksne"));
    await fireEvent.press(sheet.getByLabelText("Flere barn"));
    await fireEvent.press(sheet.getByLabelText("Flere rom"));
    await fireEvent.press(screen.getByTestId("hotel-guests-sheet-done"));
    expect(screen.getByTestId("hotel-guests")).toHaveTextContent(/3 voksne · 1 barn · 2 rom/);

    await fireEvent.press(screen.getByTestId("hotel-search-button"));
    expect(router.push).toHaveBeenCalledTimes(1);
    const arg = router.push.mock.calls[0]![0] as { pathname: string; params: Record<string, string> };
    expect(arg.pathname).toBe("/hotell/resultater");
    expect(arg.params).toMatchObject({ sted: LONDON.key, navn: "London, England, Storbritannia", voksne: "3", barn: "8", rom: "2" });
    expect(arg.params.ut! > arg.params.inn!).toBe(true);
  });

  it("endres teksten etter valget, er stedet ikke lenger valgt – og gamle forslag kan ikke velges", async () => {
    const { factory } = setup({ "hotels.status": () => ({ data: STATUS_LIVE }), "hotels.places": () => ({ data: [LONDON] }) });
    await renderWith(factory, <HotelSearchScreen />);
    await waitFor(() => expect(screen.getByTestId("hotel-form")).toBeOnTheScreen());
    await fireEvent.changeText(screen.getByTestId("hotel-place-query"), "London");
    await waitFor(() => expect(screen.getByTestId(`hotel-place-${LONDON.key}`)).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId(`hotel-place-${LONDON.key}`));
    await fireEvent.changeText(screen.getByTestId("hotel-place-query"), "Londo");
    expect(screen.queryByTestId("hotel-place-chosen")).toBeNull();
    await fireEvent.press(screen.getByTestId("hotel-search-button"));
    expect(screen.getByTestId("hotel-form-error")).toHaveTextContent("Velg et sted fra listen.");
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("hotellresultater", () => {
  it("ber om NOK-søket for oppholdet (uten valuta), og viser totalpris for hele oppholdet", async () => {
    const answer = held({ data: HOTEL_RESULT });
    const { factory, called } = setup({ "hotels.search": answer.handler });
    setParams(STAY);
    await renderWith(factory, <HotelResultsScreen />);
    expect(screen.getByTestId("hotel-results-loading")).toBeOnTheScreen();
    expect(screen.getByTestId("hotel-search-cancel")).toBeOnTheScreen();
    await answer.release();
    await waitFor(() => expect(screen.getByTestId("hotel-results-count")).toHaveTextContent("3 hotell"));

    const input = called("hotels.search")[0]!.input as Record<string, unknown>;
    expect(input).toEqual({ destination: LONDON.key, checkin: CHECKIN, checkout: CHECKOUT, rooms: [{ adults: 2 }], language: "nb", sessionId: "11111111-2222-4333-8444-555555555555" });
    expect(input).not.toHaveProperty("currency");
    expect(called("hotels.search")[0]!.method).toBe("GET");

    const a = within(screen.getByTestId(`hotel-${HOTEL_A.key}`));
    // Laveste leverandørpris, ikke den første i listen: 3 639 kr (Booking.com), ikke 4 119,50 kr (Hilton).
    expect(screen.getByTestId(`hotel-${HOTEL_A.key}-price`)).toHaveTextContent(`Fra 3${NBSP}639${NBSP}kr`);
    expect(a.getByText("Totalt for oppholdet · 3 netter")).toBeOnTheScreen();
    expect(a.getByText(`ca. 1${NBSP}213${NBSP}kr per natt · Oppgitt av Booking.com`)).toBeOnTheScreen();
    expect(a.getByText(`3${NBSP}118 omtaler`)).toBeOnTheScreen();
    expect(a.getByText("4 stjerner · 0,6 km fra søkepunktet")).toBeOnTheScreen();
    expect(screen.getByTestId("hotel-khotel:77-noprice")).toHaveTextContent("Ingen pris akkurat nå");
    expect(screen.getByTestId("hotel-disclosure")).toHaveTextContent(/HelloSky tar ikke betaling/);
    expect(screen.queryByTestId("hotel-sandbox-notice")).toBeNull();
    expect(screen.queryByTestId("hotel-rooms-notice")).toBeNull();
    expect(screen.getByTestId("hotel-stay-line")).toHaveTextContent("23. okt. – 26. okt. · 3 netter · 2 voksne · 1 rom");
  });

  it("sortering: lavest totalpris (hotell uten pris sist) og gjestevurdering", async () => {
    const { factory } = setup({ "hotels.search": () => ({ data: HOTEL_RESULT }) });
    setParams(STAY);
    await renderWith(factory, <HotelResultsScreen />);
    await waitFor(() => expect(screen.getByTestId("hotel-results-count")).toBeOnTheScreen());
    const order = () => screen.getAllByTestId(/^hotel-khotel:\d+$/).map((n) => n.props.testID as string);
    expect(order()).toEqual(["hotel-khotel:2589314", "hotel-khotel:77", "hotel-khotel:91"]);
    await fireEvent.press(screen.getByTestId("hotel-sort-price"));
    expect(order()).toEqual(["hotel-khotel:91", "hotel-khotel:2589314", "hotel-khotel:77"]);
    await fireEvent.press(screen.getByTestId("hotel-sort-rating"));
    expect(order()).toEqual(["hotel-khotel:2589314", "hotel-khotel:77", "hotel-khotel:91"]);
  });

  it("flere rom og barn: gjestene fordeles på rommene, og kunden bes sjekke at prisen gjelder alle rom", async () => {
    const { factory, called } = setup({ "hotels.search": () => ({ data: { ...HOTEL_RESULT, sandbox: true, complete: false } }) });
    setParams({ ...STAY, voksne: "3", barn: "4,9", rom: "2" });
    await renderWith(factory, <HotelResultsScreen />);
    await waitFor(() => expect(screen.getByTestId("hotel-rooms-notice")).toBeOnTheScreen());
    expect((called("hotels.search")[0]!.input as { rooms: unknown }).rooms).toEqual([
      { adults: 2, childAges: [4] },
      { adults: 1, childAges: [9] },
    ]);
    expect(screen.getByTestId("hotel-rooms-notice")).toHaveTextContent(/2 rom/);
    expect(screen.getByTestId("hotel-sandbox-notice")).toHaveTextContent(/prisene er ikke ekte/);
    expect(screen.getByTestId("hotel-partial-notice")).toBeOnTheScreen();
  });

  it("pris i annen valuta vises ikke som tall og regnes ikke om", async () => {
    const eur = { ...HOTEL_A, currency: "EUR", rates: HOTEL_A.rates.map((r) => ({ ...r, currency: "EUR" })) };
    const { factory } = setup({ "hotels.search": () => ({ data: { ...HOTEL_RESULT, currency: "EUR", results: [eur] } }) });
    setParams(STAY);
    await renderWith(factory, <HotelResultsScreen />);
    await waitFor(() => expect(screen.getByTestId(`hotel-${HOTEL_A.key}-noprice`)).toHaveTextContent("Leverandøren oppga prisen i EUR. Se prisen hos leverandøren."));
    expect(screen.queryByText(/3\s?639|4\s?119|kr/)).toBeNull();
  });

  it("avslått på serveren: feilen vises, og kunden får hotellforespørselen med stedet", async () => {
    const { factory } = setup({ "hotels.search": () => ({ status: 400, error: { message: "Hotellsøk er ikke slått på.", appCode: "SUPPLIER_REJECTED" } }) });
    setParams(STAY);
    await renderWith(factory, <HotelResultsScreen />);
    await waitFor(() => expect(screen.getByTestId("hotel-results-error")).toBeOnTheScreen());
    expect(screen.getByText("Hotellsøk er ikke slått på.")).toBeOnTheScreen();
    expect(screen.queryByTestId(/^hotel-khotel/)).toBeNull();
    await fireEvent.press(screen.getByTestId("hotel-results-inquiry"));
    expect(openBrowser).toHaveBeenCalledWith("https://hellosky.no/hotell-bil?fane=hotell&sted=London%2C%20England%2C%20Storbritannia", expect.anything());
  });

  it("tomt svar og nytt forsøk etter feil", async () => {
    let n = 0;
    const { factory, called } = setup({
      "hotels.search": () => (++n === 1 ? { status: 503, error: { message: "x", appCode: "SUPPLIER_UNAVAILABLE" } } : { data: { ...HOTEL_RESULT, results: [] } }),
    });
    setParams(STAY);
    await renderWith(factory, <HotelResultsScreen />, "en");
    await waitFor(() => expect(screen.getByTestId("hotel-results-error")).toBeOnTheScreen());
    expect(screen.getByText("The hotel providers aren't answering right now. Try again in a moment.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("hotel-results-retry"));
    await waitFor(() => expect(screen.getByTestId("hotel-results-empty")).toBeOnTheScreen());
    expect(called("hotels.search")).toHaveLength(2);
    expect((called("hotels.search")[1]!.input as { language: string }).language).toBe("en");
  });

  it("ugyldige parametere: ingen søk", async () => {
    const { factory, called } = setup({ "hotels.search": () => ({ data: HOTEL_RESULT }) });
    setParams({ ...STAY, sted: "Oslo" });
    await renderWith(factory, <HotelResultsScreen />);
    expect(screen.getByTestId("hotel-results-invalid")).toBeOnTheScreen();
    expect(called("hotels.search")).toHaveLength(0);
  });

  it("åpner hotellet med samme opphold", async () => {
    const { factory } = setup({ "hotels.search": () => ({ data: HOTEL_RESULT }) });
    setParams(STAY);
    await renderWith(factory, <HotelResultsScreen />);
    await waitFor(() => expect(screen.getByTestId(`hotel-${HOTEL_A.key}`)).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId(`hotel-${HOTEL_A.key}`));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/hotell/detaljer", params: { ...STAY, hotell: HOTEL_A.key } });
  });

  it("engelsk: samme søk, NOK-format og engelske ord", async () => {
    const { factory } = setup({ "hotels.search": () => ({ data: HOTEL_RESULT }) });
    setParams(STAY);
    await renderWith(factory, <HotelResultsScreen />, "en");
    await waitFor(() => expect(screen.getByTestId("hotel-results-count")).toHaveTextContent("3 hotels"));
    expect(screen.getByTestId(`hotel-${HOTEL_A.key}-price`)).toHaveTextContent(`From NOK${NBSP}3,639`);
    expect(screen.getByTestId("hotel-stay-line")).toHaveTextContent("23 Oct – 26 Oct · 3 nights · 2 adults · 1 room");
    expect(within(screen.getByTestId(`hotel-${HOTEL_A.key}`)).getByText("Total for the stay · 3 nights")).toBeOnTheScreen();
  });
});

describe("hotelldetaljer og videresending", () => {
  const DETAIL_PARAMS = { ...STAY, hotell: HOTEL_A.key };

  it("produksjon: rom sortert på totalpris; «Gå til» åpner KAYAKs egen lenke", async () => {
    const { factory, called } = setup({ "hotels.status": () => ({ data: STATUS_LIVE }), "hotels.detail": () => ({ data: HOTEL_DETAIL }) });
    setParams(DETAIL_PARAMS);
    await renderWith(factory, <HotelDetailScreen />);
    await waitFor(() => expect(screen.getByTestId("hotel-detail")).toBeOnTheScreen());
    expect(called("hotels.detail")[0]!.input).toEqual({ hotelKey: HOTEL_A.key, checkin: CHECKIN, checkout: CHECKOUT, rooms: [{ adults: 2 }], language: "nb", sessionId: "11111111-2222-4333-8444-555555555555" });
    expect(screen.getByTestId("hotel-rate-0-price")).toHaveTextContent(`3${NBSP}639${NBSP}kr`);
    expect(screen.getByTestId("hotel-rate-1-price")).toHaveTextContent(`4${NBSP}119,50${NBSP}kr`);
    expect(within(screen.getByTestId("hotel-rate-1")).getByText("Gratis avbestilling")).toBeOnTheScreen();
    expect(within(screen.getByTestId("hotel-rate-1")).getByText("Frokost inkludert")).toBeOnTheScreen();
    expect(within(screen.getByTestId("hotel-rate-0")).getByText("2 rom igjen")).toBeOnTheScreen();
    expect(screen.queryByTestId("hotel-detail-sandbox")).toBeNull();

    await fireEvent.press(screen.getByTestId("hotel-rate-0-go"));
    expect(openBrowser).toHaveBeenCalledWith(BOOK_URL_A, expect.anything());
    await fireEvent.press(screen.getByTestId("hotel-rate-1-go"));
    expect(openBrowser).toHaveBeenLastCalledWith(BOOK_URL_B, expect.anything());
    expect(screen.getByLabelText("Gå til Booking.com")).toBeOnTheScreen();
  });

  it("sandbox: prisene merkes som testdata, og ingen rom kan sendes videre", async () => {
    const { factory } = setup({ "hotels.status": () => ({ data: STATUS_SANDBOX }), "hotels.detail": () => ({ data: { ...HOTEL_DETAIL, sandbox: true } }) });
    setParams(DETAIL_PARAMS);
    await renderWith(factory, <HotelDetailScreen />);
    await waitFor(() => expect(screen.getByTestId("hotel-detail-sandbox")).toBeOnTheScreen());
    expect(screen.queryByTestId("hotel-rate-0-go")).toBeNull();
    expect(screen.getByTestId("hotel-rate-0-blocked")).toHaveTextContent("Testdata – kan ikke bestilles");
    expect(openBrowser).not.toHaveBeenCalled();
  });

  it("status sier avslått: ingen videresending, selv om detaljene kom", async () => {
    const { factory } = setup({ "hotels.status": () => ({ data: STATUS_OFF }), "hotels.detail": () => ({ data: HOTEL_DETAIL }) });
    setParams(DETAIL_PARAMS);
    await renderWith(factory, <HotelDetailScreen />);
    await waitFor(() => expect(screen.getByTestId("hotel-rate-0-blocked")).toHaveTextContent(/slått av/));
    expect(screen.queryByTestId("hotel-rate-0-go")).toBeNull();
  });

  it("status kunne ikke hentes: ingen videresending, og statusen kan hentes på nytt", async () => {
    let fail = true;
    const { factory } = setup({
      "hotels.status": () => (fail ? { status: 503, error: { message: "x", appCode: "SUPPLIER_UNAVAILABLE" } } : { data: STATUS_LIVE }),
      "hotels.detail": () => ({ data: HOTEL_DETAIL }),
    });
    setParams(DETAIL_PARAMS);
    await renderWith(factory, <HotelDetailScreen />);
    await waitFor(() => expect(screen.getByTestId("hotel-detail-status-error")).toBeOnTheScreen());
    expect(screen.queryByTestId("hotel-rate-0-go")).toBeNull();
    // Ikke «slått av» – det vet vi ikke; bare at det ikke kunne bekreftes.
    expect(screen.getByTestId("hotel-rate-0-blocked")).toHaveTextContent(/Kunne ikke bekrefte/);
    fail = false;
    await fireEvent.press(screen.getByTestId("hotel-detail-status-retry"));
    await waitFor(() => expect(screen.getByTestId("hotel-rate-0-go")).toBeOnTheScreen());
  });

  it("lenke som ikke er https: ikke åpnet", async () => {
    const bad = { ...HOTEL_DETAIL, hotel: { ...HOTEL_DETAIL.hotel, rates: [{ ...HOTEL_A.rates[1]!, bookUrl: "http://example.test/book" }] } };
    const { factory } = setup({ "hotels.status": () => ({ data: STATUS_LIVE }), "hotels.detail": () => ({ data: bad }) });
    setParams(DETAIL_PARAMS);
    await renderWith(factory, <HotelDetailScreen />);
    await waitFor(() => expect(screen.getByTestId("hotel-rate-0-blocked")).toHaveTextContent("Leverandørens lenke er ikke gyldig"));
  });

  it("ingen leverandører med pris: sagt rett ut", async () => {
    const { factory } = setup({ "hotels.status": () => ({ data: STATUS_LIVE }), "hotels.detail": () => ({ data: { ...HOTEL_DETAIL, hotel: { ...HOTEL_DETAIL.hotel, rates: [] } } }) });
    setParams(DETAIL_PARAMS);
    await renderWith(factory, <HotelDetailScreen />, "en");
    await waitFor(() => expect(screen.getByTestId("hotel-no-rates")).toHaveTextContent("No provider has a price for these dates right now."));
  });
});
