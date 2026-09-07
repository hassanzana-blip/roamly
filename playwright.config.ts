import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import fs from "node:fs";

// Lokale DB-innstillinger deles med integrasjonstestene (.env.it, ikke committet).
if (fs.existsSync(".env.it")) dotenv.config({ path: ".env.it", override: false });

// ─── E2E (Playwright) mot bygget app i demo-modus ───────────────────────────
// Forutsetter `npm run build` og en migrert database i E2E_DATABASE_URL
// (default: samme som integrasjonstestene). Starter web + worker selv.

const PORT = Number(process.env.E2E_PORT ?? 3411);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? process.env.IT_DATABASE_URL ?? process.env.DATABASE_URL ?? "mysql://root@localhost:3306/hellosky_it";

const serverEnv = {
  NODE_ENV: "production",
  APP_ENV: "development",
  FORCE_SERVE: "true",
  SKIP_ENV_SAFETY: "true",
  PORT: String(PORT),
  DATABASE_URL,
  APP_BASE_URL: BASE_URL,
  DUFFEL_API_KEY: "",
  STRIPE_SECRET_KEY: "",
  STRIPE_PUBLISHABLE_KEY: "",
  PII_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
  LOG_LEVEL: "warn",
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "nb-NO",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        { command: "node dist/boot.js", url: `${BASE_URL}/healthz`, env: serverEnv, reuseExistingServer: false, timeout: 60_000, stdout: "pipe", stderr: "pipe" },
        { command: "node dist/worker.js", env: { ...serverEnv, FORCE_SERVE: "false" }, reuseExistingServer: false, timeout: 60_000, stdout: "ignore", stderr: "pipe" },
      ],
});
