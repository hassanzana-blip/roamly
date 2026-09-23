import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStaticFiles } from "../lib/vite";

// A unique, local fixture directory: no database, provider calls or shared dist.
const fixture = mkdtempSync(path.join(process.cwd(), ".static-unit-"));
mkdirSync(path.join(fixture, "assets"));
writeFileSync(
  path.join(fixture, "index.html"),
  '<!doctype html><html><head><!--seo:start--><!--seo:end--></head><body><div id="root"></div></body></html>'
);
writeFileSync(path.join(fixture, "assets", "app-hash.js"), "export {};");
writeFileSync(path.join(fixture, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: https://hellosky.no/sitemap.xml\n");
const app = new Hono<{ Bindings: HttpBindings }>();
serveStaticFiles(app, fixture);
afterAll(() => rmSync(fixture, { recursive: true, force: true }));

describe("served route status, robots metadata and cache policy", () => {
  it("serves known private routes uncached with noindex", async () => {
    const response = await app.request("/tilbud/abc");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(await response.text()).toContain(
      'name="robots" content="noindex,nofollow"'
    );
  });

  it.each([
    "/bestilling/abc",
    "/reisemal/ikke-et-reisemal",
    "/journal/ikke-en-artikkel",
  ])("keeps %s a true 404 in HTTP and HTML", async url => {
    const response = await app.request(url);
    expect(response.status).toBe(404);
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(await response.text()).toContain(
      'name="robots" content="noindex,nofollow"'
    );
  });

  it("keeps immutable caching for hashed assets", async () => {
    const response = await app.request("/assets/app-hash.js");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable"
    );
  });

  it.each(["/", "/reisemal", "/assets/app-hash.js"])(
    "prevents indexing %s on staging even with a public forwarded host",
    async url => {
      const response = await app.request(`https://roamly-staging.up.railway.app${url}`, {
        headers: { "x-forwarded-host": "hellosky.no" },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("x-robots-tag")).toBe("noindex");
    },
  );

  it("allows preview crawling to discover noindex without advertising a sitemap", async () => {
    const robots = await app.request("https://roamly-staging.up.railway.app/robots.txt");
    expect(robots.status).toBe(200);
    expect(await robots.text()).toBe("User-agent: *\nAllow: /\n");
    expect(robots.headers.get("x-robots-tag")).toBe("noindex");
    const sitemap = await app.request("https://roamly-staging.up.railway.app/sitemap.xml");
    expect(sitemap.status).toBe(404);
    expect(sitemap.headers.get("x-robots-tag")).toBe("noindex");
  });

  it.each(["hellosky.no", "www.hellosky.no"])("preserves public SEO on %s", async host => {
    const root = await app.request(`https://${host}/`);
    expect(root.status).toBe(200);
    expect(root.headers.get("x-robots-tag")).toBeNull();
    expect(await root.text()).toContain('name="robots" content="index,follow"');
    const sitemap = await app.request(`https://${host}/sitemap.xml`);
    expect(sitemap.status).toBe(200);
    expect(sitemap.headers.get("x-robots-tag")).toBeNull();
    expect(await sitemap.text()).toContain("https://hellosky.no/");
    const robots = await app.request(`https://${host}/robots.txt`);
    expect(await robots.text()).toContain("Sitemap: https://hellosky.no/sitemap.xml");
  });
});
