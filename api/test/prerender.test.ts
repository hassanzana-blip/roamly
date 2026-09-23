import { describe, expect, it } from "vitest";
import { dynamicContentExists, prerenderBody } from "../lib/prerender";
import { ROUTES, routeBySlug } from "../../contracts/routes";
import { ALL_DESTINATIONS } from "../../src/content/discover";
import { ARTICLES } from "../../src/content/journal/index";
import { isKnownRoute } from "../../contracts/seoRoutes";
import { sitemapEntries } from "../lib/sitemap";

/** Tekstinnholdet i HTML-en, slik en crawler uten JavaScript ville lest den. */
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

describe("innholdssider rendres som HTML", () => {
  it("reisemålssiden har byen, ingressen og faktaene", () => {
    const html = prerenderBody("/reisemal/lisboa");
    expect(html).toBeTruthy();
    const t = text(html!);
    expect(t).toContain("Lisboa");
    expect(t).toContain("Portugal");
    expect(t).toContain("Kort fortalt");
    expect(t.length).toBeGreaterThan(150);
  });

  it("rutesiden har tittel, ingress og ruteopplysninger", () => {
    const html = prerenderBody("/fly/oslo-london");
    const t = text(html!);
    expect(t).toContain("Fly Oslo – London");
    expect(t).toContain("Om ruten");
    expect(t).toContain("Norwegian");
    expect(t.length).toBeGreaterThan(400);
  });

  it("journalartikkelen har tittel og brødtekst", () => {
    const a = ARTICLES[0]!;
    const t = text(prerenderBody(`/journal/${a.slug}`)!);
    expect(t).toContain(a.title);
    expect(t.length).toBeGreaterThan(300);
  });

  it("indekssidene lister alt innholdet", () => {
    expect(text(prerenderBody("/reisemal")!).length).toBeGreaterThan(200);
    const journal = prerenderBody("/journal")!;
    for (const a of ARTICLES) expect(journal).toContain(`/journal/${a.slug}`);
  });

  it("tåler etterfølgende skråstrek", () => {
    expect(prerenderBody("/reisemal/lisboa/")).toBe(prerenderBody("/reisemal/lisboa"));
  });
});

describe("søket og kontosidene rendres ikke", () => {
  it.each(["/sok", "/profil", "/bestill", "/lagret", "/", "/hotell"])("%s får ingen server-HTML", (path) => {
    expect(prerenderBody(path)).toBeNull();
  });
});

describe("ingenting oppdiktet slipper ut", () => {
  it("rutesidene nevner ikke en pris", () => {
    for (const r of ROUTES) {
      const t = text(prerenderBody(`/fly/${r.slug}`)!);
      expect(t).not.toMatch(/\d[\d\s]*kr\b/i);
      expect(t).not.toMatch(/\bfra \d/i);
    }
  });

  it("rutesidene sier eksplisitt at prisen hentes ved søk", () => {
    for (const r of ROUTES) expect(text(prerenderBody(`/fly/${r.slug}`)!)).toContain("henter vi først når du søker");
  });

  it("en rute uten kjente direktefly påstår ikke at det finnes noen", () => {
    const erbil = routeBySlug("oslo-erbil")!;
    expect(erbil.directCarriers).toHaveLength(0);
    expect(text(prerenderBody("/fly/oslo-erbil")!)).toContain("Ikke kjent for denne ruten");
  });

  it("HTML-en er rømt, ikke rå", () => {
    const html = prerenderBody("/reisemal")!;
    expect(html).not.toMatch(/<script/i);
  });
});

describe("ukjent innhold er en ekte 404, ikke en tom side", () => {
  it.each(["/reisemal/finnes-ikke", "/journal/finnes-ikke"])("%s finnes ikke", (path) => {
    expect(dynamicContentExists(path)).toBe(false);
    expect(prerenderBody(path)).toBeNull();
  });

  it("ekte innhold finnes", () => {
    expect(dynamicContentExists(`/reisemal/${ALL_DESTINATIONS[0]!.id}`)).toBe(true);
    expect(dynamicContentExists(`/journal/${ARTICLES[0]!.slug}`)).toBe(true);
  });

  it("stier dette ikke gjelder får ingen dom", () => {
    expect(dynamicContentExists("/sok")).toBeNull();
    expect(dynamicContentExists("/fly/oslo-london")).toBeNull();
  });
});

describe("rutesider finnes bare for ruter i registeret", () => {
  it("registrerte ruter er kjente ruter", () => {
    for (const r of ROUTES) expect(isKnownRoute(`/fly/${r.slug}`)).toBe(true);
  });

  it.each(["/fly/tull", "/fly/oslo-atlantis", "/fly/a-b-c-d"])("%s er ikke en kjent rute", (path) => {
    expect(isKnownRoute(path)).toBe(false);
  });

  it("oversiktssiden finnes, også med etterfølgende skråstrek", () => {
    expect(isKnownRoute("/fly")).toBe(true);
    expect(isKnownRoute("/fly/")).toBe(true);
  });
});

describe("sitemapet lover bare sider som svarer", () => {
  it("hver /fly-oppføring har en ruteside", () => {
    const flyEntries = sitemapEntries().filter((e) => e.loc.includes("/fly/"));
    expect(flyEntries).toHaveLength(ROUTES.length);
    for (const e of flyEntries) {
      const slug = e.loc.split("/fly/")[1]!;
      expect(routeBySlug(slug)).toBeDefined();
    }
  });

  it("hver reisemåls- og journaloppføring finnes", () => {
    for (const e of sitemapEntries()) {
      const path = new URL(e.loc).pathname;
      const exists = dynamicContentExists(path);
      if (exists !== null) expect(exists).toBe(true);
    }
  });
});

describe("rutedefinisjonene holder reglene", () => {
  it("ingen dupliserte sluger", () => {
    expect(new Set(ROUTES.map((r) => r.slug)).size).toBe(ROUTES.length);
  });

  it("hver rute har en ingress skrevet for den, ikke en mal", () => {
    const intros = ROUTES.map((r) => r.intro);
    expect(new Set(intros).size).toBe(intros.length);
    for (const i of intros) expect(i.length).toBeGreaterThan(120);
  });

  it("samme marked lages ikke to ganger", () => {
    const pairs = ROUTES.map((r) => [r.from, r.to].sort().join("-"));
    expect(new Set(pairs).size).toBe(pairs.length);
  });
});
