import type { Offer } from "@contracts/types";
import { webSearchUrl } from "../webLinks";
import { SEK_OFFER } from "../../test/fixtures";

const base = SEK_OFFER.offer;
const slice = (from: string, to: string, at: string) => ({ ...base.slices[0]!, origin: { ...base.slices[0]!.origin, iata: from }, destination: { ...base.slices[0]!.destination, iata: to }, departingAt: at });

describe("webSearchUrl: det samme søket på hellosky.no", () => {
  it("tur-retur med barn og spedbarn: nettets egne parametere, med alder", () => {
    const offer: Offer = {
      ...base,
      cabinClass: "premium_economy",
      slices: [slice("OSL", "BCN", "2026-10-23T07:05:00"), slice("BCN", "OSL", "2026-10-30T18:40:00")],
      passengers: [
        { id: "p1", type: "adult" },
        { id: "p2", type: "adult" },
        { id: "p3", type: "child", age: 7 },
        { id: "p4", type: "infant_without_seat", age: 1 },
      ],
    };
    expect(webSearchUrl(offer)).toBe("https://hellosky.no/sok?adults=2&children=1&infants=1&cabin=premium_economy&childAges=7&infantAges=1&from=OSL&to=BCN&depart=2026-10-23&ret=2026-10-30");
  });

  it("én vei, og uten oppgitt alder sendes bare antallet", () => {
    const offer: Offer = { ...base, slices: [slice("OSL", "CPH", "2026-10-23T07:05:00")], passengers: [{ id: "a", type: "adult" }, { id: "c", type: "child" }] };
    expect(webSearchUrl(offer)).toBe("https://hellosky.no/sok?adults=1&children=1&infants=0&cabin=economy&from=OSL&to=CPH&depart=2026-10-23");
  });

  it("flere strekninger eller ugyldige koder gir ingen lenke", () => {
    expect(webSearchUrl({ ...base, slices: [slice("OSL", "BCN", "2026-10-23T07:05:00"), slice("MAD", "OSL", "2026-10-30T07:05:00")] })).toBeNull();
    expect(webSearchUrl({ ...base, slices: [slice("osl", "BCN", "2026-10-23T07:05:00")] })).toBeNull();
    expect(webSearchUrl({ ...base, slices: [slice("OSL", "BCN", "ukjent")] })).toBeNull();
  });

  it("lenken bærer aldri token, økt eller leverandørlenke", () => {
    const url = webSearchUrl(base)!;
    expect(url).not.toMatch(/token|session|kayak|book|http.*http/i);
  });
});
