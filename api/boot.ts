import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { assertProductionSafety, env } from "./lib/env";
import { log, newRequestId, withContext } from "./lib/logger";
import { stripeWebhookApp } from "./webhooks/stripe";
import { duffelWebhookApp } from "./webhooks/duffel";
import { inlineScriptHashes } from "./lib/vite";
import { captureException, initMonitoring, installProcessHandlers } from "./lib/monitoring";
import { inc, renderPrometheus } from "./lib/metrics";

// ─── Fail-fast: nekt å starte med usikker konfigurasjon (OTA-001) ───────────
assertProductionSafety();

// ─── Observability: Sentry (valgfritt, SENTRY_DSN) + prosessvide feilfangere ─
installProcessHandlers("web");
void initMonitoring("web");

const app = new Hono<{ Bindings: HttpBindings }>();

// ─── Request-ID + korrelasjon i logg (OTA-110) ──────────────────────────────
app.use("*", async (c, next) => {
  const requestId = newRequestId(c.req.header("x-request-id"));
  const started = Date.now();
  await withContext({ requestId }, async () => {
    await next();
    // Settes ETTER next(): Hono fletter ikke forhåndssatte headere inn i en
    // Response som handleren returnerer direkte (slik tRPC-adapteren gjør).
    c.res.headers.set("x-request-id", requestId);
    if (c.req.path.startsWith("/api/")) {
      log.info(
        { method: c.req.method, path: c.req.path.slice(0, 200), status: c.res.status, ms: Date.now() - started },
        "http",
      );
    }
  });
});

// ─── Sikkerhetshoder (OTA-090/091) ───────────────────────────────────────────
// CSP tillater Stripe (Elements + API + 3DS-frames) og Google Fonts.
// 'unsafe-inline' for style er nødvendig for Stripe Elements/Tailwind-runtime.
// Inline-skript i index.html (tema-init) tillates via sha256-hash, ikke 'unsafe-inline'.
const scriptHashes = inlineScriptHashes();
app.use(
  "*",
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      scriptSrc: ["'self'", "https://js.stripe.com", "https://plausible.io", ...scriptHashes],
      connectSrc: ["'self'", "https://api.stripe.com", "https://js.stripe.com", "https://plausible.io", ...(env.isProduction ? [] : ["ws:", "wss:"])],
      frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      workerSrc: ["'self'", "blob:"],
      ...(env.isProduction ? { upgradeInsecureRequests: [] } : {}),
    },
    xFrameOptions: "DENY",
    referrerPolicy: "strict-origin-when-cross-origin",
    strictTransportSecurity: env.isProduction ? "max-age=31536000; includeSubDomains" : false,
    crossOriginEmbedderPolicy: false, // Stripe-iframes krever at COEP ikke er require-corp
    crossOriginResourcePolicy: false,
    xPermittedCrossDomainPolicies: "none",
    permissionsPolicy: { camera: [], microphone: [], geolocation: ["self"], payment: ["self", "https://js.stripe.com"] },
  }),
);

// ─── Kroppsgrenser: 1 MB API, 512 KB webhooks ───────────────────────────────
app.use("/api/webhooks/*", bodyLimit({ maxSize: 512 * 1024, onError: (c) => c.json({ error: "Payload for stor" }, 413) }));
app.use("/api/trpc/*", bodyLimit({ maxSize: 1024 * 1024, onError: (c) => c.json({ error: "Payload for stor" }, 413) }));

// ─── Health checks (ingen tredjeparts-kall — må være billige) ──────────────
app.get("/healthz", (c) => c.json({ ok: true, ts: Date.now() }));
app.get("/readyz", async (c) => {
  try {
    const { getDb } = await import("./queries/connection");
    const { sql } = await import("drizzle-orm");
    await getDb().execute(sql`SELECT 1`);
    return c.json({ ready: true });
  } catch {
    return c.json({ ready: false }, 503);
  }
});

// ─── Metrics (Prometheus-tekst). Beskyttet med METRICS_TOKEN (bearer) når satt. ──
app.get("/metrics", (c) => {
  if (env.METRICS_TOKEN) {
    const auth = c.req.header("authorization") ?? "";
    if (auth !== `Bearer ${env.METRICS_TOKEN}`) return c.text("Unauthorized", 401);
  }
  return c.text(renderPrometheus(), 200, { "content-type": "text/plain; version=0.0.4; charset=utf-8", "cache-control": "no-store" });
});

// ─── Webhooks (egne apper: signatur, dedupe, kø) ─────────────────────────────
app.route("/api/webhooks/stripe", stripeWebhookApp);
app.route("/api/webhooks/duffel", duffelWebhookApp);

// ─── Origin-sjekk for muterende tRPC-kall ────────────────────────────────────
// Ligger i tRPC-laget (api/middleware.ts → originGuard), ikke her: et rått
// 403-svar herfra er ikke en tRPC-konvolutt, og klientens superjson-transformer
// klarer ikke å tolke det («Unable to transform response from server»).

app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
    onError({ error, path }) {
      inc("trpc_errors_total", { code: error.code });
      if (error.code === "INTERNAL_SERVER_ERROR") {
        log.error({ err: error.cause ?? error, path }, "tRPC intern feil");
        captureException(error.cause ?? error, { tags: { source: "trpc", path: path ?? "unknown" } });
      }
    },
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction || process.env.FORCE_SERVE === "true") {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = env.PORT;
  const server = serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
    log.info({ port, appEnv: env.APP_ENV }, "Server running");
    // Midlertidig: ett testsøk mot Travelport ved oppstart mens integrasjonen
    // feilsøkes, slik at hver deploy gir et svar i loggen uten at noen må
    // søke manuelt. Slås av ved å fjerne TRAVELPORT_PROBE_ON_BOOT.
    if (process.env.TRAVELPORT_PROBE_ON_BOOT === "true") {
      void (async () => {
        try {
          const { travelportProbeVariants } = await import("./lib/travelport");
          await travelportProbeVariants();
        } catch (err) {
          log.error({ err: String(err) }, "Travelport-sonde: søk feilet");
        }
      })();
    }
  });

  // Graceful shutdown: slutt å ta imot ny trafikk, la pågående fullføre
  const shutdown = (signal: string) => {
    log.info({ signal }, "avslutter ryddig …");
    server.close(async () => {
      const { closeDb } = await import("./queries/connection");
      await closeDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
