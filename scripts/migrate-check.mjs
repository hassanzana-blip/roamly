#!/usr/bin/env node
// Feiler hvis db/schema.ts har endringer som ikke er dekket av db/migrations
// (dvs. `drizzle-kit generate` ville laget en ny migrasjon). Kjøres i CI.
import { cpSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const src = path.join(root, "db/migrations");
// drizzle-kit setter "./" foran --out, så mappen må være relativ til cwd.
const rel = ".migrations-check";
const tmp = path.join(root, rel);
rmSync(tmp, { recursive: true, force: true });
try {
  cpSync(src, tmp, { recursive: true });
  const before = JSON.parse(readFileSync(path.join(tmp, "meta/_journal.json"), "utf8"));
  const res = spawnSync("npx", ["drizzle-kit", "generate", "--dialect", "mysql", "--schema", "./db/schema.ts", "--out", rel, "--name", "ci_check"], {
    stdio: "pipe",
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? "mysql://unused:unused@localhost:3306/unused" },
  });
  const out = (res.stdout ?? "") + (res.stderr ?? "");
  if (res.status !== 0 || /error|ENOENT/i.test(out)) {
    process.stderr.write(out);
    process.exit(res.status || 1);
  }
  const after = JSON.parse(readFileSync(path.join(tmp, "meta/_journal.json"), "utf8"));
  const newSql = readdirSync(tmp).filter((f) => f.endsWith(".sql") && !existsSync(path.join(src, f)));
  if (after.entries.length !== before.entries.length || newSql.length) {
    const added = after.entries.slice(before.entries.length).map((e) => e.tag).concat(newSql);
    console.error(`❌ Skjemaet har endringer uten migrasjon. drizzle-kit ville laget: ${added.join(", ")}`);
    console.error("   Kjør `npm run db:generate` og commit db/migrations.");
    process.exit(1);
  }
  console.log("✓ db/migrations dekker db/schema.ts (ingen ny migrasjon nødvendig)");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
