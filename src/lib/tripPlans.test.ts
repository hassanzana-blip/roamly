import { describe, expect, it } from "vitest";
import { pickNextPlan, type TripPlanSummary } from "./tripPlans";

const base = { destinationId: null, destination: null, originIata: null, destinationIata: null, adults: 2, children: 0, booked: false, bookingId: null, groupId: null, notes: null, packing: [], documentCount: 0, createdAt: new Date(), updatedAt: new Date() };
const plan = (id: number, patch: Partial<TripPlanSummary>): TripPlanSummary => ({ ...base, id, title: `Plan ${id}`, dateFrom: null, dateTo: null, status: "idea", ...patch }) as TripPlanSummary;

describe("pickNextPlan", () => {
  it("returns null without plans", () => {
    expect(pickNextPlan([], "2026-09-19")).toBeNull();
  });
  it("prefers the nearest upcoming dated plan", () => {
    const plans = [plan(1, {}), plan(2, { dateFrom: "2026-12-01", dateTo: "2026-12-05", status: "planned" }), plan(3, { dateFrom: "2026-10-16", dateTo: "2026-10-19", status: "planned" })];
    expect(pickNextPlan(plans, "2026-09-19")?.id).toBe(3);
  });
  it("skips plans that already ended and done plans", () => {
    const plans = [plan(1, { status: "done" }), plan(2, { dateFrom: "2026-01-01", dateTo: "2026-01-03", status: "planned" }), plan(3, {})];
    expect(pickNextPlan(plans, "2026-09-19")?.id).toBe(2);
    expect(pickNextPlan([plan(1, { status: "done" })], "2026-09-19")).toBeNull();
  });
});
