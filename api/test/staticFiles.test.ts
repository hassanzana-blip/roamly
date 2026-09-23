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
});
