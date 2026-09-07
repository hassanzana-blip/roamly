#!/usr/bin/env node
// Kjør ventende migrasjoner (db/migrations) mot DATABASE_URL.
// Fungerer både fra kildekode (npm run db:migrate:prod) og fra det bygde
// Docker-bildet: node scripts/migrate.mjs — bruker kun drizzle-orm + mysql2.
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL mangler");
  process.exit(1);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.resolve(here, "../db/migrations");

const pool = createPool({ uri: url, connectionLimit: 2, connectTimeout: 15_000 });
const started = Date.now();
try {
  await migrate(drizzle(pool), { migrationsFolder });
  console.log(`✓ migrasjoner kjørt fra ${migrationsFolder} (${Date.now() - started} ms)`);
} catch (err) {
  console.error("✗ migrering feilet:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
