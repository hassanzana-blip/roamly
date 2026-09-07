import { describe, expect, it } from "vitest";
import { mapFlightStatus, progressBetween } from "./flightStatus";

/**
 * Fixturene følger AviationStacks publiserte svarformat. De er IKKE hentet fra
 * et ekte kall (utviklingsmiljøet når ikke nettet), så første ekte oppslag kan
 * avdekke avvik. Reglene som testes her er uansett de viktige: vi viser aldri
 * en status vi ikke har dekning for.
 */
const base = {
  flight_date: "2026-10-15",
  flight_status: "scheduled",
  departure: {
    airport: "Oslo Gardermoen",
    iata: "OSL",
    terminal: "2",
    gate: "D7",
    delay: null,
    scheduled: "2026-10-15T08:10:00+02:00",
    estimated: "2026-10-15T08:10:00+02:00",
    actual: null,
  },
  arrival: {
    airport: "London Heathrow",
    iata: "LHR",
    terminal: "3",
    gate: null,
    delay: null,
    scheduled: "2026-10-15T09:30:00+01:00",
    estimated: "2026-10-15T09:30:00+01:00",
    actual: null,
  },
  airline: { name: "SAS", iata: "SK" },
  flight: { number: "805", iata: "SK805" },
  aircraft: { iata: "32N", registration: "LN-RGA" },
  live: null,
};

describe("Flystatus: kartlegging", () => {
  it("leser rute, tider, gate og fly fra svaret", () => {
    const s = mapFlightStatus(base)!;
    expect(s.carrier).toEqual({ iata: "SK", name: "SAS" });
    expect(s.flightNumber).toBe("SK805");
    expect(s.origin.iata).toBe("OSL");
    expect(s.destination.iata).toBe("LHR");
    expect(s.origin.terminal).toBe("2");
    expect(s.gate).toBe("D7");
    expect(s.aircraft).toBe("32N");
    expect(s.status).toBe("scheduled");
    expect(s.delayMinutes).toBe(0);
    expect(s.progress).toBe(0);
  });

  it("markerer forsinkelse når avgangen ennå ikke har gått", () => {
    const s = mapFlightStatus({ ...base, departure: { ...base.departure, delay: 35 } })!;
    expect(s.status).toBe("delayed");
    expect(s.delayMinutes).toBe(35);
  });

  it("bruker faktisk tid framfor estimert når den finnes", () => {
    const s = mapFlightStatus({
      ...base,
      flight_status: "active",
      departure: { ...base.departure, actual: "2026-10-15T08:25:00+02:00" },
    })!;
    expect(s.estimatedDeparture).toBe("2026-10-15T08:25:00+02:00");
    expect(s.status).toBe("in_air");
  });

  it("skiller mellom i lufta og avgang pågår", () => {
    const iLufta = mapFlightStatus({ ...base, flight_status: "active", live: { is_ground: false } })!;
    expect(iLufta.status).toBe("in_air");
    const påBakken = mapFlightStatus({ ...base, flight_status: "active", live: { is_ground: true } })!;
    expect(påBakken.status).toBe("departed");
  });

  it("oversetter landet og kansellert", () => {
    expect(mapFlightStatus({ ...base, flight_status: "landed" })!.status).toBe("landed");
    expect(mapFlightStatus({ ...base, flight_status: "landed" })!.progress).toBe(1);
    expect(mapFlightStatus({ ...base, flight_status: "cancelled" })!.status).toBe("cancelled");
  });

  it("behandler omdirigert og hendelse som forsinket", () => {
    expect(mapFlightStatus({ ...base, flight_status: "diverted" })!.status).toBe("delayed");
    expect(mapFlightStatus({ ...base, flight_status: "incident" })!.status).toBe("delayed");
  });

  it("gir null når planlagte tider mangler — da sier siden ærlig ifra", () => {
    expect(mapFlightStatus({ ...base, departure: { ...base.departure, scheduled: null } })).toBeNull();
    expect(mapFlightStatus({ ...base, arrival: { ...base.arrival, scheduled: null } })).toBeNull();
    expect(mapFlightStatus({})).toBeNull();
  });

  it("utelater gate framfor å finne på en", () => {
    const s = mapFlightStatus({ ...base, departure: { ...base.departure, gate: null } })!;
    expect(s.gate).toBeUndefined();
  });
});

describe("Flystatus: framdrift", () => {
  const fra = "2026-10-15T08:00:00Z";
  const til = "2026-10-15T10:00:00Z";

  it("regner ut andel av reisen", () => {
    expect(progressBetween(fra, til, Date.parse("2026-10-15T09:00:00Z"))).toBeCloseTo(0.5);
    expect(progressBetween(fra, til, Date.parse("2026-10-15T08:30:00Z"))).toBeCloseTo(0.25);
  });

  it("holder seg innenfor 0 og 1", () => {
    expect(progressBetween(fra, til, Date.parse("2026-10-15T07:00:00Z"))).toBe(0);
    expect(progressBetween(fra, til, Date.parse("2026-10-15T23:00:00Z"))).toBe(1);
  });

  it("tåler ugyldige eller snudde tider", () => {
    expect(progressBetween("tull", til)).toBe(0);
    expect(progressBetween(til, fra)).toBe(0);
  });
});
