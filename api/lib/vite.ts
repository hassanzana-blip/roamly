import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

import { createHash } from "node:crypto";

import { isKnownRoute, normalizePath } from "../../contracts/seoRoutes";
import { withSeoHead } from "./seoHead";
import { dynamicContentExists, prerenderBody } from "./prerender";
import { sitemapXml } from "./sitemap";

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

  /**
   * sitemap.xml bygges fra innholdsregistrene (api/lib/sitemap.ts), ikke fra en
   * håndskrevet fil under public/. Ruten står før serveStatic slik at den
   * vinner selv om en gammel public/sitemap.xml skulle ligge igjen i et bygg.
   */
  app.get("/sitemap.xml", (c) => {
    c.header("Content-Type", "application/xml; charset=utf-8");
    c.header("Cache-Control", "public, max-age=300");
    return c.body(sitemapXml());
  });

  /**
   * Appskallet med metadata for den faktiske stien – og for innholdssidene
   * også selve innholdet som HTML.
   *
   * Søket og kontosidene rendres ikke på serveren: de er en app, de trenger
   * data vi ikke har før brukeren spør, og de skal ikke indekseres. Men
   * reisemål, ruter, journal og indekssider er tekst vi allerede har, og de
   * sendes nå som HTML slik at en crawler uten JavaScript ser dem.
   */
  const shell = (reqPath: string): string => {
    if (indexCache === null || process.env.NODE_ENV !== "production") {
      indexCache = fs.readFileSync(indexPath, "utf-8");
    }
    const html = withSeoHead(indexCache, reqPath);
    const body = prerenderBody(normalizePath(reqPath));
    if (!body) return html;
    return html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  };

  // Forsiden serveres av samme kode som alle andre ruter. Uten denne ruten ville
  // serveStatic levert dist/public/index.html rått, og forsiden vært den eneste
  // siden uten injisert metadata – riktig i dag, men en felle neste gang
  // standardverdiene i index.html endres.
  app.get("/", (c) => {
    c.header("Cache-Control", "no-cache");
    return c.html(shell("/"));
  });

  app.use("*", serveStatic({ root: path.relative(process.cwd(), distPath) || ".", precompressed: true }));

  /**
   * SPA-fallback: en rute appen faktisk har får appskallet med 200, alt annet
   * får 404.
   *
   * Skillet gikk før på `Accept: text/html`, så på om stien så ut som en fil.
   * Begge deler ga 200 OK for hvilken som helst oppdiktet sti – Google kaller
   * det en soft 404 og bruker crawl-budsjett på uendelig mange ikke-sider.
   * Nå avgjør rutelisten i contracts/seoRoutes.ts, som speiler <Route> i
   * src/App.tsx: ukjent sti → 404-status, noindex, og samme 404-side som før.
   */
  const looksLikeFile = (p: string) => /\.[a-z0-9]{2,8}$/i.test(p);

  app.notFound((c) => {
    const reqPath = c.req.path;
    if (reqPath.startsWith("/api/") || looksLikeFile(reqPath)) {
      return c.json({ error: "Not Found" }, 404);
    }
    c.header("Cache-Control", "no-cache");
    // To spørsmål, ikke ett: har appen en rute for mønsteret, og finnes
    // innholdet bak den? /reisemal/finnes-ikke besto den første og strøk på
    // den andre, og svarte 200 med en tom side.
    const known = isKnownRoute(reqPath) && dynamicContentExists(reqPath) !== false;
    if (!known) {
      c.header("X-Robots-Tag", "noindex");
      return c.html(shell(reqPath), 404);
    }
    return c.html(shell(reqPath));
  });
}
