import fs from "fs";
import path from "path";
import ts from "typescript";
import { AIRPORTS } from "@contracts/airports";
import { REGISTRY } from "../airportRegistry";

// Appens kopi av flyplassregisteret skal være lik det delte registeret – og appen skal aldri hente verdier
// fra contracts (Metro ser bare apps/mobile; en slik import bygger ikke for iPhone).

/**
 * Modulene en fil henter fra contracts utenom rene typer. TypeScript lister alle importer (også re-eksport,
 * require og import()); `import type` og `export type` tas bort først, siden de forsvinner i bygget. En import med
 * bare `{ type X }` regnes som verdi: den kan bli stående som en tom import.
 */
function valueImportsFromContracts(src: string): string[] {
  const withoutTypes = src.replace(/^\s*(import|export)\s+type\b[\s\S]*?;/gm, "");
  return ts
    .preProcessFile(withoutTypes, true, true)
    .importedFiles.map((f) => f.fileName)
    .filter((name) => /(^@contracts\/|(^|\/)contracts\/)/.test(name));
}

describe("flyplassregisteret i appen", () => {
  it("kopien er lik det delte registeret: kode, navn, by, land, «populær» og rekkefølge", () => {
    expect(REGISTRY).toEqual(AIRPORTS.map(({ iata, name, city, country, countryCode, popular }) => ({ iata, name, city, country, countryCode, ...(popular ? { popular } : {}) })));
  });

  it("ingen fil i appen henter verdier fra contracts – bare typer (import, re-eksport, require og import())", () => {
    const root = path.resolve(__dirname, "../..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name !== "__tests__" && e.name !== "test") walk(p);
        } else if (/\.[jt]sx?$/.test(e.name)) files.push(p);
      }
    };
    walk(root);
    expect(files.length).toBeGreaterThan(50);
    const offenders = files.filter((f) => valueImportsFromContracts(fs.readFileSync(f, "utf8")).length > 0);
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  });

  it("vakten ser alle former for verdi-import, men slipper gjennom `import type` og `export type`", () => {
    for (const src of [
      `import { AIRPORTS } from "@contracts/airports";`,
      `import { AIRPORTS, type Airport } from "@contracts/airports";`,
      `import { type Airport } from "@contracts/airports";`,
      `export { AIRPORTS } from "@contracts/airports";`,
      `export * from "@contracts/airports";`,
      `import "@contracts/airports";`,
      `const { AIRPORTS } = require("@contracts/airports");`,
      `const m = await import("@contracts/airports");`,
      `import { AIRPORTS } from "./../../../../contracts/airports";`,
      `import { AIRPORTS } from "../../../contracts/airports";`,
    ])
      expect([src, valueImportsFromContracts(src)]).toEqual([src, [expect.stringContaining("contracts/")]]);
    for (const src of [`import type { Airport } from "@contracts/airports";`, `export type { Airport } from "@contracts/airports";`, `import type {\n  Airport,\n} from "../../contracts/airports";`, `import { formatDay } from "./format";`])
      expect([src, valueImportsFromContracts(src)]).toEqual([src, []]);
  });
});
