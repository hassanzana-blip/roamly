import { describe, expect, it } from "vitest";
import { deviceLabel } from "./deviceLabel";

describe("deviceLabel", () => {
  it("kjenner igjen vanlige nettlesere", () => {
    expect(deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36")).toBe("Chrome på Mac");
    expect(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/604.1")).toBe("Safari på iPhone");
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/130.0")).toBe("Firefox på Windows");
  });

  it("lar Edge og Opera være seg selv, ikke Chrome", () => {
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0) Chrome/131.0 Safari/537.36 Edg/131.0")).toBe("Edge på Windows");
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0) Chrome/131.0 Safari/537.36 OPR/115.0")).toBe("Opera på Windows");
  });

  it("sier ærlig fra når den ikke vet", () => {
    expect(deviceLabel(null)).toBe("Ukjent nettleser");
    expect(deviceLabel("")).toBe("Ukjent nettleser");
    expect(deviceLabel("noe-helt-annet/1.0")).toBe("Ukjent nettleser");
  });
});
