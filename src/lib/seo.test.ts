import { describe, expect, it } from "vitest";

import { PAGE_META } from "./seo";
import { STATIC_ROUTES } from "@contracts/seoRoutes";

/**
 * Serveren injiserer metadata fra contracts/seoRoutes.ts; klienten setter den
 * på nytt fra PAGE_META når React har montert. Spriker de to, ser Google og
 * brukeren forskjellig tittel på samme side – og et sprik er umulig å oppdage
 * uten en test, siden begge deler «virker».
 */

const firstByPath = new Map<string, { title: string; description: string; noindex?: boolean }>();
for (const m of Object.values(PAGE_META)) {
  if (!firstByPath.has(m.canonicalPath)) firstByPath.set(m.canonicalPath, m);
}

describe("PAGE_META og STATIC_ROUTES er i takt", () => {
  it("har samme tittel og description for hver fast side", () => {
    for (const r of STATIC_ROUTES) {
      const client = firstByPath.get(r.path);
      if (!client) continue; // side uten egen klientmetadata (f.eks. /fotokreditering)
      expect({ path: r.path, title: r.title, description: r.description }).toEqual({
        path: r.path,
        title: client.title,
        description: client.description,
      });
    }
  });

  it("har ingen side i sitemapet som klienten merker noindex", () => {
    for (const r of STATIC_ROUTES) {
      expect(firstByPath.get(r.path)?.noindex ?? false).toBe(false);
    }
  });
});
