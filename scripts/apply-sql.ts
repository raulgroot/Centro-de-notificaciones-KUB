/**
 * Apply a SQL file to Supabase via direct Postgres connection.
 *
 *   pnpm exec tsx --env-file=.env.local scripts/apply-sql.ts <file.sql>
 *
 * Uses postgres-js (same driver Drizzle uses). For DDL like ALTER TABLE
 * ... ENABLE ROW LEVEL SECURITY that PostgREST can't issue.
 */

import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { databaseEnv } from "../lib/env";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: tsx scripts/apply-sql.ts <file.sql>");
    process.exit(1);
  }
  const sqlText = await readFile(file, "utf8");
  const env = databaseEnv();
  const sql = postgres(env.url, { prepare: false, max: 1 });
  console.log(`Applying ${file}…`);
  try {
    await sql.unsafe(sqlText);
    console.log("✓ done");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
