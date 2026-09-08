import { defineConfig } from "vitest/config";
import path from "path";

// Integrasjonstester mot ekte MySQL/MariaDB (api/test/**/*.it.ts).
// Kjøres sekvensielt (én database) — `npm run test:it`.
const root = path.resolve(import.meta.dirname);

export default defineConfig({
  root,
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "@db": path.resolve(root, "db"),
      "@contracts": path.resolve(root, "contracts"),
      "@assets": path.resolve(root, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["api/test/**/*.it.ts"],
    globalSetup: ["api/test/globalSetup.ts"],
    setupFiles: ["api/test/env.ts"],
    fileParallelism: false,
    sequence: { concurrent: false },
    pool: "forks",
    // Én prosess per testfil. Filene deler ellers modulnivå-tilstand – Stripe-
    // mocken, DuffelFake, rategrenser i minnet – og en fil som kjørte før kan
    // avgjøre hva den neste ser. Hver fil var stabil alene og ustabil i følge;
    // det er den forskjellen dette fjerner.
    poolOptions: { forks: { singleFork: false, isolate: true } },
    maxWorkers: 1,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
