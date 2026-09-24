import { useEffect, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as WebBrowser from "expo-web-browser";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { SAME_TRIP_OTHER_SELLER, SEARCH_RESULT, SEK_OFFER } from "../test/fixtures";
import OfferScreen from "../app/tilbud/[id]";

// Utløp i Flydetaljer: prisen utløper mens skjermen står åpen, mens appen er i bakgrunnen, eller akkurat i det
// kunden trykker. Advarselen vises da alltid før noe åpnes, og videre går bare via «Gå til … likevel».
// Testdata: SAS (sek_1) utløper om 60 s, Gotogate (gtg_1, samme reise) om 10 min.

const setParams = (globalThis as unknown as { __setParams: (p: Record<string, string>) => void }).__setParams;
const BCN = { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spania" };
const T0 = Date.parse("2026-09-23T10:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const open = WebBrowser.openBrowserAsync as jest.Mock;

function SearchOnMount({ children }: { children: ReactNode }) {
  const { runSearch } = useApp();
  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

const SAS = { ...SEK_OFFER, offer: { ...SEK_OFFER.offer, expiresAt: iso(T0 + 60_000) } };
const GTG = { ...SAME_TRIP_OTHER_SELLER, offer: { ...SAME_TRIP_OTHER_SELLER.offer, expiresAt: iso(T0 + 10 * 60_000) } };

async function openDetails(locale: "nb" | "en" = "nb") {
  const server = fakeServer({ "flights.search": () => ({ data: { ...SEARCH_RESULT, offers: [SAS, GTG] } }), "flights.trackProviderClick": () => ({ data: { clickRef: null } }) });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  setParams({ id: "sek_1" });
  const view = await render(
    <AppProvider initialLocale={locale} apiFactory={factory} initial={{ destination: BCN }}>
      <SearchOnMount>
        <OfferScreen />
      </SearchOnMount>
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("sellers")).toBeOnTheScreen());
  const clicks = () => server.calls.filter((c) => c.path === "flights.trackProviderClick");
  return { server, clicks, view };
}

// AppState: lytterne fanges, så testen kan sende appen til bakgrunnen og tilbake, og sjekke at de fjernes.
let listeners: ((s: AppStateStatus) => void)[] = [];
let removes: jest.Mock[] = [];

/** Bare klokka og tidtakerne; løfter og mikrooppgaver går som vanlig. */
beforeEach(() => {
  jest.useFakeTimers({ now: T0, doNotFake: ["nextTick", "queueMicrotask", "setImmediate", "performance"] });
  open.mockClear();
  listeners = [];
  removes = [];
  jest.spyOn(AppState, "addEventListener").mockImplementation((type, fn) => {
    if (type === "change") listeners.push(fn as (s: AppStateStatus) => void);
    const remove = jest.fn();
    removes.push(remove);
    return { remove };
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const valid = (seller: string) => {
  expect(screen.queryByTestId("offer-expired")).toBeNull();
  expect(screen.getByTestId("handoff-button").props.accessibilityLabel).toBe(`Gå til tilbud hos ${seller}`);
  expect(screen.queryByTestId("search-again")).toBeNull();
};
const expired = (seller: string) => {
  expect(screen.getByTestId("offer-expired")).toHaveTextContent("Prisen kan ha endret seg siden søket. Søk på nytt for oppdaterte priser.");
  expect(screen.getByTestId("search-again")).toBeOnTheScreen();
  expect(screen.getByTestId("handoff-button").props.accessibilityLabel).toBe(`Gå til ${seller} likevel`);
};

describe("utløp i Flydetaljer", () => {
  it("skjermen står åpen: advarselen kommer i det prisen utløper, uten noen annen endring – valgt selger, bagasje og vilkår står", async () => {
    await openDetails();
    valid("SAS");
    await act(async () => void jest.advanceTimersByTime(59_999));
    valid("SAS");
    await act(async () => void jest.advanceTimersByTime(2));
    expired("SAS");
    expect(screen.getByTestId("seller-sek_1").props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId("bar-provider")).toHaveTextContent("SAS ·");
    await fireEvent.press(screen.getByTestId("tab-baggage"));
    expect(screen.getByTestId("bag-checked")).toHaveTextContent(/Innsjekket bagasje.*Ikke oppgitt/);
    expect(open).not.toHaveBeenCalled();
  });

  it("trykk i det prisen utløper, før skjermen rakk å tegnes på nytt: ingenting åpnes eller måles, advarselen vises; så åpner «likevel» én gang", async () => {
    const { clicks } = await openDetails();
    valid("SAS");
    // Klokka passerer utløpet uten at tidtakeren har gått (den «gamle» knappen står fortsatt).
    await act(async () => jest.setSystemTime(T0 + 61_000));
    valid("SAS");
    await fireEvent.press(screen.getByTestId("handoff-button"));
    expect(open).not.toHaveBeenCalled();
    expect(clicks()).toHaveLength(0);
    expired("SAS");
    // Det uttrykkelige valget: ett trykk, én måling og én nettleser – også ved dobbelttrykk.
    open.mockImplementationOnce(() => new Promise(() => undefined)); // nettleseren er fortsatt åpen
    await fireEvent.press(screen.getByTestId("handoff-button"));
    await fireEvent.press(screen.getByTestId("handoff-button"));
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0]![0]).toBe(SAS.offer.booking!.url);
    await waitFor(() => expect(clicks()).toHaveLength(1));
    expect(clicks()[0]!.input).toMatchObject({ offerId: "sek_1" });
  });

  it("appen var i bakgrunnen (tidtakerne sto stille): advarselen vises når den kommer tilbake", async () => {
    await openDetails();
    valid("SAS");
    await act(async () => listeners.forEach((l) => l("background")));
    await act(async () => jest.setSystemTime(T0 + 5 * 60_000));
    valid("SAS"); // ingenting har skjedd på skjermen ennå
    await act(async () => listeners.forEach((l) => l("active")));
    expired("SAS");
  });

  it("bytte mellom selgere med ulikt utløp: hver selgers eget utløp gjelder, og det neste måles på nytt", async () => {
    await openDetails();
    await act(async () => void jest.advanceTimersByTime(61_000));
    expired("SAS");
    await fireEvent.press(screen.getByTestId("seller-gtg_1"));
    valid("Gotogate");
    expect(within(screen.getByTestId("bar-price")).getByText(/^1\s390\skr$/)).toBeOnTheScreen();
    await act(async () => void jest.advanceTimersByTime(10 * 60_000 - 61_000 - 1));
    valid("Gotogate");
    await act(async () => void jest.advanceTimersByTime(2));
    expired("Gotogate");
    await fireEvent.press(screen.getByTestId("seller-sek_1"));
    expired("SAS");
  });

  it("en gyldig pris: ett trykk er én måling og én nettleser, også ved dobbelttrykk", async () => {
    const { clicks } = await openDetails();
    open.mockImplementationOnce(() => new Promise(() => undefined));
    await fireEvent.press(screen.getByTestId("handoff-button"));
    await fireEvent.press(screen.getByTestId("handoff-button"));
    expect(open).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(clicks()).toHaveLength(1));
  });

  it("rydder opp: ingen tidtakere og ingen AppState-lytter etter at skjermen lukkes", async () => {
    const { view } = await openDetails();
    expect(jest.getTimerCount()).toBeGreaterThan(0);
    expect(removes.length).toBeGreaterThan(0);
    await view.unmount();
    expect(jest.getTimerCount()).toBe(0);
    for (const r of removes) expect(r).toHaveBeenCalled();
  });
});
