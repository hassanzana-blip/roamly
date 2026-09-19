import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

import { headFor, seoBlock, withSeoHead, SEO_START, SEO_END } from "../lib/seoHead";
import { sitemapEntries } from "../lib/sitemap";
import { isKnownRoute, normalizePath } from "../../contracts/seoRoutes";
import { ALL_DESTINATIONS } from "../../src/content/discover";
import { ARTICLES } from "../../src/content/journal/index";

describe("canonical per rute", () => {
  it("gir hver sti sin egen canonical, aldri forsidens", () => {
    for (const p of ["/", "/reisemal", "/bagasje", "/journal/istanbul-to-flyplasser", "/reisemal/erbil"]) {
      expect(headFor(p).canonical).toBe(`https://hellosky.no${p === "/" ? "/" : p}`);
    }
  });

  it("behandler /hjelp/ og /hjelp som samme side", () => {
    expect(headFor("/hjelp/").canonical).toBe("https://hellosky.no/hjelp");
    expect(normalizePath("/hjelp/")).toBe("/hjelp");
  });

  it("setter noindex på sider som ikke skal i søk", () => {
    expect(headFor("/bestill").robots).toBe("noindex,nofollow");
    expect(headFor("/profil/varsler").robots).toBe("noindex,nofollow");
    expect(headFor("/bagasje").robots).toBe("index,follow");
  });

  it("henter tittel og description fra innholdet for dynamiske ruter", () => {
    const d = ALL_DESTINATIONS.find((x) => x.id === "erbil")!;
    expect(headFor("/reisemal/erbil").title).toBe(`Fly til ${d.city} | HelloSky`);
    const a = ARTICLES[0]!;
    expect(headFor(`/journal/${a.slug}`).title).toBe(`${a.title} | HelloSky`);
    expect(headFor(`/journal/${a.slug}`).description).toBe(a.deck);
  });

  it("gir ukjente ruter forsidens tekst, men sin egen canonical", () => {
    const h = headFor("/finnes-ikke-12345");
    expect(h.canonical).toBe("https://hellosky.no/finnes-ikke-12345");
  });
});

describe("appskallet", () => {
  const html = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");

  it("har markørene injeksjonen trenger", () => {
    expect(html).toContain(SEO_START);
    expect(html).toContain(SEO_END);
  });

  // Kommentarene i index.html omtaler taggene i klartekst, så de må vekk før
  // vi leter etter ekte tagger.
  const withoutComments = (s: string) => s.replace(/<!--[\s\S]*?-->/g, "");

  it("har ingen canonical eller og:-tagg utenfor markørene", () => {
    const outside = withoutComments(html.slice(0, html.indexOf(SEO_START)) + html.slice(html.indexOf(SEO_END)));
    expect(outside).not.toMatch(/rel=["']canonical["']/);
    expect(outside).not.toMatch(/property=["']og:/);
    expect(outside).not.toMatch(/<title/);
  });

  it("merker taggene helmet eier med data-rh, slik at klienten ikke dupliserer dem", () => {
    const block = html.slice(html.indexOf(SEO_START), html.indexOf(SEO_END));
    for (const tag of ["<title", 'rel="canonical"', 'property="og:title"', 'name="description"']) {
      const line = block.split("\n").find((l) => l.includes(tag))!;
      const start = block.indexOf(line);
      expect(block.slice(start, start + 400)).toContain('data-hs-seo="true"');
    }
  });

  it("bytter ut blokken, og bare blokken", () => {
    const out = withSeoHead(html, "/bagasje");
    expect(out).toContain('rel="canonical" href="https://hellosky.no/bagasje"');
    expect(out).not.toContain('rel="canonical" href="https://hellosky.no/"');
    // Nøyaktig én canonical i dokumentet. To var hele grunnen til at ingen
    // underside kunne indekseres.
    expect(withoutComments(out).split('rel="canonical"')).toHaveLength(2);
    expect(withoutComments(out).split("<title")).toHaveLength(2);
    expect(out).toContain("plausible.io"); // resten av head er urørt
  });

  it("returnerer HTML-en uendret hvis markørene mangler", () => {
    expect(withSeoHead("<html><head></head></html>", "/bagasje")).toBe("<html><head></head></html>");
  });

  it("escaper anførselstegn og vinkelparenteser i stien", () => {
    const block = seoBlock('/reisemal/"><script>alert(1)</script>');
    expect(block).not.toContain("<script>");
    expect(block).toContain("&quot;");
  });
});

describe("kjente ruter", () => {
  it("kjenner igjen alle sider i sitemapet", () => {
    for (const e of sitemapEntries()) {
      expect(isKnownRoute(new URL(e.loc).pathname)).toBe(true);
    }
  });

  it("avviser stier appen ikke har", () => {
    for (const p of ["/finnes-ikke-12345", "/reisemal/erbil/ekstra", "/tilfeldig/dyp/sti"]) {
      expect(isKnownRoute(p)).toBe(false);
    }
  });
});

describe("sitemap", () => {
  const entries = sitemapEntries();

  it("har ingen ankerlenker", () => {
    for (const e of entries) expect(e.loc).not.toContain("#");
  });

  it("har ingen duplikater", () => {
    const locs = entries.map((e) => e.loc);
    expect(new Set(locs).size).toBe(locs.length);
  });

  it("har én side per reisemål og per artikkel", () => {
    for (const d of ALL_DESTINATIONS) {
      expect(entries.some((e) => e.loc === `https://hellosky.no/reisemal/${d.id}`)).toBe(true);
    }
    for (const a of ARTICLES) {
      expect(entries.some((e) => e.loc === `https://hellosky.no/journal/${a.slug}`)).toBe(true);
    }
  });

  it("har ingen side som er sperret for indeksering", () => {
    for (const e of entries) {
      expect(headFor(new URL(e.loc).pathname).robots).toBe("index,follow");
    }
  });

  it("bruker artikkelens egen oppdateringsdato som lastmod", () => {
    const a = ARTICLES[0]!;
    expect(entries.find((e) => e.loc.endsWith(`/journal/${a.slug}`))?.lastmod).toBe(a.updated);
  });
});

describe("404", () => {
  it("merker ukjente stier noindex i HTML-en, ikke bare i headeren", () => {
    const h = headFor("/finnes-ikke-12345");
    expect(h.robots).toBe("noindex,nofollow");
    expect(h.title).toBe("Siden finnes ikke | HelloSky");
  });

  it("lar ekte sider stå som index,follow", () => {
    expect(headFor("/reisemal/erbil").robots).toBe("index,follow");
    expect(headFor("/journal/istanbul-to-flyplasser").robots).toBe("index,follow");
  });
});
