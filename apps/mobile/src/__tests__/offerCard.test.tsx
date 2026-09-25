import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { Dimensions, StyleSheet } from "react-native";
import type { MobileOffer } from "@contracts/mobileSearch";
import type { CabinClass, OfferSlice, Segment } from "@contracts/types";
import type { Locale } from "../i18n/types";
import { I18nProvider } from "../i18n";
import { OfferCard } from "../components/OfferCard";
import { groupJourneys } from "../lib/journeys";
import { colors } from "../lib/theme";
import { NOK_OFFER } from "../test/fixtures";

// Resultatkortet: kompakt, men med alt som avgjør et valg – byttested, risiko (natt, flyplassbytte, lang ventetid),
// bagasje ved prisen, reiseklasse bare når den avviker – og hele kortet som én knapp.

const place = (iata: string, city: string) => ({ iata, name: `${city} lufthavn`, city, country: "", lat: 0, lng: 0 });
const seg = (id: string, from: [string, string], to: [string, string], dep: string, arr: string, minutes: number, carrier = { iata: "LH", name: "Lufthansa" }): Segment => ({
  id,
  origin: place(...from),
  destination: place(...to),
  departingAt: dep,
  arrivingAt: arr,
  durationMinutes: minutes,
  carrier,
  flightNumber: id.replace(/\D/g, "") || "1",
  aircraft: "",
  cabinClass: "economy",
});
const slice = (id: string, segments: Segment[], minutes: number): OfferSlice => ({
  id,
  origin: segments[0]!.origin,
  destination: segments[segments.length - 1]!.destination,
  departingAt: segments[0]!.departingAt,
  arrivingAt: segments[segments.length - 1]!.arrivingAt,
  durationMinutes: minutes,
  stops: segments.length - 1,
  segments,
});
const OSL: [string, string] = ["OSL", "Oslo"];
const BCN: [string, string] = ["BCN", "Barcelona"];
const MUC: [string, string] = ["MUC", "München"];
const LHR: [string, string] = ["LHR", "London"];
const LGW: [string, string] = ["LGW", "London"];

function item(id: string, slices: OfferSlice[], patch: Partial<MobileOffer["offer"]> = {}): MobileOffer {
  return { ...NOK_OFFER, offer: { ...NOK_OFFER.offer, id, slices, ...patch } };
}

/** Over natten i München både ut og hjem (8 t 55 min ventetid). */
const NIGHT = item("natt", [
  slice("u", [seg("u1", OSL, MUC, "2026-10-09T19:50:00", "2026-10-09T22:10:00", 140), seg("u2", MUC, BCN, "2026-10-10T07:05:00", "2026-10-10T09:05:00", 120)], 795),
  slice("h", [seg("h1", BCN, MUC, "2026-10-16T19:40:00", "2026-10-16T21:45:00", 125), seg("h2", MUC, OSL, "2026-10-17T06:40:00", "2026-10-17T09:00:00", 140)], 800),
]);
/** Flyplassbytte i London (LHR → LGW), og to selskaper. */
const CHANGE = item("bytte", [slice("u", [seg("b1", OSL, LHR, "2026-10-09T08:00:00", "2026-10-09T09:55:00", 115, { iata: "SK", name: "SAS" }), seg("b2", LGW, BCN, "2026-10-09T13:30:00", "2026-10-09T16:50:00", 140, { iata: "VY", name: "Vueling" })], 530)]);
/** Direkte, én vei. */
const DIRECT = item("direkte", [slice("d", [seg("d1", OSL, BCN, "2026-10-09T07:00:00", "2026-10-09T10:20:00", 200, { iata: "DY", name: "Norwegian" })], 200)]);

const baseWindow = Dimensions.get("window");
beforeAll(() => Dimensions.set({ window: baseWindow, screen: Dimensions.get("screen") }));
async function setFontScale(fontScale: number) {
  await act(async () => Dimensions.set({ window: { ...baseWindow, fontScale }, screen: { ...Dimensions.get("screen"), fontScale } }));
}
afterEach(async () => {
  if (Dimensions.get("window").fontScale !== baseWindow.fontScale) await setFontScale(baseWindow.fontScale);
});

async function renderCard(offer: MobileOffer, { searchedCabin = "economy", locale = "nb", onOpen = jest.fn() }: { searchedCabin?: CabinClass; locale?: Locale; onOpen?: jest.Mock } = {}) {
  const journey = groupJourneys([offer])[0]!;
  await render(
    <I18nProvider initialLocale={locale}>
      <OfferCard journey={journey} onOpen={onOpen} searchedCabin={searchedCabin} />
    </I18nProvider>,
  );
  return { card: screen.getByTestId(`offer-${offer.offer.id}`), onOpen };
}

describe("resultatkortet (vanlig tekststørrelse)", () => {
  beforeEach(() => setFontScale(1));

  it("byttestedet står ved mellomlandingen; bytte over natten nevnes én gang med ventetiden – «Begge veier» når hjemreisen har det samme", async () => {
    const { card } = await renderCard(NIGHT);
    const c = within(card);
    expect(c.getAllByText(/1 mellomlanding · MUC/)).toHaveLength(2);
    expect(within(screen.getByTestId("risks-natt")).getAllByText(/./).map((t) => t.props.children)).toEqual(["Begge veier: Bytte over natten i München (8 t 55 min)"]);
    // Risikoen er ord og ikon i advarselsfarge – aldri farge alene.
    expect(StyleSheet.flatten(c.getByText("Begge veier: Bytte over natten i München (8 t 55 min)").props.style).color).toBe(colors.warning);
    expect(card.props.accessibilityLabel).toContain("1 mellomlanding i München");
    expect(card.props.accessibilityLabel).toContain("Begge veier: Bytte over natten i München (8 t 55 min)");
  });

  it("tur-retur: en risiko bare på én vei sier hvilken («Hjem: …»)", async () => {
    const out = slice("u", [seg("x1", OSL, BCN, "2026-10-09T07:00:00", "2026-10-09T10:20:00", 200)], 200);
    const oneLeg = item("hjem", [out, NIGHT.offer.slices[1]!]);
    await renderCard(oneLeg);
    expect(within(screen.getByTestId("risks-hjem")).getAllByText(/./).map((t) => t.props.children)).toEqual(["Hjem: Bytte over natten i München (8 t 55 min)"]);
  });

  it("flyplassbytte står på kortet, og selskapene som flyr reisen står i rekkefølge", async () => {
    const { card } = await renderCard(CHANGE);
    const c = within(card);
    expect(c.getByText("Bytte av flyplass i London")).toBeOnTheScreen();
    expect(c.getByText("SAS · Vueling")).toBeOnTheScreen();
    // 3 t 35 min ventetid er ikke «lang» (under 6 t): ingen linje om det.
    expect(c.queryByText(/ventetid/)).toBeNull();
  });

  it("en vanlig direkterute har ingen risikolinje; «Direkte» er grønn tekst", async () => {
    const { card } = await renderCard(DIRECT);
    expect(screen.queryByTestId("risks-direkte")).toBeNull();
    const direct = within(card).getByText("Direkte");
    expect(StyleSheet.flatten(direct.props.style).color).toBe(colors.success);
  });

  it("reiseklassen står bare når den avviker fra søket", async () => {
    await renderCard(DIRECT);
    expect(screen.queryByText(/Økonomi/)).toBeNull();
    await renderCard({ ...DIRECT, offer: { ...DIRECT.offer, cabinClass: "business" } });
    expect(screen.getByText(/· Business/)).toBeOnTheScreen();
  });

  it("hele kortet er én knapp som åpner kortets tilbud; ingen egen «Detaljer»-knapp inni", async () => {
    const { card, onOpen } = await renderCard(DIRECT);
    expect(card.props.accessibilityRole).toBe("button");
    expect(within(card).queryByText("Detaljer")).toBeNull();
    await fireEvent.press(card);
    expect(onOpen).toHaveBeenCalledWith("direkte");
  });

  it("engelsk: «1 stop · MUC», og risikoen på engelsk", async () => {
    await renderCard(NIGHT, { locale: "en" });
    expect(screen.getAllByText(/1 stop · MUC/)).toHaveLength(2);
    expect(screen.getByText("Both ways: Overnight connection in München (8h 55m)")).toBeOnTheScreen();
  });
});

describe("resultatkortet med stor tekst", () => {
  it("strekningen står under hverandre, venstrestilt, med byttested – ingenting kuttes", async () => {
    await setFontScale(1.6);
    const { card } = await renderCard(NIGHT);
    expect(within(card).getAllByText(/OSL → BCN · 13 t 15 min · 1 mellomlanding · MUC/)).toHaveLength(1);
    for (const el of within(card).getAllByText(/./)) expect(el.props.numberOfLines).toBeUndefined();
  });
});
