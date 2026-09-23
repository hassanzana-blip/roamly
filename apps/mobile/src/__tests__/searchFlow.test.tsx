import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import type { Airport } from "@contracts/airports";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { ApiError, type ApiClient } from "../lib/api";
import { normalizeQuery } from "../lib/searchForm";
import AirportPicker from "../app/flyplass";
import ResultsScreen from "../app/resultater";

const router = (globalThis as unknown as { __router: { push: jest.Mock; back: jest.Mock; replace: jest.Mock } }).__router;
const setParams = (globalThis as unknown as { __setParams: (p: Record<string, string>) => void }).__setParams;

const airport = (iata: string, city: string): Airport => ({ iata, name: `${city} lufthavn`, city, country: "X", countryCode: "XX", lat: 0, lng: 0 });
const OSL = airport("OSL", "Oslo");
const BCN = airport("BCN", "Barcelona");

/** Flyplassøk som svarer først når testen sier fra – så rekkefølgen styres helt. */
function controlledAirports() {
  const pending = new Map<string, { resolve: (a: Airport[]) => void; reject: (e: unknown) => void }>();
  const calls: string[] = [];
  const airports = jest.fn(
    (query: string) =>
      new Promise<Airport[]>((resolve, reject) => {
        calls.push(query);
        pending.set(query, { resolve, reject });
      }),
  );
  const factory: ApiFactory = () => ({ airports, search: jest.fn(), login: jest.fn(), register: jest.fn(), me: jest.fn(async () => null), logout: jest.fn() }) as unknown as ApiClient;
  const answer = async (query: string, result: Airport[] | Error) => {
    await waitFor(() => expect(pending.has(query)).toBe(true));
    const p = pending.get(query)!;
    pending.delete(query);
    if (result instanceof Error) p.reject(result);
    else p.resolve(result);
  };
  return { factory, calls, answer, airports };
}

/** Viser hva skjemaet fikk som destinasjon. */
function Destination() {
  const { form } = useApp();
  return <Text testID="chosen">{form.destination?.iata ?? "ingen"}</Text>;
}

async function renderPicker(factory: ApiFactory) {
  setParams({ felt: "til" });
  await render(
    <AppProvider apiFactory={factory}>
      <AirportPicker />
      <Destination />
    </AppProvider>,
  );
}

describe("flyplassøk: bare treff for det som står i feltet nå", () => {
  it("en rask endring skjuler forrige treff med én gang – de kan ikke velges mens det nye søket pågår", async () => {
    const api = controlledAirports();
    await renderPicker(api.factory);

    await fireEvent.changeText(screen.getByTestId("airport-query"), "osl");
    await api.answer("osl", [OSL]);
    await waitFor(() => expect(screen.getByTestId("airport-OSL")).toBeOnTheScreen());

    await fireEvent.changeText(screen.getByTestId("airport-query"), "bar");
    // Samme øyeblikk: Oslo er borte og kan ikke trykkes, og søket vises som pågående.
    expect(screen.queryByTestId("airport-OSL")).toBeNull();
    expect(screen.getByTestId("airport-loading")).toBeOnTheScreen();
    expect(screen.queryByText(/Ingen treff/)).toBeNull();

    await api.answer("bar", [BCN]);
    await waitFor(() => expect(screen.getByTestId("airport-BCN")).toBeOnTheScreen());
    expect(screen.queryByTestId("airport-loading")).toBeNull();
    await fireEvent.press(screen.getByTestId("airport-BCN"));
    expect(screen.getByTestId("chosen")).toHaveTextContent("BCN");
    expect(router.back).toHaveBeenCalled();
  });

  it("et sent svar på et gammelt søk vises aldri", async () => {
    const api = controlledAirports();
    await renderPicker(api.factory);

    await fireEvent.changeText(screen.getByTestId("airport-query"), "osl");
    await waitFor(() => expect(api.calls).toContain("osl"));
    await fireEvent.changeText(screen.getByTestId("airport-query"), "bar");
    await api.answer("bar", [BCN]);
    await waitFor(() => expect(screen.getByTestId("airport-BCN")).toBeOnTheScreen());

    await api.answer("osl", [OSL]); // kommer etter det nye svaret
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("airport-OSL")).toBeNull();
    expect(screen.getByTestId("airport-BCN")).toBeOnTheScreen();
  });

  it("en feil gjelder bare søket den kom fra", async () => {
    const api = controlledAirports();
    await renderPicker(api.factory);

    await fireEvent.changeText(screen.getByTestId("airport-query"), "xyz");
    await api.answer("xyz", new ApiError("For mange forespørsler. Prøv igjen.", "RATE_LIMITED", 429, true));
    await waitFor(() => expect(screen.getByTestId("airport-error")).toHaveTextContent("For mange forespørsler. Prøv igjen."));

    await fireEvent.changeText(screen.getByTestId("airport-query"), "osl");
    expect(screen.queryByTestId("airport-error")).toBeNull();
    expect(screen.getByTestId("airport-loading")).toBeOnTheScreen();
    await api.answer("osl", [OSL]);
    await waitFor(() => expect(screen.getByTestId("airport-OSL")).toBeOnTheScreen());
    expect(screen.queryByTestId("airport-error")).toBeNull();
  });

  it("mellomrom og store bokstaver gir samme søk – ingen nytt kall, treffene står", async () => {
    const api = controlledAirports();
    await renderPicker(api.factory);
    await fireEvent.changeText(screen.getByTestId("airport-query"), "bar");
    await api.answer("bar", [BCN]);
    await waitFor(() => expect(screen.getByTestId("airport-BCN")).toBeOnTheScreen());

    await fireEvent.changeText(screen.getByTestId("airport-query"), "  bar ");
    expect(screen.getByTestId("airport-BCN")).toBeOnTheScreen();
    expect(screen.queryByTestId("airport-loading")).toBeNull();
    await new Promise((r) => setTimeout(r, 400));
    expect(api.calls).toEqual(["bar"]);
  });

  it("under to tegn: ingen treff, ingen feil, ingen søk", async () => {
    const api = controlledAirports();
    await renderPicker(api.factory);
    await fireEvent.changeText(screen.getByTestId("airport-query"), "b");
    await new Promise((r) => setTimeout(r, 400));
    expect(api.calls).toEqual([]);
    expect(screen.queryByTestId("airport-loading")).toBeNull();
  });

  it("normalizeQuery", () => {
    expect(normalizeQuery("  New   York ")).toBe("New York");
  });
});

describe("resultatsiden uten søk", () => {
  it("viser en tom tilstand på bokmål med knapp til søket – ingen evig spinner", async () => {
    const api = controlledAirports();
    await render(
      <AppProvider apiFactory={api.factory}>
        <ResultsScreen />
      </AppProvider>,
    );
    expect(screen.getByTestId("results-empty")).toBeOnTheScreen();
    expect(screen.getByText("Ingen søk ennå")).toBeOnTheScreen();
    expect(screen.queryByTestId("results-loading")).toBeNull();
    await fireEvent.press(screen.getByTestId("start-search"));
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});
