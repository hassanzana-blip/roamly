import { useEffect, type ReactNode } from "react";
import { Text } from "react-native";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { readPref, writePref } from "../lib/localStore";
import { fakeServer } from "../test/fakeServer";
import { SEARCH_RESULT } from "../test/fixtures";
import { initialForm } from "../lib/searchForm";
import SearchScreen from "../app/(tabs)/index";
import AirportPicker from "../app/flyplass";

// Nylige søk og vanlig avreiseflyplass: bare på telefonen, alltid under kundens kontroll.

const router = (globalThis as unknown as { __router: { push: jest.Mock; back: jest.Mock } }).__router;
const setParams = (globalThis as unknown as { __setParams: (p: Record<string, string>) => void }).__setParams;
const OSL = { iata: "OSL", name: "Oslo lufthavn Gardermoen", city: "Oslo", country: "Norway" };
const BGO = { iata: "BGO", name: "Bergen lufthavn Flesland", city: "Bergen", country: "Norway" };
const BCN = { iata: "BCN", name: "Barcelona-El Prat", city: "Barcelona", country: "Spain" };
const LHR = { iata: "LHR", name: "London Heathrow", city: "London", country: "United Kingdom" };
const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

function setup() {
  const server = fakeServer({ "flights.search": () => ({ data: SEARCH_RESULT }), "mobileAuth.me": () => ({ data: null }) });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  return { server, factory };
}

function Origin() {
  return <Text testID="origin">{useApp().form.origin?.iata ?? "none"}</Text>;
}

describe("nylige søk på forsiden", () => {
  it("et kjørt søk huskes (uten konto- eller prisdata), og ett trykk søker på nytt", async () => {
    const { server, factory } = setup();
    function SearchNow({ children }: { children: ReactNode }) {
      const { runSearch } = useApp();
      useEffect(() => {
        runSearch({ destination: BCN, departDate: future(20), returnDate: future(27) });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <>{children}</>;
    }
    await render(
      <AppProvider apiFactory={factory}>
        <SearchNow>
          <SearchScreen />
        </SearchNow>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("recent-OSL-BCN")).toBeOnTheScreen());
    const stored = JSON.stringify(readPref("recent", (v) => v));
    expect(stored).toContain('"BCN"');
    expect(stored).not.toMatch(/token|email|price|offer|firstName/i);

    await fireEvent.press(screen.getByTestId("recent-OSL-BCN"));
    expect(router.push).toHaveBeenCalledWith("/resultater");
    await waitFor(() => expect(server.calls.filter((c) => c.path === "flights.search")).toHaveLength(2));
  });

  it("hvert søk kan fjernes, eller alle på én gang", async () => {
    writePref("recent", [
      { ...initialForm(), origin: OSL, destination: BCN, departDate: future(10), returnDate: future(17) },
      { ...initialForm(), origin: BGO, destination: LHR, departDate: future(30), returnDate: future(37) },
    ]);
    const { factory } = setup();
    await render(
      <AppProvider apiFactory={factory}>
        <SearchScreen />
      </AppProvider>,
    );
    const list = within(screen.getByTestId("recent-searches"));
    expect(list.getByText("Oslo → Barcelona")).toBeOnTheScreen();
    expect(list.getByText("Bergen → London")).toBeOnTheScreen();
    expect(screen.getByText("Lagres bare på denne telefonen.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("recent-remove-OSL-BCN"));
    expect(screen.queryByTestId("recent-OSL-BCN")).toBeNull();
    expect(screen.getByTestId("recent-BGO-LHR")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("recent-clear"));
    expect(screen.queryByTestId("recent-searches")).toBeNull();
    expect(readPref("recent", (v) => v)).toBeNull();
  });
});

describe("flyplassvelgeren før man skriver", () => {
  it("«Fra»: nylige og Norges hovedflyplasser; vanlig avreiseflyplass huskes bare når bryteren er på", async () => {
    writePref("recent", [{ ...initialForm(), origin: BGO, destination: LHR, departDate: future(30), returnDate: future(37) }]);
    const { factory } = setup();
    setParams({ felt: "fra" });
    await render(
      <AppProvider apiFactory={factory}>
        <AirportPicker />
        <Origin />
      </AppProvider>,
    );
    expect(within(screen.getByTestId("airport-recent")).getByTestId("airport-BGO")).toBeOnTheScreen();
    const suggestions = within(screen.getByTestId("airport-suggestions"));
    expect(suggestions.getByText("Trondheim")).toBeOnTheScreen();
    expect(suggestions.queryByTestId("airport-BGO")).toBeNull(); // står allerede under «Recent»

    // Uten bryteren: skjemaet endres, men ingenting huskes.
    await fireEvent.press(screen.getAllByTestId("airport-TRD")[0]!);
    expect(screen.getByTestId("origin")).toHaveTextContent("TRD");
    expect(readPref("homeAirport", (v) => v)).toBeNull();

    // Med bryteren: huskes, og vises med «Glem».
    await fireEvent(screen.getByTestId("remember-home-airport"), "valueChange", true);
    await fireEvent.press(screen.getAllByTestId("airport-BGO")[0]!);
    expect(readPref("homeAirport", (v) => (v as { iata: string }).iata)).toBe("BGO");
    expect(screen.getByTestId("home-airport")).toHaveTextContent(/^Vanlig avreiseflyplass: Bergen \(BGO\)Glem$/);
    await fireEvent.press(screen.getByTestId("forget-home-airport"));
    expect(readPref("homeAirport", (v) => v)).toBeNull();
  });

  it("et nytt skjema (uten utkast) starter fra den vanlige avreiseflyplassen", async () => {
    writePref("homeAirport", BGO);
    const { factory } = setup();
    await render(
      <AppProvider apiFactory={factory}>
        <Origin />
      </AppProvider>,
    );
    expect(screen.getByTestId("origin")).toHaveTextContent("BGO");
  });

  it("«Til»: appens reisemål som forslag; ingen treff gir en knapp for å tømme søket", async () => {
    const { factory } = setup();
    setParams({ felt: "til" });
    await render(
      <AppProvider apiFactory={factory}>
        <AirportPicker />
      </AppProvider>,
    );
    expect(within(screen.getByTestId("airport-suggestions")).getByTestId("airport-BCN")).toBeOnTheScreen();
    expect(screen.queryByTestId("remember-home-airport")).toBeNull();
  });
});
