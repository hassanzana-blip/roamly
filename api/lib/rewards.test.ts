import { describe, expect, it } from "vitest";
import { bookingEarnKr, DEFAULT_REWARD_RULES, tierFor } from "./rewards";

describe("Bonus: regler", () => {
  it("standardsatsene er de som gjaldt før regelmotoren (ingen stille endring i produksjon)", () => {
    expect(DEFAULT_REWARD_RULES.bookingEarnFraction).toBe(0.01);
    expect(DEFAULT_REWARD_RULES.referralReferrerKr).toBe(200);
    expect(DEFAULT_REWARD_RULES.referralReferredKr).toBe(200);
  });

  it("opptjening rundes ned til hele kroner og gjelder kun NOK", () => {
    expect(bookingEarnKr(DEFAULT_REWARD_RULES, 4_299_99, "NOK")).toBe(42);
    expect(bookingEarnKr(DEFAULT_REWARD_RULES, 4_299_99, "EUR")).toBe(0);
    expect(bookingEarnKr(DEFAULT_REWARD_RULES, 5_000, "NOK")).toBe(0);
  });

  it("nivå følger antall gjennomførte reiser, og sier hva som mangler til neste", () => {
    expect(tierFor(DEFAULT_REWARD_RULES, 0)).toMatchObject({ current: { id: "explorer" }, next: { id: "traveller" }, tripsToNext: 3 });
    expect(tierFor(DEFAULT_REWARD_RULES, 3)).toMatchObject({ current: { id: "traveller" }, next: { id: "voyager" }, tripsToNext: 5 });
    expect(tierFor(DEFAULT_REWARD_RULES, 20)).toMatchObject({ current: { id: "voyager" }, next: null, tripsToNext: 0 });
  });
});
