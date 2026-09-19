import { describe, expect, it } from "vitest";
import { resolveProviders, type ProviderResolutionConfig } from "./flightProviders";

const base: ProviderResolutionConfig = {
  flightProvider: "auto",
  isProdEnv: true,
  duffelConfigured: true,
  travelportEnabled: false,
  kayakEnabled: true,
  kayakSandbox: true,
  kayakPreview: true,
  allowSandboxInProduction: true,
};

describe("resolveProviders – fly går til Duffel", () => {
  it("Duffel er standard og eneste valgbare når den er konfigurert", () => {
    expect(resolveProviders(base)).toEqual({ active: "duffel", selectable: ["duffel"] });
    expect(resolveProviders({ ...base, flightProvider: "duffel" })).toEqual({ active: "duffel", selectable: ["duffel"] });
  });

  it("KAYAK er aldri flyleverandør – uansett flagg og uansett hva søket ber om", () => {
    expect(resolveProviders({ ...base, flightProvider: "kayak" }).active).toBe("duffel");
    expect(resolveProviders({ ...base, flightProvider: "kayak", duffelConfigured: false, isProdEnv: false }).active).toBe("demo");
    for (const cfg of [base, { ...base, kayakPreview: true }, { ...base, isProdEnv: false }, { ...base, duffelConfigured: false, isProdEnv: false }]) {
      expect(resolveProviders(cfg).selectable).not.toContain("kayak");
    }
  });

  it("Travelport bare når den bes om eksplisitt og er slått på", () => {
    expect(resolveProviders({ ...base, travelportEnabled: true }).active).toBe("duffel");
    expect(resolveProviders({ ...base, travelportEnabled: true, flightProvider: "travelport" })).toEqual({ active: "travelport", selectable: ["travelport", "duffel"] });
    expect(resolveProviders({ ...base, travelportEnabled: false, flightProvider: "travelport" }).active).toBe("duffel");
  });

  it("uten Duffel-nøkkel gjenstår bare demo (merket testdata; produksjon nekter demo ved oppstart)", () => {
    expect(resolveProviders({ ...base, duffelConfigured: false })).toEqual({ active: "demo", selectable: ["demo"] });
  });
});
