import { useEffect, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { AppProvider, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { fakeServer } from "../test/fakeServer";
import { FocusStatusBar } from "../components/FocusStatusBar";
import { SignInSheet } from "../components/SignInSheet";
import HomeScreen from "../app/(tabs)/index";
import AccountScreen from "../app/(tabs)/profil";
import AirportPicker from "../app/flyplass";

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

  it("fokuset skifter på en fane som står montert: uten fokus forsvinner StatusBar, med fokus kommer den tilbake", async () => {
    // Fanen monteres én gang og blir stående, som i fanemenyen; bare fokuset endres mellom tegningene.
    let mounts = 0;
    function Tab() {
      useEffect(() => {
        mounts++;
      }, []);
      return (
        <View testID="tab">
          <FocusStatusBar style="dark" />
        </View>
      );
    }
    await render(<Tab />);
    expect(screen.getByTestId("status-bar-dark")).toBeOnTheScreen();
    setFocused(false);
    await screen.rerender(<Tab />);
    expect(screen.queryByTestId("status-bar-dark")).toBeNull();
    expect(screen.getByTestId("tab")).toBeOnTheScreen();
    setFocused(true);
    await screen.rerender(<Tab />);
    expect(screen.getByTestId("status-bar-dark")).toBeOnTheScreen();
    // Samme fane hele tiden – aldri montert på nytt.
    expect(mounts).toBe(1);
  });
});

// Sidekort (flyplassøket, innloggingsarket) legges over iOS' svarte bakgrunn. Appen styrer statuslinjen selv
// (UIViewControllerBasedStatusBarAppearance er av), så uten en egen StatusBar sto fanens stil der – ofte mørk på svart.
describe("statuslinjen over sidekort", () => {
  it("flyplassøket har lys tekst i statuslinjen", async () => {
    await renderIn(<AirportPicker />);
    expect(screen.getByTestId("status-bar-light")).toBeOnTheScreen();
    expect(screen.queryByTestId("status-bar-dark")).toBeNull();
  });

  it("innloggingsarket har lys tekst i statuslinjen mens det vises – og ingen når det er lukket", async () => {
    function SheetHost() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Text testID="open-sheet" onPress={() => setOpen(true)}>
            Åpne
          </Text>
          <SignInSheet visible={open} initialMode="login" onClose={() => setOpen(false)} />
        </>
      );
    }
    await renderIn(<SheetHost />);
    expect(screen.queryByTestId("status-bar-light")).toBeNull();
    await fireEvent.press(screen.getByTestId("open-sheet"));
    await waitFor(() => expect(screen.getByTestId("auth-modal")).toBeOnTheScreen());
    expect(within(screen.getByTestId("auth-modal")).getByTestId("status-bar-light")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("auth-close"));
    expect(screen.queryByTestId("auth-modal")).toBeNull();
    expect(screen.queryByTestId("status-bar-light")).toBeNull();
  });
});
