import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

// Lokale overstyringer for integrasjonstester (aldri committet): .env.it
const local = path.resolve(process.cwd(), ".env.it");
if (fs.existsSync(local)) dotenv.config({ path: local, override: false });

// Settes FØR api/lib/env.ts importeres (vitest setupFiles kjører før hver testfil).
// Egen database `hellosky_it` — opprettes og migreres i globalSetup.ts.
const ROOT_URL = process.env.IT_ROOT_DATABASE_URL ?? "mysql://root@localhost:3306";
const url = new URL(ROOT_URL);
url.pathname = "/hellosky_it";

process.env.NODE_ENV = "test";
process.env.APP_ENV = "development";
process.env.SKIP_ENV_SAFETY = "true";
process.env.DATABASE_URL = process.env.IT_DATABASE_URL ?? url.toString();
process.env.DUFFEL_API_KEY = ""; // demo-modus; tester injiserer DuffelFake ved behov
process.env.DUFFEL_WEBHOOK_SECRET = "it-duffel-webhook-secret";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_it_test"; // stripe-modulen mockes i testene
delete process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_PUBLISHABLE_KEY;
process.env.PII_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.APP_BASE_URL = "http://localhost:3000";
process.env.LOG_LEVEL = process.env.IT_LOG_LEVEL ?? "error";
process.env.OPS_ALERT_EMAIL = "ops@hellosky.test";
delete process.env.SMTP_URL;
delete process.env.SMTP_HOST;
delete process.env.OPS_ALERT_WEBHOOK_URL;
process.env.MAX_DAILY_LIVE_AMOUNT_MINOR = "0";
// Førstegangsoppsettet er avslått som standard og helt avslått i produksjon.
// Testene må slå det på for i det hele tatt å kunne dekke at det er
// selvdeaktiverende – uten dette svarte setupStatus alltid «nei» og regelen
// ble aldri prøvd.
process.env.STAFF_BOOTSTRAP_ENABLED = "true";
