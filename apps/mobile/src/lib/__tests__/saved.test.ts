import { DESTINATIONS } from "../destinations";
import { MAX_SAVED, parseSaved, savedDestinations, toggleSaved } from "../saved";

// Lagrede reisemål: bare reisemålets id og nøyaktige IATA-kode, sjekket mot appens reisemål.
const bcn = DESTINATIONS.find((d) => d.id === "barcelona")!;
const tos = DESTINATIONS.find((d) => d.id === "tromso")!;
const london = DESTINATIONS.find((d) => d.id === "london")!;

describe("lagrede reisemål (bare på telefonen)", () => {
  it("lagre legger øverst med nøyaktig IATA; lagre igjen fjerner", () => {
    let list = toggleSaved([], bcn);
    list = toggleSaved(list, tos);
    expect(list).toEqual([{ id: "tromso", iata: "TOS" }, { id: "barcelona", iata: "BCN" }]);
    list = toggleSaved(list, bcn);
    expect(list).toEqual([{ id: "tromso", iata: "TOS" }]);
  });

  it("London lagres som LHR (søkets flyplass), ikke som «alle London-flyplasser»", () => {
    expect(toggleSaved([], london)).toEqual([{ id: "london", iata: "LHR" }]);
  });

  it("fra fil: bare kjente reisemål med samme IATA; ukjente, endrede, doble og søppel forkastes; ingen andre felt beholdes", () => {
    const raw = [
      { id: "barcelona", iata: "BCN", price: 1990, token: "secret" },
      { id: "barcelona", iata: "BCN" },
      { id: "barcelona", iata: "GRO" },
      { id: "atlantis", iata: "ATL" },
      "junk",
      null,
      { id: "tromso", iata: "TOS" },
    ];
    const list = parseSaved(raw);
    expect(list).toEqual([{ id: "barcelona", iata: "BCN" }, { id: "tromso", iata: "TOS" }]);
    expect(JSON.stringify(list)).not.toMatch(/price|token|secret/);
    expect(parseSaved("nonsense")).toEqual([]);
    expect(parseSaved(undefined)).toEqual([]);
  });

  it("høyst alle reisemålene; oppslag gir reisemålene i lagret rekkefølge", () => {
    let list = DESTINATIONS.reduce((l, d) => toggleSaved(l, d), [] as ReturnType<typeof parseSaved>);
    expect(list).toHaveLength(MAX_SAVED);
    list = parseSaved([...list, ...list]);
    expect(list).toHaveLength(MAX_SAVED);
    expect(savedDestinations([{ id: "tromso", iata: "TOS" }, { id: "barcelona", iata: "BCN" }]).map((d) => d.iata)).toEqual(["TOS", "BCN"]);
  });
});
