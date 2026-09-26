import { expect, test } from "@playwright/test";

/**
 * Metadata skal være riktig både før og etter at React har montert.
 *
 * Serveren injiserer tagger per rute (api/lib/seoHead.ts); klienten setter sine
 * egne og fjerner serverens (src/providers/helmet.tsx). Ryker det siste steget,
 * står det to canonical-er i dokumentet – og en side med to canonical-er blir
 * ikke indeksert. Det er usynlig i enhetstestene, for det skjer først i en ekte
 * nettleser, og det var den opprinnelige feilen.
 */

const PAGES = [
  { path: "/", title: /Søk og sammenlign fly/ },
  { path: "/bagasje", title: /^Bagasjeguiden \| HelloSky$/ },
  { path: "/reisemal/erbil", title: /^Fly til Erbil \| HelloSky$/ },
  { path: "/journal/istanbul-to-flyplasser", title: /Istanbul har to flyplasser/ },
];

for (const p of PAGES) {
  test(`${p.path} har nøyaktig én canonical, tittel og description etter hydrering`, async ({ page, baseURL }) => {
    await page.goto(p.path);
    await expect(page).toHaveTitle(p.title);
    // Serveren leverer allerede riktig tittel, så toHaveTitle sier ingenting om
    // hydreringen. Vent til klienten har tatt over (rutens chunk er lastet,
    // usePageMeta har kjørt og serverens tagger er fjernet) før vi teller.
    await page.waitForFunction(() => document.querySelectorAll("[data-hs-seo]").length === 0, undefined, { timeout: 15_000 });

    const counts = await page.evaluate(() => ({
      canonical: document.querySelectorAll('link[rel="canonical"]').length,
      title: document.querySelectorAll("title").length,
      description: document.querySelectorAll('meta[name="description"]').length,
      ogTitle: document.querySelectorAll('meta[property="og:title"]').length,
      leftovers: document.querySelectorAll("[data-hs-seo]").length,
    }));
    expect(counts).toEqual({ canonical: 1, title: 1, description: 1, ogTitle: 1, leftovers: 0 });

    const canonical = await page.getAttribute('link[rel="canonical"]', "href");
    expect(new URL(canonical!).pathname).toBe(p.path);
    // Undersider skal aldri peke på forsiden – det var den opprinnelige feilen.
    // Forsiden selv skal selvsagt peke på forsiden.
    if (p.path !== "/") expect(canonical).not.toBe(`${baseURL}/`);
  });
}

test("serveren leverer riktig canonical uten at JavaScript kjører", async ({ request }) => {
  const res = await request.get("/reisemal/erbil");
  expect(res.status()).toBe(200);
  const html = await res.text();
  const canonicals = [...html.matchAll(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  expect(canonicals).toHaveLength(1);
  expect(canonicals[0]).toMatch(/\/reisemal\/erbil$/);
  expect(html).toContain("Fly til Erbil | HelloSky");
});

test("en sti som ikke finnes svarer 404 og noindex", async ({ request }) => {
  const res = await request.get("/finnes-ikke-12345");
  expect(res.status()).toBe(404);
  expect(res.headers()["x-robots-tag"]).toContain("noindex");
  expect(await res.text()).toContain('content="noindex,nofollow"');
});

test("sitemapet har ingen ankerlenker og dekker reisemålssidene", async ({ request }) => {
  // Address the local test server using the public Host; never fetch production.
  const res = await request.get("/sitemap.xml", { headers: { Host: "hellosky.no" } });
  expect(res.status()).toBe(200);
  expect(res.headers()["x-robots-tag"]).toBeUndefined();
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]!);
  expect(locs.filter((l) => l.includes("#"))).toHaveLength(0);
  expect(new Set(locs).size).toBe(locs.length);
  expect(locs.some((l) => l.endsWith("/reisemal/erbil"))).toBe(true);
  expect(locs.some((l) => l.endsWith("/journal/istanbul-to-flyplasser"))).toBe(true);
});

test("preview-verten er noindex og annonserer ikke et sitemap", async ({ request }) => {
  const headers = { Host: "preview.example.invalid", "X-Forwarded-Host": "hellosky.no" };
  const page = await request.get("/reisemal/erbil", { headers });
  expect(page.status()).toBe(200);
  expect(page.headers()["x-robots-tag"]).toBe("noindex");
  const robots = await request.get("/robots.txt", { headers });
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toBe("User-agent: *\nAllow: /\n");
  const sitemap = await request.get("/sitemap.xml", { headers });
  expect(sitemap.status()).toBe(404);
  expect(sitemap.headers()["x-robots-tag"]).toBe("noindex");
});
