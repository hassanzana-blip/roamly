import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, StyleSheet, Text } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { SEARCH_RESULT } from "../test/fixtures";
import { BottomSheet, SecondaryButton, Stepper } from "../components/ui";
import { I18nProvider } from "../i18n";
import ResultsScreen from "../app/resultater";
import { TOUCH } from "../lib/theme";
import { useReducedMotion } from "../lib/motion";

// Tilgjengelighet: VoiceOver-rekkefølge og -handlinger, trykkflater og redusert bevegelse.

const BCN = { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spain" };

function StepperHarness() {
  const [n, setN] = useState(1);
  return <Stepper label="Adults" value={n} min={1} max={3} onChange={setN} />;
}

describe("tilgjengelighet", () => {
  it("antall reisende er én justerbar kontroll med verdi, som VoiceOver kan sveipe opp og ned", async () => {
    await render(
      <I18nProvider initialLocale="en">
        <StepperHarness />
      </I18nProvider>,
    );
    const stepper = screen.getByTestId("stepper-Adults");
    expect(stepper.props.accessibilityRole).toBe("adjustable");
    expect(stepper.props.accessibilityValue).toMatchObject({ min: 1, max: 3, now: 1 });
    await fireEvent(stepper, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    await fireEvent(stepper, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    await fireEvent(stepper, "accessibilityAction", { nativeEvent: { actionName: "increment" } }); // over maks: ingen endring
    expect(screen.getByTestId("stepper-Adults").props.accessibilityValue).toMatchObject({ now: 3 });
    await fireEvent(screen.getByTestId("stepper-Adults"), "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
    expect(screen.getByTestId("stepper-Adults").props.accessibilityValue).toMatchObject({ now: 2 });
  });

  it("arket er modalt for VoiceOver, og escape-gesten lukker det", async () => {
    const onClose = jest.fn();
    await render(
      <I18nProvider initialLocale="en">
        <BottomSheet visible title="Filter" onClose={onClose} testID="sheet">
          {null}
        </BottomSheet>
      </I18nProvider>,
    );
    const sheet = screen.getByTestId("sheet");
    expect(sheet.props.accessibilityViewIsModal).toBe(true);
    await act(async () => sheet.props.onAccessibilityEscape());
    expect(onClose).toHaveBeenCalled();
  });

  it("redusert bevegelse: kroken følger iOS-innstillingen (ark tones inn, bilder uten overgang)", async () => {
    // Forhåndsoppsettets egen mock: én verdi for dette kallet (spyOn + mockRestore ville tømt den for senere tester).
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValueOnce(true);
    function Show() {
      return <Text testID="motion">{String(useReducedMotion())}</Text>;
    }
    await render(<Show />);
    await waitFor(() => expect(screen.getByTestId("motion")).toHaveTextContent("true"));
  });

  it("sekundærknapper har minst 44 pt trykkflate", async () => {
    await render(<SecondaryButton label="Clear filters" onPress={() => undefined} testID="secondary" />);
    const style = StyleSheet.flatten(screen.getByTestId("secondary").props.style) as { minHeight?: number };
    expect(style.minHeight).toBeGreaterThanOrEqual(TOUCH);
  });

  it("når søket er ferdig, sier VoiceOver hvor mange reiser som ble funnet", async () => {
    const announce = AccessibilityInfo.announceForAccessibility as jest.Mock;
    announce.mockClear();
    const server = fakeServer({ "flights.search": () => ({ data: SEARCH_RESULT }) });
    const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
    function SearchOnMount({ children }: { children: ReactNode }) {
      const { runSearch } = useApp();
      useEffect(() => {
        runSearch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <>{children}</>;
    }
    await render(
      <AppProvider apiFactory={factory} initial={{ destination: BCN }}>
        <SearchOnMount>
          <ResultsScreen />
        </SearchOnMount>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
    expect(announce).toHaveBeenCalledWith("5 journeys found");
  });
});
