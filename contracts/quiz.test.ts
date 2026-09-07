import { describe, expect, it } from "vitest";
import { agreementOf, scoreGroup, scoreQuiz, QUIZ_DESTINATIONS } from "./quiz";

describe("ReiseMatch: én person", () => {
  it("gir alltid ett reisemål og to alternativer", () => {
    const r = scoreQuiz({ company: "date", mood: "romance", weather: "mild", sights: "landmarks", budget: "mid" });
    expect(r.top.id).toBe("paris");
    expect(r.alternatives).toHaveLength(2);
    expect(r.isCouple).toBe(true);
  });
});

describe("ReiseMatch: flere", () => {
  const a = { mood: "relax" as const, weather: "hot" as const, sights: "beach" as const, budget: "low" as const };
  const b = { mood: "relax" as const, weather: "hot" as const, sights: "food" as const, budget: "high" as const };

  it("viser bare det alle er enige om — budsjett kun når alle delte", () => {
    expect(agreementOf([a, b], false)).toEqual({ mood: "relax", weather: "hot" });
    expect(agreementOf([a, { ...b, budget: "low" }], true)).toEqual({ mood: "relax", weather: "hot", budget: "low" });
    expect(agreementOf([], true)).toEqual({});
  });

  it("rangerer på laveste enkeltpoeng først, så ingen må ofre mye", () => {
    const res = scoreGroup([a, b], false);
    expect(res[0].floor).toBeGreaterThanOrEqual(res[res.length - 1].floor);
    // Málaga passer begge (avslapning, varmt, strand/mat) — skal ligge helt øverst.
    expect(res.slice(0, 3).map((r) => r.destination.id)).toContain("malaga");
  });

  it("ignorerer budsjett når det ikke er delt av alle", () => {
    const withBudget = scoreGroup([a, b], true).map((r) => r.score);
    const without = scoreGroup([a, b], false).map((r) => r.score);
    expect(withBudget).not.toEqual(without);
    expect(scoreGroup([], true)).toEqual([]);
  });

  it("alle destinasjoner har bilde og IATA — ingenting halvferdig i katalogen", () => {
    for (const d of QUIZ_DESTINATIONS) {
      expect(d.image).toMatch(/^\/destinations\/.+\.jpg$/);
      expect(d.iata).toMatch(/^[A-Z]{3}$/);
    }
  });
});
