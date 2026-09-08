import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

import { createHash } from "node:crypto";

type App = Hono<{ Bindings: HttpBindings }>;

/** dist/public — fra bundlet dist/boot.js (../dist/public) eller fra kildekode (cwd/dist/public). */
export function distPublicDir(): string {
  const candidates = [path.resolve(import.meta.dirname, "../dist/public"), path.resolve(process.cwd(), "dist/public")];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

/**
 * CSP-hasher for inline-skript i det bygde index.html (tema-init m.m.), slik at
 * script-src kan være uten 'unsafe-inline'. JSON-LD (type=application/ld+json)
 * kjøres ikke og trenger ingen hash. Returnerer [] hvis bygget ikke finnes (dev).
 */
export function inlineScriptHashes(): string[] {
  try {
    const html = fs.readFileSync(path.resolve(distPublicDir(), "index.html"), "utf-8");
    const hashes: string[] = [];
    const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const attrs = m[1] ?? "";
      const body = m[2] ?? "";
      if (/\bsrc\s*=/i.test(attrs) || /type\s*=\s*["']application\/(ld\+)?json["']/i.test(attrs) || !body.trim()) continue;
      hashes.push(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
    }
    return hashes;
  } catch {
    return [];
  }
}

/**
 * Statisk servering av Vite-bygget (OTA-092: cache-headere).
 *  - /assets/* er innholdshashet → immutable i ett år.
 *  - index.html → no-cache slik at nye deploys plukkes opp umiddelbart.
 *  - Øvrige filer (favicon, manifest, bilder) → kort cache.
 */
export function serveStaticFiles(app: App, distPathOverride?: string) {
  const distPath = distPathOverride ?? distPublicDir();
  const indexPath = path.resolve(distPath, "index.html");
  let indexCache: string | null = null;

  app.use("/assets/*", async (c, next) => {
    await next();
    if (c.res.status === 200) c.header("Cache-Control", "public, max-age=31536000, immutable");
  });

  app.use("*", async (c, next) => {
    await next();
    if (c.res.status !== 200 || c.res.headers.get("Cache-Control") || c.req.path.startsWith("/api/")) return;
    const ct = c.res.headers.get("content-type") ?? "";
    if (ct.includes("text/html")) {
      c.header("Cache-Control", "no-cache"); // index.html (også via serveStatic på "/")
    } else if (!ct.includes("application/json")) {
      c.header("Cache-Control", "public, max-age=3600"); // favicon, manifest, bilder
    }
  });

  app.get("/index.html", (c) => c.redirect("/", 301));
  app.use("*", serveStatic({ root: path.relative(process.cwd(), distPath) || ".", precompressed: true }));

  /**
   * SPA-fallback: en rute får appskallet, en fil som ikke finnes får 404.
   *
   * Skillet gikk før på `Accept: text/html`. Nettlesere sender det, men
   * lenkeforhåndsvisninger, oppetidsovervåking og curl sender en vilkårlig
   * innholdstype, og fikk en JSON-404 for en helt gyldig side. Skillet går nå
   * på om stien ser ut som en fil: da er 404 riktig svar uansett hvem som spør.
   */
  const looksLikeFile = (p: string) => /\.[a-z0-9]{2,8}$/i.test(p);

  app.notFound((c) => {
    if (c.req.path.startsWith("/api/") || looksLikeFile(c.req.path)) {
      return c.json({ error: "Not Found" }, 404);
    }
    if (indexCache === null || process.env.NODE_ENV !== "production") {
      indexCache = fs.readFileSync(indexPath, "utf-8");
    }
    c.header("Cache-Control", "no-cache");
    return c.html(indexCache);
  });
}
