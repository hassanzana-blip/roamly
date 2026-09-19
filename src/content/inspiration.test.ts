import { describe, expect, it } from "vitest";
import { ALL_DESTINATIONS } from "./discover";
import { picksFor, TEMPOS } from "./inspiration";

describe("inspiration tempos", () => {
  it("every tempo has a primary and a secondary pick with a real photo", () => {
    for (const t of TEMPOS) {
      const { primary, secondary } = picksFor(t.id);
      expect(primary?.destination.image).toBeTruthy();
      expect(secondary?.destination.image).toBeTruthy();
      expect(primary?.destination.id).not.toBe(secondary?.destination.id);
    }
  });
  it("only references destinations that exist in the registry", () => {
    const ids = new Set(ALL_DESTINATIONS.map((d) => d.id));
    for (const t of TEMPOS) for (const id of t.ids) expect(ids.has(id)).toBe(true);
  });
});
