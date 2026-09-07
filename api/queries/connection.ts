import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { createPool, type Pool } from "mysql2/promise";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

export type Db = MySql2Database<typeof fullSchema> & { $client: Pool };

let pool: Pool | undefined;
let instance: Db | undefined;

/**
 * Én delt tilkoblingspool per prosess (OTA-140). Eksplisitt pool-konfig i stedet
 * for drizzle(url): begrenset antall tilkoblinger, kø ved metning og
 * keep-alive slik at TiDB/MySQL-proxyer ikke dropper idle-tilkoblinger.
 */
export function getPool(): Pool {
  if (!pool) {
    if (!env.databaseUrl) throw new Error("DATABASE_URL mangler");
    pool = createPool({
      uri: env.databaseUrl,
      connectionLimit: Number(process.env.DB_POOL_SIZE ?? 10) || 10,
      waitForConnections: true,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10_000,
      connectTimeout: 10_000,
      timezone: "Z",
      supportBigNumbers: true,
    });
  }
  return pool;
}

export function getDb(): Db {
  if (!instance) {
    instance = drizzle(getPool(), { mode: "default", schema: fullSchema });
  }
  return instance;
}

/** Lukk poolen ved ryddig avslutning (SIGTERM). */
export async function closeDb(): Promise<void> {
  if (pool) {
    const p = pool;
    pool = undefined;
    instance = undefined;
    await p.end().catch(() => {});
  }
}
