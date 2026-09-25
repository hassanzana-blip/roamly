import { useEffect, type ReactNode } from "react";
import { AccessibilityInfo, Animated } from "react-native";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import ResultsScreen from "../app/resultater";

// Mens søket pågår: søket står i toppen, en statuslinje sier hva som skjer, og plassholderkort i resultatenes form
// holder plassen – uten et eneste tall. «Stopp søket» avbryter. Med «Reduser bevegelse» pulserer ingenting.

const BCN = { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spania" };
const router = (globalThis as unknown as { __router: { back: jest.Mock } }).__router;

function SearchOnMount({ children }: { children: ReactNode }) {
  const { runSearch } = useApp();
  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

/** Et søk som aldri svarer (til det avbrytes). */
function hangingSearch() {
  const state = { aborted: false };
  const factory: ApiFactory = (getToken) =>
    createApiClient({
      baseUrl: "https://api.hellosky.test",
      getToken,
      fetchImpl: ((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            state.aborted = true;
            reject(new Error("aborted"));
          });
        })) as unknown as typeof fetch,
    });
  return { factory, state };
}

async function renderLoading() {
  const s = hangingSearch();
  await render(
    <AppProvider initialLocale="nb" apiFactory={s.factory} initial={{ destination: BCN, departDate: "2026-10-23", returnDate: "2026-10-30" }}>
      <SearchOnMount>
        <ResultsScreen />
      </SearchOnMount>
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("results-loading")).toBeOnTheScreen());
  return s;
}

afterEach(() => jest.restoreAllMocks());

describe("søket pågår", () => {
  it("søket står i toppen; statuslinjen leses opp; plassholderkortene er skjult for VoiceOver og har ingen tall", async () => {
    await renderLoading();
    expect(screen.getByText("Oslo → Barcelona")).toBeOnTheScreen();
    const status = screen.getByRole("progressbar");
    expect(status.props.accessibilityLabel).toBe("Vi sammenligner priser … Vi henter tilbudene og samler like reiser, så du ser hver reise én gang.");
    const cards = screen.getByTestId("results-loading-cards", { includeHiddenElements: true });
    expect(cards.props.accessibilityElementsHidden).toBe(true);
    expect(cards.props.importantForAccessibility).toBe("no-hide-descendants");
    // Ingen tekst i plassholderne: ingen priser, tider eller selskaper før svaret er her.
    expect(within(cards).queryAllByText(/./, { includeHiddenElements: true })).toHaveLength(0);
  });

  it("etter 8 sekunder: beskjed om at noen tilbydere bruker lenger tid", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate", "performance"] });
    try {
      await renderLoading();
      expect(screen.getByTestId("results-loading-body")).toHaveTextContent("Vi henter tilbudene og samler like reiser, så du ser hver reise én gang.");
      await act(async () => jest.advanceTimersByTime(8_100));
      expect(screen.getByTestId("results-loading-body")).toHaveTextContent("Noen tilbydere bruker lenger tid enn vanlig. Vi venter på svarene deres.");
    } finally {
      jest.useRealTimers();
    }
  });

  it("«Stopp søket» avbryter forespørselen og går tilbake", async () => {
    const s = await renderLoading();
    await fireEvent.press(screen.getByTestId("cancel-search"));
    expect(s.state.aborted).toBe(true);
    expect(router.back).toHaveBeenCalled();
  });

  it("«Reduser bevegelse»: plassholderne pulserer ikke", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    // Hver puls som startes, registreres; når innstillingen er lest, skal hver av dem være stoppet.
    const stops: jest.Mock[] = [];
    const realLoop = Animated.loop;
    jest.spyOn(Animated, "loop").mockImplementation((animation, config) => {
      const l = realLoop(animation, config);
      const stop = jest.fn(() => l.stop());
      stops.push(stop);
      return { ...l, stop };
    });
    await renderLoading();
    await waitFor(() => expect(stops.every((stop) => stop.mock.calls.length > 0)).toBe(true));
    const cards = screen.getByTestId("results-loading-cards", { includeHiddenElements: true });
    const opacity = cards.props.style.opacity as number | { __getValue: () => number };
    expect(typeof opacity === "number" ? opacity : opacity.__getValue()).toBe(1);
  });
});
