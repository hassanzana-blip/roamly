import fs from "fs";
import path from "path";
import { AIRPORTS } from "@contracts/airports";
import { REGISTRY } from "../airportRegistry";

// Appens kopi av flyplassregisteret skal være lik det delte registeret – og appen skal aldri hente verdier
// fra contracts (Metro ser bare apps/mobile; en slik import bygger ikke for iPhone).

describe("flyplassregisteret i appen", () => {
  it("kopien er lik det delte registeret: kode, navn, by, land, «populær» og rekkefølge", () => {
    expect(REGISTRY).toEqual(AIRPORTS.map(({ iata, name, city, country, countryCode, popular }) => ({ iata, name, city, country, countryCode, ...(popular ? { popular } : {}) })));
  });

  it("ingen fil i appen henter verdier fra contracts – bare typer", () => {
    const root = path.resolve(__dirname, "../..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name !== "__tests__" && e.name !== "test") walk(p);
        } else if (/\.tsx?$/.test(e.name)) files.push(p);
      }
    };
    walk(root);
    expect(files.length).toBeGreaterThan(50);
    const offenders = files.filter((f) => {
      const src = fs.readFileSync(f, "utf8");
      return /^import\s+(?!type\s)[^;]*?from\s+["'](@contracts\/|(\.\.\/)+contracts\/)/m.test(src);
    });
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  });
});
