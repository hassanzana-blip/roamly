import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/stripe", () => import("./stripeMock"));

import fs from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { constructWebhookEvent } from "./stripeMock";
import app from "../boot";
import { closeDb, countRows, rows, runJobsUntilIdle, truncateAll } from "./setup";
import { signPayload } from "../lib/duffelWebhook";
import { env } from "../lib/env";
import { inc } from "../lib/metrics";
import { serveStaticFiles } from "../lib/vite";

// ─── HTTP-laget: sikkerhetshoder, Origin-sjekk, rate limit, webhooks ───────

const SECRET = process.env.DUFFEL_WEBHOOK_SECRET!;

function duffelHeaders(body: string, secret = SECRET, ts = Math.floor(Date.now() / 1000)) {
  return { "content-type": "application/json", "x-duffel-signature": `t=${ts},v1=${signPayload(secret, String(ts), body)}` };
}

describe("sikkerhetshoder og CSRF", () => {
  afterAll(closeDb);

  it("svar har CSP, X-Frame-Options, Referrer-Policy og x-request-id", async () => {
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("https://js.stripe.com");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-request-id")).toBeTruthy();
    const root = await app.request("/");
    expect(root.headers.get("content-security-policy")).toBeTruthy();
    expect(root.headers.get("x-frame-options")).toBe("DENY");
  });

  it("/readyz svarer 200 når databasen er oppe", async () => {
    const res = await app.request("/readyz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ready: true });
  });

  it("POST /api/trpc med fremmed Origin → 403; kjent Origin → passerer", async () => {
    const body = JSON.stringify({ json: null });
    const bad = await app.request("/api/trpc/ping", { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body });
    expect(bad.status).toBe(403);
    const ok = await app.request("/api/trpc/ping?batch=1", { method: "GET", headers: { origin: "http://localhost:3000" } });
    expect(ok.status).toBe(200);
    const okPost = await app.request("/api/trpc/flights.airports", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ json: { query: "osl" } }) });
    expect(okPost.status).not.toBe(403);
  });

  it("rate limit → 429 med appCode RATE_LIMITED og retryAfterSec i data.details", async () => {
    const ip = "203.0.113.77";
    let last: Response | null = null;
    for (let i = 0; i < 7; i++) {
      last = await app.request("/api/trpc/customerAuth.requestPasswordReset", {
        method: "POST",
        headers: { origin: "http://localhost:3000", "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ json: { email: `p${i}@hellosky.test` } }),
      });
      if (last.status === 429) break;
    }
    expect(last!.status).toBe(429);
    // superjson-transformer: feilen ligger under error.json
    const json = (await last!.json()) as { error: { json: { data: { code: string; appCode: string; details?: { retryAfterSec?: number } } } } };
    expect(json.error.json.data.code).toBe("TOO_MANY_REQUESTS");
    expect(json.error.json.data.appCode).toBe("RATE_LIMITED");
    expect(json.error.json.data.details?.retryAfterSec).toBeGreaterThan(0);
  });

  it("ukjent /api/*-sti → 404 JSON; payload > 1 MB → 413", async () => {
    const nf = await app.request("/api/finnes-ikke");
    expect(nf.status).toBe(404);
    const big = await app.request("/api/trpc/ping", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: "x".repeat(1024 * 1024 + 10) });
    expect(big.status).toBe(413);
  });
});

describe("metrics", () => {
  afterAll(() => {
    env.METRICS_TOKEN = undefined;
  });

  it("GET /metrics gir Prometheus-tekst med tellerne; METRICS_TOKEN krever bearer", async () => {
    env.METRICS_TOKEN = undefined;
    inc("bookings_confirmed_total");
    inc("refund_cases_total", { state: "requested" });
    const open = await app.request("/metrics");
    expect(open.status).toBe(200);
    expect(open.headers.get("content-type")).toContain("text/plain");
    const body = await open.text();
    for (const name of ["bookings_confirmed_total", "booking_attempts_failed_total", "duffel_requests_total", "stripe_webhooks_total", "jobs_dead_total", "refund_cases_total"]) {
      expect(body).toContain(`# TYPE ${name} counter`);
    }
    expect(body).toMatch(/^bookings_confirmed_total \d+$/m);
    expect(body).toMatch(/^refund_cases_total\{state="requested"\} \d+$/m);

    env.METRICS_TOKEN = "it-metrics-secret";
    const denied = await app.request("/metrics");
    expect(denied.status).toBe(401);
    const wrong = await app.request("/metrics", { headers: { authorization: "Bearer feil" } });
    expect(wrong.status).toBe(401);
    const ok = await app.request("/metrics", { headers: { authorization: "Bearer it-metrics-secret" } });
    expect(ok.status).toBe(200);
  });
});

describe("statiske filer: cache-headere (OTA-092)", () => {
  // Egen katalog i prosjektet (serveStatic bruker sti relativt til cwd) — ryddes etter testen.
  const distDir = path.resolve(process.cwd(), "api/test/.static-it");

  beforeEach(() => {
    fs.rmSync(distDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(distDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(distDir, "index.html"), "<!doctype html><html><head><title>it</title></head><body>ok</body></html>");
    fs.writeFileSync(path.join(distDir, "assets", "app-abc123.js"), "console.log('it')");
    fs.writeFileSync(path.join(distDir, "favicon.svg"), "<svg/>");
  });
  afterAll(() => fs.rmSync(distDir, { recursive: true, force: true }));

  it("/assets/* er immutable i ett år; index.html (også SPA-fallback) er no-cache", async () => {
    const staticApp = new Hono<{ Bindings: HttpBindings }>();
    serveStaticFiles(staticApp, distDir);

    const asset = await staticApp.request("/assets/app-abc123.js");
    expect(asset.status).toBe(200);
    expect(asset.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");

    const root = await staticApp.request("/", { headers: { accept: "text/html" } });
    expect(root.status).toBe(200);
    expect(root.headers.get("cache-control")).toBe("no-cache");

    const spa = await staticApp.request("/bestilling/abc", { headers: { accept: "text/html" } });
    expect(spa.status).toBe(200);
    expect(spa.headers.get("cache-control")).toBe("no-cache");
    expect(await spa.text()).toContain("<title>it</title>");

    const redirect = await staticApp.request("/index.html");
    expect(redirect.status).toBe(301);

    const icon = await staticApp.request("/favicon.svg");
    expect(icon.status).toBe(200);
    expect(icon.headers.get("cache-control")).toBe("public, max-age=3600");
  });
});

describe("webhooks", () => {
  beforeEach(async () => {
    await truncateAll();
    constructWebhookEvent.mockReset();
    constructWebhookEvent.mockImplementation(() => {
      throw new Error("Ugyldig signatur (mock)");
    });
  });
  afterAll(closeDb);

  it("Duffel: gyldig signatur to ganger → 1 webhook_events-rad, begge 200; ugyldig → 401; utløpt → 401", async () => {
    const body = JSON.stringify({ id: "wev_test_1", type: "ping.triggered", data: { object: {} } });
    const a = await app.request("/api/webhooks/duffel", { method: "POST", headers: duffelHeaders(body), body });
    expect(a.status).toBe(200);
    expect(await a.json()).toEqual({ success: true });
    const b = await app.request("/api/webhooks/duffel", { method: "POST", headers: duffelHeaders(body), body });
    expect(b.status).toBe(200);
    expect(await b.json()).toEqual({ success: true, duplicate: true });
    expect(await countRows("webhook_events", "provider='duffel'")).toBe(1);
    expect(await countRows("jobs", "type='duffel_webhook'")).toBe(1);

    const bad = await app.request("/api/webhooks/duffel", { method: "POST", headers: duffelHeaders(body, "feil-hemmelighet"), body });
    expect(bad.status).toBe(401);
    const old = await app.request("/api/webhooks/duffel", { method: "POST", headers: duffelHeaders(body, SECRET, Math.floor(Date.now() / 1000) - 600), body });
    expect(old.status).toBe(401);
    const missing = await app.request("/api/webhooks/duffel", { method: "POST", headers: { "content-type": "application/json" }, body });
    expect(missing.status).toBe(401);
    expect(await countRows("webhook_events")).toBe(1);

    const ran = await runJobsUntilIdle();
    expect(ran).toEqual([expect.objectContaining({ type: "duffel_webhook", outcome: "done" })]);
    const [ev] = await rows<{ status: string }>("SELECT status FROM webhook_events");
    expect(ev.status).toBe("processed");
  });

  it("Duffel: ugyldig JSON eller manglende felt → 400 (etter gyldig signatur)", async () => {
    const body = "{not json";
    const r = await app.request("/api/webhooks/duffel", { method: "POST", headers: duffelHeaders(body), body });
    expect(r.status).toBe(400);
    const body2 = JSON.stringify({ type: "order.updated" });
    const r2 = await app.request("/api/webhooks/duffel", { method: "POST", headers: duffelHeaders(body2), body: body2 });
    expect(r2.status).toBe(400);
  });

  it("Stripe: mocket constructWebhookEvent — duplikat gir 1 rad; ugyldig signatur → 400", async () => {
    const event = { id: "evt_test_1", type: "payment_intent.succeeded", data: { object: { id: "pi_ukjent", status: "succeeded", amount: 1, currency: "nok" } } };
    constructWebhookEvent.mockImplementation((raw: string) => JSON.parse(raw));
    const body = JSON.stringify(event);
    const a = await app.request("/api/webhooks/stripe", { method: "POST", headers: { "stripe-signature": "t=1,v1=abc", "content-type": "application/json" }, body });
    expect(a.status).toBe(200);
    expect(await a.json()).toEqual({ received: true });
    const b = await app.request("/api/webhooks/stripe", { method: "POST", headers: { "stripe-signature": "t=1,v1=abc", "content-type": "application/json" }, body });
    expect(b.status).toBe(200);
    expect(await b.json()).toEqual({ received: true, duplicate: true });
    expect(await countRows("webhook_events", "provider='stripe'")).toBe(1);

    constructWebhookEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });
    const bad = await app.request("/api/webhooks/stripe", { method: "POST", headers: { "stripe-signature": "bogus", "content-type": "application/json" }, body });
    expect(bad.status).toBe(400);
    expect(await countRows("webhook_events")).toBe(1);

    // Ukjent PaymentIntent behandles (logges) uten å feile
    const ran = await runJobsUntilIdle();
    expect(ran).toEqual([expect.objectContaining({ type: "stripe_webhook", outcome: "done" })]);
  });
});
