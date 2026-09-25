import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Text } from "react-native";
import type { Airport } from "@contracts/airports";
import { AppProvider, useApp, type ApiFactory } from "../lib/appState";
import { ApiError, type ApiClient } from "../lib/api";
import type { Locale } from "../i18n/types";
import AirportPicker from "../app/flyplass";

// Flyplassvelgeren: registerets treff med én gang (også engelske navn), serverens treff under når de kommer,
// det kunden skrev uthevet, og Torp som egen rad under Oslo.

const setParams = (globalThis as unknown as { __setParams: (p: Record<string, string>) => void }).__setParams;

const world = (iata: string, city: string, country = "Storbritannia", countryCode = "GB"): Airport => ({ iata, name: `${city} Airport`, city, country, countryCode, lat: 0, lng: 0, world: true });

/** Serveren svarer først når testen sier fra. */
function controlledAirports() {
  const pending = new Map<string, { resolve: (a: Airport[]) => void; reject: (e: unknown) => void }>();
  const airports = jest.fn(
    (query: string) =>
      new Promise<Airport[]>((resolve, reject) => {
        pending.set(query, { resolve, reject });
      }),
  );
  const factory: ApiFactory = () => ({ airports, search: jest.fn(), login: jest.fn(), register: jest.fn(), me: jest.fn(async () => null), logout: jest.fn() }) as unknown as ApiClient;
  const answer = async (query: string, result: Airport[] | Error) => {
    await waitFor(() => expect(pending.has(query)).toBe(true));
    const p = pending.get(query)!;
    pending.delete(query);
    await act(async () => {
      if (result instanceof Error) p.reject(result);
      else p.resolve(result);
    });
  };
  return { factory, answer, airports };
}

function Chosen() {
  const { form } = useApp();
  const o = form.origin;
  return <Text testID="chosen">{o ? `${o.iata}|${o.city}|${o.name}|${o.country}` : "-"}</Text>;
}

async function renderPicker(locale: Locale = "nb") {
  const api = controlledAirports();
  setParams({ felt: "fra" });
  await render(
    <AppProvider initialLocale={locale} apiFactory={api.factory}>
      <AirportPicker />
      <Chosen />
    </AppProvider>,
  );
  return api;
}

const type = (text: string) => fireEvent.changeText(screen.getByTestId("airport-query"), text);
const order = () => screen.getAllByTestId(/^airport-[A-Z]{3}$/).map((el) => el.props.testID.slice(8));

describe("treff med én gang", () => {
  it("«copenhagen» viser København (Copenhagen) før serveren svarer; «ser etter flere» står under", async () => {
    await renderPicker();
    await type("copenhagen");
    expect(screen.getByTestId("airport-CPH")).toBeOnTheScreen();
    expect(screen.getByTestId("airport-CPH")).toHaveProp("accessibilityLabel", "København (Copenhagen), København lufthavn Kastrup, Danmark, kode CPH");
    const city = screen.getByTestId("airport-CPH-city");
    expect(city).toHaveTextContent("København (Copenhagen)");
    expect(within(city).getByText("Copenhagen")).toHaveStyle({ fontWeight: "600" });
    expect(within(screen.getByTestId("airport-list")).getByText("Ser etter flere flyplasser …")).toBeOnTheScreen();
    expect(screen.getByTestId("airport-loading")).toBeOnTheScreen();
  });

  it("serverens treff kommer under registerets – radene over flytter seg ikke", async () => {
    const api = await renderPicker();
    await type("london");
    expect(order()).toEqual(["LHR", "LGW", "STN"]);
    await api.answer("london", [world("LHR", "London"), world("LCY", "London"), world("LTN", "Luton")]);
    expect(order()).toEqual(["LHR", "LGW", "STN", "LCY", "LTN"]);
    expect(screen.queryByTestId("airport-loading")).toBeNull();
  });

  it("serveren feiler: treffene står og kan velges; beskjeden står under, ikke som feil over listen", async () => {
    const api = await renderPicker();
    await type("tromso");
    await api.answer("tromso", new ApiError("For mange forespørsler. Prøv igjen.", "RATE_LIMITED", 429, true));
    expect(screen.queryByTestId("airport-error")).toBeNull();
    expect(screen.getByTestId("airport-more-error")).toHaveTextContent("Fikk ikke hentet flere flyplasser. For mange forespørsler. Prøv igjen.");
    await fireEvent.press(screen.getByTestId("airport-TOS"));
    expect(screen.getByTestId("chosen")).toHaveTextContent("TOS|Tromsø|Tromsø lufthavn|Norge");
  });
});

describe("det kunden skrev er uthevet", () => {
  it("«tromso» uthever hele «Tromsø»; resten av raden er vanlig tekst", async () => {
    await renderPicker();
    await type("tromso");
    const city = screen.getByTestId("airport-TOS-city");
    const mark = within(city).getByText("Tromsø");
    expect(mark).not.toBe(city);
    expect(mark).toHaveStyle({ fontWeight: "600" });
    expect(city).toHaveStyle({ fontWeight: "400" });
  });

  it("treff i flyplassnavnet: «gar» uthever «Gar» i Gardermoen", async () => {
    await renderPicker();
    await type("gar");
    const detail = screen.getByTestId("airport-OSL-detail");
    expect(within(detail).getByText("Gar")).toHaveStyle({ fontWeight: "600" });
    expect(detail).toHaveTextContent("Oslo lufthavn Gardermoen, Norge");
  });

  it("nøyaktig kode: koden står invertert; ellers ikke", async () => {
    await renderPicker();
    await type("bcn");
    expect(screen.getByTestId("airport-BCN-code-hit")).toBeOnTheScreen();
    await type("barcelona");
    expect(screen.getByTestId("airport-BCN")).toBeOnTheScreen();
    expect(screen.queryByTestId("airport-BCN-code-hit")).toBeNull();
  });

  it("før kunden skriver: forslagene er som før, uten utheving; Torp er med blant Norges flyplasser", async () => {
    await renderPicker();
    const suggestions = screen.getByTestId("airport-suggestions");
    expect(within(suggestions).getByTestId("airport-TRF")).toBeOnTheScreen();
    expect(within(suggestions).queryByTestId("airport-OSL-city")).toBeNull();
  });
});

describe("Torp under Oslo", () => {
  it("egen rad rett under OSL, merket «Annen flyplass nær Oslo», også for VoiceOver; velges som TRF", async () => {
    await renderPicker();
    await type("Oslo");
    expect(order()).toEqual(["OSL", "TRF"]);
    expect(screen.getByTestId("airport-TRF-near")).toHaveTextContent("Annen flyplass nær Oslo");
    expect(screen.getByTestId("airport-TRF")).toHaveProp("accessibilityLabel", "Sandefjord, Sandefjord lufthavn Torp, Norge, kode TRF. Annen flyplass nær Oslo");
    expect(screen.queryByTestId("airport-OSL-near")).toBeNull();
    await fireEvent.press(screen.getByTestId("airport-TRF"));
    expect(screen.getByTestId("chosen")).toHaveTextContent("TRF|Sandefjord|Sandefjord lufthavn Torp|Norge");
  });

  it("den som skriver «OSL», får bare OSL fra registeret", async () => {
    await renderPicker();
    await type("OSL");
    expect(order()).toEqual(["OSL"]);
  });
});

describe("engelsk", () => {
  it("raden og skjemaet får engelske navn: Copenhagen, Denmark", async () => {
    await renderPicker("en");
    await type("copenhagen");
    const city = screen.getByTestId("airport-CPH-city");
    expect(within(city).getByText("Copenhagen")).toHaveStyle({ fontWeight: "600" });
    expect(screen.getByTestId("airport-CPH-detail")).toHaveTextContent("Copenhagen Kastrup, Denmark");
    expect(screen.getByText("Looking for more airports …")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("airport-CPH"));
    expect(screen.getByTestId("chosen")).toHaveTextContent("CPH|Copenhagen|Copenhagen Kastrup|Denmark");
  });

  it("Torp under Oslo på engelsk", async () => {
    await renderPicker("en");
    await type("oslo");
    expect(screen.getByTestId("airport-TRF-near")).toHaveTextContent("Another airport near Oslo");
    expect(screen.getByTestId("airport-TRF-detail")).toHaveTextContent("Sandefjord lufthavn Torp, Norway");
  });
});
