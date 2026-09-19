import { describe, expect, it } from "vitest";
import { resolveProviders, type ProviderResolutionConfig } from "./flightProviders";

const base: ProviderResolutionConfig = {
  flightProvider: "auto",
  isProdEnv: true,
  duffelConfigured: true,
  travelportEnabled: false,
  kayakEnabled: true,
  kayakSandbox: true,
  kayakPreview: false,
  allowSandboxInProduction: false,
};

describe("valg av flyleverandør", () => {
  it("auto: Travelport hvis på, ellers Duffel, ellers KAYAK der den kan være standard, ellers demo", () => {
    expect(resolveProviders(base).active).toBe("duffel");
    expect(resolveProviders({ ...base, travelportEnabled: true }).active).toBe("travelport");
    // Produksjon + sandkasse uten eksplisitt tillatelse: KAYAK er ikke standard → demo.
    expect(resolveProviders({ ...base, duffelConfigured: false }).active).toBe("demo");
    // Utenfor produksjon foretrekkes KAYAK-sandkassen foran oppdiktede demotilbud.
    expect(resolveProviders({ ...base, duffelConfigured: false, isProdEnv: false }).active).toBe("kayak");
    expect(resolveProviders({ ...base, duffelConfigured: false, kayakSandbox: false }).active).toBe("kayak");
    expect(resolveProviders({ ...base, duffelConfigured: false, allowSandboxInProduction: true }).active).toBe("kayak");
    expect(resolveProviders({ ...base, duffelConfigured: false, kayakEnabled: false }).active).toBe("demo");
  });

  it("KAYAK sandbox blir aldri standard i produksjon uten eksplisitt tillatelse", () => {
    expect(resolveProviders({ ...base, flightProvider: "kayak" }).active).toBe("duffel");
    expect(resolveProviders({ ...base, flightProvider: "kayak", allowSandboxInProduction: true }).active).toBe("kayak");
    expect(resolveProviders({ ...base, flightProvider: "kayak", isProdEnv: false }).active).toBe("kayak");
    expect(resolveProviders({ ...base, flightProvider: "kayak", kayakSandbox: false }).active).toBe("kayak");
  });

  it("FLIGHT_PROVIDER=kayak uten nøkkel faller tilbake til den gamle kjeden", () => {
    expect(resolveProviders({ ...base, flightProvider: "kayak", kayakEnabled: false }).active).toBe("duffel");
  });

  it("KAYAK er valgbar per søk bare med KAYAK_PREVIEW eller når den er standard", () => {
    expect(resolveProviders(base).selectable).not.toContain("kayak");
    expect(resolveProviders({ ...base, kayakPreview: true }).selectable).toContain("kayak");
    expect(resolveProviders({ ...base, kayakPreview: true, kayakEnabled: false }).selectable).not.toContain("kayak");
    const asDefault = resolveProviders({ ...base, flightProvider: "kayak", isProdEnv: false });
    expect(asDefault.selectable[0]).toBe("kayak");
    expect(asDefault.selectable).toContain("duffel");
  });
});
