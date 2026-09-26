import type { ReactNode } from "react";
import { View } from "react-native";
import { render, screen, waitFor } from "@testing-library/react-native";
import { AppProvider, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { FocusStatusBar } from "../components/FocusStatusBar";
import HomeScreen from "../app/(tabs)/index";
import AccountScreen from "../app/(tabs)/profil";

// Statuslinjen følger fanen som vises. Fanene står montert side om side, og React Native lar den sist monterte
// StatusBar vinne i hele appen: uten dette sto Hjem med hvit klokke på lys grunn etter et besøk på Min side.

// StatusBar tegnes som en markør med stilen, så testen ser hvilken som er montert.
jest.mock("expo-status-bar", () => {
  const { View: MockView } = jest.requireActual("react-native");
  return { StatusBar: ({ style }: { style: string }) => <MockView testID={`status-bar-${style}`} /> };
});

const setFocused = (globalThis as unknown as { __setFocused: (f: boolean) => void }).__setFocused;

async function renderIn(children: ReactNode) {
  const server = fakeServer({ "mobileAuth.me": () => ({ data: null }) });
  const factory: ApiFactory = (getToken) => createApiClient({ baseUrl: "https://api.hellosky.test", getToken, fetchImpl: server.fetchImpl });
  await render(
    <AppProvider initialLocale="nb" apiFactory={factory}>
      {children}
    </AppProvider>,
  );
}

describe("statuslinjen følger fanen som vises", () => {
  it("bare fanen som vises, har sin StatusBar montert", async () => {
    await render(<FocusStatusBar style="light" />);
    expect(screen.getByTestId("status-bar-light")).toBeOnTheScreen();
    setFocused(false);
    await render(
      <View>
        <FocusStatusBar style="light" />
      </View>,
    );
    expect(screen.queryByTestId("status-bar-light")).toBeNull();
  });

  it("Hjem ber om mørk tekst (lys grunn), Min side om lys tekst (grafitten øverst)", async () => {
    await renderIn(<HomeScreen />);
    expect(screen.getByTestId("status-bar-dark")).toBeOnTheScreen();
    expect(screen.queryByTestId("status-bar-light")).toBeNull();
    await renderIn(<AccountScreen />);
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    expect(screen.getByTestId("status-bar-light")).toBeOnTheScreen();
  });

  it("en fane i bakgrunnen (Min side etter et besøk) har ingen StatusBar som kan overstyre fanen som vises", async () => {
    setFocused(false);
    await renderIn(<AccountScreen />);
    await waitFor(() => expect(screen.getByTestId("account-signed-out")).toBeOnTheScreen());
    expect(screen.queryByTestId("status-bar-light")).toBeNull();
    expect(screen.queryByTestId("status-bar-dark")).toBeNull();
  });
});
