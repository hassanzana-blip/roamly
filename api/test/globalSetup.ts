import "./env";
import { createConnection, createPool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import path from "node:path";

/**
 * Kjøres én gang før hele integrasjonssuiten: opprett `hellosky_it` hvis den
 * mangler og kjør alle migrasjoner fra db/migrations (drizzle migrate).
 */
export default async function setup(): Promise<void> {
  const dbUrl = new URL(process.env.DATABASE_URL!);
  const dbName = dbUrl.pathname.replace(/^\//, "");
  const rootUrl = process.env.IT_ROOT_DATABASE_URL ?? "mysql://root@localhost:3306";

  // Opprett databasen via root (CI: MySQL-tjeneste med root-passord). Lokalt uten
  // TCP-root (unix_socket-auth) hoppes dette over — databasen må da finnes fra før
  // og DATABASE_URL/IT_DATABASE_URL peke på en bruker med rettigheter.
  let migrateUrl = process.env.DATABASE_URL!;
  try {
    const root = await createConnection({ uri: rootUrl });
    try {
      await root.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      migrateUrl = rootUrl.replace(/\/?$/, "") + `/${dbName}`;
    } finally {
      await root.end();
    }
  } catch (err) {
    if (!process.env.IT_DATABASE_URL) throw err;
    console.warn(`[it] root-tilkobling feilet (${(err as Error).message}); bruker IT_DATABASE_URL direkte`);
  }

  const pool = createPool({ uri: migrateUrl, connectionLimit: 2 });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "db/migrations") });
  } finally {
    await pool.end();
  }
}
