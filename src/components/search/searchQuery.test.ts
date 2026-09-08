import { describe, expect, it } from "vitest";
import { buildSearchQuery, defaultState, passengersFromParams } from "./searchQuery";
import { airportByIata } from "@contracts/airports";

/**
 * Lenker til søk og kasse lages fire steder: søkefeltet, lagrede søk, nylige
 * søk og prisvarsler. Bare søkefeltet skriver alder. Leste vi følget fra
 * alderslisten alene, ble et søk for to voksne og to barn priset for to voksne
 * – i resultatet, i kassen og i betalingen.
 */
const params = (q: string) => new URLSearchParams(q);
const types = (q: string) => passengersFromParams(params(q)).map((p) => p.type);

describe("reisefølget i en lenke", () => {
  it("teller barn og spedbarn selv når lenken mangler alder", () => {
    expect(types("adults=2&children=1&infants=1")).toEqual(["adult", "adult", "child", "infant_without_seat"]);
  });

  it("bruker oppgitt alder når den finnes", () => {
    const pax = passengersFromParams(params("adults=1&children=2&childAges=4,11"));
    expect(pax.filter((p) => p.type === "child").map((p) => p.age)).toEqual([4, 11]);
  });

  it("antallet vinner over en aldersliste som ikke stemmer", () => {
    expect(types("adults=1&children=3&childAges=6")).toEqual(["adult", "child", "child", "child"]);
    expect(types("adults=1&children=1&childAges=6,7,8")).toEqual(["adult", "child"]);
  });

  it("uten antall beskriver alderslisten følget", () => {
    expect(types("adults=1&childAges=6,7")).toEqual(["adult", "child", "child"]);
  });

  it("alltid minst én voksen, og søppelverdier faller tilbake", () => {
    expect(types("")).toEqual(["adult"]);
    expect(types("adults=0")).toEqual(["adult"]);
    expect(types("adults=abc&children=-2")).toEqual(["adult"]);
  });

  it("lenken søkefeltet lager beskriver følget sitt selv", () => {
    const state = { ...defaultState(), to: airportByIata("BCN") ?? null, pax: { adult: 2, child: 2, infant_without_seat: 1 }, ages: { children: [], infants: [] } };
    const q = params(buildSearchQuery(state));
    expect(q.get("childAges")).toBe("8,8");
    expect(q.get("infantAges")).toBe("1");
    expect(types(q.toString())).toEqual(["adult", "adult", "child", "child", "infant_without_seat"]);
  });
});
