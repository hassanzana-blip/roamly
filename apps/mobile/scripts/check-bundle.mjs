#!/usr/bin/env node
// Sjekker det eksporterte iOS-bygget (dist/) etter `npm run export:ios`:
// ingen serverkode, ingen leverandørnøkler, ingen hemmelighetsnavn, ingen
// AsyncStorage – og serveradressen fra EXPO_PUBLIC_API_BASE_URL er bygget inn.
import fs from "node:fs";
import path from "node:path";

const dist = path.resolve(import.meta.dirname, "..", "dist");
if (!fs.existsSync(dist)) {
  console.error("Fant ikke dist/. Kjør `npm run export:ios` først.");
  process.exit(1);
}

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

const bundles = files(dist).filter((f) => /\.(hbc|js)$/.test(f));
if (bundles.length === 0) {
  console.error("Ingen JS/Hermes-bunter i dist/.");
  process.exit(1);
}
const text = bundles.map((f) => fs.readFileSync(f).toString("latin1")).join("\n");

const forbidden = [
  // Hemmelighetsnavn og nøkkelprefikser fra serverens miljø (api/lib/env.ts)
  "DUFFEL_API_KEY", "KAYAK_API_KEY", "KAYAK_SANDBOX_API_KEY", "TRAVELPORT_", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
  "CLERK_SECRET_KEY", "DATABASE_URL", "PII_ENCRYPTION_KEY", "SMTP_PASS", "TWILIO_AUTH_TOKEN", "AVIATIONSTACK_API_KEY",
  "METRICS_TOKEN", "BOOTSTRAP_OWNER", "BOOTSTRAP_ADMIN", "duffel_live_", "duffel_test_", "sk_live_", "sk_test_", "whsec_",
  // Serverkode
  "drizzle-orm", "mysql2", "@hono/node-server", "api/lib/", "staffAuth", "adminOwner",
  // Lagring som ikke er nøkkelringen
  "@react-native-async-storage", "AsyncStorage",
];
const hits = forbidden.filter((s) => text.includes(s));

const base = process.env.EXPO_PUBLIC_API_BASE_URL;
const problems = [];
if (hits.length) problems.push(`Forbudte strenger i bygget: ${hits.join(", ")}`);
if (base && !text.includes(base)) problems.push(`Serveradressen ${base} er ikke bygget inn.`);
if (!text.includes("/api/mobile/trpc")) problems.push("Appens API-sti (/api/mobile/trpc) mangler i bygget.");

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`OK: ${bundles.length} bunt(er) sjekket, ${(text.length / 1024 / 1024).toFixed(1)} MB. Ingen serverkode eller hemmeligheter.`);
