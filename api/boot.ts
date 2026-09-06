import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createHmac, timingSafeEqual } from "node:crypto";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

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

// ─── Duffel webhooks: verifiser signatur, dedupe, legg i kø, svar raskt ────
app.post("/api/webhooks/duffel", async (c) => {
  const secret = process.env.DUFFEL_WEBHOOK_SECRET;
  if (!secret) return c.json({ error: "Webhook ikke konfigurert" }, 503);

  const rawBody = await c.req.text();
  const signatureHeader = c.req.header("x-duffel-signature") ?? "";
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=") as [string, string]),
  );
  const timestamp = parts.t;
  const received = parts.v1;
  if (!timestamp || !received) return c.json({ error: "Mangler signatur" }, 401);

  // Replay-beskyttelse: maks 5 minutter gammel
  const ageSec = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSec) || ageSec > 300) {
    return c.json({ error: "Utløpt hendelse" }, 401);
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  const valid =
    expected.length === received.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  if (!valid) return c.json({ error: "Ugyldig signatur" }, 401);

  let event: { id?: string; type?: string };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "Ugyldig JSON" }, 400);
  }
  if (!event.id || !event.type) return c.json({ error: "Mangler felt" }, 400);

  try {
    const { getDb } = await import("./queries/connection");
    const { webhookEvents } = await import("../db/schema");
    const { enqueueJob } = await import("./lib/jobs");
    const { eq, and } = await import("drizzle-orm");

    const db = getDb();
    // Dedupe: unik (provider, eventId) — duplikater kvitteres 200 uten behandling
    const existing = await db
      .select({ id: webhookEvents.id })
      .from(webhookEvents)
      .where(and(eq(webhookEvents.provider, "duffel"), eq(webhookEvents.eventId, event.id)))
      .limit(1);
    if (existing.length === 0) {
      const result = await db.insert(webhookEvents).values({
        provider: "duffel",
        eventId: event.id,
        eventType: event.type,
        payload: rawBody,
      });
      await enqueueJob("duffel_webhook", { webhookEventId: Number(result[0].insertId) });
    }
    return c.json({ success: true });
  } catch (err) {
    console.error("Webhook-lagring feilet:", err);
    return c.json({ error: "Intern feil" }, 500);
  }
});

app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction || process.env.FORCE_SERVE === "true") {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  const server = serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });

  // Graceful shutdown: slutt å ta imot ny trafikk, la pågående fullføre
  const shutdown = (signal: string) => {
    console.log(`${signal} mottatt — avslutter ryddig …`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
