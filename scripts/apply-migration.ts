/**
 * Apply a Drizzle .sql migration to Supabase Postgres directly.
 *
 * Uso:
 *   pnpm tsx --env-file=.env.local scripts/apply-migration.ts drizzle/XXXX.sql
 *
 * Requiere DATABASE_URL en .env.local. Sólo correr desde local (la IP de
 * Vercel free tier no puede llegar al endpoint Postgres directo de
 * Supabase por IPv6).
 */

import { readFileSync } from "node:fs";
import postgres from "postgres";
import { databaseEnv } from "@/lib/env";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Uso: tsx scripts/apply-migration.ts <ruta-a-migration.sql>");
    process.exit(1);
  }
  const sql = readFileSync(file, "utf8");

  const { url } = databaseEnv();
  // Supabase usa SSL; postgres-js lo negocia solo si pasamos ssl: 'require'.
  const client = postgres(url, { ssl: "require", max: 1 });
  try {
    console.log(`→ Aplicando ${file}…`);
    await client.unsafe(sql);
    console.log("✓ Migración aplicada.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("\n✗ Error:", err);
  process.exit(1);
});
