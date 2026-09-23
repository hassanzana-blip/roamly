import { useEffect, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { createApiClient } from "../lib/api";
import { colors } from "../lib/theme";
import { fakeServer } from "../test/fakeServer";
import { SAME_TRIP_OTHER_SELLER, SEARCH_RESULT, SEK_OFFER } from "../test/fixtures";
import SearchScreen from "../app/(tabs)/index";
import ResultsScreen from "../app/resultater";
import OfferScreen from "../app/tilbud/[id]";

// Kjerneflyten på små skjermer: det som må stå i første bilde, ekte trykkflater
// på 44 pt, og at det siste innholdet alltid kan rulles fram over faste linjer.

const setParams = (globalThis as unknown as { __setParams: (p: Record<string, string>) => void }).__setParams;
const BCN = { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spania" };

function setup(result = SEARCH_RESULT) {
  const server = fakeServer({ "flights.search": () => ({ data: result }), "flights.trackProviderClick": () => ({ data: { clickRef: null } }) });
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

/** Tekst og testID-er i den rekkefølgen de står på skjermen (dybde først). */
function screenOrder(): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (node == null) return;
    if (typeof node === "string") return void out.push(node);
    if (Array.isArray(node)) return node.forEach(walk);
    const n = node as { props?: { testID?: string }; children?: unknown };
    if (n.props?.testID) out.push(`#${n.props.testID}`);
    walk(n.children);
  };
  walk(screen.toJSON());
  return out;
}

const layout = (height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width: 375, height } } });

describe("Hjem: kompakt søk", () => {
  it("én kort gjestelinje ved knappen, reisemålene før forklaringen, og tomt reisemål i vanlig mørk tekst", async () => {
    const { factory } = setup();
    await render(
      <AppProvider apiFactory={factory}>
        <SearchScreen />
      </AppProvider>,
    );
    const order = screenOrder();
    const at = (x: string | RegExp) => order.findIndex((s) => (typeof x === "string" ? s === x : x.test(s)));
    const button = at("#search-button");
    const guest = at("Du trenger ikke logge inn for å søke.");
    const firstCard = at(/^#destination-/);
    const how = at("#how-it-works-home");
    expect(button).toBeGreaterThan(-1);
    expect([button < guest, guest < firstCard, firstCard < how]).toEqual([true, true, true]);

    const empty = within(screen.getByTestId("destination")).getByText("Velg");
    expect(StyleSheet.flatten(empty.props.style).color).toBe(colors.text);
    expect(StyleSheet.flatten(empty.props.style).color).not.toBe(colors.blue);
  });
});

describe("Resultater: ekte trykkflater og plass nederst", () => {
  async function renderResults() {
    const s = setup({ ...SEARCH_RESULT, provider: "demo", sandbox: true });
    await render(
      <AppProvider initialLocale="nb" apiFactory={s.factory} initial={{ destination: BCN }}>
        <SearchOnMount>
          <ResultsScreen />
        </SearchOnMount>
      </AppProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("results-list")).toBeOnTheScreen());
    return s;
  }

  it("«Om «ca.»-priser» er en rad på minst 44 pt uten hitSlop over naboene; demolinjen står", async () => {
    await renderResults();
    const fx = screen.getByTestId("fx-notice");
    expect(StyleSheet.flatten(fx.props.style).minHeight).toBeGreaterThanOrEqual(44);
    expect(fx.props.hitSlop).toBeUndefined();
    expect(fx.props.accessibilityRole).toBe("button");
    expect(screen.getByTestId("sandbox-banner")).toHaveTextContent("Demo: testdata, ikke ekte fly eller priser.");
    // Sorteringen står som tekst; den endres med «Sorter» i den flytende linjen.
    expect(screen.getByTestId("sort-summary")).toHaveTextContent("Laveste pris først");
    expect(screen.queryByTestId("open-sort")).toBeNull();
    expect(screen.getByTestId("open-sort-toolbar")).toBeOnTheScreen();
  });

  it("filterbrikkene når 44 pt med hitSlop, og hele trykkflaten ligger inne i det klippende rullefeltet", async () => {
    await renderResults();
    const chip = screen.getByTestId("chip-all");
    const slop = chip.props.hitSlop as number;
    const height = StyleSheet.flatten(chip.props.style).minHeight as number;
    expect(height + 2 * slop).toBeGreaterThanOrEqual(44);
    const row = StyleSheet.flatten(screen.getByTestId("results-chips").props.contentContainerStyle);
    expect(row.paddingTop).toBeGreaterThanOrEqual(slop);
    expect(row.paddingBottom).toBeGreaterThanOrEqual(slop);
  });

  it("listen slutter under den flytende linjen, uansett hvor høy linjen blir (stor tekst)", async () => {
    await renderResults();
    const padding = () => StyleSheet.flatten(screen.getByTestId("results-list").props.contentContainerStyle).paddingBottom as number;
    await fireEvent(screen.getByTestId("results-toolbar"), "layout", layout(58));
    const normal = padding();
    await fireEvent(screen.getByTestId("results-toolbar"), "layout", layout(120));
    expect(padding()).toBe(normal + 62);
    expect(padding()).toBeGreaterThan(120);
  });
});

describe("Flydetaljer: kompakt bunnlinje", () => {
  async function renderOffer(id: string, offers = SEARCH_RESULT.offers) {
    const { factory } = setup({ ...SEARCH_RESULT, offers });
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

  it("pris og grunnlag, en tydelig handling og valgt tilbyder ved siden av – uten linjegrenser som kan kutte", async () => {
    await renderOffer("sek_1");
    const bar = within(screen.getByTestId("offer-bar"));
    expect(bar.getByText("Totalt for 1 voksen · Tur-retur")).toBeOnTheScreen();
    expect(bar.getByText("Gå til tilbud")).toBeOnTheScreen();
    expect(screen.getByTestId("handoff-button").props.accessibilityLabel).toBe("Gå til tilbud hos SAS");
    expect(screen.getByTestId("handoff-note")).toHaveTextContent("SAS · Bestillingen fullføres hos tilbyderen.");
    // Stor tekst og lange navn skal bryte linjen, ikke kuttes.
    for (const el of bar.getAllByText(/./)) expect(el.props.numberOfLines).toBeUndefined();
  });

  it("det siste kortet kan rulles helt fram over bunnlinjen, også når den blir høy", async () => {
    await renderOffer("sek_1");
    const padding = () => StyleSheet.flatten(screen.getByTestId("offer-screen").props.contentContainerStyle).paddingBottom as number;
    await fireEvent(screen.getByTestId("offer-bar"), "layout", layout(131));
    expect(padding()).toBeGreaterThan(131);
    await fireEvent(screen.getByTestId("offer-bar"), "layout", layout(260));
    expect(padding()).toBeGreaterThan(260);
  });

  it("gruppert reise: selgerne før den felles reiseinformasjonen, og et bytte flytter pris, bagasje og handling sammen", async () => {
    await renderOffer("sek_1", [SEK_OFFER, SAME_TRIP_OTHER_SELLER]);
    const order = screenOrder();
    expect(order.indexOf("#sellers")).toBeLessThan(order.indexOf("Reiseinformasjon"));
    const before = screen.getByTestId("handoff-button").props.accessibilityLabel as string;
    await fireEvent.press(screen.getByTestId("seller-gtg_1"));
    expect(screen.getByTestId("handoff-button").props.accessibilityLabel).not.toBe(before);
    expect(screen.getByTestId("bar-provider")).toHaveTextContent("Gotogate ·");
    expect(within(screen.getByTestId("bar-price")).getByText(/^1\s390\skr$/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("tab-baggage"));
    expect(screen.getByTestId("bag-checked")).toHaveTextContent(/Innsjekket bagasje.*Inkludert/);
  });
});
