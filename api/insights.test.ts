import { describe, expect, it } from "vitest";
import { buildFunnel } from "./insights";

const at = (steps: ReturnType<typeof buildFunnel>["steps"], key: string) => steps.find((s) => s.key === key)?.count;

describe("buildFunnel", () => {
  it("teller hvert steg som «kom minst så langt»", () => {
    const f = buildFunnel([
      { status: "created", count: 10 },
      { status: "payment_pending", count: 6 },
      { status: "authorized", count: 3 },
      { status: "confirmed", count: 8 },
    ]);
    expect(f.started).toBe(27);
    expect(at(f.steps, "created")).toBe(27);
    expect(at(f.steps, "payment_pending")).toBe(17);
    expect(at(f.steps, "authorized")).toBe(11);
    expect(at(f.steps, "booking")).toBe(8);
    expect(at(f.steps, "confirmed")).toBe(8);
    expect(f.confirmed).toBe(8);
  });

  it("teller frafall som startet, og ikke lenger", () => {
    const f = buildFunnel([
      { status: "confirmed", count: 4 },
      { status: "expired", count: 5 },
      { status: "failed", count: 1 },
    ]);
    expect(f.started).toBe(10);
    expect(at(f.steps, "created")).toBe(10);
    // De seks som røk skal ikke dukke opp igjen lenger nede i trakten.
    expect(at(f.steps, "payment_pending")).toBe(4);
    expect(f.dropouts).toEqual([
      { status: "expired", count: 5 },
      { status: "failed", count: 1 },
    ]);
  });

  it("er tom, ikke null, når ingen har vært i kassa", () => {
    const f = buildFunnel([]);
    expect(f.started).toBe(0);
    expect(f.confirmed).toBe(0);
    expect(f.dropouts).toEqual([]);
    expect(f.steps.every((s) => s.count === 0)).toBe(true);
  });

  it("lar en ukjent status telle som startet uten å krasje", () => {
    const f = buildFunnel([{ status: "noe_helt_nytt", count: 3 }]);
    expect(f.started).toBe(3);
    expect(at(f.steps, "created")).toBe(3);
    expect(at(f.steps, "confirmed")).toBe(0);
  });
});
